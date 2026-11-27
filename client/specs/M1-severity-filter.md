# M1 · Severity counters + filter on a review run (client)

## Goal
Show, at a glance, how a review run's findings split by severity, and let the reviewer narrow the run's list to one level.

## User-visible behaviour
- PR page → **Agent runs** → expand a run in **Review runs**. Above the finding cards, on the left of the toolbar
  (Hide low confidence stays on the right), a row reads `3 CRITICAL · 5 WARNING · 2 SUGGESTION`.
- Colour and icon per level come from `SEV` (`@devdigest/ui`). A level with 0 findings is shown but disabled.
- Click a level → that run's list shows only that level (`aria-pressed=true`). Click it again → full list.
  Clicking another level switches directly.
- Counts are taken after **Hide low confidence** and before the severity filter, so each number equals the cards shown for that level.
- State is per run (each `FindingsPanel` owns it). The run header's `blockers` count is unchanged.

## Contract & data changes
None. Counted client-side from `ReviewRecord.findings` (`usePrReviews`). No route, table, or LLM call.
Strings: `prReview.panel.severityFilter`, `prReview.panel.severity.*`.

## Out of scope
PR list Findings column/hover, Timeline icons, FindingCard, multi-select, persisting the filter in the URL.

## Acceptance
- [x] Counters for the three levels, matching the list — `FindingsPanel.test.tsx`
- [x] Click filters to one level; second click clears — `FindingsPanel.test.tsx`
- [x] Counts follow Hide low confidence — `FindingsPanel.test.tsx`, `helpers.test.ts`
- [ ] PR in the fork with description + demo video
