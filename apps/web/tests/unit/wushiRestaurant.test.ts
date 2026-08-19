import assert from 'node:assert/strict';
import test from 'node:test';
import { BUILDING_CONTENT, BUILDING_DEFS } from '../../src/city/data/buildings';
import { NPC_PROFILES } from '../../src/city/data/npcs';
import { isNpcHiddenAtHour } from '../../src/city/npcSystem';
import { createBuildingInteraction } from '../../src/city/buildingInteraction';
import { createWildMushroomRestaurant } from '../../src/city/wildMushroomRestaurant';
import type { BuildingEntity } from '../../src/city/buildingEntity';
import type { CityDialogController } from '../../src/adapters/ui/cityDialogController';

const stubDialogs = (onOpen: () => void): CityDialogController =>
  ({ openBuilding: () => { onOpen(); }, closeBuilding: () => {} } as unknown as CityDialogController);
const stubBuilding = (id: string): BuildingEntity =>
  ({ id } as unknown as BuildingEntity);

test('Wushi restaurant is a fixed unique building with a complete dialogue tree', () => {
  const restaurant = BUILDING_DEFS.find((building) => building.id === 'wushi_restaurant');
  assert.ok(restaurant);
  assert.equal(restaurant.shape, 'restaurant');
  const wildMushroomRestaurant = BUILDING_DEFS.find((building) => building.id === 'writingclub_outer');
  assert.ok(wildMushroomRestaurant);
  assert.equal(wildMushroomRestaurant.shape, 'wild_mushroom_restaurant');
  assert.notEqual(wildMushroomRestaurant.shape, restaurant.shape);
  assert.equal(BUILDING_DEFS.filter((building) => building.x === restaurant.x && building.z === restaurant.z).length, 1);

  const southwestPond = { x: -24, z: -24, radius: 3 };
  const distanceToPond = Math.hypot(restaurant.x - southwestPond.x, restaurant.z - southwestPond.z);
  assert.ok(distanceToPond > southwestPond.radius + 3, 'restaurant footprint stays clear of the southwest pond');

  const tree = BUILDING_CONTENT.wushi_restaurant!.dialogTree!;
  assert.equal(tree.length, 17);
  tree.forEach((node, nodeIndex) => node.options.forEach((option) => {
    assert.ok(option.next === null || (option.next >= 0 && option.next < tree.length), `node ${nodeIndex} has a valid destination`);
  }));
  assert.match(tree[15]?.text ?? '', /冰冻罗非鱼/);
  assert.match(tree[16]?.text ?? '', /9072000/);
});

test('shrine dialogue includes the username-gated sword challenge', () => {
  const tree = BUILDING_CONTENT.shrine!.dialogTree!;
  assert.equal(tree.length, 5);
  assert.equal(tree[0]?.options.length, 2);
  assert.equal(tree[1]?.options.length, 2);
  const challenge = tree[2]?.options[0];
  assert.deepEqual(challenge?.nextByVisitor, { includes: ['有地', '将臣'], maxLength: 5, next: 4 });
  assert.match(tree[3]?.text ?? '', /纹丝不动/);
  assert.match(tree[4]?.text ?? '', /拔出来了/);
  assert.equal(tree[4]?.options[0]?.action, 'open-url:https://store.steampowered.com/app/1144400/_?l=schinese');
});

test('wild mushroom restaurant uses the standard unlock flow', () => {
  let interacted = false;
  let modalOpened = false;
  let trackCount = 0;
  const interaction = createBuildingInteraction({
    isBuildingUnavailable: () => false,
    getMultiplayerHousing: () => ({ progression: {
      interactBuilding: (_id: string, onUnlock: () => void) => { onUnlock(); },
      openShop: () => {},
    } }),
    getCityDialogs: () => stubDialogs(() => { modalOpened = true; }),
    getEchoStoryController: () => null,
    getStatsPanelController: () => null,
    getCommunityPanels: () => null,
    getWriterCatalogController: () => null,
    getNewsstandController: () => null,
    trackInteraction: () => { trackCount += 1; },
    getWildMushroomRestaurant: () => ({ interact: () => { interacted = true; return 'opened'; } }),
  });

  interaction.navigateTo(stubBuilding('writingclub_outer'));
  assert.equal(interacted, true);
  assert.equal(modalOpened, false);
  assert.equal(trackCount, 1);
});

