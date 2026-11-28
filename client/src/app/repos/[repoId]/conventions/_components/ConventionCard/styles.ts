import type { CSSProperties } from "react";

export const s = {
  card: {
    display: "flex",
    gap: 16,
    padding: 16,
    background: "var(--bg-surface)",
    border: "1px solid var(--border)",
    borderLeft: "3px solid var(--border-strong)",
    borderRadius: 10,
  },
  accepted: { borderLeftColor: "var(--ok)" },
  rejected: { opacity: 0.55 },
  main: { flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 10 },
  ruleRow: { display: "flex", alignItems: "flex-start", gap: 8 },
  rule: { fontSize: 14, fontWeight: 600, fontStyle: "italic", margin: 0, flex: 1 },
  editActions: { display: "flex", gap: 8, marginTop: 6 },
  evidence: { border: "1px solid var(--border)", borderRadius: 8, overflow: "hidden" },
  evidencePath: {
    fontSize: 12,
    color: "var(--text-secondary)",
    padding: "6px 10px",
    borderBottom: "1px solid var(--border)",
    background: "var(--bg-elevated)",
  },
  snippet: {
    margin: 0,
    padding: "10px 12px",
    fontSize: 12,
    background: "var(--code-bg)",
    overflowX: "auto",
    whiteSpace: "pre",
  },
  confRow: { display: "flex", alignItems: "center", gap: 10, fontSize: 12, color: "var(--text-muted)" },
  confBar: { width: 90 },
  actions: { display: "flex", flexDirection: "column", gap: 8, width: 130, flexShrink: 0 },
} satisfies Record<string, CSSProperties>;
