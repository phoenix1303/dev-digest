import type { CSSProperties } from "react";

export const s = {
  wrap: { maxWidth: 880, margin: "0 auto" },
  repo: { color: "var(--accent)" },
  toolbar: {
    display: "flex",
    alignItems: "center",
    gap: 12,
    margin: "4px 0 14px",
    fontSize: 13,
    color: "var(--text-muted)",
  },
  toolbarRight: { marginLeft: "auto" },
  list: { display: "flex", flexDirection: "column", gap: 12 },
  skeletons: { display: "flex", flexDirection: "column", gap: 12 },
  error: { fontSize: 13, color: "var(--crit)", marginBottom: 12 },
} satisfies Record<string, CSSProperties>;
