import assert from 'node:assert/strict';
import test from 'node:test';
import { createCloudProgressionController } from '../../src/adapters/ui/cloudProgressionController';
import { EMPTY_PROGRESSION_CATALOG, EMPTY_PLAYER_PROGRESS } from '../../src/gameplay/progression/playerProgress';

test('repeatable rewards retry the same sequence after a lost acknowledgement', async () => {
  const values = new Map<string, string>([['minicityUser', 'reward-tester']]);
  const localStorage = {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => { values.set(key, value); },
    removeItem: (key: string) => { values.delete(key); },
  } as Storage;
  const document = {
    defaultView: { localStorage },
    getElementById: () => null,
    querySelector: () => null,
  } as unknown as Document;
  const commands: Array<{ type: string; rewardId?: string; claimSequence?: number }> = [];
  const controller = createCloudProgressionController({
    document,
    signal: new AbortController().signal,
    showToast: () => undefined,
    send: (command) => { commands.push(command); return true; },
    openPhoneView: () => undefined,
  });
  controller.setConnection(true);
  controller.applySnapshot(EMPTY_PLAYER_PROGRESS, EMPTY_PROGRESSION_CATALOG);

  const firstClaim = controller.claimReward('ice_accept');
  assert.equal(commands.at(-1)?.claimSequence, 1);
  controller.applySnapshot(
    { ...EMPTY_PLAYER_PROGRESS, repeatableRewardClaims: { ice_accept: 1 }, inventory: { ice_lemonade: 1 } },
    EMPTY_PROGRESSION_CATALOG,
    { type: 'reward.claimed', rewardId: 'ice_accept', claimSequence: 1, claimed: true, accepted: true },
  );
  assert.equal(await firstClaim, true);

  const lostClaim = controller.claimReward('ice_accept');
  assert.equal(commands.at(-1)?.claimSequence, 2);
  controller.setConnection(false);
  assert.equal(await lostClaim, false);

  controller.setConnection(true);
  controller.applySnapshot(
    { ...EMPTY_PLAYER_PROGRESS, repeatableRewardClaims: { ice_accept: 2 }, inventory: { ice_lemonade: 2 } },
    EMPTY_PROGRESSION_CATALOG,
  );
  const retriedClaim = controller.claimReward('ice_accept');
  assert.equal(commands.at(-1)?.claimSequence, 2);
  controller.applySnapshot(
    { ...EMPTY_PLAYER_PROGRESS, repeatableRewardClaims: { ice_accept: 2 }, inventory: { ice_lemonade: 2 } },
    EMPTY_PROGRESSION_CATALOG,
    { type: 'reward.claimed', rewardId: 'ice_accept', claimSequence: 2, claimed: false, accepted: true },
  );
  assert.equal(await retriedClaim, true);
  assert.equal([...values.keys()].some((key) => key.startsWith('minicityPendingReward:')), false);
});

test('a world.catalog push globally unlocks a building without touching saved progress', () => {
  const values = new Map<string, string>([['minicityUser', 'world-tester']]);
  const localStorage = {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => { values.set(key, value); },
    removeItem: (key: string) => { values.delete(key); },
  } as Storage;
  const document = {
    defaultView: { localStorage },
    getElementById: () => null,
    querySelector: () => null,
  } as unknown as Document;
  const commands: Array<{ type: string; buildingId?: string }> = [];
  const controller = createCloudProgressionController({
    document,
    signal: new AbortController().signal,
    showToast: () => undefined,
    send: (command) => { commands.push(command); return true; },
    openPhoneView: () => undefined,
  });
  controller.setConnection(true);
  const baseCatalog = {
    ...EMPTY_PROGRESSION_CATALOG,
    buildingPrices: { litreview: 0 },
    buildingUnlockable: { litreview: true },
  };
  controller.applySnapshot({ ...EMPTY_PLAYER_PROGRESS, unlockedBuildings: [] }, baseCatalog);

  assert.equal(controller.interactBuilding('litreview', () => undefined), true);
  assert.deepEqual(commands.at(-1), { type: 'progress.building.unlock', buildingId: 'litreview' });
  controller.applySnapshot(
    { ...EMPTY_PLAYER_PROGRESS, unlockedBuildings: [] },
    baseCatalog,
    { type: 'building.unlocked', buildingId: 'litreview', purchased: true },
  );
  controller.applySnapshot(
    { ...EMPTY_PLAYER_PROGRESS, unlockedBuildings: [] },
    baseCatalog,
    { type: 'building.visited', buildingId: 'litreview' },
  );

  controller.applyCatalog({ ...baseCatalog, globallyUnlockedBuildings: ['litreview'] });
  assert.equal(controller.interactBuilding('litreview', () => undefined), true);
  assert.deepEqual(commands.at(-1), { type: 'progress.building.visit', buildingId: 'litreview' });
  assert.deepEqual(controller.getProgress().unlockedBuildings, []);
});

test('stat achievements unlock from cloud progress without re-sending completed ones', () => {
  const values = new Map<string, string>([['minicityUser', 'achievement-tester']]);
  const localStorage = {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => { values.set(key, value); },
    removeItem: (key: string) => { values.delete(key); },
  } as Storage;
  const document = {
    defaultView: { localStorage },
    getElementById: () => null,
    querySelector: () => null,
  } as unknown as Document;
  const commands: Array<{ type: string; achievementId?: string }> = [];
  const controller = createCloudProgressionController({
    document,
    signal: new AbortController().signal,
    showToast: () => undefined,
    send: (command) => { commands.push(command); return true; },
    openPhoneView: () => undefined,
  });
  const catalog = {
    ...EMPTY_PROGRESSION_CATALOG,
    achievementRewards: { citizen: 20, first_building: 20, explorer_5: 35, explorer_10: 60, unlock_3: 40 },
  };
  controller.setConnection(true);
  controller.applySnapshot(EMPTY_PLAYER_PROGRESS, catalog);
  assert.deepEqual(commands, [{ type: 'progress.achievement.unlock', achievementId: 'citizen' }]);

  commands.length = 0;
  controller.applySnapshot(
    { ...EMPTY_PLAYER_PROGRESS, visitedBuildings: ['a', 'b', 'c', 'd', 'e'], unlockedBuildings: ['x', 'y', 'z'] },
    catalog,
  );
  const ids = commands.filter((command) => command.type === 'progress.achievement.unlock').map((command) => command.achievementId);
  assert.deepEqual(new Set(ids), new Set(['first_building', 'explorer_5', 'unlock_3']));

  commands.length = 0;
  controller.applySnapshot(
    {
      ...EMPTY_PLAYER_PROGRESS,
      visitedBuildings: ['a', 'b', 'c', 'd', 'e'],
      unlockedBuildings: ['x', 'y', 'z'],
      achievements: ['citizen', 'first_building', 'explorer_5', 'unlock_3'],
    },
    catalog,
  );
  assert.deepEqual(commands.filter((command) => command.type === 'progress.achievement.unlock'), []);
});
