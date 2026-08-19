import * as THREE from 'three';
import { updateCityLabels } from './labelController';

export type FrameLoopOptions = {
  getRenderer: () => THREE.Renderer;
  getScene: () => THREE.Scene;
  getCamera: () => THREE.Camera;
  getBuildings: () => any[];
  getResidences: () => any[];
  getLabelWorldPosition: () => THREE.Vector3;
  getNpcList: () => any[];
  getPlayerController: () => { updateMovement: (delta: number) => void; updateCamera: () => void } | null;
  getMultiplayerHousing: () => { updateRemotePlayers: (delta: number) => void } | null;
  getSceneInterestPoints: () => { update: (time: number) => void; entities: Map<string, any> } | null;
  getSceneInterestPointController: () => { interact: (id: string) => Promise<void> | void } | null;
  getMapController: () => { isOpen: () => boolean; updateMarker: () => void } | null;
  getBurnOverlay: () => { render: (renderer: THREE.Renderer) => void; isActive: () => boolean } | null;
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
    const playerController = options.getPlayerController();
    playerController?.updateMovement(delta);
    options.getMultiplayerHousing()?.updateRemotePlayers(delta);
    const cursorChar = options.getCursorChar();
    if (cursorChar?.visible) {
      for (const npc of options.getNpcList()) options.npcYieldToPlayer(npc);
    }
    playerController?.updateCamera();
    const sceneInterestPoints = options.getSceneInterestPoints();
    sceneInterestPoints?.update(now / 1000);
    const beach = cursorChar?.visible && !options.getCityDialogs()?.isOpen()
      ? sceneInterestPoints?.entities.get('west-beach')
      : null;
    if (beach && cursorChar && cursorChar.position.distanceToSquared(beach.interactionPosition) <= 3.2 ** 2) {
      void options.getSceneInterestPointController()?.interact('west-beach');
    }
    updateLabels();
    const renderer = options.getRenderer();
    renderer.render(options.getScene(), options.getCamera());
    const burn = options.getBurnOverlay();
    if (burn?.isActive()) burn.render(renderer);
    const mapController = options.getMapController();
    if (mapController?.isOpen()) mapController.updateMarker();
  }

  function start() { animationFrame = requestAnimationFrame(loop); }
  function stop() { cancelAnimationFrame(animationFrame); }

  return { start, stop, updateLabels };
}
