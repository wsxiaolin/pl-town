import * as THREE from 'three';
import { updateCityLabels } from './labelController';
import type { BuildingEntity, ResidenceEntity } from './buildingEntity';
import type { Npc } from './npcSystem';
import type { SceneInterestPoints } from '../rendering/sceneInterestPoints';
import type { SceneInterestPointController } from './sceneInterestPointController';

type NpcEntity = Npc;

export type FrameLoopOptions = {
  getRenderer: () => THREE.WebGLRenderer;
  getScene: () => THREE.Scene;
  getCamera: () => THREE.Camera;
  getBuildings: () => BuildingEntity[];
  getResidences: () => ResidenceEntity[];
  getLabelWorldPosition: () => THREE.Vector3;
  getNpcList: () => NpcEntity[];
  getPlayerController: () => { updateMovement: (delta: number) => void; updateCamera: () => void } | null;
  getMultiplayerHousing: () => { updateRemotePlayers: (delta: number) => void } | null;
  getSceneInterestPoints: () => SceneInterestPoints | null;
  getSceneInterestPointController: () => SceneInterestPointController | null;
  getMapController: () => { isOpen: () => boolean; updateMarker: () => void } | null;
  getBurnOverlay: () => { render: (renderer: THREE.WebGLRenderer) => void; isActive: () => boolean } | null;
  getCursorChar: () => THREE.Object3D | null;
  getCityDialogs: () => { isOpen: () => boolean } | null;
  updateWeatherEffects?: (elapsedSeconds: number, camera: THREE.Camera) => void;
  getBeachEncounterActive?: () => boolean;
  getLastFrameTime: () => number;
  setLastFrameTime: (value: number) => void;
  npcYieldToPlayer: (npc: NpcEntity) => void;
  isStoryLockedBuilding: (building: BuildingEntity) => boolean;
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
    const beach = cursorChar?.visible && !options.getCityDialogs()?.isOpen() && !options.getBeachEncounterActive?.()
      ? sceneInterestPoints?.entities.get('west-beach')
      : null;
    if (beach && cursorChar) {
      const distanceSquared = cursorChar.position.distanceToSquared(beach.interactionPosition);
      if (distanceSquared <= 6 ** 2) void options.getSceneInterestPointController()?.interact('west-beach');
      else options.getSceneInterestPointController()?.armBeachEncounter();
    }
    updateLabels();
    options.updateWeatherEffects?.(now / 1000, options.getCamera());
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
