// 年份群岛建筑运行时装配：消费 data 层的手写坐标与生成目录，派生场景配置、
// 地形层高和交互内容。运行时映射集中在 city 层，city/data 只保留静态配置。
import { YEAR_TOWN_BUILDING_CONFIGS, YEAR_TOWN_BUILDING_EXTRAS } from './data/year-towns/gen-buildings';
import {
  FACING_ROTATION,
  LANDMARK_PLACEMENTS,
  MEMORIAL_SCALE,
  type YearTownPlacement,
} from './data/year-towns/districtLayout';
import { YEAR_TOWN_MEMORIAL_BY_KEY, YEAR_TOWN_LANDMARK_NOTES } from './data/year-towns/yearTownMemorials';
import { yearTownById } from './data/year-towns/towns';
import { terrainHeight } from './data/terrain/heightfield/terrainHeight';
import type { BuildingDefinition } from './buildingEntity';
import type { BuildingConfig } from './data/buildings/_types';
import type { BuildingContentLike } from '../adapters/ui/cityDialogController';

const placements: Readonly<Record<string, YearTownPlacement>> = {
  ...Object.fromEntries(
    Object.values(YEAR_TOWN_MEMORIAL_BY_KEY)
      .filter((memorial) => memorial.layout)
      .map((memorial) => [
        memorial.key,
        {
          x: memorial.layout!.x,
          z: memorial.layout!.z,
          plot: memorial.layout!.plot ?? 4.2,
          rotY: memorial.layout!.facing ? FACING_ROTATION[memorial.layout!.facing] : undefined,
        },
      ]),
  ),
  ...LANDMARK_PLACEMENTS,
};

/** 手写坐标、临街朝向与纪念设施体量合成后的建筑配置。 */
export const YEAR_TOWN_LAYOUT_CONFIGS: readonly BuildingConfig[] = YEAR_TOWN_BUILDING_CONFIGS.map((config) => {
  const placement = placements[config.id];
  const isMemorial = YEAR_TOWN_BUILDING_EXTRAS[config.id]?.kind === 'work';
  if (!placement) {
    return isMemorial
      ? { ...config, plot: { tex: 'ground5', size: 4.2, color: 0xe4e3e0 }, scale: MEMORIAL_SCALE }
      : config;
  }
  return {
    ...config,
    x: placement.x,
    z: placement.z,
    rotY: placement.rotY,
    plot: { tex: 'ground5', size: placement.plot, color: 0xe4e3e0 },
    scale: isMemorial ? MEMORIAL_SCALE : 1,
  };
});

const roundY = (value: number) => Math.round(value * 100) / 100;
const labelById = new Map(YEAR_TOWN_LAYOUT_CONFIGS.map((config) => [config.id, config.label]));

const toDefinition = (config: BuildingConfig): BuildingDefinition => ({
  id: config.id,
  num: config.num,
  label: config.label,
  x: config.x,
  z: config.z,
  rotY: config.rotY,
  shape: config.shape,
  icon: config.icon,
  hasPlot: false,
  baseY: roundY(terrainHeight(config.x, config.z)),
  scale: config.scale,
});

/** 年份群岛建筑定义，与主城建筑共用 buildingSceneController。 */
export const YEAR_TOWN_BUILDING_DEFS: readonly BuildingDefinition[] = YEAR_TOWN_LAYOUT_CONFIGS.map(toDefinition);

export function mergeBuildingContent(
  main: Readonly<Record<string, BuildingContentLike>>,
  extra: Readonly<Record<string, BuildingContentLike>>,
): Record<string, BuildingContentLike> {
  const overlap = Object.keys(extra).filter((id) => id in main);
  if (overlap.length > 0) console.warn(`year-town building content conflicts with main city: ${overlap.join(', ')}`);
  return { ...extra, ...main };
}

export function yearTownExtras(id: string) {
  return YEAR_TOWN_BUILDING_EXTRAS[id];
}

export function yearTownMemorialOf(id: string) {
  const extras = YEAR_TOWN_BUILDING_EXTRAS[id];
  return extras?.memorialKey ? YEAR_TOWN_MEMORIAL_BY_KEY[extras.memorialKey] : undefined;
}

export function yearTownLandmarkNoteOf(id: string): string | undefined {
  return YEAR_TOWN_LANDMARK_NOTES[id];
}

export function yearTownBuildingContent(id: string): BuildingContentLike | undefined {
  const extras = YEAR_TOWN_BUILDING_EXTRAS[id];
  if (!extras) return undefined;
  const town = yearTownById(extras.townId);
  if (!town) return undefined;
  const memorial = extras.memorialKey ? YEAR_TOWN_MEMORIAL_BY_KEY[extras.memorialKey] : undefined;
  const note = memorial?.note ?? YEAR_TOWN_LANDMARK_NOTES[id];
  if (!note) return undefined;
  return {
    name: memorial?.facility ?? labelById.get(id) ?? `${town.label}纪念名录`,
    slogan: `${town.label} · ${town.year} 年`,
    dialog: [note],
    readBody: Boolean(memorial),
    readBodyLabel: memorial ? '走近看看' : undefined,
    noteKind: memorial?.noteKind,
  };
}

export const YEAR_TOWN_BUILDING_CONTENT: Readonly<Record<string, BuildingContentLike>> = Object.fromEntries(
  Object.keys(YEAR_TOWN_BUILDING_EXTRAS).flatMap((id) => {
    const content = yearTownBuildingContent(id);
    return content ? [[id, content] as [string, BuildingContentLike]] : [];
  }),
);
