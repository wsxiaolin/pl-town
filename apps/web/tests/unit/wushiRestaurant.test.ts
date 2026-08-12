import assert from 'node:assert/strict';
import test from 'node:test';
import { BUILDING_CONTENT, BUILDING_DEFS } from '../../src/city/data/buildings';
import { NPC_PROFILES } from '../../src/city/data/npcs';
import { isNpcHiddenAtHour } from '../../src/city/npcSystem';

test('Wushi restaurant is a fixed unique building with a complete dialogue tree', () => {
  const restaurant = BUILDING_DEFS.find((building) => building.id === 'wushi_restaurant');
  assert.ok(restaurant);
  assert.equal(restaurant.shape, 'restaurant');
  assert.equal(BUILDING_DEFS.filter((building) => building.x === restaurant.x && building.z === restaurant.z).length, 1);

  const tree = BUILDING_CONTENT.wushi_restaurant.dialogTree;
  assert.equal(tree.length, 17);
  tree.forEach((node, nodeIndex) => node.options.forEach((option) => {
    assert.ok(option.next === null || (option.next >= 0 && option.next < tree.length), `node ${nodeIndex} has a valid destination`);
  }));
  assert.match(tree[15]?.text ?? '', /冰冻罗非鱼/);
  assert.match(tree[16]?.text ?? '', /9072000/);
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
