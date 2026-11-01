// 运行时基建接线：帧循环、道路寻路系统与火烧城市特效的装配，从组合根抽出。
// 三者共享 scene/renderer 句柄；frameLoop 的火烧覆盖层由本模块内创建的
// burnCityEffect 直接供给，组合根无需感知该衔接。
import { CITY_LIMIT, ECHO_OBSERVATORY_AREA, NORTH_DISTRICT_AREA, ROAD_COORDS, WEST_BEACH } from './data/cityConfig';
import { buildMeadowTrailGraph, createRoadNavigationSystem } from './navigation/roadNavigation';
import { createBurnCityEffect } from './burnCityEffect';
import { createFrameLoop, type FrameLoopOptions } from './frameLoop';

type RoadNavigationInputs = Parameters<typeof createRoadNavigationSystem>[0];

export type CityRuntimeInfraWiringOptions = Omit<FrameLoopOptions, 'getBurnOverlay'> & {
  /** T3a 年份群岛：3 座岛缘锚点外扩 WORLD_BOUNDS，玩家在岛上不被钳回主城。 */
  yearTownAnchors: RoadNavigationInputs['yearTownAnchors'];
  /** T4a2 跨海交通：走线唯一事实源 transit.ts（buildTransitRoadGraph 直出节点/边表）。 */
  transit: RoadNavigationInputs['transit'];
  reduced: boolean;
};

export function createCityRuntimeInfraWiring(options: CityRuntimeInfraWiringOptions) {
  const burnCityEffect = createBurnCityEffect({
    getScene: options.getScene,
    getRenderer: options.getRenderer,
    cityLimit: CITY_LIMIT,
    reduced: options.reduced,
  });

  const roadNavigation = createRoadNavigationSystem({
    roadCoords: ROAD_COORDS,
    echoObservatoryArea: ECHO_OBSERVATORY_AREA,
    northDistrictArea: NORTH_DISTRICT_AREA,
    meadowTrail: buildMeadowTrailGraph(),
    westBeach: WEST_BEACH,
    cityLimit: CITY_LIMIT,
    yearTownAnchors: options.yearTownAnchors,
    transit: options.transit,
    getBuildings: options.getBuildings,
  });

  const frameLoop = createFrameLoop({
    ...options,
    getBurnOverlay: () => burnCityEffect,
  });

  return { frameLoop, roadNavigation, burnCityEffect };
}
