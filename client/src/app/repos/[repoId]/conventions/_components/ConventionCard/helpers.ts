import { CONFIDENCE_HIGH, CONFIDENCE_MID } from "../../constants";

/** Bar colour for a 0..1 confidence: ok ≥ 0.85, warn ≥ 0.65, muted below. */
export function confidenceColor(confidence: number): string {
  if (confidence >= CONFIDENCE_HIGH) return "var(--ok)";
  if (confidence >= CONFIDENCE_MID) return "var(--warn)";
  return "var(--text-muted)";
}

export function confidencePercent(confidence: number): number {
  return Math.round(Math.min(1, Math.max(0, confidence)) * 100);
}
