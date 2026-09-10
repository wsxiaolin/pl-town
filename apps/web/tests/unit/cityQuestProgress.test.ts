import assert from 'node:assert/strict';
import test from 'node:test';
import { EMPTY_QUEST_PROGRESS, readQuestProgressView } from '../../src/city/cityQuestProgress';

test('quest progress view falls back when housing is offline', () => {
  assert.equal(readQuestProgressView(null), EMPTY_QUEST_PROGRESS);
  const view = { flags: { a: true }, inventory: {}, achievements: new Set(['x']), unlockedBuildings: new Set<string>(), unlockedDistricts: new Set<string>() };
  assert.equal(readQuestProgressView({ progression: { getQuestProgressView: () => view } }), view);
});
