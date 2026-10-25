// 年份群岛跨海交通（T4，设计 docs/year-towns-design.md §5）——镇级交通数据
// 与纯数学的唯一事实源：星门大桥走线/纵断面、10 座泊位站、群岛环线折线、
// 弧长参数化与乘车路由。渲染（rendering/terrain/yearTownTransit.ts）、高度场
// （heightfield/transitField.ts）、导航接线（roadNavigation）与海图页（mapController）
// 全部从这里取值，永不各写一份（towns.ts 同款约定）。
//
// 本文件保持纯 TS（不 import three / rendering）；站牌交互 ID 注册在
// gameplay/world/sceneInteractions.ts（TRANSIT_STATION_IDS，两表一致性启动即校验）。
import { TRANSIT_STATION_IDS, type TransitStationId } from '../../../gameplay/world/sceneInteractions';
import { YEAR_TOWNS, type YearTownSpec } from './towns';

// ── 通用折线数学（弧长参数化；走廊投影、梁体走线、车辆寻位共用）────────────

export interface PolylineNode {
  readonly x: number;
  readonly z: number;
}

export interface PolylineTangentPoint {
  readonly x: number;
  readonly z: number;
  /** 单位切向（沿折线前进方向）。 */
  readonly tx: number;
  readonly tz: number;
}

export interface PolylineProjection {
  /** 采样点到折线（垂足）的距离。 */
  readonly dist: number;
  /** 垂足弧长（0..总长）。 */
  readonly s: number;
}

interface PolylineSegmentInfo {
  readonly ax: number;
  readonly az: number;
  readonly ux: number;
  readonly uz: number;
  readonly len: number;
  readonly acc: number; // 段起点累计弧长
}

function buildSegments(nodes: readonly PolylineNode[]): PolylineSegmentInfo[] {
  const segments: PolylineSegmentInfo[] = [];
  let acc = 0;
  for (let i = 0; i + 1 < nodes.length; i += 1) {
    const a = nodes[i]!;
    const b = nodes[i + 1]!;
    const dx = b.x - a.x;
    const dz = b.z - a.z;
    const len = Math.hypot(dx, dz);
    if (len < 1e-9) continue;
    segments.push({ ax: a.x, az: a.z, ux: dx / len, uz: dz / len, len, acc });
    acc += len;
  }
  return segments;
}

function projectOnSegments(segments: readonly PolylineSegmentInfo[], x: number, z: number): PolylineProjection {
  let bestDist = Infinity;
  let bestS = 0;
  for (const segment of segments) {
    const rel = Math.min(segment.len, Math.max(0, (x - segment.ax) * segment.ux + (z - segment.az) * segment.uz));
    const px = segment.ax + segment.ux * rel;
    const pz = segment.az + segment.uz * rel;
    const d = Math.hypot(x - px, z - pz);
    if (d < bestDist) {
      bestDist = d;
      bestS = segment.acc + rel;
    }
  }
  return { dist: bestDist, s: bestS };
}

/** 折线总长。 */
export function polylineLength(nodes: readonly PolylineNode[]): number {
  let total = 0;
  for (let i = 0; i + 1 < nodes.length; i += 1) {
    total += Math.hypot(nodes[i + 1]!.x - nodes[i]!.x, nodes[i + 1]!.z - nodes[i]!.z);
  }
  return total;
}

/** 折线上弧长 s 处的坐标与切向（s 越界取端点）。 */
export function polylinePointAt(nodes: readonly PolylineNode[], s: number): PolylineTangentPoint {
  const total = polylineLength(nodes);
  let remaining = Math.min(total, Math.max(0, s));
  for (let i = 0; i + 1 < nodes.length; i += 1) {
    const a = nodes[i]!;
    const b = nodes[i + 1]!;
    const dx = b.x - a.x;
    const dz = b.z - a.z;
    const len = Math.hypot(dx, dz);
    if (remaining <= len || i + 2 === nodes.length) {
      const t = len < 1e-9 ? 0 : Math.min(1, remaining / len);
      const inv = len < 1e-9 ? 0 : 1 / len;
      return { x: a.x + dx * t, z: a.z + dz * t, tx: dx * inv, tz: dz * inv };
    }
    remaining -= len;
  }
  const last = nodes[nodes.length - 1] ?? { x: 0, z: 0 };
  const prev = nodes[Math.max(0, nodes.length - 2)] ?? last;
  const dx = last.x - prev.x;
  const dz = last.z - prev.z;
  const len = Math.hypot(dx, dz);
  const inv = len < 1e-9 ? 0 : 1 / len;
  return { x: last.x, z: last.z, tx: dx * inv, tz: dz * inv };
}

