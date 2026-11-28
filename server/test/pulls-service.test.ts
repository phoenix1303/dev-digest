/**
 * PullsService with fake ports — no Docker, no Fastify. Covers the local-first
 * rules: offline reads, diff-stat backfill cap, detail fallback, comment errors.
 */
import { describe, it, expect } from 'vitest';
import type { PrDetail, PrMeta } from '@devdigest/shared';
import { PullsService } from '../src/modules/pulls/service.js';
import type {
  DiffStats,
  PullRecord,
  PullRepo,
  PullsRepositoryPort,
  ReviewListRow,
} from '../src/modules/pulls/types.js';
import type { FindingRow } from '../src/modules/pulls/findings-summary.js';
import type { RunCostRow } from '../src/modules/pulls/cost.js';
import { DIFF_STAT_BACKFILL_LIMIT } from '../src/modules/pulls/constants.js';
import { MockGitHubClient } from '../src/adapters/mocks.js';
import { AppError, NotFoundError } from '../src/platform/errors.js';

const WS = 'ws-1';
const REPO: PullRepo = { id: 'repo-1', owner: 'acme', name: 'api' };

function record(n: number, stats: Partial<DiffStats> = {}): PullRecord {
  return {
    id: `pr-${n}`,
    repoId: REPO.id,
    number: n,
    title: `PR ${n}`,
    author: 'a',
    branch: 'b',
    base: 'main',
    headSha: `sha${n}`,
    lastReviewedSha: null,
    additions: stats.additions ?? 0,
    deletions: stats.deletions ?? 0,
    filesCount: stats.filesCount ?? 0,
    status: 'open',
    openedAt: null,
    updatedAt: null,
  };
}

class FakePulls implements PullsRepositoryPort {
  upserts: PrMeta[][] = [];
  statUpdates: string[] = [];
  replaced: string[] = [];
  constructor(
    public rows: PullRecord[],
    public persisted: PrDetail | undefined = undefined,
  ) {}
  async getRepo(ws: string, id: string) {
    return ws === WS && id === REPO.id ? REPO : undefined;
  }
  async getById(_ws: string, id: string) {
    return this.rows.find((r) => r.id === id);
  }
  async getByNumber(_ws: string, _repo: string, n: number) {
    return this.rows.find((r) => r.number === n);
  }
  async listByRepo() {
    return this.rows.map((r) => ({ ...r }));
  }
  async upsertFromGitHub(_ws: string, _repo: string, pulls: PrMeta[]) {
    this.upserts.push(pulls);
  }
  async updateDiffStats(prId: string) {
    this.statUpdates.push(prId);
  }
  async replaceDetail(prId: string) {
    this.replaced.push(prId);
  }
  async getPersistedDetail() {
    return this.persisted;
  }
  reviews: ReviewListRow[] = [];
  findings: FindingRow[] = [];
  costs: RunCostRow[] = [];
  async reviewsNewestFirst() {
    return this.reviews;
  }
  async findingsForReviews(ids: string[]) {
    return this.findings.filter((f) => ids.includes(f.reviewId));
  }
  async runCosts() {
    return this.costs;
  }
}

const silent = { warn: () => {} };
const offline = () => Promise.reject(new Error('no token'));

