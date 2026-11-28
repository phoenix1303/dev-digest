import { describe, it, expect, afterEach, vi } from "vitest";
import { render, screen, cleanup, fireEvent } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import messages from "../../../../../messages/en/skills.json";

const mutateAsync = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));
vi.mock("@/lib/hooks/skills", () => ({
  useCreateSkill: () => ({ mutateAsync, isPending: false, error: null }),
}));

import { CreateSkillModal } from "./CreateSkillModal";

afterEach(() => {
  cleanup();
  mutateAsync.mockReset();
});

function renderModal() {
  render(
    <NextIntlClientProvider locale="en" messages={{ skills: messages }}>
      <CreateSkillModal onClose={() => {}} />
    </NextIntlClientProvider>,
  );
}

const textareas = () => screen.getAllByRole("textbox").filter((el) => el.tagName === "TEXTAREA");

describe("CreateSkillModal", () => {
  it("splits a pasted SKILL.md into name, description and body", () => {
    mutateAsync.mockResolvedValue({ id: "s1" });
    renderModal();
    const [desc] = textareas();
    fireEvent.change(desc!, {
      target: { value: "---\nname: breaking-change\ndescription: Flag broken contracts.\ntype: security\n---\n# Body" },
    });
    expect(screen.getByLabelText("Name")).toHaveValue("breaking-change");
    const [d, b] = textareas();
    expect(d).toHaveValue("Flag broken contracts.");
    expect(b).toHaveValue("# Body");
    expect(screen.getByRole("status")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Create skill" }));
    expect(mutateAsync).toHaveBeenCalledWith({
      name: "breaking-change",
      description: "Flag broken contracts.",
      type: "security",
      body: "# Body",
    });
  });

  it("blocks submit when the description is over 500 characters", () => {
    renderModal();
    fireEvent.change(screen.getByLabelText("Name"), { target: { value: "x" } });
    fireEvent.change(textareas()[0]!, { target: { value: "a".repeat(501) } });
    expect(screen.getByText("501 / 500")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Create skill" })).toBeDisabled();
  });
});
