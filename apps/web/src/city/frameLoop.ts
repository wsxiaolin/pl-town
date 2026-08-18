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

export const FRAME_TASK_INTERVALS = Object.freeze({
  labels: 1000 / 30,
  npcAvoidance: 1000 / 20,
  mapMarker: 1000 / 15,
});

export function createFrameIntervalGate(intervalMs: number) {
  let nextRunAt = Number.NEGATIVE_INFINITY;
  return {
    isDue(now: number): boolean {
      if (now < nextRunAt) return false;
      nextRunAt = now + intervalMs;
      return true;
    },
  };
}

export function createFrameLoop(options: FrameLoopOptions) {
  let animationFrame = 0;
  const labelGate = createFrameIntervalGate(FRAME_TASK_INTERVALS.labels);
  const npcAvoidanceGate = createFrameIntervalGate(FRAME_TASK_INTERVALS.npcAvoidance);
  const mapMarkerGate = createFrameIntervalGate(FRAME_TASK_INTERVALS.mapMarker);

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
    if (npcAvoidanceGate.isDue(now)) {
      options.getNpcList().forEach(npc => {
        if (!npc.mesh.visible || npc.walking === false) return;
        options.npcYieldToPlayer(npc);
      });
    }
    playerController?.updateCamera();
    const sceneInterestPoints = options.getSceneInterestPoints();
    sceneInterestPoints?.update(now / 1000);
    const cursorChar = options.getCursorChar();
    const beach = cursorChar?.visible && !options.getCityDialogs()?.isOpen()
      ? sceneInterestPoints?.entities.get('west-beach')
      : null;
    if (beach && cursorChar && cursorChar.position.distanceToSquared(beach.interactionPosition) <= 3.2 ** 2) {
      void options.getSceneInterestPointController()?.interact('west-beach');
    }
    if (labelGate.isDue(now)) updateLabels();
    const renderer = options.getRenderer();
    renderer.render(options.getScene(), options.getCamera());
    const burn = options.getBurnOverlay();
    if (burn?.isActive()) burn.render(renderer);
    const mapController = options.getMapController();
    if (mapController?.isOpen() && mapMarkerGate.isDue(now)) mapController.updateMarker();
  }

  function start() { animationFrame = requestAnimationFrame(loop); }
  function stop() { cancelAnimationFrame(animationFrame); }

  return { start, stop, updateLabels };
}
