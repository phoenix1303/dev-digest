import { describe, it, expect, afterEach, vi } from "vitest";
import { render, screen, cleanup, fireEvent, waitFor } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import type { ConventionCandidate } from "@devdigest/shared";
import conventions from "../../../../../../../messages/en/conventions.json";
import skills from "../../../../../../../messages/en/skills.json";
import { ToastProvider } from "@/lib/toast";

const mutateAsync = vi.fn();
const push = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));
vi.mock("@/lib/hooks/conventions", () => ({
  useCreateConventionSkill: () => ({ mutateAsync, isPending: false, error: null }),
}));

import { CreateConventionSkillModal } from "./CreateConventionSkillModal";

const CANDIDATES: ConventionCandidate[] = [
  { id: "a", rule: "Always use async/await", evidence_path: "src/a.ts", evidence_snippet: "await x()", confidence: 0.9, accepted: true, status: "accepted" },
  { id: "b", rule: "Rejected rule", evidence_path: "src/b.ts", evidence_snippet: "b()", confidence: 0.7, accepted: false, status: "rejected" },
];

afterEach(() => {
  cleanup();
  mutateAsync.mockReset();
  push.mockReset();
});

function renderModal(onClose = vi.fn()) {
  render(
    <NextIntlClientProvider locale="en" messages={{ conventions, skills }}>
      <ToastProvider>
        <CreateConventionSkillModal repoId="r1" repoName="acme/payments-api" candidates={CANDIDATES} onClose={onClose} />
      </ToastProvider>
    </NextIntlClientProvider>,
  );
  return { onClose };
}

describe("CreateConventionSkillModal", () => {
  it("prefills name, description and a body built from accepted conventions only", () => {
    renderModal();
    expect(screen.getByLabelText("Name")).toHaveValue("payments-api-conventions");
    expect(screen.getByLabelText("Description")).toHaveValue("1 house convention extracted from acme/payments-api");
    const body = screen.getAllByRole("textbox").at(-1) as HTMLTextAreaElement;
    expect(body.value).toContain("## Always use async/await");
    expect(body.value).not.toContain("Rejected rule");
    expect(screen.getByText(/Merged from 1 accepted convention/)).toBeInTheDocument();
  });

  it("saves the edited name/description/body and opens the new skill", async () => {
    mutateAsync.mockResolvedValue({ id: "s1", name: "my-rules" });
    const { onClose } = renderModal();
    fireEvent.change(screen.getByLabelText("Name"), { target: { value: "my-rules" } });
    fireEvent.change(screen.getByLabelText("Description"), { target: { value: "Edited" } });
    const body = screen.getAllByRole("textbox").at(-1)!;
    fireEvent.change(body, { target: { value: "# my-rules\n\nCustom body" } });
    fireEvent.click(screen.getByRole("button", { name: "Create skill" }));
    await waitFor(() => expect(push).toHaveBeenCalledWith("/skills/s1"));
    expect(mutateAsync).toHaveBeenCalledWith({
      name: "my-rules",
      description: "Edited",
      body: "# my-rules\n\nCustom body",
      enabled: true,
    });
    expect(onClose).toHaveBeenCalled();
  });

  it("Cancel closes without saving", () => {
    const { onClose } = renderModal();
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(onClose).toHaveBeenCalled();
    expect(mutateAsync).not.toHaveBeenCalled();
  });
});
