export const SCENE_INTEREST_POINT_IDS = ['cat-cafe-note', 'origin-orange-tree', 'longjing-well', 'west-beach', 'echo-stone-pile', 'echo-table', 'echo-cabin', 'echo-diary', 'echo-photo-wall', 'echo-cabin-door'] as const;

export type SceneInterestPointId = (typeof SCENE_INTEREST_POINT_IDS)[number];

export const WORLD_ITEM_IDS = {
  orange: 'mandarin',
  longjingTea: 'dragonwell_tea',
  tirpitz: 'tirpitz_card',
} as const;

export type WorldItemId = (typeof WORLD_ITEM_IDS)[keyof typeof WORLD_ITEM_IDS];

export const WORLD_ACHIEVEMENTS = {
  catCafeNote: { id: 'cat_cafe_note', name: '猫咖拾遗' },
  cityOrigin: { id: 'minicity_origin', name: '物实城缘起' },
  longjingAssimilation: { id: 'dragonwell_assimilation', name: '被龙井同化' },
  westBeachEncounter: { id: 'west_beach_encounter', name: '海神的考验' },
} as const;

export const ORANGE_TREE_COPY = '城中的守望者，它或许不是最高的，但它见证了最多的风雨';

export const WELL_STORY = {
  intro: '你看见了一个爬满绿色植物的石井。',
  transformed: '你献上了龙井茶，你仿佛看到了绿色植物变得兴奋起来，它们似乎正在蠕动。你看到绿色自你的指尖蔓延，爬上你的肩，慢慢笼罩你的眼。渐渐地你再也分辨不出其他的颜色。',
  awake: '你醒了过来，发现石井干净如新，仿佛你刚才所见到的都只是一场梦。',
} as const;

export interface InventoryPort {
  isOnline(): boolean;
  hasItem(itemId: WorldItemId, count?: number): boolean | Promise<boolean>;
  consumeItem(itemId: WorldItemId, count: number): boolean | Promise<boolean>;
  /** Resolves true only after the authoritative server confirms a new claim. */
  claimReward(rewardId: 'mandarin_daily' | 'tirpitz_beach'): boolean | Promise<boolean>;
  hasAchievement(achievementId: string): boolean;
}

export interface DailyOrangeOutcome {
  claimDay: string;
  granted: boolean;
  message: string;
}

/** A stable civil-day key for the town's UTC+8 clock. */
export function beijingDayKey(timestamp: number): string {
  if (!Number.isFinite(timestamp)) throw new Error('timestamp must be finite');
  return new Date(timestamp + 8 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

export function evaluateDailyOrange(lastClaimDay: string | null, timestamp: number): DailyOrangeOutcome {
  const claimDay = beijingDayKey(timestamp);
  const granted = lastClaimDay !== claimDay;
  return {
    claimDay,
    granted,
    message: granted ? '获得沃柑 ×1' : '今天已经领取过沃柑了。',
  };
}

export type WellStoryStep = 'intro' | 'transformed' | 'awake';

export interface WellStoryNode {
  text: string;
  option: '#使用龙井茶' | '#我...这是怎么了？' | null;
  tone: 'green';
}

export function getWellStoryNode(step: WellStoryStep, hasLongjingTea: boolean): WellStoryNode {
  if (step === 'intro') {
    return {
      text: WELL_STORY.intro,
      option: hasLongjingTea ? '#使用龙井茶' : null,
      tone: 'green',
    };
  }
  if (step === 'transformed') {
    return { text: WELL_STORY.transformed, option: '#我...这是怎么了？', tone: 'green' };
  }
  return { text: WELL_STORY.awake, option: null, tone: 'green' };
}
