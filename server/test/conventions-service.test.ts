/**
 * ConventionsService with fake ports + MockLLMProvider (structuredBySchema) —
 * no Docker. Covers evidence verification, re-scan keeping accepted, the
 * "nothing to analyse" guard, and "skill only from accepted".
 */
import { describe, it, expect } from 'vitest';
import type { CreateConventionSkillInput, Skill } from '@devdigest/shared';
import { ConventionsService } from '../src/modules/conventions/service.js';
import type {
  ConventionPatch,
  ConventionRecord,
  ConventionsRepositoryPort,
  NewConvention,
} from '../src/modules/conventions/types.js';
import { MockLLMProvider } from '../src/adapters/mocks.js';
import { NotFoundError, ValidationError } from '../src/platform/errors.js';

const WS = 'ws-1';
const REPO_ID = 'repo-1';

const FILES: Record<string, string> = {
  'src/api/users.ts': 'export async function get(id) {\n  const user = await db.users.find(id);\n  return user;\n}',
  'src/lib/redis.ts': 'export const redis = new Redis(config.redisUrl);',
  'tsconfig.json': '{ "compilerOptions": { "strict": true } }',
};

class FakeConventions implements ConventionsRepositoryPort {
  rows: ConventionRecord[] = [];
  private seq = 0;
  async listByRepo(ws: string, repoId: string) {
    return this.rows.filter((r) => r.workspaceId === ws && r.repoId === repoId);
  }
  async get(ws: string, id: string) {
    return this.rows.find((r) => r.workspaceId === ws && r.id === id);
  }
  async update(ws: string, id: string, patch: ConventionPatch) {
    const r = await this.get(ws, id);
    if (!r) return undefined;
    Object.assign(r, Object.fromEntries(Object.entries(patch).filter(([, v]) => v !== undefined)));
    return r;
  }
  async replaceNonAccepted(ws: string, repoId: string, rows: NewConvention[]) {
    this.rows = this.rows.filter(
      (r) => !(r.workspaceId === ws && r.repoId === repoId && r.status !== 'accepted'),
    );
    for (const n of rows) {
      this.rows.push({ ...n, id: `c${++this.seq}`, workspaceId: ws, repoId, status: 'pending', createdAt: new Date() });
    }
  }
}

function setup(opts: { candidates?: unknown[]; samples?: string[] } = {}) {
  const conventions = new FakeConventions();
  const llm = new MockLLMProvider('openai', {
    structuredBySchema: {
      ConventionExtraction: {
        candidates: opts.candidates ?? [
          { rule: 'Always use async/await instead of .then() chains', evidence_path: 'src/api/users.ts', evidence_snippet: 'const user = await db.users.find(id);', confidence: 0.91 },
          { rule: 'Redis access goes through src/lib/redis.ts', evidence_path: 'src/lib/redis.ts', evidence_snippet: 'export const redis = new Redis(config.redisUrl);', confidence: 0.85 },
          // hallucinated snippet → dropped
          { rule: 'Return Result<T, ApiError>', evidence_path: 'src/api/users.ts', evidence_snippet: 'return ok(items);', confidence: 0.78 },
          // file never sent → dropped
          { rule: 'Use zod for env', evidence_path: 'src/env.ts', evidence_snippet: 'z.object', confidence: 0.7 },
        ],
      },
    },
  });
  const created: { input: CreateConventionSkillInput; evidenceFiles: string[] }[] = [];
  const service = new ConventionsService({
    conventions,
    repos: {
      async get(ws, id) {
        return ws === WS && id === REPO_ID
          ? { id: REPO_ID, fullName: 'acme/payments-api', ref: { owner: 'acme', name: 'payments-api' } }
          : undefined;
      },
    },
    samples: async () => opts.samples ?? ['src/api/users.ts', 'src/lib/redis.ts'],
    readFile: async (_ref, path) => FILES[path] ?? null,
    model: async () => ({ llm, model: 'cheap-model' }),
    skills: {
      async createExtracted(_ws, input, evidenceFiles) {
        created.push({ input, evidenceFiles });
        return { id: 's1', name: input.name, type: 'convention', source: 'extracted' } as Skill;
      },
    },
  });
  return { service, conventions, llm, created };
}

