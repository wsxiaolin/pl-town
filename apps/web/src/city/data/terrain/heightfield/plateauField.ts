// 城市台地（plateau）平坦场——可信地形改造 T2（方案 §2.2 / §3）。
//
// 台地 = 城市核心所在的平坦区：MAIN 主盒（含 district ±75 铺装、北城
// 导航边界 -88.2 与环路外缘）+ 观星走廊盒（东郊观星步道）。台地内
// terrainHeight 严格 === 0（PLATEAU_BASE_Y，方案 §3.2：与现状城区地表
// 锚定，一切既有 y 落位零变化）；治理布局、寻路网格、碰撞等 2D 系统
// 继续成立。
//
// 边缘处理（方案 §3.1）：各缘按「外场性质」分头过渡——
// - 西缘 x=-75：海床场自带滩涂缓坡（worldReliefField.seaBedCutAt）；
// - 南缘 z=78：草甸正场由本文件的城外权重（openWeight）压制出裙坡；
// - 北缘 z=-90：河谷负场自带贴台地缘的南翼过渡（worldReliefField）；
// - 东缘/走廊：背景回退 0，天然连续。
// 本文件只负责盒并集 SDF 与平坦权重，不预设过渡的成因。
import { smoothStep } from './noiseCore';

/** 台地基准高度：城区一切既有 SURFACE_Y 层叠以此为地面 0 参照。 */
export const PLATEAU_BASE_Y = 0;

/** 台地主盒：district 铺装（±75）+ 环路外缘 + 北城导航边界缓冲。 */
export const PLATEAU_MAIN: { x0: number; x1: number; z0: number; z1: number } = {
  x0: -75,
  x1: 78,
  z0: -90,
  z1: 78,
};

/** 观星走廊盒：台地向东郊观星坡的延伸臂（东缘 x=78 → 88）。 */
export const PLATEAU_CORRIDOR: { x0: number; x1: number; z0: number; z1: number } = {
  x0: 78,
  x1: 88,
  z0: -12,
  z1: 12,
};

/** 台地裙坡带宽：出盒后场值渐显的过渡宽度（方案 §3.1）。 */
export const PLATEAU_SKIRT_W = 14;

/**
 * 轴对齐盒（并集）外距离（盒内为 0）。两盒共享 x=78 边，无缝并集。
 */
export function distanceOutsidePlateau(x: number, z: number): number {
  const dxMain = Math.max(PLATEAU_MAIN.x0 - x, 0, x - PLATEAU_MAIN.x1);
  const dzMain = Math.max(PLATEAU_MAIN.z0 - z, 0, z - PLATEAU_MAIN.z1);
  const distMain = Math.hypot(dxMain, dzMain);
  const dxCorr = Math.max(PLATEAU_CORRIDOR.x0 - x, 0, x - PLATEAU_CORRIDOR.x1);
  const dzCorr = Math.max(PLATEAU_CORRIDOR.z0 - z, 0, z - PLATEAU_CORRIDOR.z1);
  const distCorr = Math.hypot(dxCorr, dzCorr);
  return Math.min(distMain, distCorr);
}

/**
 * 台地平坦权重（方案 §2.2 的 plateauFlat，按其结果语义实现）：
 * 盒并集内严格 1，出盒后随距离在 PLATEAU_SKIRT_W 内平滑衰减到 0。
 *
 * 注意与方案 §2.2 伪码的对应：方案行文「plateauFlat ∈ [0,1]，台地盒并集
 * 内严格 0」与其紧随的公式注释「台地内 → 严格 0.0；台地外 → 起伏场；
 * 裙坡带 → 混合」自相矛盾（若盒内为 0，(1-plateau)*relief 在台地内
 * 反而透出起伏场）。本实现按结果注释落位：terrainHeight =
 * (1 - plateauFlat) * meadowRelief + 负场（负场自带台地缘过渡，见
 * worldReliefField.ts 头注释的论证）。
 */
export function plateauFlat(x: number, z: number): number {
  return 1 - smoothStep(0, PLATEAU_SKIRT_W, distanceOutsidePlateau(x, z));
}

/** 台地内判定（含裙坡内 0.5 容差带外的严格盒内测试，调试/审计用）。 */
export function isInsidePlateau(x: number, z: number): boolean {
  return distanceOutsidePlateau(x, z) <= 0;
}
