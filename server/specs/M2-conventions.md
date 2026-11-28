# M2 · Conventions Extractor (server)

Client side: `client/specs/M2-conventions.md`.

## Goal
Suggest a repo's house rules from its own code. The extractor proposes candidate
conventions, each backed by a verbatim snippet from a real file. The user accepts
or rejects them and merges the accepted ones into one skill
(`type='convention'`, `source='extracted'`) that agents can link.

## User-visible behaviour
- **Extract** (`POST /repos/:id/conventions/extract`):
  - The input is collected in code, with no model: config files (`tsconfig.json`,
    eslint, prettier, biome, `.editorconfig`, whichever exist) plus the top 12 files
    from `repoIntel.getConventionSamples()`. Each file is capped at 8k chars.
  - No ranked source files (repo not indexed) → 422.
  - ONE structured call (`schemaName: 'ConventionExtraction'`) with the
    `conventions` feature model (Settings → Feature models).
  - Every file goes in `wrapUntrusted('file:<path>')`, and the system prompt
    carries the injection guard.
  - **Evidence check.** A candidate is kept only if both hold:
    - its `evidence_path` is one of the files sent;
    - its `evidence_snippet` occurs in that file (whitespace-normalised).

    Everything else is dropped before the DB write.
  - Rules are deduped, case- and whitespace-insensitive, including against
    already-accepted rules. Confidence is clamped to 0..1. At most 15 per scan.
- **Re-scan:**
  - Accepted candidates survive, with any text edits.
  - Pending and rejected candidates are replaced, in one transaction.
- **Review** (`PATCH /conventions/:id`): set `status` (`pending | accepted |
  rejected`) and/or edit `rule`.
- **Skill** (`POST /repos/:id/conventions/skill`): saves the user-edited draft
  (name, description, body, enabled).
  - Needs at least one accepted candidate, otherwise 422.
  - `evidence_files` is set to the accepted candidates' paths only.
  - A taken name → 409.
  - The skill then links to agents through the existing `PUT /agents/:id/skills`
    and reaches the system prompt as `### Skill: <name>`.

## API
| Method | Path | |
|---|---|---|
| POST | `/repos/:id/conventions/extract` | `ExtractConventionsResult` `{candidates, sampled_files}` |
| GET | `/repos/:id/conventions` | `ConventionCandidate[]` |
| PATCH | `/conventions/:id` | `UpdateConventionInput` → `ConventionCandidate` |
| POST | `/repos/:id/conventions/skill` | `CreateConventionSkillInput` → `Skill` (201) |

## Contract & data changes
- `conventions` table:
  - `accepted boolean` is replaced by `status text` (default `pending`).
  - Adds `created_at`.
  - Migrations: `0013` adds the columns, `0014` drops `accepted`. It was split in two
    so drizzle-kit doesn't stop on its rename prompt.
- Contracts (both copies):
  - `ConventionStatus`.
  - `ConventionCandidate.status`, with `accepted` kept as a derived field.
  - `ExtractConventionsResult`, `UpdateConventionInput`, `CreateConventionSkillInput`.
- Skills:
  - `NewSkill.evidenceFiles`.
  - `SkillsService.createExtracted`.
  - New barrels `skills/index.ts`, `repos/index.ts`, `settings/index.ts`, so
    conventions imports other modules only through their public API.

## Out of scope
- The two-step file-selection dialogue (`ConventionFileSelection`).
- Background jobs / polling: extraction runs synchronously in one request.
- Updating an existing skill from a new scan.

## Acceptance
- [x] Prompt wraps files, evidence check, dedupe → `test/conventions-helpers.test.ts`
- [x] One call; hallucinated/unsent evidence dropped; re-scan keeps accepted; empty repo 422; skill only from accepted → `test/conventions-service.test.ts`
- [x] HTTP: extract → list → accept/reject/edit → skill (convention/extracted, evidence of accepted only) → link to agent → review prompt carries the skill → `test/conventions.it.test.ts`
