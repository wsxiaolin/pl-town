// 城缘草甸高度场（meadow field）——纯计算模块，无 Three.js 网格/DOM。
// 可信地形改造 T2 收编（方案 docs/terrain-elevation-plan.md §2.4）：
// 本文件自 rendering/terrain/meadowField.ts 迁入 heightfield/（原址留
// re-export 壳），成为 terrainHeight 权威采样器的草甸分量；审计
// （worldTerrainAudit.test.ts）与渲染（cityGround.ts）共用同一份场。
//
// 高度场（每片草甸 = 配置的矩形包围盒，0 基线正场）：
//   swell = relief × h01 × profile × masks
// - h01：双频 fBm 大缓坡（确定性，无 Math.random）；
// - profile：城市侧边缘隆起、外缘落回 0 的"隆起带"曲线（swellProfile）；
// - masks：河谷/河口湾/海域/麓原四重域塌陷（塌陷区起伏归 0）。
//
// 台地收编的关键语义变化（方案 §2.4）：旧的「可步行区埋地塌陷
// （MEADOW_WALKABLE_MARGIN_BOX + 埋地基线 -0.08）」由「台地平坦」
// 取代——台地内草甸表面归 0，由 terrainHeight 的台地项接管；兼容签名
// sampleCitysideMeadowY = swell × (1 - plateauFlat)，即草甸表面在世界
// 地面上的真实形态（台地内 0、裙坡渐显、核心区全值）。渲染网格的
// 埋地防共面由 cityGround.ts 消费端负责（T3 将退役该网格）。
import type { TerrainFeatureConfig } from '../_types';
import { LANPING_RANGE } from '../range-lanping';
import { ESTUARY_BBOX } from '../river-chenxi';
import { CITYSIDE_MEADOW } from '../ground-cityside';
import { fbm2, hashString } from './noiseCore';
import { plateauFlat } from './plateauField';

// 固定全局种子：与 id 哈希混合，保证任何一次构建结果完全一致。
export const MEADOW_GLOBAL_SEED = 0x6d65646f; // 'medo'
// 城心（与 mountainRanges 麓原 CITY_CENTER 一致）。
const CITY_CENTER: readonly [number, number] = [17, -23];
// 晨溪河谷带（与 mountainRanges 的 RIVER_VALLEY_BOX 一致；提为导出常量
// 供 worldReliefField 与审计共用——方案 §2.4「RIVER_VALLEY_BOX 复用」）。
export const RIVER_VALLEY_BOX = { x0: -62, x1: 68, z0: -110, z1: -86 };
const SEA_FADE_X = [-48, -40] as const; // 西海滩/海域（岸线 ≈ -43.2±wobble）软塌陷
const KEEPOUT_FADE = 8; // 盒外软塌陷过渡带
// 麓原塌陷：距峰心（椭球归一）0.98r 起到 1.22r 完全放平。
const PIEDMONT_FADE_INNER = 0.98;
const PIEDMONT_FADE_OUTER = 1.22;

export type MeadowBox = { x0: number; x1: number; z0: number; z1: number };

