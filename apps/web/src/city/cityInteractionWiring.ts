// 交互接线：指针拾取（建筑/NPC/兴趣点/住宅/传送目标）、第一人称前方交互、
// 交互统计与 NPC 对话路由的装配从组合根抽出。组合根仍持有全部状态
// （光标、建筑表、故事编排等），通过窄上下文以惰性 getter 注入。
import * as THREE from 'three';
import type { CityDialogController, NpcEntityLike } from '../adapters/ui/cityDialogController';
import type { Npc } from './npcSystem';
import { findBuildingFromRaycastHits } from './buildingRaycast';
import { createFirstPersonInteract } from './navigation/firstPersonWalkAssist';
import { createInteractionPointer, type InteractionPointerOptions } from './interactionPointer';
import { createInteractionTracker, type InteractionTrackerOptions } from './interactionTracker';
import { routeNpcDialog, type StoryOrchestration } from './storyOrchestration';
import { showUnlockToast } from './toast';

export type CityInteractionWiringOptions = Omit<
  InteractionPointerOptions,
  'getCityDialogs' | 'findRaycastBuilding' | 'openNpcDialog'
> & InteractionTrackerOptions & {
    /** 完整对话框控制器：routeNpcDialog/openNpc 需要完整接口，
     *  InteractionPointerOptions 只消费 isOpen 的窄切面，故从上下文 Omit 后重声明。 */
    getCityDialogs: () => CityDialogController | null;
    /** 第一人称相机（激活时为透视相机，未激活为 null）。 */
    getActiveFpCamera: () => THREE.Camera | null;
    exitFirstPerson: () => void;
    getStoryRouter: () => StoryOrchestration['router'] | undefined;
  };

export function createCityInteractionWiring(options: CityInteractionWiringOptions) {
  function findRaycastBuilding(hits: readonly THREE.Intersection[]) {
    return findBuildingFromRaycastHits({
      hits,
      buildings: options.getBuildings(),
      readUserData: (object, key) => options.raycastUserData(object, key),
      isUnavailable: options.isBuildingUnavailable,
    });
  }

  function openNpcDialog(npc: Npc) {
    const router = options.getStoryRouter();
    if (!router) return;
    const cursor = options.getCursorChar();
    routeNpcDialog(
      router,
      options.getCityDialogs(),
      npc.profile.id,
      () => options.getCityDialogs()?.openNpc(npc as NpcEntityLike, cursor ? { x: cursor.position.x, z: cursor.position.z } : undefined),
      () => interactionTracker.recordNpcInteraction(npc.profile.id),
    );
  }

  const interactionTracker = createInteractionTracker({
    getStats: options.getStats,
    saveStats: options.saveStats,
    updateWelcome: options.updateWelcome,
    getProgressionController: options.getProgressionController,
    getQuestRuntime: options.getQuestRuntime,
    getEchoStoryController: options.getEchoStoryController,
    getCamera: options.getCamera,
    getQuestEventSequence: options.getQuestEventSequence,
    incrementQuestEventSequence: options.incrementQuestEventSequence,
    getCursorChar: options.getCursorChar,
  });

  const interactionPointer = createInteractionPointer({
    ...options,
    getCityDialogs: options.getCityDialogs,
    findRaycastBuilding,
    openNpcDialog,
  });

  const firstPersonInteract = createFirstPersonInteract({
    getActiveCamera: options.getActiveFpCamera,
    raycaster: options.getRaycaster(),
    getRaycastGroups: options.getRaycastBuildingGroups,
    findBuilding: findRaycastBuilding,
    exit: options.exitFirstPerson,
    showToast: showUnlockToast,
    interactOrWalk: (building) => interactionPointer.interactOrWalk(building),
  });

  return { interactionPointer, firstPersonInteract, interactionTracker, findRaycastBuilding, openNpcDialog };
}