test('wild mushroom restaurant falls back to the building modal once exhausted', () => {
  let modalOpened = false;
  let trackCount = 0;
  const interaction = createBuildingInteraction({
    isBuildingUnavailable: () => false,
    getMultiplayerHousing: () => ({ progression: {
      interactBuilding: (_id: string, onUnlock: () => void) => { onUnlock(); },
      openShop: () => {},
    } }),
    getCityDialogs: () => stubDialogs(() => { modalOpened = true; }),
    getEchoStoryController: () => null,
    getStatsPanelController: () => null,
    getCommunityPanels: () => null,
    getWriterCatalogController: () => null,
    getNewsstandController: () => null,
    trackInteraction: () => { trackCount += 1; },
    getWildMushroomRestaurant: () => ({ interact: () => 'exhausted' }),
  });

  interaction.navigateTo(stubBuilding('writingclub_outer'));
  assert.equal(modalOpened, true);
  assert.equal(trackCount, 1);
});

test('wild mushroom restaurant falls back to the building modal when dialogs are unavailable', () => {
  let modalOpened = false;
  let trackCount = 0;
  const interaction = createBuildingInteraction({
    isBuildingUnavailable: () => false,
    getMultiplayerHousing: () => ({ progression: {
      interactBuilding: (_id: string, onUnlock: () => void) => { onUnlock(); },
      openShop: () => {},
    } }),
    getCityDialogs: () => stubDialogs(() => { modalOpened = true; }),
    getEchoStoryController: () => null,
    getStatsPanelController: () => null,
    getCommunityPanels: () => null,
    getWriterCatalogController: () => null,
    getNewsstandController: () => null,
    trackInteraction: () => { trackCount += 1; },
    getWildMushroomRestaurant: () => ({ interact: () => 'no-dialog' }),
  });

  interaction.navigateTo(stubBuilding('writingclub_outer'));
  assert.equal(modalOpened, true);
  assert.equal(trackCount, 1);
});

test('wild mushroom restaurant story stops after three visits', () => {
  let openedStories = 0;
  const values = new Map<string, string>();
  const restaurant = createWildMushroomRestaurant({
    getDialogs: () => ({
      openStory: () => { openedStories += 1; },
      closeNpc: () => {},
    }),
    burnCity: (onDone) => { onDone?.(); return true; },
    awardAchievement: () => {},
    getStorage: () => ({
      getItem: (key) => values.get(key) ?? null,
      setItem: (key, value) => { values.set(key, value); },
    }),
  });

  assert.equal(restaurant.interact(), 'opened');
  assert.equal(restaurant.interact(), 'opened');
  assert.equal(restaurant.interact(), 'opened');
  assert.equal(restaurant.interact(), 'exhausted');
  assert.equal(values.get('minicityWildMushroomVisits'), '3');
  assert.ok(openedStories > 0);
});

test('Shinian Mengyanyu follows the noon pause and exposes both teleports', () => {
  const profile = NPC_PROFILES.find((npc) => npc.id === 'shinian_mengyanyu');
  assert.ok(profile);
  assert.equal(profile.spawnChance, 1);
  assert.equal(isNpcHiddenAtHour(profile, 11.99), false);
  assert.equal(isNpcHiddenAtHour(profile, 12), true);
  assert.equal(isNpcHiddenAtHour(profile, 13.99), true);
  assert.equal(isNpcHiddenAtHour(profile, 14), false);
  const actions = profile.dialog.flatMap((node) => node.options.map((option) => 'action' in option ? option.action : undefined));
  assert.ok(actions.includes('teleport:wushi_restaurant'));
  assert.ok(actions.includes('teleport:archive'));
});
