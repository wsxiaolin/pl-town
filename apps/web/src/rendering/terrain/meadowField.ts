// 城缘草甸高度场（meadow field）——纯计算模块，无 Three.js 网格/DOM。
// cityGround.ts（渲染几何与装饰贴地）与 worldTerrainAudit.test.ts（数值
// 审计）共用同一份 sampleCitysideMeadowY，保证「审计的」和「渲染的」
// 是同一张高度场。
//
// 高度场（每片草甸 = 配置的矩形包围盒）：
//   y = -0.08 + relief × h01 × profile × masks
// - h01：双频 fBm 大缓坡（确定性，无 Math.random）；
// - profile：城市侧边缘隆起、外缘落回埋地的"隆起带"曲线（逐条配置的
//   空间形态，见 swellProfile）；
// - masks：可步行区/河谷/河口湾/海域/麓原五重软塌陷——起伏在任何
//   keep-out 区域强制归零（网格脚印虽可过界，表面埋在 y<0 之下被
//   不透明地表面完全遮挡，可步行区内零可见起伏）。
import type { TerrainFeatureConfig } from '../../city/data/terrain/_types';
import { LANPING_RANGE } from '../../city/data/terrain/range-lanping';
import { ESTUARY_BBOX } from '../../city/data/terrain/river-chenxi';
import { fbm2, hashString, mulberry32 } from './massifGeometry';

// 固定全局种子：与 id 哈希混合，保证任何一次构建结果完全一致。
export const MEADOW_GLOBAL_SEED = 0x6d65646f; // 'medo'
// 城心（与 mountainRanges 麓原 CITY_CENTER 一致）。
const CITY_CENTER: readonly [number, number] = [17, -23];
// 埋地基线：profile=0 处草甸表面落到地表之下，被不透明地表面遮住。
export const MEADOW_BURY_Y = -0.08;
// keep-out 软塌陷参数：{ 盒, 软塌陷过渡带宽 }。
export const MEADOW_WALKABLE_MARGIN_BOX = { x0: -54, x1: 80, z0: -92.2, z1: 54 }; // 导航区（x[-50,84] z[-88.2,50]）外扩 4
const RIVER_VALLEY_BOX = { x0: -62, x1: 68, z0: -110, z1: -86 }; // 晨溪河谷带（与 mountainRanges 一致）
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
 * 草甸表面世界高度（渲染几何与装饰贴地共用的唯一事实来源）。
 * 返回值可为负（埋地）；调用方对埋地负责（网格被地表遮住，装饰跳过）。
 */
export function sampleCitysideMeadowY(feature: TerrainFeatureConfig, x: number, z: number): number {
  const w = feature.width ?? 20;
  const d = feature.depth ?? 20;
  const u = x - ((feature.x ?? 0) - w / 2);
  const v = z - ((feature.z ?? 0) - d / 2);
  if (u < -2 || u > w + 2 || v < -2 || v > d + 2) return MEADOW_BURY_Y;
  const seed = (hashString(feature.id) ^ MEADOW_GLOBAL_SEED) >>> 0;
  const broad = fbm2(x * 0.05, z * 0.05, seed, 8192, 3);
  const fine = fbm2(x * 0.13, z * 0.13, (seed ^ 0x9e3779b1) >>> 0, 8192, 3);
  const h01 = 0.5 + 0.5 * (broad * 0.68 + fine * 0.32);
  // 五重软塌陷：可步行区 / 晨溪河谷 / 河口湾 / 海域 / 岚屏岭麓原。
  let mask = meadowSmoothStep(0, KEEPOUT_FADE, distanceOutsideBox(x, z, MEADOW_WALKABLE_MARGIN_BOX));
  mask *= meadowSmoothStep(0, KEEPOUT_FADE, distanceOutsideBox(x, z, RIVER_VALLEY_BOX));
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
  return MEADOW_BURY_Y + relief * h01 * meadowSwellProfile(feature, u, v) * mask;
}