export function meadowSmoothStep(edge0: number, edge1: number, x: number): number {
  const t = Math.min(1, Math.max(0, (x - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
}

/** 轴对齐盒外距离（盒内为 0）。 */
export function distanceOutsideBox(x: number, z: number, box: MeadowBox): number {
  const dx = Math.max(box.x0 - x, 0, x - box.x1);
  const dz = Math.max(box.z0 - z, 0, z - box.z1);
  return Math.hypot(dx, dz);
}

/**
 * 隆起带 profile：城市侧边缘隆起、外缘落回埋地。u/v 为草甸局部坐标
 * （u 沿 width、v 沿 depth，0..边长）。逐条配置的空间形态：
 * - south：v 从城缘（v=0）隆起，v 后段落回（面向主城的开阔草甸隆起带）；
 * - northeast：从南缘（导航侧）与西缘（河岸侧）双向隆起，向北/东落回
 *   （晨溪河谷东段的贴谷草坡）；
 * - fallback（未知 id）：距城心径向 band（innerR..innerR+34）隆起。
 */
export function meadowSwellProfile(feature: TerrainFeatureConfig, u: number, v: number): number {
  const w = feature.width ?? 20;
  const d = feature.depth ?? 20;
  if (feature.id === 'ground-cityside-meadow-south') {
    return meadowSmoothStep(0, 20, v)
      * (1 - meadowSmoothStep(d - 14, d - 2, v))
      * meadowSmoothStep(0, 9, u)
      * (1 - meadowSmoothStep(w - 9, w, u));
  }
  if (feature.id === 'ground-cityside-meadow-northeast') {
    return meadowSmoothStep(0, 7, v)
      * meadowSmoothStep(0, 7, u)
      * (1 - meadowSmoothStep(d - 6, d - 1, v))
      * (1 - meadowSmoothStep(w - 7, w - 1, u));
  }
  // fallback：距城心径向隆起带（未知新条目也安全）。
  const wx = (feature.x ?? 0) - w / 2 + u;
  const wz = (feature.z ?? 0) - d / 2 + v;
  const dist = Math.hypot(wx - CITY_CENTER[0], wz - CITY_CENTER[1]);
  let innerR = Infinity;
  for (const [cx, cz] of [
    [feature.x - w / 2, feature.z - d / 2],
    [feature.x + w / 2, feature.z - d / 2],
    [feature.x - w / 2, feature.z + d / 2],
    [feature.x + w / 2, feature.z + d / 2],
  ] as const) {
    innerR = Math.min(innerR, Math.hypot(cx - CITY_CENTER[0], cz - CITY_CENTER[1]));
  }
  return meadowSmoothStep(innerR, innerR + 14, dist) * (1 - meadowSmoothStep(innerR + 24, innerR + 34, dist));
}

/**
 * 单瓣草甸纯起伏场（0 基线，≥ 0）：不含台地因子（由聚合层统一压制），
 * 只保留四重域塌陷（晨溪河谷 / 河口湾 / 海域 / 岚屏岭麓原）。
 * 域外（包围盒外 2 单位网格延拓）返回 0。
 */
export function swellReliefAt(feature: TerrainFeatureConfig, x: number, z: number): number {
  const w = feature.width ?? 20;
  const d = feature.depth ?? 20;
  const u = x - ((feature.x ?? 0) - w / 2);
  const v = z - ((feature.z ?? 0) - d / 2);
  if (u < -2 || u > w + 2 || v < -2 || v > d + 2) return 0;
  const seed = (hashString(feature.id) ^ MEADOW_GLOBAL_SEED) >>> 0;
  const broad = fbm2(x * 0.05, z * 0.05, seed, 8192, 3);
  const fine = fbm2(x * 0.13, z * 0.13, (seed ^ 0x9e3779b1) >>> 0, 8192, 3);
  const h01 = 0.5 + 0.5 * (broad * 0.68 + fine * 0.32);
  // 四重域塌陷：晨溪河谷 / 河口湾 / 海域 / 岚屏岭麓原。
  let mask = meadowSmoothStep(0, KEEPOUT_FADE, distanceOutsideBox(x, z, RIVER_VALLEY_BOX));
  mask *= meadowSmoothStep(0, KEEPOUT_FADE, distanceOutsideBox(x, z, ESTUARY_BBOX));
  mask *= meadowSmoothStep(SEA_FADE_X[0], SEA_FADE_X[1], x);
  for (const mountain of LANPING_RANGE) {
    if (mountain.kind !== 'mountain' || (mountain.height ?? 0) < 14) continue;
    const r = (mountain.width ?? 20) / 2;
    const dr = (mountain.depth ?? mountain.width ?? 20) / 2;
    const dn = Math.hypot((x - mountain.x) / r, (z - mountain.z) / dr);
    mask *= meadowSmoothStep(PIEDMONT_FADE_INNER, PIEDMONT_FADE_OUTER, dn);
  }
  const relief = feature.renderHint?.reliefHeight ?? 2.2;
  return relief * h01 * meadowSwellProfile(feature, u, v) * mask;
}

/**
 * 城缘草甸聚合正场（两瓣取 max；瓣间包围盒不相交，max 只是网格延拓
 * 重叠区的安全合并）。供 terrainHeight 的起伏分量消费。
 */
export function meadowReliefAt(x: number, z: number): number {
  let best = 0;
  for (const feature of CITYSIDE_MEADOW) {
    const swell = swellReliefAt(feature, x, z);
    if (swell > best) best = swell;
  }
  return best;
}

/**
 * 草甸表面世界高度（兼容签名，渲染几何与审计共用）：
 * = swellReliefAt × (1 - plateauFlat)——台地内归 0（由 terrainHeight 的
 * 台地项接管），裙坡带随城外权重渐显，核心区全值。返回值 ≥ 0。
 */
export function sampleCitysideMeadowY(feature: TerrainFeatureConfig, x: number, z: number): number {
  return swellReliefAt(feature, x, z) * (1 - plateauFlat(x, z));
}
