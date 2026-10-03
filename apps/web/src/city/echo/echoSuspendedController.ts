import type { createEchoStoryController } from './echoStoryController';

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

/** 契约直接派生自真控制器（type-only import 编译期擦除，不会把剧情拉进
 *  包）：真控制器新增成员时本文件编译即红，不再靠手抄 22 个成员对齐。
 *  两处收窄：story 只留暂停期被消费的 state().nodeId（完整 dialog flow 面
 *  由 StoryRuntime 在真控制器内部驱动，暂停期物理上不存在）；interact 从
 *  句柄删除——router/gate 走 interactNpc/ownsEntry，全仓无 handle.interact
 *  消费方，删掉入口比再挂一个 toast 出口更不容易误用。 */
export type EchoStoryHandle = Omit<ReturnType<typeof createEchoStoryController>, 'story' | 'interact'> & {
  story: { state: () => { nodeId: string } };
};

const SUSPENDED_TOAST = '「回声」正在调整中，暂时无法触发';

// Synthetic nodeId: only 'untouched' 相位下的展示性查询会读它，所有消费方都
// 只与 'confrontation-active' 这类真 nodeId 做相等比较。若未来有人对 echo 的
// nodeId 做 startsWith / switch 分派，会读到这个假值——改之前先想清楚。
const SUSPENDED_NODE_ID = 'echo-suspended';

export function createEchoSuspendedController(options: { showToast?: (message: string) => void }): EchoStoryHandle {
  const interactLinche = (actorId: string): boolean | 'blocked' => {
    if (actorId === 'linche') {
      options.showToast?.(SUSPENDED_TOAST);
      return 'blocked';
    }
    return false;
  };

  return {
    story: { state: () => ({ nodeId: SUSPENDED_NODE_ID }) },
    phase: () => 'untouched',
    ownsEntry: (kind, targetId) => kind === 'actor' && targetId === 'linche',
    setupScene: () => {},
    setupGuide: () => {},
    // No-op while suspended: achievements live in localStorage-backed
    // legacyStats, so a pre-suspension save that finished echo but never
    // persisted the 4 echo achievements will not backfill them during the
    // suspension window. Self-consistent with "剧情不可推进" — restoring the
    // story re-runs the real controller's restoreAchievements and they return.
    restoreAchievements: () => {},
    isCabinNode: () => false,
    isInteriorView: () => false,
    setInteriorView: () => {},
    teleportToCabin: () => {},
    teleportFromCabin: () => {},
    tryExitCabinFromClick: () => false,
    navigation: () => null,
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
