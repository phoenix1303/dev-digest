import { describe, it, expect } from "vitest";
import type { ConventionCandidate } from "@devdigest/shared";
import { buildSkillDraft, toSkillSlug } from "./helpers";

function c(id: string, rule: string, status: ConventionCandidate["status"]): ConventionCandidate {
  return {
    id,
    rule,
    evidence_path: `src/${id}.ts`,
    evidence_snippet: `snippet ${id}`,
    confidence: 0.9,
    accepted: status === "accepted",
    status,
  };
}

describe("buildSkillDraft", () => {
  const list = [
    c("a", "Always use async/await", "accepted"),
    c("b", "Return Result<T, ApiError>", "rejected"),
    c("c", "Use the redis singleton", "pending"),
    c("d", "Name files in kebab-case", "accepted"),
  ];

  it("names the skill <repo>-conventions", () => {
    expect(buildSkillDraft("acme/payments-api", list).name).toBe("payments-api-conventions");
  });

  it("includes ONLY accepted rules with their evidence; rejected and pending are left out", () => {
    const { body } = buildSkillDraft("acme/payments-api", list);
    expect(body).toContain("# payments-api-conventions");
    expect(body).toContain("## Always use async/await");
    expect(body).toContain("Detected in `src/a.ts`:");
    expect(body).toContain("snippet a");
    expect(body).toContain("## Name files in kebab-case");
    expect(body).not.toContain("Return Result<T, ApiError>");
    expect(body).not.toContain("Use the redis singleton");
  });
});

describe("toSkillSlug", () => {
  it("produces a valid SkillName", () => {
    expect(toSkillSlug("--My Repo!!-conventions")).toBe("my-repo-conventions");
    expect(toSkillSlug("***")).toBe("repo-conventions");
    expect(toSkillSlug("x".repeat(200))).toHaveLength(80);
  });
});
