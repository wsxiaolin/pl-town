// 岚屏岭（Lanping Range）——城周连绵山脉的低多边形配置。
// 视觉参照 CG 启动图 assets/cg/echo/mountain-promise.png：山脉是首尾
// 重叠、连绵成环的岭链（峰间距 < 相邻半径之和，剪影无缝衔接），主脊
// 高大（h 70..140，雪带由渲染层着色器按海拔/坡度混合），麓丘链贴着主
// 脊坡脚，晨溪从北山谷中穿过；越远越亮越冷（大气透视烘进颜色，场景
// 不加 fog）。渲染层对山体做三平面程序纹理混合（草甸/岩壁/雪冠）。
//
// v4 巨型化（2026-10）：v3 仍被评「太小、读作 inexplicable geometric
// shapes / 埋在土里的圆顶」。本版把山链整体外推放大 ≈4×：主脊直径
// 100..160、高 70..140；麓丘直径 40..70、高 15..35；溪谷侧丘直径
// 24..40、高 8..16（既有溪畔小三丘按原样保留）。渲染器逐条 1:1 消费
// （x/z = 峰心，width/depth = 底座直径，height = 海拔，renderHint.color
// = 山体主色，castShadow = 是否投影；height ≥ 40 的主脊由渲染层强制
// 不投影——远超阴影相机范围）。
//
// 空间约束（数值审计脚本逐条核对后方可改动）：
// - 星语北城 keep-out 盒 x∈[-41,41], z∈[-88,-33]：任何条目的包围方框
//   （x±r, z±r，r = width/2）不得进入该盒——北链/北麓按 z 向脱开
//   （z + r ≤ -89），东/东北链按 x 向脱开（x - r ≥ 94 > 41）。
// - 观星走廊 x∈[36,88], z∈[-12,12]：同样按包围方框脱开——东链全部
//   x - r ≥ 94 > 88；北链/南链按 z 向脱开；观星崖 z + r = -13 < -12。
// - 晨溪 v2 折线 (64,-95)(42,-97)(18,-96)(-6,-98)(-28,-97)(-46,-99)
//   (-56,-98)：峰心距折线 ≥ 自身半径（基座可亲吻水线）。
// - 导航可步行区 x∈[-50,84], z∈[-88,42]：新链全部按包围方框脱开
//   （北链 z + r ≤ -89，东链 x - r ≥ 94，南链 z - r ≥ 100）。
// - 西侧海域归 sea-minglan（headland-nw/sw 岬角接续山势，中间留海峡
//   供晨溪出海）；山体 skirt 越过地面边缘（|x|,|z| > 110）的部分落在
//   渲染层世界裙板（y=0）上，属预期衔接。
import type { TerrainFeatureConfig } from './_types';

/**
 * 岚屏岭山脉要素表。kind 'mountain' = 一座棱面山峰（id 哈希确定性生成
 * 抖动/双峰/雪带）；'forest' = 针叶松集群（包络圆内散布 8..14 棵）；
 * 'cliff' = 崖壁岩丘。
 */
