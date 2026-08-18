import type * as THREE from 'three';
import type { NpcEntity } from './npcSystem';
import type { SceneInterestPointId } from '../gameplay/world/sceneInteractions';

type DebugBuilding = { id: string; group: THREE.Object3D };
type DebugResidence = { id: string };

export type DebugApiOptions = {
  getScene: () => THREE.Scene;
  getCamera: () => THREE.Camera;
  getRenderer: () => THREE.Renderer;
  getCameraZoom: () => number;
  getThree: () => typeof THREE;
  getNpcList: () => readonly NpcEntity[];
  getCursorChar: () => THREE.Object3D | null;
  getNavigation: () => unknown;
  getPlayerPath: () => THREE.Vector3[];
  getBuildings: () => readonly DebugBuilding[];
  getResidences: () => readonly DebugResidence[];
  openNpcDialog: (npc: NpcEntity) => void;
  navigateTo: (building: DebugBuilding) => void;
  isBuildingUnavailable: (building: DebugBuilding) => boolean;
  destroyBuilding: (buildingId: string) => boolean;
  destroyResidence: (residenceId: string) => boolean;
  destroyAll: () => number;
  restoreBuilding: (buildingId: string) => boolean;
  restoreResidence: (residenceId: string) => boolean;
  restoreAll: () => number;
  openModal: (building: DebugBuilding) => void;
  interactWithSceneInterestPoint: (id: SceneInterestPointId) => void;
  getSceneInterestPoints: () => { entities: ReadonlyMap<string, { interactionPosition: THREE.Vector3 }> } | null;
  burnCity: () => boolean;
  burnCityActive: () => boolean;
  burnCityProgress: () => number;
};

export function installDebugApi(options: DebugApiOptions) {
  const api = () => ({
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
      const entity = options.getSceneInterestPoints()?.entities.get(id);
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
  });
  (window as any).__mini = api;
  (window as any).destroyBuilding = options.destroyBuilding;
  (window as any).destroyResidence = options.destroyResidence;
  (window as any).destroyAll = options.destroyAll;
  (window as any).restoreBuilding = options.restoreBuilding;
  (window as any).restoreResidence = options.restoreResidence;
  (window as any).restoreAll = options.restoreAll;
}