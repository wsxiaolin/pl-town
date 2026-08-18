import * as THREE from 'three';
import { gsap } from 'gsap';
import type { BuildingEntity } from './buildingEntity';
import type { Npc } from './npcSystem';
import type { SceneInterestPoints, SceneInterestPointId } from '../rendering/sceneInterestPoints';

export type NpcEntity = Npc;

export type InteractionPointerOptions = {
  getCamera: () => THREE.Camera;
  getRaycaster: () => THREE.Raycaster;
  getMouse2D: () => THREE.Vector2;
  getGroundPlane: () => THREE.Plane;
  getCursorWorld: () => THREE.Vector3;
  getRaycastBuildingGroups: () => THREE.Object3D[];
  getCursorChar: () => THREE.Object3D | null;
  getBuildings: () => BuildingEntity[];
  getSceneInterestPoints: () => SceneInterestPoints | null;
  getEchoStoryController: () => { tryExitCabinFromClick: (raycaster: THREE.Raycaster, object: THREE.Object3D) => boolean } | null;
  getCityDialogs: () => { isOpen: () => boolean } | null;
  getConfig: () => { npcTalkRadius: number; buildingInteractRadius: number };
  isBuildingUnavailable: (building: BuildingEntity) => boolean;
  isResidenceUnavailable: (residenceId: string) => boolean;
  findRaycastBuilding: (hits: THREE.Intersection[]) => BuildingEntity | null;
  raycastUserData: (object: THREE.Object3D, key: string) => unknown;
  npcForRaycast: () => NpcEntity | null;
  nearestNpcTo: (position: THREE.Vector3, radius: number) => NpcEntity | null;
  openNpcDialog: (npc: NpcEntity) => void;
  openResidence: (residenceId: string) => void;
  onYouClick: () => void;
  movePlayerTo: (target: THREE.Vector3) => void;
  navigateTo: (building: BuildingEntity) => void;
  interactWithSceneInterestPoint: (id: SceneInterestPointId) => void;
  interactWithInterestPointController: (id: SceneInterestPointId) => Promise<void> | void;
};

