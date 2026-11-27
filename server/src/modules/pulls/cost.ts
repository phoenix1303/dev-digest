/**
 * M1 — PR-list COST column: the TOTAL cost of every review run on the PR.
 *
 * Every agent_run on the PR counts: re-runs, older rounds, and runs whose agent
 * was later deleted (the money was still spent). Each new run adds to the total.
 * A run with no known cost (failed, cancelled, still running, unpriced model)
 * contributes nothing. If no run on the PR has a known cost, the PR's cost is
 * null (UI shows "—", never "$0.00"). Runs deleted from the timeline are gone
 * from agent_runs and so leave the total.
 */
export interface RunCostRow {
  prId: string | null;
  costUsd: number | null;
}

/** Sum `cost_usd` over all runs per PR. Row order does not matter. */
export function totalRunCost(rows: readonly RunCostRow[]): Map<string, number | null> {
  const totals = new Map<string, number | null>();
  for (const r of rows) {
    if (!r.prId) continue;
    const prev = totals.get(r.prId) ?? null;
    if (r.costUsd == null) {
      if (!totals.has(r.prId)) totals.set(r.prId, null);
      continue;
    }
    totals.set(r.prId, (prev ?? 0) + r.costUsd);
  }
  return totals;
}
