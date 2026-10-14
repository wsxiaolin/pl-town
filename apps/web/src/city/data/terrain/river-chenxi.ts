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
  [72, -97],
  [58, -101],
  [38, -105],
  [14, -106],
  [-12, -104],
  [-34, -100],
  [-50, -96],
  [-56, -94],
];

/**
 * 晨溪地形要素：
 * - river：主体水面条带（渲染器按 renderHint.animated 接 animatedWater）。
 * - forest：两岸疏林带（渲染器以固定种子沿 path 两侧散布低多边形松树，
 *   距中心线 ≥5；描述的是实际渲染的岸林，非导航阻挡）。
 */

/**
 * 河口湾（estuary）中轴采样（v3，2026-10-04）：[x, 中心 z, 半宽]，
 * 自海侧开口（x -44.2）至上游尖灭（x -33.2）。河流不再以等宽细条
 * 「插进」海面，而是在可见入海点（西海面东缘 ≈ x -42.6、沙滩带内）
 * 铺喇叭形湾面：西端开口朝海，向东收窄叠在河道上方。渲染实现
 * riverChenxi.ts 按 y = 0.08（高于沙滩 0.07 / 海面 0.06）铺面，
 * 喇叭最大半宽 7 → 北缘 z ≈ -90.3，仍在 WORLD_BOUNDS（z ≥ -88）之外。
 * 数值审计见 tests/unit/worldTerrainAudit.test.ts。
 */
export const ESTUARY_PROFILE: ReadonlyArray<readonly [number, number, number]> = [
  // v6 海侧羽流（plume）两站：河口不再以湾口几何边缘直接撞上西海面，
  // 而是向西伸出渐隐水舌没入海中（渲染层按 x 渐降 y 至 0.064 并把
  // alpha/水色渐变入海）。半宽沿羽流先展后收 = 扩散的水舌形态。
  [-50.5, -101.0, 4.8], // 羽流海内端（y 0.064 贴海面、alpha 归零处）
  [-47.2, -100.2, 5.8], // 羽流中段
  [-44.2, -99.2, 6.8], // 湾口（满高 0.08 起点以西不再抬升）
  [-41.5, -98.4, 7.8],
  [-38.5, -97.2, 6.8],
  [-35.5, -95.8, 4.8],
  [-33.2, -94.8, 1.8],
];

/** 湾水舌 + 沙洲的包围盒（岸景排除用，含边缘扰动余量）。 */
export const ESTUARY_BBOX = { x0: -52, x1: -31.5, z0: -106, z1: -89 };

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
