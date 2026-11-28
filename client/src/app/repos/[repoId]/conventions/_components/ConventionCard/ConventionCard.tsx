/* ConventionCard — one extracted candidate: rule (inline-editable), evidence
   (file + verbatim snippet), confidence, Accept / Reject toggles. Presentational:
   the view owns the mutations and passes callbacks. */
"use client";

import React from "react";
import { useTranslations } from "next-intl";
import { Button, IconBtn, ProgressBar, Textarea } from "@devdigest/ui";
import type { ConventionCandidate, ConventionStatus } from "@devdigest/shared";
import { CONVENTION_STATUS } from "../../constants";
import { confidenceColor, confidencePercent } from "./helpers";
import { s } from "./styles";

export interface ConventionCardProps {
  candidate: ConventionCandidate;
  pending?: boolean;
  onStatus: (status: ConventionStatus) => void;
  onRule: (rule: string) => void;
}

export function ConventionCard({ candidate: c, pending, onStatus, onRule }: ConventionCardProps) {
  const t = useTranslations("conventions");
  const [editing, setEditing] = React.useState(false);
  const [draft, setDraft] = React.useState(c.rule);
  const isAccepted = c.status === CONVENTION_STATUS.accepted;
  const isRejected = c.status === CONVENTION_STATUS.rejected;
  const pct = confidencePercent(c.confidence);

  const startEdit = () => {
    setDraft(c.rule);
    setEditing(true);
  };
  const save = () => {
    const next = draft.trim();
    if (next && next !== c.rule) onRule(next);
    setEditing(false);
  };

  return (
    <article
      data-testid={`convention-${c.id}`}
      data-status={c.status}
      style={{ ...s.card, ...(isAccepted ? s.accepted : {}), ...(isRejected ? s.rejected : {}) }}
    >
      <div style={s.main}>
        {editing ? (
          <div>
            <Textarea value={draft} onChange={setDraft} rows={2} />
            <div style={s.editActions}>
              <Button kind="primary" size="sm" onClick={save} disabled={!draft.trim() || pending}>
                {t("card.save")}
              </Button>
              <Button kind="ghost" size="sm" onClick={() => setEditing(false)}>
                {t("card.cancel")}
              </Button>
            </div>
          </div>
        ) : (
          <div style={s.ruleRow}>
            <p style={s.rule}>{c.rule}</p>
            <IconBtn icon="Edit" label={t("card.edit")} onClick={startEdit} />
          </div>
        )}

        <div style={s.evidence} aria-label={t("card.evidence")}>
          <div className="mono" style={s.evidencePath}>
            {c.evidence_path}
          </div>
          <pre className="mono" style={s.snippet}>
            {c.evidence_snippet}
          </pre>
        </div>

        <div style={s.confRow}>
          <span>{t("card.confidence")}</span>
          <div style={s.confBar}>
            <ProgressBar value={pct} color={confidenceColor(c.confidence)} height={5} />
          </div>
          <span className="tnum">{pct}%</span>
        </div>
      </div>

      <div style={s.actions}>
        <Button
          kind={isAccepted ? "primary" : "secondary"}
          size="sm"
          icon="Check"
          full
          active={isAccepted}
          disabled={pending}
          onClick={() => onStatus(isAccepted ? CONVENTION_STATUS.pending : CONVENTION_STATUS.accepted)}
        >
          {isAccepted ? t("card.accepted") : t("card.accept")}
        </Button>
        <Button
          kind="ghost"
          size="sm"
          icon="X"
          full
          active={isRejected}
          disabled={pending}
          onClick={() => onStatus(isRejected ? CONVENTION_STATUS.pending : CONVENTION_STATUS.rejected)}
        >
          {isRejected ? t("card.rejected") : t("card.reject")}
        </Button>
      </div>
    </article>
  );
}
