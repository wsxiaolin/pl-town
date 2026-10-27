import type * as THREE from 'three';
import type { BuildingEntity, ResidenceEntity } from './buildingEntity';
import type { Npc } from './npcSystem';
import type { SceneInterestPoints, SceneInterestPointId } from '../rendering/sceneInterestPoints';
import { isLanYuPreludeCGActive, playLanYuPreludeCG, stopLanYuPreludeCG } from './lanYuPreludeCG';
import { musterCGActive, startMusterCG, stopMusterCG } from './musterCg';
import { isWeather, type Weather } from './weather';
import { isCatDeathCGActive, playCatDeathCG, stopCatDeathCG } from '../adapters/ui/iceKing/catDeathCGController';
import { terrainHeight, slopeAlong } from './data/terrain/heightfield/terrainHeight';
import { plateauFlat } from './data/terrain/heightfield/plateauField';
import { riverWaterYAt } from './data/terrain/heightfield/worldReliefField';
import { TRANSIT_STATIONS } from './data/year-towns/transit';
import type { TransitRideController } from './transitRideController';
import type { TransitStationId } from '../gameplay/world/sceneInteractions';
import type { OnboardingTutorialController } from '../adapters/ui/onboardingTutorialController';

type NpcEntity = Npc;

type NavigationApi = {
  buildRoadPath: (from: THREE.Vector3, to: THREE.Vector3) => THREE.Vector3[];
  nearestRoadCoord: (value: number) => number;
};

type IceSanctumController = {
  enter: () => boolean;
  hasEntered: () => boolean;
  isActive: () => boolean;
  interactNpc: () => boolean;
  root: THREE.Object3D;
};

export type MiniCityDebugApi = ReturnType<typeof createMiniCityApi>;

function createMiniCityApi(options: DebugApiOptions) {
  return {
    get scene() { return options.getScene(); },
    get camera() { return options.getCamera(); },
    get renderer() { return options.getRenderer(); },
    get cameraZoom() { return options.getCameraZoom(); },
    get THREE() { return options.getThree(); },
    get npcs() { return options.getNpcList(); },
    get player() { return options.getCursorChar(); },
    /** Effective path/first-person speed for the current entry (?dev doubles it). */
    get playerSpeed() { return options.getPlayerSpeed(); },
    get navigation() { return options.getNavigation(); },
    get residences() { return options.getResidences(); },
    getPlayerPath: () => options.getPlayerPath().map(point => point.clone()),
    interactNpc: (npcId: string) => {
      const npc = options.getNpcList().find(item => item.profile.id === npcId);
      if (!npc) return false;
      options.openNpcDialog(npc);
      return true;
    },
    interactBuilding: (buildingId: string) => {
      const building = options.getBuildings().find(item => item.id === buildingId);
      if (!building || options.isBuildingUnavailable(building)) return false;
      options.navigateTo(building);
      return true;
    },
    destroyBuilding: (buildingId: string) => options.destroyBuilding(buildingId),
    destroyResidence: (residenceId: string) => options.destroyResidence(residenceId),
    destroyAll: () => options.destroyAll(),
    restoreBuilding: (buildingId: string) => options.restoreBuilding(buildingId),
    restoreResidence: (residenceId: string) => options.restoreResidence(residenceId),
    restoreAll: () => options.restoreAll(),
    openBuildingDialog: (buildingId: string) => {
      const building = options.getBuildings().find(item => item.id === buildingId);
      if (!building || options.isBuildingUnavailable(building)) return false;
      options.openModal(building);
      return true;
    },
    interactInterestPoint: (id: string) => {
      const entity = options.getSceneInterestPoints()?.entities.get(id as SceneInterestPointId);
      if (!entity) return false;
      const cursor = options.getCursorChar();
      if (!cursor) return false;
      cursor.position.set(entity.interactionPosition.x + 0.5, terrainHeight(entity.interactionPosition.x + 0.5, entity.interactionPosition.z), entity.interactionPosition.z);
      options.interactWithSceneInterestPoint(id as SceneInterestPointId);
      return true;
    },
    burnCity: () => options.burnCity(),
    burnCityActive: () => options.burnCityActive(),
    burnCityProgress: () => options.burnCityProgress(),
    cinematics: {
      playLanYuPrelude: () => playLanYuPreludeCG(),
      stopLanYuPrelude: () => stopLanYuPreludeCG(),
      isLanYuPreludeActive: () => isLanYuPreludeCGActive(),
      startMuster: () => startMusterCG(),
      stopMuster: () => stopMusterCG(),
      musterActive: () => musterCGActive(),
      playCatDeath: () => playCatDeathCG(),
      stopCatDeath: () => stopCatDeathCG(),
      isCatDeathActive: () => isCatDeathCGActive(),
    },
    iceSanctum: {
      enter: () => options.getIceSanctum()?.enter(),
      hasEntered: () => options.getIceSanctum()?.hasEntered() ?? false,
      interactNpc: () => options.getIceSanctum()?.interactNpc() ?? false,
      isActive: () => options.getIceSanctum()?.isActive() ?? false,
      root: () => options.getIceSanctum()?.root ?? null,
    },
    invasionCG: () => options.playInvasionCG(),
    stopInvasionCG: () => options.stopInvasionCG(),
    weather: {
      get: () => options.getWeather(),
      set: (value: Weather) => {
        if (!isWeather(value)) return false;
        options.setWeather(value);
        return true;
      },
    },
    get tutorial() { return options.getTutorial(); },
    get firstPerson() {
      return options.getFirstPerson?.() ?? null;
    },
    /** Which map atlas pages (主城 main / 星语北城 north / 群岛海图
     *  archipelago) already have a captured snapshot — lets tests observe
     *  the boot-time preload without opening the map (opening would capture
     *  lazily and mask the check). */
    mapShotsReady: () => options.getMapShotsReady(),
    /** True once the boot map-atlas preload attempt has run to completion
     *  (success or failure), so tests can wait for the attempt to settle
     *  without requiring both pages to have been captured. */
    mapShotsPreloadSettled: () => options.getMapShotsPreloadSettled(),
    /** Snap the player (and the camera that follows them) to a world spot. */
    teleport: (x: number, z: number) => options.teleport(x, z),
    /** Teleport + optional orthographic zoom (bigger = wider view). */
    focus: (x: number, z: number, zoom?: number) => options.focus(x, z, zoom),
    /** 地形运行时探针（可信地形 DoD）：任意 (x,z) 的权威采样器读数。 */
    terrain: {
      /** terrainHeight 原值：_mini.terrain.height(34, 96) → 观景平台地面高。 */
      height: (x: number, z: number) => terrainHeight(x, z),
      /** 诊断聚合：高程 / 台地平坦权重（1=台地外，0=台地内）/ 河道沿程水位 /
       *  最大梯度方向坡度（与 WALKABLE_SLOPE_MAX=0.45 比较即知可否步行）。 */
      sample: (x: number, z: number) => ({
        height: terrainHeight(x, z),
        plateau: plateauFlat(x, z),
        riverWaterY: riverWaterYAt(x, z),
        slope: Math.max(
          slopeAlong(x, z, 1, 0), slopeAlong(x, z, -1, 0),
          slopeAlong(x, z, 0, 1), slopeAlong(x, z, 0, -1),
        ),
      }),
    },
    /** 年份群岛乘车（T4b-c4 调试口，供 c6 冒烟驱动）：stations 直出 10 站
     *  站表（id/name/line/townId/works/baseY/platform 坐标）；interact(id)
     *  等价点站牌（开目的地面板）；start(from, to) 免面板直接发车；state()
     *  读实时行程（phase/s/speed/落点）；history() 读最近到站记录（c6 断言
     *  arrival.y 与目标站 baseY 吻合 <0.01）。 */
    transit: {
      stations: () => TRANSIT_STATIONS,
      interact: (id: string) => options.transit.interact(id as TransitStationId),
      start: (fromId: string, toId: string) => options.transit.startRide(fromId, toId),
      state: () => options.transit.state(),
      history: () => options.transit.history(),
    },
    fireworks: {
      openDesigner: () => options.fireworks.openDesigner(),
      startShow: () => options.fireworks.startShow(),
      setTheme: (id: string) => options.fireworks.setTheme(id),
      launch: (design: unknown, x = -58, z = -12) => options.fireworks.launch(design, x, z),
    },
  };
}

