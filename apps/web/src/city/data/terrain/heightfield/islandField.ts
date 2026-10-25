// 年份群岛岛台高度场（T3，设计 §6.2）——纯计算模块，无 Three.js。
// 径向剖面（每岛独立，确定性、无随机）：
//   半径内              台面平台（恒 topY + 地形起伏，语义同主城台地：镇区/寻路/
//                       相机目标都以 terrainHeight 取地面 y）
//   半径 → 滩环外缘     滩坡：topY → ISLAND_BEACH_TO（smoothstep，沙滩缓坡
//                       入水；可见沙滩带 = y > 0.06 的上段）
//   滩环外缘 → +SKIRT   水下裙：ISLAND_BEACH_TO → −0.7（裙底低于外海底面
//                       −0.4，水面拼接处被裙体遮住，同明澜屿做法）
//   足印外              null（交还自然场）
//
// 「半径」按方向取值：显式海岸线（IslandOutline）或径向谐波（IslandShapeMod）。
// plateauR / beachR 是该方向的基准半径，滩环宽恒为 beachR − plateauR。
// 离岸小屿（IslandSatellite）走同一条剖面，只是基准半径更小。
//
// 岛屿 mesh（rendering/terrain/archipelagoIsles.ts）按同一函数采样发射顶点，
// 图与地形永远一致（唯一采样器 DoD）；审计（worldTerrainAudit 'islands' 组）
// 与导航/玩家落点（playerController 每帧 cursor.y = terrainHeight）共用。
import {
  YEAR_ISLAND_SPECS,
  islandRadiusScaleAt,
  type IslandOutline,
  type IslandRidge,
  type IslandSatellite,
  type IslandShapeMod,
  type IslandTerrain,
} from '../../year-towns/towns';

/** 滩脚（滩坡终点，略低于水面 0.06，水线在滩环中段穿越）。 */
export const ISLAND_BEACH_TO = -0.2;
/** 水下裙底（低于外海底面 −0.4，底缘不可见）。 */
export const ISLAND_SKIRT_BOTTOM = -0.7;
/** 水下裙宽（滩环外缘再外伸的半径量）。 */
export const ISLAND_SKIRT_W = 3;

function smoothStep01(t: number): number {
  const c = Math.min(1, Math.max(0, t));
  return c * c * (3 - 2 * c);
}

/** 岛在某方向上的有效半径倍率（显式海岸线优先，否则谐波；正圆恒 1）。 */
function shapeScaleOf(
  island: { shape?: IslandShapeMod; outline?: IslandOutline; plateauR: number },
  dx: number,
  dz: number,
): number {
  return islandRadiusScaleAt(island, Math.atan2(dz, dx));
}

/**
 * 山脊抬升：沿控制点折线的距离场 × 高斯剖面。
 * 同一脊线上取最近段，脊顶恒定 height，两侧按 radius 衰减。
 */
function ridgeRiseAt(ridge: IslandRidge, dx: number, dz: number): number {
  let best = Infinity;
  for (let i = 0; i + 1 < ridge.nodes.length; i += 1) {
    const a = ridge.nodes[i]!;
    const b = ridge.nodes[i + 1]!;
    const ex = b.dx - a.dx;
    const ez = b.dz - a.dz;
    const len2 = ex * ex + ez * ez;
    const t = len2 <= 1e-9 ? 0 : Math.min(1, Math.max(0, ((dx - a.dx) * ex + (dz - a.dz) * ez) / len2));
    const px = a.dx + ex * t;
    const pz = a.dz + ez * t;
    best = Math.min(best, Math.hypot(dx - px, dz - pz));
  }
  const sigma2 = 2 * ridge.radius * ridge.radius;
  return ridge.height * Math.exp(-(best * best) / sigma2);
}

/** 点是否落在阶地多边形内（射线法）。 */
function insidePolygon(poly: readonly { dx: number; dz: number }[], dx: number, dz: number): boolean {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i, i += 1) {
    const a = poly[i]!;
    const b = poly[j]!;
    if ((a.dz > dz) !== (b.dz > dz) && dx < ((b.dx - a.dx) * (dz - a.dz)) / (b.dz - a.dz) + a.dx) {
      inside = !inside;
    }
  }
  return inside;
}

/** 点到阶地多边形的近似外距（用于边缘融合）。 */
function polygonOutsideDistance(poly: readonly { dx: number; dz: number }[], dx: number, dz: number): number {
  let best = Infinity;
  for (let i = 0; i < poly.length; i += 1) {
    const a = poly[i]!;
    const b = poly[(i + 1) % poly.length]!;
    const ex = b.dx - a.dx;
    const ez = b.dz - a.dz;
    const len2 = ex * ex + ez * ez;
    const t = len2 <= 1e-9 ? 0 : Math.min(1, Math.max(0, ((dx - a.dx) * ex + (dz - a.dz) * ez) / len2));
    best = Math.min(best, Math.hypot(dx - (a.dx + ex * t), dz - (a.dz + ez * t)));
  }
  return best;
}

