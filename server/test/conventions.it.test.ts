import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { startPg, dockerAvailable, type PgFixture } from './helpers/pg.js';
import { waitForPrRuns } from './helpers/runs.js';
import { buildApp } from '../src/app.js';
import { loadConfig } from '../src/platform/config.js';
import { seed } from '../src/db/seed.js';
import * as t from '../src/db/schema.js';
import { MockEmbedder, MockGitClient, MockLLMProvider } from '../src/adapters/mocks.js';
import type { RepoIntel } from '../src/modules/repo-intel/types.js';
import type { ConventionCandidate, Review } from '@devdigest/shared';

const hasDocker = await dockerAvailable();
const d = hasDocker ? describe : describe.skip;
const config = () => loadConfig({ ...process.env, NODE_ENV: 'test' } as NodeJS.ProcessEnv);

const FILES: Record<string, string> = {
  'src/api/users.ts':
    'export async function get(id: string) {\n  const user = await db.users.find(id);\n  return user;\n}',
  'src/lib/redis.ts': 'export const redis = new Redis(config.redisUrl);',
  'src/api/public/index.ts': 'export function handler(): Result<Item[], ApiError> {\n  return ok(items);\n}',
};

const EXTRACTION = {
  candidates: [
    { rule: 'Always use async/await instead of .then() chains', evidence_path: 'src/api/users.ts', evidence_snippet: 'const user = await db.users.find(id);', confidence: 0.91 },
    { rule: 'Public handlers return Result<T, ApiError>', evidence_path: 'src/api/public/index.ts', evidence_snippet: 'function handler(): Result<Item[], ApiError> {', confidence: 0.78 },
    { rule: 'Redis access goes through src/lib/redis.ts', evidence_path: 'src/lib/redis.ts', evidence_snippet: 'export const redis = new Redis(config.redisUrl);', confidence: 0.85 },
    { rule: 'Hallucinated rule', evidence_path: 'src/api/users.ts', evidence_snippet: 'users.then(cb)', confidence: 0.9 },
  ],
};

const REVIEW: Review = { verdict: 'comment', summary: 'ok', score: 90, findings: [] };

const DIFF = `diff --git a/src/api/users.ts b/src/api/users.ts
--- a/src/api/users.ts
+++ b/src/api/users.ts
@@ -1,2 +1,3 @@
 export async function get(id: string) {
+  return db.users.find(id).then((u) => u);
 }`;

/**
 * L02 Conventions Extractor — P1 acceptance over HTTP: extract shows grounded
 * candidates, accept/reject/edit, the skill is built only from accepted ones
 * (type convention, source extracted), and it can be linked to an agent and
 * reaches the review's system prompt.
 */