export const LANPING_RANGE: readonly TerrainFeatureConfig[] = [
  // ── 北主脊链：晨溪背后的连绵雪山墙（z -158..-188，跨 x -150..178）──
  { id: 'range-lanping-n-r1', kind: 'mountain', label: '岚屏岭·西阙峰', x: -150, z: -172, width: 120, depth: 120, height: 88, renderHint: { color: 0x648a84, castShadow: true }, navigationBlocking: true },
  { id: 'range-lanping-n-r2', kind: 'mountain', label: '岚屏岭·西主峰', x: -96, z: -182, width: 140, depth: 140, height: 108, renderHint: { color: 0x5d8280, castShadow: true }, navigationBlocking: true },
  { id: 'range-lanping-n-r3', kind: 'mountain', label: '岚屏岭·中坪峰', x: -40, z: -186, width: 150, depth: 150, height: 122, renderHint: { color: 0x6b9090, castShadow: true }, navigationBlocking: true },
  { id: 'range-lanping-n-r4', kind: 'mountain', label: '岚屏岭·最高峰', x: 24, z: -188, width: 160, depth: 160, height: 140, renderHint: { color: 0x577b7a, castShadow: true }, navigationBlocking: true },
  { id: 'range-lanping-n-r5', kind: 'mountain', label: '岚屏岭·东主峰', x: 86, z: -184, width: 140, depth: 140, height: 112, renderHint: { color: 0x648a84, castShadow: true }, navigationBlocking: true },
  { id: 'range-lanping-n-r6', kind: 'mountain', label: '岚屏岭·东阙峰', x: 136, z: -172, width: 120, depth: 120, height: 92, renderHint: { color: 0x6f9396, castShadow: true }, navigationBlocking: true },
  { id: 'range-lanping-n-r7', kind: 'mountain', label: '岚屏岭·东北角峰', x: 178, z: -158, width: 100, depth: 100, height: 76, renderHint: { color: 0x7a9a9e, castShadow: true }, navigationBlocking: true },

  // ── 溪谷侧丘：晨溪两岸的低丘（前两列 v1..v3 为 v3 原样保留）──
  { id: 'range-lanping-n-v1', kind: 'mountain', label: '岚屏岭·溪北丘一', x: 30, z: -105, width: 16, depth: 16, height: 7, renderHint: { color: 0x8fae72, castShadow: true }, navigationBlocking: true },
  { id: 'range-lanping-n-v2', kind: 'mountain', label: '岚屏岭·溪北丘二', x: 0, z: -105, width: 14, depth: 14, height: 6, renderHint: { color: 0x86a56a, castShadow: true }, navigationBlocking: true },
  { id: 'range-lanping-n-v3', kind: 'mountain', label: '岚屏岭·溪北丘三', x: -20, z: -106, width: 16, depth: 16, height: 7, renderHint: { color: 0x97b57e, castShadow: true }, navigationBlocking: true },
  { id: 'range-lanping-n-v4', kind: 'mountain', label: '岚屏岭·溪源丘', x: -72, z: -104, width: 28, depth: 28, height: 12, renderHint: { color: 0x8fae72, castShadow: true }, navigationBlocking: true },
  { id: 'range-lanping-n-v5', kind: 'mountain', label: '岚屏岭·溪口丘', x: 78, z: -108, width: 30, depth: 30, height: 13, renderHint: { color: 0x97b57e, castShadow: true }, navigationBlocking: true },

  // ── 北麓链：贴主脊坡脚的草绿麓丘（z -134..-142）──
  { id: 'range-lanping-n-f1', kind: 'mountain', label: '岚屏岭·北麓丘一', x: -120, z: -140, width: 56, depth: 56, height: 24, renderHint: { color: 0x8fae72, castShadow: true }, navigationBlocking: true },
  { id: 'range-lanping-n-f2', kind: 'mountain', label: '岚屏岭·北麓丘二', x: -62, z: -134, width: 64, depth: 64, height: 28, renderHint: { color: 0x86a56a, castShadow: true }, navigationBlocking: true },
  { id: 'range-lanping-n-f3', kind: 'mountain', label: '岚屏岭·北麓丘三', x: -8, z: -137, width: 68, depth: 68, height: 32, renderHint: { color: 0x97b57e, castShadow: true }, navigationBlocking: true },
  { id: 'range-lanping-n-f4', kind: 'mountain', label: '岚屏岭·北麓丘四', x: 46, z: -136, width: 64, depth: 64, height: 30, renderHint: { color: 0x7fa06a, castShadow: true }, navigationBlocking: true },
  { id: 'range-lanping-n-f5', kind: 'mountain', label: '岚屏岭·北麓丘五', x: 104, z: -142, width: 60, depth: 60, height: 26, renderHint: { color: 0x86a56a, castShadow: true }, navigationBlocking: true },
  { id: 'range-lanping-n-f6', kind: 'mountain', label: '岚屏岭·北麓丘六', x: 152, z: -136, width: 48, depth: 48, height: 20, renderHint: { color: 0x8ba973, castShadow: true }, navigationBlocking: true },

  // ── 东北连接链：北主脊向东南折向东主脊（包裹东北角，x 172..196）──
  { id: 'range-lanping-ne-r1', kind: 'mountain', label: '岚屏岭·东北折峰', x: 172, z: -128, width: 130, depth: 130, height: 96, renderHint: { color: 0x648a84, castShadow: true }, navigationBlocking: true },
  { id: 'range-lanping-ne-r2', kind: 'mountain', label: '岚屏岭·东角峰', x: 188, z: -88, width: 140, depth: 140, height: 112, renderHint: { color: 0x5d8280, castShadow: true }, navigationBlocking: true },
  { id: 'range-lanping-ne-r3', kind: 'mountain', label: '岚屏岭·东陛峰', x: 196, z: -48, width: 120, depth: 120, height: 84, renderHint: { color: 0x6b9090, castShadow: true }, navigationBlocking: true },

  // ── 东主脊链：观星走廊以东的南北向山墙（x - r ≥ 94 > 88，走廊以东通过）──
  { id: 'range-lanping-e-r1', kind: 'mountain', label: '岚屏岭·东坡主峰', x: 168, z: -38, width: 120, depth: 120, height: 88, renderHint: { color: 0x648a84, castShadow: true }, navigationBlocking: true },
  { id: 'range-lanping-e-r2', kind: 'mountain', label: '岚屏岭·观星崖北峰', x: 172, z: 4, width: 140, depth: 140, height: 110, renderHint: { color: 0x5d8280, castShadow: true }, navigationBlocking: true },
  { id: 'range-lanping-e-r3', kind: 'mountain', label: '岚屏岭·东阙主峰', x: 186, z: 46, width: 144, depth: 144, height: 128, renderHint: { color: 0x6b9090, castShadow: true }, navigationBlocking: true },
  { id: 'range-lanping-e-r4', kind: 'mountain', label: '岚屏岭·东陛南峰', x: 176, z: 92, width: 130, depth: 130, height: 96, renderHint: { color: 0x577b7a, castShadow: true }, navigationBlocking: true },

  // ── 东麓链：贴主脊坡脚的草绿麓丘（x 120..128，全部 x - r ≥ 94）──
  { id: 'range-lanping-e-f1', kind: 'mountain', label: '岚屏岭·东麓丘一', x: 122, z: -62, width: 56, depth: 56, height: 24, renderHint: { color: 0x8fae72, castShadow: true }, navigationBlocking: true },
  { id: 'range-lanping-e-f2', kind: 'mountain', label: '岚屏岭·东麓丘二', x: 120, z: -16, width: 48, depth: 48, height: 18, renderHint: { color: 0x97b57e, castShadow: true }, navigationBlocking: true },
  { id: 'range-lanping-e-f3', kind: 'mountain', label: '岚屏岭·东麓丘三', x: 126, z: 30, width: 52, depth: 52, height: 20, renderHint: { color: 0x7fa06a, castShadow: true }, navigationBlocking: true },
  { id: 'range-lanping-e-f4', kind: 'mountain', label: '岚屏岭·东麓丘四', x: 124, z: 74, width: 56, depth: 56, height: 24, renderHint: { color: 0x86a56a, castShadow: true }, navigationBlocking: true },
  { id: 'range-lanping-e-f5', kind: 'mountain', label: '岚屏岭·东麓丘五', x: 128, z: 116, width: 48, depth: 48, height: 18, renderHint: { color: 0x8ba973, castShadow: true }, navigationBlocking: true },

  // ── 南主脊链：城南东西向山墙（接东南角连成环，z 150..186）──
  { id: 'range-lanping-s-r1', kind: 'mountain', label: '岚屏岭·西南角峰', x: -52, z: 172, width: 120, depth: 120, height: 86, renderHint: { color: 0x648a84, castShadow: true }, navigationBlocking: true },
  { id: 'range-lanping-s-r2', kind: 'mountain', label: '岚屏岭·南主峰', x: 10, z: 182, width: 150, depth: 150, height: 124, renderHint: { color: 0x5d8280, castShadow: true }, navigationBlocking: true },
  { id: 'range-lanping-s-r3', kind: 'mountain', label: '岚屏岭·南坪峰', x: 78, z: 186, width: 160, depth: 160, height: 140, renderHint: { color: 0x6b9090, castShadow: true }, navigationBlocking: true },
  { id: 'range-lanping-s-r4', kind: 'mountain', label: '岚屏岭·南阙峰', x: 142, z: 176, width: 130, depth: 130, height: 100, renderHint: { color: 0x577b7a, castShadow: true }, navigationBlocking: true },
  { id: 'range-lanping-s-r5', kind: 'mountain', label: '岚屏岭·东南连峰', x: 170, z: 150, width: 100, depth: 100, height: 72, renderHint: { color: 0x6f9396, castShadow: true }, navigationBlocking: true },

  // ── 南麓链：城南草绿麓丘（z 130..138）──
  { id: 'range-lanping-s-f1', kind: 'mountain', label: '岚屏岭·南麓丘一', x: -34, z: 138, width: 60, depth: 60, height: 26, renderHint: { color: 0x8fae72, castShadow: true }, navigationBlocking: true },
  { id: 'range-lanping-s-f2', kind: 'mountain', label: '岚屏岭·南麓丘二', x: 14, z: 132, width: 68, depth: 68, height: 32, renderHint: { color: 0x86a56a, castShadow: true }, navigationBlocking: true },
  { id: 'range-lanping-s-f3', kind: 'mountain', label: '岚屏岭·南麓丘三', x: 60, z: 136, width: 64, depth: 64, height: 30, renderHint: { color: 0x97b57e, castShadow: true }, navigationBlocking: true },
  { id: 'range-lanping-s-f4', kind: 'mountain', label: '岚屏岭·南麓丘四', x: 108, z: 132, width: 56, depth: 56, height: 24, renderHint: { color: 0x7fa06a, castShadow: true }, navigationBlocking: true },
  { id: 'range-lanping-s-f5', kind: 'mountain', label: '岚屏岭·南麓丘五', x: -78, z: 130, width: 48, depth: 48, height: 18, renderHint: { color: 0x8ba973, castShadow: true }, navigationBlocking: true },

  // ── 崖壁：观星走廊北缘的观星崖（z + r = -13 < -12，按包围方框脱开走廊）──
  { id: 'range-lanping-cliff-02', kind: 'cliff', label: '观星崖', x: 84, z: -19, width: 12, depth: 5, height: 6, renderHint: { color: 0x87938b, castShadow: true }, navigationBlocking: true },

  // ── 针叶松集群（10 处，落在麓丘裙摆与溪谷侧丘坡脚；包络圆内确定性
  // 散布 8..14 棵；距河折线 ±7.5 安全网在渲染层，坡位上限 MAX_PINE_GROUND_Y）──
  { id: 'range-lanping-pine-01', kind: 'forest', label: '松涛林·西麓', x: -94, z: -122, width: 22, depth: 22, renderHint: { color: 0x3c6b50, castShadow: true } },
  { id: 'range-lanping-pine-02', kind: 'forest', label: '松涛林·北谷西', x: -26, z: -110, width: 20, depth: 20, renderHint: { color: 0x33604a, castShadow: true } },
  { id: 'range-lanping-pine-03', kind: 'forest', label: '松涛林·溪谷东', x: 58, z: -110, width: 18, depth: 18, renderHint: { color: 0x3c6b50, castShadow: true } },
  { id: 'range-lanping-pine-04', kind: 'forest', label: '松涛林·东北坡', x: 150, z: -118, width: 20, depth: 20, renderHint: { color: 0x33604a, castShadow: true } },
  { id: 'range-lanping-pine-05', kind: 'forest', label: '松涛林·东坡', x: 100, z: -50, width: 20, depth: 20, renderHint: { color: 0x3c6b50, castShadow: true } },
  { id: 'range-lanping-pine-06', kind: 'forest', label: '松涛林·观星坡', x: 108, z: 12, width: 18, depth: 18, renderHint: { color: 0x33604a, castShadow: true } },
  { id: 'range-lanping-pine-07', kind: 'forest', label: '松涛林·东南坡', x: 108, z: 92, width: 20, depth: 20, renderHint: { color: 0x3c6b50, castShadow: true } },
  { id: 'range-lanping-pine-08', kind: 'forest', label: '松涛林·南麓', x: 24, z: 104, width: 22, depth: 22, renderHint: { color: 0x33604a, castShadow: true } },
  { id: 'range-lanping-pine-09', kind: 'forest', label: '松涛林·西南谷', x: -52, z: 122, width: 20, depth: 20, renderHint: { color: 0x3c6b50, castShadow: true } },
  { id: 'range-lanping-pine-10', kind: 'forest', label: '松涛林·溪北', x: 4, z: -106, width: 10, depth: 10, renderHint: { color: 0x33604a, castShadow: true } },
];
