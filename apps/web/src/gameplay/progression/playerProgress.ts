import type { QuestProgressView } from '../quests/types';
import { ICE_KING_ITEMS } from '../content/stories/iceKing/iceKingContent';

export type PlayerProgress = {
  currency: number;
  inventory: Record<string, number>;
  repeatableRewardClaims: Record<string, number>;
  achievements: string[];
  unlockedBuildings: string[];
  visitedBuildings: string[];
};

export type ProgressionCatalog = {
  initialCurrency: number;
  buildingPrices: Record<string, number>;
  buildingUnlockable?: Record<string, boolean>;
  achievementRewards: Record<string, number>;
  products: Record<string, { itemId: string; name: string; unitPrice: number }>;
};

export type ProgressionEvent = {
  type?: string;
  buildingId?: string;
  achievementId?: string;
  productId?: string;
  itemId?: string;
  rewardId?: string;
  reward?: number;
  quantity?: number;
  purchased?: boolean;
  claimed?: boolean;
  accepted?: boolean;
  claimSequence?: number;
  welcomeItemsGranted?: boolean;
};

export const EMPTY_PLAYER_PROGRESS: PlayerProgress = {
  currency: 0,
  inventory: {},
  repeatableRewardClaims: {},
  achievements: [],
  unlockedBuildings: [],
  visitedBuildings: [],
};

export const EMPTY_PROGRESSION_CATALOG: ProgressionCatalog = {
  initialCurrency: 0,
  buildingPrices: {},
  achievementRewards: {},
  products: {},
};

export const ITEM_LABELS: Readonly<Record<string, string>> = Object.freeze({
  city_guide: '城市导览册',
  city_badge: '居民纪念徽章',
  dragonwell_tea: '龙井茶',
  beef: '牛肉',
  radish: '萝卜',
  music_box: '音乐盒',
  mandarin: '沃柑',
  tirpitz_card: '皮尔皮茨号',
  [ICE_KING_ITEMS.wetCrown.id]: ICE_KING_ITEMS.wetCrown.name,
  [ICE_KING_ITEMS.lemonade.id]: ICE_KING_ITEMS.lemonade.name,
});

export const ITEM_DETAILS: Readonly<Record<string, string>> = Object.freeze({
  [ICE_KING_ITEMS.wetCrown.id]: ICE_KING_ITEMS.wetCrown.detail,
  [ICE_KING_ITEMS.lemonade.id]: ICE_KING_ITEMS.lemonade.detail,
});

const validStringArray = (value: unknown): string[] => Array.isArray(value)
  ? [...new Set(value.filter((item): item is string => typeof item === 'string' && item.length > 0))]
  : [];

export function normalizePlayerProgress(value: unknown): PlayerProgress {
  if (!value || typeof value !== 'object') return { ...EMPTY_PLAYER_PROGRESS, inventory: {}, repeatableRewardClaims: {} };
  const input = value as Partial<PlayerProgress>;
  const inventory: Record<string, number> = {};
  const repeatableRewardClaims: Record<string, number> = {};
  if (input.inventory && typeof input.inventory === 'object') {
    Object.entries(input.inventory).forEach(([itemId, quantity]) => {
      if (Number.isInteger(quantity) && Number(quantity) > 0) inventory[itemId] = Number(quantity);
    });
  }
  if (input.repeatableRewardClaims && typeof input.repeatableRewardClaims === 'object') {
    Object.entries(input.repeatableRewardClaims).forEach(([rewardId, count]) => {
      if (Number.isSafeInteger(count) && Number(count) >= 0) repeatableRewardClaims[rewardId] = Number(count);
    });
  }
  return {
    currency: Number.isInteger(input.currency) && Number(input.currency) >= 0 ? Number(input.currency) : 0,
    inventory,
    repeatableRewardClaims,
    achievements: validStringArray(input.achievements),
    unlockedBuildings: validStringArray(input.unlockedBuildings),
    visitedBuildings: validStringArray(input.visitedBuildings),
  };
}

export function inventoryEntries(progress: PlayerProgress): Array<{ itemId: string; name: string; quantity: number }> {
  return Object.entries(progress.inventory)
    .filter((entry): entry is [string, number] => Number.isInteger(entry[1]) && entry[1] > 0)
    .map(([itemId, quantity]) => ({ itemId, name: ITEM_LABELS[itemId] ?? itemId, quantity }))
    .sort((left, right) => left.name.localeCompare(right.name, 'zh-CN'));
}

export function canInteractWithBuilding(progress: PlayerProgress, buildingId: string): boolean {
  return progress.unlockedBuildings.includes(buildingId);
}

export function toQuestProgressView(progress: PlayerProgress): QuestProgressView {
  return {
    flags: {},
    inventory: progress.inventory,
    achievements: new Set(progress.achievements),
    unlockedBuildings: new Set(progress.unlockedBuildings),
    unlockedDistricts: new Set(),
  };
}
