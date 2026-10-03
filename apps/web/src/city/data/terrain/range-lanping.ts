// 岚屏岭（Lanping Range）——城周连绵山脉的低多边形配置。
// 视觉参照 CG 启动图 assets/cg/echo/mountain-promise.png：山脉是首尾
// 重叠、连绵成环的岭链（峰间距 < 相邻半径之和，剪影无缝衔接），主脊
// 高大（h 20..36，雪带见渲染层顶点色），麓丘链贴着主脊坡脚，晨溪从
// 北山谷中穿过；越远越亮越冷（大气透视烘进颜色，场景不加 fog）。
//
// v3 连绵化（2026-10）：v2 的离散峰被评「土堆」——本版把北/东北/东/
// 南四段改为主脊链 + 麓链 + 溪谷侧丘三类，同链峰距 ≈ 0.7×直径，
// 基座两两重叠成连续山体；主脊体量翻倍以上。渲染器逐条 1:1 消费
// （x/z = 峰心，width/depth = 底座直径，height = 海拔，renderHint.color
// = 山体主色，castShadow = 是否投影）。
//
// 空间约束（对表后方可改动）：
// - 星语北城 keep-out 盒 x∈[-41,41], z∈[-88,-33]：北链 z ≤ -105 靠 z 向
//   脱开；东/南链按 x/z 向脱开（东侧观星走廊 x∈[36,88], z∈[-12,12] 内
//   无峰心，走廊以东 x ≥ 88 允许越线，道路从山口通过）。
// - 晨溪 v2 折线 (64,-95)(42,-97)(18,-96)(-6,-98)(-28,-97)(-46,-99)
//   (-56,-98)：峰心距折线 ≥ 自身半径（基座可亲吻水线），树丛另按 ±7.5
//   安全网在渲染层。
// - 导航可步行区 x∈[-50,84], z∈[-88,42]：东链部分峰腰（x 80..84）与其
//   相交属既定取舍（玩家侧 cosmetic，NPC 沿路网不可达）。
// - 西侧海域归 sea-minglan（headland-nw/sw 岬角接续山势，中间留海峡
//   供晨溪出海）；山体 skirt 越过地面边缘（|x|,|z| > 110）的部分以
//   明澜外海（y=-0.4）为基，属预期衔接。
import type { TerrainFeatureConfig } from './_types';

/**
 * 岚屏岭山脉要素表。kind 'mountain' = 一座棱面山峰（id 哈希确定性生成
 * 抖动/双峰/雪带）；'forest' = 针叶松集群（包络圆内散布 8..14 棵）；
 * 'cliff' = 崖壁岩丘。
 */