function smoothStep01(t: number): number {
  const c = Math.min(1, Math.max(0, t));
  return c * c * (3 - 2 * c);
}

// ── 星门大桥（主城 ↔ 起源村，设计 §5.1）────────────────────────────────────

/** 桥面走廊中心线折线（B1..B5 + 北广场端点；星门站 (36,101) 在首段上）。 */
export const BRIDGE_WALK_NODES: readonly PolylineNode[] = [
  { x: 34, z: 98 }, // B1 自南步道 S4 观景平台 (34,96) 南缘出发
  { x: 63, z: 120.5 }, // B2 城南草甸东南裙坡
  { x: 92, z: 143 }, // B3 入海前最后陆点
  { x: 121, z: 165.5 }, // B4 海上主跨
  { x: 150, z: 188 }, // B5 落起源村北滩
  { x: 150, z: 196 }, // 起源村·桥站北广场
];

/** 桥面半宽（桥面宽 4.2 = 中央电车轨 1.8 + 两侧步道各 1.2，设计 §5.1）。 */
export const BRIDGE_CORRIDOR_HALF = 2.1;
/** 走廊两侧融合坡宽（与步道切槽同口径 4.5，设计 §5.1）。 */
export const BRIDGE_CORRIDOR_BLEND = 4.5;
/** 陆海分界 z（z≥145 为恒海区，无 farGround 网格，桥面 mesh 接管视觉）。 */
export const BRIDGE_SEA_Z = 145;

const BRIDGE_Y_S4 = 1.8;
const BRIDGE_Y_CROWN = 3.2;
const BRIDGE_Y_ISLAND = 1.0;
/** 冠段 z 区间（z 112..150，设计 §5.1）。 */
const BRIDGE_CROWN_Z0 = 112;
const BRIDGE_CROWN_Z1 = 150;
/** 落台 z（z≥193 恒台面高，与起源村 topY=1.0 无缝）。 */
const BRIDGE_ISLAND_Z = 193;

/**
 * 桥面纵断面（走线各处 z 单调递增，以 z 为参数；设计 §5.1：
 * y 1.8（S4 端）→ 3.2（冠，z 112..150）→ 1.0（岛台））。
 */
export function bridgeDeckProfileY(z: number): number {
  if (z <= 98) return BRIDGE_Y_S4;
  if (z >= BRIDGE_ISLAND_Z) return BRIDGE_Y_ISLAND;
  if (z < BRIDGE_CROWN_Z0) {
    return BRIDGE_Y_S4 + (BRIDGE_Y_CROWN - BRIDGE_Y_S4) * smoothStep01((z - 98) / (BRIDGE_CROWN_Z0 - 98));
  }
  if (z <= BRIDGE_CROWN_Z1) return BRIDGE_Y_CROWN;
  return BRIDGE_Y_CROWN + (BRIDGE_Y_ISLAND - BRIDGE_Y_CROWN) * smoothStep01((z - BRIDGE_CROWN_Z1) / (BRIDGE_ISLAND_Z - BRIDGE_CROWN_Z1));
}

const BRIDGE_SEGMENTS = buildSegments(BRIDGE_WALK_NODES);
export const BRIDGE_LENGTH = polylineLength(BRIDGE_WALK_NODES);

/** 桥走廊投影（垂距 + 弧长）；高度场/渲染/审计共用。 */
export function projectOnBridge(x: number, z: number): PolylineProjection {
  return projectOnSegments(BRIDGE_SEGMENTS, x, z);
}

/** 桥面中心线弧长 s 处的坐标与切向（电车巡游/桥面 mesh 走线共用）。 */
export function bridgePointAt(s: number): PolylineTangentPoint {
  return polylinePointAt(BRIDGE_WALK_NODES, s);
}

/** 双塔位（装饰塔，高 14，斜拉索造型；设计 §5.1）。 */
export const BRIDGE_TOWERS: readonly { x: number; z: number }[] = [
  { x: 107, z: 154 },
  { x: 136, z: 177 },
];

// ── 群岛环线（磁悬浮，设计 §5.2）───────────────────────────────────────────

