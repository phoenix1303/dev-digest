import type { CSSProperties } from "react";

/** Co-located styles for FindingsPanel (extracted from inline styles). */
export const s = {
  toolbar: {
    display: "flex",
    alignItems: "center",
    gap: 10,
    marginBottom: 16,
    flexWrap: "wrap",
  } satisfies CSSProperties,
  divider: {
    width: 1,
    height: 18,
    background: "var(--border)",
    margin: "0 2px",
  } satisfies CSSProperties,
  toggleGroup: {
    marginLeft: "auto",
    display: "flex",
    alignItems: "center",
    gap: 10,
    fontSize: 13,
    color: "var(--text-secondary)",
  } satisfies CSSProperties,
  list: { display: "flex", flexDirection: "column", gap: 12 } satisfies CSSProperties,
  sevGroup: {
    display: "flex",
    alignItems: "center",
    gap: 6,
    flexWrap: "wrap",
  } satisfies CSSProperties,
  sevSep: { color: "var(--text-muted)", fontSize: 12 } satisfies CSSProperties,
  sevButton: (active: boolean, empty: boolean, color: string, bg: string): CSSProperties => ({
    display: "inline-flex",
    alignItems: "center",
    gap: 6,
    padding: "3px 9px",
    borderRadius: 5,
    fontSize: 12,
    fontWeight: 600,
    letterSpacing: "0.04em",
    color,
    background: active ? bg : "transparent",
    border: `1px solid ${active ? color : "transparent"}`,
    opacity: empty && !active ? 0.45 : 1,
    cursor: empty && !active ? "default" : "pointer",
    transition: "all .12s",
  }),
} as const;
