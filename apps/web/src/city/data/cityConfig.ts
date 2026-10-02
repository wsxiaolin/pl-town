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
 *  批次的唯一事实来源。路网分层：中央大道（x=0，沥青，与主城南北主轴
 *  经环城步道无缝相接）+ 东西巷（x=±33.5）+ 四条横街 + 两条斜穿居住坊
 *  的斜巷、公园步道与作品建筑排间的四条窄巷（1.35 宽 pavement，斜线
 *  由渲染层旋转绘制、导航图按共线节点切分建边）。民居沿横街 frontage
 *  错落排布（可认领 24 块 + 街景小屋混排成街道墙）。 */
export const NORTH_DISTRICT_AREA = Object.freeze({
  /** 导航节点：所有街道交叉口与端点（含主城网格衔接点、斜巷端点、
   *  地标间巷道端点）。 */
  roadNodes: Object.freeze([
    [-33.5, -36], [0, -36], [33.5, -36],
    [0, -40],
    [-33.5, -44.5], [0, -44.5], [33.5, -44.5],
    [-9.9, -44.5], [10.45, -44.5],
    [-33.5, -54.5], [0, -54.5], [33.5, -54.5],
    [-9.9, -54.5], [10.45, -54.5], [-10.05, -54.5], [14.5, -54.5],
    [-33.5, -64.5], [0, -64.5], [33.5, -64.5],
    [-19, -64.5], [15, -64.5], [-10.05, -64.5], [14.5, -64.5],
    [-33.5, -74], [0, -74], [21, -74], [-19, -74], [15, -74],
    [0, -80], [33, -80], [28.5, -80.2],
  ] as Coord2[]),
  /** 中央大道（沥青，宽同主城主路）。视觉与导航共用。 */
  avenueSegment: Object.freeze([0, -40, 0, -80] as RoadSegment4),
  /** 街巷（pavement）：支路三条（z=-44.5/-54.5/-64.5，宽 streetWidth）
   *  + 巷道（东西巷、-74/-80 街、居住坊内部直巷 x=±…、公园步道、作品
   *  建筑排间窄巷）。居住坊采用超大街区+内部直巷的规划格局（胡同/
   *  Eixample 式），巷口接小广场。 */
  laneSegments: Object.freeze([
    [-33.5, -36, -33.5, -74], [33.5, -36, 33.5, -64.5],
    [-33.5, -44.5, 33.5, -44.5], [-33.5, -54.5, 33.5, -54.5],
    [-33.5, -64.5, 33.5, -64.5], [-33.5, -74, 21, -74],
    [0, -80, 33, -80],
    [-19, -64.5, -19, -74], [15, -64.5, 15, -74], [21, -74, 28.5, -80.2],
    [-9.9, -44.5, -9.9, -54.5], [10.45, -44.5, 10.45, -54.5],
    [-10.05, -54.5, -10.05, -64.5], [14.5, -54.5, 14.5, -64.5],
  ] as RoadSegment4[]),
  /** 支路（宽 streetWidth 的横街，z 坐标）——路网等级的中间层。 */
  wideStreetZs: Object.freeze([-44.5, -54.5, -64.5] as readonly number[]),
  streetWidth: 2.0,
  /** 仅用于导航图的连接边（无对应可见路面）：西/东巷南端接主城
   *  z=-36 网格边节点；中央大道南端穿过环城步道接 (0,-36)。 */
  roadJunctions: Object.freeze([
    [-36, -36, -33.5, -36], [36, -36, 33.5, -36], [0, -36, 0, -40],
  ] as RoadSegment4[]),
  /** 可认领民居：沿四条横街的街廊frontage排布（确定性抖动），两坊以
   *  斜巷为骨架错落展开，共 24 块；街景小屋（不可认领）补足其余门面，
   *  共同形成连续的街道墙。 */
  residenceLots: Object.freeze([
    [-31, -67.5], [-28, -66.7], [-25.1, -67.1], [-20.7, -67.5], [-16.6, -66.7],
    [-7.4, -66.8], [-4.5, -67.2], [6.4, -66.7], [10.4, -67.5], [17.3, -66.7],
    [-30.8, -71.7], [-15.3, -71.4], [8.7, -71.5], [12.9, -71.5],
    [-27.1, -77.3], [-24.5, -76.8], [-10.7, -77], [3.1, -77.1], [7.3, -77.7],
    [9.9, -77.2], [21, -77.3],
    [-2.5, -83.2], [0.6, -83.3], [3.7, -82.4],
  ] as Coord2[]),
  /** 路口小广场（内部巷与 -64.5 支路交汇处，圆铺装 + 中心树）：居住
   *  街区的入户广场。 */
  plazaSpots: Object.freeze([
    [-19, -64.5], [15, -64.5],
  ] as Coord2[]),
  /** 作品街区（博物馆区）：两个大街坊的整片院落铺装（landscape 层），
   *  地标、树阵、长椅都落在其上——连续的城市肌理而非孤立垫层。 */
  landmarkBlocks: Object.freeze([
    [-33.5, -44.5, -1.4, -54.5], [1.4, -44.5, 33.5, -54.5],
    [-33.5, -54.5, -1.4, -64.5], [1.4, -54.5, 33.5, -64.5],
  ] as RoadSegment4[]),
  /** 绿篱边界（x1,z1,x2,z2）：坊内院落与街道/公园的软性分界。 */
  hedgeRuns: Object.freeze([
    [-30.6, -70.8, -20.3, -70.8],
    [5.2, -70.8, 13.7, -70.8],
    [22, -69, 22, -77],
  ] as RoadSegment4[]),
  /** 院落生活道具（x, z, kind）：kind ∈ bin | mailbox | planter | bikeRack |
   *  clothesline | garden | sandpit | swing | tap——宅前与院内的日常。 */
  yardProps: Object.freeze([
    // 西坊 band A（-64.5 与 -74 街之间）院落
    [-26.5, -69.4, 'garden'], [-24.6, -69.2, 'garden'], [-22.7, -69.5, 'garden'],
    [-19.5, -69.3, 'clothesline'], [-16.1, -68.5, 'bin'], [-29.6, -68.6, 'bin'],
    [-22.8, -69.6, 'tree'],
    // 东坊 band A 院落
    [4.9, -68.4, 'bin'], [18.4, -68.6, 'bin'], [7, -69.1, 'clothesline'],
    [12.4, -69.3, 'garden'],
    // 西坊 band B 社区菜园（斜巷西侧）
    [-24.8, -74.2, 'garden'], [-23.4, -74, 'garden'], [-25.9, -73.8, 'garden'],
    [-26.5, -74.4, 'tap'], [-22.2, -74.6, 'bench'], [-15.9, -73.4, 'tree'],
    // 东坊 band B 小游园（斜巷东侧）
    [8.2, -74.3, 'sandpit'], [10.4, -74.5, 'swing'], [12.2, -74.2, 'bench'],
    [13.5, -74.9, 'tree'], [11.4, -72.7, 'bin'],
    // 中央大道轴心带与 band C
    [-2, -75.2, 'tree'], [-7.9, -78.6, 'tree'],
    [-14, -72.9, 'planter'], [-6, -68.3, 'mailbox'],
    [-9.6, -65.5, 'mailbox'], [9.5, -65.5, 'mailbox'],
    [-9.9, -63.7, 'planter'], [14.1, -63.7, 'planter'],
  ] as Array<[number, number, string]>),
  /** 北城路灯（沿中央大道 + 民居街 + 公园 + 东西巷 + 斜巷）。 */
  lampPositions: Object.freeze([
    [1.5, -44.5], [-1.5, -49.5], [1.5, -54.5], [-1.5, -59.5], [1.5, -64.5],
    [-1.5, -69.5], [1.5, -74.5], [-1.5, -79],
    [-30, -75.4], [-9, -75.4], [6, -75.4], [15, -75.4],
    [24, -75], [31, -78.9], [33, -82.5],
    [-32.6, -44.5], [32.6, -44.5], [-32.6, -54.5], [32.6, -54.5],
    [-32.6, -64.5], [32.6, -64.5], [-26, -75.4], [19, -75.4],
    [-17.5, -70.3], [17.7, -70.3],
  ] as Coord2[]),
  /** 街景小屋（不可认领的装饰住宅）：与可认领民居混排补足街道门面。
   *  朝向规则与真实住区一致——墙线平行街道、门朝最近的横街（无旋转
   *  抖动）；北城门两栋朝向中央大道。第三列为 rotY。 */
  sceneryHouses: Object.freeze([
    // band A（z≈-67.5，门朝南侧 -64.5 街）
    [-10.3, -67.5, 0], [20.8, -67.5, 0],
    // band B（z≈-71.4，门朝北侧 -74 街）
    [-27.4, -71.6, 180], [-11.8, -71.3, 180], [-8.4, -71.3, 180], [-5, -71.2, 180],
    [5.2, -71.1, 180],
    // band C（z≈-77.4，门朝北侧 -80 街）
    [-31.4, -77.8, 180], [-20.3, -77.4, 180], [-13.4, -77.5, 180], [-6.5, -77.6, 180],
    [-3.8, -77.1, 180], [14.2, -77.8, 180], [16.8, -77.3, 180],
    // band D（z≈-83，门朝南侧 -80 街）
    [-5.8, -83, 0], [18, -83, 0], [21.2, -83.2, 0],
    // 北城门两侧入口对景（门朝中央大道）
    [-4.6, -42.4, 90], [4.6, -42.4, -90],
  ] as Array<[number, number, number]>),
  /** 行道树（中央大道 + 支路 + 内部巷 + 广场中心树）。 */
  streetTrees: Object.freeze([
    [-3.6, -42.5], [3.6, -46.5], [-3.6, -51.5], [3.6, -57.5], [-3.6, -62.5], [3.6, -68.5],
    [-3.6, -76.5], [3.6, -74.5],
    [-19, -56.5], [-9.5, -56.5], [8.5, -56.5], [21.5, -56.5],
    [-24, -62.8], [-12.5, -62.8], [7.5, -62.8], [22, -62.8],
    [-20, -46.5], [-9.5, -46.5], [10, -46.5], [29.5, -46.5],
    [-9, -67.5], [-24, -67.5], [12.4, -68.2],
    // 内部巷两侧的庭荫树（x=±… 巷旁 1.1）
    [-20.1, -68.5], [-20.1, -72], [-17.9, -70.2],
    [13.9, -68.5], [13.9, -72], [16.1, -70.2],
    [-19, -64.5], [15, -64.5],
  ] as Coord2[]),
  /** 星语公园树阵（x, z）。 */
  parkTrees: Object.freeze([
    [25, -71], [29, -72], [33, -73], [26, -76], [31, -77], [25, -81], [30, -83], [34, -83],
  ] as Coord2[]),
  /** 星语公园长椅（x, z, 朝向 rotY）。 */
  parkBenches: Object.freeze([
    [26.5, -78.2, Math.PI], [31.5, -81.9, 0],
  ] as Array<[number, number, number]>),
  /** 北城门（中央大道与环城步道交汇处的石柱门，宣示城区边界）。 */
  gate: Object.freeze({ x: 0, z: -40.8 }),
  /** 中央大道与横街交叉口的斑马线（z 坐标）。 */
  crosswalkZs: Object.freeze([-44.5, -54.5, -64.5, -74] as readonly number[]),
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
