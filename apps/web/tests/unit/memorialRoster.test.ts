import assert from 'node:assert/strict';
import test from 'node:test';
import { BUILDING_CONTENT, BUILDING_DEFS } from '../../src/city/data/buildings';
import { MEMORIAL_ROSTER } from '../../src/city/data/memorialRoster';

test('Memorial roster keeps the supplied name list verbatim', () => {
  assert.equal(MEMORIAL_ROSTER.names.length, 120);
  assert.equal(MEMORIAL_ROSTER.names[0], '小董');
  assert.equal(MEMORIAL_ROSTER.names[MEMORIAL_ROSTER.names.length - 1], 'FontaineBleau');
  MEMORIAL_ROSTER.names.forEach((name, index) => {
    assert.ok(name.trim().length > 0, `name ${index + 1} is empty`);
    assert.ok(!name.startsWith('<'), `name ${index + 1} still carries a tag: ${name}`);
    assert.ok(!name.startsWith('@'), `name ${index + 1} still carries a leading @: ${name}`);
  });
});

test('Memorial roster keeps the two-line subtitle copy', () => {
  assert.equal(MEMORIAL_ROSTER.subtitle.length, 2);
  assert.equal(MEMORIAL_ROSTER.subtitle[0], '他们曾经是小镇的居民，如今已经离开我们了');
  assert.equal(MEMORIAL_ROSTER.subtitle[1], '不完全统计数据来自于胡桃');
});

test('Memorial roster keeps the unchanged first-page title', () => {
  assert.equal(MEMORIAL_ROSTER.title, '物实永退用户纪念碑');
});

test('lab_outer is relabelled as the data center', () => {
  const building = BUILDING_DEFS.find((item) => item.id === 'lab_outer');
  assert.ok(building);
  assert.equal(building.label, '数据中心');
  assert.equal(BUILDING_CONTENT.lab_outer.name, '数据中心');
});

test('the elevator building is relabelled as the memorial monument', () => {
  const building = BUILDING_DEFS.find((item) => item.id === 'elevator');
  assert.ok(building);
  assert.equal(building.id, 'elevator');
  assert.equal(building.label, '纪念碑');
  assert.equal(BUILDING_CONTENT.elevator.name, '纪念碑');
});
