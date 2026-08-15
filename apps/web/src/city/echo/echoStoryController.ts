import * as THREE from 'three';
import { ECHO_OBSERVATORY_AREA } from '../data/cityConfig';
import { createEchoCabinNavigation, type EchoCabinNavigation } from '../navigation/echoCabinNavigation';
import { ECHO_STORY } from '../../gameplay/content/stories/echo/echoStory';
import type { StoryConditionContext, StoryEffect, StoryEvent } from '../../gameplay/stories/types';
import { LocalStorageStoryRepository } from '../../adapters/storage/stories/LocalStorageStoryRepository';
import { createStoryDialogFlow } from '../../adapters/ui/stories/storyDialogFlow';
import { createEchoObservatoryGuide } from '../../adapters/ui/echoObservatoryGuide';
import type { CityDialogController } from '../../adapters/ui/cityDialogController';

const ECHO_CABIN_NODES = new Set([
  'fifth-hub',
  'photo-wall-investigation',
  'diary-investigation',
  'diary-page-89',
  'diary-page-67',
  'diary-page-30',
  'diary-page-1',
  'fifth-act-complete',
]);
const ECHO_CABIN_DOOR_ID = 'echo-cabin-door';

const ECHO_STORY_ACHIEVEMENTS: Readonly<Record<string, { id: string; name: string }>> = {
  'echo.achievement.unnoticed': { id: 'echo_unnoticed', name: '无人问津' },
  'echo.achievement.eternal-lie': { id: 'echo_eternal_lie', name: '永恒的谎言' },
  'echo.achievement.real-echo': { id: 'echo_real_echo', name: '真正的回声' },
  'echo.achievement.true-dawn': { id: 'echo_true_dawn', name: '真正的黎明' },
};

type Cursor = {
  position: THREE.Vector3;
  rotation: { y: number };
  visible: boolean;
};

export type EchoStoryControllerOptions = {
  document: Document;
  getQuestContext: () => StoryConditionContext;
  consumeItem: (itemId: string, quantity: number) => void;
  setStoryPoints: (ids: readonly string[]) => void;
  setActiveActors: (ids: readonly string[]) => void;
  updateNpcSchedules: () => void;
  awardAchievement: (id: string, name: string) => void;
  getCursor: () => Cursor | null;
  clearPlayerPath: () => void;
  setCameraTarget: (x: number, z: number, instant: boolean) => void;
  stopCameraTween: () => void;
  getCameraZoom: () => number;
  setCameraZoom: (zoom: number) => void;
  updateCameraProjection: (zoom: number) => void;
  isMobile: () => boolean;
  getScene: () => THREE.Scene | null;
  sendLocalPosition: (cursor: Cursor) => void;
  goToObservatory: () => void;
};

export type EchoStoryController = ReturnType<typeof createEchoStoryController>;