/**
 * 环线沿两座城市海岸外缘绕行，并以短支段接入七座年份站。各片区站点
 * 直接作为航点，保证上车点、轨道梁、海图圆点三者同坐标；站间走线避开
 * 城市街廓，避免长弦从建筑群中穿过。
 */
export const RING_LOOP_NODES: readonly PolylineNode[] = [
  // 起源村·环线站（闭环起点）
  { x: 150, z: 197 },
  { x: 150, z: 212 },
  // 起源村 → 旧港城东岸
  { x: 132, z: 222 },
  { x: 104, z: 244 },
  { x: 78, z: 260 },
  // 旧港外环：东站 → 南岸 → 西站 → 北岸 → 东站
  { x: 72, z: 282 },
  { x: 65.9, z: 294.79 }, // 回响镇站（2023）
  { x: 72, z: 312 },
  { x: 20, z: 326 },
  { x: -32, z: 312 },
  { x: -25.9, z: 294.79 }, // 盛夏镇站（2022）
  { x: -34, z: 282 },
  { x: -36, z: 252 },
  { x: -25.9, z: 229.21 }, // 启明镇站（2020）
  { x: -32, z: 210 },
  { x: 20, z: 198 },
  { x: 72, z: 210 },
  { x: 65.9, z: 229.21 }, // 潮声镇站（2021）
  // 旧港 → 星港海面联络
  { x: 72, z: 192 },
  { x: 40, z: 180 },
  { x: -120, z: 190 },
  // 星港外环：北站 → 西站 → 南岸 → 东站
  { x: -180, z: 190 },
  { x: -215, z: 208 }, // 微光镇站（2024）
  { x: -250, z: 200 },
  { x: -274, z: 238 },
  { x: -270, z: 270 },
  { x: -257.66, z: 282.66 }, // 长风镇站（2025）
  { x: -270, z: 302 },
  { x: -245, z: 320 },
  { x: -185, z: 320 },
  { x: -160, z: 302 },
  { x: -172.34, z: 282.66 }, // 星港站（2026）
  { x: -160, z: 252 },
  { x: -166, z: 218 },
  // 回程：绕开两城与起源村
  { x: -120, z: 172 },
  { x: 40, z: 170 },
  { x: 110, z: 168 },
  { x: 140, z: 180 },
];

const RING_CLOSED_NODES: readonly PolylineNode[] = [...RING_LOOP_NODES, RING_LOOP_NODES[0]!];
const RING_SEGMENTS = buildSegments(RING_CLOSED_NODES);
export const RING_LENGTH = polylineLength(RING_CLOSED_NODES);

/** 环线上弧长 s（取模闭环）处的坐标与切向（磁悬车巡游/梁体 mesh 共用）。 */
export function ringPointAt(s: number): PolylineTangentPoint {
  const wrapped = ((s % RING_LENGTH) + RING_LENGTH) % RING_LENGTH;
  return polylinePointAt(RING_CLOSED_NODES, wrapped);
}

/** 磁悬梁开海段净空高（水上 +2.2，设计 §5.2）。 */
export const RING_BEAM_SEA_Y = 2.2;
/** 过站段梁高 = 台面 + 0.8（设计 §5.2）。 */
export const RING_BEAM_STATION_LIFT = 0.8;
/** 站周渐变带（距站 6..16u 由站高渐变为海面净空）。 */
const RING_STATION_BLEND_NEAR = 6;
const RING_STATION_BLEND_FAR = 16;

// ── 站点表（10 座泊位，设计 §5.2 站点表）────────────────────────────────────

/** 月台向岛心（或路侧）的退让距离：轨道梁贴泊位、月台在梁侧。 */
export const STATION_PLATFORM_STANDOFF = 2.2;
/** 月台场地半径（含栈桥，走廊场语义同桥面；设计 §5.2 泊位规则）。 */
export const STATION_PAD_RADIUS = 2.6;
/** 月台场边缘融合宽。 */
export const STATION_PAD_BLEND = 1.2;