export type DebugApiOptions = {
  getScene: () => THREE.Scene;
  getCamera: () => THREE.Camera;
  getRenderer: () => THREE.Renderer;
  getCameraZoom: () => number;
  getThree: () => typeof THREE;
  getNpcList: () => NpcEntity[];
  getCursorChar: () => THREE.Object3D | null;
  getPlayerSpeed: () => number;
  getNavigation: () => NavigationApi;
  getPlayerPath: () => THREE.Vector3[];
  getBuildings: () => BuildingEntity[];
  getResidences: () => ResidenceEntity[];
  openNpcDialog: (npc: NpcEntity) => void;
  navigateTo: (building: BuildingEntity) => void;
  isBuildingUnavailable: (building: BuildingEntity) => boolean;
  destroyBuilding: (buildingId: string) => boolean;
  destroyResidence: (residenceId: string) => boolean;
  destroyAll: () => number;
  restoreBuilding: (buildingId: string) => boolean;
  restoreResidence: (residenceId: string) => boolean;
  restoreAll: () => number;
  openModal: (building: BuildingEntity) => void;
  interactWithSceneInterestPoint: (id: SceneInterestPointId) => void;
  getSceneInterestPoints: () => SceneInterestPoints | null;
  burnCity: () => boolean;
  burnCityActive: () => boolean;
  burnCityProgress: () => number;
  playInvasionCG: () => boolean;
  stopInvasionCG: () => void;
  getWeather: () => Weather;
  setWeather: (weather: Weather) => void;
  getIceSanctum: () => IceSanctumController | null;
  getTutorial: () => OnboardingTutorialController;
  getFirstPerson?: () => {
    isActive: () => boolean;
    enter: () => boolean;
    exit: () => void;
    toggle: () => void;
    getActiveCamera: () => unknown;
  } | null;
  getMapShotsReady: () => { main: boolean; north: boolean; archipelago: boolean };
  getMapShotsPreloadSettled: () => boolean;
  teleport: (x: number, z: number) => boolean;
  focus: (x: number, z: number, zoom?: number) => boolean;
  /** 年份群岛乘车控制器（T4b-c4：MiniCityApp 接线注入，_mini.transit 消费）。 */
  transit: TransitRideController;
  fireworks: {
    openDesigner: () => void;
    startShow: () => void;
    setTheme: (id: string) => void;
    launch: (design: unknown, x: number, z: number) => void;
  };
};

export function installDebugApi(options: DebugApiOptions) {
  const api = createMiniCityApi(options);
  window._mini = api;
}
