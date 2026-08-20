import type * as THREE from 'three';
import type { BuildingEntity, ResidenceEntity } from './buildingEntity';
import type { Npc } from './npcSystem';
import type { SceneInterestPoints, SceneInterestPointId } from '../rendering/sceneInterestPoints';
import { isLanYuPreludeCGActive, playLanYuPreludeCG, stopLanYuPreludeCG } from './lanYuPreludeCG';
import { isWeather, type Weather } from './weather';
import { isCatDeathCGActive, playCatDeathCG, stopCatDeathCG } from './catDeathCG';

type NpcEntity = Npc;

type NavigationApi = {
  buildRoadPath: (from: THREE.Vector3, to: THREE.Vector3) => THREE.Vector3[];
  nearestRoadCoord: (value: number) => number;
};

type IceSanctumApi = {
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
      cursor.position.set(entity.interactionPosition.x + 0.5, 0, entity.interactionPosition.z);
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
  getIceSanctum: () => IceSanctumApi | null;
};

export function installDebugApi(options: DebugApiOptions) {
  const api = createMiniCityApi(options);
  window._mini = api;
}
