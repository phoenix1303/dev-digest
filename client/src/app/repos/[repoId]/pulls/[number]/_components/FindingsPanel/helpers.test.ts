import { describe, it, expect } from "vitest";
import type { FindingRecord } from "@devdigest/shared";
import { severityCounts, visibleFindings } from "./helpers";

const f = (id: string, severity: FindingRecord["severity"], confidence = 0.9) =>
  ({ id, severity, confidence }) as FindingRecord;

const LIST = [f("s1", "SUGGESTION"), f("c1", "CRITICAL"), f("w1", "WARNING", 0.3), f("w2", "WARNING")];

describe("visibleFindings", () => {
  it("sorts by severity with no filter", () => {
    expect(visibleFindings(LIST, false).map((x) => x.id)).toEqual(["c1", "w1", "w2", "s1"]);
  });
  it("keeps only the selected severity", () => {
    expect(visibleFindings(LIST, false, "WARNING").map((x) => x.id)).toEqual(["w1", "w2"]);
  });
  it("combines severity with hide-low-confidence", () => {
    expect(visibleFindings(LIST, true, "WARNING").map((x) => x.id)).toEqual(["w2"]);
  });
});

describe("severityCounts", () => {
  it("counts every level, zero included", () => {
    expect(severityCounts(LIST, false)).toEqual({ CRITICAL: 1, WARNING: 2, SUGGESTION: 1 });
    expect(severityCounts([], false)).toEqual({ CRITICAL: 0, WARNING: 0, SUGGESTION: 0 });
  });
  it("applies the low-confidence rule", () => {
    expect(severityCounts(LIST, true)).toEqual({ CRITICAL: 1, WARNING: 1, SUGGESTION: 1 });
  });
});
