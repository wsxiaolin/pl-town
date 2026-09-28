import * as THREE from 'three';

export const PALETTE = Object.freeze({
  DAY_BG: 0xf9f8f6,
  NIGHT_BG: 0xd4d3ce,
  DAY_GROUND: 0xf2f1ee,
  NIGHT_GROUND: 0xc4c3be,
  DAY_PATH: 0xe8e7e4,
  NIGHT_PATH: 0xbcbbb6,
  BUILDING_WHITE: 0xffffff,
  BUILDING_BASE: 0xeae9e6,
  ROOF_RIM: 0xf8f7f5,
  BLUE: 0x3b6fe0,
  FOUNTAIN_RIM: 0xecebe8,
  FOUNTAIN_WATER: 0xc8dafc,
  GOLD: 0xe8a838,
  PARCHMENT: 0xe8d5a8,
  DARK_TOWER: 0x4a4a52,
  RUIN_GREY: 0xb5b2ac,
  ASPHALT: 0x3a3d44,
  PAVEMENT: 0xc8c7c2,
  RIVER: 0x5a8fb8,
  RIVER_DEEP: 0x3a6f98,
  MALL_FRAME: 0x2a3038,
  MALL_SIGN: 0xe8a838,
  SCHOOL_BRICK: 0xa04030,
  SCHOOL_ROOF: 0x6a4a3a,
  FIELD: 0xb8c898,
  SUBURB_WALL: 0xede3d0,
  SUBURB_ROOF: 0x8a5a4a,
  PARK_GRASS: 0xc8d8a8,
});

export const ROAD_COORDS = Object.freeze([-36, -27, -18, -12, -6, 0, 6, 12, 18, 27, 36]);
export const MAIN_ROAD_WIDTH = 2.4;
export const CITY_LIMIT = 42;
export const BUILDING_PLATFORM_HEIGHT = 0.3;
export const FILM_CITY_CLEARINGS = Object.freeze([
  Object.freeze([-9, -21] as const),
  Object.freeze([-9, -27] as const),
]);

export function isFilmCityClearing(x: number, z: number): boolean {
  return FILM_CITY_CLEARINGS.some(([clearingX, clearingZ]) => x === clearingX && z === clearingZ);
}

export function footprintOverlapsMainRoad(x: number, z: number, halfWidth = 0, halfDepth = halfWidth): boolean {
  const roadHalfWidth = MAIN_ROAD_WIDTH / 2;
  const roadExtent = CITY_LIMIT + roadHalfWidth;
  const overlapsEastWest = Math.abs(x) - halfWidth <= roadExtent && Math.abs(z) - halfDepth <= roadHalfWidth;
  const overlapsNorthSouth = Math.abs(z) - halfDepth <= roadExtent && Math.abs(x) - halfWidth <= roadHalfWidth;
  return overlapsEastWest || overlapsNorthSouth;
}

export function clipPlotToMainRoad(x: number, z: number, halfWidth: number, halfDepth: number): { halfWidth: number; halfDepth: number } {
  const roadHalfWidth = MAIN_ROAD_WIDTH / 2;
  const maxHalfX = Math.abs(x) > roadHalfWidth ? Math.abs(x) - roadHalfWidth : 0;
  const maxHalfZ = Math.abs(z) > roadHalfWidth ? Math.abs(z) - roadHalfWidth : 0;
  return {
    halfWidth: Math.min(halfWidth, maxHalfX),
    halfDepth: Math.min(halfDepth, maxHalfZ),
  };
}
export const WEST_BEACH = Object.freeze({
  coastlineX: -43.2,
  deepWaterX: -44.5,
  safeReturnX: -42.2,
  minZ: -50,
  maxZ: 50,
});
/** Furthest the lapping waterline can ever reach, given the shore-wave
 *  reach. The coastline formula wobbles ±1.2 units along z, so the worst
 *  case is the most landward coastline plus the full crest advance. */
export function westBeachWaterlineMaxX(reach: number): number {
  return WEST_BEACH.coastlineX + 1.2 + reach;
}
/** West end of the asphalt ring road that runs toward the beach. It stops
 *  at the ring walkway's outer edge (39, see the plaza ring in
 *  createCitySurfaces) instead of overhanging past it, and stays clear of
 *  the furthest shore-wave advance (westBeachWaterlineMaxX), so the surf
 *  can never lap over the asphalt. */
export const WEST_RING_ROAD_END_X = -39;
/** Inner end of the east/west ring-road arms, shared by both so they stay
 *  symmetric around the plaza when one arm is lengthened or shortened. */
export const RING_ARM_INNER_X = 4.2;
type Coord2 = [number, number];
type RoadSegment4 = [number, number, number, number];

export const ECHO_OBSERVATORY_AREA = Object.freeze({
  roadNodes: Object.freeze([
    [38, 0], [48, 0], [58, 0], [68, 0],
  ] as Coord2[]),
  roadSegments: Object.freeze([
    [38, 0, 48, 0], [48, 0, 58, 0], [58, 0, 68, 0],
  ] as RoadSegment4[]),
  center: Object.freeze([68, 0] as const),
  observatory: Object.freeze([72, -4.55] as const),
  observatoryScale: 0.9,
  home: Object.freeze([60.5, -5.25] as const),
  homeScale: 0.7,
  linche: Object.freeze([67, 0] as const),
  stonePile: Object.freeze([65.5, 3.4] as const),
  table: Object.freeze([65.5, -3.0] as const),
  interior: Object.freeze([220, 0] as const),
  width: 25,
  depth: 17,
});

export const CITY_CONFIG = Object.freeze({
  cameraNearSize: 10,
  cameraZoomMin: 2,
  cameraZoomMax: 15,
  cameraEdge: 0.25,
  playerSpeed: 4.2,
  npcTalkRadius: 1.6,
  buildingInteractRadius: 8.5,
});

export const CAMERA_OFFSET = new THREE.Vector3(24, 40, 24);
