import type { PlayerProgress } from './types.js';

export const INITIAL_CURRENCY = 1200;

const BUILDING_IDS = [
  'activity', 'bulletin', 'techhalf', 'blackhole', 'laws', 'library', 'litreview', 'catcafe',
  'academy', 'news', 'mutualaid', 'screen', 'elevator', 'residentid', 'stats', 'knowledgebaseE',
  'newsstand', 'community', 'research', 'commons', 'senate', 'writingclub', 'lab', 'culturehall',
  'teahouse', 'mall_south', 'school_east', 'mall_west', 'school_north', 'kingice', 'knowledgebaseD',
  'community_outer', 'commons_outer', 'lab_outer', 'teahouse_outer', 'writingclub_outer',
  'archive', 'tradingpost', 'records', 'guildhall', 'musichall', 'conservatory', 'arena',
  'guesthouse', 'shrine', 'beacon', 'banana_palace', 'qipai_hall', 'wushi_restaurant',
] as const;

export const BUILDING_PRICES: Readonly<Record<string, number>> = Object.freeze(
  Object.fromEntries(BUILDING_IDS.map((id) => [id, 0])),
);

// Building access can be story-controlled. Keep prices in the catalog for
// forward compatibility; litreview is deliberately held back for a future
// story rule while the existing free-unlock buildings retain their behavior.
export const BUILDING_UNLOCKABLE: Readonly<Record<string, boolean>> = Object.freeze(
  Object.fromEntries(BUILDING_IDS.map((id) => [id, id !== 'litreview'])),
);

export const ACHIEVEMENT_REWARDS: Readonly<Record<string, number>> = Object.freeze({
  citizen: 20,
  first_building: 20,
  explorer_5: 35,
  explorer_10: 60,
  walker_100: 30,
  walker_500: 80,
  chat_1: 20,
  chat_all: 60,
  night_owl: 25,
  unlock_3: 40,
  cat_cafe_note: 30,
  minicity_origin: 50,
  dragonwell_assimilation: 80,
  west_beach_encounter: 50,
  echo_unnoticed: 30,
  echo_eternal_lie: 40,
  echo_real_echo: 80,
  echo_true_dawn: 120,
});

export const SHOP_PRODUCTS = Object.freeze({
  dragonwell_tea: { itemId: 'dragonwell_tea', name: '龙井茶', unitPrice: 30 },
  beef: { itemId: 'beef', name: '牛肉', unitPrice: 45 },
  radish: { itemId: 'radish', name: '萝卜', unitPrice: 20 },
  music_box: { itemId: 'music_box', name: '音乐盒', unitPrice: 120 },
});

export const DAILY_REWARDS = Object.freeze({
  mandarin_daily: { itemId: 'mandarin', quantity: 1 },
});

export const ONE_TIME_REWARDS = Object.freeze({
  tirpitz_beach: { itemId: 'tirpitz_card', quantity: 1 },
});

export type ProgressionCatalog = {
  initialCurrency: number;
  buildingPrices: Record<string, number>;
  buildingUnlockable: Record<string, boolean>;
  achievementRewards: Record<string, number>;
  products: Record<string, { itemId: string; name: string; unitPrice: number }>;
};

export type ProgressionState = {
  progress: PlayerProgress;
  catalog: ProgressionCatalog;
};

export function getProgressionCatalog(): ProgressionCatalog {
  return {
    initialCurrency: INITIAL_CURRENCY,
    buildingPrices: { ...BUILDING_PRICES },
    buildingUnlockable: { ...BUILDING_UNLOCKABLE },
    achievementRewards: { ...ACHIEVEMENT_REWARDS },
    products: { ...SHOP_PRODUCTS },
  };
}

export function verifiedAchievementReward(progress: PlayerProgress, achievementId: string): number {
  const eligible = achievementId === 'citizen'
    || (achievementId === 'first_building' && progress.visitedBuildings.length >= 1)
    || (achievementId === 'explorer_5' && progress.visitedBuildings.length >= 5)
    || (achievementId === 'explorer_10' && progress.visitedBuildings.length >= 10)
    || (achievementId === 'unlock_3' && progress.unlockedBuildings.length >= 3);
  return eligible ? ACHIEVEMENT_REWARDS[achievementId] ?? 0 : 0;
}

export function shanghaiDayKey(at = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Shanghai', year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(at);
}
