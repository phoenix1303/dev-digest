import type { Container } from '../../platform/container.js';
import { FflateArchiveReader } from '../../adapters/archive/index.js';
import { SkillsRepository } from './repository.js';
import { SkillsService } from './service.js';

/**
 * Skills module public API (barrel). Other modules use skills ONLY through
 * this file — never by importing `./repository.js` / `./service.js` directly.
 */
export { SkillsService } from './service.js';

/** Compose a SkillsService from the container (a composition-root helper). */
export function createSkillsService(container: Container): SkillsService {
  return new SkillsService({
    skills: new SkillsRepository(container.db),
    archive: new FflateArchiveReader(),
    tokenizer: container.tokenizer,
  });
}
