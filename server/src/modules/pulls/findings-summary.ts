import type { FindingPreview, FindingsSummary, Severity } from '@devdigest/shared';

/**
 * M1 — PR-list FINDINGS column: findings of the PR's *latest review round*.
 *
 * Same "round" rule as the cost column (cost.ts): the newest review of EACH
 * agent on the PR; older re-runs of an agent are ignored. Reviews without an
 * agent (legacy / deleted agent) form one group of their own, newest wins.
 */
export interface ReviewRoundRow {
  id: string;
  prId: string;
  agentId: string | null;
}

export interface FindingRow {
  id: string;
  reviewId: string;
  severity: string;
  category: string;
  title: string;
  file: string;
  startLine: number;
  endLine: number;
  rationale: string;
  confidence: number;
}

/** Max findings carried in the hover preview per PR. */
export const PREVIEW_LIMIT = 8;
/** Max rationale length in the preview (full text lives on the PR page). */
export const RATIONALE_MAX = 220;

const SEVERITY_RANK: Record<string, number> = { CRITICAL: 0, WARNING: 1, SUGGESTION: 2 };

/** @param reviews kind='review' rows ordered NEWEST FIRST (created_at desc). */
export function latestRoundReviewIds(reviews: readonly ReviewRoundRow[]): Map<string, string[]> {
  const seen = new Set<string>();
  const byPr = new Map<string, string[]>();
  for (const r of reviews) {
    const key = `${r.prId}:${r.agentId ?? '-'}`;
    if (seen.has(key)) continue;
    seen.add(key);
    byPr.set(r.prId, [...(byPr.get(r.prId) ?? []), r.id]);
  }
  return byPr;
}

function truncate(text: string, max: number): string {
  return text.length <= max ? text : `${text.slice(0, max - 1).trimEnd()}…`;
}

/** Build each PR's summary from its latest-round review ids and their findings. */
export function findingsSummaries(
  roundByPr: ReadonlyMap<string, readonly string[]>,
  findings: readonly FindingRow[],
): Map<string, FindingsSummary> {
  const byReview = new Map<string, FindingRow[]>();
  for (const f of findings) byReview.set(f.reviewId, [...(byReview.get(f.reviewId) ?? []), f]);

  const out = new Map<string, FindingsSummary>();
  for (const [prId, reviewIds] of roundByPr) {
    const rows = reviewIds.flatMap((id) => byReview.get(id) ?? []);
    const counts = { CRITICAL: 0, WARNING: 0, SUGGESTION: 0 };
    for (const f of rows) if (f.severity in counts) counts[f.severity as Severity] += 1;
    const preview: FindingPreview[] = [...rows]
      .sort(
        (a, b) =>
          (SEVERITY_RANK[a.severity] ?? 9) - (SEVERITY_RANK[b.severity] ?? 9) ||
          b.confidence - a.confidence,
      )
      .slice(0, PREVIEW_LIMIT)
      .map((f) => ({
        id: f.id,
        severity: f.severity as FindingPreview['severity'],
        category: f.category as FindingPreview['category'],
        title: f.title,
        file: f.file,
        start_line: f.startLine,
        end_line: f.endLine,
        rationale: truncate(f.rationale, RATIONALE_MAX),
        confidence: f.confidence,
      }));
    out.set(prId, { total: rows.length, counts, preview });
  }
  return out;
}
