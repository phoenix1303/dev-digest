import { describe, it, expect, afterEach, vi } from "vitest";
import { render, screen, cleanup, fireEvent } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import type { FindingRecord } from "@devdigest/shared";
import messages from "../../../../../../../../messages/en/prReview.json";

vi.mock("@/lib/hooks/reviews", () => ({
  useFindingAction: () => ({ mutate: vi.fn(), isPending: false }),
}));

import { FindingsPanel } from "./FindingsPanel";

afterEach(cleanup);

const FINDINGS: FindingRecord[] = [
  {
    id: "f1",
    severity: "CRITICAL",
    category: "security",
    title: "Hardcoded secret",
    file: "src/config.ts",
    start_line: 11,
    end_line: 11,
    rationale: "A secret is committed.",
    suggestion: null,
    confidence: 0.95,
    kind: "finding",
    trifecta_components: null,
    evidence: null,
    review_id: "r1",
    accepted_at: null,
    dismissed_at: null,
  },
];

function renderWithIntl(ui: React.ReactElement) {
  return render(
    <NextIntlClientProvider locale="en" messages={{ prReview: messages }}>
      {ui}
    </NextIntlClientProvider>,
  );
}

describe("FindingsPanel (smoke)", () => {
  it("renders the toolbar + a finding card", () => {
    renderWithIntl(<FindingsPanel findings={FINDINGS} prId="pr1" />);
    expect(screen.getByText("Hide low confidence")).toBeInTheDocument();
    expect(screen.getByText("Hardcoded secret")).toBeInTheDocument();
  });

  it("shows the empty state when nothing matches", () => {
    renderWithIntl(<FindingsPanel findings={[]} prId="pr1" />);
    expect(screen.getByText("No findings match")).toBeInTheDocument();
  });
});

function finding(id: string, severity: FindingRecord["severity"], confidence = 0.9): FindingRecord {
  return { ...FINDINGS[0]!, id, severity, confidence, title: `${severity} ${id}` };
}

const MIXED: FindingRecord[] = [
  finding("c1", "CRITICAL"),
  finding("w1", "WARNING"),
  finding("c2", "CRITICAL"),
  finding("s1", "SUGGESTION"),
  finding("w2", "WARNING", 0.5),
  finding("c3", "CRITICAL"),
];

const counter = (label: string) => screen.getByRole("button", { name: new RegExp(label) });
const titles = () => screen.getAllByText(/^(CRITICAL|WARNING|SUGGESTION) [a-z]\d$/).map((n) => n.textContent);

describe("FindingsPanel severity counters", () => {
  it("shows a count per severity matching the list", () => {
    renderWithIntl(<FindingsPanel findings={MIXED} prId="pr1" />);
    expect(counter("CRITICAL")).toHaveTextContent("3CRITICAL");
    expect(counter("WARNING")).toHaveTextContent("2WARNING");
    expect(counter("SUGGESTION")).toHaveTextContent("1SUGGESTION");
    expect(titles()).toHaveLength(6);
  });

  it("filters to one level on click and clears on a second click", () => {
    renderWithIntl(<FindingsPanel findings={MIXED} prId="pr1" />);
    fireEvent.click(counter("CRITICAL"));
    expect(counter("CRITICAL")).toHaveAttribute("aria-pressed", "true");
    expect(titles()).toEqual(["CRITICAL c1", "CRITICAL c2", "CRITICAL c3"]);

    fireEvent.click(counter("CRITICAL"));
    expect(counter("CRITICAL")).toHaveAttribute("aria-pressed", "false");
    expect(titles()).toHaveLength(6);
  });

  it("switches directly between levels", () => {
    renderWithIntl(<FindingsPanel findings={MIXED} prId="pr1" />);
    fireEvent.click(counter("CRITICAL"));
    fireEvent.click(counter("SUGGESTION"));
    expect(titles()).toEqual(["SUGGESTION s1"]);
  });

  it("counts follow the hide-low-confidence toggle", () => {
    renderWithIntl(<FindingsPanel findings={MIXED} prId="pr1" />);
    fireEvent.click(screen.getByRole("switch"));
    expect(counter("WARNING")).toHaveTextContent("1WARNING");
    fireEvent.click(counter("WARNING"));
    expect(titles()).toEqual(["WARNING w1"]);
  });

  it("disables a level with no findings", () => {
    renderWithIntl(<FindingsPanel findings={FINDINGS} prId="pr1" />);
    expect(counter("WARNING")).toBeDisabled();
    expect(counter("CRITICAL")).toBeEnabled();
  });
});
