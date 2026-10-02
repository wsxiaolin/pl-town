// 岚屏岭（Lanping Range）——城市北 / 东 / 南三面的低多边形层叠山脉配置。
// 视觉参照 CG 启动图 assets/cg/echo/mountain-promise.png 与 observatory-song.png：
// 棱面 flat-shading 山峰分三排纵深（麓丘 → 主脊 → 远脊），越远越亮越冷
// （大气透视直接烘进颜色，场景不加 fog），山麓点缀针叶松集群。
//
// 配置先行协议：本文件只描述数据；渲染实现见 rendering/terrain/mountainRanges.ts
// （逐条 1:1 消费：x/z = 峰心，width/depth = 底座直径，height = 海拔，
// renderHint.color = 山体主色，renderHint.castShadow = 是否投影）。
// 导航避让由 city/navigation 未来按 navigationBlocking 接线。
//
// 空间约束（与其它地形协作方的边界协议，改动前先对表）：
// - 城市与环线：以原点为心半径 50 的圆内不放山体；仅麓丘（Row A）外缘
//   可进入 42（城市边界）..50 的外侧环带，且保持 ≥44。
// - 东侧观星走廊：x∈[36,88], z∈[-12,12] 保持空旷（回响观星台道路 [68,0]）。
// - 西侧海域归海岸/岛屿地形所有：本表在 x<-40 不放任何条目；西北/西南
//   远岸岬角由 sea-minglan.ts 的 headland-nw / headland-sw 承担（原先的
//   屏海北岬/西北岬/南岬/西南岬四条已并入该配置，避免同位双重山体），
//   且远离河口盒 x∈[-64,-40], z∈[-78,-62]。
// - 河流走廊：折线 (62,-52)(40,-58)(16,-56)(-8,-64)(-26,-66)(-42,-70)
//   (-54,-72)(-62,-74) 两侧 ±11 不放峰心 / 树木（河流由另一方实现）。
// - 全图地面 220×220（-110..110）；山体为实体体积，基座埋入 y=0 以下，
//   不存在贴地平面，不参与 SURFACE_Y 的 z-fighting 体系。
import type { TerrainFeatureConfig } from './_types';

/**
 * 岚屏岭山脉要素表。渲染器逐条映射：
 * kind 'mountain' = 一座棱面山峰（渲染器按 id 哈希确定性生成抖动、
 * 双峰与雪冠变体）；kind 'forest' = 一片针叶松集群（8..14 棵，按 id
 * 确定性散布在 width/depth 包络圆内）；kind 'cliff' = 崖壁岩丘。
 */
