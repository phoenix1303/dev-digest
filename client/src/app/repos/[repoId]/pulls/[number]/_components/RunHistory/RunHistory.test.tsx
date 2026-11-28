/**
 * RunHistory — the badge must reflect the review OUTCOME, not the run lifecycle.
 * Regression guard for the "green ✓ done on a run that found 5 blockers" bug:
 * a settled run is colored/labelled by its denormalized blocker/finding counts,
 * and shows the review score ring.
 */
import { describe, it, expect, afterEach, vi } from "vitest";
import { render, screen, cleanup, fireEvent } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import type { RunSummary, FindingPreview } from "@devdigest/shared";
import messages from "../../../../../../../../messages/en/prReview.json";
import { RunHistory } from "./RunHistory";

afterEach(cleanup);

function run(o: Partial<RunSummary>): RunSummary {
  return {
    run_id: "run-1",
    agent_id: "a1",
    agent_name: "Security Reviewer",
    provider: "openrouter",
    model: "deepseek/deepseek-v4-flash",
    status: "done",
    error: null,
    duration_ms: 1000,
    tokens_in: 100,
    tokens_out: 50,
    cost_usd: null,
    findings_count: 0,
    grounding: "0/0 passed",
    ran_at: "2026-06-11T18:44:34.000Z",
    score: null,
    blockers: null,
    ...o,
  };
}

function renderRuns(runs: RunSummary[]) {
  return render(
    <NextIntlClientProvider locale="en" messages={{ prReview: messages }}>
      <RunHistory runs={runs} onOpenTrace={() => {}} />
    </NextIntlClientProvider>,
  );
}

describe("RunHistory — outcome badge", () => {
  it("a done run WITH blockers reads 'rejected' (never green 'done') + shows the score ring", () => {
    renderRuns([run({ status: "done", findings_count: 5, blockers: 5, score: 0 })]);
    expect(screen.getByText("rejected")).toBeInTheDocument();
    expect(screen.queryByText("done")).not.toBeInTheDocument();
    expect(screen.getByText("0")).toBeInTheDocument(); // CircularScore renders the number
    expect(screen.getByText(/5 blockers/)).toBeInTheDocument();
  });

  it("a clean done run reads 'approved'", () => {
    renderRuns([run({ status: "done", findings_count: 0, blockers: 0, score: 95 })]);
    expect(screen.getByText("approved")).toBeInTheDocument();
    expect(screen.getByText("95")).toBeInTheDocument();
  });

  it("a done run with non-blocking findings reads 'reviewed'", () => {
    renderRuns([run({ status: "done", findings_count: 3, blockers: 0, score: 72 })]);
    expect(screen.getByText("reviewed")).toBeInTheDocument();
    expect(screen.queryByText(/blockers/)).not.toBeInTheDocument();
  });

  it("a failed run reads 'error'", () => {
    renderRuns([run({ status: "failed", error: "boom", score: null, blockers: null })]);
    expect(screen.getByText("error")).toBeInTheDocument();
  });

  it("a running run reads 'running'", () => {
    renderRuns([run({ status: "running", score: null, blockers: null })]);
    expect(screen.getByText("running")).toBeInTheDocument();
  });
});

describe("RunHistory — cost badge (M1)", () => {
  it("a done run shows total tokens and cost next to the time", () => {
    renderRuns([run({ status: "done", tokens_in: 8201, tokens_out: 918, cost_usd: 0.0013 })]);
    expect(screen.getByText("9,119 tok · $0.0013")).toBeInTheDocument();
  });

  it("a done run without a known cost shows tokens and '—'", () => {
    renderRuns([run({ status: "done", tokens_in: 8201, tokens_out: 918, cost_usd: null })]);
    expect(screen.getByText("9,119 tok · —")).toBeInTheDocument();
  });

  it("a failed run shows no cost badge", () => {
    renderRuns([run({ status: "failed", error: "429 quota", tokens_in: 0, tokens_out: 0, cost_usd: null })]);
    expect(screen.queryByText(/tok/)).not.toBeInTheDocument();
    expect(screen.queryByText(/\$/)).not.toBeInTheDocument();
  });
});

const pf = (id: string, severity: FindingPreview["severity"]): FindingPreview => ({
  id,
  severity,
  category: "perf",
  title: `Finding ${id}`,
  file: "src/users.ts",
  start_line: 45,
  end_line: 52,
  rationale: "N+1 query",
  confidence: 0.86,
});

describe("RunHistory — findings preview", () => {
  const findingsByRun = new Map([["run-1", [pf("w", "WARNING"), pf("s", "SUGGESTION")]]]);

  it("a settled run with known findings shows severity icons and a hover card; clicking an item jumps to the run", () => {
    const onGoToReview = vi.fn();
    const { container } = render(
      <NextIntlClientProvider locale="en" messages={{ prReview: messages }}>
        <RunHistory
          runs={[run({ status: "done", findings_count: 2, blockers: 0 })]}
          onOpenTrace={() => {}}
          onGoToReview={onGoToReview}
          findingsByRun={findingsByRun}
        />
      </NextIntlClientProvider>,
    );
    expect([...container.querySelectorAll("[data-severity]")].map((n) => n.getAttribute("data-severity"))).toEqual([
      "WARNING",
      "SUGGESTION",
    ]);
    expect(screen.queryByText(/2 finding\(s\)/)).not.toBeInTheDocument();

    fireEvent.mouseEnter(screen.getByLabelText(/0 critical, 1 warning, 1 suggestion/));
    expect(screen.getByRole("tooltip")).toHaveTextContent("2 findings in this run");
    fireEvent.click(screen.getByText("Finding w"));
    expect(onGoToReview).toHaveBeenCalledWith("run-1");
  });

  it("falls back to the plain count when the run's findings are not loaded", () => {
    renderRuns([run({ status: "done", findings_count: 2, blockers: 0 })]);
    expect(screen.getByText(/2 finding\(s\)/)).toBeInTheDocument();
  });
});