export function createEchoStoryController(options: EchoStoryControllerOptions) {
  let navigation: EchoCabinNavigation | null = null;
  let guide: ReturnType<typeof createEchoObservatoryGuide> | null = null;
  let echoExteriorCameraZoom = 7;
  let echoInteriorView = false;

  let story: ReturnType<typeof createStoryDialogFlow>;
  story = createStoryDialogFlow(ECHO_STORY, new LocalStorageStoryRepository(ECHO_STORY), {
    getContext: options.getQuestContext,
    onEvent: handleStoryEvent,
    onEffects: (effects) => effects.forEach(applyEffect),
    onWorldInteractionsChanged: (ids) => {
      if (!isCabinNode() || ids.includes(ECHO_CABIN_DOOR_ID)) {
        options.setStoryPoints(ids);
        return;
      }
      options.setStoryPoints([...ids, ECHO_CABIN_DOOR_ID]);
    },
    onActiveActorsChanged: (ids) => {
      options.setActiveActors(ids);
      options.updateNpcSchedules();
    },
  });

  function applyEffect(effect: StoryEffect): void {
    if (effect.type === 'inventory.remove') options.consumeItem(effect.itemId, effect.quantity);
  }

  function handleStoryEvent(event: StoryEvent): void {
    guide?.applyEvent(event);
    const achievement = ECHO_STORY_ACHIEVEMENTS[event.type];
    if (achievement) options.awardAchievement(achievement.id, achievement.name);
    if (event.type === 'echo.cabin.entered') teleportToCabin();
    if (event.type === 'echo.cabin.exited') teleportFromCabin();
  }

  function setupScene(scene: THREE.Scene): void {
    navigation = createEchoCabinNavigation({
      getInterior: () => scene.getObjectByName('linche-home-interior'),
      fallbackBounds: {
        minX: ECHO_OBSERVATORY_AREA.interior[0] - 14.4,
        maxX: ECHO_OBSERVATORY_AREA.interior[0] + 14.4,
        minZ: ECHO_OBSERVATORY_AREA.interior[1] - 10,
        maxZ: ECHO_OBSERVATORY_AREA.interior[1] + 10,
      },
    });
    navigation.refresh();
    setInteriorView(echoInteriorView);
  }

  function setupGuide(): void {
    guide = createEchoObservatoryGuide(options.document, () => {
      if (story.state().nodeId === 'confrontation-active') teleportFromCabin();
      else options.goToObservatory();
    });
    announceGuide();
    syncWorldInteractions();
    syncActiveActors();
  }

  function teleportToCabin(): void {
    const cursor = options.getCursor();
    if (!cursor) return;
    setInteriorView(true);
    options.clearPlayerPath();
    cursor.position.set(ECHO_OBSERVATORY_AREA.interior[0], 0, ECHO_OBSERVATORY_AREA.interior[1] - 8.2);
    const spawn = navigation?.clampToWalkable(cursor.position);
    if (spawn) cursor.position.copy(spawn);
    options.setCameraTarget(cursor.position.x, cursor.position.z, true);
    options.sendLocalPosition(cursor);
  }

  function teleportFromCabin(): void {
    const cursor = options.getCursor();
    if (!cursor) return;
    setInteriorView(false);
    options.clearPlayerPath();
    cursor.position.set(ECHO_OBSERVATORY_AREA.linche[0] - 1.5, 0, ECHO_OBSERVATORY_AREA.linche[1]);
    options.setCameraTarget(ECHO_OBSERVATORY_AREA.linche[0], ECHO_OBSERVATORY_AREA.linche[1], true);
    options.sendLocalPosition(cursor);
  }

  function tryExitCabinFromClick(raycaster: THREE.Raycaster, cabinDoor: THREE.Object3D): boolean {
    if (!echoInteriorView || raycaster.intersectObject(cabinDoor, true).length === 0) return false;
    teleportFromCabin();
    return true;
  }

  function setInteriorView(active: boolean): void {
    const changed = active !== echoInteriorView;
    if (active && changed) echoExteriorCameraZoom = options.getCameraZoom() || 7;
    if (changed) options.stopCameraTween();
    echoInteriorView = active;
    options.getScene()?.traverse((object) => {
      if (object.userData.echoInteriorRoof || object.userData.echoInteriorCeiling || object.userData.echoCabinCameraOccluder) {
        object.visible = !active;
      }
    });
    if (changed) {
      const zoom = active ? (options.isMobile() ? 6.4 : 8.8) : Math.max(2, Math.min(15, echoExteriorCameraZoom || 7));
      options.setCameraZoom(zoom);
      options.updateCameraProjection(zoom);
    }
  }

  function restoreAchievements(): void {
    const nodeId = story.state().nodeId;
    if (nodeId === 'forgotten-complete') options.awardAchievement('echo_unnoticed', '无人问津');
    if (nodeId === 'loop-complete') options.awardAchievement('echo_eternal_lie', '永恒的谎言');
    if (nodeId === 'truth-complete' || nodeId.startsWith('visit-') || nodeId === 'epilogue-complete') {
      options.awardAchievement('echo_real_echo', '真正的回声');
    }
    if (nodeId === 'epilogue-complete') options.awardAchievement('echo_true_dawn', '真正的黎明');
  }

  function interactNpc(actorId: string, dialogs: CityDialogController): boolean {
    const cursor = options.getCursor();
    if (actorId === 'linche' && isCabinNode() && cursor) {
      const distance = Math.hypot(
        cursor.position.x - ECHO_OBSERVATORY_AREA.interior[0],
        cursor.position.z - ECHO_OBSERVATORY_AREA.interior[1],
      );
      if (distance > 20) teleportToCabin();
    }
    return story.interact(actorId, dialogs);
  }

  function interactInterestPoint(interestPointId: string, dialogs: CityDialogController): boolean {
    const handled = story.interactInterestPoint(interestPointId, dialogs);
    if (handled || interestPointId !== ECHO_CABIN_DOOR_ID || !isCabinNode()) return handled;
    // Investigation sub-nodes do not declare an exit transition. Keep the
    // current clue state intact while still allowing the physical door to work.
    teleportFromCabin();
    return true;
  }

  function isCabinNode(): boolean { return ECHO_CABIN_NODES.has(story.state().nodeId); }
  function announceGuide(): void { story.announceGuide(); }
  function syncWorldInteractions(): void { story.syncWorldInteractions(); }
  function syncActiveActors(): void { story.syncActiveActors(); }
  function updateGuide(camera: THREE.Camera): void { guide?.update(camera); }

  function dispose(): void {
    guide?.dispose();
    guide = null;
    navigation = null;
    echoInteriorView = false;
    echoExteriorCameraZoom = 7;
  }

  return {
    story,
    setupScene,
    setupGuide,
    restoreAchievements,
    isCabinNode,
    isInteriorView: () => echoInteriorView,
    setInteriorView,
    teleportToCabin,
    teleportFromCabin,
    tryExitCabinFromClick,
    navigation: () => navigation,
    interact: story.interact,
    interactBuilding: story.interactBuilding,
    interactInterestPoint,
    interactNpc,
    announceGuide,
    syncWorldInteractions,
    syncActiveActors,
    updateGuide,
    dispose,
  };
}
