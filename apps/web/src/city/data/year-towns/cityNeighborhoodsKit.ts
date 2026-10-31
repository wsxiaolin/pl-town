// 年份城市日常生活建筑。坐标、名称、用途与临街朝向逐栋手写；
// 作品纪念设施位于内城，本目录补足外围街区与城市公共服务。
import { iconSvg, type BuildingConfig } from '../buildings/_types';
export interface NeighborhoodBuilding extends BuildingConfig {
  townId: 'island-2019' | 'island-2022' | 'island-2026';
  story: string;
}

export const home = (id: string, townId: NeighborhoodBuilding['townId'], label: string, x: number, z: number, rotY: number, shape = 'school', story?: string): NeighborhoodBuilding => ({
  id, num: id.slice(-3).toUpperCase(), townId, label, x, z, rotY, shape,
  icon: iconSvg('<path d="M3 11l9-7 9 7M5 10v10h14V10M9 20v-6h6v6"/>'),
  scale: 1.25,
  story: story ?? `${label}的居民把日子过得缓慢而具体。窗边有晾晒的衣物，门前留着给邻居说话的椅子；这里的日常与内城展出的年代一样，都是城市的一部分。`,
});

export const shop = (id: string, townId: NeighborhoodBuilding['townId'], label: string, x: number, z: number, rotY: number, shape = 'mall', story?: string): NeighborhoodBuilding => ({
  id, num: id.slice(-3).toUpperCase(), townId, label, x, z, rotY, shape,
  icon: iconSvg('<path d="M4 9h16l-1 11H5zM4 9l2-4h12l2 4M9 13h6"/>'),
  scale: 1.2,
  story: story ?? `${label}面朝街道开门。熟客来买今天的必需品，旅客在这里第一次闻到这座城的烟火气；打烊以后，门檐下仍留着一盏灯。`,
});

export const civic = (id: string, townId: NeighborhoodBuilding['townId'], label: string, x: number, z: number, rotY: number, shape: string, story: string): NeighborhoodBuilding => ({
  id, num: id.slice(-3).toUpperCase(), townId, label, x, z, rotY, shape,
  icon: iconSvg('<path d="M4 10l8-6 8 6M6 10v10M18 10v10M12 10v10M3 20h18"/>'),
  scale: 1.35,
  story,
});

export const N = Math.PI;