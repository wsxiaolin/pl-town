// 城缘草甸高度场——收编迁移壳（可信地形改造 T2，方案 §2.4）。
// 唯一事实来源已迁至 city/data/terrain/heightfield/meadowField.ts，
// 成为 terrainHeight 权威采样器的草甸分量；本文件保留 re-export，
// 既有消费方（cityGround.ts 渲染几何、worldTerrainAudit.test.ts 审计）
// 的 import 路径零改动。台地收编后 sampleCitysideMeadowY 语义变化：
// 0 基线正场（台地内归 0、塌陷区归 0、埋地基线 -0.08 移除）——详见
// heightfield/meadowField.ts 头注释。
export {
  MEADOW_GLOBAL_SEED,
  RIVER_VALLEY_BOX,
  type MeadowBox,
  meadowSmoothStep,
  distanceOutsideBox,
  meadowSwellProfile,
  swellReliefAt,
  meadowReliefAt,
  sampleCitysideMeadowY,
} from '../../city/data/terrain/heightfield/meadowField';
