/* lib/tokens.ts — shared text helpers for live counters. */

/** Rough token estimate for the live counter (server uses tiktoken for the real one). */
export function approxTokens(text: string): number {
  return Math.ceil(text.length / 4);
}
