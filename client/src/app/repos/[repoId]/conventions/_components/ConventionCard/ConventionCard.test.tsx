import { describe, it, expect, afterEach, vi } from "vitest";
import { render, screen, cleanup, fireEvent } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import type { ConventionCandidate } from "@devdigest/shared";
import messages from "../../../../../../../messages/en/conventions.json";
import { ConventionCard } from "./ConventionCard";

const BASE: ConventionCandidate = {
  id: "c1",
  rule: "Always use async/await instead of .then() chains",
  evidence_path: "src/api/users.ts",
  evidence_snippet: "const user = await db.users.find(id);",
  confidence: 0.91,
  accepted: false,
  status: "pending",
};

afterEach(cleanup);

function renderCard(candidate: Partial<ConventionCandidate> = {}) {
  const onStatus = vi.fn();
  const onRule = vi.fn();
  render(
    <NextIntlClientProvider locale="en" messages={{ conventions: messages }}>
      <ConventionCard candidate={{ ...BASE, ...candidate }} onStatus={onStatus} onRule={onRule} />
    </NextIntlClientProvider>,
  );
  return { onStatus, onRule };
}

describe("ConventionCard", () => {
  it("shows the rule, its evidence and confidence", () => {
    renderCard();
    expect(screen.getByText(BASE.rule)).toBeInTheDocument();
    expect(screen.getByText("src/api/users.ts")).toBeInTheDocument();
    expect(screen.getByText(BASE.evidence_snippet)).toBeInTheDocument();
    expect(screen.getByText("91%")).toBeInTheDocument();
  });

  it("accepts and rejects a pending candidate", () => {
    const { onStatus } = renderCard();
    fireEvent.click(screen.getByRole("button", { name: "Accept" }));
    expect(onStatus).toHaveBeenLastCalledWith("accepted");
    fireEvent.click(screen.getByRole("button", { name: "Reject" }));
    expect(onStatus).toHaveBeenLastCalledWith("rejected");
  });

  it("clicking Accepted again moves it back to pending; rejected cards are marked", () => {
    const { onStatus } = renderCard({ status: "accepted", accepted: true });
    fireEvent.click(screen.getByRole("button", { name: "Accepted" }));
    expect(onStatus).toHaveBeenLastCalledWith("pending");
    cleanup();
    renderCard({ status: "rejected" });
    expect(screen.getByTestId("convention-c1")).toHaveAttribute("data-status", "rejected");
    expect(screen.getByRole("button", { name: "Rejected" })).toBeInTheDocument();
  });

  it("edits the rule inline (Save sends the new text, Cancel discards)", () => {
    const { onRule } = renderCard();
    fireEvent.click(screen.getByRole("button", { name: "Edit rule" }));
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "Prefer async/await" } });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    expect(onRule).toHaveBeenCalledWith("Prefer async/await");

    fireEvent.click(screen.getByRole("button", { name: "Edit rule" }));
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "discard me" } });
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(onRule).toHaveBeenCalledTimes(1);
    expect(screen.getByText(BASE.rule)).toBeInTheDocument();
  });
});
