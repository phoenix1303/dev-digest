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

### Also, per the mocks
- **PR list → Findings column** (between Score and Status): `⊙3 ⚠2 💡1`, i.e. icon + count for each non-zero level of the PR's
  *latest review round* (newest review of each agent, the same rule as the Cost column). `—` until reviewed.
  Hover/focus opens a card "6 FINDINGS". It lists the most severe 8 (title, category, file:line, confidence,
  2-line rationale) plus "+N more on the PR page". Clicking the card opens the PR.
- **PR page → Timeline**: a settled run shows the same icons in place of "N finding(s)", and hover shows
  "N FINDINGS IN THIS RUN". Clicking an item jumps to that run's accordion. Shared component:
  `pulls/_components/FindingsPreview`.

## Contract & data changes
- Counters + filter: none. Counted client-side from `ReviewRecord.findings` (`usePrReviews`).
- Timeline: none. The run_id → findings map is built from the same reviews in `FindingsTab`.
- PR list: `PrMeta.findings: FindingsSummary.nullish()` (`{ total, counts, preview[] }`, new in
  `contracts/findings.ts`, both vendored copies). Computed on read in `GET /repos/:id/pulls`
  (`server/src/modules/pulls/findings-summary.ts`, one extra IN-query). No table, migration, or LLM call.
- Strings: `prReview.panel.severityFilter`, `prReview.panel.severity.*`, `prReview.list.columns.findings`, `prReview.findingsPreview.*`.

## Out of scope
FindingCard, multi-select, persisting the filter in the URL.

## Acceptance
- [x] Counters for the three levels, matching the list — `FindingsPanel.test.tsx`
- [x] Click filters to one level; second click clears — `FindingsPanel.test.tsx`
- [x] Counts follow Hide low confidence — `FindingsPanel.test.tsx`, `helpers.test.ts`
- [x] PR-list Findings column + hover card — `FindingsPreview.test.tsx`, `server/test/pulls-findings.test.ts`
- [x] Timeline icons + hover, click jumps to the run — `RunHistory.test.tsx`
- [ ] PR in the fork with description + demo video
