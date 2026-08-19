import { OVERCOAT_STORY } from '../../gameplay/content/stories/overcoat/overcoatStory';
import type { StoryConditionContext, StoryEffect, StoryEvent } from '../../gameplay/stories/types';
import { LocalStorageStoryRepository } from '../../adapters/storage/stories/LocalStorageStoryRepository';
import { createStoryDialogFlow } from '../../adapters/ui/stories/storyDialogFlow';
import type { CityDialogController } from '../../adapters/ui/cityDialogController';

/**
 * 今晚别走那条街 · 支线剧情适配器
 *
 * 职责：
 *  - 持有 StoryDefinition 和本地存档 Repository
 *  - 通过 createStoryDialogFlow 将剧情节点渲染到现有对话框
 *  - 对外暴露 interactBuilding / interactNpc / state 接口
 *  - 监听 effects，在达成结局时触发成就奖励
 *
 * 接入方式：
 *  - NPC 交互（阿卡基）由 openNpcDialog 转入 interactNpc
 *  - 故事节点的 activeActorIds 通过 onActiveActorsChanged 回调同步到
 *    MiniCityApp，再与 Echo 剧情合并后驱动 NPC 可见性
 *
 * @see docs/overcoat/design.md
 */
export function createOvercoatStoryController(options: {
  awardAchievement?: (achievementId: string, name: string) => void;
  showToast?: (message: string) => void;
  getQuestContext?: () => StoryConditionContext;
  onActiveActorsChanged?: (actorIds: readonly string[]) => void;
}) {
  const repository = new LocalStorageStoryRepository(OVERCOAT_STORY);
  const flow = createStoryDialogFlow(OVERCOAT_STORY, repository, {
    getContext: options.getQuestContext,
    onEvent: (_event: StoryEvent) => {
      // Overcoat story doesn't publish achievement events;
      // achievements are triggered via flag.set on overcoat.ending (see onEffects)
    },
    onEffects: (effects: readonly StoryEffect[]) => {
      for (const effect of effects) {
        if (effect.type === 'flag.set' && effect.flagId === 'overcoat.ending') {
          const value = effect.value as string;
          if (value.startsWith('recover')) {
            options.awardAchievement?.('overcoat.recover', '至少它还认得我');
          } else if (value === 'witness') {
            options.awardAchievement?.('overcoat.witness', '城市回应了');
          } else if (value.startsWith('ghost')) {
            options.awardAchievement?.('overcoat.ghost', '今晚别走那条街');
          }
        }
      }
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
