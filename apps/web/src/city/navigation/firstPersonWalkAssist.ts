// First-person 准星交互与「步行模式」按钮状态：从 MiniCityApp 组合根抽出的
// 两个小助手，归入 navigation 模块边界（见 AGENTS.md「当前前端模块边界」）。
import * as THREE from 'three';
import type { BuildingEntity } from '../buildingEntity';

export interface FirstPersonWalkAssistDeps {
  getActiveCamera: () => THREE.Camera | null;
  raycaster: THREE.Raycaster;
  getRaycastGroups: () => THREE.Object3D[];
  findBuilding: (hits: readonly THREE.Intersection[]) => BuildingEntity | null;
  showToast: (message: string) => void;
  exit: () => void;
  interactOrWalk: (building: BuildingEntity) => void;
}

/** 命中准星下建筑时走普通走近流程（会先退出该模式），未命中给出提示。 */
export function createFirstPersonInteract(deps: FirstPersonWalkAssistDeps): () => void {
  const center = new THREE.Vector2(0, 0);
  return () => {
    const activeCamera = deps.getActiveCamera();
    if (!activeCamera) return;
    deps.raycaster.setFromCamera(center, activeCamera);
    const building = deps.findBuilding(deps.raycaster.intersectObjects(deps.getRaycastGroups(), true));
    if (!building) { deps.showToast('准星附近没有可互动的建筑'); return; }
    deps.exit();
    deps.interactOrWalk(building);
  };
}

export function setWalkModeButtonState(active: boolean): void {
  const button = document.getElementById('walkToggle');
  button?.classList.toggle('active', active);
  button?.setAttribute('aria-pressed', String(active));
}
