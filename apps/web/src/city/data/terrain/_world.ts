// 世界地形配置聚合。地形按要素分文件放在 terrain/ 下，这里按空间顺序
// 聚合为单一 WORLD_TERRAIN 列表；渲染实现见 rendering/terrain/ 下的
// mountainRanges.ts（岚屏岭）、riverChenxi.ts（晨溪）、minglanIsles.ts（明澜外海）、
// cityGround.ts（城缘草甸——城市地面建模）。
//
// 目前城市边缘仅有西海滩一处既有地形尚未迁移到本协议（配置见
// cityConfig.ts 的 WEST_BEACH，渲染见 rendering/westBeach.ts），迁移前保持不动。
import type { TerrainFeatureConfig } from './_types';
import { LANPING_RANGE } from './range-lanping';
import { CHENXI_RIVER } from './river-chenxi';
import { MINGLAN_ISLES } from './sea-minglan';
import { CITYSIDE_MEADOW } from './ground-cityside';

/**
 * 世界级地形要素列表（岚屏岭山脉 + 晨溪河 + 明澜外海 + 城缘草甸）。
 * 渲染器逐条消费上述分文件配置；导航系统按 navigation* 字段避让
 * （当前由各渲染器/装配层按需接线，见 rendering/terrain/ 与
 * city/cityWorldAssembly.ts）。
 */
export const WORLD_TERRAIN: readonly TerrainFeatureConfig[] = [
  ...LANPING_RANGE,
  ...CHENXI_RIVER,
  ...MINGLAN_ISLES,
  ...CITYSIDE_MEADOW,
];