export interface TransitStationSpec {
  readonly id: TransitStationId;
  /** 站名（站牌/面板标题口径）。 */
  readonly name: string;
  /** 所属线路：星门线（干线电车）或群岛环线（磁悬浮）。 */
  readonly line: 'stargate' | 'ring';
  /** 泊位坐标（轨道上的站点航点）。 */
  readonly x: number;
  readonly z: number;
  /** 月台基准面 y（镇站=台面高；星门站=桥头桥面高）。 */
  readonly baseY: number;
  /** 月台中心（泊位向岛心/路侧退让 STATION_PLATFORM_STANDOFF）。 */
  readonly platformX: number;
  readonly platformZ: number;
  /** 关联镇 id（桥站/环线站同属起源村枢纽；星门站属主城界面）。 */
  readonly townId: string;
  /** 站牌面板的镇作品数摘要（源 data/blackhole_by_year.json；T5 生成物接管）。 */
  readonly works: number;
}

interface StationSeed {
  readonly id: TransitStationId;
  readonly name: string;
  readonly line: 'stargate' | 'ring';
  readonly x: number;
  readonly z: number;
  readonly townId: string;
  /** 月台退让方向（相对泊位的单位向量；镇站=指向岛心）。 */
  readonly towardX: number;
  readonly towardZ: number;
}

/** 镇作品数（站牌面板摘要；同 data/blackhole_by_year.json 汇总，T5 生成物接管）。 */
export const TOWN_WORKS_COUNTS: Readonly<Record<string, number>> = {
  'island-2019': 2,
  'island-2020': 75,
  'island-2021': 147,
  'island-2022': 217,
  'island-2023': 202,
  'island-2024': 170,
  'island-2025': 128,
  'island-2026': 59,
};

function townById(id: string): YearTownSpec {
  const town = YEAR_TOWNS.find((entry) => entry.id === id);
  if (!town) throw new Error(`transit: unknown town id ${id}`);
  return town;
}

const STATION_SEEDS: readonly StationSeed[] = [
  {
    id: 'station-stargate',
    name: '星门站',
    line: 'stargate',
    x: 36,
    z: 101,
    townId: 'island-2019',
    // 桥头广场：月台在走廊东侧（首段切向 (14,20)/24.4 的右侧法向）。
    towardX: 0.82,
    towardZ: -0.57,
  },
  {
    id: 'station-2019-bridge',
    name: '启源站·桥站',
    line: 'stargate',
    x: 150,
    z: 196,
    townId: 'island-2019',
    towardX: 0,
    towardZ: 1,
  },
  {
    id: 'station-2019-ring',
    name: '启源站·环线站',
    line: 'ring',
    x: 150,
    z: 203,
    townId: 'island-2019',
    towardX: 0,
    towardZ: -1,
  },
  { id: 'station-2020', name: '启明镇站', line: 'ring', x: -25.9, z: 229.21, townId: 'island-2020', towardX: -0.814, towardZ: -0.581 },
  { id: 'station-2021', name: '潮声镇站', line: 'ring', x: 65.9, z: 229.21, townId: 'island-2021', towardX: 0.814, towardZ: -0.581 },
  { id: 'station-2022', name: '盛夏镇站', line: 'ring', x: -25.9, z: 294.79, townId: 'island-2022', towardX: -0.814, towardZ: 0.581 },
  { id: 'station-2023', name: '回响镇站', line: 'ring', x: 65.9, z: 294.79, townId: 'island-2023', towardX: 0.814, towardZ: 0.581 },
  { id: 'station-2024', name: '微光镇站', line: 'ring', x: -215, z: 208, townId: 'island-2024', towardX: 0, towardZ: -1 },
  { id: 'station-2025', name: '长风镇站', line: 'ring', x: -257.66, z: 282.66, townId: 'island-2025', towardX: -0.848, towardZ: 0.53 },
  { id: 'station-2026', name: '星港站', line: 'ring', x: -172.34, z: 282.66, townId: 'island-2026', towardX: 0.848, towardZ: 0.53 },
];

export const TRANSIT_STATIONS: readonly TransitStationSpec[] = STATION_SEEDS.map((seed) => {
  const town = townById(seed.townId);
  const baseY = seed.id === 'station-stargate' ? bridgeDeckProfileY(seed.z) : townById(seed.townId).topY;
  return {
    id: seed.id,
    name: seed.name,
    line: seed.line,
    x: seed.x,
    z: seed.z,
    baseY,
    platformX: seed.x + seed.towardX * STATION_PLATFORM_STANDOFF,
    platformZ: seed.z + seed.towardZ * STATION_PLATFORM_STANDOFF,
    townId: seed.townId,
    works: TOWN_WORKS_COUNTS[seed.townId] ?? 0,
  };
});

