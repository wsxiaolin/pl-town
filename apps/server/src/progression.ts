import type { PlayerProgress } from './types.js';
import { isCityBuildingBuilt, isCityBuildingFunded } from './cityGovernance.js';
import { BUILDING_CATALOG } from './buildingCatalog.js';
import { getBuildingOverrides, type BuildingUnlockState } from './worldConfig.js';

export const INITIAL_CURRENCY = 1200;
export const FILM_CITY_EXPERIENCE_PRICE = 400;

export const DEFAULT_UNLOCKED_BUILDING_IDS = ['writingclub_outer'] as const;

const BUILDING_IDS = [
  'activity', 'bulletin', 'techhalf', 'blackhole', 'laws', 'library', 'litreview', 'catcafe',
  'academy', 'news', 'mutualaid', 'screen', 'elevator', 'residentid', 'stats', 'knowledgebaseE',
  'newsstand', 'community', 'research', 'commons', 'senate', 'writingclub', 'lab', 'culturehall',
  'teahouse', 'mall_south', 'school_east', 'mall_west', 'school_north', 'kingice', 'knowledgebaseD',
  'community_outer', 'commons_outer', 'lab_outer', 'teahouse_outer', 'writingclub_outer',
  'archive', 'tradingpost', 'records', 'guildhall', 'musichall', 'conservatory', 'arena',
  'guesthouse', 'shrine', 'beacon', 'banana_palace', 'qipai_hall', 'wushi_restaurant', 'film_city', 'academy_library',
  'television_tower', 'fried_chicken_shop', 'tavern',
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

// Mirrors the client BUILDING_DEFS storyLocked flag via the generated catalog,
// so the admin map and the 3D client agree on which buildings start locked.
const STORY_LOCKED_BUILDING_IDS: ReadonlySet<string> = new Set(
  BUILDING_CATALOG.filter((building) => building.storyLocked).map((building) => building.id),
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
  cat_death_remembrance: 0,
  minicity_origin: 50,
  dragonwell_assimilation: 80,
  west_beach_encounter: 50,
  echo_unnoticed: 30,
  echo_eternal_lie: 40,
  echo_real_echo: 80,
  echo_true_dawn: 120,
  yesterday_witness: 40,
  yesterday_silence: 30,
  yesterday_true_dawn: 80,
  wild_mushroom_stubborn: 0,
  wild_mushroom_local: 0,
  magi_87_cents: 60,
  'overcoat.recover': 50,
  'overcoat.witness': 60,
  'overcoat.ghost': 80,
  murder_wanderer: 0,
  murder_watcher: 0,
  murder_chain: 0,
  murder_flirt: 0,
  murder_contact: 0,
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

export const REPEATABLE_REWARDS = Object.freeze({
  ice_reject: { itemId: 'ice_wet_crown', quantity: 1 },
  ice_accept: { itemId: 'ice_lemonade', quantity: 1 },
});

export const CONSUMABLE_ITEM_IDS: ReadonlySet<string> = new Set([
  ...Object.values(SHOP_PRODUCTS).map((product) => product.itemId),
  REPEATABLE_REWARDS.ice_accept.itemId,
]);

export type ProgressionCatalog = {
  initialCurrency: number;
  buildingPrices: Record<string, number>;
  buildingUnlockable: Record<string, boolean>;
  globallyUnlockedBuildings: string[];
  achievementRewards: Record<string, number>;
  products: Record<string, { itemId: string; name: string; unitPrice: number }>;
};

export type ProgressionState = {
  progress: PlayerProgress;
  catalog: ProgressionCatalog;
};

export type ResolvedBuildingState = 'locked' | 'unlockable' | 'open';
export type BuildingUnlockResolution = {
  id: string;
  label: string;
  num: string;
  x: number;
  z: number;
  storyLocked: boolean;
  override: BuildingUnlockState | null;
  state: ResolvedBuildingState;
  defaultState: ResolvedBuildingState;
};

/**
 * Resolve the effective access state for every catalog building. Overrides come
 * from the admin world config; the fallback mirrors the client data: a building
 * flagged `storyLocked` stays locked until a story rule or an admin override
 * opens it, every other building is unlockable by residents.
 */
export function resolveBuildingUnlockStates(): BuildingUnlockResolution[] {
  const overrides = getBuildingOverrides();
  return BUILDING_CATALOG
    .filter((building) => building.id in BUILDING_PRICES)
    .map((building) => {
      const override = overrides[building.id] ?? null;
      const defaultState: ResolvedBuildingState = STORY_LOCKED_BUILDING_IDS.has(building.id) || BUILDING_UNLOCKABLE[building.id] !== true ? 'locked' : 'unlockable';
      const state: ResolvedBuildingState = !isCityBuildingBuilt(building.id) || override === 'locked' ? 'locked'
        : override === 'open' || (isCityBuildingFunded(building.id) && defaultState !== 'locked') ? 'open'
        : defaultState;
      return { id: building.id, label: building.label, num: building.num, x: building.x, z: building.z, storyLocked: building.storyLocked, override, state, defaultState };
    });
}

export function isBuildingGloballyUnlocked(buildingId: string): boolean {
  return isBuildingUnlockable(buildingId) && (getBuildingOverrides()[buildingId] === 'open' || isCityBuildingFunded(buildingId));
}

/** Effective unlockability after admin overrides (a locked building can never be unlocked). */
export function isBuildingUnlockable(buildingId: string): boolean {
  if (!isCityBuildingBuilt(buildingId)) return false;
  const override = getBuildingOverrides()[buildingId];
  if (override === 'locked') return false;
  if (override === 'open') return true;
  if (STORY_LOCKED_BUILDING_IDS.has(buildingId)) return false;
  return BUILDING_UNLOCKABLE[buildingId] === true;
}

export function getProgressionCatalog(): ProgressionCatalog {
  const buildingUnlockable: Record<string, boolean> = {};
  for (const id of BUILDING_IDS) buildingUnlockable[id] = isBuildingUnlockable(id);
  const globallyUnlockedBuildings: string[] = [];
  for (const id of BUILDING_IDS) if (isBuildingGloballyUnlocked(id)) globallyUnlockedBuildings.push(id);
  return {
    initialCurrency: INITIAL_CURRENCY,
    buildingPrices: { ...BUILDING_PRICES },
    buildingUnlockable,
    globallyUnlockedBuildings,
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