/**
 * 台面内的地形抬升：山丘/山脊按高斯隆起叠加，城区阶地内压平到 0。
 * 返回相对 topY 的高差（≥0）。纯函数、确定性。
 */
function terrainRiseAt(terrain: IslandTerrain | undefined, dx: number, dz: number): number {
  if (!terrain) return 0;
  let rise = 0;
  for (const hill of terrain.hills ?? []) {
    const d2 = (dx - hill.dx) ** 2 + (dz - hill.dz) ** 2;
    const sigma2 = 2 * hill.radius * hill.radius;
    rise += hill.height * Math.exp(-d2 / sigma2);
  }
  for (const ridge of terrain.ridges ?? []) {
    rise += ridgeRiseAt(ridge, dx, dz);
  }
  if (rise <= 0) return 0;
  // 城区阶地：阶地内压平（rise → 0），边缘 blend 宽度内平滑过渡。
  let flatten = 0;
  for (const t of terrain.terraces ?? []) {
    let outside: number;
    if (t.polygon) {
      outside = insidePolygon(t.polygon, dx, dz) ? 0 : polygonOutsideDistance(t.polygon, dx, dz);
    } else {
      const ox = Math.max(Math.abs(dx - t.dx) - t.halfW, 0);
      const oz = Math.max(Math.abs(dz - t.dz) - t.halfD, 0);
      outside = Math.hypot(ox, oz);
    }
    const w = 1 - smoothStep01(outside / Math.max(1e-6, t.blend));
    flatten = Math.max(flatten, w);
  }
  return rise * (1 - flatten);
}

/** 单个台面的径向剖面（含台面/滩坡/水下裙），足印外返回 null。 */
function profileY(
  rho: number,
  scale: number,
  base: { plateauR: number; beachR: number; topY: number },
  rise: number,
): number | null {
  const plateau = base.plateauR * scale;
  const beach = base.beachR * scale;
  if (rho > beach + ISLAND_SKIRT_W) return null;
  if (rho <= plateau) return base.topY + rise;
  if (rho <= beach) {
    const t = smoothStep01((rho - plateau) / Math.max(1e-6, beach - plateau));
    return base.topY + (ISLAND_BEACH_TO - base.topY) * t;
  }
  const t = smoothStep01((rho - beach) / ISLAND_SKIRT_W);
  return ISLAND_BEACH_TO + (ISLAND_SKIRT_BOTTOM - ISLAND_BEACH_TO) * t;
}

/** 离岸小屿的径向剖面（无地形抬升，纯台面）。 */
function satelliteYAt(satellite: IslandSatellite, originX: number, originZ: number, x: number, z: number): number | null {
  const dx = x - (originX + satellite.dx);
  const dz = z - (originZ + satellite.dz);
  const maxR = satellite.radius + ISLAND_SKIRT_W;
  if (Math.abs(dx) > maxR || Math.abs(dz) > maxR) return null;
  const scale = satellite.shape
    ? islandRadiusScaleAt({ shape: satellite.shape, plateauR: satellite.radius }, Math.atan2(dz, dx))
    : 1;
  const beachR = satellite.radius * 1.18;
  return profileY(
    Math.hypot(dx, dz),
    scale,
    { plateauR: satellite.radius, beachR, topY: 0.85 },
    0,
  );
}

/**
 * 岛面高度（含台面/滩坡/水下裙）。足印外返回 null——调用方保留自然场值。
 * 2 城 + 启源站岛足印互不相交且全在恒海区，与草甸/河谷/台地/海床切割域
 * 零重叠（恒海判据，设计 §2）。
 *
 * 岛缘非正圆：大城按显式海岸线（`outline`）或谐波（`shape`）调制每个方向
 * 的有效半径，plateauR / beachR 是该方向的基准半径。所有采样点共用本函数。
 */
export function islandSurfaceYAt(x: number, z: number): number | null {
  for (const town of YEAR_ISLAND_SPECS) {
    const dx = x - town.x;
    const dz = z - town.z;
    // 包围盒快筛（按最大可能半径放大，避免调制后漏检）。
    const outerR = town.beachR + ISLAND_SKIRT_W;
    const maxR = outerR * 1.35;
    if (dx >= -maxR && dx <= maxR && dz >= -maxR && dz <= maxR) {
      const scale = shapeScaleOf(town, dx, dz);
      const y = profileY(Math.hypot(dx, dz), scale, town, terrainRiseAt(town.terrain, dx, dz));
      if (y !== null) return y;
    }
    for (const satellite of town.satellites ?? []) {
      const y = satelliteYAt(satellite, town.x, town.z, x, z);
      if (y !== null) return y;
    }
  }
  return null;
}

/** 岛足印判定（含水下裙与小屿；审计与 T4 守卫的「岛缘」口径）。 */
export function isInsideIsland(x: number, z: number): boolean {
  return islandSurfaceYAt(x, z) !== null;
}
