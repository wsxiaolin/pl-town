import type { TerrainFeatureConfig } from './_types';

export const CHENXI_SEA_LEVEL = 0.05;

// Source to sea: [x, z, water half-width, water elevation]. The final station
// shares the configured sea surface so the mouth cannot float below the coast.
// The source stays west of the north trail; the mouth remains inside the sea.
export const CHENXI_RIVER_STATIONS: ReadonlyArray<readonly [number, number, number, number]> = [
  [64, -101, 0.65, 0.5],
  [48, -105, 1.7, 0.43],
  [30, -108, 2.3, 0.34],
  [10, -108, 2.8, 0.25],
  [-12, -106, 3.4, 0.17],
  [-30, -104, 4.2, 0.10],
  [-40, -102, 5, 0.055],
  [-44, -101, 5.5, 0.053],
  [-50, -99.5, 5.8, 0.052],
  [-58, -98, 6, CHENXI_SEA_LEVEL],
];

// Compatibility data for scenery exclusion, following the same mouth stations.
export const ESTUARY_PROFILE: ReadonlyArray<readonly [number, number, number]> = [
  [-58, -98, 6],
  [-50, -99.5, 5.8],
  [-44, -101, 5.5],
  [-40, -102, 5],
  [-30, -104, 4.2],
];
export const ESTUARY_BBOX = { x0: -60, x1: -28, z0: -110, z1: -90 };

const CHENXI_RIVER_PATH: Array<[number, number]> = CHENXI_RIVER_STATIONS.map(([x, z]) => [x, z]);

export const CHENXI_RIVER: readonly TerrainFeatureConfig[] = [
  {
    id: 'river-chenxi', kind: 'river', label: '晨溪',
    x: 64, z: -101, width: 6, path: CHENXI_RIVER_PATH,
    renderHint: { animated: true, color: 0x7fb5c9 },
    navigationBlocking: true, navigationClearance: 1.5,
  },
  {
    id: 'river-chenxi-banks', kind: 'forest', label: '晨溪岸林',
    x: 10, z: -108, width: 24, path: CHENXI_RIVER_PATH,
    renderHint: { color: 0x3a6a48, castShadow: true }, navigationBlocking: false,
  },
];
