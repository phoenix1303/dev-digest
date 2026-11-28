import type { CSSProperties } from "react";

export const s = {
  body: { display: "flex", flexDirection: "column", padding: "20px 24px 4px" },
  row: { display: "grid", gridTemplateColumns: "1fr 180px", gap: 16, alignItems: "start" },
  banner: {
    display: "flex",
    gap: 8,
    alignItems: "flex-start",
    padding: "10px 12px",
    marginBottom: 16,
    borderRadius: 8,
    fontSize: 13,
    lineHeight: 1.45,
    background: "var(--info-bg)",
    color: "var(--text-secondary)",
  },
  counter: { fontSize: 12, color: "var(--text-muted)" },
  counterOver: { fontSize: 12, color: "var(--crit)", fontWeight: 600 },
  error: {
    fontSize: 13,
    color: "var(--crit)",
    background: "var(--crit-bg)",
    padding: "10px 12px",
    borderRadius: 8,
    marginBottom: 16,
    lineHeight: 1.45,
  },
  errorList: { margin: "4px 0 0", paddingLeft: 18 },
  footer: { display: "flex", justifyContent: "flex-end", gap: 8 },
} satisfies Record<string, CSSProperties>;
