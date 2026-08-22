import type { CityDialogController, StoryDialogModel } from '../adapters/ui/cityDialogController';
import {
  getWellStoryNode,
  ORANGE_TREE_COPY,
  WELL_STORY,
  WORLD_ITEM_IDS,
  type InventoryPort,
  type SceneInterestPointId,
} from '../gameplay/world/sceneInteractions';
import { WORLD_ACHIEVEMENTS } from '../gameplay/progression/worldAchievements';

interface SceneInterestPointControllerOptions {
  dialogs: Pick<CityDialogController, 'openStory'>;
  inventory: InventoryPort;
  awardAchievement: (achievementId: string, achievementName: string) => void | Promise<void>;
  showToast: (message: string) => void;
  setWellPhase?: (phase: 'idle' | 'focus' | 'engulf' | 'recede') => void;
  setBeachEncounterPhase?: (phase: 'hidden' | 'revealed' | 'reward') => void;
  focusBeachEncounter?: () => void;
  interactWithStory?: (id: SceneInterestPointId) => boolean;
  interactWithFeature?: (id: SceneInterestPointId) => boolean | Promise<boolean>;
}

export interface SceneInterestPointController {
  interact(id: SceneInterestPointId): Promise<void>;
  armBeachEncounter(): void;
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
  let beachSequenceStarted = false;
  let beachSequenceCompleted = false;
  let beachTriggerArmed = true;

  const openBeachEncounter = async (): Promise<void> => {
    if (beachSequenceStarted || beachSequenceCompleted) return;
    if (!beachTriggerArmed) return;
    if (options.inventory.hasAchievement(WORLD_ACHIEVEMENTS.westBeachEncounter.id)) {
      beachSequenceCompleted = true;
      options.setBeachEncounterPhase?.('reward');
      return;
    }
    if (!options.inventory.isOnline()) return;
    beachSequenceStarted = true;
    beachTriggerArmed = false;
    options.focusBeachEncounter?.();
    const interrupted = () => {
      if (beachSequenceCompleted) return;
      beachSequenceStarted = false;
      options.setBeachEncounterPhase?.('hidden');
    };
    const openStep = (step: number): void => {
      if (step === 0) {
        options.dialogs.openStory({
          title: '海边', role: '城市西侧', text: '*你来到了海边',
          options: [{ text: '继续', onPick: () => openStep(1) }], onClose: interrupted,
        });
        return;
      }
      if (step === 1) {
        options.dialogs.openStory({
          title: '海边', role: '海风轻轻吹过',
          text: '*看着远处的轮船慢慢经过，海鸥从远处飘过，海景是如此的美丽，你不禁感到一阵前所未有的放松。',
          options: [{ text: '继续', onPick: () => openStep(2) }], onClose: interrupted,
        });
        return;
      }
      if (step === 2) {
        options.setBeachEncounterPhase?.('revealed');
        options.dialogs.openStory({
          title: '亦航（海神）', role: '从沙滩里钻出来的蓝色人类',
          text: '哦，请问你掉的是这个俾斯麦号，还是这个希佩尔号啊？',
          options: [{ text: '……', onPick: () => openStep(3) }], onClose: interrupted,
        });
        return;
      }
      if (step === 3) {
        options.dialogs.openStory({
          title: '你', role: '仍在理解眼前发生的事情', text: '*你默不作声，还没从这反应过来。',
          options: [{ text: '继续沉默', onPick: () => openStep(4) }], onClose: interrupted,
        });
        return;
      }
      options.dialogs.openStory({
        title: '亦航（海神）', role: '海神的考验',
        text: '很好，你通过了我的考验，因为你压根就没有海军牌。作为你真诚的回报，这个送给你。',
        options: [{
          text: '收下皮尔皮茨号',
          onPick: async () => {
            const alreadyOwned = await options.inventory.hasItem(WORLD_ITEM_IDS.tirpitz, 1);
            const granted = alreadyOwned || await options.inventory.claimReward('tirpitz_beach');
            if (!granted) {
              options.dialogs.openStory({
                title: '海边', role: '奖励尚未送达', text: '海浪短暂地切断了连接。重新连上服务器后，再靠近这里试一次。',
                onClose: interrupted,
              });
              return;
            }
            beachSequenceCompleted = true;
            options.setBeachEncounterPhase?.('reward');
            await options.awardAchievement(WORLD_ACHIEVEMENTS.westBeachEncounter.id, WORLD_ACHIEVEMENTS.westBeachEncounter.name);
            options.dialogs.openStory({
              title: '获得物品', role: '皮尔皮茨号 ×1',
              text: '（内心）皮尔皮茨号：“只是一张某个二战游戏中强度不错的海军卡牌，也许可以作为纪念？”',
            });
          },
        }],
        onClose: interrupted,
      });
    };
    openStep(0);
  };

  return {
    armBeachEncounter() { beachTriggerArmed = true; },
    async interact(id) {
      if (options.interactWithStory?.(id)) return;
      if (await options.interactWithFeature?.(id)) return;
      if (id === 'cat-cafe-note') {
        options.dialogs.openStory({ title: '掉落的纸', role: '猫咖馆旁', text: '' });
        const achievement = WORLD_ACHIEVEMENTS.catCafeNote;
        await options.awardAchievement(achievement.id, achievement.name);
        return;
      }

      if (id === 'origin-orange-tree') {
        const dispatched = await options.inventory.claimReward('mandarin_daily');
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
      if (id === 'west-beach') await openBeachEncounter();
    },
  };
}

export const SCENE_INTERACTION_COPY = Object.freeze({
  orangeTree: ORANGE_TREE_COPY,
  well: WELL_STORY,
});
