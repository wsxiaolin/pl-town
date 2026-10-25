// 年份片区建筑装配层（设计 §7.1 修订：手写坐标 + 体量放大）。
//
// 历史：本模块曾在这里跑「主街两侧 + 环巷贪心」二次布局，把生成器给的
// 镇内坐标重排到片区圆里。结果是每座片区被半径 19 的小圆裁住，建筑只能
// 各自缩在圆内、彼此疏离，形成一栋栋孤岛。
//
// 现在改为：
//   1. 坐标全部手写（`yearTownMemorials.ts` 的 layout 字段），人工决定街道
//      走向、街区聚拢与对景关系，不再由算法撒点；
//   2. 片区圆不再作为建筑禁区——旧港城 / 星港城各自的 4 个年份片区连成
//      一整片城区，建筑可落在半径 plateauR−3.5 的大城台面内；
//   3. 建筑按 MEMORIAL_SCALE 统一放大体量，让街墙连续、减少疏离感。
//
// 输出仍是标准 BuildingConfig（补 plot/scale），继续走
// yearTownBuildings → buildingSceneController，与主城同管道。
import { YEAR_TOWN_BUILDING_CONFIGS, YEAR_TOWN_BUILDING_EXTRAS } from './gen-buildings';
import { YEAR_TOWN_MEMORIAL_BY_KEY } from './yearTownMemorials';
import type { BuildingConfig } from '../buildings/_types';

/** 年份群岛建筑统一体量系数（builder 几何是硬编码常量，靠 group 缩放放大）。 */
export const MEMORIAL_SCALE = 1.6;

/**
 * 手写布局：建筑 id → 世界坐标与地块尺寸。
 * 由 `yearTownMemorials.ts` 的 layout 字段汇总而来（单一事实源），
 * plot 与体量缩放联动：体量放大后地块同步放大，避免地面色块小于建筑。
 */
/** 地标（纪念名录 / 千作总目塔 / 起源村界碑）的手写落位。 */
const LANDMARK_PLACEMENTS: Readonly<Record<string, { x: number; z: number; plot: number }>> = {
  'yt-arch-2020': { x: -12.5, z: 234.9, plot: 4.2 },
  'yt-arch-2021': { x: 47.1, z: 229.5, plot: 4.2 },
  'yt-arch-2022': { x: -7.1, z: 294.5, plot: 4.2 },
  'yt-arch-2023': { x: 52.5, z: 289.1, plot: 4.2 },
  'yt-arch-2024': { x: -215, z: 219.9, plot: 4.2 },
  'yt-arch-2025': { x: -246.2, z: 274, plot: 4.2 },
  'yt-arch-2026': { x: -183.8, z: 274, plot: 4.2 },
  'yt-tower': { x: 138, z: 196, plot: 3.0 },
  'yt-stele-2019': { x: 150, z: 228, plot: 1.8 },
};

const PLACEMENTS: Readonly<Record<string, { x: number; z: number; plot: number }>> = {
  ...Object.fromEntries(
    Object.values(YEAR_TOWN_MEMORIAL_BY_KEY)
      .filter((memorial) => memorial.layout)
      .map((memorial) => [
        memorial.key,
        {
          x: memorial.layout!.x,
          z: memorial.layout!.z,
          plot: memorial.layout!.plot ?? 4.2,
        },
      ]),
  ),
  ...LANDMARK_PLACEMENTS,
};

/** 布局后的年份建筑配置（手写坐标 + 统一放大）。未登记布局的建筑保留生成器坐标。 */
export const YEAR_TOWN_LAYOUT_CONFIGS: readonly BuildingConfig[] = YEAR_TOWN_BUILDING_CONFIGS.map((config) => {
  const placement = PLACEMENTS[config.id];
  const extras = YEAR_TOWN_BUILDING_EXTRAS[config.id];
  const isMemorial = extras?.kind === 'work';
  if (!placement) {
    return isMemorial
      ? { ...config, plot: { tex: 'ground5', size: 4.2, color: 0xe4e3e0 }, scale: MEMORIAL_SCALE }
      : config;
  }
  return {
    ...config,
    x: placement.x,
    z: placement.z,
    plot: { tex: 'ground5', size: placement.plot, color: 0xe4e3e0 },
    scale: isMemorial ? MEMORIAL_SCALE : 1,
  };
});

/**
 * 片区道路/街区参数（地面渲染与装饰共用）。
 * 片区圆仍用于地面斑块与装饰，但不再约束建筑落位。
 */
export const DISTRICT_BLOCK = {
  roadHalf: 2.3,
  sidewalkHalf: 3.0,
  plateauInset: 3.5,
} as const;