export function createInteractionPointer(options: InteractionPointerOptions) {
  let hoveredB: BuildingEntity | null = null;
  let pendingBuilding: BuildingEntity | null = null;
  let pendingSceneInterestPoint: SceneInterestPointId | null = null;

  function hover(b: BuildingEntity) {
    hoveredB = b;
    gsap.to(b.bodyMat, { emissiveIntensity: 0.08, duration: 0.28 });
    if (b.labelEl) b.labelEl.classList.add('hovered');
  }

  function unhover(b: BuildingEntity) {
    gsap.to(b.bodyMat, { emissiveIntensity: 0, duration: 0.38 });
    if (b.labelEl) b.labelEl.classList.remove('hovered');
  }

  function findBuildingFromHits(hits: THREE.Intersection[]) {
    return options.findRaycastBuilding(hits);
  }

  function onMouseMove(e: MouseEvent) {
    const mouse2D = options.getMouse2D();
    mouse2D.x = (e.clientX / window.innerWidth) * 2 - 1;
    mouse2D.y = -(e.clientY / window.innerHeight) * 2 + 1;
    const raycaster = options.getRaycaster();
    const camera = options.getCamera();
    raycaster.setFromCamera(mouse2D, camera);
    raycaster.ray.intersectPlane(options.getGroundPlane(), options.getCursorWorld());
    raycaster.setFromCamera(mouse2D, camera);
    const hits = raycaster.intersectObjects(options.getRaycastBuildingGroups(), true);
    if (hits.length) {
      const b = findBuildingFromHits(hits);
      if (b && b !== hoveredB) { if (hoveredB) unhover(hoveredB); hover(b); }
      if (!b && hoveredB) { unhover(hoveredB); hoveredB = null; }
    } else { if (hoveredB) { unhover(hoveredB); hoveredB = null; } }
  }

  function talkToOrWalk(npc: NpcEntity) {
    const cursorChar = options.getCursorChar();
    const CONFIG = options.getConfig();
    if (cursorChar && cursorChar.position.distanceTo(npc.mesh.position) <= CONFIG.npcTalkRadius) {
      options.openNpcDialog(npc);
    } else {
      const p = cursorChar ? cursorChar.position : new THREE.Vector3(0, 0, 0);
      const n = npc.mesh.position;
      const dx = p.x - n.x, dz = p.z - n.z, d = Math.hypot(dx, dz) || 1;
      const stopDist = CONFIG.npcTalkRadius - 0.35;
      options.movePlayerTo(new THREE.Vector3(n.x + dx / d * stopDist, 0, n.z + dz / d * stopDist));
    }
  }

  function liftForClick(b: BuildingEntity) {
    if (hoveredB && hoveredB !== b) unhover(hoveredB);
    hover(b);
  }

  function interactOrWalk(b: BuildingEntity) {
    if (options.isBuildingUnavailable(b)) return;
    liftForClick(b);
    const cursorChar = options.getCursorChar();
    const CONFIG = options.getConfig();
    const buildingDistance = cursorChar ? Math.hypot(
      cursorChar.position.x - b.group.position.x,
      cursorChar.position.z - b.group.position.z,
    ) : Infinity;
    if (cursorChar && buildingDistance <= CONFIG.buildingInteractRadius) {
      pendingBuilding = null;
      options.navigateTo(b);
    } else {
      pendingBuilding = b;
      options.movePlayerTo(b.group.position);
    }
  }

  function interactWithSceneInterestPoint(id: SceneInterestPointId) {
    const points = options.getSceneInterestPoints();
    const entity = points?.entities.get(id);
    const cursorChar = options.getCursorChar();
    if (!entity || !cursorChar) return;
    const distance = Math.hypot(
      cursorChar.position.x - entity.interactionPosition.x,
      cursorChar.position.z - entity.interactionPosition.z,
    );
    if (distance <= 3.5) {
      pendingSceneInterestPoint = null;
      void options.interactWithInterestPointController(id);
      return;
    }
    pendingSceneInterestPoint = id;
    options.movePlayerTo(entity.interactionPosition);
  }

  function onCanvasClick(event: MouseEvent) {
    const cityDialogs = options.getCityDialogs();
    if (cityDialogs?.isOpen()) return;
    const mouse2D = options.getMouse2D();
    mouse2D.x = (event.clientX / window.innerWidth) * 2 - 1;
    mouse2D.y = -(event.clientY / window.innerHeight) * 2 + 1;
    const raycaster = options.getRaycaster();
    const camera = options.getCamera();
    raycaster.setFromCamera(mouse2D, camera);
    raycaster.ray.intersectPlane(options.getGroundPlane(), options.getCursorWorld());
    raycaster.setFromCamera(mouse2D, camera);
    const points = options.getSceneInterestPoints();
    const cabinDoor = points?.entities.get('echo-cabin-door');
    if (cabinDoor && options.getEchoStoryController()?.tryExitCabinFromClick(raycaster, cabinDoor.object)) {
      pendingSceneInterestPoint = null;
      return;
    }
    const cursorChar = options.getCursorChar();
    if (cursorChar && cursorChar.visible) {
      const phits = raycaster.intersectObject(cursorChar, true);
      if (phits.length) { options.onYouClick(); return; }
    }
    const npcHit = options.npcForRaycast();
    if (npcHit) { talkToOrWalk(npcHit); return; }
    const interestHits = points ? raycaster.intersectObjects([...points.raycastTargets], true) : [];
    if (interestHits.length) {
      const first = interestHits[0];
      if (first) {
        const id = options.raycastUserData(first.object, 'sceneInterestPointId');
        if (typeof id === 'string' && id) { interactWithSceneInterestPoint(id as SceneInterestPointId); return; }
      }
    }
    const hits = raycaster.intersectObjects(options.getRaycastBuildingGroups(), true);
    if (hits.length) {
      const firstHit = hits[0];
      if (firstHit) {
        const residenceId = options.raycastUserData(firstHit.object, 'residenceId');
        if (typeof residenceId === 'string' && residenceId && !options.isResidenceUnavailable(residenceId)) { options.openResidence(residenceId); return; }
      }
      const b = findBuildingFromHits(hits);
      if (b) { interactOrWalk(b); return; }
    }
    const near = options.nearestNpcTo(options.getCursorWorld(), options.getConfig().npcTalkRadius);
    if (near) { talkToOrWalk(near); return; }
    options.movePlayerTo(options.getCursorWorld());
  }

  function handlePlayerIdle() {
    const cursorChar = options.getCursorChar();
    const CONFIG = options.getConfig();
    if (pendingBuilding && cursorChar) {
      const b = pendingBuilding;
      const distance = Math.hypot(cursorChar.position.x - b.group.position.x, cursorChar.position.z - b.group.position.z);
      if (distance <= CONFIG.buildingInteractRadius) { pendingBuilding = null; liftForClick(b); options.navigateTo(b); }
    }
    if (pendingSceneInterestPoint && cursorChar) {
      const id = pendingSceneInterestPoint;
      const entity = options.getSceneInterestPoints()?.entities.get(id);
      if (entity) {
        const distance = Math.hypot(cursorChar.position.x - entity.interactionPosition.x, cursorChar.position.z - entity.interactionPosition.z);
        if (distance <= 3.5) { pendingSceneInterestPoint = null; void options.interactWithInterestPointController(id); }
      }
    }
  }

  function clearPending() {
    pendingBuilding = null;
    pendingSceneInterestPoint = null;
  }

  return { onMouseMove, onCanvasClick, interactOrWalk, interactWithSceneInterestPoint, talkToOrWalk, handlePlayerIdle, clearPending };
}
