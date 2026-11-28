import { describe, it, expect, afterEach, vi, beforeEach } from "vitest";
import React from "react";
import { render, screen, cleanup, fireEvent } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import type { ConventionCandidate } from "@devdigest/shared";
import conventions from "../../../../../../../messages/en/conventions.json";
import skills from "../../../../../../../messages/en/skills.json";
import { ToastProvider } from "@/lib/toast";

const extractMutate = vi.fn();
const updateMutate = vi.fn();
let data: ConventionCandidate[] | undefined;

vi.mock("next/navigation", () => ({
  useParams: () => ({ repoId: "r1" }),
  useRouter: () => ({ push: vi.fn() }),
}));
vi.mock("@/components/app-shell", () => ({
  AppShell: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));
vi.mock("@/lib/repo-context", () => ({
  useActiveRepo: () => ({ activeRepo: { id: "r1", name: "payments-api", full_name: "acme/payments-api" } }),
  useRepoNotFound: () => false,
}));
vi.mock("@/lib/hooks/conventions", () => ({
  useConventions: () => ({ data, isLoading: false, isError: false, refetch: vi.fn() }),
  useExtractConventions: () => ({ mutate: extractMutate, isPending: false, error: null }),
  useUpdateConvention: () => ({ mutate: updateMutate, isPending: false, variables: undefined }),
  useCreateConventionSkill: () => ({ mutateAsync: vi.fn(), isPending: false, error: null }),
}));

import { ConventionsView } from "./ConventionsView";

function cand(id: string, status: ConventionCandidate["status"]): ConventionCandidate {
  return { id, rule: `Rule ${id}`, evidence_path: `src/${id}.ts`, evidence_snippet: `s${id}`, confidence: 0.8, accepted: status === "accepted", status };
}

beforeEach(() => {
  data = [];
});
afterEach(() => {
  cleanup();
  extractMutate.mockReset();
  updateMutate.mockReset();
});

function renderView() {
  render(
    <NextIntlClientProvider locale="en" messages={{ conventions, skills }}>
      <ToastProvider>
        <ConventionsView />
      </ToastProvider>
    </NextIntlClientProvider>,
  );
}

describe("ConventionsView", () => {
  it("empty state → Run extraction triggers the scan", () => {
    renderView();
    expect(screen.getByText("No conventions extracted yet")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Run extraction/ }));
    expect(extractMutate).toHaveBeenCalled();
  });

  it("lists candidates, counts accepted, and Re-scan re-runs extraction", () => {
    data = [cand("a", "accepted"), cand("b", "pending"), cand("c", "rejected")];
    renderView();
    expect(screen.getByText("Rule a")).toBeInTheDocument();
    expect(screen.getByText("1 of 3 accepted")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Re-scan/ }));
    expect(extractMutate).toHaveBeenCalled();
  });

  it("accepting a card sends a status patch for that candidate", () => {
    data = [cand("b", "pending")];
    renderView();
    fireEvent.click(screen.getByRole("button", { name: "Accept" }));
    expect(updateMutate).toHaveBeenCalledWith({ id: "b", patch: { status: "accepted" } });
  });

  it("Create skill is disabled until something is accepted, then opens the modal", () => {
    data = [cand("b", "pending")];
    renderView();
    expect(screen.getByRole("button", { name: "Create skill" })).toBeDisabled();
    cleanup();
    data = [cand("a", "accepted")];
    renderView();
    fireEvent.click(screen.getByRole("button", { name: "Create skill" }));
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(screen.getByText("Create skill from conventions")).toBeInTheDocument();
  });
});
