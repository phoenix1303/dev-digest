import type { Severity, SeverityCounts } from "@devdigest/shared";

/** Levels in display order (most severe first). */
export const PREVIEW_LEVELS: readonly Severity[] = ["CRITICAL", "WARNING", "SUGGESTION"];

/** Hover card width (px) and the gap between trigger and card. */
export const CARD_WIDTH = 400;
export const CARD_GAP = 6;
/** Delay before closing, so the pointer can travel from trigger to card. */
export const CLOSE_DELAY_MS = 120;

export function countBySeverity(findings: readonly { severity: string }[]): SeverityCounts {
  const counts: SeverityCounts = { CRITICAL: 0, WARNING: 0, SUGGESTION: 0 };
  for (const f of findings) if (f.severity in counts) counts[f.severity as Severity] += 1;
  return counts;
}

export function lineRange(f: { start_line: number; end_line: number }): string {
  return f.end_line > f.start_line ? `${f.start_line}-${f.end_line}` : String(f.start_line);
}

/** Left edge for a fixed card under `rect`, clamped to the viewport. */
export function cardLeft(rect: { left: number }, viewportWidth: number): number {
  return Math.max(8, Math.min(rect.left, viewportWidth - CARD_WIDTH - 8));
}
