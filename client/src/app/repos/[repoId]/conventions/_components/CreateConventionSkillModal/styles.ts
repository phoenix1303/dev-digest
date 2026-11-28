import type { CSSProperties } from "react";

export const s = {
  body: { display: "flex", flexDirection: "column", gap: 4, padding: "18px 24px" },
  banner: {
    display: "flex",
    gap: 8,
    alignItems: "flex-start",
    padding: "10px 12px",
    marginBottom: 12,
    borderRadius: 8,
    fontSize: 13,
    background: "var(--info-bg)",
    color: "var(--text-secondary)",
  },
  row: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, alignItems: "start" },
  toggleRow: { display: "flex", alignItems: "center", gap: 10, minHeight: 36 },
  hint: { fontSize: 12, color: "var(--text-muted)" },
  tokens: { fontSize: 12, color: "var(--text-muted)" },
  error: { fontSize: 13, color: "var(--crit)" },
  footer: { display: "flex", justifyContent: "flex-end", gap: 8 },
} satisfies Record<string, CSSProperties>;
