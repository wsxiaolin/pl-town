// Public residence entry point. Assembles the deterministic style selection with
// the material families and archetype builders, and returns the entity shape the
// world-decoration / interaction / damage flows already expect.
import * as THREE from 'three';
import type { MeshHelpers } from '../meshFactory';
import { createResidenceKit } from './residenceKit';
import { residenceFamily } from './residenceFamilies';
import { RESIDENCE_ARCHETYPES, RESIDENCE_ARCHETYPE_COUNT, RESIDENCE_ARCHETYPE_NAMES } from './residenceArchetypes';
import { residenceArchetypeFor, residenceFamilyFor, residenceVariantFor } from './residenceStyle';

export type ResidenceStyleOptions = {
  x: number;
  z: number;
  variationSeed: number;
  lotType: number;
  isNight: boolean;
  part: MeshHelpers['part'];
};

export type ResidenceModel = {
  group: THREE.Group;
  body: THREE.Mesh;
  styleId: number;
  styleName: string;
};

export function createResidenceModel(options: ResidenceStyleOptions): ResidenceModel {
  const { x, z, variationSeed, lotType, isNight, part } = options;
  const group = new THREE.Group();

  const familyIndex = residenceFamilyFor(x, z);
  const archetypeIndex = residenceArchetypeFor(x, z, variationSeed);
  const styleId = familyIndex * RESIDENCE_ARCHETYPE_COUNT + archetypeIndex;
  const family = residenceFamily(familyIndex);

  const width = lotType === 2 ? 1.25 : 1.6;
  const depth = lotType === 1 ? 1.15 : 1.5;
  const kit = createResidenceKit({ part, isNight });
  const variant = residenceVariantFor(x, z, variationSeed);
  const builder = RESIDENCE_ARCHETYPES[archetypeIndex] ?? RESIDENCE_ARCHETYPES[0]!;
  const body = builder({ group, width, depth, family, kit, variant, isNight });

  const archetypeName = RESIDENCE_ARCHETYPE_NAMES[archetypeIndex] ?? '民居';
  const styleName = `${family.name}·${archetypeName}`;
  group.userData.residenceStyleId = styleId;
  group.userData.residenceStyleName = styleName;
  group.userData.navigationFootprint = { width: width + 0.12, depth: depth + 0.12 };
  return { group, body, styleId, styleName };
}

export {
  residenceArchetypeFor,
  residenceFamilyFor,
  residenceVariantFor,
  residenceStyleFor,
  residenceStyleSeedForLot,
  RESIDENCE_STYLE_COUNT,
} from './residenceStyle';
export { RESIDENCE_ARCHETYPE_COUNT, RESIDENCE_ARCHETYPE_NAMES } from './residenceArchetypes';
export { RESIDENCE_FAMILY_COUNT, RESIDENCE_FAMILIES } from './residenceFamilies';