describe('PullsService', () => {
  it('lists persisted PRs without touching GitHub when it is unavailable', async () => {
    const pulls = new FakePulls([record(1, { additions: 3 })]);
    const svc = new PullsService({ pulls, github: offline, log: silent });
    const list = await svc.listForRepo(WS, REPO.id);
    expect(list.map((p) => p.number)).toEqual([1]);
    expect(pulls.upserts).toHaveLength(0);
    expect(pulls.statUpdates).toHaveLength(0);
  });

  it('list carries latest-review score, latest-round findings and total cost (M1)', async () => {
    const pulls = new FakePulls([record(1, { additions: 3 }), record(2, { additions: 3 })]);
    // Newest first: r2 is agent A's re-run (supersedes r1); r3 is agent B.
    pulls.reviews = [
      { id: 'r2', prId: 'pr-1', agentId: 'A', score: 80 },
      { id: 'r3', prId: 'pr-1', agentId: 'B', score: 60 },
      { id: 'r1', prId: 'pr-1', agentId: 'A', score: 10 },
    ];
    const f = (id: string, reviewId: string, severity: string): FindingRow => ({
      id,
      reviewId,
      severity,
      category: 'bug',
      title: id,
      file: 'a.ts',
      startLine: 1,
      endLine: 1,
      rationale: 'why',
      confidence: 0.9,
    });
    pulls.findings = [f('f1', 'r1', 'CRITICAL'), f('f2', 'r2', 'WARNING'), f('f3', 'r3', 'CRITICAL')];
    pulls.costs = [
      { prId: 'pr-1', costUsd: 0.01 },
      { prId: 'pr-1', costUsd: 0.02 },
    ];
    const svc = new PullsService({ pulls, github: offline, log: silent });
    const [one, two] = await svc.listForRepo(WS, REPO.id);
    expect(one!.score).toBe(80);
    expect(one!.cost_usd).toBeCloseTo(0.03);
    expect(one!.findings?.total).toBe(2);
    expect(one!.findings?.counts).toEqual({ CRITICAL: 1, WARNING: 1, SUGGESTION: 0 });
    expect(two!.score).toBeNull();
    expect(two!.cost_usd).toBeNull();
    expect(two!.findings).toBeNull();
  });

  it('caps the diff-stat backfill per request', async () => {
    const rows = Array.from({ length: DIFF_STAT_BACKFILL_LIMIT + 5 }, (_, i) => record(i + 1));
    const pulls = new FakePulls(rows);
    const gh = new MockGitHubClient({ pulls: [] });
    const svc = new PullsService({ pulls, github: async () => gh, log: silent });
    const list = await svc.listForRepo(WS, REPO.id);
    expect(pulls.upserts).toHaveLength(1);
    expect(pulls.statUpdates).toHaveLength(DIFF_STAT_BACKFILL_LIMIT);
    // Backfilled rows are returned with the fresh stats.
    expect(list[0]!.additions).toBe(247);
    expect(list.at(-1)!.additions).toBe(0);
  });

  it('throws NotFound for a repo outside the workspace', async () => {
    const svc = new PullsService({ pulls: new FakePulls([]), github: offline, log: silent });
    await expect(svc.listForRepo('other-ws', REPO.id)).rejects.toBeInstanceOf(NotFoundError);
  });

  it('getDetail refreshes from GitHub and persists it', async () => {
    const pulls = new FakePulls([record(7, { additions: 1 })]);
    const gh = new MockGitHubClient();
    const svc = new PullsService({ pulls, github: async () => gh, log: silent });
    const detail = await svc.getDetail(WS, 'pr-7');
    expect(detail.id).toBe('pr-7');
    expect(pulls.replaced).toEqual(['pr-7']);
  });

  it('getDetailByNumber falls back to the persisted detail when GitHub is offline', async () => {
    const persisted = { id: 'pr-7', number: 7, files: [], commits: [] } as unknown as PrDetail;
    const pulls = new FakePulls([record(7)], persisted);
    const svc = new PullsService({ pulls, github: offline, log: silent });
    await expect(svc.getDetailByNumber(WS, REPO.id, 7)).resolves.toBe(persisted);
    await expect(svc.getDetailByNumber(WS, REPO.id, 8)).rejects.toBeInstanceOf(NotFoundError);
  });

  it('createComment without a GitHub token → github_unavailable', async () => {
    const svc = new PullsService({ pulls: new FakePulls([record(7)]), github: offline, log: silent });
    const err = await svc
      .createComment(WS, 'pr-7', { path: 'a.ts', line: 1, body: 'x' })
      .catch((e: unknown) => e);
    expect(err).toBeInstanceOf(AppError);
    expect((err as AppError).code).toBe('github_unavailable');
  });
});
