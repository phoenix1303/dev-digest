import type {
  ConventionCandidate,
  CreateConventionSkillInput,
  ExtractConventionsResult,
  Skill,
  UpdateConventionInput,
} from '@devdigest/shared';
import { NotFoundError, ValidationError } from '../../platform/errors.js';
import { CONFIG_FILES, ConventionExtraction, SAMPLE_FILES, SCHEMA_NAME } from './constants.js';
import { buildExtractionMessages, capContent, selectCandidates, toConventionDto } from './helpers.js';
import type { ConventionRepo, ConventionsServiceDeps, SampledFile } from './types.js';

/**
 * L02 — Conventions Extractor. Samples the repo in code (top-ranked files +
 * configs, no model), makes ONE structured LLM call, verifies every candidate's
 * evidence against the files actually sent, and stores only grounded ones.
 * Accepted candidates are merged (by the user, in the UI) into one skill.
 */
export class ConventionsService {
  constructor(private deps: ConventionsServiceDeps) {}

  private async requireRepo(workspaceId: string, repoId: string): Promise<ConventionRepo> {
    const repo = await this.deps.repos.get(workspaceId, repoId);
    if (!repo) throw new NotFoundError('Repo not found');
    return repo;
  }

  /** Samples + configs that exist, read and size-capped. Paths de-duplicated. */
  private async collectFiles(repo: ConventionRepo): Promise<SampledFile[]> {
    const samples = await this.deps.samples(repo.id, SAMPLE_FILES);
    const paths = [...new Set([...CONFIG_FILES, ...samples])];
    const read = await Promise.all(
      paths.map(async (path) => {
        const content = await this.deps.readFile(repo.ref, path);
        return content ? { path, content: capContent(content) } : null;
      }),
    );
    const files = read.filter((f): f is SampledFile => f !== null);
    // Configs alone aren't enough to infer house rules: need ranked source files.
    if (!files.some((f) => samples.includes(f.path))) {
      throw new ValidationError(
        'No source files to analyse — clone the repo and let repo-intel index it first.',
      );
    }
    return files;
  }

  async extract(workspaceId: string, repoId: string): Promise<ExtractConventionsResult> {
    const repo = await this.requireRepo(workspaceId, repoId);
    const files = await this.collectFiles(repo);
    const { llm, model } = await this.deps.model(workspaceId);
    const res = await llm.completeStructured({
      model,
      schema: ConventionExtraction,
      schemaName: SCHEMA_NAME,
      messages: buildExtractionMessages(repo.fullName, files),
      temperature: 0.2,
    });

    const existing = await this.deps.conventions.listByRepo(workspaceId, repoId);
    const acceptedRules = existing.filter((c) => c.status === 'accepted').map((c) => c.rule);
    const contents = new Map(files.map((f) => [f.path, f.content]));
    const rows = selectCandidates(res.data, contents, acceptedRules);
    await this.deps.conventions.replaceNonAccepted(workspaceId, repoId, rows);

    return { candidates: await this.list(workspaceId, repoId), sampled_files: files.length };
  }

  async list(workspaceId: string, repoId: string): Promise<ConventionCandidate[]> {
    await this.requireRepo(workspaceId, repoId);
    const rows = await this.deps.conventions.listByRepo(workspaceId, repoId);
    return rows.map(toConventionDto);
  }

  async update(
    workspaceId: string,
    id: string,
    input: UpdateConventionInput,
  ): Promise<ConventionCandidate> {
    const updated = await this.deps.conventions.update(workspaceId, id, {
      rule: input.rule,
      status: input.status,
    });
    if (!updated) throw new NotFoundError('Convention not found');
    return toConventionDto(updated);
  }

  /**
   * Save the user-edited draft as a skill. Only ACCEPTED candidates count:
   * at least one is required, and only their files become `evidence_files`.
   */
  async createSkill(
    workspaceId: string,
    repoId: string,
    input: CreateConventionSkillInput,
  ): Promise<Skill> {
    await this.requireRepo(workspaceId, repoId);
    const rows = await this.deps.conventions.listByRepo(workspaceId, repoId);
    const accepted = rows.filter((c) => c.status === 'accepted');
    if (accepted.length === 0) {
      throw new ValidationError('Accept at least one convention before creating a skill.');
    }
    const evidenceFiles = [...new Set(accepted.map((c) => c.evidencePath))];
    return this.deps.skills.createExtracted(workspaceId, input, evidenceFiles);
  }
}
