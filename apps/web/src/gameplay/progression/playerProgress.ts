import type { QuestProgressView } from '../quests/types';
import { ICE_KING_ITEMS } from '../content/stories/iceKing/iceKingContent';

export type PlayerProgress = {
  currency: number;
  inventory: Record<string, number>;
  repeatableRewardClaims: Record<string, number>;
  achievements: string[];
  unlockedBuildings: string[];
  visitedBuildings: string[];
  daily: {
    dayKey: string;
    checkInStreak: number;
    checkInClaimed: boolean;
    visitedBuildings: string[];
    claimedMissions: string[];
    fulfilledOrders: string[];
  };
};

export type MarketIngredient = { itemId: string; quantity: number };
export type MarketRecipe = {
  id: string;
  name: string;
  description: string;
  ingredients: ReadonlyArray<MarketIngredient>;
  output: MarketIngredient;
};
export type DailySupplyOrder = {
  id: string;
  title: string;
  description: string;
  requirements: ReadonlyArray<MarketIngredient>;
  reward: number;
};
export type MarketListingView = {
  id: string;
  itemId: string;
  quantity: number;
  price: number;
  status: 'active' | 'sold' | 'cancelled';
  sellerId: string;
  sellerNickname: string;
  buyerId: string | null;
  createdAt: string;
};

export type ProgressionCatalog = {
  initialCurrency: number;
  buildingPrices: Record<string, number>;
  buildingUnlockable?: Record<string, boolean>;
  globallyUnlockedBuildings?: string[];
  achievementRewards: Record<string, number>;
  products: Record<string, { itemId: string; name: string; unitPrice: number; category: 'food' | 'story' }>;
  dailyCheckIn: { baseReward: number; streakBonus: number; maxStreakBonus: number };
  dailyMissions: ReadonlyArray<{ id: string; title: string; description: string; target: number; reward: number }>;
  store: { dayKey: string; featuredProductId: string; discountPercent: number };
  recipes?: ReadonlyArray<MarketRecipe>;
  dailySupplyOrder?: DailySupplyOrder & { dayKey: string };
  market?: { maxListingQuantity: number; maxListingPrice: number; maxActiveListings: number };
  tradeableItemIds?: string[];
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
  missionId?: string;
  streak?: number;
  pricePaid?: number;
  featured?: boolean;
  recipeId?: string;
  orderId?: string;
  listingId?: string;
  price?: number;
  crafted?: boolean;
  fulfilled?: boolean;
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
  daily: { dayKey: '', checkInStreak: 0, checkInClaimed: false, visitedBuildings: [], claimedMissions: [], fulfilledOrders: [] },
};

export const EMPTY_PROGRESSION_CATALOG: ProgressionCatalog = {
  initialCurrency: 0,
  buildingPrices: {},
  achievementRewards: {},
  products: {},
  dailyCheckIn: { baseReward: 0, streakBonus: 0, maxStreakBonus: 0 },
  dailyMissions: [],
  store: { dayKey: '', featuredProductId: '', discountPercent: 0 },
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
  shared_meal: '热炖牛肉',
  tea_service: '龙井茶席',
  memory_parcel: '夜谈礼盒',
  [ICE_KING_ITEMS.wetCrown.id]: ICE_KING_ITEMS.wetCrown.name,
  [ICE_KING_ITEMS.lemonade.id]: ICE_KING_ITEMS.lemonade.name,
});

export const ITEM_DETAILS: Readonly<Record<string, string>> = Object.freeze({
  [ICE_KING_ITEMS.wetCrown.id]: ICE_KING_ITEMS.wetCrown.detail,
  [ICE_KING_ITEMS.lemonade.id]: ICE_KING_ITEMS.lemonade.detail,
  shared_meal: '热炖牛肉 · 可交付社区厨房或在交易所出售',
  tea_service: '龙井茶席 · 可交付图书馆或在交易所出售',
  memory_parcel: '夜谈礼盒 · 可交付音乐厅或在交易所出售',
});

const validStringArray = (value: unknown): string[] => Array.isArray(value)
  ? [...new Set(value.filter((item): item is string => typeof item === 'string' && item.length > 0))]
  : [];

export function normalizePlayerProgress(value: unknown): PlayerProgress {
  if (!value || typeof value !== 'object') return { ...EMPTY_PLAYER_PROGRESS, inventory: {}, repeatableRewardClaims: {} };
  const input = value as Partial<PlayerProgress>;
  const inventory: Record<string, number> = {};
  const repeatableRewardClaims: Record<string, number> = {};
  const daily = input.daily && typeof input.daily === 'object' ? input.daily : EMPTY_PLAYER_PROGRESS.daily;
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
    daily: {
      dayKey: typeof daily.dayKey === 'string' ? daily.dayKey : '',
      checkInStreak: Number.isSafeInteger(daily.checkInStreak) && daily.checkInStreak >= 0 ? Number(daily.checkInStreak) : 0,
      checkInClaimed: daily.checkInClaimed === true,
      visitedBuildings: validStringArray(daily.visitedBuildings),
      claimedMissions: validStringArray(daily.claimedMissions),
      fulfilledOrders: validStringArray(daily.fulfilledOrders),
    },
  };
}

/**
 * Inventory rows for the backpack panel. Names resolve from the live shop
 * catalog first, so a renamed or newly configured product keeps showing its
 * configured name instead of falling back to the raw item id.
 */
export function inventoryEntries(progress: PlayerProgress, products?: Readonly<Record<string, { name?: string }>>): Array<{ itemId: string; name: string; quantity: number }> {
  return Object.entries(progress.inventory)
    .filter((entry): entry is [string, number] => Number.isInteger(entry[1]) && entry[1] > 0)
    .map(([itemId, quantity]) => ({ itemId, name: products?.[itemId]?.name ?? ITEM_LABELS[itemId] ?? itemId, quantity }))
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
