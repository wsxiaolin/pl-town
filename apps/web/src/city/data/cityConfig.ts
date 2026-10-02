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
// Coastline wobble: the waterline's landward/seaward drift along z. The
// amplitudes feed both shorelineX (the visible coast) and the worst-case
// budget westBeachWaterlineMaxX uses, so they can never drift apart.
const COAST_WOBBLE_A = 0.85;
const COAST_WOBBLE_B = 0.35;
const COAST_WOBBLE = COAST_WOBBLE_A + COAST_WOBBLE_B;
export const WEST_BEACH = Object.freeze({
  coastlineX: -43.2,
  deepWaterX: -44.5,
  // How far the lapping waterline may push up the beach, in world units.
  // Drives westBeachWaterlineMaxX (the road-clearance invariant) and the
  // surf strip's crest amplitude in westBeach.ts.
  surfReach: 1.15,
  minZ: -50,
  maxZ: 50,
  // Derived, not hardcoded: landward of the furthest lapping waterline so
  // the swim pushback never drops the player in the surf, but still seaward
  // of the west road arm.
  get safeReturnX() { return westBeachWaterlineMaxX() + 0.25; },
});
/** The visible west-beach coastline: wobbles ±COAST_WOBBLE along z. The
 *  amplitude stays inside the coastlineX→deepWaterX gap so the walkable-sand
 *  / deep-water gameplay bounds still match the visible shore. */
export function shorelineX(z: number): number {
  return WEST_BEACH.coastlineX + Math.sin(z * 0.19) * COAST_WOBBLE_A + Math.sin(z * 0.47 + 1.4) * COAST_WOBBLE_B;
}
/** Furthest the lapping waterline can ever reach, given the shore-wave
 *  reach. The worst case is the most landward coastline wobble plus the
 *  full crest advance. */
export function westBeachWaterlineMaxX(reach: number = WEST_BEACH.surfReach): number {
  return WEST_BEACH.coastlineX + COAST_WOBBLE + reach;
}
/** Plaza ring-road radii: the asphalt ring and everything that meets its
 *  outer edge (the centre-line marking, the pavement spokes, the west arm
 *  end below) is derived from these two numbers. */
export const RING_ROAD_RADII = Object.freeze({ inner: 37, outer: 39 });
/** West end of the asphalt ring-road arm that runs toward the beach. It
 *  stops at the ring walkway's outer edge (RING_ROAD_RADII.outer) instead
 *  of overhanging past it, and stays clear of the furthest shore-wave
 *  advance (westBeachWaterlineMaxX), so the surf can never lap over the
 *  asphalt. */
export const WEST_RING_ROAD_END_X = -RING_ROAD_RADII.outer;
/** East end of the ring-road arm — it keeps the full run past the ring to
 *  the far city edge. Co-located with the west end so the pair stays in
 *  sync when either arm is lengthened. */
export const EAST_RING_ROAD_END_X = 43;
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

/** 星语北城：主城北侧的扩建城区（黑洞热门作品 Top100 城市化）。
 *  设计文档见仓库外 design/master-plan.md；本配置是渲染、导航与民居
 *  批次的唯一事实来源。三级路网：中央大道（x=0，沥青，与主城南北主轴
 *  经环城步道无缝相接）+ 东西巷（x=±33.5，人行道）+ 四条横街与公园
 *  步道（人行道）。民居地块为可认领住宅批次（id 由坐标推导，与主城
 *  程序化住宅同一命名空间）。 */
export const NORTH_DISTRICT_AREA = Object.freeze({
  /** 导航节点：所有街道交叉口与端点（含主城网格衔接点）。 */
  roadNodes: Object.freeze([
    [-33.5, -36], [0, -36], [33.5, -36],
    [0, -40],
    [-33.5, -44.5], [0, -44.5], [33.5, -44.5],
    [-33.5, -54.5], [0, -54.5], [33.5, -54.5],
    [-33.5, -64.5], [0, -64.5], [33.5, -64.5],
    [-33.5, -74], [0, -74], [21, -74],
    [0, -80], [33, -80],
  ] as Coord2[]),
  /** 中央大道（沥青，宽同主城主路）。视觉与导航共用。 */
  avenueSegment: Object.freeze([0, -40, 0, -80] as RoadSegment4),
  /** 人行道街巷（1.35 宽，pavement，与 Echo 区步道同规格）。 */
  laneSegments: Object.freeze([
    [-33.5, -36, -33.5, -74], [33.5, -36, 33.5, -64.5],
    [-33.5, -44.5, 33.5, -44.5], [-33.5, -54.5, 33.5, -54.5],
    [-33.5, -64.5, 33.5, -64.5], [-33.5, -74, 21, -74],
    [0, -80, 33, -80],
  ] as RoadSegment4[]),
  /** 仅用于导航图的连接边（无对应可见路面）：西/东巷南端接主城
   *  z=-36 网格边节点；中央大道南端穿过环城步道接 (0,-36)。 */
  roadJunctions: Object.freeze([
    [-36, -36, -33.5, -36], [36, -36, 33.5, -36], [0, -36, 0, -40],
  ] as RoadSegment4[]),
  /** 可认领民居批次：两排街坊，24 块。西坊与东坊对称避开中央大道。 */
  residenceLots: Object.freeze([
    ...[-30, -27, -24, -21, -18, -15, -12, -9, 6, 9, 12, 15].map(
      (x): Coord2 => [x, -70.5] as Coord2,
    ),
    ...[-30, -27, -24, -21, -18, -15, -12, -9, 6, 9, 12, 15].map(
      (x): Coord2 => [x, -77.5] as Coord2,
    ),
  ] as Coord2[]),
  /** 北城路灯（沿中央大道 + 民居街 + 公园）。 */
  lampPositions: Object.freeze([
    [1.5, -44.5], [-1.5, -49.5], [1.5, -54.5], [-1.5, -59.5], [1.5, -64.5],
    [-1.5, -69.5], [1.5, -74.5], [-1.5, -79],
    [-30, -75.4], [-9, -75.4], [6, -75.4], [15, -75.4],
    [24, -75], [31, -78.9], [33, -82.5],
  ] as Coord2[]),
  /** 星语公园树阵（x, z）。 */
  parkTrees: Object.freeze([
    [25, -71], [29, -72], [33, -73], [26, -76], [31, -77], [25, -81], [30, -83], [34, -83],
  ] as Coord2[]),
  /** 星语公园长椅（x, z, 朝向 rotY）。 */
  parkBenches: Object.freeze([
    [26.5, -78.2, Math.PI], [31.5, -81.9, 0],
  ] as Array<[number, number, number]>),
  /** 北城地表范围（草地基底）。 */
  ground: Object.freeze({ minX: -36, maxX: 36, minZ: -44, maxZ: -86.5 }),
  /** 星语公园（东北角绿地）。 */
  park: Object.freeze({ minX: 22.5, maxX: 35, minZ: -68.5, maxZ: -84 }),
  /** 中央大道宽度（与主城 MAIN_ROAD_WIDTH 一致）。 */
  roadWidth: 2.4,
  /** 人行道街巷宽度（与 Echo 区步道一致）。 */
  laneWidth: 1.35,
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
