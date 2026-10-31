// 年份城市生活建筑聚合：三岛草案（旧港/星港/起源村，分文件手写）+
// 最终坐标偏移映射 + 目录内容。新增建筑请改对应岛屿分文件。
import type { NeighborhoodBuilding } from './cityNeighborhoodsKit';
import { NB_2022_DRAFTS } from './cityNeighborhoodsOldport';
import { NB_2026_DRAFTS } from './cityNeighborhoodsStarport';
import { VILLAGE_DRAFTS } from './cityNeighborhoodsVillage';

const NEIGHBORHOOD_DRAFTS: readonly NeighborhoodBuilding[] = [
  ...NB_2022_DRAFTS,
  ...NB_2026_DRAFTS,
  ...VILLAGE_DRAFTS,
];

// 最终绝对坐标：星港城区相对草案整体西移 70、南移 6，旧港内城保持原位；
// 起源村村舍草案即最终坐标（零偏移）。南端生活排屋与终章馆逐栋保留岸线退距。
export const YEAR_TOWN_NEIGHBORHOODS: readonly NeighborhoodBuilding[] = NEIGHBORHOOD_DRAFTS.map((building) => ({
  ...building,
  x: building.x + (building.townId === 'island-2026' ? -70 : 0),
  z: building.z + (building.townId === 'island-2019' ? 0 : building.townId === 'island-2026' ? 6 : 40)
    - (building.townId === 'island-2022' && building.id.startsWith('yt-op-s') ? 38 : 0)
    - (building.id === 'yt-op-end' ? 40 : 0)
    - (building.id === 'yt-sp-end' ? 6 : 0),
}));

export const YEAR_TOWN_NEIGHBORHOOD_CONTENT = Object.fromEntries(
  YEAR_TOWN_NEIGHBORHOODS.map((building) => [building.id, {
    name: building.label ?? building.id,
    slogan: building.townId === 'island-2019'
      ? '起源村 · 村舍'
      : building.townId === 'island-2022' ? '旧港城 · 生活街区' : '星港城 · 明日街区',
    dialog: [building.story],
  }]),
);
