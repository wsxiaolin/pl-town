import type * as THREE from 'three';
import type { CityDialogController } from '../../adapters/ui/cityDialogController';
import type { StoryPhase } from '../../gameplay/stories/StoryRuntime';

// 「回声」暂停占位控制器。
//
// 剧情暂停期间（vite.config.ts __ECHO_STORY_SUSPENDED__ = 'true'），真正的
// 控制器与剧情文本（echoStory.ts）不进任何构建产物；本文件提供一个行为替身：
//   - 林辙（linche）的交互仍被拦截，给出「调整中」提示并消费事件，
//     避免默认对话把暂停中的剧情线索剧透出去；
//   - 其余入口一律不处理，交还默认行为；
//   - 城市景观（观测站石堆、小屋等）由 sceneInterestPoints 独立维护，不受影响。
//
// 与真控制器（echoStoryController）的差异：已在剧情中的玩家无法继续推进——
// 剧情数据不在包里，"继续"物理上不成立；存档保留，恢复上线后原样接续。
//
// 恢复上线：无需改动本文件。storyOrchestration 会在开关翻转后按需加载真控制器
// 并替换掉这个占位。

export type EchoStoryHandle = {
  story: { state: () => { nodeId: string } };
  phase: () => StoryPhase;
  ownsEntry: (kind: 'actor' | 'building', targetId: string) => boolean;
  setupScene: (scene: THREE.Scene) => void;
  setupGuide: () => void;
  restoreAchievements: () => void;
  isCabinNode: () => boolean;
  isInteriorView: () => boolean;
  setInteriorView: (active: boolean) => void;
  teleportToCabin: () => void;
  teleportFromCabin: () => void;
  tryExitCabinFromClick: (raycaster: THREE.Raycaster, cabinDoor: THREE.Object3D) => boolean;
  navigation: () => unknown;
  interact: (actorId: string, dialogs: CityDialogController) => boolean | 'blocked';
  interactBuilding: (buildingId: string, dialogs: CityDialogController) => boolean | 'blocked';
  interactInterestPoint: (interestPointId: string, dialogs: CityDialogController) => boolean;
  interactNpc: (actorId: string, dialogs: CityDialogController) => boolean | 'blocked';
  announceGuide: () => void;
  syncWorldInteractions: () => void;
  syncActiveActors: () => void;
  updateGuide: (camera: THREE.Camera) => void;
  dispose: () => void;
};

const SUSPENDED_TOAST = '「回声」正在调整中，暂时无法触发';

export function createEchoSuspendedController(options: { showToast?: (message: string) => void }): EchoStoryHandle {
  const interactLinche = (actorId: string): boolean | 'blocked' => {
    if (actorId === 'linche') {
      options.showToast?.(SUSPENDED_TOAST);
      return 'blocked';
    }
    return false;
  };

  return {
    story: { state: () => ({ nodeId: 'echo-suspended' }) },
    phase: () => 'untouched',
    ownsEntry: (kind, targetId) => kind === 'actor' && targetId === 'linche',
    setupScene: () => {},
    setupGuide: () => {},
    restoreAchievements: () => {},
    isCabinNode: () => false,
    isInteriorView: () => false,
    setInteriorView: () => {},
    teleportToCabin: () => {},
    teleportFromCabin: () => {},
    tryExitCabinFromClick: () => false,
    navigation: () => null,
    interact: interactLinche,
    interactBuilding: () => false,
    interactInterestPoint: () => false,
    interactNpc: interactLinche,
    announceGuide: () => {},
    syncWorldInteractions: () => {},
    syncActiveActors: () => {},
    updateGuide: () => {},
    dispose: () => {},
  };
}
