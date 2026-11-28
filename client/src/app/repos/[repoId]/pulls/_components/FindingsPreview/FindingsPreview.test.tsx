import { describe, it, expect, afterEach, vi } from "vitest";
import { render, screen, cleanup, fireEvent, act } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import type { FindingPreview } from "@devdigest/shared";
import messages from "../../../../../../../messages/en/prReview.json";
import { FindingsPreview } from "./FindingsPreview";
import { cardLeft, countBySeverity, lineRange, CARD_WIDTH } from "./helpers";

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

const f = (id: string, severity: FindingPreview["severity"], o: Partial<FindingPreview> = {}): FindingPreview => ({
  id,
  severity,
  category: "security",
  title: `Title ${id}`,
  file: "src/config.ts",
  start_line: 12,
  end_line: 12,
  rationale: `Because ${id}`,
  confidence: 0.98,
  ...o,
});

const FINDINGS = [f("a", "CRITICAL"), f("b", "CRITICAL", { start_line: 61, end_line: 74 }), f("c", "WARNING")];

function renderPreview(props: Partial<React.ComponentProps<typeof FindingsPreview>> = {}) {
  return render(
    <NextIntlClientProvider locale="en" messages={{ prReview: messages }}>
      <FindingsPreview
        counts={countBySeverity(FINDINGS)}
        findings={FINDINGS}
        total={FINDINGS.length}
        heading="3 findings"
        {...props}
      />
    </NextIntlClientProvider>,
  );
}

const trigger = () => screen.getByLabelText(/2 critical, 1 warning, 0 suggestion/);

describe("FindingsPreview", () => {
  it("shows an icon + count only for levels that have findings", () => {
    const { container } = renderPreview();
    const levels = [...container.querySelectorAll("[data-severity]")].map((n) => [n.getAttribute("data-severity"), n.textContent]);
    expect(levels).toEqual([["CRITICAL", "2"], ["WARNING", "1"]]);
    expect(screen.queryByRole("tooltip")).not.toBeInTheDocument();
  });

  it("opens the card on hover with title, file:line, confidence, rationale; closes on leave", () => {
    vi.useFakeTimers();
    renderPreview();
    fireEvent.mouseEnter(trigger());
    const card = screen.getByRole("tooltip");
    expect(card).toHaveTextContent("3 findings");
    expect(card).toHaveTextContent("Title a");
    expect(card).toHaveTextContent("src/config.ts:61-74");
    expect(card).toHaveTextContent("98% conf");
    expect(card).toHaveTextContent("Because c");

    fireEvent.mouseLeave(trigger());
    act(() => vi.advanceTimersByTime(500));
    expect(screen.queryByRole("tooltip")).not.toBeInTheDocument();
  });

  it("stays open while the pointer moves onto the card", () => {
    vi.useFakeTimers();
    renderPreview();
    fireEvent.mouseEnter(trigger());
    fireEvent.mouseLeave(trigger());
    fireEvent.mouseEnter(screen.getByRole("tooltip"));
    act(() => vi.advanceTimersByTime(500));
    expect(screen.getByRole("tooltip")).toBeInTheDocument();
  });

  it("opens on keyboard focus and says how many are not shown", () => {
    renderPreview({ total: 7 });
    fireEvent.focus(trigger());
    expect(screen.getByRole("tooltip")).toHaveTextContent("+4 more on the PR page");
  });

  it("calls onSelect when a finding is clicked", () => {
    const onSelect = vi.fn();
    renderPreview({ onSelect });
    fireEvent.mouseEnter(trigger());
    fireEvent.click(screen.getByText("Title c"));
    expect(onSelect).toHaveBeenCalledWith(expect.objectContaining({ id: "c" }));
  });

  it("renders nothing without findings", () => {
    const { container } = renderPreview({ findings: [], total: 0, counts: countBySeverity([]) });
    expect(container).toBeEmptyDOMElement();
  });
});

describe("FindingsPreview helpers", () => {
  it("lineRange collapses single lines", () => {
    expect(lineRange({ start_line: 5, end_line: 5 })).toBe("5");
    expect(lineRange({ start_line: 5, end_line: 9 })).toBe("5-9");
  });
  it("cardLeft keeps the card inside the viewport", () => {
    expect(cardLeft({ left: 100 }, 1600)).toBe(100);
    expect(cardLeft({ left: 1500 }, 1600)).toBe(1600 - CARD_WIDTH - 8);
    expect(cardLeft({ left: -20 }, 1600)).toBe(8);
  });
});
