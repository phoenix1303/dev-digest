# INSIGHTS — client

Non-obvious learnings for this module, maintained by the `engineering-insights` skill.
Read before non-trivial changes. **Append-only**: correct an entry with a dated
`CORRECTION:` bullet below it; don't edit or delete. Promote an entry to `CLAUDE.md`
only if an agent is likely to hit it on most tasks. Prune in a periodic human review
when the file passes ~200 entries.

<!-- Entry: - YYYY-MM-DD · <ALWAYS/NEVER/do X> because <why> — evidence: path/to/file.ts (symbol) -->

## What Works

## What Doesn't Work
- 2026-11-26 · do NOT expect to eyeball run-related UI (Agent-runs timeline, run trace drawer, cost badge/column) on a freshly seeded dev DB because the seed inserts no `agent_runs`/`run_traces` rows — rely on component tests, or trigger a real review on a PR (needs an LLM key) to see live data — evidence: server/src/db/seed.ts (no agentRuns inserts)

## Codebase Patterns
- 2026-11-27 · do NOT trust homework/mock text saying a UI element "already exists" because the mocks show the full reference app, while this starter only gains features milestone by milestone (the PR-list Findings column and the Timeline severity icons were both missing) — grep the code before you treat something as out of scope — evidence: client/src/app/repos/[repoId]/pulls/_components/PRRow/PRRow.tsx
- 2026-11-27 · ALWAYS portal hover cards inside the PR list/timeline (`createPortal` + `position: fixed`) because the table card and accordions clip absolutely-positioned children; a click inside a portal still bubbles through the React tree, so the PR row's `onClick` navigation fires from the card — evidence: client/src/app/repos/[repoId]/pulls/_components/FindingsPreview/FindingsPreview.tsx
- 2026-11-26 · ALWAYS treat `RunTrace.stats.cost_usd` as possibly absent (render "—", never "$0.00") because the contract is `nullish`: run traces persisted before M1 have no `cost_usd` key — evidence: client/src/vendor/shared/contracts/trace.ts (RunStats), client/src/lib/format-cost.ts (formatUsd)
- 2026-11-26 · `client/src/vendor/shared` is a separate copy of `@devdigest/shared` and has already drifted from `server/src/vendor/shared` — when client types disagree with what the API returns, or a contract changes, update both copies and diff them.

## Tool & Library Notes

## Recurring Errors & Fixes

## Session Notes

## Open Questions
