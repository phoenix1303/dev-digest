/* Pure helpers for the "New skill" modal — no React, no I/O. */
import type { SkillType } from "@devdigest/shared";
import { SKILL_TYPES } from "@/components/skill-badges";

/** Mirrors `CreateSkillInput.description.max(500)` in @devdigest/shared. */
export const DESCRIPTION_MAX = 500;

export interface PastedSkill {
  name?: string;
  description?: string;
  type?: SkillType;
  body: string;
}

const FRONTMATTER = /^﻿?\s*---\r?\n([\s\S]*?)\r?\n---[ \t]*(?:\r?\n|$)/;

/**
 * Detects a whole SKILL.md pasted into a field (`---` frontmatter + body) and
 * splits it into the form fields. Returns null when the text has no
 * frontmatter. Same YAML subset as the server importer: `key: value`, quoted
 * values and `key: >` / `key: |` blocks; nested maps are skipped.
 */
export function parsePastedSkill(text: string): PastedSkill | null {
  const fm = FRONTMATTER.exec(text);
  if (!fm) return null;
  const meta = parseFrontmatter(fm[1]!);
  const type = SKILL_TYPES.find((t) => t === meta.type?.toLowerCase());
  return {
    name: meta.name?.trim() || undefined,
    description: meta.description?.trim() || undefined,
    type,
    body: text.slice(fm.index + fm[0].length).trim(),
  };
}

function parseFrontmatter(raw: string): Record<string, string> {
  const out: Record<string, string> = {};
  const lines = raw.split(/\r?\n/);
  for (let i = 0; i < lines.length; i++) {
    const m = /^([A-Za-z0-9_-]+):\s*(.*)$/.exec(lines[i]!);
    if (!m) continue;
    const key = m[1]!.toLowerCase();
    let value = m[2]!.trim();
    if (["", ">", "|", ">-", "|-"].includes(value)) {
      const block: string[] = [];
      while (i + 1 < lines.length && /^\s+\S/.test(lines[i + 1]!)) {
        block.push(lines[i + 1]!.trim());
        i++;
      }
      if (value === "" && block.some((l) => /^[A-Za-z0-9_-]+:/.test(l))) continue;
      value = block.join(value.startsWith("|") ? "\n" : " ");
    }
    out[key] = unquote(value);
  }
  return out;
}

function unquote(v: string): string {
  if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) return v.slice(1, -1);
  return v;
}

/**
 * Turns a 422 `validation_error` payload (zod issues) into "field: message"
 * lines so the user sees WHAT failed instead of "Request validation failed".
 */
export function formatValidationDetails(details: unknown): string[] {
  if (!Array.isArray(details)) return [];
  return details.flatMap((d) => {
    if (!d || typeof d !== "object") return [];
    const issue = d as { path?: unknown; instancePath?: unknown; message?: unknown };
    const path = Array.isArray(issue.path)
      ? issue.path.join(".")
      : typeof issue.instancePath === "string"
        ? issue.instancePath.replace(/^\//, "").replace(/\//g, ".")
        : "";
    const message = typeof issue.message === "string" ? issue.message : "";
    if (!message) return [];
    return [path ? `${path}: ${message}` : message];
  });
}
