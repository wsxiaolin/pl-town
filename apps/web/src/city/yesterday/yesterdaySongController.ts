import { YESTERDAY_SONG } from '../../gameplay/content/stories/yesterday/yesterdaySong';
import type { StoryConditionContext, StoryEffect, StoryEvent } from '../../gameplay/stories/types';
import { LocalStorageStoryRepository } from '../../adapters/storage/stories/LocalStorageStoryRepository';
import { createStoryDialogFlow } from '../../adapters/ui/stories/storyDialogFlow';
import type { CityDialogController } from '../../adapters/ui/cityDialogController';

/**
 * 昨日之歌 · 支线剧情适配器
 *
 * 职责：
 *  - 持有 StoryDefinition 和本地存档 Repository
 *  - 通过 createStoryDialogFlow 将剧情节点渲染到现有对话框
 *  - 对外暴露 interactBuilding / interactNpc / state 接口
 *  - 监听 effects，在达成结局时触发成就奖励
 *
 * 接入方式：
 *  - 建筑交互（档案馆→日记、报摊→秋嫂/周三等待）由 MiniCityApp 的
 *    buildingInteraction 转入 interactBuilding
 *  - NPC 交互（秋嫂、画翁）由 openNpcDialog 转入 interactNpc
 *  - 故事节点的 activeActorIds 通过 onActiveActorsChanged 回调同步到
 *    MiniCityApp，再与 Echo 剧情合并后驱动 NPC 可见性
 *
 * @see docs/story-authoring.md
 */
export function createYesterdaySongController(options: {
  awardAchievement?: (achievementId: string, name: string) => void;
  showToast?: (message: string) => void;
  getQuestContext?: () => StoryConditionContext;
  onActiveActorsChanged?: (actorIds: readonly string[]) => void;
}) {
  const repository = new LocalStorageStoryRepository(YESTERDAY_SONG);
  const flow = createStoryDialogFlow(YESTERDAY_SONG, repository, {
    getContext: options.getQuestContext,
    onEvent: (event: StoryEvent) => {
      if (event.type === 'yesterday.achievement.witness') {
        options.awardAchievement?.('yesterday_witness', '见证者');
      }
      if (event.type === 'yesterday.achievement.silence') {
        options.awardAchievement?.('yesterday_silence', '沉默是金');
      }
      if (event.type === 'yesterday.achievement.true-dawn') {
        options.awardAchievement?.('yesterday_true_dawn', '昨日之歌');
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
    const interaction = YESTERDAY_SONG.interactions?.find(
      (item) => item.actorId === npcId && item.nodeId === flow.state().nodeId,
    );
    if (!interaction) return false;
    return flow.choose(dialogs, interaction.choiceId);
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
