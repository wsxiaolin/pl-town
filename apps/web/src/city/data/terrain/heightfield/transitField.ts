// T4 交通件高度场（设计 §5.1/§5.2）：星门大桥走廊（正向填方）+ 各镇月台
// 场地（台面高桩基平台）——与步道切槽同目录、同审计模式的纯计算模块。
//
// 契约：
// - 桥走廊 = 南步道「切槽」的正向版本：走廊内床高 = 桥面纵断面
//   （bridgeDeckProfileY），两侧 BRIDGE_CORRIDOR_BLEND 融合坡回自然场；
//   farGround 采样同一函数 → 陆上段路堤自然长在地上；海上段（z≥145 恒海
//   区）无陆网格，同一高度场供导航赋 y（设计 §5.1）。
// - 月台场：各站月台 + 栈桥以台面高（stargate 站=桥面高）盖在滩环/广场上，
//   场地半径 STATION_PAD_RADIUS、边缘 STATION_PAD_BLEND 融合（设计 §5.2
//   「走廊场语义同桥面」）。
// - 恒海/岛域判定不在本文件：worldReliefAt 先岛短路后桥/台（桥末段横穿
//   起源村北滩、月台盖滩环，都属「交通件上盖岛面」）。
//
// 消费方向：heightfield/worldReliefField（聚合）、navigation/roadNavigation
// （桥节点 groundPoint）、rendering/terrain/yearTownTransit（桥面 mesh 底高）、
// rendering/terrain/cityGround（草甸装饰剔除 bridgeCorridorWeight）与审计单测。
import {
  BRIDGE_CORRIDOR_BLEND,
  BRIDGE_CORRIDOR_HALF,
  BRIDGE_WALK_NODES,
  projectOnBridge,
  bridgeDeckProfileY,
  STATION_PAD_BLEND,
  STATION_PAD_RADIUS,
  TRANSIT_STATIONS,
} from '../../year-towns/transit';

/** 月台场种子（起点=月台中心，基准面=站 baseY；半径含栈桥）。 */
const STATION_PADS: readonly { x: number; z: number; baseY: number; r: number }[] = TRANSIT_STATIONS
  .filter((station) => station.id !== 'station-2019-bridge') // 桥站在起源村台面内（ρ=5<plateauR），无需上盖。
  .map((station) => ({
    x: station.platformX,
    z: station.platformZ,
    baseY: station.baseY,
    r: STATION_PAD_RADIUS,
  }));

/** 包围盒快筛（桥走廊 + 月台场的并集 bbox，域外零成本早退）。 */
const BBOX = (() => {
  let minX = Infinity;
  let maxX = -Infinity;
  let minZ = Infinity;
  let maxZ = -Infinity;
  for (const node of BRIDGE_WALK_NODES) {
    minX = Math.min(minX, node.x);
    maxX = Math.max(maxX, node.x);
    minZ = Math.min(minZ, node.z);
    maxZ = Math.max(maxZ, node.z);
  }
  for (const pad of STATION_PADS) {
    minX = Math.min(minX, pad.x - pad.r - STATION_PAD_BLEND);
    maxX = Math.max(maxX, pad.x + pad.r + STATION_PAD_BLEND);
    minZ = Math.min(minZ, pad.z - pad.r - STATION_PAD_BLEND);
    maxZ = Math.max(maxZ, pad.z + pad.r + STATION_PAD_BLEND);
  }
  return { minX: minX - BRIDGE_CORRIDOR_BLEND, maxX: maxX + BRIDGE_CORRIDOR_BLEND, minZ: minZ - BRIDGE_CORRIDOR_BLEND, maxZ: maxZ + BRIDGE_CORRIDOR_BLEND };
})();

function smoothStep01(t: number): number {
  const c = Math.min(1, Math.max(0, t));
  return c * c * (3 - 2 * c);
}

/**
 * 桥走廊权重（0..1）：走廊内为 1，融合坡内平滑衰减，域外 0。
 * 供草甸装饰剔除（cityGround 消费，复用 trailCutAt 的消费模式）与审计。
 */
export function bridgeCorridorWeight(x: number, z: number): number {
  if (x < BBOX.minX || x > BBOX.maxX || z < BBOX.minZ || z > BBOX.maxZ) return 0;
  const { dist } = projectOnBridge(x, z);
  return 1 - smoothStep01((dist - BRIDGE_CORRIDOR_HALF) / BRIDGE_CORRIDOR_BLEND);
}

/**
 * 桥面走廊混合高（正向填方）：走廊内=桥面纵断面，融合坡回自然场；
 * 走廊域外返回 null（交还调用方）。natural = 调用方的底层场（岛面或
 * 自然聚合场——海上段自然≈海床/0，走廊权重 1 处直接钉桥面）。
 */
export function bridgeDeckBlendAt(x: number, z: number, natural: number): number | null {
  const weight = bridgeCorridorWeight(x, z);
  if (weight <= 0) return null;
  const deck = bridgeDeckProfileY(z);
  return deck * weight + natural * (1 - weight);
}

/**
 * 月台场上盖高：月台中心 baseY、场地半径内恒平台、边缘融合回底层场；
 * 域外返回 null。与桥走廊叠加时桥优先（桥面是更长的连续结构面）。
 */
export function stationPadBlendAt(x: number, z: number, natural: number): number | null {
  if (x < BBOX.minX || x > BBOX.maxX || z < BBOX.minZ || z > BBOX.maxZ) return null;
  let best: number | null = null;
  for (const pad of STATION_PADS) {
    const outer = pad.r + STATION_PAD_BLEND;
    const dx = x - pad.x;
    const dz = z - pad.z;
    if (dx < -outer || dx > outer || dz < -outer || dz > outer) continue;
    const d = Math.hypot(dx, dz);
    if (d > outer) continue;
    const weight = 1 - smoothStep01((d - pad.r) / STATION_PAD_BLEND);
    if (weight <= 0) continue;
    const blended = pad.baseY * weight + natural * (1 - weight);
    if (best === null || blended > best) best = blended;
  }
  return best;
}
