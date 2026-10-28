// 年份片区手写布局常量。运行时派生位于 city/yearTownBuildings.ts。
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
/** 年份群岛建筑统一体量系数（builder 几何是硬编码常量，靠 group 缩放放大）。 */
export const MEMORIAL_SCALE = 1.6;

/**
 * 手写布局：建筑 id → 世界坐标与地块尺寸。
 * 由 `yearTownMemorials.ts` 的 layout 字段汇总而来（单一事实源），
 * plot 与体量缩放联动：体量放大后地块同步放大，避免地面色块小于建筑。
 */
/** 地标（纪念名录 / 千作总目塔 / 起源村界碑）的手写落位。 */
export type YearTownPlacement = { x: number; z: number; plot: number; rotY?: number };

export const LANDMARK_PLACEMENTS: Readonly<Record<string, YearTownPlacement>> = {
  'yt-arch-2020': { x: -20, z: 232, plot: 4.2 }, // 启明站房：站台东南侧，面向站前街
  'yt-arch-2021': { x: 60, z: 232, plot: 4.2 }, // 潮声站房：站台西南侧
  'yt-arch-2022': { x: -20, z: 292, plot: 4.2 }, // 盛夏站房：南站广场北侧
  'yt-arch-2023': { x: 60, z: 292, plot: 4.2 }, // 回响站房：南站广场北侧
  'yt-arch-2024': { x: -207, z: 212, plot: 4.2 }, // 微光站房：北站广场东侧
  'yt-arch-2025': { x: -252, z: 276, plot: 4.2 }, // 长风站房：西站广场北侧
  'yt-arch-2026': { x: -181, z: 283, plot: 4.2 }, // 星港站房：东站广场西侧
  'yt-tower': { x: 138, z: 196, plot: 3.0 },
  'yt-stele-2019': { x: 150, z: 228, plot: 1.8 },
};

export const FACING_ROTATION = { n: Math.PI, s: 0, e: Math.PI / 2, w: -Math.PI / 2 } as const;

/**
 * 片区道路/街区参数（地面渲染与装饰共用）。
 * 片区圆仍用于地面斑块与装饰，但不再约束建筑落位。
 */
export const DISTRICT_BLOCK = {
  roadHalf: 2.3,
  sidewalkHalf: 3.0,
  plateauInset: 3.5,
} as const;
