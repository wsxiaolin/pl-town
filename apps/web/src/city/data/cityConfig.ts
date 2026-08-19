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
export const CITY_LIMIT = 42;
export const BUILDING_PLATFORM_HEIGHT = 0.3;
export const FILM_CITY_CLEARINGS = Object.freeze([
  Object.freeze([-9, -21] as const),
  Object.freeze([-9, -27] as const),
]);

export function isFilmCityClearing(x: number, z: number): boolean {
  return FILM_CITY_CLEARINGS.some(([clearingX, clearingZ]) => x === clearingX && z === clearingZ);
}
export const WEST_BEACH = Object.freeze({
  coastlineX: -43.2,
  deepWaterX: -44.5,
  safeReturnX: -42.2,
  minZ: -50,
  maxZ: 50,
});
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
