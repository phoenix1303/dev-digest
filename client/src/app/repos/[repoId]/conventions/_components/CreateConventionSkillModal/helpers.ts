import type { ConventionCandidate } from "@devdigest/shared";

/* Pure draft builder for the "Create skill from conventions" modal. */

const NAME_MAX = 80;

/** A SkillName-safe slug: lowercase [a-z0-9._-], starts alphanumeric, ≤ 80 chars. */
export function toSkillSlug(text: string): string {
  const slug = text
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, "-")
    .replace(/-{2,}/g, "-")
    .replace(/^[^a-z0-9]+/, "")
    .replace(/-+$/, "");
  return slug.slice(0, NAME_MAX) || "repo-conventions";
}

export function onlyAccepted(candidates: ConventionCandidate[]): ConventionCandidate[] {
  return candidates.filter((c) => c.status === "accepted");
}

/** Markdown body: title, how to apply, then one section per ACCEPTED rule with its evidence. */
export function buildSkillBody(name: string, repoName: string, candidates: ConventionCandidate[]): string {
  const sections = onlyAccepted(candidates).map((c) =>
    [
      `## ${c.rule}`,
      "",
      `Detected in \`${c.evidence_path}\`:`,
      "",
      "```",
      c.evidence_snippet,
      "```",
    ].join("\n"),
  );
  return [
    `# ${name}`,
    "",
    `House conventions for \`${repoName}\`. Flag changes that violate any rule below and cite the offending \`file:line\`.`,
    "",
    sections.join("\n\n"),
    "",
  ].join("\n");
}

export interface ConventionSkillDraft {
  name: string;
  body: string;
}

/** Default name `<repo>-conventions` + body built from accepted candidates only. */
export function buildSkillDraft(repoName: string, candidates: ConventionCandidate[]): ConventionSkillDraft {
  const short = repoName.split("/").pop() ?? repoName;
  const name = toSkillSlug(`${short}-conventions`);
  return { name, body: buildSkillBody(name, repoName, candidates) };
}
