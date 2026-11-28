import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import {
  CreateConventionSkillInput,
  UpdateConventionInput,
  type ConventionCandidate,
  type ExtractConventionsResult,
  type Skill,
} from '@devdigest/shared';
import { getContext } from '../_shared/context.js';
import { IdParams } from '../_shared/schemas.js';
import { RepoRepository } from '../repos/index.js';
import { resolveFeatureModel } from '../settings/index.js';
import { createSkillsService } from '../skills/index.js';
import { ConventionsRepository } from './repository.js';
import { ConventionsService } from './service.js';

/**
 * L02 — conventions module. Transport only: validates and delegates.
 *   POST  /repos/:id/conventions/extract → sample repo, ONE LLM call, verify
 *                                          evidence, store (accepted survive)
 *   GET   /repos/:id/conventions         → the repo's candidates
 *   PATCH /conventions/:id               → edit rule text / set status
 *   POST  /repos/:id/conventions/skill   → save the merged draft as a skill
 *                                          (type convention, source extracted)
 */
export default async function conventionsRoutes(appBase: FastifyInstance) {
  const app = appBase.withTypeProvider<ZodTypeProvider>();
  const { container } = app;
  const repos = new RepoRepository(container.db);
  const skills = createSkillsService(container);

  // Module-local composition root: the service only sees narrow ports.
  const service = new ConventionsService({
    conventions: new ConventionsRepository(container.db),
    repos: {
      async get(workspaceId, repoId) {
        const r = await repos.getById(workspaceId, repoId);
        return r ? { id: r.id, fullName: r.fullName, ref: { owner: r.owner, name: r.name } } : undefined;
      },
    },
    samples: (repoId, n) => container.repoIntel.getConventionSamples(repoId, n),
    async readFile(ref, path) {
      try {
        const text = await container.git.readFile(ref, path);
        return text.trim() ? text : null;
      } catch {
        return null; // missing file / outside the checkout / not cloned
      }
    },
    async model(workspaceId) {
      const choice = await resolveFeatureModel(container, workspaceId, 'conventions');
      return { llm: await container.llm(choice.provider), model: choice.model };
    },
    skills: {
      createExtracted: (workspaceId, input, evidenceFiles) =>
        skills.createExtracted(workspaceId, input, evidenceFiles),
    },
  });

  app.post(
    '/repos/:id/conventions/extract',
    { schema: { params: IdParams } },
    async (req): Promise<ExtractConventionsResult> => {
      const { workspaceId } = await getContext(container, req);
      return service.extract(workspaceId, req.params.id);
    },
  );

  app.get(
    '/repos/:id/conventions',
    { schema: { params: IdParams } },
    async (req): Promise<ConventionCandidate[]> => {
      const { workspaceId } = await getContext(container, req);
      return service.list(workspaceId, req.params.id);
    },
  );

  app.patch(
    '/conventions/:id',
    { schema: { params: IdParams, body: UpdateConventionInput } },
    async (req): Promise<ConventionCandidate> => {
      const { workspaceId } = await getContext(container, req);
      return service.update(workspaceId, req.params.id, req.body);
    },
  );

  app.post(
    '/repos/:id/conventions/skill',
    { schema: { params: IdParams, body: CreateConventionSkillInput } },
    async (req, reply): Promise<Skill> => {
      const { workspaceId } = await getContext(container, req);
      reply.status(201);
      return service.createSkill(workspaceId, req.params.id, req.body);
    },
  );
}
