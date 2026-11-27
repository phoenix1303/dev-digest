/**
 * M1 — PR-list FINDINGS column (`modules/pulls/findings-summary.ts`):
 * latest round = newest review of each agent; counts + capped preview.
 */
import { describe, it, expect } from 'vitest';
import {
  findingsSummaries,
  latestRoundReviewIds,
  PREVIEW_LIMIT,
  RATIONALE_MAX,
  type FindingRow,
} from '../src/modules/pulls/findings-summary.js';

const finding = (id: string, reviewId: string, severity: string, confidence = 0.9, rationale = 'why'): FindingRow => ({
  id,
  reviewId,
  severity,
  category: 'bug',
  title: `t-${id}`,
  file: 'a.ts',
  startLine: 1,
  endLine: 2,
  rationale,
  confidence,
});

describe('latestRoundReviewIds', () => {
  it('keeps the newest review of each agent per PR, orphans grouped together', () => {
    const m = latestRoundReviewIds([
      { id: 'r4', prId: 'pr1', agentId: 'sec' }, // newest Security
      { id: 'r3', prId: 'pr1', agentId: 'perf' }, // newest Performance
      { id: 'r2', prId: 'pr1', agentId: 'sec' }, // older Security — ignored
      { id: 'r1', prId: 'pr1', agentId: null }, // newest orphan
      { id: 'r0', prId: 'pr1', agentId: null }, // older orphan — ignored
      { id: 'q1', prId: 'pr2', agentId: 'sec' },
    ]);
    expect(m.get('pr1')).toEqual(['r4', 'r3', 'r1']);
    expect(m.get('pr2')).toEqual(['q1']);
  });
});

describe('findingsSummaries', () => {
  it('counts every finding of the round per severity and ignores other reviews', () => {
    const round = new Map([['pr1', ['r4', 'r3']]]);
    const m = findingsSummaries(round, [
      finding('a', 'r4', 'CRITICAL'),
      finding('b', 'r4', 'WARNING'),
      finding('c', 'r3', 'CRITICAL'),
      finding('d', 'r3', 'SUGGESTION'),
      finding('old', 'r2', 'CRITICAL'), // older review — not in round
    ]);
    expect(m.get('pr1')).toMatchObject({ total: 4, counts: { CRITICAL: 2, WARNING: 1, SUGGESTION: 1 } });
  });

  it('a reviewed PR with no findings has a zero summary', () => {
    const m = findingsSummaries(new Map([['pr1', ['r1']]]), []);
    expect(m.get('pr1')).toEqual({ total: 0, counts: { CRITICAL: 0, WARNING: 0, SUGGESTION: 0 }, preview: [] });
  });

  it('preview is severity-then-confidence ordered, capped and truncated', () => {
    const many = Array.from({ length: PREVIEW_LIMIT + 3 }, (_, i) => finding(`s${i}`, 'r1', 'SUGGESTION'));
    const m = findingsSummaries(new Map([['pr1', ['r1']]]), [
      ...many,
      finding('w', 'r1', 'WARNING', 0.99),
      finding('c-low', 'r1', 'CRITICAL', 0.5, 'x'.repeat(RATIONALE_MAX * 2)),
      finding('c-high', 'r1', 'CRITICAL', 0.95),
    ]);
    const s = m.get('pr1')!;
    expect(s.total).toBe(PREVIEW_LIMIT + 6);
    expect(s.preview).toHaveLength(PREVIEW_LIMIT);
    expect(s.preview.slice(0, 3).map((f) => f.id)).toEqual(['c-high', 'c-low', 'w']);
    expect(s.preview[1]!.rationale.length).toBeLessThanOrEqual(RATIONALE_MAX);
    expect(s.preview[1]!.rationale.endsWith('…')).toBe(true);
  });
});
