import assert from 'node:assert/strict';
import test from 'node:test';
import { ACTIVITY_ENTRIES } from '../../src/city/data/activities';

test('activity catalog keeps unique ids and complete presentation fields', () => {
  assert.ok(ACTIVITY_ENTRIES.length >= 3);
  const ids = new Set(ACTIVITY_ENTRIES.map((entry) => entry.id));
  assert.equal(ids.size, ACTIVITY_ENTRIES.length);
  for (const entry of ACTIVITY_ENTRIES) {
    assert.ok(entry.name, `activity ${entry.id} missing name`);
    assert.ok(entry.kicker, `activity ${entry.id} missing kicker`);
    assert.ok(entry.title, `activity ${entry.id} missing title`);
    assert.ok(entry.description, `activity ${entry.id} missing description`);
    assert.ok(entry.backgroundKey, `activity ${entry.id} missing backgroundKey`);
  }
});
