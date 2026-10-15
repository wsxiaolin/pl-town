// 岚屏岭数据：北侧四座主峰（高 56..100）、溪谷侧丘与北麓丘，另含观星崖和松林。
// mountain 的 x/z、width/depth、height 定义连续山体场的峰位、范围和高度；
// 渲染层统一生成山脊、鞍部、草甸、岩壁和雪带，并提供两级网格 LOD。
// 城区、观星走廊与河岸净空由 worldTerrainAudit.test.ts 校验。
import type { TerrainFeatureConfig } from './_types';

/**
 * mountain 为连续山体场输入，forest 为确定性松林散布区，cliff 为独立岩丘。
 */
export const LANPING_RANGE: readonly TerrainFeatureConfig[] = [
  // ── 主峰群：偏心构图形成远景主峰、中景侧峰和开阔山谷 ───────────────
  { id: 'range-lanping-hero', kind: 'mountain', label: '岚屏岭·天柱主峰', x: 34, z: -202, width: 160, depth: 152, height: 100, renderHint: { color: 0x5a7f86, castShadow: true }, navigationBlocking: true },
  { id: 'range-lanping-west-spire', kind: 'mountain', label: '岚屏岭·西侧尖峰', x: -68, z: -184, width: 132, depth: 128, height: 73, renderHint: { color: 0x678d91, castShadow: true }, navigationBlocking: true },
  { id: 'range-lanping-east-spire', kind: 'mountain', label: '岚屏岭·东侧尖峰', x: 132, z: -190, width: 140, depth: 136, height: 82, renderHint: { color: 0x638991, castShadow: true }, navigationBlocking: true },
  { id: 'range-lanping-back-ridge', kind: 'mountain', label: '岚屏岭·远脊', x: 200, z: -224, width: 124, depth: 112, height: 56, renderHint: { color: 0x7899a0, castShadow: true }, navigationBlocking: true },

  // ── 溪谷侧丘：晨溪谷地北缘的低丘带（南缘 z+r ≤ -109，不压河岸景带）──
  { id: 'range-lanping-n-v1', kind: 'mountain', label: '岚屏岭·溪北丘一', x: 44, z: -126, width: 34, depth: 28, height: 24, renderHint: { color: 0x8fae72, castShadow: true }, navigationBlocking: true },
  { id: 'range-lanping-n-v2', kind: 'mountain', label: '岚屏岭·溪北丘二', x: 8, z: -130, width: 30, depth: 26, height: 20, renderHint: { color: 0x86a56a, castShadow: true }, navigationBlocking: true },
  { id: 'range-lanping-n-v3', kind: 'mountain', label: '岚屏岭·溪北丘三', x: -32, z: -126, width: 34, depth: 28, height: 22, renderHint: { color: 0x97b57e, castShadow: true }, navigationBlocking: true },
  { id: 'range-lanping-n-v4', kind: 'mountain', label: '岚屏岭·溪源丘', x: -78, z: -132, width: 48, depth: 36, height: 34, renderHint: { color: 0x8fae72, castShadow: true }, navigationBlocking: true },

  // ── 北麓链：贴主脊坡脚的草绿麓丘带 ──
  { id: 'range-lanping-n-f1', kind: 'mountain', label: '岚屏岭·北麓丘一', x: -88, z: -154, width: 76, depth: 48, height: 24, renderHint: { color: 0x8fae72, castShadow: true }, navigationBlocking: true },
  { id: 'range-lanping-n-f2', kind: 'mountain', label: '岚屏岭·北麓丘二', x: -28, z: -162, width: 88, depth: 54, height: 30, renderHint: { color: 0x86a56a, castShadow: true }, navigationBlocking: true },
  { id: 'range-lanping-n-f3', kind: 'mountain', label: '岚屏岭·北麓丘三', x: 120, z: -158, width: 82, depth: 54, height: 32, renderHint: { color: 0x97b57e, castShadow: true }, navigationBlocking: true },
  { id: 'range-lanping-n-f4', kind: 'mountain', label: '岚屏岭·北麓丘四', x: 136, z: -150, width: 54, depth: 42, height: 24, renderHint: { color: 0x7fa06a, castShadow: true }, navigationBlocking: true },

  // ── 崖壁：观星走廊北缘的观星崖（z + r = -16.5 < -12，按包围方框脱开走廊）──
  { id: 'range-lanping-cliff-02', kind: 'cliff', label: '观星崖', x: 84, z: -19, width: 12, depth: 5, height: 6, renderHint: { color: 0x87938b, castShadow: true }, navigationBlocking: true },

  // ── 松林散布区：每区尝试 12 棵，渲染层按高度、坡度和河谷范围筛选 ──
  { id: 'range-lanping-pine-01', kind: 'forest', label: '松涛林·西麓', x: -100, z: -146, width: 26, depth: 26, renderHint: { color: 0x3c6b50, castShadow: true } },
  { id: 'range-lanping-pine-02', kind: 'forest', label: '松涛林·北谷西', x: -30, z: -116, width: 20, depth: 20, renderHint: { color: 0x33604a, castShadow: true } },
  { id: 'range-lanping-pine-03', kind: 'forest', label: '松涛林·溪谷东', x: 40, z: -118, width: 18, depth: 18, renderHint: { color: 0x3c6b50, castShadow: true } },
  { id: 'range-lanping-pine-08', kind: 'forest', label: '松涛林·南麓', x: 6, z: 136, width: 22, depth: 22, renderHint: { color: 0x33604a, castShadow: true } },
  { id: 'range-lanping-pine-10', kind: 'forest', label: '松涛林·溪北', x: 2, z: -114, width: 12, depth: 12, renderHint: { color: 0x33604a, castShadow: true } },
];
