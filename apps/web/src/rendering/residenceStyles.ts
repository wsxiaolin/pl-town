// Compatibility entry point for the residence model system. The visual catalog
// now lives under `./residence/`; this module keeps the historical import path
// used by the world-decoration scene and unit tests.
export {
  createResidenceModel,
  residenceStyleFor,
  residenceStyleSeedForLot,
  residenceFamilyFor,
  residenceArchetypeFor,
  residenceVariantFor,
  RESIDENCE_STYLE_COUNT,
  RESIDENCE_ARCHETYPE_COUNT,
  RESIDENCE_FAMILY_COUNT,
} from './residence/index';
export type { ResidenceStyleOptions, ResidenceModel } from './residence/index';
