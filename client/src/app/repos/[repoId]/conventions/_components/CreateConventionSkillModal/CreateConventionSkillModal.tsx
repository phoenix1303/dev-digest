/* CreateConventionSkillModal — merges the ACCEPTED candidates into one draft
   skill (name, description, body), lets the user edit everything, then saves it
   via POST /repos/:id/conventions/skill (type convention, source extracted). */
"use client";

import React from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Button, FormField, Icon, Modal, SelectInput, Textarea, TextInput, Toggle } from "@devdigest/ui";
import type { ConventionCandidate } from "@devdigest/shared";
import { useCreateConventionSkill } from "@/lib/hooks/conventions";
import { useToast } from "@/lib/toast";
import { ApiError } from "@/lib/api";
import { approxTokens } from "@/lib/tokens";
import { buildSkillDraft, onlyAccepted } from "./helpers";
import { s } from "./styles";

export interface CreateConventionSkillModalProps {
  repoId: string;
  repoName: string;
  candidates: ConventionCandidate[];
  onClose: () => void;
}

export function CreateConventionSkillModal({ repoId, repoName, candidates, onClose }: CreateConventionSkillModalProps) {
  const t = useTranslations("conventions");
  const tSkills = useTranslations("skills");
  const router = useRouter();
  const toast = useToast();
  const create = useCreateConventionSkill(repoId);

  const accepted = onlyAccepted(candidates);
  const initial = React.useMemo(() => buildSkillDraft(repoName, candidates), [repoName, candidates]);
  const [name, setName] = React.useState(initial.name);
  const [description, setDescription] = React.useState(() =>
    t("modal.descriptionTemplate", { count: accepted.length, repo: repoName }),
  );
  const [body, setBody] = React.useState(initial.body);
  const [enabled, setEnabled] = React.useState(true);

  const canSubmit =
    accepted.length > 0 && !!name.trim() && !!description.trim() && !!body.trim() && !create.isPending;

  const submit = async () => {
    const skill = await create.mutateAsync({
      name: name.trim(),
      description: description.trim(),
      body,
      enabled,
    });
    toast.success(t("modal.created", { name: skill.name }));
    onClose();
    router.push(`/skills/${skill.id}`);
  };

  return (
    <Modal
      width={640}
      title={t("modal.title")}
      subtitle={<span className="mono">{name || "—"}</span>}
      onClose={onClose}
      footer={
        <div style={s.footer}>
          <Button kind="ghost" onClick={onClose}>
            {t("modal.cancel")}
          </Button>
          <Button kind="primary" icon="Sparkles" onClick={submit} disabled={!canSubmit} loading={create.isPending}>
            {create.isPending ? t("modal.creating") : t("modal.create")}
          </Button>
        </div>
      }
    >
      <div style={s.body}>
        <div style={s.banner}>
          <Icon.Info size={14} />
          <span>{t("modal.merged", { count: accepted.length, repo: repoName })}</span>
        </div>
        <FormField label={t("modal.name")} hint={t("modal.nameHint")} required>
          <TextInput value={name} onChange={setName} mono aria-label={t("modal.name")} />
        </FormField>
        <FormField label={t("modal.description")} required>
          <TextInput value={description} onChange={setDescription} aria-label={t("modal.description")} />
        </FormField>
        <div style={s.row}>
          <FormField label={t("modal.type")}>
            <SelectInput value="convention" onChange={() => {}} options={[{ value: "convention", label: tSkills("type.convention") }]} />
          </FormField>
          <FormField label={t("modal.enabled")}>
            <div style={s.toggleRow}>
              <Toggle on={enabled} onChange={setEnabled} />
              <span style={s.hint}>{t("modal.enabledHint")}</span>
            </div>
          </FormField>
        </div>
        <FormField
          label={t("modal.body")}
          required
          right={<span className="tnum" style={s.tokens}>{t("modal.tokens", { count: approxTokens(body) })}</span>}
        >
          <Textarea value={body} onChange={setBody} rows={14} mono />
        </FormField>
        {create.error instanceof ApiError && (
          <div role="alert" style={s.error}>
            {create.error.message}
          </div>
        )}
      </div>
    </Modal>
  );
}
