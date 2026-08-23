import { CAT_CAFE_ICE_WALL, ICE_KING_ITEMS } from '../../gameplay/content/stories/iceKing/iceKingContent';
import { WORLD_ACHIEVEMENTS } from '../../gameplay/progression/worldAchievements';
import type { SceneInterestPointId } from '../../gameplay/world/sceneInteractions';

interface IceWallInventoryPort {
  hasItem(itemId: string, count?: number): boolean | Promise<boolean>;
  consumeItem(itemId: string, count: number): boolean | Promise<boolean>;
}

type CatDeathPlaybackResult = 'completed' | 'skipped' | 'restarted' | null;

interface IceWallDialogPort {
  openStory(story: {
    title: string;
    role: string | null;
    text: string;
    options?: readonly { text: string; onPick: () => void | Promise<void> }[];
  }): void;
}

export function createCatCafeIceWallInteraction(options: {
  dialogs: IceWallDialogPort;
  inventory: IceWallInventoryPort;
  awardAchievement: (achievementId: string, achievementName: string) => void | Promise<void>;
  showToast: (message: string) => void;
  startCatDeathCG: () => CatDeathPlaybackResult | Promise<CatDeathPlaybackResult>;
}) {
  async function interact(id: SceneInterestPointId): Promise<boolean> {
    if (id !== CAT_CAFE_ICE_WALL.interestPointId) return false;
    const hasLemonade = await options.inventory.hasItem(ICE_KING_ITEMS.lemonade.id, 1);
    options.dialogs.openStory({
      title: CAT_CAFE_ICE_WALL.title,
      role: hasLemonade ? '背包里的冰镇柠檬水似乎有了反应' : null,
      text: CAT_CAFE_ICE_WALL.copy,
      options: hasLemonade ? [{
        text: CAT_CAFE_ICE_WALL.useItemOption,
        onPick: async () => {
          const consumed = await options.inventory.consumeItem(ICE_KING_ITEMS.lemonade.id, 1);
          if (!consumed) {
            options.showToast('冰镇柠檬水已经不在背包里了');
            return;
          }
          const result = await options.startCatDeathCG();
          if (result === 'completed') {
            const achievement = WORLD_ACHIEVEMENTS.catDeathRemembrance;
            await options.awardAchievement(achievement.id, achievement.name);
          }
        },
      }] : [],
    });
    return true;
  }

  return { interact };
}

export function createCatCafeIceWallFeature(options: {
  dialogs: IceWallDialogPort & { closeNpc(): void };
  progression: {
    isOnline(): boolean;
    getProgress(): { inventory: Readonly<Record<string, number | undefined>> };
    consumeItem(itemId: string, count: number): Promise<boolean>;
  };
  awardAchievement: (achievementId: string, achievementName: string) => void | Promise<void>;
  showToast: (message: string) => void;
  startCatDeathCG: () => CatDeathPlaybackResult | Promise<CatDeathPlaybackResult>;
  stopCatDeathCG: () => boolean;
}) {
  const interaction = createCatCafeIceWallInteraction({
    dialogs: options.dialogs,
    inventory: {
      hasItem: (itemId, count = 1) => options.progression.isOnline()
        && (options.progression.getProgress().inventory[itemId] ?? 0) >= count,
      consumeItem: options.progression.consumeItem,
    },
    awardAchievement: options.awardAchievement,
    showToast: options.showToast,
    startCatDeathCG: async () => {
      options.dialogs.closeNpc();
      return options.startCatDeathCG();
    },
  });
  return { interact: interaction.interact, dispose: options.stopCatDeathCG };
}
