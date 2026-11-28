/* FindingsPreview — per-severity icon counts ("⊙2 ⚠1 💡3") with a hover card
   listing the findings. Used by the PR list Findings column and the PR
   timeline. The card is portalled + fixed so table/accordion overflow can't
   clip it; React portals still bubble events, so a click in the card reaches
   the host row (e.g. the PR row navigates to the PR). */
"use client";

import React from "react";
import { createPortal } from "react-dom";
import { useTranslations } from "next-intl";
import { Icon, SEV, CategoryTag, ConfidenceNum, type Category } from "@devdigest/ui";
import type { FindingPreview, SeverityCounts } from "@devdigest/shared";
import { CARD_GAP, CLOSE_DELAY_MS, PREVIEW_LEVELS, cardLeft, lineRange } from "./helpers";
import { s } from "./styles";

export function SeverityIcons({ counts }: { counts: SeverityCounts }) {
  return (
    <>
      {PREVIEW_LEVELS.filter((l) => counts[l] > 0).map((l) => {
        const I = Icon[SEV[l].icon];
        return (
          <span key={l} style={s.count(SEV[l].c)} data-severity={l}>
            <I size={13} />
            <span className="tnum">{counts[l]}</span>
          </span>
        );
      })}
    </>
  );
}

export function FindingsHoverCard({
  heading,
  findings,
  total,
  onSelect,
  style,
  onMouseEnter,
  onMouseLeave,
}: {
  heading: string;
  findings: readonly FindingPreview[];
  total: number;
  onSelect?: (f: FindingPreview) => void;
  style?: React.CSSProperties;
  onMouseEnter?: () => void;
  onMouseLeave?: () => void;
}) {
  const t = useTranslations("prReview");
  const more = total - findings.length;
  return (
    <div role="tooltip" style={style} onMouseEnter={onMouseEnter} onMouseLeave={onMouseLeave}>
      <div style={s.heading}>
        <Icon.Info size={12} />
        {heading}
      </div>
      {findings.map((f) => {
        const sev = SEV[f.severity];
        const I = Icon[sev.icon];
        return (
          <div
            key={f.id}
            style={s.item(!!onSelect)}
            onClick={onSelect ? () => onSelect(f) : undefined}
          >
            <span style={s.sevIcon(sev.c, sev.bg)} aria-label={sev.label}>
              <I size={13} />
            </span>
            <div style={s.itemMain}>
              <div style={s.titleRow}>
                <span style={s.title}>{f.title}</span>
                <CategoryTag category={f.category as Category} />
              </div>
              <div style={s.metaRow}>
                <span className="mono" style={s.file}>
                  {f.file}:{lineRange(f)}
                </span>
                <ConfidenceNum value={f.confidence} />
              </div>
              <div style={s.rationale}>{f.rationale}</div>
            </div>
          </div>
        );
      })}
      {more > 0 && <div style={s.more}>{t("findingsPreview.more", { count: more })}</div>}
    </div>
  );
}

/** Icons + hover/focus card. Renders nothing when there are no findings. */
export function FindingsPreview({
  counts,
  findings,
  total,
  heading,
  onSelect,
}: {
  counts: SeverityCounts;
  findings: readonly FindingPreview[];
  total: number;
  heading: string;
  onSelect?: (f: FindingPreview) => void;
}) {
  const t = useTranslations("prReview");
  const ref = React.useRef<HTMLSpanElement | null>(null);
  const timer = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const [pos, setPos] = React.useState<{ top: number; left: number } | null>(null);

  const cancelClose = () => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
  };
  const open = () => {
    cancelClose();
    const r = ref.current?.getBoundingClientRect();
    if (r) setPos({ top: r.bottom + CARD_GAP, left: cardLeft(r, window.innerWidth) });
  };
  const close = () => {
    cancelClose();
    timer.current = setTimeout(() => setPos(null), CLOSE_DELAY_MS);
  };

  // A fixed card would drift from its trigger on scroll — just close it.
  React.useEffect(() => {
    if (!pos) return;
    const onScroll = () => setPos(null);
    window.addEventListener("scroll", onScroll, true);
    return () => window.removeEventListener("scroll", onScroll, true);
  }, [pos]);
  React.useEffect(() => cancelClose, []);

  if (total === 0) return null;

  return (
    <>
      <span
        ref={ref}
        tabIndex={0}
        aria-label={t("findingsPreview.label", {
          critical: counts.CRITICAL,
          warning: counts.WARNING,
          suggestion: counts.SUGGESTION,
        })}
        onMouseEnter={open}
        onMouseLeave={close}
        onFocus={open}
        onBlur={close}
        style={s.trigger}
      >
        <SeverityIcons counts={counts} />
      </span>
      {pos &&
        createPortal(
          <FindingsHoverCard
            heading={heading}
            findings={findings}
            total={total}
            onSelect={onSelect}
            style={s.card(pos.top, pos.left)}
            onMouseEnter={cancelClose}
            onMouseLeave={close}
          />,
          document.body,
        )}
    </>
  );
}
