// 城缘草甸（cityside meadow）——城市地面建模的地形配置（纯数据）。
//
// v7（2026-10-06，「对城市地面也进行建模」）：district 方正铺装面（±75）
// 与世界裙板（y=0 平地）之间铺两片低多边形起伏草甸，让城市「长」在
// 地形上而不是贴在平面上——南瓣面向主城开阔展开，东北瓣沿晨溪河谷
// 东段起伏，与岚屏岭麓原裙（mountainRanges piedmont）材质同源、连成
// 一体。渲染实现见 rendering/terrain/cityGround.ts。
//
// 空间约束（数值审计见 tests/unit/worldTerrainAudit.test.ts 'meadow' 组）：
// - 包围盒不得进入导航可步行区（x∈[-50,84], z∈[-88.2,50]）与观星走廊；
//   南瓣 z ≥ 56、东北瓣 z ≤ -90 均在外（渲染层另有 walkable 软塌陷兜底，
//   起伏在可步行区内强制归零）。
// - 不进晨溪河谷带（x∈[-62,68], z∈[-110,-86]）与河口湾包围盒；东北瓣
//   x ≥ 74 在河岸林带（源头半宽+岸外缘 ≈ 5.5 → x ≤ 69.5）以东。
// - 西缘不进西海滩/海域（岸线 x ≈ -43.2±wobble；南瓣 x ≥ -42）。
// - 外缘与岚屏岭麓原保持过渡（渲染层按 LANPING_RANGE 逐峰软塌陷）。
import type { TerrainFeatureConfig } from './_types';

/**
 * 城缘草甸要素表（kind 'meadow'）：
 * - x/z = 草甸包围盒中心，width/depth = 包围盒尺寸；
 * - renderHint.color = 草地基色（与岚屏岭麓丘同族）；
 * - renderHint.reliefHeight = 起伏最大高度；density = 每 100×100 装饰组数。
 */
export const CITYSIDE_MEADOW: readonly TerrainFeatureConfig[] = [
  {
    id: 'ground-cityside-meadow-south',
    kind: 'meadow',
    label: '城南草甸',
    x: 34,
    z: 83,
    width: 152,
    depth: 54,
    renderHint: { color: 0x8fae72, reliefHeight: 3.4, density: 1.15 },
    navigationBlocking: false,
  },
  {
    id: 'ground-cityside-meadow-northeast',
    kind: 'meadow',
    label: '溪东草甸',
    x: 92,
    z: -100,
    width: 36,
    depth: 20,
    renderHint: { color: 0x97b57e, reliefHeight: 1.7, density: 1.0 },
    navigationBlocking: false,
  },
];
