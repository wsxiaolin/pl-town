import assert from 'node:assert/strict';
import test from 'node:test';
import { calcLevel, formatTime, getStats, getUserId, saveStats } from '../../src/city/progression/legacyStats';

class MemoryStorage {
  private readonly values = new Map<string, string>();
  getItem(key: string): string | null { return this.values.get(key) ?? null; }
  setItem(key: string, value: string): void { this.values.set(key, value); }
}

test('legacy stats adapter recovers from malformed and partial saves', () => {
  const storage = new MemoryStorage();
  storage.setItem('minicityStats', '{bad json');
  assert.equal(getStats(storage).interactions, 0);
  storage.setItem('minicityStats', JSON.stringify({ interactions: 4, achievements: ['first_building'] }));
  assert.deepEqual(getStats(storage), {
    interactions: 4,
    buildingsVisited: [],
    joinDate: null,
    unlockLevel: 0,
    achievements: ['first_building'],
    npcsMet: [],
    npcsTalked: 0,
    distance: 0,
    nightToggles: 0,
  });
});

test('legacy stats helpers preserve progression semantics', () => {
  assert.equal(calcLevel(0), 1);
  assert.equal(calcLevel(20), 5);
  assert.equal(formatTime(65), '1m 05s');
  const storage = new MemoryStorage();
  const first = getUserId(storage);
  assert.match(first, /^usr_[a-z0-9]+$/);
  assert.equal(getUserId(storage), first);
  saveStats({
    interactions: 1,
    buildingsVisited: [],
    joinDate: null,
    unlockLevel: 0,
    achievements: [],
    npcsMet: [],
    npcsTalked: 0,
    distance: 0,
    nightToggles: 0,
  }, storage);
  assert.equal(getStats(storage).interactions, 1);
});

