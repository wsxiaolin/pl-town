import type { PlayerProgress } from './types.js';
import { isCityBuildingBuilt, isCityProjectBuilt } from './cityGovernance.js';
import { BUILDING_CATALOG } from './buildingCatalog.js';
import { DEFAULT_SHOP_CATALOG, type ShopProduct } from './shopCatalog.js';
import { getBuildingOverrides, getShopProducts, type BuildingUnlockState } from './worldConfig.js';
import { shanghaiDayKey } from './shanghaiTime.js';
export { shanghaiDayKey } from './shanghaiTime.js';

export const INITIAL_CURRENCY = 1200;
export const FILM_CITY_EXPERIENCE_PRICE = 400;

// Personal access defaults do not complete city projects. Construction must
// finish before this legacy unlock can permit a visit in a fresh town.
export const DEFAULT_UNLOCKED_BUILDING_IDS = ['writingclub_outer'] as const;

const BUILDING_IDS = [
  'activity', 'bulletin', 'techhalf', 'blackhole', 'laws', 'library', 'litreview', 'catcafe',
  'academy', 'news', 'mutualaid', 'screen', 'elevator', 'residentid', 'stats', 'knowledgebaseE',
  'newsstand', 'community', 'research', 'commons', 'senate', 'writingclub', 'lab', 'culturehall',
  'teahouse', 'mall_south', 'school_east', 'mall_west', 'school_north', 'kingice', 'knowledgebaseD',
  'community_outer', 'commons_outer', 'lab_outer', 'teahouse_outer', 'writingclub_outer',
  'archive', 'tradingpost', 'records', 'guildhall', 'musichall', 'conservatory', 'arena',
  'guesthouse', 'shrine', 'beacon', 'banana_palace', 'qipai_hall', 'wushi_restaurant', 'film_city', 'academy_library',
  'television_tower', 'fried_chicken_shop', 'tavern', 'photostudio',
  'north_chat_plaza', 'north_pigeon_square', 'north_stellar_hall', 'north_singularity',
  'north_binary_garden', 'north_maya_grove', 'north_api_memorial', 'north_worry_store',
  'north_bistro', 'north_night_kiosk', 'north_jukebox', 'north_backrooms_door',
  'north_komorebi',
  'fireworks_shop', 'observation_deck',
  'painting_ai',
  'north_genshin_institute',
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

// Cloud-verified stat achievements keep their currency rewards; story
// achievements are unlock markers only, so their rewards are intentionally 0
// (verifiedAchievementReward never grants them currency).
export const ACHIEVEMENT_REWARDS: Readonly<Record<string, number>> = Object.freeze({
  citizen: 20,
  first_building: 20,
  explorer_5: 35,
  explorer_10: 60,
  unlock_3: 40,
  cat_cafe_note: 0,
  cat_death_remembrance: 0,
  minicity_origin: 0,
  dragonwell_assimilation: 0,
  west_beach_encounter: 0,
  echo_unnoticed: 0,
  echo_eternal_lie: 0,
  echo_real_echo: 0,
  echo_true_dawn: 0,
  yesterday_witness: 0,
  yesterday_silence: 0,
  yesterday_true_dawn: 0,
  wild_mushroom_stubborn: 0,
  wild_mushroom_local: 0,
  magi_87_cents: 0,
  'overcoat.recover': 0,
  'overcoat.witness': 0,
  'overcoat.ghost': 0,
  reddot_first_press: 0,
  reddot_sixteen: 0,
  reddot_half_second: 0,
  reddot_remake: 0,
  reddot_sunday: 0,
  reddot_256: 0,
  singlestep_four_beats: 0,
  singlestep_rerun: 0,
  singlestep_burner: 0,
  singlestep_44s: 0,
  singlestep_non: 0,
  proofread_renumber: 0,
  proofread_intercepted: 0,
  proofread_again: 0,
  proofread_bell_good: 0,
  proofread_twenty_seven: 0,
  proofread_patch: 0,
  recruit_everyone: 0,
  recruit_ok: 0,
  recruit_hepangpang: 0,
  recruit_cerman: 0,
  recruit_missing_person: 0,
  recruit_seven_saves: 0,
  recruit_bound: 0,
  recruit_mie: 0,
  duc_pact: 0,
  duc_no_rename: 0,
  duc_laxiwa: 0,
  duc_ai: 0,
  duc_called: 0,
  youxuepai_rollwood: 0,
  youxuepai_selfmail: 0,
  youxuepai_restore: 0,
  youxuepai_key: 0,
  youxuepai_endless: 0,
  dian_stele: 0,
  dian_250: 0,
  dian_debt: 0,
  dian_should: 0,
  dian_five_jiao: 0,
  orca_avatar: 0,
  orca_never_freeload: 0,
  orca_forget: 0,
  orca_one_line: 0,
  orca_chat_only: 0,
  orca_lesson: 0,
  letter_meet: 0,
  letter_fly: 0,
  letter_return: 0,
  letter_blank: 0,
  letter_riddle: 0,
  letter_enough: 0,
  human_some_proof: 0,
  human_responsibility: 0,
  human_entrusted: 0,
  human_another_person: 0,
  human_not_look_back: 0,
  human_slightly: 0,
  beauty_read_all: 0,
  beauty_fifth: 0,
  beauty_three_words: 0,
  beauty_thirtythree: 0,
  beauty_brackets: 0,
  beauty_not_write: 0,
  zilan_recite: 0,
  zilan_promise: 0,
  zilan_fog: 0,
  zilan_footprints: 0,
  zilan_oldfan: 0,
  zilan_biography: 0,
  birch_five_watts: 0,
  birch_ordinary: 0,
  birch_cat_vote: 0,
  birch_no_tally: 0,
  birch_winner_absent: 0,
  birch_gap: 0,
  democracy_blueprints: 0,
  democracy_blank_card: 0,
  democracy_unique_name: 0,
  democracy_actually_not: 0,
  democracy_count_votes: 0,
  democracy_fourth_hour: 0,
  cityin_fall: 0,
  cityin_dead_door: 0,
  cityin_archaeology: 0,
  cityin_time_capsule: 0,
  cityin_dont_call_him: 0,
  cityin_thirteenth: 0,
  fukushima_cant_help: 0,
  fukushima_eyestrain: 0,
  fukushima_two_doors: 0,
  fukushima_four_am: 0,
  fukushima_archaeologist: 0,
  fukushima_check_report: 0,
  wandering_first_star: 0,
  wandering_seven_colors: 0,
  wandering_archive: 0,
  wandering_honest_answer: 0,
  wandering_measure: 0,
  wandering_next_year: 0,
  tour_same_hand: 0,
  tour_unsolved: 0,
  tour_echo: 0,
  tour_mirror: 0,
  tour_masterworks: 0,
  tour_revisit: 0,
  youth_half_bridge: 0,
  youth_seven_names: 0,
  youth_flag: 0,
  youth_years: 0,
  youth_rewrite_keep: 0,
  youth_flipped: 0,
  liberation_old_words: 0,
  liberation_wall_higher: 0,
  liberation_craftsman: 0,
  liberation_bird: 0,
  liberation_returned: 0,
  weekly_new_subscriber: 0,
  weekly_flood_guard: 0,
  weekly_echo: 0,
  weekly_ordinary_week: 0,
  weekly_summer_letter: 0,
  weekly_fire_again: 0,
  huigui_first_word: 0,
  huigui_tea_reading: 0,
  huigui_first_coat: 0,
  huigui_night_tea: 0,
  huigui_newsboy: 0,
  huigui_shrine_tea: 0,
  reverberate_fold: 0,
  reverberate_light: 0,
  reverberate_reply: 0,
  reverberate_prayer: 0,
  reverberate_return: 0,
  reverberate_photo: 0,
  askway_two_answers: 0,
  askway_blue_name: 0,
  askway_seven_seconds: 0,
  askway_names_walk: 0,
  askway_never_gonna: 0,
  askway_archaeology: 0,
  murder_wanderer: 0,
  murder_watcher: 0,
  murder_chain: 0,
  murder_flirt: 0,
  murder_contact: 0,
});

export type ShopProductEntry = { itemId: string; name: string; unitPrice: number };

// The live shop catalog is defined after REPEATABLE_REWARDS below; see
// applyShopCatalog / initShopCatalog for how the admin-configured catalog
// (world_config "shop" row) is mirrored into these bindings.

export type MarketIngredient = { itemId: string; quantity: number };
export type MarketRecipe = {
  id: string;
  name: string;
  description: string;
  ingredients: readonly MarketIngredient[];
  output: MarketIngredient;
};
export type DailySupplyOrder = {
  id: string;
  title: string;
  description: string;
  requirements: readonly MarketIngredient[];
  reward: number;
};

/**
 * Ingredients are intentionally also the existing story items. Residents can
 * decide whether to keep them for a scene, turn them into a crafted good, or
 * sell them to another resident; nothing is silently consumed by the market.
 */
export const MARKET_RECIPES: readonly MarketRecipe[] = Object.freeze([
  {
    id: 'shared_meal', name: '热炖牛肉', description: '牛肉和萝卜慢炖成一份热食，可交付给社区厨房或挂到交易所。',
    ingredients: Object.freeze([{ itemId: 'beef', quantity: 1 }, { itemId: 'radish', quantity: 2 }]),
    output: Object.freeze({ itemId: 'shared_meal', quantity: 1 }),
  },
  {
    id: 'tea_service', name: '龙井茶席', description: '两份龙井配成一席清茶，适合图书馆和邻里会面。',
    ingredients: Object.freeze([{ itemId: 'dragonwell_tea', quantity: 2 }]),
    output: Object.freeze({ itemId: 'tea_service', quantity: 1 }),
  },
  {
    id: 'memory_parcel', name: '夜谈礼盒', description: '用茶和音乐盒打包的礼物；需要时也可以继续保留音乐盒走剧情。',
    ingredients: Object.freeze([{ itemId: 'dragonwell_tea', quantity: 1 }, { itemId: 'music_box', quantity: 1 }]),
    output: Object.freeze({ itemId: 'memory_parcel', quantity: 1 }),
  },
]);

export const DAILY_SUPPLY_ORDERS: readonly DailySupplyOrder[] = Object.freeze([
  { id: 'kitchen_shared_meal', title: '社区厨房的热食', description: '厨房正在等一份热炖牛肉，交付后把晚餐送给巡逻居民。', requirements: Object.freeze([{ itemId: 'shared_meal', quantity: 1 }]), reward: 145 },
  { id: 'library_tea_service', title: '图书馆茶席', description: '为下午读书会准备一席龙井茶。', requirements: Object.freeze([{ itemId: 'tea_service', quantity: 1 }]), reward: 110 },
  { id: 'music_memory_parcel', title: '音乐厅夜谈', description: '音乐厅需要一份夜谈礼盒，给今天留下可交换的纪念。', requirements: Object.freeze([{ itemId: 'memory_parcel', quantity: 1 }]), reward: 210 },
  { id: 'grocery_radish', title: '菜市补货', description: '向公共食堂送去 3 份新鲜萝卜。', requirements: Object.freeze([{ itemId: 'radish', quantity: 3 }]), reward: 85 },
  { id: 'restaurant_beef', title: '餐馆备料', description: '为野生菌餐馆送去 2 份牛肉。', requirements: Object.freeze([{ itemId: 'beef', quantity: 2 }]), reward: 125 },
]);

/** Crafted goods stay tradeable even when the shop does not sell them. */
export const RECIPE_OUTPUT_ITEM_IDS: ReadonlySet<string> = new Set(MARKET_RECIPES.map((recipe) => recipe.output.itemId));
export const MARKET_FOOD_ITEM_IDS: ReadonlySet<string> = new Set(['beef', 'radish']);
export const MAX_MARKET_LISTING_QUANTITY = 20;
export const MAX_MARKET_LISTING_PRICE = 9_999;
export const MAX_ACTIVE_MARKET_LISTINGS = 6;

/** Tradeable goods = whatever the shop currently sells plus crafted outputs. */
export function isMarketTradeableItemId(itemId: string): boolean {
  // Object.hasOwn keeps inherited Object.prototype keys ('toString',
  // 'constructor', 'valueOf') out of the tradeable set.
  return RECIPE_OUTPUT_ITEM_IDS.has(itemId) || Object.hasOwn(SHOP_PRODUCTS, itemId);
}

export function getMarketTradeableItemIds(): string[] {
  return [...new Set([...RECIPE_OUTPUT_ITEM_IDS, ...Object.values(SHOP_PRODUCTS).map((product) => product.itemId)])];
}

export const DAILY_MISSIONS = Object.freeze([
  { id: 'market_walk_3', title: '街巷漫游', description: '今天探访 3 座不同的开放建筑', target: 3, reward: 35 },
  { id: 'market_walk_6', title: '城市寻宝', description: '今天探访 6 座不同的开放建筑', target: 6, reward: 90 },
]);

export const DAILY_CHECK_IN = Object.freeze({ baseReward: 40, streakBonus: 10, maxStreakBonus: 60 });
export const DAILY_DEAL_DISCOUNT_PERCENT = 25;

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

/**
 * The live shop catalog. Admin-configurable through the console (world_config
 * "shop" row). Starts as the shipped defaults; `initShopCatalog` mirrors the
 * persisted catalog during boot and admin updates re-run `applyShopCatalog`.
 * Consumers must reference the binding itself (`SHOP_PRODUCTS.x`) instead of
 * destructuring so they always see the current catalog.
 */
export let SHOP_PRODUCTS: Readonly<Record<string, ShopProductEntry>> = Object.freeze(
  Object.fromEntries(DEFAULT_SHOP_CATALOG.filter((product) => product.enabled).map((product) => [product.itemId, { itemId: product.itemId, name: product.name, unitPrice: product.unitPrice }])),
);
export let CONSUMABLE_ITEM_IDS: ReadonlySet<string> = new Set([
  ...Object.values(SHOP_PRODUCTS).map((product) => product.itemId),
  REPEATABLE_REWARDS.ice_accept.itemId,
]);

function buildShopCatalog(products: readonly ShopProduct[]): { catalog: Readonly<Record<string, ShopProductEntry>>; consumable: ReadonlySet<string> } {
  const active: Record<string, ShopProductEntry> = {};
  for (const product of products) {
    if (!product.enabled) continue;
    active[product.itemId] = { itemId: product.itemId, name: product.name, unitPrice: product.unitPrice };
  }
  return {
    catalog: Object.freeze(active),
    // Consumables are decoupled from availability: story branches hand out
    // and consume known items (tea/beef/radish/music_box), so a delisted
    // product must stay consumable for residents who already own it.
    consumable: new Set([
      ...DEFAULT_SHOP_CATALOG.map((product) => product.itemId),
      ...Object.values(active).map((entry) => entry.itemId),
      REPEATABLE_REWARDS.ice_accept.itemId,
    ]),
  };
}

/** Swap in an admin-configured catalog and refresh the live bindings. */
export function applyShopCatalog(products: readonly ShopProduct[]): void {
  const { catalog, consumable } = buildShopCatalog(products);
  SHOP_PRODUCTS = catalog;
  CONSUMABLE_ITEM_IDS = consumable;
}

/**
 * Load the persisted shop catalog from world_config. Called from the server
 * boot sequence — not at module load — because module-load order can reach
 * this file before `db` finishes evaluating (adminRouter import chain).
 */
export function initShopCatalog(): void {
  applyShopCatalog(getShopProducts());
}

export function getDailySupplyOrder(dayKey = shanghaiDayKey()): DailySupplyOrder {
  const dayNumber = Math.floor(Date.parse(`${dayKey}T00:00:00.000Z`) / 86_400_000);
  return DAILY_SUPPLY_ORDERS[((dayNumber % DAILY_SUPPLY_ORDERS.length) + DAILY_SUPPLY_ORDERS.length) % DAILY_SUPPLY_ORDERS.length]!;
}

export type ProgressionCatalog = {
  initialCurrency: number;
  buildingPrices: Record<string, number>;
  buildingUnlockable: Record<string, boolean>;
  globallyUnlockedBuildings: string[];
  achievementRewards: Record<string, number>;
  products: Record<string, { itemId: string; name: string; unitPrice: number; category: 'food' | 'story' }>;
  dailyCheckIn: typeof DAILY_CHECK_IN;
  dailyMissions: typeof DAILY_MISSIONS;
  recipes: readonly MarketRecipe[];
  dailySupplyOrder: DailySupplyOrder & { dayKey: string };
  tradeableItemIds: string[];
  market: { maxListingQuantity: number; maxListingPrice: number; maxActiveListings: number };
  store: { dayKey: string; featuredProductId: string; discountPercent: number };
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
    .filter((building) => Object.hasOwn(BUILDING_PRICES, building.id))
    .map((building) => {
      const override = overrides[building.id] ?? null;
      const defaultState: ResolvedBuildingState = STORY_LOCKED_BUILDING_IDS.has(building.id) || BUILDING_UNLOCKABLE[building.id] !== true ? 'locked' : 'unlockable';
      const state: ResolvedBuildingState = !isCityBuildingBuilt(building.id) || override === 'locked' ? 'locked'
        : override === 'open' || (isCityProjectBuilt(building.id) && defaultState !== 'locked') ? 'open'
        : defaultState;
      return { id: building.id, label: building.label, num: building.num, x: building.x, z: building.z, storyLocked: building.storyLocked, override, state, defaultState };
    });
}

export function isBuildingGloballyUnlocked(buildingId: string): boolean {
  return isBuildingUnlockable(buildingId) && (getBuildingOverrides()[buildingId] === 'open' || isCityProjectBuilt(buildingId));
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
  const dayKey = shanghaiDayKey();
  const dayNumber = Math.floor(Date.parse(`${dayKey}T00:00:00.000Z`) / 86_400_000);
  const productIds = Object.keys(SHOP_PRODUCTS);
  const dailySupplyOrder = getDailySupplyOrder(dayKey);
  return {
    initialCurrency: INITIAL_CURRENCY,
    buildingPrices: { ...BUILDING_PRICES },
    buildingUnlockable,
    globallyUnlockedBuildings,
    achievementRewards: { ...ACHIEVEMENT_REWARDS },
    products: Object.fromEntries(Object.values(SHOP_PRODUCTS).map((product) => [
      product.itemId,
      { ...product, category: MARKET_FOOD_ITEM_IDS.has(product.itemId) ? 'food' as const : 'story' as const },
    ])),
    dailyCheckIn: DAILY_CHECK_IN,
    dailyMissions: DAILY_MISSIONS,
    recipes: MARKET_RECIPES,
    dailySupplyOrder: { ...dailySupplyOrder, dayKey },
    tradeableItemIds: getMarketTradeableItemIds(),
    market: {
      maxListingQuantity: MAX_MARKET_LISTING_QUANTITY,
      maxListingPrice: MAX_MARKET_LISTING_PRICE,
      maxActiveListings: MAX_ACTIVE_MARKET_LISTINGS,
    },
    store: {
      dayKey,
      featuredProductId: productIds.length ? productIds[((dayNumber % productIds.length) + productIds.length) % productIds.length]! : '',
      discountPercent: DAILY_DEAL_DISCOUNT_PERCENT,
    },
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
