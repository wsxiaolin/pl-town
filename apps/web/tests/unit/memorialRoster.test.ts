import assert from 'node:assert/strict';
import test from 'node:test';
import { BUILDING_CONTENT, BUILDING_DEFS } from '../../src/city/data/buildings';
import { MEMORIAL_ROSTER } from '../../src/city/data/memorialRoster';

test('Memorial roster retains the full numbered main list', () => {
  assert.equal(MEMORIAL_ROSTER.main.length, 37);
  assert.equal(MEMORIAL_ROSTER.main[0]?.name, '胡莱三国官方');
  assert.equal(MEMORIAL_ROSTER.main[36]?.name, '半国飞士');
  MEMORIAL_ROSTER.main.forEach((entry, index) => {
    assert.ok(entry.name.trim().length > 0, `main entry ${index + 1} has a name`);
  });
});

test('Memorial roster has a substantial comment supplement list', () => {
  assert.ok(MEMORIAL_ROSTER.comments.length >= 100);
  assert.ok(MEMORIAL_ROSTER.comments.includes('小董'));
  assert.ok(MEMORIAL_ROSTER.comments.includes('FontaineBleau'));
  assert.ok(MEMORIAL_ROSTER.comments.every((name) => name.trim().length > 0));
});

test('Memorial roster has intro and footer copy', () => {
  assert.ok(MEMORIAL_ROSTER.intro.length > 0);
  assert.ok(MEMORIAL_ROSTER.title.includes('纪念碑'));
  assert.ok(MEMORIAL_ROSTER.footer.length > 0);
});

test('lab_outer is relabelled as the eternal retirement monument', () => {
  const building = BUILDING_DEFS.find((item) => item.id === 'lab_outer');
  assert.ok(building);
  assert.equal(building.label, '永退用户纪念碑');
  assert.equal(BUILDING_CONTENT.lab_outer.name, '永退用户纪念碑');
});
