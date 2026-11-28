import type { Skill, UpdateSkillInput } from "@devdigest/shared";

export interface SkillDraft {
  name: string;
  description: string;
  type: Skill["type"];
  body: string;
  enabled: boolean;
  changeNote: string;
}

export function draftFrom(skill: Skill): SkillDraft {
  return {
    name: skill.name,
    description: skill.description,
    type: skill.type,
    body: skill.body,
    enabled: skill.enabled,
    changeNote: "",
  };
}

/** Only the fields that changed; the note travels only with a body change. */
export function buildPatch(skill: Skill, d: SkillDraft): UpdateSkillInput {
  const patch: UpdateSkillInput = {};
  if (d.name.trim() !== skill.name) patch.name = d.name.trim();
  if (d.description.trim() !== skill.description) patch.description = d.description.trim();
  if (d.type !== skill.type) patch.type = d.type;
  if (d.enabled !== skill.enabled) patch.enabled = d.enabled;
  if (d.body !== skill.body) {
    patch.body = d.body;
    if (d.changeNote.trim()) patch.change_note = d.changeNote.trim();
  }
  return patch;
}

/** Re-exported from the shared helper (also used by the Conventions modal). */
export { approxTokens } from "@/lib/tokens";
