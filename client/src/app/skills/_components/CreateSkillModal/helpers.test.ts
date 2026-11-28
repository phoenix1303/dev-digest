import { describe, it, expect } from "vitest";
import { formatValidationDetails, parsePastedSkill } from "./helpers";

const SKILL_MD = `---
name: breaking-change
description: >
  Flag any change that removes a public contract
  so that an existing caller breaks.
type: rubric
---
# Breaking change

## Flag
- Removed export.`;

describe("parsePastedSkill", () => {
  it("splits a pasted SKILL.md into fields", () => {
    expect(parsePastedSkill(SKILL_MD)).toEqual({
      name: "breaking-change",
      description: "Flag any change that removes a public contract so that an existing caller breaks.",
      type: "rubric",
      body: "# Breaking change\n\n## Flag\n- Removed export.",
    });
  });

  it("returns null for plain text", () => {
    expect(parsePastedSkill("Flag every untested branch.")).toBeNull();
  });

  it("ignores an unknown type", () => {
    expect(parsePastedSkill("---\nname: x\ntype: weird\n---\nbody")?.type).toBeUndefined();
  });
});

describe("formatValidationDetails", () => {
  it("formats zod issues as field: message", () => {
    expect(
      formatValidationDetails([{ path: ["description"], message: "String must contain at most 500 character(s)" }]),
    ).toEqual(["description: String must contain at most 500 character(s)"]);
  });

  it("handles fastify-style instancePath and junk", () => {
    expect(formatValidationDetails([{ instancePath: "/body/name", message: "bad" }, null, 3])).toEqual([
      "body.name: bad",
    ]);
    expect(formatValidationDetails("nope")).toEqual([]);
  });
});
