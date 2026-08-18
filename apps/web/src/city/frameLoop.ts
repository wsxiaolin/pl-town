import * as THREE from 'three';
import { updateCityLabels } from './labelController';
import type { SceneInterestPoints } from '../rendering/sceneInterestPoints';
import type { SceneInterestPointController } from './sceneInterestPointController';

export type FrameLoopOptions = {
  getRenderer: () => THREE.WebGLRenderer;
  getScene: () => THREE.Scene;
  getCamera: () => THREE.Camera;
  getBuildings: () => any[];
  getResidences: () => any[];
  getLabelWorldPosition: () => THREE.Vector3;
  getNpcList: () => any[];
  getPlayerController: () => { updateMovement: (delta: number) => void; updateCamera: () => void } | null;
  getMultiplayerHousing: () => { updateRemotePlayers: (delta: number) => void } | null;
  getSceneInterestPoints: () => SceneInterestPoints | null;
  getSceneInterestPointController: () => SceneInterestPointController | null;
  getMapController: () => { isOpen: () => boolean; updateMarker: () => void } | null;
  getBurnOverlay: () => { render: (renderer: THREE.WebGLRenderer) => void; isActive: () => boolean } | null;
  getCursorChar: () => THREE.Object3D | null;
  getCityDialogs: () => { isOpen: () => boolean } | null;
  getLastFrameTime: () => number;
  setLastFrameTime: (value: number) => void;
  npcYieldToPlayer: (npc: any) => void;
  isStoryLockedBuilding: (building: any) => boolean;
};

export function createFrameLoop(options: FrameLoopOptions) {
  let animationFrame = 0;

  function updateLabels() {
    updateCityLabels({
      camera: options.getCamera(),
      buildings: options.getBuildings(),
      residences: options.getResidences(),
      isStoryLocked: options.isStoryLockedBuilding,
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
