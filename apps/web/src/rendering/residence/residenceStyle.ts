// Deterministic residence style selection. A district block picks one material
// family (kept consistent per neighbourhood cell) while each lot independently
// picks an archetype and a micro-variant, so streets read as one family with
// natural local variation. All selection is pure and depends only on lot
// coordinates + seed, so the scene rebuilds identically after a refresh.
import { RESIDENCE_FAMILY_COUNT } from './residenceFamilies';
import { RESIDENCE_ARCHETYPE_COUNT } from './residenceArchetypes';

export const RESIDENCE_STYLE_COUNT = RESIDENCE_FAMILY_COUNT * RESIDENCE_ARCHETYPE_COUNT;

function seededInt(x: number, z: number, salt: number): number {
  const value = Math.sin(x * 12.9898 + z * 78.233 + salt * 37.719) * 43758.5453;
  return Math.abs(Math.floor((value - Math.floor(value)) * 1_000_000));
}

/** Deterministic material family for a neighbourhood block. */
export function residenceFamilyFor(x: number, z: number): number {
  const districtX = Math.floor((x + 42) / 12);
  const districtZ = Math.floor((z + 42) / 12);
  return seededInt(districtX, districtZ, 17) % RESIDENCE_FAMILY_COUNT;
}

/** Deterministic archetype (massing) for a single lot. */
export function residenceArchetypeFor(x: number, z: number, index: number): number {
  return seededInt(x, z, index + 29) % RESIDENCE_ARCHETYPE_COUNT;
}

/** Deterministic micro-variant (roof axis, openings, trim) for a single lot. */
export function residenceVariantFor(x: number, z: number, index: number): number {
  return seededInt(x, z, index + 101) % 4;
}

/** Stable style id combining family + archetype, used for labels and tests. */
export function residenceStyleFor(x: number, z: number, index: number): number {
  return residenceFamilyFor(x, z) * RESIDENCE_ARCHETYPE_COUNT + residenceArchetypeFor(x, z, index);
}

/** Independent yard-layout selector so courtyard dressing is not correlated
 * with the house micro-variant (otherwise some layouts never appear). */
export function residenceYardVariantFor(x: number, z: number, index: number): number {
  return seededInt(x, z, index + 54) % 4;
}

export function residenceStyleSeedForLot(x: number, z: number): number {
  return Math.abs(Math.round(x * 31 + z));
}