describe('ConventionsService.extract', () => {
  it('makes ONE structured call and stores only evidence-backed candidates', async () => {
    const { service, llm } = setup();
    const res = await service.extract(WS, REPO_ID);
    expect(llm.calls.filter((c) => c.method === 'completeStructured')).toHaveLength(1);
    expect(res.sampled_files).toBe(3); // 2 samples + tsconfig.json
    expect(res.candidates.map((c) => c.rule)).toEqual([
      'Always use async/await instead of .then() chains',
      'Redis access goes through src/lib/redis.ts',
    ]);
    expect(res.candidates.every((c) => c.status === 'pending' && !c.accepted)).toBe(true);
  });

  it('sends files wrapped as untrusted and uses the conventions model', async () => {
    const { service, llm } = setup();
    await service.extract(WS, REPO_ID);
    const req = llm.calls[0]!.req as { model: string; schemaName: string; messages: { content: string }[] };
    expect(req.model).toBe('cheap-model');
    expect(req.schemaName).toBe('ConventionExtraction');
    expect(req.messages[1]!.content).toContain('<untrusted source="file:src/api/users.ts">');
    expect(req.messages[1]!.content).toContain('<untrusted source="file:tsconfig.json">');
  });

  it('re-scan keeps accepted, replaces pending/rejected and skips duplicate rules', async () => {
    const { service } = setup();
    const first = await service.extract(WS, REPO_ID);
    await service.update(WS, first.candidates[0]!.id, { status: 'accepted' });
    await service.update(WS, first.candidates[1]!.id, { status: 'rejected' });

    const second = await service.extract(WS, REPO_ID);
    const rules = second.candidates.map((c) => [c.rule, c.status]);
    expect(rules).toEqual([
      ['Always use async/await instead of .then() chains', 'accepted'],
      ['Redis access goes through src/lib/redis.ts', 'pending'],
    ]);
  });

  it('refuses when repo-intel has no source files for the repo', async () => {
    const { service, llm } = setup({ samples: [] });
    await expect(service.extract(WS, REPO_ID)).rejects.toBeInstanceOf(ValidationError);
    expect(llm.calls).toHaveLength(0);
  });

  it('404s for an unknown repo', async () => {
    const { service } = setup();
    await expect(service.extract(WS, 'nope')).rejects.toBeInstanceOf(NotFoundError);
  });
});

describe('ConventionsService.update', () => {
  it('edits the rule text and toggles status; 404 for unknown id', async () => {
    const { service } = setup();
    const { candidates } = await service.extract(WS, REPO_ID);
    const edited = await service.update(WS, candidates[0]!.id, { rule: 'Prefer async/await' });
    expect(edited.rule).toBe('Prefer async/await');
    const accepted = await service.update(WS, candidates[0]!.id, { status: 'accepted' });
    expect(accepted).toMatchObject({ status: 'accepted', accepted: true });
    await expect(service.update(WS, 'missing', { status: 'rejected' })).rejects.toBeInstanceOf(NotFoundError);
  });
});

describe('ConventionsService.createSkill', () => {
  const input = { name: 'payments-api-conventions', description: 'House rules', body: '# rules' };

  it('requires at least one accepted candidate', async () => {
    const { service, created } = setup();
    await service.extract(WS, REPO_ID);
    await expect(service.createSkill(WS, REPO_ID, input)).rejects.toBeInstanceOf(ValidationError);
    expect(created).toHaveLength(0);
  });

  it('uses only ACCEPTED candidates for evidence files (rejected are excluded)', async () => {
    const { service, created } = setup();
    const { candidates } = await service.extract(WS, REPO_ID);
    await service.update(WS, candidates[0]!.id, { status: 'accepted' });
    await service.update(WS, candidates[1]!.id, { status: 'rejected' });
    const skill = await service.createSkill(WS, REPO_ID, input);
    expect(skill).toMatchObject({ type: 'convention', source: 'extracted' });
    expect(created[0]!.evidenceFiles).toEqual(['src/api/users.ts']);
  });
});
