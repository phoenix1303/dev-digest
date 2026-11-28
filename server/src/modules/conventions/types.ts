import type {
  ConventionStatus,
  CreateConventionSkillInput,
  LLMProvider,
  RepoRef,
  Skill,
} from '@devdigest/shared';

/**
 * Conventions module — domain types and ports (rings 1–2). No Drizzle, no
 * Fastify: the service depends only on these; `repository.ts` implements the
 * repository port and `routes.ts` wires the rest from the container.
 */

/** A persisted convention candidate (domain shape, not the DB row). */
export interface ConventionRecord {
  id: string;
  workspaceId: string;
  repoId: string;
  rule: string;
  evidencePath: string;
  evidenceSnippet: string;
  confidence: number;
  status: ConventionStatus;
  createdAt: Date;
}

/** A verified candidate ready to be inserted. */
export interface NewConvention {
  rule: string;
  evidencePath: string;
  evidenceSnippet: string;
  confidence: number;
}

export interface ConventionPatch {
  rule?: string;
  status?: ConventionStatus;
}

export interface ConventionsRepositoryPort {
  listByRepo(workspaceId: string, repoId: string): Promise<ConventionRecord[]>;
  get(workspaceId: string, id: string): Promise<ConventionRecord | undefined>;
  update(workspaceId: string, id: string, patch: ConventionPatch): Promise<ConventionRecord | undefined>;
  /**
   * Re-scan: in ONE transaction delete the repo's non-accepted candidates
   * (pending + rejected) and insert `rows`. Accepted candidates survive.
   */
  replaceNonAccepted(workspaceId: string, repoId: string, rows: NewConvention[]): Promise<void>;
}

/** The repo being scanned — just what the service needs to read its files. */
export interface ConventionRepo {
  id: string;
  ref: RepoRef;
  fullName: string;
}

/** A file handed to the model (content already size-capped). */
export interface SampledFile {
  path: string;
  content: string;
}

export interface ConventionsServiceDeps {
  conventions: ConventionsRepositoryPort;
  /** Repo lookup scoped by workspace; undefined when unknown. */
  repos: { get(workspaceId: string, repoId: string): Promise<ConventionRepo | undefined> };
  /** Top-ranked source files (repo-intel), tests/configs/migrations excluded. */
  samples(repoId: string, n: number): Promise<string[]>;
  /** Read a repo-relative file from the clone; null when missing/unreadable/empty. */
  readFile(repo: RepoRef, path: string): Promise<string | null>;
  /** The LLM + model chosen for the `conventions` feature in this workspace. */
  model(workspaceId: string): Promise<{ llm: LLMProvider; model: string }>;
  /** Save the merged skill (type convention, source extracted). */
  skills: {
    createExtracted(
      workspaceId: string,
      input: CreateConventionSkillInput,
      evidenceFiles: string[],
    ): Promise<Skill>;
  };
}
