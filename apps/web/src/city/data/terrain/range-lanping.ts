// 岚屏岭（Lanping Range）——城周连绵山脉的低多边形配置。
// v9 单面山布局（2026-10-11，sin 指令「不需要四面环山，就有一面山就行」）：
// 只保留北主脊链 + 溪谷侧丘 + 北麓链（晨溪穿谷的完整山麓层次），拆除
// 东北连接链/东主脊链/东麓链/南主脊链/南麓链共 22 座——东、南、西三个
// 方向留作开阔地（海对面将来跨海高速路/新城扩展，不立山）；其他方向
// 只保留松涛林与观星崖做轻装饰。山要可探索：北谷留出登山道走廊。
// 视觉参照 CG 启动图 assets/cg/echo/mountain-promise.png：山脉是首尾
// 重叠、连绵成环的岭链（峰间距 < 相邻半径之和，剪影无缝衔接），主脊
// 高大（h 104..208，雪带由渲染层着色器按海拔/坡度混合），麓丘链贴着主
// 脊坡脚，晨溪从北山谷中穿过；越远越亮越冷（大气透视烘进颜色，场景
// 不加 fog）。渲染层对山体做三平面程序纹理混合（草甸/岩壁/雪冠）。
//
// v5 精细化（2026-10-04，sin 反馈「北侧山建模太粗糙、太小」）：v4 巨型
// 化后仍读作远处的孤立山包。本版三管齐下：
// - 主脊再放大约 1.4×（直径 144..196、高 104..208），中线整体再外推
//   （北链 z -200..-234），从城里望去山墙占满地平线上半；
// - 麓原裙（piedmont）由渲染层为每座山生成朝城收束、背城展开的缓坡
//   基座，山不再「切」进平地；
// - 麓丘链同步放大 1.4×（h 32..58）并外推，与主脊、溪谷侧丘构成
//   「雪岭 → 麓丘 → 谷地草甸 → 晨溪」的完整山麓层次。
// 渲染器逐条 1:1 消费（x/z = 峰心，width/depth = 底座直径，height =
// 海拔，renderHint.color = 山体主色，castShadow = 是否投影；height ≥ 40
// 的主脊由渲染层强制不投影——远超阴影相机范围）。
//
// 空间约束（数值审计脚本逐条核对后方可改动，单测见
// apps/web/tests/unit/worldTerrainAudit.test.ts）：
// - 星语北城 keep-out 盒 x∈[-41,41], z∈[-88,-33]：任何山体/崖壁条目
//   的包围方框（x±r, z±r，r = max(width,depth)/2）不得进入该盒——
//   北链/北麓/溪谷侧丘按 z 向脱开（z + r ≤ -89），东/东北链按 x 向
//   脱开（x - r ≥ 94 > 41），南链按 z 向脱开（z - r ≥ 100）。
// - 观星走廊 x∈[36,88], z∈[-12,12]：东/东北链 x - r ≥ 94 > 88。
// - 导航可步行区 x∈[-50,84], z∈[-88,42]：同上按包围方框脱开。
// - 河道及两岸景观带（z -87..-107）：溪谷侧丘南缘 z + r ≤ -109，
//   与河岸森林/砾石带保持间隙。
// - 西侧海域归 sea-minglan（headland-nw 岬角北移让出晨溪河口湾，
//   中间留开阔海湾）；山体 skirt 越过地面边缘（|x|,|z| > 110）的部分
//   落在渲染层世界裙板（y=0）上，属预期衔接。
import type { TerrainFeatureConfig } from './_types';

/**
 * 岚屏岭山脉要素表。kind 'mountain' = 一座棱面山峰（id 哈希确定性生成
 * 多副峰/雪带）；'forest' = 针叶松集群（包络圆内散布 8..14 棵）；
 * 'cliff' = 崖壁岩丘。
 */