export function stationById(id: string): TransitStationSpec | undefined {
  return TRANSIT_STATIONS.find((station) => station.id === id);
}

/** 站牌交互 ID 与站点表一致性（模块加载即校验，防两表漂移）。 */
for (const id of TRANSIT_STATION_IDS) {
  if (!stationById(id)) throw new Error(`transit: station table missing id ${id}`);
}
for (const station of TRANSIT_STATIONS) {
  if (!(TRANSIT_STATION_IDS as readonly string[]).includes(station.id)) {
    throw new Error(`transit: station ${station.id} not registered in TRANSIT_STATION_IDS`);
  }
}

// ── 磁悬梁高与巡游速度（泊位距离场；梁 mesh、磁悬车、乘车路由共用）──────────

const RING_BERTHS: readonly { x: number; z: number; stationY: number }[] = TRANSIT_STATIONS
  .filter((station) => station.line === 'ring')
  .map((station) => ({ x: station.x, z: station.z, stationY: station.baseY + RING_BEAM_STATION_LIFT }));

function nearestRingBerth(x: number, z: number): { dist: number; stationY: number } {
  let bestDist = Infinity;
  let bestY = RING_BEAM_SEA_Y;
  for (const berth of RING_BERTHS) {
    const d = Math.hypot(x - berth.x, z - berth.z);
    if (d < bestDist) {
      bestDist = d;
      bestY = berth.stationY;
    }
  }
  return { dist: bestDist, stationY: bestY };
}

/**
 * 磁悬梁顶面高（设计 §5.2：过站段台面+0.8，开海段 +2.2；站周 6..16u 渐变）。
 * 梁体 mesh、磁悬车寻位与乘车路由共用——图与动画永远一致。
 */
export function ringBeamYAt(x: number, z: number): number {
  const { dist, stationY } = nearestRingBerth(x, z);
  const t = smoothStep01((dist - RING_STATION_BLEND_NEAR) / (RING_STATION_BLEND_FAR - RING_STATION_BLEND_NEAR));
  return stationY + (RING_BEAM_SEA_Y - stationY) * t;
}

/** 环线站进站减速因子（近镇减速过站：距站 ≤4u 恒 0.35，≥14u 全速）。 */
export function ringStationSpeedFactor(x: number, z: number): number {
  const { dist } = nearestRingBerth(x, z);
  return 0.35 + 0.65 * smoothStep01((dist - 4) / 10);
}

// ── 路网接线（roadNavigation 消费；节点表与高度场同源常量，图=地形）──────────

/**
 * 桥节点 + 起源村枢纽街段（B 链挂 S4 观景平台；桥站→环线站为村主街，
 * 设计 §5.1「B1..B5 挂接 S4」+ §5.2 枢纽两泊位间为主街）。
 */
export function buildTransitRoadGraph(): {
  roadNodes: [number, number][];
  roadSegments: [number, number, number, number][];
} {
  const nodes: [number, number][] = [
    [34, 96], // S4 观景平台（与南步道端点重合，桥链由此挂接）
    ...BRIDGE_WALK_NODES.map((node) => [node.x, node.z] as [number, number]),
    [150, 203], // 起源村·环线站（村主街端点）
  ];
  const segments: [number, number, number, number][] = [];
  for (let i = 0; i + 1 < nodes.length; i += 1) {
    segments.push([nodes[i]![0]!, nodes[i]![1]!, nodes[i + 1]![0]!, nodes[i + 1]![1]!]);
  }
  return { roadNodes: nodes, roadSegments: segments };
}

// ── 乘车路由（站牌面板选站 → 飞掠折线；跨线行程在起源村枢纽衔接为一镜）────

export interface TransitRoutePoint {
  readonly x: number;
  readonly z: number;
  readonly y: number;
  /** 起点累计弧长。 */
  readonly s: number;
}

export interface TransitRoute {
  readonly fromId: TransitStationId;
  readonly toId: TransitStationId;
  /** 飞掠折线（含 y 与弧长；桥段=桥面、枢纽街=缓升、环线段=磁悬梁高）。 */
  readonly points: readonly TransitRoutePoint[];
  readonly length: number;
  /** 换乘点弧长（跨线行程枢纽处：桥段乘电车、环线段乘磁悬浮；纯线行程 null）。 */
  readonly switchS: number | null;
}

