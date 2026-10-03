// 岚屏岭（Lanping Range）——城市北 / 东 / 南三面的低多边形层叠山脉配置。
// 视觉参照 CG 启动图 assets/cg/echo/mountain-promise.png 与 observatory-song.png：
// 棱面 flat-shading 山峰分层纵深、越远越亮越冷（大气透视直接烘进颜色，
// 场景不加 fog），山麓点缀针叶松集群。
//
// 配置先行协议：本文件只描述数据；渲染实现见 rendering/terrain/mountainRanges.ts
// （逐条 1:1 消费：x/z = 峰心，width/depth = 底座直径，height = 海拔，
// renderHint.color = 山体主色，renderHint.castShadow = 是否投影）。
// 导航避让由 city/navigation 未来按 navigationBlocking 接线。
//
// v2 重排（2026-10）：星语北城（PR #196，NORTH_DISTRICT_AREA）并入主城后
// 占据 x∈[-33.5,33.5]、z∈[-36,-80]（路网 + 12 栋作品建筑 + 24 块民居），
// 导航边界随之扩展到 z=-88。旧北麓（z -42..-52）与旧北主脊（z -70..-90）
// 全部压进新区，已整带迁至晨溪（v2 改线，z ≤ -95）背后的 z -104..-110
// 山谷后坡；层叠纵深改由东/南两弧承担，北弧为溪谷 + 单列背后山。
//
// 空间约束（与其它地形协作方的边界协议，改动前先对表）：
// - 星语北城 keep-out 盒 x∈[-41,41], z∈[-88,-33] 内不放任何峰心/树丛
//   （北弧条目全部 z ≤ -101，靠 z 向脱开；东西弧按 x 向脱开）。
// - 东侧观星走廊：x∈[36,88], z∈[-12,12] 保持空旷（回响观星台道路 [68,0]）。
// - 西侧海域归海岸/岛屿地形所有：本表在 x<-40 不放条目；西北/西南远岸
//   岬角由 sea-minglan.ts 的 headland-nw / headland-sw 承担。
// - 河流走廊（晨溪 v2）：折线 (64,-95)(42,-97)(18,-96)(-6,-98)(-28,-97)
//   (-46,-99)(-56,-98)，峰心距中心线 ≥ r+3.35（水半宽 3 + 抖动余量），
//   树丛包络距中心线 ≥ 5；渲染层对树位另按 ±7.5 复核。x ≤ -43 段河口
//   条带已没入海面之下，b6（-48,-108）与其重叠是有意的海前丘。
// - 全图地面 220×220（-110..110）；山体为实体体积，基座埋入 y=0 以下，
//   不存在贴地平面，不参与 SURFACE_Y 的 z-fighting 体系。c2/c3 等 skirt
//   越过 -110 的条目以外海底层平面（明澜外海 y=-0.4）为基，视觉衔接。
import type { TerrainFeatureConfig } from './_types';

/**
 * 岚屏岭山脉要素表。渲染器逐条映射：
 * kind 'mountain' = 一座棱面山峰（渲染器按 id 哈希确定性生成抖动、
 * 双峰与雪冠变体）；kind 'forest' = 一片针叶松集群（8..14 棵，按 id
 * 确定性散布在 width/depth 包络圆内）；kind 'cliff' = 崖壁岩丘。
 */
