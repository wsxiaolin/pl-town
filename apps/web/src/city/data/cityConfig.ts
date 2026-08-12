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
export const WEST_BEACH = Object.freeze({
  coastlineX: -43.2,
  deepWaterX: -44.5,
  safeReturnX: -42.2,
  minZ: -34,
  maxZ: 54,
});
export const SATELLITE_CITY = Object.freeze({
  roadNodes: Object.freeze([
    [0, 38], [0, 55], [-8, 68], [-28, 68], [28, 68], [20, 82],
    [-24, 82], [-16, 97], [25, 97],
  ]),
  roadSegments: Object.freeze([
    [0, 38, 0, 55], [0, 55, -8, 68], [-8, 68, 28, 68],
    [28, 68, 20, 82], [20, 82, -24, 82], [-24, 82, -16, 97],
    [-16, 97, 25, 97],
  ]),
  buildingPositions: Object.freeze([
    [-18, 60], [-12, 60], [-6, 60], [0, 60], [6, 60], [12, 60],
    [-18, 76], [-12, 76], [-6, 76], [0, 76], [6, 76], [12, 76],
    [-18, 92], [-12, 92], [-6, 92], [0, 92], [6, 92], [12, 92],
  ]),
  connectorStartZ: 38,
  centerZ: 78,
  width: 66,
  depth: 50,
});

export const ECHO_OBSERVATORY_AREA = Object.freeze({
  roadNodes: Object.freeze([
    [38, 0], [48, 0], [58, 0], [68, 0],
  ]),
  roadSegments: Object.freeze([
    [38, 0, 48, 0], [48, 0, 58, 0], [58, 0, 68, 0],
  ]),
  center: Object.freeze([68, 0] as const),
  observatory: Object.freeze([72, -4] as const),
  home: Object.freeze([72, 5] as const),
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
