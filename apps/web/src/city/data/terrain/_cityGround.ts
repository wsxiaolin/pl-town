import type { CityGroundPlanConfig } from './_types';

/** Deterministic built-city ground layout, kept with the terrain data contracts. */
export const CITY_GROUND_PLAN: CityGroundPlanConfig = {
  relief: {
    width: 150,
    depth: 150,
    segments: 30,
    amplitude: 0.004,
    seed: 261006,
  },
  paving: {
    x: 0,
    z: 0,
    width: 40,
    depth: 40,
    tileWidth: 1.48,
    tileDepth: 0.92,
    joint: 0.075,
    bevel: 0.06,
    minLift: 0.013,
    maxLift: 0.016,
    seed: 602610,
    texture: 'ground6',
    dayColor: 0xe5e2da,
    nightColor: 0xa9a79f,
    exclusions: [
      { kind: 'cross', x: 0, z: 0, halfWidth: 1.7 },
      { kind: 'circle', x: 0, z: 0, radius: 3.2 },
      { kind: 'rect', minX: 12, maxX: 36, minZ: 12, maxZ: 36 },
      { kind: 'rect', minX: 12, maxX: 36, minZ: -36, maxZ: -12 },
      { kind: 'rect', minX: -36, maxX: -12, minZ: 12, maxZ: 36 },
      { kind: 'rect', minX: -36, maxX: -12, minZ: -36, maxZ: -12 },
    ],
  },
};
