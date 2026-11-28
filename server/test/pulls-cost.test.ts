/**
 * M1 — PR-list COST column (`modules/pulls/cost.ts`): total cost =
 * sum of every review run on the PR (re-runs included).
 */
import { describe, it, expect } from 'vitest';
import { totalRunCost, type RunCostRow } from '../src/modules/pulls/cost.js';

const row = (prId: string | null, costUsd: number | null): RunCostRow => ({ prId, costUsd });

describe('totalRunCost', () => {
  it('sums every run on the PR, re-runs of the same agent included', () => {
    const m = totalRunCost([
      row('pr1', 0.0013), // Security, latest
      row('pr1', 0.0014), // Performance, latest
      row('pr1', 0.0012), // Performance, older re-run
      row('pr1', 0.5), // Security, older re-run
    ]);
    expect(m.get('pr1')).toBeCloseTo(0.5039);
  });

  it('a new run adds to the existing total', () => {
    const before = totalRunCost([row('pr1', 0.002)]).get('pr1')!;
    const after = totalRunCost([row('pr1', 0.003), row('pr1', 0.002)]).get('pr1')!;
    expect(after - before).toBeCloseTo(0.003);
  });

  it('runs without cost (failed/unpriced) contribute nothing', () => {
    const m = totalRunCost([row('pr1', null), row('pr1', 0.002), row('pr1', 0.9)]);
    expect(m.get('pr1')).toBeCloseTo(0.902);
  });

  it('is null when no run on the PR has a known cost', () => {
    const m = totalRunCost([row('pr1', null), row('pr1', null)]);
    expect(m.has('pr1')).toBe(true);
    expect(m.get('pr1')).toBeNull();
  });

  it('keeps PRs separate and skips runs with no PR', () => {
    const m = totalRunCost([row('pr1', 0.01), row('pr2', 0.02), row('pr1', 0.03), row(null, 5)]);
    expect(m.get('pr1')).toBeCloseTo(0.04);
    expect(m.get('pr2')).toBeCloseTo(0.02);
  });

  it('returns an empty map for no runs (PR shows "—")', () => {
    expect(totalRunCost([]).size).toBe(0);
  });
});