export const LANPING_RANGE: readonly TerrainFeatureConfig[] = [
  // ── 北弧：晨溪背后的溪谷后坡（z -102..-110，v2 迁移后的单列山带）──
  { id: 'range-lanping-n-a1', kind: 'mountain', label: '岚屏岭·溪北一峰', x: 26, z: -106, width: 12, depth: 12, height: 7, renderHint: { color: 0x8fae72, castShadow: true }, navigationBlocking: true },
  { id: 'range-lanping-n-a2', kind: 'mountain', label: '岚屏岭·溪北二峰', x: 8, z: -107, width: 12, depth: 12, height: 7, renderHint: { color: 0x86a56a, castShadow: true }, navigationBlocking: true },
  { id: 'range-lanping-n-a3', kind: 'mountain', label: '岚屏岭·溪北三峰', x: -14, z: -107, width: 12, depth: 12, height: 8, renderHint: { color: 0x97b57e, castShadow: true }, navigationBlocking: true },
  { id: 'range-lanping-n-a4', kind: 'mountain', label: '岚屏岭·溪北四峰', x: -32, z: -108, width: 14, depth: 14, height: 9, renderHint: { color: 0x7fa06a, castShadow: true }, navigationBlocking: true },
  { id: 'range-lanping-n-b2', kind: 'mountain', label: '岚屏岭·溪北主峰', x: 44, z: -108, width: 14, depth: 14, height: 10, renderHint: { color: 0x5d8280, castShadow: true }, navigationBlocking: true },
  { id: 'range-lanping-n-b3', kind: 'mountain', label: '岚屏岭·溪谷东峰', x: 62, z: -107, width: 16, depth: 16, height: 12, renderHint: { color: 0x6b9090, castShadow: true }, navigationBlocking: true },
  { id: 'range-lanping-n-b4', kind: 'mountain', label: '岚屏岭·溪谷尽峰', x: 80, z: -104, width: 18, depth: 18, height: 18, renderHint: { color: 0x577b7a, castShadow: true }, navigationBlocking: true },
  { id: 'range-lanping-n-b5', kind: 'mountain', label: '岚屏岭·溪谷西峰', x: -38, z: -108, width: 12, depth: 12, height: 8, renderHint: { color: 0x6f9396, castShadow: true }, navigationBlocking: true },
  { id: 'range-lanping-n-b6', kind: 'mountain', label: '岚屏岭·海口丘', x: -48, z: -108, width: 16, depth: 16, height: 10, renderHint: { color: 0x5d8280, castShadow: true }, navigationBlocking: true },
  // 主城与北城之间的过渡孤峰（z 向脱开北城盒，x 向脱开主城环线）
  { id: 'range-lanping-n-a5', kind: 'mountain', label: '岚屏岭·东望丘', x: 54, z: -42, width: 18, depth: 18, height: 9, renderHint: { color: 0x8ba973, castShadow: true }, navigationBlocking: true },
  { id: 'range-lanping-n-b1', kind: 'mountain', label: '岚屏岭·东北主峰', x: 58, z: -70, width: 24, depth: 24, height: 16, renderHint: { color: 0x648a84, castShadow: true }, navigationBlocking: true },

  // ── 北远脊：天际线雾山（东段为主，不投影）──
  { id: 'range-lanping-n-c1', kind: 'mountain', label: '岚屏岭·北远脊一峰', x: 84, z: -102, width: 24, depth: 24, height: 22, renderHint: { color: 0xa6c0c8, castShadow: false }, navigationBlocking: true },
  { id: 'range-lanping-n-c2', kind: 'mountain', label: '岚屏岭·北远脊二峰', x: 24, z: -110, width: 14, depth: 14, height: 14, renderHint: { color: 0xafc7cd, castShadow: false }, navigationBlocking: true },
  { id: 'range-lanping-n-c3', kind: 'mountain', label: '岚屏岭·北远脊三峰', x: 52, z: -110, width: 14, depth: 14, height: 16, renderHint: { color: 0x9db9c3, castShadow: false }, navigationBlocking: true },

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

  // ── 崖壁：晨溪出谷的惊鸿崖 + 观星走廊北缘的观星崖 ──
  { id: 'range-lanping-cliff-01', kind: 'cliff', label: '惊鸿崖', x: 56, z: -38, width: 12, depth: 6, height: 7, renderHint: { color: 0x7e8a83, castShadow: true }, navigationBlocking: true },
  { id: 'range-lanping-cliff-02', kind: 'cliff', label: '观星崖', x: 84, z: -17, width: 12, depth: 5, height: 6, renderHint: { color: 0x87938b, castShadow: true }, navigationBlocking: true },

  // ── 针叶松集群（observatory-song 式叠锥松；包络圆内确定性散布 8..14 棵）──
  { id: 'range-lanping-pine-01', kind: 'forest', label: '松涛林·东北坡', x: 50, z: -30, width: 12, depth: 12, renderHint: { color: 0x3c6b50, castShadow: true } },
  { id: 'range-lanping-pine-02', kind: 'forest', label: '松涛林·北坡', x: 48, z: -73, width: 10, depth: 10, renderHint: { color: 0x33604a, castShadow: true } },
  { id: 'range-lanping-pine-03', kind: 'forest', label: '松涛林·东坡', x: 74, z: -26, width: 12, depth: 12, renderHint: { color: 0x3c6b50, castShadow: true } },
  { id: 'range-lanping-pine-04', kind: 'forest', label: '松涛林·望城坡', x: 74, z: 26, width: 12, depth: 12, renderHint: { color: 0x33604a, castShadow: true } },
  { id: 'range-lanping-pine-05', kind: 'forest', label: '松涛林·南麓', x: 16, z: 66, width: 12, depth: 12, renderHint: { color: 0x3c6b50, castShadow: true } },
  { id: 'range-lanping-pine-06', kind: 'forest', label: '松涛林·南坳', x: -24, z: 70, width: 12, depth: 12, renderHint: { color: 0x33604a, castShadow: true } },
  { id: 'range-lanping-pine-07', kind: 'forest', label: '松涛林·溪畔', x: 58, z: -76, width: 12, depth: 12, renderHint: { color: 0x3c6b50, castShadow: true } },
  { id: 'range-lanping-pine-08', kind: 'forest', label: '松涛林·东岭肩', x: 90, z: 46, width: 12, depth: 12, renderHint: { color: 0x33604a, castShadow: true } },
  { id: 'range-lanping-pine-09', kind: 'forest', label: '松涛林·溪北', x: 2, z: -106, width: 10, depth: 10, renderHint: { color: 0x33604a, castShadow: true } },
  { id: 'range-lanping-pine-10', kind: 'forest', label: '松涛林·溪谷东', x: 70, z: -108, width: 10, depth: 10, renderHint: { color: 0x3c6b50, castShadow: true } },
];
