import assert from 'node:assert/strict';
import test from 'node:test';
import type { StoryDialogModel } from '../../src/adapters/ui/cityDialogController';
import { getNpcType } from '../../src/city/data/npcTypes';
import { createSceneInterestPointController } from '../../src/city/sceneInterestPointController';
import { NPC_PROFILES } from '../../src/city/data/npcs';
import { residenceStyleFor } from '../../src/rendering/residenceStyles';
import { BUILDING_CONTENT, BUILDING_DEFS } from '../../src/city/data/buildings';
import { MUSIC_HALL_LYRICS } from '../../src/city/data/musicHallLyrics';
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
    claimReward: async (rewardId) => { claims.push(rewardId); return true; },
    hasAchievement: () => false,
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
      claimReward: () => false,
      hasAchievement: () => false,
    },
    awardAchievement: (id) => { awards.push(id); },
    showToast: () => undefined,
  });
  await controller.interact('cat-cafe-note');
  assert.equal(activeStory?.text, '');
  assert.deepEqual(awards, [WORLD_ACHIEVEMENTS.catCafeNote.id]);
});

test('亦航 keeps the requested schedule, park spawn, and dialogue branches', () => {
  const yihang = NPC_PROFILES.find((profile) => profile.id === 'yihang') as any;
  assert.ok(yihang);
  assert.deepEqual(yihang.workHours, [10, 22]);
  assert.deepEqual(yihang.spawnArea, [15, 30, 2.4]);
  assert.equal(yihang.spawnChance, 1);
  assert.equal(yihang.guaranteedSpawn, true);
  assert.equal(yihang.dialog[0].options.length, 3);
  assert.match(yihang.dialog[2].text, /棍母/);
});

test('residence styles cover twelve models while neighboring lots share a family', () => {
  const styles = new Set<number>();
  for (let x = -39; x <= 39; x += 3) {
    for (let z = -39; z <= 39; z += 3) styles.add(residenceStyleFor(x, z, Math.abs(x * 31 + z)));
  }
  assert.deepEqual([...styles].sort((a, b) => a - b), [0,1,2,3,4,5,6,7,8,9,10,11]);
  const family = Math.floor(residenceStyleFor(-30, -30, 0) / 2);
  assert.equal(Math.floor(residenceStyleFor(-27, -27, 8) / 2), family);
});

test('建筑更新保留音乐厅歌词和两家商店名称', () => {
  assert.equal(MUSIC_HALL_LYRICS.title, '改版《孤勇者》');
  assert.ok(MUSIC_HALL_LYRICS.lines.some((line) => line.text === '都，是被害者'));
  assert.ok(MUSIC_HALL_LYRICS.lines.some((line) => line.text === '我们目的是祖国以我为荣！'));
  assert.equal(BUILDING_DEFS.find((building) => building.id === 'mall_south')?.label, '金月店');
  assert.equal(BUILDING_DEFS.find((building) => building.id === 'mall_west')?.label, '断星玄');
  assert.equal(BUILDING_CONTENT.mall_south.name, '金月店');
  assert.equal(BUILDING_CONTENT.mall_west.name, '断星玄');
});

test('west beach encounter grants Tirpitz once and awards the achievement', async () => {
  let activeStory: StoryDialogModel | undefined;
  const claims: string[] = [];
  const awards: string[] = [];
  const phases: string[] = [];
  const controller = createSceneInterestPointController({
    dialogs: { openStory: (story) => { activeStory = story; } },
    inventory: {
      isOnline: () => true,
      hasItem: () => false,
      consumeItem: () => false,
      claimReward: async (rewardId) => { claims.push(rewardId); return true; },
      hasAchievement: () => false,
    },
    awardAchievement: (id) => { awards.push(id); },
    showToast: () => undefined,
    setBeachEncounterPhase: (phase) => { phases.push(phase); },
  });
  await controller.interact('west-beach');
  for (let step = 0; step < 5; step += 1) await activeStory?.options?.[0]?.onPick();
  assert.deepEqual(claims, ['tirpitz_beach']);
  assert.deepEqual(awards, [WORLD_ACHIEVEMENTS.westBeachEncounter.id]);
  assert.ok(phases.includes('revealed') && phases.includes('reward'));
  assert.equal(activeStory?.role, '皮尔皮茨号 ×1');
});
