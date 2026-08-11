import type { CityDialogController, StoryDialogModel } from '../adapters/ui/cityDialogController';
import {
  getWellStoryNode,
  ORANGE_TREE_COPY,
  WELL_STORY,
  WORLD_ACHIEVEMENTS,
  WORLD_ITEM_IDS,
  type InventoryPort,
  type SceneInterestPointId,
} from '../gameplay/world/sceneInteractions';

interface SceneInterestPointControllerOptions {
  dialogs: Pick<CityDialogController, 'openStory'>;
  inventory: InventoryPort;
  awardAchievement: (achievementId: string, achievementName: string) => void | Promise<void>;
  showToast: (message: string) => void;
  setWellPhase?: (phase: 'idle' | 'focus' | 'engulf' | 'recede') => void;
  interactWithStory?: (id: SceneInterestPointId) => boolean;
}

export interface SceneInterestPointController {
  interact(id: SceneInterestPointId): Promise<void>;
}

export function createSceneInterestPointController(
  options: SceneInterestPointControllerOptions,
): SceneInterestPointController {
  const openWellStory = async (): Promise<void> => {
    options.setWellPhase?.('focus');
    const online = options.inventory.isOnline();
    const hasTea = await options.inventory.hasItem(WORLD_ITEM_IDS.longjingTea, 1);
    const intro = getWellStoryNode('intro', hasTea);
    const story: StoryDialogModel = {
      title: '爬满植物的石井',
      role: !online ? '离线时无法使用背包物品' : hasTea ? '你身上有一份龙井茶' : '你还没有龙井茶',
      text: intro.text,
      tone: intro.tone,
      options: hasTea ? [{
        text: intro.option!,
          onPick: async () => {
          options.setWellPhase?.('engulf');
          const consumed = await options.inventory.consumeItem(WORLD_ITEM_IDS.longjingTea, 1);
          if (!consumed) {
            options.showToast('龙井茶已经不在背包里了');
            await openWellStory();
            return;
          }
          const transformed = getWellStoryNode('transformed', true);
          options.dialogs.openStory({
            title: '爬满植物的石井',
            role: '绿色正在蔓延',
            text: transformed.text,
            tone: transformed.tone,
            options: [{
              text: transformed.option!,
                onPick: async () => {
                options.setWellPhase?.('recede');
                const awake = getWellStoryNode('awake', true);
                options.dialogs.openStory({
                  title: '干净如新的石井',
                  role: '仿佛只是一场梦',
                  text: awake.text,
                  tone: awake.tone,
                  onClose: () => options.setWellPhase?.('idle'),
                });
                const achievement = WORLD_ACHIEVEMENTS.longjingAssimilation;
                await options.awardAchievement(achievement.id, achievement.name);
              },
            }],
            onClose: () => options.setWellPhase?.('idle'),
          });
        },
      }] : [],
      onClose: () => options.setWellPhase?.('idle'),
    };
    options.dialogs.openStory(story);
  };

  return {
    async interact(id) {
      if (options.interactWithStory?.(id)) return;
      if (id === 'cat-cafe-note') {
        options.dialogs.openStory({ title: '掉落的纸', role: '猫咖馆旁', text: '' });
        const achievement = WORLD_ACHIEVEMENTS.catCafeNote;
        await options.awardAchievement(achievement.id, achievement.name);
        return;
      }

      if (id === 'origin-orange-tree') {
        const dispatched = await options.inventory.claimDailyReward('mandarin_daily');
        const rewardMessage = dispatched
          ? '获得沃柑 ×1'
          : options.inventory.isOnline()
            ? '今天已经领取过沃柑了。'
            : '离线时无法领取每日沃柑。';
        options.dialogs.openStory({
          title: '沃柑树',
          role: rewardMessage,
          text: ORANGE_TREE_COPY,
        });
        const achievement = WORLD_ACHIEVEMENTS.cityOrigin;
        await options.awardAchievement(achievement.id, achievement.name);
        if (!options.inventory.isOnline()) options.showToast(rewardMessage);
        return;
      }

      if (id === 'longjing-well') await openWellStory();
    },
  };
}

export const SCENE_INTERACTION_COPY = Object.freeze({
  orangeTree: ORANGE_TREE_COPY,
  well: WELL_STORY,
});
