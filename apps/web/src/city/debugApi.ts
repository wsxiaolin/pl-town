import type * as THREE from 'three';

export type DebugApiOptions = {
  getScene: () => THREE.Scene;
  getCamera: () => THREE.Camera;
  getRenderer: () => THREE.Renderer;
  getCameraZoom: () => number;
  getThree: () => typeof THREE;
  getNpcList: () => any[];
  getCursorChar: () => THREE.Object3D | null;
  getNavigation: () => any;
  getPlayerPath: () => THREE.Vector3[];
  getBuildings: () => any[];
  openNpcDialog: (npc: any) => void;
  navigateTo: (building: any) => void;
  isStoryLockedBuilding: (building: any) => boolean;
  openModal: (building: any) => void;
  interactWithSceneInterestPoint: (id: any) => void;
  getSceneInterestPoints: () => { entities: Map<string, any> } | null;
};

export function installDebugApi(options: DebugApiOptions) {
  (window as any).__mini = () => ({
    scene: options.getScene(),
    camera: options.getCamera(),
    renderer: options.getRenderer(),
    cameraZoom: options.getCameraZoom(),
    THREE: options.getThree(),
    npcs: options.getNpcList(),
    player: options.getCursorChar(),
    navigation: options.getNavigation(),
    getPlayerPath: () => options.getPlayerPath().map(point => point.clone()),
    interactNpc: (npcId: string) => {
      const npc = options.getNpcList().find(item => item.profile.id === npcId);
      if (!npc) return false;
      options.openNpcDialog(npc);
      return true;
    },
    interactBuilding: (buildingId: string) => {
      const building = options.getBuildings().find((item: any) => item.id === buildingId);
      if (!building || options.isStoryLockedBuilding(building)) return false;
      options.navigateTo(building);
      return true;
    },
    openBuildingDialog: (buildingId: string) => {
      const building = options.getBuildings().find((item: any) => item.id === buildingId);
      if (!building) return false;
      options.openModal(building);
      return true;
    },
    interactInterestPoint: (id: string) => {
      const entity = options.getSceneInterestPoints()?.entities.get(id);
      if (!entity) return false;
      const cursor = options.getCursorChar();
      if (!cursor) return false;
      cursor.position.set(entity.interactionPosition.x + 0.5, 0, entity.interactionPosition.z);
      options.interactWithSceneInterestPoint(id);
      return true;
    },
  });
}
