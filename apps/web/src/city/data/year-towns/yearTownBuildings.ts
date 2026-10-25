// 年份镇建筑合流（T6 集成）：gen-buildings 的 115 座配置 → BuildingDefinition[]，
// 在 cityWorldAssembly 与 BUILDING_DEFS 同管道进 buildingSceneController（设计
// §7.1/§8.2：模块初始化构造、静态 import、建筑随世界启动渲染）。
//
// 坐标语义：岛台面在 plateauR 内恒为 topY（terrainHeight 唯一采样器），建筑
// 落位 baseY = terrainHeight(x, z)；入场动画/buildingSceneController 以 baseY
// 为终点（主城建筑 baseY 恒 0，行为不变）。
// plot：岛台自带镇主题台面色（archipelagoIsles 顶点色），不再叠加主城地面
// plate（SURFACE_Y 固定主城标高会沉入岛体）→ hasPlot: false。
import { YEAR_TOWN_BUILDING_EXTRAS, YEAR_TOWN_NAMEPLATES, YEAR_TOWN_LANDMARK_BLURBS } from './gen-buildings';
import { YEAR_TOWN_LAYOUT_CONFIGS } from './districtLayout';
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
  shape: config.shape,
  icon: config.icon,
  hasPlot: false,
  baseY: roundY(terrainHeight(config.x, config.z)),
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

/** 按 id 取建筑附加信息（kind/townId/year/workId/townRank）。 */
export function yearTownExtras(id: string) {
  return YEAR_TOWN_BUILDING_EXTRAS[id];
}

/** 数字千分位（热度/馆藏数展示用）。 */
const fmt = (v: number) => v.toLocaleString('zh-Hans-CN');

/**
 * 铭牌级对话内容（设计 §7.2 P 级的 dialog 载体）：题名 + 作者/年份/热度 +
 * 摘要（≤120 字，生成期已 sanitize）。作品铭牌带 readBody 标记（T6R-b2），
 * 弹窗由 cityDialogController 渲染「阅读正文」入口 → 详情抽屉（D5/D6）。
 */
export function yearTownBuildingContent(id: string): BuildingContentLike | undefined {
  const extras = YEAR_TOWN_BUILDING_EXTRAS[id];
  if (!extras) return undefined;
  const town = yearTownById(extras.townId);
  if (!town) return undefined;
  const blurb = YEAR_TOWN_LANDMARK_BLURBS[id];
  const nameplate = extras.kind === 'work' ? YEAR_TOWN_NAMEPLATES[id] : undefined;
  if (!nameplate && !blurb) return undefined;
  const lines: string[] = [];
  if (blurb) lines.push(blurb);
  if (nameplate) {
    lines.push(`「${nameplate.abstract}」`);
    if (nameplate.tags.length > 0) lines.push(`标签：${nameplate.tags.join(' · ')}`);
    lines.push(`评论区采样 ${nameplate.sampledComments} 条（共 ${fmt(nameplate.totalComments)} 条）。`);
  }
  return {
    name: nameplate?.label ?? town.label,
    slogan: nameplate
      ? `${town.label} · 作者「${nameplate.author}」 · 全站第 ${nameplate.rank} 名 · 热度 ${fmt(nameplate.popularity)}`
      : `${town.label} · ${town.tagline}`,
    dialog: lines.length > 0 ? lines : [town.tagline],
    // T6R-b2：作品建筑才有铭牌 → 弹窗出现「阅读正文」按钮（纯数据标记）。
    readBody: nameplate !== undefined,
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