/** 起源村枢纽街（桥站 (96,197) ↔ 环线站 (96,212)，村主街）。 */
export const HUB_CONNECTOR_NODES: readonly PolylineNode[] = [
  { x: 150, z: 196 },
  { x: 150, z: 203 },
];

const ROUTE_SAMPLE_STEP = 2; // 飞掠折线采样步长

function samplePiece(nodes: readonly PolylineNode[], reversed: boolean, yAt: (x: number, z: number) => number): TransitRoutePoint[] {
  const ordered = reversed ? [...nodes].reverse() : nodes;
  const total = polylineLength(ordered);
  const steps = Math.max(1, Math.ceil(total / ROUTE_SAMPLE_STEP));
  const piece: TransitRoutePoint[] = [];
  for (let i = 0; i <= steps; i += 1) {
    const s = (total * i) / steps;
    const point = polylinePointAt(ordered, s);
    piece.push({ x: point.x, z: point.z, y: yAt(point.x, point.z), s: 0 });
  }
  return piece;
}

/** 桥段折线（星门站 s=0 ↔ 桥站 s=BRIDGE_LENGTH，按方向采样；y=桥面纵断+轨高）。 */
function bridgePiece(reversed: boolean): TransitRoutePoint[] {
  return samplePiece(BRIDGE_WALK_NODES, reversed, (_x, z) => bridgeDeckProfileY(z));
}

/** 枢纽街折线（y 自桥端 1.0 缓升至环线站梁高，换乘视作站台缓升）。 */
function hubPiece(fromRing: boolean): TransitRoutePoint[] {
  // 枢纽街端点取自实际节点（桥站 ↔ 环线站），按弧长比例线性爬升，
  // 不再硬编码坐标与分母（岛屿坐标调整后仍保持纵断面连续）。
  const startNode = HUB_CONNECTOR_NODES[0]!;
  const endNode = HUB_CONNECTOR_NODES[HUB_CONNECTOR_NODES.length - 1]!;
  const span = Math.hypot(endNode.x - startNode.x, endNode.z - startNode.z) || 1;
  const bridgeEndY = bridgeDeckProfileY(startNode.z);
  const ringStationY = (stationById('station-2019-ring')?.baseY ?? 1) + RING_BEAM_STATION_LIFT;
  return samplePiece(HUB_CONNECTOR_NODES, fromRing, (x, z) => {
    const t = Math.min(1, Math.hypot(x - startNode.x, z - startNode.z) / span);
    return bridgeEndY + (ringStationY - bridgeEndY) * t;
  });
}

/** 站点在环线上的弧长（泊位=环线航点，垂足即泊位本身）。 */
function ringArcOfStation(station: TransitStationSpec): number {
  return projectOnSegments(RING_SEGMENTS, station.x, station.z).s;
}

/** 环线弧（起点→终点泊位，闭环顺/逆时针取短弧）。 */
function ringArcBetween(from: TransitStationSpec, to: TransitStationSpec): TransitRoutePoint[] {
  const fromS = ringArcOfStation(from);
  const toS = ringArcOfStation(to);
  const forward = ((toS - fromS) % RING_LENGTH + RING_LENGTH) % RING_LENGTH;
  const direction = forward <= RING_LENGTH - forward ? 1 : -1;
  const arc = Math.min(forward, RING_LENGTH - forward);
  const steps = Math.max(2, Math.ceil(arc / ROUTE_SAMPLE_STEP));
  const piece: TransitRoutePoint[] = [];
  for (let i = 0; i <= steps; i += 1) {
    const s = fromS + (direction * arc * i) / steps;
    const point = ringPointAt(s);
    piece.push({ x: point.x, z: point.z, y: ringBeamYAt(point.x, point.z), s: 0 });
  }
  return piece;
}

/**
 * 乘车路由（设计 §5.2 乘车交互）：星门线两端 ↔ 环线各站自动在起源村枢纽
 * 衔接为一次镜头；环线内部两站取闭环较短弧。未知/同站返回 null。
 */
