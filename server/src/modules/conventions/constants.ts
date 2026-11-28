import { z } from 'zod';

/** How many top-ranked source files feed the extraction. */
export const SAMPLE_FILES = 12;

/**
 * Config files read in addition to the samples. `getConventionSamples` filters
 * configs out (eslint/prettier/`.config.`), so they're collected here by path.
 */
export const CONFIG_FILES = [
  'tsconfig.json',
  '.eslintrc',
  '.eslintrc.json',
  '.eslintrc.js',
  '.eslintrc.cjs',
  'eslint.config.js',
  'eslint.config.mjs',
  'eslint.config.cjs',
  'eslint.config.ts',
  '.prettierrc',
  '.prettierrc.json',
  '.prettierrc.js',
  'prettier.config.js',
  'prettier.config.mjs',
  'biome.json',
  '.editorconfig',
] as const;

/** Per-file cap on what the model sees (and what evidence is verified against). */
export const MAX_FILE_CHARS = 8_000;

/** Max candidates stored per scan (after verification + dedupe). */
export const MAX_CANDIDATES = 15;

/** Snippets are shown on cards; keep them short. */
export const MAX_SNIPPET_CHARS = 600;

export const SCHEMA_NAME = 'ConventionExtraction';

/**
 * LLM output schema. Every field is REQUIRED (OpenAI strict json_schema
 * rejects optional/nullish), confidence range is clamped in code.
 */
export const ConventionExtraction = z.object({
  candidates: z.array(
    z.object({
      rule: z.string(),
      evidence_path: z.string(),
      evidence_snippet: z.string(),
      confidence: z.number(),
    }),
  ),
});
export type ConventionExtraction = z.infer<typeof ConventionExtraction>;
