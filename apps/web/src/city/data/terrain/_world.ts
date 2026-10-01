// 世界地形配置。未来加入山河湖海时，在 terrain/ 下按要素分文件
// （如 river-lan.ts、lake-mirror.ts），在这里按空间顺序聚合。
// 目前城市边缘仅有西海滩一处地形（配置见 cityConfig.ts 的 WEST_BEACH，
// 渲染见 rendering/westBeach.ts），尚未迁移到本协议，迁移前保持不动。
import type { TerrainFeatureConfig } from './_types';

/**
 * 世界级地形要素列表。渲染器与导航系统未来从这里读取；
 * 空数组 = 无自定义地形，城市依赖现有平面地表与西海滩实现。
 */
export const WORLD_TERRAIN: readonly TerrainFeatureConfig[] = [
  // 示例（未实现，仅示意配置形态）：
  // {
  //   id: 'river-lan',
  //   kind: 'river',
  //   label: '澜溪',
  //   x: 0, z: -60,
  //   width: 6,
  //   path: [[-60, -60], [60, -64]],
  //   renderHint: { color: 0x5a8fb8, animated: true, textures: ['water'] },
  //   navigationBlocking: true,
  //   navigationClearance: 1.2,
  // },
];
