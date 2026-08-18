import * as THREE from 'three';
import { updateCityLabels } from './labelController';
import type { BuiltBuilding } from '../rendering/buildingMeshFactory';
import type { NpcEntity } from './npcSystem';

type Residence = { id: string; group: THREE.Object3D; labelEl?: HTMLElement | null };
type LabelledBuilding = { id: string; group: THREE.Object3D };

export type FrameLoopOptions = {
  getRenderer: () => THREE.WebGLRenderer;
  getScene: () => THREE.Scene;
  getCamera: () => THREE.Camera;
  getBuildings: () => readonly BuiltBuilding[];
  getResidences: () => readonly Residence[];
  getLabelWorldPosition: () => THREE.Vector3;
  getNpcList: () => readonly NpcEntity[];
  getPlayerController: () => { updateMovement: (delta: number) => void; updateCamera: () => void } | null;
  getMultiplayerHousing: () => { updateRemotePlayers: (delta: number) => void } | null;
  getSceneInterestPoints: () => { update: (time: number) => void; entities: ReadonlyMap<string, { interactionPosition: THREE.Vector3 }> } | null;
  getSceneInterestPointController: () => { interact(id: string): Promise<void> | void } | null;
  getMapController: () => { isOpen: () => boolean; updateMarker: () => void } | null;
  getBurnOverlay: () => { render: (renderer: THREE.WebGLRenderer) => void; isActive: () => boolean } | null;
  getCursorChar: () => THREE.Object3D | null;
  getCityDialogs: () => { isOpen: () => boolean } | null;
  getLastFrameTime: () => number;
  setLastFrameTime: (value: number) => void;
  npcYieldToPlayer: (npc: NpcEntity) => void;
  isStoryLockedBuilding: (building: LabelledBuilding) => boolean;
};

export function createFrameLoop(options: FrameLoopOptions) {
  let animationFrame = 0;

  function updateLabels() {
    updateCityLabels({
      camera: options.getCamera(),
      buildings: options.getBuildings(),
      residences: options.getResidences(),
      isStoryLocked: (building) => options.isStoryLockedBuilding(building as LabelledBuilding),
      worldPosition: options.getLabelWorldPosition(),
    });
  }

  function loop() {
    animationFrame = requestAnimationFrame(loop);
    const now = performance.now();
    const delta = Math.min((now - options.getLastFrameTime()) / 1000, 0.05);
    options.setLastFrameTime(now);
    options.getPlayerController()?.updateMovement(delta);
    options.getMultiplayerHousing()?.updateRemotePlayers(delta);
    options.getNpcList().forEach(npc => {
      if (!npc.mesh.visible || npc.walking === false) return;
      options.npcYieldToPlayer(npc);
    });
    options.getPlayerController()?.updateCamera();
    options.getSceneInterestPoints()?.update(now / 1000);
    const cursorChar = options.getCursorChar();
    const beach = cursorChar?.visible && !options.getCityDialogs()?.isOpen()
      ? options.getSceneInterestPoints()?.entities.get('west-beach')
      : null;
    if (beach && cursorChar && cursorChar.position.distanceTo(beach.interactionPosition) <= 3.2) {
      void options.getSceneInterestPointController()?.interact('west-beach');
    }
    updateLabels();
    const renderer = options.getRenderer();
    renderer.render(options.getScene(), options.getCamera());
    const burn = options.getBurnOverlay();
    if (burn?.isActive()) burn.render(renderer);
    if (options.getMapController()?.isOpen()) options.getMapController()?.updateMarker();
  }

  function start() { animationFrame = requestAnimationFrame(loop); }
  function stop() { cancelAnimationFrame(animationFrame); }

  return { start, stop, updateLabels };
}