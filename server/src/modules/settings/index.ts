/**
 * Settings module public API (barrel). Other modules import settings ONLY
 * through this file.
 */
export {
  defaultFeatureModel,
  getFeatureModelOverride,
  resolveFeatureModel,
} from './feature-models.js';