export const LANPING_RANGE: readonly TerrainFeatureConfig[] = [
  // ── 北主脊链：晨溪背后的连绵雪山墙（z -112..-115，跨 x -54..86）──
  { id: 'range-lanping-n-r1', kind: 'mountain', label: '岚屏岭·西阙峰', x: -54, z: -114, width: 32, depth: 32, height: 24, renderHint: { color: 0x648a84, castShadow: true }, navigationBlocking: true },
  { id: 'range-lanping-n-r2', kind: 'mountain', label: '岚屏岭·西主峰', x: -30, z: -115, width: 34, depth: 34, height: 28, renderHint: { color: 0x5d8280, castShadow: true }, navigationBlocking: true },
  { id: 'range-lanping-n-r3', kind: 'mountain', label: '岚屏岭·中坪峰', x: -8, z: -114, width: 32, depth: 32, height: 32, renderHint: { color: 0x6b9090, castShadow: true }, navigationBlocking: true },
  { id: 'range-lanping-n-r4', kind: 'mountain', label: '岚屏岭·最高峰', x: 16, z: -114, width: 34, depth: 34, height: 36, renderHint: { color: 0x577b7a, castShadow: true }, navigationBlocking: true },
  { id: 'range-lanping-n-r5', kind: 'mountain', label: '岚屏岭·东主峰', x: 42, z: -115, width: 32, depth: 32, height: 30, renderHint: { color: 0x648a84, castShadow: true }, navigationBlocking: true },
  { id: 'range-lanping-n-r6', kind: 'mountain', label: '岚屏岭·东阙峰', x: 66, z: -112, width: 32, depth: 32, height: 26, renderHint: { color: 0x6f9396, castShadow: true }, navigationBlocking: true },
  { id: 'range-lanping-n-r7', kind: 'mountain', label: '岚屏岭·东北角峰', x: 86, z: -114, width: 28, depth: 28, height: 22, renderHint: { color: 0x7a9a9e, castShadow: true }, navigationBlocking: true },

  // ── 溪谷侧丘：晨溪北岸的低丘（主脊坡脚前的一层）──
  { id: 'range-lanping-n-v1', kind: 'mountain', label: '岚屏岭·溪北丘一', x: 30, z: -105, width: 16, depth: 16, height: 7, renderHint: { color: 0x8fae72, castShadow: true }, navigationBlocking: true },
  { id: 'range-lanping-n-v2', kind: 'mountain', label: '岚屏岭·溪北丘二', x: 0, z: -105, width: 14, depth: 14, height: 6, renderHint: { color: 0x86a56a, castShadow: true }, navigationBlocking: true },
  { id: 'range-lanping-n-v3', kind: 'mountain', label: '岚屏岭·溪北丘三', x: -20, z: -106, width: 16, depth: 16, height: 7, renderHint: { color: 0x97b57e, castShadow: true }, navigationBlocking: true },

  // ── 东北连接链：北主脊向东南折向东主脊（包裹东北角）──
  { id: 'range-lanping-ne-r1', kind: 'mountain', label: '岚屏岭·东北折峰', x: 98, z: -108, width: 30, depth: 30, height: 20, renderHint: { color: 0x648a84, castShadow: true }, navigationBlocking: true },
  { id: 'range-lanping-ne-r2', kind: 'mountain', label: '岚屏岭·东角峰', x: 104, z: -84, width: 32, depth: 32, height: 24, renderHint: { color: 0x5d8280, castShadow: true }, navigationBlocking: true },
  { id: 'range-lanping-ne-r3', kind: 'mountain', label: '岚屏岭·东陛峰', x: 102, z: -58, width: 30, depth: 30, height: 22, renderHint: { color: 0x6b9090, castShadow: true }, navigationBlocking: true },

  // ── 东主脊链：观星走廊以东的南北向山墙（走廊以东 x ≥ 88 通过）──
  { id: 'range-lanping-e-r1', kind: 'mountain', label: '岚屏岭·东坡主峰', x: 80, z: -54, width: 30, depth: 30, height: 22, renderHint: { color: 0x648a84, castShadow: true }, navigationBlocking: true },
  { id: 'range-lanping-e-r2', kind: 'mountain', label: '岚屏岭·观星崖北峰', x: 84, z: -34, width: 34, depth: 34, height: 26, renderHint: { color: 0x5d8280, castShadow: true }, navigationBlocking: true },
  { id: 'range-lanping-e-r3', kind: 'mountain', label: '岚屏岭·东阙主峰', x: 102, z: -2, width: 24, depth: 24, height: 20, renderHint: { color: 0x6b9090, castShadow: true }, navigationBlocking: true },
  { id: 'range-lanping-e-r4', kind: 'mountain', label: '岚屏岭·东陛南峰', x: 106, z: 10, width: 26, depth: 26, height: 20, renderHint: { color: 0x577b7a, castShadow: true }, navigationBlocking: true },
  { id: 'range-lanping-e-r5', kind: 'mountain', label: '岚屏岭·东南主峰', x: 104, z: 28, width: 28, depth: 28, height: 24, renderHint: { color: 0x648a84, castShadow: true }, navigationBlocking: true },
  { id: 'range-lanping-e-r6', kind: 'mountain', label: '岚屏岭·东南二峰', x: 92, z: 42, width: 30, depth: 30, height: 26, renderHint: { color: 0x5d8280, castShadow: true }, navigationBlocking: true },
  { id: 'range-lanping-e-r7', kind: 'mountain', label: '岚屏岭·东南三峰', x: 88, z: 58, width: 28, depth: 28, height: 22, renderHint: { color: 0x6b9090, castShadow: true }, navigationBlocking: true },

  // ── 东麓链：贴主脊坡脚的草绿麓丘 ──
  { id: 'range-lanping-e-f1', kind: 'mountain', label: '岚屏岭·东麓丘一', x: 66, z: -44, width: 22, depth: 22, height: 11, renderHint: { color: 0x8fae72, castShadow: true }, navigationBlocking: true },
  { id: 'range-lanping-e-f2', kind: 'mountain', label: '岚屏岭·东麓丘二', x: 72, z: -24, width: 18, depth: 18, height: 8, renderHint: { color: 0x97b57e, castShadow: true }, navigationBlocking: true },
  { id: 'range-lanping-e-f3', kind: 'mountain', label: '岚屏岭·东麓丘三', x: 76, z: 24, width: 18, depth: 18, height: 10, renderHint: { color: 0x7fa06a, castShadow: true }, navigationBlocking: true },
  { id: 'range-lanping-e-f4', kind: 'mountain', label: '岚屏岭·东麓丘四', x: 68, z: 44, width: 22, depth: 22, height: 12, renderHint: { color: 0x86a56a, castShadow: true }, navigationBlocking: true },

  // ── 南主脊链：城南东西向山墙（接东南角连成环）──
  { id: 'range-lanping-s-r1', kind: 'mountain', label: '岚屏岭·西南角峰', x: -16, z: 96, width: 32, depth: 32, height: 26, renderHint: { color: 0x648a84, castShadow: true }, navigationBlocking: true },
  { id: 'range-lanping-s-r2', kind: 'mountain', label: '岚屏岭·南主峰', x: 8, z: 98, width: 34, depth: 34, height: 30, renderHint: { color: 0x5d8280, castShadow: true }, navigationBlocking: true },
  { id: 'range-lanping-s-r3', kind: 'mountain', label: '岚屏岭·南坪峰', x: 34, z: 96, width: 32, depth: 32, height: 34, renderHint: { color: 0x6b9090, castShadow: true }, navigationBlocking: true },
  { id: 'range-lanping-s-r4', kind: 'mountain', label: '岚屏岭·南阙峰', x: 58, z: 94, width: 30, depth: 30, height: 28, renderHint: { color: 0x577b7a, castShadow: true }, navigationBlocking: true },
  { id: 'range-lanping-s-r5', kind: 'mountain', label: '岚屏岭·东南角峰', x: 78, z: 92, width: 28, depth: 28, height: 22, renderHint: { color: 0x6f9396, castShadow: true }, navigationBlocking: true },
  { id: 'range-lanping-s-r6', kind: 'mountain', label: '岚屏岭·东南连峰', x: 86, z: 76, width: 26, depth: 26, height: 20, renderHint: { color: 0x648a84, castShadow: true }, navigationBlocking: true },

  // ── 南麓链：城南草绿麓丘 ──
  { id: 'range-lanping-s-f1', kind: 'mountain', label: '岚屏岭·南麓丘一', x: -20, z: 90, width: 22, depth: 22, height: 10, renderHint: { color: 0x8fae72, castShadow: true }, navigationBlocking: true },
  { id: 'range-lanping-s-f2', kind: 'mountain', label: '岚屏岭·南麓丘二', x: 0, z: 80, width: 24, depth: 24, height: 12, renderHint: { color: 0x86a56a, castShadow: true }, navigationBlocking: true },
  { id: 'range-lanping-s-f3', kind: 'mountain', label: '岚屏岭·南麓丘三', x: 24, z: 82, width: 22, depth: 22, height: 11, renderHint: { color: 0x97b57e, castShadow: true }, navigationBlocking: true },
  { id: 'range-lanping-s-f4', kind: 'mountain', label: '岚屏岭·南麓丘四', x: 46, z: 80, width: 22, depth: 22, height: 10, renderHint: { color: 0x7fa06a, castShadow: true }, navigationBlocking: true },
  { id: 'range-lanping-s-f5', kind: 'mountain', label: '岚屏岭·南麓丘五', x: 66, z: 84, width: 18, depth: 18, height: 9, renderHint: { color: 0x8ba973, castShadow: true }, navigationBlocking: true },

  // ── 崖壁：观星走廊北缘的观星崖（惊鸿崖随 v3 连绵化并入主脊剪影）──
  { id: 'range-lanping-cliff-02', kind: 'cliff', label: '观星崖', x: 84, z: -17, width: 12, depth: 5, height: 6, renderHint: { color: 0x87938b, castShadow: true }, navigationBlocking: true },

  // ── 针叶松集群（包络圆内确定性散布 8..14 棵；距河折线 ±7.5 安全网在渲染层）──
  { id: 'range-lanping-pine-01', kind: 'forest', label: '松涛林·东北坡', x: 50, z: -30, width: 12, depth: 12, renderHint: { color: 0x3c6b50, castShadow: true } },
  { id: 'range-lanping-pine-02', kind: 'forest', label: '松涛林·北坡', x: 48, z: -73, width: 10, depth: 10, renderHint: { color: 0x33604a, castShadow: true } },
  { id: 'range-lanping-pine-03', kind: 'forest', label: '松涛林·东坡', x: 70, z: -40, width: 12, depth: 12, renderHint: { color: 0x3c6b50, castShadow: true } },
  { id: 'range-lanping-pine-04', kind: 'forest', label: '松涛林·望城坡', x: 70, z: 30, width: 12, depth: 12, renderHint: { color: 0x33604a, castShadow: true } },
  { id: 'range-lanping-pine-05', kind: 'forest', label: '松涛林·南麓', x: 12, z: 72, width: 12, depth: 12, renderHint: { color: 0x3c6b50, castShadow: true } },
  { id: 'range-lanping-pine-06', kind: 'forest', label: '松涛林·南坳', x: -24, z: 80, width: 12, depth: 12, renderHint: { color: 0x33604a, castShadow: true } },
  { id: 'range-lanping-pine-07', kind: 'forest', label: '松涛林·溪畔', x: 58, z: -76, width: 12, depth: 12, renderHint: { color: 0x3c6b50, castShadow: true } },
  { id: 'range-lanping-pine-08', kind: 'forest', label: '松涛林·东岭肩', x: 88, z: 70, width: 12, depth: 12, renderHint: { color: 0x33604a, castShadow: true } },
  { id: 'range-lanping-pine-09', kind: 'forest', label: '松涛林·溪北', x: 4, z: -106, width: 10, depth: 10, renderHint: { color: 0x33604a, castShadow: true } },
  { id: 'range-lanping-pine-10', kind: 'forest', label: '松涛林·溪谷东', x: 26, z: -104, width: 10, depth: 10, renderHint: { color: 0x3c6b50, castShadow: true } },
];
