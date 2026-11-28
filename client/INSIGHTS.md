# INSIGHTS — client

Non-obvious learnings for this module, maintained by the `engineering-insights` skill.
Read before non-trivial changes. **Append-only**: correct an entry with a dated
`CORRECTION:` bullet below it; don't edit or delete. Promote an entry to `AGENTS.md`
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
- 2026-11-27 · `Donut` (`@devdigest/ui`) formats legend values as money (`$` + 2 decimals) by default — pass `formatValue` for counts; that default is why mockups showed "$52.00" findings — evidence: client/src/vendor/ui/charts/Donut.tsx

## Tool & Library Notes

## Recurring Errors & Fixes
- 2026-11-27 · Home shows "No repositories yet" while `curl :3001/repos` returns data → the browser bundle has a stale `NEXT_PUBLIC_API_BASE` baked in (it is inlined at compile time): a second `next dev` in client/ (scripts/e2e.sh, :3101) shared `.next` and recompiled chunks the :3000 server then served. Fix: stop client, `rm -rf client/.next`, restart. Prevented by `NEXT_DIST_DIR` (e2e uses `.next-e2e`); HomeView now shows an ErrorState with the real URL instead of the empty state — evidence: client/next.config.mjs (distDir), client/src/app/_components/HomeView/HomeView.tsx
- 2026-11-27 · NEVER value-import (`import { X }`) from `@devdigest/shared` in the client — only `import type` — because the vendored barrel re-exports `./contracts/*.js` specifiers that Next/webpack cannot resolve: the page dies with "Module not found: Can't resolve './contracts/findings.js'" while `tsc` and vitest both pass. Mirror the enum values locally instead — evidence: client/src/components/skill-badges/constants.ts (SKILL_TYPES)

## Session Notes

## Open Questions
