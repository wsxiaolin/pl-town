// 南洋年份群岛地形配置（T3/T7）：3 座岛台（两城 + 启源站）+ 南海水面覆盖域。
// 渲染实现见 rendering/terrain/archipelagoIsles.ts（岛体/沙线盘）与
// rendering/westBeach.ts 消费的 rendering/terrain/archipelagoWater.ts（水面片）。
// 「配置在 data、渲染在 rendering、导航避让在 navigation」分层见 terrain/README.md。
//
// 坐标契约（设计 §2/§6.1，与 worldGroundMesh.ts 的 farGround 边缘公式同源）：
// - farGround 南缘：z ≤ z_edge(x) = 180 − 18·(1+sin(x/47))；z > 180 恒为海。
// - farGround 西缘：x ≥ w_edge(z) = −150 + (0.4+12·ss)·(1+sin(z/31))（ss 为
//   岚屏岭南缘→+60 的 smoothStep，z ≥ −50 后恒 1）；x < −150 恒为海。
// - 南海水面（唯一 Water 实例的扩展几何）：
//   · 南带：x∈[−150,130]，z ∈ [z_edge(x)−12（贴陆缘下沉带）, 320]；
//   · 西臂：x∈[−290, w_edge(z)+2]，z∈[40,320]（东缘沿西陆缘内收 2u，
//     藏在近缘下沉的陆地之下；z ≤ 112 段与西海条带西缘 sX(z)−96 取小
//     对接，不重叠）；
//   · 镇落位全在恒海区（z_min>180 或 x_max<−150），水面/岛体与 farGround
//     网格零交叠。
import type { TerrainFeatureConfig } from './_types';
import { shorelineX } from '../cityConfig';
import { YEAR_ISLAND_SPECS } from '../year-towns/towns';
import { LANPING_ALPINE_FIELD } from './heightfield/alpineField';
import { smoothStep } from './heightfield/noiseCore';

/**
 * 年份岛台要素表（kind 'island'）：2 座大城 + 启源站独立小岛。
 * - x/z = 岛心，width/depth = 台面直径（2·plateauR）；滩环宽在 renderHint。
 * - renderHint.groundColor = 台面地面色；renderHint.beachWidth = 滩环宽；
 *   renderHint.topY = 台面高（展示用，权威值在 heightfield/islandField.ts，
 *   两者同源于 YEAR_ISLAND_SPECS）。
 */
export const YEAR_ISLANDS: readonly TerrainFeatureConfig[] = YEAR_ISLAND_SPECS.map((island) => ({
  id: island.id,
  kind: 'island' as const,
  label: island.label,
  x: island.x,
  z: island.z,
  width: island.plateauR * 2,
  depth: island.plateauR * 2,
  renderHint: { color: island.theme.groundColor, beachWidth: island.beachR - island.plateauR, topY: island.topY, castShadow: false },
  navigationBlocking: false,
  navigationClearance: 0,
}));

// ── 南海水面覆盖域（waterGuard 数据，T3 只产数据）────────────────────
// T4 的 roadNavigation「archipelagoWater」步行守卫按本域把玩家挡回岛面/
// 栈桥（镜像既有 westBeach 选项的守卫模式，设计 §5.2）。渲染层（水面片
// 几何）与守卫共用同一组谓词，图与碰撞永不漂移。

/** 南带贴陆缘的下沉带宽度（水面北缘 = 南陆缘 − 12，落在下沉海岸之下）。 */
export const SOUTH_SEA_COAST_TUCK = 12;
/** 南带/西臂的世界范围（设计 §6.1）。 */
export const SOUTH_SEA = Object.freeze({
  bandXMin: -150,
  bandXMax: 220,
  bandZMax: 470,
  armXMin: -490,
  armZMin: 40,
  armZMax: 470,
});

/** farGround 南陆缘（z_edge(x)，worldGroundMesh edgeDistance 第 4 项反解）。 */
export function southLandEdgeZ(x: number): number {
  return 180 - 18 * (1 + Math.sin(x / 47));
}

/** farGround 西陆缘（w_edge(z)，worldGroundMesh edgeDistance 第 1 项反解）。 */
export function westLandEdgeX(z: number): number {
  const ss = smoothStep(LANPING_ALPINE_FIELD.bounds.z1, LANPING_ALPINE_FIELD.bounds.z1 + 60, z);
  return -150 + (0.4 + 12 * ss) * (1 + Math.sin(z / 31));
}

/** 西臂东缘：贴西陆缘内收 2（z ≤ 112 段让位给西海条带西缘 sX(z)−96）。 */
export function westArmEastX(z: number, westStripWestX: number): number {
  return Math.min(westLandEdgeX(z) + 2, westStripWestX);
}

// 西海条带口径（westBeach.ts 现值镜像，两侧须同步改）：条带 z∈[−112,112]，
// 西缘 = sX(z) − 96。z ≤ WEST_STRIP_Z_MAX 段西臂东缘让位给条带西缘，守卫
// 域与条带零重叠（渲染几何 archipelagoWater.ts 同口径对缝至 sX(z)−96）。
const WEST_STRIP_Z_MAX = 112;
const WEST_STRIP_WEST_OFFSET = 96;

/**
 * 南海水面覆盖域谓词（waterGuard）。与渲染几何同一组公式：南带在南陆缘
 * 下沉带（z ≥ z_edge(x)−12 且 z ≤ 320、x∈[−150,130]）内为水；西臂在
 * x∈[−290, w_edge(z)+2]、z∈[40,320] 内为水，其中 z ≤ 112 段东缘让位给
 * 西海条带西缘 sX(z)−96（取小对接、与条带零重叠，见头注释）。岛足印
 * （含滩/裙）由 isInsideIsland 另行判定——守卫应先岛后水。
 */
export function isArchipelagoWaterAt(x: number, z: number): boolean {
  const { bandXMin, bandXMax, bandZMax, armXMin, armZMin, armZMax } = SOUTH_SEA;
  if (x >= bandXMin && x <= bandXMax && z <= bandZMax && z >= southLandEdgeZ(x) - SOUTH_SEA_COAST_TUCK) return true;
  const armEastX = z <= WEST_STRIP_Z_MAX
    ? westArmEastX(z, shorelineX(z) - WEST_STRIP_WEST_OFFSET)
    : westLandEdgeX(z) + 2;
  return x >= armXMin && z >= armZMin && z <= armZMax && x <= armEastX;
}
