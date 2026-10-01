// shape 级别的默认外观参数：门面纹理与地块规格。
// 单栋建筑想覆盖默认值时，在自己文件的 `facade` / `plot` 字段里写，
// 不要在这里加 building 专属分支。
import type { BuildingPlotSpec } from './_types';

/** 门面纹理 key：按 shape 索引的默认值。 */
export const SHAPE_FACADES: Record<string, string> = {
  bank: 'facade_bank_plaster',
  board: 'facade_utility_concrete',
  tower: 'facade_tower_glass',
  darktower: 'facade_darktower_glass',
  pavilion: 'facade_temple_stone',
  library: 'facade_library_stone',
  ruins: 'facade_ruin_stone',
  skyscraper: 'facade_tower_glass',
  campus: 'facade_school_cream',
  kiosk: 'facade_kiosk_woodglass',
  screen: 'facade_utility_concrete',
  shaft: 'facade_utility_concrete',
  altar: 'facade_utility_concrete',
  observatory: 'facade_observatory_concrete',
  market: 'facade_market_awning',
  greenhouse: 'facade_greenhouse_glass',
  clocktower: 'facade_clocktower_brick',
  temple: 'facade_temple_stone',
  factory: 'facade_factory_brick',
  mall: 'facade_tower_glass',
  school: 'facade_school_cream',
  banana: 'facade_residence_cream',
  qipai: 'facade_community_brick',
};

/** 地块规格：按 shape 索引的默认值（纹理 / 半径 / 颜色）。 */
export const SHAPE_PLOTS: Record<string, BuildingPlotSpec> = {
  bank: { tex: 'ground5', size: 4.5, color: 0xE8E7E4 },
  board: { tex: 'ground5', size: 3.0, color: 0xE4E3E0 },
  tower: { tex: 'ground5', size: 4.0, color: 0xD8D7D2 },
  darktower: { tex: 'ground6', size: 4.0, color: 0x9A988E },
  pavilion: { tex: 'ground4', size: 4.5, color: 0xC0D0A0 },
  library: { tex: 'ground5', size: 4.0, color: 0xE8E7E4 },
  ruins: { tex: 'ground2', size: 3.5, color: 0xE0D8CC },
  skyscraper: { tex: 'ground5', size: 3.5, color: 0xD8D7D2 },
  campus: { tex: 'ground5', size: 4.5, color: 0xE8E7E4 },
  kiosk: { tex: 'ground5', size: 3.0, color: 0xE4E3E0 },
  screen: { tex: 'ground5', size: 4.0, color: 0xD8D7D2 },
  shaft: { tex: 'ground5', size: 3.0, color: 0xD8D7D2 },
  altar: { tex: 'ground5', size: 3.5, color: 0xE4E3E0 },
  observatory: { tex: 'ground5', size: 4.0, color: 0xE8E7E4 },
  pagoda: { tex: 'ground4', size: 4.0, color: 0xC0D0A0 },
  market: { tex: 'ground5', size: 4.5, color: 0xE4E3E0 },
  greenhouse: { tex: 'ground4', size: 4.0, color: 0xB8C888 },
  clocktower: { tex: 'ground5', size: 4.0, color: 0xE4E3E0 },
  temple: { tex: 'ground5', size: 4.5, color: 0xF0EFEC },
  factory: { tex: 'ground2', size: 5.0, color: 0xC8C4B8 },
  mall: { tex: 'ground5', size: 5.5, color: 0xD8D7D2 },
  school: { tex: 'ground4', size: 4.5, color: 0xB8C888 },
  academy: { tex: 'ground4', size: 4.5, color: 0xD8C9A8 },
  crown: { tex: 'ground5', size: 4.5, color: 0xF0EFEC },
  banana: { tex: 'ground2', size: 6.0, color: 0xE0D8A0 },
  qipai: { tex: 'ground5', size: 8.0, color: 0xE4E3E0 },
  restaurant: { tex: 'ground5', size: 6.2, color: 0xD9C692 },
  wild_mushroom_restaurant: { tex: 'ground5', size: 6.6, color: 0xD9C692 },
  film_city: { tex: 'ground5', size: 8.0, color: 0xE4E3E0 },
  television_tower: { tex: 'ground5', size: 5.4, color: 0xD5DFE2 },
  fried_chicken_shop: { tex: 'ground2', size: 4.6, color: 0xE6D2B2 },
  tavern: { tex: 'ground4', size: 4.8, color: 0xC6B18C },
};

export const DEFAULT_PLOT: BuildingPlotSpec = { tex: 'ground5', size: 3.5, color: 0xE4E3E0 };

/** 未知 shape 的兜底地块。 */
export const inferPlot = (shape: string): BuildingPlotSpec => SHAPE_PLOTS[shape] ?? DEFAULT_PLOT;

/** 未知 shape 没有默认门面（返回 undefined，由渲染层跳过门面贴图）。 */
export const inferFacade = (shape: string): string | undefined => SHAPE_FACADES[shape];
