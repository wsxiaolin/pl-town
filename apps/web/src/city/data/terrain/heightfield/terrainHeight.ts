// terrainHeight —— 全域唯一权威地形高度采样器（方案 §2 / GOAL 硬性要求 1）。
//
// 契约：
// - 纯函数、确定性（固定种子、无 Math.random / Date / 时间），可单测；
// - 城市核心（台地）严格返回 PLATEAU_BASE_Y（= 0）：治理布局、寻路
//   网格、碰撞等 2D 系统的既有语义零变化；
// - 城外世界返回真实地势（草甸起伏、河谷下切、海床下切），建筑/
//   地块/道路/道具/NPC/玩家/相机目标一律以本函数计算地面 y；
// - 未列入任何域的位置（东郊平原、山脚、外海远缘）回退 0——山体是
//   叠在地形上的凸出体块（massif 不收编，方案 §2.4），其底环贴
//   terrainHeight 埋深后几何零漂移。
//
// 分量实现见同目录：plateauField（台地平坦）、meadowField（草甸收编）、
// worldReliefField（聚合 + 河谷/海床）。消费方向（AGENTS.md 依赖规则）：
// rendering/terrain/*、city/navigation/*、city/debugApi 均 import 本文件；
// 本文件不 import rendering（SURFACE_Y 层偏移由调用方传入，见 surfaceY）。
import { PLATEAU_BASE_Y } from './plateauField';
import { worldReliefAt } from './worldReliefField';

/**
 * 世界地面高度（唯一权威采样器）。台地内严格 === 0；城外为
 * 草甸/河谷/海床聚合场；全域连续（无台阶突变）。
 */
export function terrainHeight(x: number, z: number): number {
  return PLATEAU_BASE_Y + worldReliefAt(x, z);
}

/**
 * 任意贴地层的表面世界 y：terrainHeight + 层偏移（如 SURFACE_Y.road /
 * SURFACE_Y.district，见 rendering/layers.ts 的层差体系）。层偏移由
 * 调用方传入，本模块保持 data 层不反向依赖 rendering（方案 §2.1）。
 * T4（SURFACE_Y 相对化）将全量切换到此入口。
 */
export function surfaceY(x: number, z: number, layerOffset: number): number {
  return terrainHeight(x, z) + layerOffset;
}

/**
 * 可通行坡度上限（方案 §5.1：导航「坡度可通行」判定阈值，≤13.5° 的
 * 草坡/滩涂可步行，更陡的谷坡/滩涂外缘为障碍）。T5 寻路接线消费。
 */
export const WALKABLE_SLOPE_MAX = 0.45;

/**
 * 沿给定方向的水平坡度（|Δh| / 步长）。步长取 0.6（与角色碰撞半径
 * 同量级，方案 §5.1 的采样约定）。返回非负值。
 */
export function slopeAlong(x: number, z: number, dirX: number, dirZ: number): number {
  const len = Math.hypot(dirX, dirZ);
  if (len < 1e-9) return 0;
  const step = 0.6;
  const dx = (dirX / len) * step;
  const dz = (dirZ / len) * step;
  return Math.abs(terrainHeight(x + dx, z + dz) - terrainHeight(x, z)) / step;
}
