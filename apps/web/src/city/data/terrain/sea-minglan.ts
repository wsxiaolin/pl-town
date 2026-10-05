// 明澜外海地形配置：西海滩以西的低多边形岛屿、远处岬角与外海底层水面。
// 渲染实现见 rendering/terrain/minglanIsles.ts（"配置在 data、渲染在 rendering"
// 的分层约定见 terrain/README.md 与 _types.ts 头注释）。
//
// 坐标契约（渲染按此逐字实现，改动须两侧同步并重跑 prop 清空距核对）：
// - 全部要素位于 x < -40，且与 rendering/westBeach.ts 的既有道具保持 ≥12
//   世界单位的网格间距。既有道具占位（westBeach.ts 实测）：
//   · 俾斯麦模型 x=-61，z 巡航 [-16, 8]，舰体含舰艏半长 ≈1.6；
//   · 希佩尔模型 x=-55，z 巡航 [16, 34]，舰体半长 ≈1.3；
//   · 海鸥群飞行盒 x ∈ [-60, -46]，y ≈ 3.1–3.9，z ∈ [-15, 35]；
//   · 棕榈 (-38.4, -6.5) / (-38.4, 10.5)、海神像 (-40.7, 11.5)；
//   · 沙滩 y=0.07（x ≈ [-44.4, -33]，z ∈ [-64, 64]）、海面 y=0.06
//     （x ≈ [-140, -42]，z ∈ [-112, 112]）、浪花带 x ≥ -47。
// - 岛屿包络：radius = width/2 = depth/2，height 为水面以上峰高（椭球心
//   取 y=0，水面线在赤道附近）。渲染附加：沙线盘半径 = radius + 1.5、
//   y = 0.085；水下裙 y ∈ [-0.6, 0.085]。
// - 岬角群：单条配置覆盖整个山簇包络，渲染按 rendering/terrain/minglanIsles.ts
//   内的簇内偏移表逐丘放置（每丘半径 12–20、高 8–16，底 y=-0.6）。
// - 外海：单一 900×900 平面，y = -0.4（城市地表 y=0 之下 0.4，杜绝 z-fighting），
//   仅在世界边缘与西侧海面之下可见。
// - 偏离原始提案并已核对清空距：螺洲 (-70,-18) 距俾斯麦巡航线最近仅 ≈9.2、
//   距海鸥飞行盒 ≈9.3（均 <12），移至 (-75,-36)；星屿 (-86,12) 的沙线盘
//   距俾斯麦巡航包络 ≈11.3（<12），西移至 (-88,12)；叠石 (-74,42) 距海鸥盒角
//   ≈11.1（<12），移至 (-76,46)；远屿随螺洲西移 (-96,-42) → (-100,-46)
//   以免两者沙线盘重叠。核对后的最小网格间距（包络球法，偏保守）：
//   星屿沙线盘↔俾斯麦 ≈13.3、螺洲↔俾斯麦 ≈12.9、叠石↔海鸥 ≈13.0、
//   远屿↔俾斯麦 ≈33、其余均更宽裕。
import type { TerrainFeatureConfig } from './_types';

/** 明澜外海要素列表：四座低多边形离岛 + 西北/西南岬角群 + 外海底层水面。 */
export const MINGLAN_ISLES: readonly TerrainFeatureConfig[] = [
  {
    id: 'isle-luozhou',
    kind: 'island',
    label: '螺洲',
    x: -75,
    z: -36,
    width: 14,
    depth: 14,
    height: 5,
    renderHint: { color: 0x8a9c6e, castShadow: false },
    navigationBlocking: true,
    navigationClearance: 2.5,
  },
  {
    id: 'isle-xingyu',
    kind: 'island',
    label: '星屿',
    x: -88,
    z: 12,
    width: 20,
    depth: 20,
    height: 8,
    renderHint: { color: 0x8a9c6e, castShadow: false },
    navigationBlocking: true,
    navigationClearance: 2.5,
  },
  {
    id: 'isle-dieshi',
    kind: 'island',
    label: '叠石',
    x: -76,
    z: 46,
    width: 10,
    depth: 10,
    height: 3,
    renderHint: { color: 0x8a9c6e, castShadow: false },
    navigationBlocking: true,
    navigationClearance: 2.5,
  },
  {
    id: 'isle-yuanyu',
    kind: 'island',
    label: '远屿',
    x: -100,
    z: -46,
    width: 24,
    depth: 24,
    height: 10,
    renderHint: { color: 0x8a9c6e, castShadow: false },
    navigationBlocking: true,
    navigationClearance: 2.5,
  },
  {
    // 北岬群（西北远岸山簇）：v3 北移（z -96 → -128）让出晨溪河口湾外
    // 的开阔海面——河流入海不再正对山体（sin 2026-10-04 反馈）。
    // 包络 x ∈ [-117.8, -66.2]、z ∈ [-149.8, -106.2]，
    // 簇内 6 丘的偏移表见渲染实现；山脚 y=-0.6，可见峰高 8–15。
    // 清空距重核：最东 -66.2 距浪花带（x ≥ -47.4）≈ 19、距河口湾
    // 西端 (-44.2,-97.8) ≈ 23.6、距俾斯麦（z ≥ -16 一侧）≥ 90、
    // 距远屿 (-100,-46, r13.5) ≈ 82、距螺洲 (-75,-36, r8.5) ≈ 72，全 ≥12。
    id: 'headland-nw',
    kind: 'mountain',
    label: '北岬群',
    x: -92,
    z: -128,
    width: 51.5,
    depth: 43.5,
    height: 15,
    renderHint: { color: 0xa3b8ba, castShadow: false },
    navigationBlocking: true,
    navigationClearance: 4,
  },
  {
    // 南岬群（西南远岸山簇）：包络 x ∈ [-107.8, -60.4]、z ∈ [72.4, 118.6]，
    // 簇内 6 丘的偏移表见渲染实现；山脚 y=-0.6，可见峰高 8–14。
    // 最东两丘已西移，保证与浪花带（x ≥ -47.4）保持 ≥12 间距。
    id: 'headland-sw',
    kind: 'mountain',
    label: '南岬群',
    x: -84,
    z: 95.5,
    width: 47.5,
    depth: 46.5,
    height: 14,
    renderHint: { color: 0xa8bab2, castShadow: false },
    navigationBlocking: true,
    navigationClearance: 4,
  },
  {
    // 外海底层水面：单一 900×900 平面，y=-0.4，铺满世界边缘之外；
    // 海面本体（西海滩 y=0.06）与城市地表（y=0，±110）之下不可见。
    id: 'sea-minglan-outer',
    kind: 'sea',
    label: '明澜外海',
    x: 0,
    z: 0,
    width: 900,
    depth: 900,
    height: -0.4,
    renderHint: { color: 0x25667c, animated: false, castShadow: false },
    navigationBlocking: true,
    navigationClearance: 6,
  },
];
