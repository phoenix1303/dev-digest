# M2 · Conventions Extractor (client)

Server side: `server/specs/M2-conventions.md`.

## Goal
A per-repo Conventions page (Skills Lab → Conventions) for running extraction,
reviewing the candidates, and merging the accepted ones into one skill.

## User-visible behaviour
- Route `/repos/:repoId/conventions`. The sidebar item is under SKILLS LAB
  (`nav.ts`). An unknown repo shows `RepoNotFound`.
- **Empty state:** "No conventions extracted yet" with a **Run extraction**
  button. While it runs, the button shows "Scanning…".
- **With candidates:**
  - A header with **Re-scan**.
  - The line "N candidates · grounded against sampled files".
  - A toolbar with "X of N accepted" and **Create skill**, which is disabled
    while nothing is accepted.
- **Card:**
  - The rule, editable in place via the pencil, with Save and Cancel.
  - The evidence path and a verbatim snippet.
  - A confidence bar: green ≥ 85%, amber ≥ 65%, muted below.
  - **Accept** and **Reject** toggles. Clicking the active one returns the card
    to pending. Rejected cards are dimmed.
- **Modal** "Create skill from conventions":
  - Built from ACCEPTED candidates only:
    - name `<repo>-conventions`
    - description "N house conventions extracted from <repo>"
    - a markdown body with one `##` section per rule and its evidence
  - Name, description and body are all editable. A live `~N tokens` count and an
    Enabled toggle are shown. Type is fixed to `convention`.
  - **Create skill** shows a toast, then opens `/skills/:id`. **Cancel** saves nothing.

## Contract & data changes
- Hooks (`src/lib/hooks/conventions.ts`): `useConventions`, `useExtractConventions`,
  `useUpdateConvention`, `useCreateConventionSkill`. The query key is
  `queryKeys.conventions(repoId)`.
- `approxTokens` moved to `src/lib/tokens.ts`, shared with the skill ConfigTab.
- Strings: `messages/en/conventions.json` (`page.*`, `card.*`, `modal.*`).

## Out of scope
- Bulk accept/reject, and updating an existing skill from a new scan.

## Acceptance
- [x] Card shows evidence and confidence; accept, reject and inline edit → `ConventionCard.test.tsx`
- [x] Empty state → Run extraction; Re-scan; Create skill disabled until accepted, opens the modal → `ConventionsView.test.tsx`
- [x] Draft only from accepted; valid slug → `CreateConventionSkillModal/helpers.test.ts`
- [x] Modal prefill, edit + save, Cancel → `CreateConventionSkillModal.test.tsx`
- [x] Sidebar → Conventions empty state → `e2e/specs/09-conventions.flow.json`
