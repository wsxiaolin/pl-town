// 晨溪（river-chenxi）——谷地北侧河流的地形配置（纯数据，无函数/回调）。
//
// 渲染实现：rendering/terrain/riverChenxi.ts（y 层约定、排除区约束与
// 钳制策略在该文件头注释中说明）。走向：东起山泉 (62,-52)，向西再折向
// 西南，河口 (-62,-74) 没入西海（西海面 y=0.06 覆盖 x ≤ -43.2±wobble）。
//
// 路径为最终定稿：中心线全程 z ≤ -52（城市导航区 z∈[-50,50] 以南），
// 在沙滩盒 x∈[-43,-33] 段保持 z ≤ -66 以南，全程不出地面 |x|,|z| ≤ 108。
import type { TerrainFeatureConfig } from './_types';

/** 晨溪中心线最终路径，[x, z] 序列（自源头至河口）。 */
const CHENXI_RIVER_PATH: Array<[number, number]> = [
  [62, -52],
  [40, -58],
  [16, -56],
  [-8, -64],
  [-26, -66],
  [-42, -70],
  [-54, -72],
  [-62, -74],
];

/**
 * 晨溪地形要素：
 * - river：主体水面条带（渲染器按 renderHint.animated 接 animatedWater）。
 * - forest：两岸疏林带（渲染器以固定种子沿 path 两侧散布低多边形松树，
 *   距中心线 ≥5；描述的是实际渲染的岸林，非导航阻挡）。
 */
export const CHENXI_RIVER: readonly TerrainFeatureConfig[] = [
  {
    id: 'river-chenxi',
    kind: 'river',
    label: '晨溪',
    // 带状地形锚点 = 起点（山泉端）
    x: 62,
    z: -52,
    width: 6,
    path: CHENXI_RIVER_PATH,
    renderHint: { animated: true, color: 0x7fb5c9 },
    navigationBlocking: true,
    navigationClearance: 1.5,
  },
  {
    id: 'river-chenxi-banks',
    kind: 'forest',
    label: '晨溪岸林',
    x: 40,
    z: -58,
    width: 24,
    path: CHENXI_RIVER_PATH,
    renderHint: { color: 0x3a6a48, castShadow: true },
    navigationBlocking: false,
  },
];
