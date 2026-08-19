import { MAGI_STORY } from '../../gameplay/content/stories/magi/magiStory';
import type { StoryConditionContext, StoryEffect, StoryEvent } from '../../gameplay/stories/types';
import { LocalStorageStoryRepository } from '../../adapters/storage/stories/LocalStorageStoryRepository';
import { createStoryDialogFlow } from '../../adapters/ui/stories/storyDialogFlow';
import type { CityDialogController } from '../../adapters/ui/cityDialogController';

/**
 * 麦琪的礼物 · 支线剧情适配器
 *
 * 职责：
 *  - 持有 StoryDefinition 和本地存档 Repository
 *  - 通过 createStoryDialogFlow 将剧情节点渲染到现有对话框
 *  - 对外暴露 interactBuilding / interactNpc / state 接口
 *  - 监听 effects，在达成结局时触发成就奖励
 *
 * 接入方式：
 *  - 建筑交互（商场→假发店/表链店、客栈→平安夜）由 MiniCityApp 的
 *    buildingInteraction 转入 interactBuilding
 *  - NPC 交互（德拉、吉姆）由 openNpcDialog 转入 interactNpc
 *  - 故事节点的 activeActorIds 通过 onActiveActorsChanged 回调同步到
 *    MiniCityApp，再与 Echo 剧情合并后驱动 NPC 可见性
 *
 * @see docs/story-authoring.md
 */
export function createMagiStoryController(options: {
  awardAchievement?: (achievementId: string, name: string) => void;
  showToast?: (message: string) => void;
  getQuestContext?: () => StoryConditionContext;
  onActiveActorsChanged?: (actorIds: readonly string[]) => void;
}) {
  const repository = new LocalStorageStoryRepository(MAGI_STORY);
  const flow = createStoryDialogFlow(MAGI_STORY, repository, {
    getContext: options.getQuestContext,
    onEvent: (event: StoryEvent) => {
      if (event.type === 'magi.achievement.87-cents') {
        options.awardAchievement?.('magi_87_cents', '一美元八十七美分');
      }
    },
    onEffects: (_effects: readonly StoryEffect[]) => {
      // 成就事件已在 onEvent 中处理
    },
    onActiveActorsChanged: (actorIds: readonly string[]) => {
      options.onActiveActorsChanged?.(actorIds);
    },
  });

  function interactBuilding(buildingId: string, dialogs: CityDialogController): boolean {
    return flow.interactBuilding(buildingId, dialogs);
  }

  function interactNpc(npcId: string, dialogs: CityDialogController): boolean {
    return flow.interact(npcId, dialogs);
  }

  function announceGuide(): void {
    flow.announceGuide();
  }

  function syncActiveActors(): void {
    flow.syncActiveActors();
  }

  function state() {
    return flow.state();
  }

  function dispose(): void {
    // LocalStorageStoryRepository 自动持久化，无需额外清理
  }

  return {
    story: flow,
    interactBuilding,
    interactNpc,
    announceGuide,
    syncActiveActors,
    state,
    dispose,
  };
}
