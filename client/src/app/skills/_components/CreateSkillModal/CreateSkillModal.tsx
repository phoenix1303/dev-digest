/* CreateSkillModal — "Add Skill → Create new": name, type, description and an
   optional body. Pasting a whole SKILL.md (frontmatter + markdown) into the
   description or body splits it into the right fields. */
"use client";

import React from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Button, FormField, Icon, Modal, SelectInput, Textarea, TextInput } from "@devdigest/ui";
import type { SkillType } from "@devdigest/shared";
import { SKILL_TYPES } from "@/components/skill-badges";
import { useCreateSkill } from "@/lib/hooks/skills";
import { ApiError } from "@/lib/api";
import { approxTokens } from "@/lib/tokens";
import { DESCRIPTION_MAX, formatValidationDetails, parsePastedSkill } from "./helpers";
import { s } from "./styles";

export function CreateSkillModal({ onClose }: { onClose: () => void }) {
  const t = useTranslations("skills");
  const router = useRouter();
  const create = useCreateSkill();
  const [name, setName] = React.useState("");
  const [description, setDescription] = React.useState("");
  const [type, setType] = React.useState<SkillType>("rubric");
  const [body, setBody] = React.useState("");
  const [splitFromPaste, setSplitFromPaste] = React.useState(false);

  /** If a whole SKILL.md landed in a field, distribute it; otherwise set as-is. */
  const fillOrSet = (value: string, set: (v: string) => void) => {
    const parsed = parsePastedSkill(value);
    if (!parsed) return set(value);
    if (parsed.name) setName(parsed.name);
    if (parsed.type) setType(parsed.type);
    setDescription(parsed.description ?? "");
    setBody(parsed.body);
    setSplitFromPaste(true);
  };

  const descLength = description.trim().length;
  const descTooLong = descLength > DESCRIPTION_MAX;
  const canSubmit = name.trim().length > 0 && descLength > 0 && !descTooLong && !create.isPending;

  const submit = async () => {
    let skill;
    try {
      skill = await create.mutateAsync({ name: name.trim(), description: description.trim(), type, body });
    } catch {
      return; // shown from `create.error` below
    }
    onClose();
    router.push(`/skills/${skill.id}?tab=${body.trim() ? "preview" : "config"}`);
  };

  const apiError = create.error instanceof ApiError ? create.error : null;
  const issues = apiError ? formatValidationDetails(apiError.details) : [];

  return (
    <Modal
      width={640}
      title={t("create.title")}
      subtitle={t("create.subtitle")}
      onClose={onClose}
      footer={
        <div style={s.footer}>
          <Button kind="ghost" onClick={onClose}>
            {t("create.cancel")}
          </Button>
          <Button kind="primary" icon="Plus" onClick={submit} disabled={!canSubmit} loading={create.isPending}>
            {create.isPending ? t("create.creating") : t("create.create")}
          </Button>
        </div>
      }
    >
      <div style={s.body}>
        {splitFromPaste && (
          <div role="status" style={s.banner}>
            <Icon.Info size={14} style={{ flexShrink: 0, marginTop: 2 }} />
            <span>{t("create.pastedSplit")}</span>
          </div>
        )}
        {apiError && (
          <div role="alert" style={s.error}>
            {apiError.message}
            {issues.length > 0 && (
              <ul style={s.errorList}>
                {issues.map((i) => (
                  <li key={i}>{i}</li>
                ))}
              </ul>
            )}
          </div>
        )}
        <div style={s.row}>
          <FormField label={t("config.name")} hint={t("config.nameHint")} required>
            <TextInput
              value={name}
              onChange={setName}
              placeholder={t("create.namePlaceholder")}
              mono
              aria-label={t("config.name")}
            />
          </FormField>
          <FormField label={t("config.type")}>
            <SelectInput
              value={type}
              onChange={(v) => setType(v as SkillType)}
              options={SKILL_TYPES.map((v) => ({ value: v, label: t(`type.${v}`) }))}
            />
          </FormField>
        </div>
        <FormField
          label={t("config.description")}
          hint={descTooLong ? t("create.descriptionTooLong", { max: DESCRIPTION_MAX }) : t("config.descriptionHint")}
          required
          right={
            <span className="tnum" style={descTooLong ? s.counterOver : s.counter}>
              {descLength} / {DESCRIPTION_MAX}
            </span>
          }
        >
          <Textarea
            value={description}
            onChange={(v) => fillOrSet(v, setDescription)}
            placeholder={t("create.descriptionPlaceholder")}
            rows={3}
          />
        </FormField>
        <FormField
          label={t("create.body")}
          hint={t("create.bodyHint")}
          right={<span className="tnum" style={s.counter}>{t("config.tokens", { count: approxTokens(body) })}</span>}
        >
          <Textarea
            value={body}
            onChange={(v) => fillOrSet(v, setBody)}
            placeholder={t("create.bodyPlaceholder")}
            rows={8}
            mono
          />
        </FormField>
      </div>
    </Modal>
  );
}