export const LANPING_RANGE: readonly TerrainFeatureConfig[] = [
  // ── 北主脊链：晨溪背后的连绵雪山墙（z -200..-234，跨 x -234..256）──
  { id: 'range-lanping-n-r1', kind: 'mountain', label: '岚屏岭·西阙峰', x: -152, z: -212, width: 168, depth: 168, height: 136, renderHint: { color: 0x648a84, castShadow: true }, navigationBlocking: true },
  { id: 'range-lanping-n-r2', kind: 'mountain', label: '岚屏岭·西主峰', x: -100, z: -224, width: 184, depth: 184, height: 168, renderHint: { color: 0x5d8280, castShadow: true }, navigationBlocking: true },
  { id: 'range-lanping-n-r3', kind: 'mountain', label: '岚屏岭·中坪峰', x: -42, z: -230, width: 192, depth: 192, height: 186, renderHint: { color: 0x6b9090, castShadow: true }, navigationBlocking: true },
  { id: 'range-lanping-n-r4', kind: 'mountain', label: '岚屏岭·最高峰', x: 26, z: -234, width: 196, depth: 196, height: 208, renderHint: { color: 0x577b7a, castShadow: true }, navigationBlocking: true },
  { id: 'range-lanping-n-r5', kind: 'mountain', label: '岚屏岭·东主峰', x: 88, z: -228, width: 184, depth: 184, height: 172, renderHint: { color: 0x648a84, castShadow: true }, navigationBlocking: true },
  { id: 'range-lanping-n-r6', kind: 'mountain', label: '岚屏岭·东阙峰', x: 140, z: -216, width: 164, depth: 164, height: 140, renderHint: { color: 0x6f9396, castShadow: true }, navigationBlocking: true },
  { id: 'range-lanping-n-r7', kind: 'mountain', label: '岚屏岭·东北角峰', x: 184, z: -200, width: 144, depth: 144, height: 104, renderHint: { color: 0x7a9a9e, castShadow: true }, navigationBlocking: true },

  // ── 溪谷侧丘：晨溪谷地北缘的低丘带（南缘 z+r ≤ -109，不压河岸景带）──
  { id: 'range-lanping-n-v1', kind: 'mountain', label: '岚屏岭·溪北丘一', x: 34, z: -122, width: 26, depth: 26, height: 15, renderHint: { color: 0x8fae72, castShadow: true }, navigationBlocking: true },
  { id: 'range-lanping-n-v2', kind: 'mountain', label: '岚屏岭·溪北丘二', x: 0, z: -124, width: 24, depth: 24, height: 13, renderHint: { color: 0x86a56a, castShadow: true }, navigationBlocking: true },
  { id: 'range-lanping-n-v3', kind: 'mountain', label: '岚屏岭·溪北丘三', x: -24, z: -122, width: 26, depth: 26, height: 14, renderHint: { color: 0x97b57e, castShadow: true }, navigationBlocking: true },
  { id: 'range-lanping-n-v4', kind: 'mountain', label: '岚屏岭·溪源丘', x: -76, z: -130, width: 42, depth: 42, height: 22, renderHint: { color: 0x8fae72, castShadow: true }, navigationBlocking: true },
  { id: 'range-lanping-n-v5', kind: 'mountain', label: '岚屏岭·溪口丘', x: 96, z: -128, width: 40, depth: 40, height: 24, renderHint: { color: 0x97b57e, castShadow: true }, navigationBlocking: true },

  // ── 北麓链：贴主脊坡脚的草绿麓丘带（z -166..-174，构成谷地北坡）──
  { id: 'range-lanping-n-f1', kind: 'mountain', label: '岚屏岭·北麓丘一', x: -128, z: -172, width: 88, depth: 88, height: 44, renderHint: { color: 0x8fae72, castShadow: true }, navigationBlocking: true },
  { id: 'range-lanping-n-f2', kind: 'mountain', label: '岚屏岭·北麓丘二', x: -66, z: -166, width: 96, depth: 96, height: 54, renderHint: { color: 0x86a56a, castShadow: true }, navigationBlocking: true },
  { id: 'range-lanping-n-f3', kind: 'mountain', label: '岚屏岭·北麓丘三', x: -10, z: -170, width: 100, depth: 100, height: 58, renderHint: { color: 0x97b57e, castShadow: true }, navigationBlocking: true },
  { id: 'range-lanping-n-f4', kind: 'mountain', label: '岚屏岭·北麓丘四', x: 48, z: -168, width: 94, depth: 94, height: 52, renderHint: { color: 0x7fa06a, castShadow: true }, navigationBlocking: true },
  { id: 'range-lanping-n-f5', kind: 'mountain', label: '岚屏岭·北麓丘五', x: 106, z: -174, width: 86, depth: 86, height: 46, renderHint: { color: 0x86a56a, castShadow: true }, navigationBlocking: true },
  { id: 'range-lanping-n-f6', kind: 'mountain', label: '岚屏岭·北麓丘六', x: 158, z: -166, width: 74, depth: 74, height: 36, renderHint: { color: 0x8ba973, castShadow: true }, navigationBlocking: true },

  // ── 崖壁：观星走廊北缘的观星崖（z + r = -16.5 < -12，按包围方框脱开走廊）──
  { id: 'range-lanping-cliff-02', kind: 'cliff', label: '观星崖', x: 84, z: -19, width: 12, depth: 5, height: 6, renderHint: { color: 0x87938b, castShadow: true }, navigationBlocking: true },

  // ── 针叶松集群（v9 单面山后留 5 处：北谷 4 + 南麓 1，轻装饰；包络圆内确定性
  // 散布 8..14 棵；距河折线 ±7.5 安全网在渲染层，坡位上限 MAX_PINE_GROUND_Y）──
  { id: 'range-lanping-pine-01', kind: 'forest', label: '松涛林·西麓', x: -100, z: -146, width: 26, depth: 26, renderHint: { color: 0x3c6b50, castShadow: true } },
  { id: 'range-lanping-pine-02', kind: 'forest', label: '松涛林·北谷西', x: -30, z: -116, width: 20, depth: 20, renderHint: { color: 0x33604a, castShadow: true } },
  { id: 'range-lanping-pine-03', kind: 'forest', label: '松涛林·溪谷东', x: 40, z: -118, width: 18, depth: 18, renderHint: { color: 0x3c6b50, castShadow: true } },
  { id: 'range-lanping-pine-08', kind: 'forest', label: '松涛林·南麓', x: 6, z: 136, width: 22, depth: 22, renderHint: { color: 0x33604a, castShadow: true } },
  { id: 'range-lanping-pine-10', kind: 'forest', label: '松涛林·溪北', x: 2, z: -114, width: 12, depth: 12, renderHint: { color: 0x33604a, castShadow: true } },
];