d('L02 conventions (Testcontainers pg)', () => {
  let pg: PgFixture;
  let workspaceId: string;
  let repoId: string;
  let llm: MockLLMProvider;

  beforeAll(async () => {
    pg = await startPg();
    await seed(pg.handle.db);
    const [ws] = await pg.handle.db.select().from(t.workspaces);
    workspaceId = ws!.id;
    const [repo] = await pg.handle.db
      .insert(t.repos)
      .values({ workspaceId, owner: 'acme', name: 'conv-it', fullName: 'acme/conv-it' })
      .returning();
    repoId = repo!.id;
  });
  afterAll(async () => {
    await pg?.stop();
  });

  function makeApp(opts: { samples?: string[] } = {}) {
    llm = new MockLLMProvider('openai', {
      structuredBySchema: { ConventionExtraction: EXTRACTION },
      structured: REVIEW,
    });
    // Only getConventionSamples is used by the conventions module.
    const repoIntel = {
      getConventionSamples: async () => opts.samples ?? Object.keys(FILES),
    } as unknown as RepoIntel;
    return buildApp({
      config: config(),
      db: pg.handle.db,
      overrides: {
        embedder: new MockEmbedder(),
        git: new MockGitClient({ files: FILES, diff: DIFF }),
        llm: { openai: llm },
        repoIntel,
      },
    });
  }

  it('extract → list → accept/reject/edit → skill from accepted only → agent → review', async () => {
    const app = await makeApp();

    // empty before the first scan
    const empty = await app.inject({ method: 'GET', url: `/repos/${repoId}/conventions` });
    expect(empty.statusCode).toBe(200);
    expect(empty.json()).toEqual([]);

    // P1.1 — extraction returns grounded candidates (hallucinated one dropped)
    const ex = await app.inject({ method: 'POST', url: `/repos/${repoId}/conventions/extract` });
    expect(ex.statusCode).toBe(200);
    const { candidates, sampled_files } = ex.json() as { candidates: ConventionCandidate[]; sampled_files: number };
    expect(sampled_files).toBe(3);
    expect(candidates.map((c) => c.rule)).toEqual([
      'Always use async/await instead of .then() chains',
      'Public handlers return Result<T, ApiError>',
      'Redis access goes through src/lib/redis.ts',
    ]);
    expect(llm.calls.filter((c) => c.method === 'completeStructured')).toHaveLength(1);
    const list = (await app.inject({ method: 'GET', url: `/repos/${repoId}/conventions` })).json();
    expect(list).toHaveLength(3);

    // P1.2 — accept / reject / edit
    const [asyncRule, resultRule, redisRule] = candidates;
    const acc = await app.inject({ method: 'PATCH', url: `/conventions/${asyncRule!.id}`, payload: { status: 'accepted' } });
    expect(acc.json()).toMatchObject({ status: 'accepted', accepted: true });
    await app.inject({ method: 'PATCH', url: `/conventions/${redisRule!.id}`, payload: { status: 'accepted' } });
    const rej = await app.inject({ method: 'PATCH', url: `/conventions/${resultRule!.id}`, payload: { status: 'rejected' } });
    expect(rej.json()).toMatchObject({ status: 'rejected', accepted: false });
    const edit = await app.inject({
      method: 'PATCH',
      url: `/conventions/${redisRule!.id}`,
      payload: { rule: 'Access Redis only via the src/lib/redis.ts singleton' },
    });
    expect(edit.json()).toMatchObject({ rule: 'Access Redis only via the src/lib/redis.ts singleton', status: 'accepted' });
    const bad = await app.inject({ method: 'PATCH', url: `/conventions/${redisRule!.id}`, payload: {} });
    expect(bad.statusCode).toBe(422);

    // re-scan keeps accepted (incl. the edited text), replaces the rest
    const again = (await app.inject({ method: 'POST', url: `/repos/${repoId}/conventions/extract` })).json() as {
      candidates: ConventionCandidate[];
    };
    expect(again.candidates.filter((c) => c.status === 'accepted').map((c) => c.rule)).toEqual([
      'Always use async/await instead of .then() chains',
      'Access Redis only via the src/lib/redis.ts singleton',
    ]);
    const fresh = again.candidates.filter((c) => c.status !== 'accepted');
    expect(fresh.map((c) => c.status)).toEqual(['pending', 'pending']);
    // reject the Result rule again for the skill step
    const resultAgain = fresh.find((c) => c.rule.startsWith('Public handlers'))!;
    await app.inject({ method: 'PATCH', url: `/conventions/${resultAgain.id}`, payload: { status: 'rejected' } });

    // P1.3 — skill from accepted only
    const body = '# conv-it-conventions\n\n## Always use async/await instead of .then() chains\n';
    const sk = await app.inject({
      method: 'POST',
      url: `/repos/${repoId}/conventions/skill`,
      payload: { name: 'conv-it-conventions', description: '2 house conventions', body, enabled: true },
    });
    expect(sk.statusCode).toBe(201);
    const skill = sk.json();
    expect(skill).toMatchObject({ name: 'conv-it-conventions', type: 'convention', source: 'extracted', version: 1 });
    expect([...skill.evidence_files].sort()).toEqual(['src/api/users.ts', 'src/lib/redis.ts']);
    expect(skill.evidence_files).not.toContain('src/api/public/index.ts');
    const dup = await app.inject({
      method: 'POST',
      url: `/repos/${repoId}/conventions/skill`,
      payload: { name: 'conv-it-conventions', description: 'x', body: 'x' },
    });
    expect(dup.statusCode).toBe(409);

    // P1.4 — link to an agent and run a review: the skill reaches the system prompt
    const agent = (
      await app.inject({
        method: 'POST',
        url: '/agents',
        payload: { name: 'Conventions IT', provider: 'openai', model: 'gpt-4.1', system_prompt: 'AGENT' },
      })
    ).json();
    const link = await app.inject({
      method: 'PUT',
      url: `/agents/${agent.id}/skills`,
      payload: { skills: [{ skill_id: skill.id, enabled: true }] },
    });
    expect(link.statusCode).toBe(200);
    const links = (await app.inject({ method: 'GET', url: `/agents/${agent.id}/skills` })).json();
    expect(links.map((l: { name: string }) => l.name)).toContain('conv-it-conventions');

    const [pr] = await pg.handle.db
      .insert(t.pullRequests)
      .values({
        workspaceId, repoId, number: 901, title: 'Users', author: 'a', branch: 'b',
        base: 'main', headSha: 'abc', additions: 1, deletions: 0, filesCount: 1, status: 'needs_review',
      })
      .returning();
    // review in an app WITHOUT the repoIntel stub (the run path uses the real facade)
    const reviewApp = await buildApp({
      config: config(),
      db: pg.handle.db,
      overrides: { embedder: new MockEmbedder(), git: new MockGitClient({ diff: DIFF }), llm: { openai: llm } },
    });
    const run = await reviewApp.inject({ method: 'POST', url: `/pulls/${pr!.id}/review`, payload: { agentId: agent.id } });
    expect(run.statusCode).toBeLessThan(300);
    await waitForPrRuns(pg.handle.db, pr!.id, { expected: 1 });
    const call = llm.calls.filter((c) => c.method === 'completeStructured').at(-1)!;
    const system = (call.req as { messages: { role: string; content: string }[] }).messages[0]!.content;
    expect(system).toContain('### Skill: conv-it-conventions');
    expect(system).toContain('Always use async/await instead of .then() chains');
  });

  it('skill creation refuses when nothing is accepted; extract refuses an unindexed repo', async () => {
    const [repo] = await pg.handle.db
      .insert(t.repos)
      .values({ workspaceId, owner: 'acme', name: 'conv-empty', fullName: 'acme/conv-empty' })
      .returning();
    const app = await makeApp({ samples: [] });
    const ex = await app.inject({ method: 'POST', url: `/repos/${repo!.id}/conventions/extract` });
    expect(ex.statusCode).toBe(422);
    const sk = await app.inject({
      method: 'POST',
      url: `/repos/${repo!.id}/conventions/skill`,
      payload: { name: 'nothing-accepted', description: 'd', body: 'b' },
    });
    expect(sk.statusCode).toBe(422);
    const missing = await app.inject({ method: 'GET', url: `/repos/00000000-0000-0000-0000-000000000000/conventions` });
    expect(missing.statusCode).toBe(404);
  });
});
