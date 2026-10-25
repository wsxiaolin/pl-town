// 年份镇建筑合流（T6 集成）：gen-buildings 的 115 座配置 → BuildingDefinition[]，
// 在 cityWorldAssembly 与 BUILDING_DEFS 同管道进 buildingSceneController（设计
// §7.1/§8.2：模块初始化构造、静态 import、建筑随世界启动渲染）。
//
// 坐标语义：岛台面在 plateauR 内恒为 topY（terrainHeight 唯一采样器），建筑
// 落位 baseY = terrainHeight(x, z)；入场动画/buildingSceneController 以 baseY
// 为终点（主城建筑 baseY 恒 0，行为不变）。
// plot：岛台自带镇主题台面色（archipelagoIsles 顶点色），不再叠加主城地面
// plate（SURFACE_Y 固定主城标高会沉入岛体）→ hasPlot: false。
//
// 纪念设施（设计 §7.1 修订）：年份群岛只呈现改写后的城市设施——设施名 +
// 纪念导语 + 可选便签交互。作品原文、评论、热度、浏览量不进入年份群岛。
import { YEAR_TOWN_BUILDING_EXTRAS } from './gen-buildings';
import { YEAR_TOWN_LAYOUT_CONFIGS } from './districtLayout';
import { YEAR_TOWN_MEMORIAL_BY_KEY, YEAR_TOWN_LANDMARK_NOTES } from './yearTownMemorials';
import { yearTownById } from './towns';
import { terrainHeight } from '../terrain/heightfield/terrainHeight';
import type { BuildingDefinition } from '../../buildingEntity';
import type { BuildingConfig } from '../buildings/_types';
import type { BuildingContentLike } from '../../../adapters/ui/cityDialogController';

const roundY = (v: number) => Math.round(v * 100) / 100;

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

/** 年份镇建筑定义（115 座；与 BUILDING_DEFS 合流进 buildingSceneController）。 */
export const YEAR_TOWN_BUILDING_DEFS: readonly BuildingDefinition[] = YEAR_TOWN_LAYOUT_CONFIGS.map(toDefinition);

/**
 * 主城与年份镇建筑内容合流（T6R-b1）。冲突时保留主城内容并告警：
 * 年份镇使用独立 id 前缀（yt-），当前不应有重叠；未来扩展若撞键，
 * 主城对话/任务入口不会被静默替换。
 */
export function mergeBuildingContent(
  main: Readonly<Record<string, BuildingContentLike>>,
  extra: Readonly<Record<string, BuildingContentLike>>,
): Record<string, BuildingContentLike> {
  const overlap = Object.keys(extra).filter((id) => id in main);
  if (overlap.length > 0) {
    console.warn(`year-town building content conflicts with main city: ${overlap.join(', ')}`);
  }
  return { ...extra, ...main };
}

/** 按 id 取建筑附加信息（kind/townId/year/memorialKey）。 */
export function yearTownExtras(id: string) {
  return YEAR_TOWN_BUILDING_EXTRAS[id];
}

/** 取建筑对应的纪念设施条目（非作品建筑返回 undefined）。 */
export function yearTownMemorialOf(id: string) {
  const extras = YEAR_TOWN_BUILDING_EXTRAS[id];
  return extras?.memorialKey ? YEAR_TOWN_MEMORIAL_BY_KEY[extras.memorialKey] : undefined;
}

/** 取纪念名录/总目塔/界碑的导语（非地标返回 undefined）。 */
export function yearTownLandmarkNoteOf(id: string): string | undefined {
  return YEAR_TOWN_LANDMARK_NOTES[id];
}

/**
 * 铭牌级对话内容（设计 §7.2）：设施名 + 纪念导语 + 便签交互标记。
 * 不再附带作品摘要、标签、评论数或热度——那些社区数据不属于年份群岛。
 */
export function yearTownBuildingContent(id: string): BuildingContentLike | undefined {
  const extras = YEAR_TOWN_BUILDING_EXTRAS[id];
  if (!extras) return undefined;
  const town = yearTownById(extras.townId);
  if (!town) return undefined;

  const memorial = extras.memorialKey ? YEAR_TOWN_MEMORIAL_BY_KEY[extras.memorialKey] : undefined;
  const landmarkNote = YEAR_TOWN_LANDMARK_NOTES[id];
  const note = memorial?.note ?? landmarkNote;
  if (!note) return undefined;

  return {
    name: memorial?.facility ?? `${town.label}纪念名录`,
    slogan: `${town.label} · ${town.year} 年`,
    dialog: [note],
    // 便签交互：仅少数设施拥有，弹窗据此渲染一个小动作（盖章/点灯/留言/封存）。
    noteKind: memorial?.noteKind,
  };
}

/**
 * 铭牌内容合流供给（T6R-b1）：MiniCityApp 的 buildingContent 供给点以
 * { ...BUILDING_CONTENT, ...YEAR_TOWN_BUILDING_CONTENT } 合流（面板控制器
 * 按 buildingId 查询）。无内容建筑不产生键，弹窗落回控制器兜底文案。
 */
export const YEAR_TOWN_BUILDING_CONTENT: Readonly<Record<string, BuildingContentLike>> = Object.fromEntries(
  Object.keys(YEAR_TOWN_BUILDING_EXTRAS).flatMap((id) => {
    const content = yearTownBuildingContent(id);
    return content ? [[id, content] as [string, BuildingContentLike]] : [];
  }),
);