export const LANPING_RANGE: readonly TerrainFeatureConfig[] = [
  // ── 北麓 Row A：城市与澜溪之间/溪北的饱和草绿麓丘（radius 7..10, h 5..9）──
  { id: 'range-lanping-n-a1', kind: 'mountain', label: '岚屏岭·北麓一峰', x: -30, z: -48, width: 18, depth: 18, height: 6, renderHint: { color: 0x8fae72, castShadow: true }, navigationBlocking: true },
  { id: 'range-lanping-n-a2', kind: 'mountain', label: '岚屏岭·北麓二峰', x: -18, z: -52, width: 16, depth: 16, height: 7, renderHint: { color: 0x86a56a, castShadow: true }, navigationBlocking: true },
  { id: 'range-lanping-n-a3', kind: 'mountain', label: '岚屏岭·北麓三峰', x: 28, z: -45, width: 16, depth: 16, height: 6, renderHint: { color: 0x97b57e, castShadow: true }, navigationBlocking: true },
  { id: 'range-lanping-n-a4', kind: 'mountain', label: '岚屏岭·北麓四峰', x: 40, z: -46, width: 18, depth: 18, height: 8, renderHint: { color: 0x7fa06a, castShadow: true }, navigationBlocking: true },
  { id: 'range-lanping-n-a5', kind: 'mountain', label: '岚屏岭·北麓五峰', x: 54, z: -42, width: 20, depth: 20, height: 9, renderHint: { color: 0x8ba973, castShadow: true }, navigationBlocking: true },
  { id: 'range-lanping-n-a7', kind: 'mountain', label: '岚屏岭·北麓溪北丘', x: 22, z: -70, width: 16, depth: 16, height: 6, renderHint: { color: 0x8fae72, castShadow: true }, navigationBlocking: true },
  { id: 'range-lanping-n-a8', kind: 'mountain', label: '岚屏岭·北麓溪北二丘', x: 44, z: -70, width: 18, depth: 18, height: 7, renderHint: { color: 0x86a56a, castShadow: true }, navigationBlocking: true },

  // ── 北主脊 Row B：澜溪以北的青灰主脊（radius 12..16, h 16..22）──
  { id: 'range-lanping-n-b1', kind: 'mountain', label: '岚屏岭·北主脊一峰', x: 58, z: -70, width: 24, depth: 24, height: 16, renderHint: { color: 0x648a84, castShadow: true }, navigationBlocking: true },
  { id: 'range-lanping-n-b2', kind: 'mountain', label: '岚屏岭·北主脊二峰', x: 36, z: -76, width: 28, depth: 28, height: 18, renderHint: { color: 0x5d8280, castShadow: true }, navigationBlocking: true },
  { id: 'range-lanping-n-b3', kind: 'mountain', label: '岚屏岭·北主脊三峰', x: 12, z: -80, width: 30, depth: 30, height: 20, renderHint: { color: 0x6b9090, castShadow: true }, navigationBlocking: true },
  { id: 'range-lanping-n-b4', kind: 'mountain', label: '岚屏岭·北主脊四峰', x: -14, z: -84, width: 32, depth: 32, height: 22, renderHint: { color: 0x577b7a, castShadow: true }, navigationBlocking: true },
  { id: 'range-lanping-n-b5', kind: 'mountain', label: '岚屏岭·北主脊五峰', x: -28, z: -90, width: 24, depth: 24, height: 16, renderHint: { color: 0x6f9396, castShadow: true }, navigationBlocking: true },

  // ── 北远脊 Row C：天际线雾青远山（radius 14..18, h 22..28，不投影）──
  { id: 'range-lanping-n-c1', kind: 'mountain', label: '岚屏岭·北远脊一峰', x: 76, z: -96, width: 36, depth: 36, height: 26, renderHint: { color: 0xa6c0c8, castShadow: false }, navigationBlocking: true },
  { id: 'range-lanping-n-c2', kind: 'mountain', label: '岚屏岭·北远脊二峰', x: 46, z: -97, width: 32, depth: 32, height: 24, renderHint: { color: 0xafc7cd, castShadow: false }, navigationBlocking: true },
  { id: 'range-lanping-n-c3', kind: 'mountain', label: '岚屏岭·北远脊三峰', x: 14, z: -96, width: 34, depth: 34, height: 28, renderHint: { color: 0x9db9c3, castShadow: false }, navigationBlocking: true },
  { id: 'range-lanping-n-c4', kind: 'mountain', label: '岚屏岭·北远脊四峰', x: -18, z: -97, width: 32, depth: 32, height: 24, renderHint: { color: 0xb7cdd2, castShadow: false }, navigationBlocking: true },

  // ── 东麓 Row A：观星走廊南北两侧的麓丘（走廊 x∈[36,88], z∈[-12,12] 让空）──
  { id: 'range-lanping-e-a1', kind: 'mountain', label: '岚屏岭·东麓南丘', x: 58, z: 26, width: 18, depth: 18, height: 7, renderHint: { color: 0x8fae72, castShadow: true }, navigationBlocking: true },
  { id: 'range-lanping-e-a2', kind: 'mountain', label: '岚屏岭·东麓北丘', x: 66, z: -26, width: 18, depth: 18, height: 7, renderHint: { color: 0x97b57e, castShadow: true }, navigationBlocking: true },
  { id: 'range-lanping-e-a3', kind: 'mountain', label: '岚屏岭·东麓北二丘', x: 58, z: -28, width: 16, depth: 16, height: 6, renderHint: { color: 0x86a56a, castShadow: true }, navigationBlocking: true },
  { id: 'range-lanping-e-a4', kind: 'mountain', label: '岚屏岭·东麓南二丘', x: 66, z: 28, width: 16, depth: 16, height: 6, renderHint: { color: 0x7fa06a, castShadow: true }, navigationBlocking: true },

  // ── 东主脊 Row B：走廊尽头与南北两翼的青灰主脊 ──
  { id: 'range-lanping-e-b1', kind: 'mountain', label: '岚屏岭·东主脊北峰', x: 80, z: -34, width: 26, depth: 26, height: 17, renderHint: { color: 0x648a84, castShadow: true }, navigationBlocking: true },
  { id: 'range-lanping-e-b2', kind: 'mountain', label: '岚屏岭·东主脊南峰', x: 84, z: 32, width: 28, depth: 28, height: 19, renderHint: { color: 0x5d8280, castShadow: true }, navigationBlocking: true },
  { id: 'range-lanping-e-b3', kind: 'mountain', label: '岚屏岭·东主脊溪口峰', x: 78, z: -52, width: 26, depth: 26, height: 16, renderHint: { color: 0x6b9090, castShadow: true }, navigationBlocking: true },
  { id: 'range-lanping-e-b4', kind: 'mountain', label: '岚屏岭·东主脊南二峰', x: 82, z: 50, width: 28, depth: 28, height: 18, renderHint: { color: 0x577b7a, castShadow: true }, navigationBlocking: true },
  { id: 'range-lanping-e-b5', kind: 'mountain', label: '岚屏岭·东主脊尽峰', x: 104, z: 4, width: 20, depth: 20, height: 14, renderHint: { color: 0x6f9396, castShadow: true }, navigationBlocking: true },

  // ── 东远脊 Row C：东南天际雾山 ──
  { id: 'range-lanping-e-c1', kind: 'mountain', label: '岚屏岭·东远脊北峰', x: 98, z: -56, width: 32, depth: 32, height: 26, renderHint: { color: 0xa6c0c8, castShadow: false }, navigationBlocking: true },
  { id: 'range-lanping-e-c2', kind: 'mountain', label: '岚屏岭·东远脊中峰', x: 96, z: 30, width: 32, depth: 32, height: 28, renderHint: { color: 0x9db9c3, castShadow: false }, navigationBlocking: true },
  { id: 'range-lanping-e-c3', kind: 'mountain', label: '岚屏岭·东远脊南峰', x: 100, z: 64, width: 28, depth: 28, height: 24, renderHint: { color: 0xafc7cd, castShadow: false }, navigationBlocking: true },

  // ── 南麓 Row A ──
  { id: 'range-lanping-s-a1', kind: 'mountain', label: '岚屏岭·南麓一峰', x: -8, z: 56, width: 18, depth: 18, height: 6, renderHint: { color: 0x8fae72, castShadow: true }, navigationBlocking: true },
  { id: 'range-lanping-s-a2', kind: 'mountain', label: '岚屏岭·南麓二峰', x: 14, z: 58, width: 16, depth: 16, height: 7, renderHint: { color: 0x86a56a, castShadow: true }, navigationBlocking: true },
  { id: 'range-lanping-s-a3', kind: 'mountain', label: '岚屏岭·南麓三峰', x: -22, z: 52, width: 18, depth: 18, height: 6, renderHint: { color: 0x97b57e, castShadow: true }, navigationBlocking: true },
  { id: 'range-lanping-s-a4', kind: 'mountain', label: '岚屏岭·南麓四峰', x: 34, z: 56, width: 18, depth: 18, height: 8, renderHint: { color: 0x7fa06a, castShadow: true }, navigationBlocking: true },
  { id: 'range-lanping-s-a5', kind: 'mountain', label: '岚屏岭·南麓五峰', x: -26, z: 64, width: 16, depth: 16, height: 6, renderHint: { color: 0x8ba973, castShadow: true }, navigationBlocking: true },

  // ── 南主脊 Row B ──
  { id: 'range-lanping-s-b1', kind: 'mountain', label: '岚屏岭·南主脊一峰', x: 0, z: 76, width: 30, depth: 30, height: 20, renderHint: { color: 0x648a84, castShadow: true }, navigationBlocking: true },
  { id: 'range-lanping-s-b2', kind: 'mountain', label: '岚屏岭·南主脊二峰', x: -26, z: 80, width: 28, depth: 28, height: 18, renderHint: { color: 0x5d8280, castShadow: true }, navigationBlocking: true },
  { id: 'range-lanping-s-b3', kind: 'mountain', label: '岚屏岭·南主脊三峰', x: 28, z: 82, width: 32, depth: 32, height: 22, renderHint: { color: 0x6b9090, castShadow: true }, navigationBlocking: true },
  { id: 'range-lanping-s-b4', kind: 'mountain', label: '岚屏岭·南主脊四峰', x: 52, z: 74, width: 26, depth: 26, height: 16, renderHint: { color: 0x577b7a, castShadow: true }, navigationBlocking: true },

  // ── 南远脊 Row C ──
  { id: 'range-lanping-s-c1', kind: 'mountain', label: '岚屏岭·南远脊一峰', x: 18, z: 95, width: 36, depth: 36, height: 28, renderHint: { color: 0xa6c0c8, castShadow: false }, navigationBlocking: true },
  { id: 'range-lanping-s-c2', kind: 'mountain', label: '岚屏岭·南远脊二峰', x: -14, z: 97, width: 32, depth: 32, height: 24, renderHint: { color: 0xafc7cd, castShadow: false }, navigationBlocking: true },
  { id: 'range-lanping-s-c3', kind: 'mountain', label: '岚屏岭·南远脊三峰', x: 48, z: 96, width: 32, depth: 32, height: 26, renderHint: { color: 0x9db9c3, castShadow: false }, navigationBlocking: true },

  // ── 崖壁：澜溪出谷的惊鸿崖 + 观星走廊北缘的观星崖 ──
  { id: 'range-lanping-cliff-01', kind: 'cliff', label: '惊鸿崖', x: 56, z: -38, width: 12, depth: 6, height: 7, renderHint: { color: 0x7e8a83, castShadow: true }, navigationBlocking: true },
  { id: 'range-lanping-cliff-02', kind: 'cliff', label: '观星崖', x: 84, z: -17, width: 12, depth: 5, height: 6, renderHint: { color: 0x87938b, castShadow: true }, navigationBlocking: true },

  // ── 针叶松集群（observatory-song 式叠锥松；包络圆内确定性散布 8..14 棵）──
  { id: 'range-lanping-pine-01', kind: 'forest', label: '松涛林·溪畔', x: 40, z: -40, width: 12, depth: 12, renderHint: { color: 0x3c6b50, castShadow: true } },
  { id: 'range-lanping-pine-02', kind: 'forest', label: '松涛林·北坡', x: 48, z: -73, width: 10, depth: 10, renderHint: { color: 0x33604a, castShadow: true } },
  { id: 'range-lanping-pine-03', kind: 'forest', label: '松涛林·东坡', x: 74, z: -26, width: 12, depth: 12, renderHint: { color: 0x3c6b50, castShadow: true } },
  { id: 'range-lanping-pine-04', kind: 'forest', label: '松涛林·望城坡', x: 74, z: 26, width: 12, depth: 12, renderHint: { color: 0x33604a, castShadow: true } },
  { id: 'range-lanping-pine-05', kind: 'forest', label: '松涛林·南麓', x: 16, z: 66, width: 12, depth: 12, renderHint: { color: 0x3c6b50, castShadow: true } },
  { id: 'range-lanping-pine-06', kind: 'forest', label: '松涛林·南坳', x: -24, z: 70, width: 12, depth: 12, renderHint: { color: 0x33604a, castShadow: true } },
  { id: 'range-lanping-pine-07', kind: 'forest', label: '松涛林·远足径', x: 60, z: -84, width: 12, depth: 12, renderHint: { color: 0x3c6b50, castShadow: true } },
  { id: 'range-lanping-pine-08', kind: 'forest', label: '松涛林·东岭肩', x: 90, z: 46, width: 12, depth: 12, renderHint: { color: 0x33604a, castShadow: true } },
];
