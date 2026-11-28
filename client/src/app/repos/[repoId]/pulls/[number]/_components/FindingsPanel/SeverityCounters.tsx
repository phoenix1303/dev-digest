/* SeverityCounters — "3 CRITICAL · 5 WARNING · 2 SUGGESTION" row above a run's
   finding cards. Each counter toggles a single-severity filter. */
"use client";

import React from "react";
import { useTranslations } from "next-intl";
import { Icon, SEV } from "@devdigest/ui";
import type { Severity } from "@devdigest/shared";
import { SEVERITY_LEVELS } from "./constants";
import { s } from "./styles";

export function SeverityCounters({
  counts,
  active,
  onToggle,
}: {
  counts: Record<Severity, number>;
  active: Severity | null;
  onToggle: (level: Severity) => void;
}) {
  const t = useTranslations("prReview");
  return (
    <div role="group" aria-label={t("panel.severityFilter")} style={s.sevGroup}>
      {SEVERITY_LEVELS.map((level, i) => {
        const sev = SEV[level];
        const I = Icon[sev.icon];
        const isActive = active === level;
        const count = counts[level];
        return (
          <React.Fragment key={level}>
            {i > 0 && <span aria-hidden style={s.sevSep}>·</span>}
            <button
              type="button"
              aria-pressed={isActive}
              disabled={count === 0 && !isActive}
              onClick={() => onToggle(level)}
              style={s.sevButton(isActive, count === 0, sev.c, sev.bg)}
            >
              <I size={12.5} />
              <span className="tnum">{count}</span>
              {t(`panel.severity.${level}`)}
            </button>
          </React.Fragment>
        );
      })}
    </div>
  );
}
