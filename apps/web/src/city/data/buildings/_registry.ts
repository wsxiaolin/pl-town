// 建筑注册表：汇总本目录全部单文件建筑配置，并重建向后兼容的三个消费接口
// （BUILDING_DEFS / BUILDING_API_QUERIES / BUILDING_CONTENT）。
// 新增或下线建筑：新建/删除配置文件后，在此同步 import 与 BUILDING_REGISTRY 顺序。
// 数组顺序即建筑次序（大致由内环到外环），影响地图标签与治理目录的排列。
import academyLibrary from './academy_library';
import activity from './activity';
import bulletin from './bulletin';
import techhalf from './techhalf';
import blackhole from './blackhole';
import laws from './laws';
import library from './library';
import litreview from './litreview';
import catcafe from './catcafe';
import academy from './academy';
import news from './news';
import mutualaid from './mutualaid';
import screen from './screen';
import elevator from './elevator';
import residentid from './residentid';
import stats from './stats';
import knowledgebaseE from './knowledgebaseE';
import newsstand from './newsstand';
import community from './community';
import research from './research';
import commons from './commons';
import senate from './senate';
import writingclub from './writingclub';
import lab from './lab';
import culturehall from './culturehall';
import teahouse from './teahouse';
import photostudio from './photostudio';
import mallSouth from './mall_south';
import schoolEast from './school_east';
import mallWest from './mall_west';
import schoolNorth from './school_north';
import kingice from './kingice';
import knowledgebaseD from './knowledgebaseD';
import communityOuter from './community_outer';
import commonsOuter from './commons_outer';
import labOuter from './lab_outer';
import teahouseOuter from './teahouse_outer';
import writingclubOuter from './writingclub_outer';
import filmCity from './film_city';
import archive from './archive';
import tradingpost from './tradingpost';
import records from './records';
import guildhall from './guildhall';
import musichall from './musichall';
import conservatory from './conservatory';
import arena from './arena';
import guesthouse from './guesthouse';
import shrine from './shrine';
import beacon from './beacon';
import bananaPalace from './banana_palace';
import qipaiHall from './qipai_hall';
import wushiRestaurant from './wushi_restaurant';
import televisionTower from './television_tower';
import friedChickenShop from './fried_chicken_shop';
import tavern from './tavern';
import northChatPlaza from './north_chat_plaza';
import northPigeonSquare from './north_pigeon_square';
import northStellarHall from './north_stellar_hall';
import northSingularity from './north_singularity';
import northBinaryGarden from './north_binary_garden';
import northMayaGrove from './north_maya_grove';
import northApiMemorial from './north_api_memorial';
import northWorryStore from './north_worry_store';
import northBistro from './north_bistro';
import northNightKiosk from './north_night_kiosk';
import northJukebox from './north_jukebox';
import northBackroomsDoor from './north_backrooms_door';

import type { BuildingConfig, BuildingContentLike } from './_types';
import type { BuildingDefinition } from '../../buildingEntity';

/** 全部建筑配置（单文件真源），顺序 = 城市空间顺序。 */
export const BUILDING_REGISTRY: readonly BuildingConfig[] = [
  academyLibrary,
  activity,
  bulletin,
  techhalf,
  blackhole,
  laws,
  library,
  litreview,
  catcafe,
  academy,
  news,
  mutualaid,
  screen,
  elevator,
  residentid,
  stats,
  knowledgebaseE,
  newsstand,
  community,
  research,
  commons,
  senate,
  writingclub,
  lab,
  culturehall,
  teahouse,
  photostudio,
  mallSouth,
  schoolEast,
  mallWest,
  schoolNorth,
  kingice,
  knowledgebaseD,
  communityOuter,
  commonsOuter,
  labOuter,
  teahouseOuter,
  writingclubOuter,
  filmCity,
  archive,
  tradingpost,
  records,
  guildhall,
  musichall,
  conservatory,
  arena,
  guesthouse,
  shrine,
  beacon,
  bananaPalace,
  qipaiHall,
  wushiRestaurant,
  televisionTower,
  friedChickenShop,
  tavern,
  northChatPlaza,
  northPigeonSquare,
  northStellarHall,
  northSingularity,
  northBinaryGarden,
  northMayaGrove,
  northApiMemorial,
  northWorryStore,
  northBistro,
  northNightKiosk,
  northJukebox,
  northBackroomsDoor,
];

export { inferFacade, inferPlot, SHAPE_FACADES, SHAPE_PLOTS } from './_shapeDefaults';

const toDefinition = (config: BuildingConfig): BuildingDefinition => {
  const def: BuildingDefinition = { id: config.id, num: config.num, x: config.x, z: config.z, shape: config.shape, icon: config.icon };
  if (config.label !== undefined) def.label = config.label;
  if (config.isStats !== undefined) def.isStats = config.isStats;
  if (config.disabled !== undefined) def.disabled = config.disabled;
  if (config.facade !== undefined) def.facade = config.facade;
  if (config.storyLocked !== undefined) def.storyLocked = config.storyLocked;
  if (config.interactionRadius !== undefined) def.interactionRadius = config.interactionRadius;
  if (config.decorationClearance !== undefined) def.decorationClearance = config.decorationClearance;
  if (config.hasPlot !== undefined) def.hasPlot = config.hasPlot;
  if (config.featureIds !== undefined) def.featureIds = config.featureIds;
  if (config.plot !== undefined) def.plot = config.plot;
  if (config.contentQuery !== undefined) def.contentQuery = config.contentQuery;
  return def;
};

/** 运行时建筑定义（旧 BUILDING_DEFS 形状，contentQuery 已按 id 附着）。 */
export const BUILDING_DEFS: BuildingDefinition[] = BUILDING_REGISTRY.map(toDefinition);

/** 按 id 索引的 Physics Lab 社区作品查询（Object.freeze，形状同旧导出）。 */
export const BUILDING_API_QUERIES = Object.freeze(Object.fromEntries(
  BUILDING_REGISTRY
    .filter((config) => config.contentQuery !== undefined)
    .map((config) => [config.id, config.contentQuery]),
));

/** 按 id 索引的建筑对话内容（地图提示与弹窗共用）。 */
export const BUILDING_CONTENT: Record<string, BuildingContentLike> = Object.fromEntries([
  ...BUILDING_REGISTRY
    .filter((config) => config.content !== undefined)
    .map((config) => [config.id, config.content]),
]);
