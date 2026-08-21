import assert from 'node:assert/strict';
import test from 'node:test';
import * as THREE from 'three';
import { BUILDING_CONTENT, BUILDING_DEFS } from '../../src/city/data/buildings';
import { NPC_PROFILES } from '../../src/city/data/npcs';
import { isNpcHiddenAtHour } from '../../src/city/npcSystem';
import { createBuildingInteraction } from '../../src/city/buildingInteraction';
import { createWildMushroomRestaurant } from '../../src/city/wildMushroomRestaurant';
import { buildWildMushroomRestaurant } from '../../src/rendering/wildMushroomRestaurant';
import type { BuildingDefinition, BuildingEntity } from '../../src/city/buildingEntity';
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
  assert.deepEqual([wildMushroomRestaurant.x, wildMushroomRestaurant.z], [-31.5, -15.125]);
  assert.ok(Math.hypot(wildMushroomRestaurant.x + 30, wildMushroomRestaurant.z - 30) > 20, 'restaurant stays clear of Bunala');
  assert.equal(BUILDING_DEFS.filter((building) => building.x === wildMushroomRestaurant.x && building.z === wildMushroomRestaurant.z).length, 1);
  const roadCoords = [-36, -27, -18, -12, -6, 0, 6, 12, 18, 27, 36];
  const roadHalfWidth = (position: number) => position === 0 ? 1.2 : (Math.abs(position) === 6 || Math.abs(position) === 12 ? 0.75 : 0.5);
  const restaurantHalfWidth = 3;
  const restaurantHalfDepth = 2.3;
  roadCoords.forEach((position) => {
    assert.ok(Math.abs(wildMushroomRestaurant.x - position) > restaurantHalfWidth + roadHalfWidth(position), `restaurant stays clear of x=${position} road`);
    assert.ok(Math.abs(wildMushroomRestaurant.z - position) > restaurantHalfDepth + roadHalfWidth(position), `restaurant stays clear of z=${position} road`);
  });
  BUILDING_DEFS.filter((building) => building.id !== wildMushroomRestaurant.id).forEach((building) => {
    const outsideRestaurantFootprint = Math.abs(building.x - wildMushroomRestaurant.x) > restaurantHalfWidth + 0.5
      || Math.abs(building.z - wildMushroomRestaurant.z) > restaurantHalfDepth + 0.5;
    assert.ok(outsideRestaurantFootprint, `restaurant stays clear of ${building.id}`);
  });
  const makeMaterial = () => new THREE.MeshStandardMaterial();
  const restaurantMesh = buildWildMushroomRestaurant({
    platformHeight: 0.3,
    makeMaterial,
    makeMesh: (geometry, material) => new THREE.Mesh(geometry, material),
    addPart: (group, geometry, material, position) => {
      const mesh = new THREE.Mesh(geometry, material instanceof THREE.Material ? material : makeMaterial());
      mesh.position.set(...position);
      group?.add(mesh);
      return mesh;
    },
  }, wildMushroomRestaurant as BuildingDefinition);
  const bounds = new THREE.Box3().setFromObject(restaurantMesh.group);
  roadCoords.forEach((position) => {
    const halfWidth = roadHalfWidth(position);
    assert.ok(bounds.max.x <= position - halfWidth || bounds.min.x >= position + halfWidth, `restaurant mesh stays clear of x=${position} road`);
    assert.ok(bounds.max.z <= position - halfWidth || bounds.min.z >= position + halfWidth, `restaurant mesh stays clear of z=${position} road`);
  });
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
  let completeInteraction: (() => void) | undefined;
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
    getWildMushroomRestaurant: () => ({ interact: (onComplete) => { interacted = true; completeInteraction = onComplete; return 'opened'; } }),
  });

  interaction.navigateTo(stubBuilding('writingclub_outer'));
  assert.equal(interacted, true);
  assert.equal(modalOpened, false);
  assert.equal(trackCount, 0);
  completeInteraction?.();
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
  let currentStory: Parameters<CityDialogController['openStory']>[0] | undefined;
  let closedStories = 0;
  let completedInteractions = 0;
  const values = new Map<string, string>();
  const restaurant = createWildMushroomRestaurant({
    getDialogs: () => ({
      openStory: (story) => { openedStories += 1; currentStory = story; },
      closeNpc: () => { closedStories += 1; },
    }),
    burnCity: (onDone) => { onDone?.(); return true; },
    awardAchievement: () => {},
    getStorage: () => ({
      getItem: (key) => values.get(key) ?? null,
      setItem: (key, value) => { values.set(key, value); },
    }),
  });

  const completeVisit = () => {
    while (currentStory?.options?.[0]?.text !== '离开') currentStory?.options?.[0]?.onPick();
    currentStory?.options?.[0]?.onPick();
  };

  assert.equal(restaurant.interact(() => { completedInteractions += 1; }), 'opened');
  assert.equal(values.get('minicityWildMushroomVisits'), undefined);
  completeVisit();
  assert.equal(restaurant.interact(() => { completedInteractions += 1; }), 'opened');
  completeVisit();
  assert.equal(restaurant.interact(() => { completedInteractions += 1; }), 'opened');
  completeVisit();
  assert.equal(restaurant.interact(), 'exhausted');
  assert.equal(values.get('minicityWildMushroomVisits'), '3');
  assert.equal(completedInteractions, 3);
  assert.ok(closedStories >= 6, 'dialog closes before each burn and after each completed visit');
  assert.ok(openedStories > 0);
});

test('wild mushroom restaurant hides its dialog throughout the burn effect', () => {
  let currentStory: Parameters<CityDialogController['openStory']>[0] | undefined;
  let dialogOpen = false;
  let finishBurn: (() => void) | undefined;
  const restaurant = createWildMushroomRestaurant({
    getDialogs: () => ({
      openStory: (story) => { currentStory = story; dialogOpen = true; },
      closeNpc: () => { dialogOpen = false; },
    }),
    burnCity: (onDone) => { finishBurn = onDone; return true; },
    awardAchievement: () => {},
    getStorage: () => ({ getItem: () => null, setItem: () => {} }),
  });

  restaurant.interact();
  currentStory?.options?.[0]?.onPick();
  currentStory?.options?.[0]?.onPick();
  assert.equal(dialogOpen, false);
  finishBurn?.();
  assert.equal(dialogOpen, true);
  assert.match(currentStory?.text ?? '', /镜子/);
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
