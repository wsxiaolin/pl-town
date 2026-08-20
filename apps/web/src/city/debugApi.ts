import type * as THREE from 'three';
import type { BuildingEntity, ResidenceEntity } from './buildingEntity';
import type { Npc } from './npcSystem';
import type { SceneInterestPoints, SceneInterestPointId } from '../rendering/sceneInterestPoints';
import { isLanYuPreludeCGActive, playLanYuPreludeCG, stopLanYuPreludeCG } from './lanYuPreludeCG';

type NpcEntity = Npc;

type NavigationApi = {
  buildRoadPath: (from: THREE.Vector3, to: THREE.Vector3) => THREE.Vector3[];
  nearestRoadCoord: (value: number) => number;
};

export type MiniCityDebugApi = ReturnType<typeof createMiniCityApi>;

function createMiniCityApi(options: DebugApiOptions) {
  return () => ({
    scene: options.getScene(),
    camera: options.getCamera(),
    renderer: options.getRenderer(),
    cameraZoom: options.getCameraZoom(),
    THREE: options.getThree(),
    npcs: options.getNpcList(),
    player: options.getCursorChar(),
    navigation: options.getNavigation(),
    residences: options.getResidences(),
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
    },
    invasionCG: () => options.playInvasionCG(),
  });
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
};

export function installDebugApi(options: DebugApiOptions) {
  const api = createMiniCityApi(options);
  window.__mini = api;
  window.destroyBuilding = options.destroyBuilding;
  window.destroyResidence = options.destroyResidence;
  window.destroyAll = options.destroyAll;
  window.restoreBuilding = options.restoreBuilding;
  window.restoreResidence = options.restoreResidence;
  window.restoreAll = options.restoreAll;
  window.playInvasionCG = options.playInvasionCG;
  window.stopInvasionCG = options.stopInvasionCG;
}