export function buildTransitRoute(fromId: string, toId: string): TransitRoute | null {
  const from = stationById(fromId);
  const to = stationById(toId);
  if (!from || !to || from.id === to.id) return null;

  const hubRing = stationById('station-2019-ring')!;
  const hubBridge = stationById('station-2019-bridge')!;
  const pieces: TransitRoutePoint[][] = [];
  let switchS: number | null = null;

  const stargateIds = new Set(['station-stargate', 'station-2019-bridge']);
  const fromOnStargate = stargateIds.has(from.id);
  const toOnStargate = stargateIds.has(to.id);

  if (fromOnStargate && toOnStargate) {
    // 纯星门线：桥面直达（星门站 ↔ 桥站）。
    pieces.push(bridgePiece(from.id === 'station-2019-bridge'));
  } else if (fromOnStargate) {
    // 星门线 → 环线：桥站出发只走枢纽街（桥站已在枢纽南端）；
    // 星门站出发才先过桥。二者都不要重复采样桥段，否则起点瞬移。
    if (from.id === 'station-stargate') pieces.push(bridgePiece(false));
    pieces.push(hubPiece(false));
    pieces.push(ringArcBetween(hubRing, to));
    switchS = 0; // 占位，拼接后按累计弧长落位（下方统一计算）。
  } else if (toOnStargate) {
    // 环线 → 星门线：环线弧 + 枢纽街 + 桥段。
    pieces.push(ringArcBetween(from, hubRing));
    pieces.push(hubPiece(true));
    if (to.id === 'station-stargate') pieces.push(bridgePiece(true));
    switchS = 0; // 占位，拼接后按累计弧长落位（下方统一计算）。
  } else {
    // 纯环线行程。
    pieces.push(ringArcBetween(from, to));
  }

  // 拼接 + 重编累计弧长；switchS 落在「枢纽街中点」（含桥与环线两段的行程）。
  const points: TransitRoutePoint[] = [];
  let acc = 0;
  const pieceStarts: number[] = [];
  for (const piece of pieces) {
    pieceStarts.push(acc);
    for (let i = 0; i < piece.length; i += 1) {
      const point = piece[i]!;
      if (points.length > 0) {
        const prev = points[points.length - 1]!;
        if (i === 0) {
          // 段间首点与上一段末点重合（同坐标不同 y 时取本段 y，跳过重复）。
          if (Math.hypot(point.x - prev.x, point.z - prev.z) < 0.05) {
            points[points.length - 1] = { ...point, s: acc };
            continue;
          }
          acc += Math.hypot(point.x - prev.x, point.z - prev.z);
        } else {
          acc += Math.hypot(point.x - prev.x, point.z - prev.z);
        }
      }
      points.push({ ...point, s: acc });
    }
  }
  if (switchS !== null) {
    // 换乘点 = 枢纽街（跨线行程恒为第 2 段，index 1）的中点弧长。
    const hubStart = pieceStarts[1] ?? 0;
    const hubLen = pieces[1] ? polylinePointsLength(pieces[1]!) : 0;
    switchS = hubStart + hubLen / 2;
  }
  return { fromId: from.id, toId: to.id, points, length: acc, switchS };
}

function polylinePointsLength(points: readonly TransitRoutePoint[]): number {
  let total = 0;
  for (let i = 0; i + 1 < points.length; i += 1) {
    total += Math.hypot(points[i + 1]!.x - points[i]!.x, points[i + 1]!.z - points[i]!.z);
  }
  return total;
}

// ── 海图页投影 DTO（mapController 消费，T4 描线/站圆点）──────────────────────

export interface TransitMapStationDot {
  readonly id: string;
  readonly label: string;
  readonly x: number;
  readonly z: number;
}

export interface TransitMapOverlay {
  /** 9 个站圆点（乘车 UI 合并起源村两泊位 → 枢纽一点，设计 §5.2）。 */
  readonly stations: readonly TransitMapStationDot[];
  /** 环线闭环折线（首尾闭合）。 */
  readonly ringLoop: readonly { x: number; z: number }[];
  /** 星门线折线（=大桥走线）。 */
  readonly stargateLine: readonly { x: number; z: number }[];
}

export const TRANSIT_MAP_OVERLAY: TransitMapOverlay = {
  stations: [
    { id: 'station-stargate', label: '星门站', x: 36, z: 101 },
    { id: 'station-2019', label: '起源村枢纽', x: 150, z: 200 },
    ...TRANSIT_STATIONS
      .filter((station) => station.line === 'ring' && station.id !== 'station-2019-ring')
      .map((station) => ({ id: station.id, label: station.name, x: station.x, z: station.z })),
  ],
  ringLoop: RING_CLOSED_NODES,
  stargateLine: BRIDGE_WALK_NODES,
};
