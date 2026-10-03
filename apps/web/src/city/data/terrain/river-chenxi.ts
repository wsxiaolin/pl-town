// 晨溪（river-chenxi）——城北山谷河流的地形配置（纯数据，无函数/回调）。
//
// 渲染实现：rendering/terrain/riverChenxi.ts（y 层约定、排除区约束与
// 钳制策略在该文件头注释中说明）。走向：东起山泉 (64,-95)，沿星语北城
// （NORTH_DISTRICT_AREA，路网 z ≤ -80、导航可达至 z=-88）背后的山谷向西，
// 河口 (-56,-98) 没入西海（西海面 y=0.06 覆盖 x ≤ -43.2±wobble）。
//
// v2 改线（2026-10）：星语北城并入主城后占据 x∈[-33.5,33.5]、z∈[-36,-80]，
// 旧线（z -52..-74）穿城而过且压在 150×150 district 平面（y=0.018，±75）
// 上只差 0.002；新线全程 z ≤ -95，城、district 平面、导航区（z ≥ -88）
// 三者皆不再相交。
//
// 路径为最终定稿：中心线全程 z ≤ -95（城北 keep-out 盒 x∈[-41,41]、
// z∈[-88,-33] 之外，导航边界 z=-88 以南），全程不出地面 |x|,|z| ≤ 108。
import type { TerrainFeatureConfig } from './_types';

/** 晨溪中心线最终路径，[x, z] 序列（自源头至河口）。 */
const CHENXI_RIVER_PATH: Array<[number, number]> = [
  [64, -95],
  [42, -97],
  [18, -96],
  [-6, -98],
  [-28, -97],
  [-46, -99],
  [-56, -98],
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
    x: 64,
    z: -95,
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
    x: 42,
    z: -97,
    width: 24,
    path: CHENXI_RIVER_PATH,
    renderHint: { color: 0x3a6a48, castShadow: true },
    navigationBlocking: false,
  },
];
