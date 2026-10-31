// 外城生活设施聚合：两岛道具分文件手写（urbanLifeOldport/Starport），
// 此处保留类型定义并聚合导出；渲染批量实例化口径不变。
export type UrbanLifeKind = 'tree' | 'lamp' | 'bench' | 'stall' | 'planter' | 'kiosk' | 'park' | 'crate' | 'parasol';
export interface UrbanLifeSpec {
  kind: UrbanLifeKind;
  districtId: 'island-oldport' | 'island-starport';
  x: number;
  z: number;
  rotY?: number;
  tint?: number;
}

import { URBAN_LIFE_OLDPORT } from './urbanLifeOldport';
import { URBAN_LIFE_STARPORT } from './urbanLifeStarport';

export const YEAR_TOWN_URBAN_LIFE: readonly UrbanLifeSpec[] = [
  ...URBAN_LIFE_OLDPORT,
  ...URBAN_LIFE_STARPORT,
];
