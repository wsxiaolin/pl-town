import assert from 'node:assert/strict';
import test from 'node:test';
import type { StoryDialogModel } from '../../src/adapters/ui/cityDialogController';
import { getNpcType } from '../../src/city/data/npcTypes';
import { createSceneInterestPointController } from '../../src/city/sceneInterestPointController';
import {
  beijingDayKey,
  evaluateDailyOrange,
  getWellStoryNode,
  ORANGE_TREE_COPY,
  WELL_STORY,
  WORLD_ACHIEVEMENTS,
  WORLD_ITEM_IDS,
  type InventoryPort,
} from '../../src/gameplay/world/sceneInteractions';

test('daily orange rule uses the town UTC+8 civil day', () => {
  const beforeMidnight = Date.UTC(2026, 7, 10, 15, 59, 59);
  const afterMidnight = Date.UTC(2026, 7, 10, 16, 0, 0);
  assert.equal(beijingDayKey(beforeMidnight), '2026-08-10');
  assert.equal(beijingDayKey(afterMidnight), '2026-08-11');
  assert.equal(evaluateDailyOrange('2026-08-10', beforeMidnight).granted, false);
  assert.equal(evaluateDailyOrange('2026-08-10', afterMidnight).granted, true);
});

test('well story exposes only the intended choices', () => {
  assert.deepEqual(getWellStoryNode('intro', false), {
    text: WELL_STORY.intro,
    option: null,
    tone: 'green',
  });
  assert.equal(getWellStoryNode('intro', true).option, '#使用龙井茶');
  assert.equal(getWellStoryNode('transformed', true).option, '#我...这是怎么了？');
  assert.equal(getWellStoryNode('awake', true).option, null);
});

test('story NPC is a distinct profile type while residents remain the default', () => {
  assert.equal(getNpcType({ npcType: 'story' }), 'story');
  assert.equal(getNpcType({ type: 'story' }), 'story');
  assert.equal(getNpcType({}), 'resident');
});

test('scene controller claims server reward and completes the well story', async () => {
  let activeStory: StoryDialogModel | undefined;
  const awards: string[] = [];
  const consumed: string[] = [];
  const claims: string[] = [];
  const inventory: InventoryPort = {
    isOnline: () => true,
    hasItem: (itemId) => itemId === WORLD_ITEM_IDS.longjingTea,
    consumeItem: async (itemId) => { consumed.push(itemId); return true; },
    claimDailyReward: async (rewardId) => { claims.push(rewardId); return true; },
  };
  const controller = createSceneInterestPointController({
    dialogs: { openStory: (story) => { activeStory = story; } },
    inventory,
    awardAchievement: async (id) => { awards.push(id); },
    showToast: () => undefined,
  });

  await controller.interact('origin-orange-tree');
  assert.deepEqual(claims, ['mandarin_daily']);
  assert.equal(activeStory?.text, ORANGE_TREE_COPY);
  assert.ok(awards.includes(WORLD_ACHIEVEMENTS.cityOrigin.id));

  await controller.interact('longjing-well');
  assert.equal(activeStory?.text, WELL_STORY.intro);
  await activeStory?.options?.[0]?.onPick();
  assert.deepEqual(consumed, [WORLD_ITEM_IDS.longjingTea]);
  assert.equal(activeStory?.text, WELL_STORY.transformed);
  await activeStory?.options?.[0]?.onPick();
  assert.equal(activeStory?.text, WELL_STORY.awake);
  assert.ok(awards.includes(WORLD_ACHIEVEMENTS.longjingAssimilation.id));
});

test('cat cafe note deliberately opens with blank copy and awards discovery', async () => {
  let activeStory: StoryDialogModel | undefined;
  const awards: string[] = [];
  const controller = createSceneInterestPointController({
    dialogs: { openStory: (story) => { activeStory = story; } },
    inventory: {
      isOnline: () => false,
      hasItem: () => false,
      consumeItem: () => false,
      claimDailyReward: () => false,
    },
    awardAchievement: (id) => { awards.push(id); },
    showToast: () => undefined,
  });
  await controller.interact('cat-cafe-note');
  assert.equal(activeStory?.text, '');
  assert.deepEqual(awards, [WORLD_ACHIEVEMENTS.catCafeNote.id]);
});
