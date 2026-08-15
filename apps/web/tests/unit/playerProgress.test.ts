import {
  canInteractWithBuilding,
  inventoryEntries,
  normalizePlayerProgress,
  toQuestProgressView,
} from '../../src/gameplay/progression/playerProgress';

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

const normalized = normalizePlayerProgress({
  currency: 85,
  inventory: { dragonwell_tea: 2, mandarin: 1, invalid: -3, fraction: 1.5 },
  achievements: ['first_building', 'first_building', 42],
  unlockedBuildings: ['mall_south', 'mall_south'],
  visitedBuildings: ['activity', null],
});

assert(normalized.currency === 85, 'currency should be preserved');
assert(normalized.inventory.dragonwell_tea === 2 && normalized.inventory.invalid === undefined, 'inventory should only contain positive integer counts');
assert(normalized.achievements.length === 1, 'achievement IDs should be deduplicated');
assert(canInteractWithBuilding(normalized, 'mall_south'), 'unlocked buildings should be interactive');
assert(!canInteractWithBuilding(normalized, 'library'), 'locked buildings should not be interactive');

const items = inventoryEntries(normalized);
assert(items.some((item) => item.itemId === 'dragonwell_tea' && item.name === '龙井茶' && item.quantity === 2), 'inventory entries should expose labels and merged quantities');

const questView = toQuestProgressView(normalized);
assert(questView.inventory.mandarin === 1, 'quest view should expose cloud inventory');
assert(questView.achievements.has('first_building'), 'quest view should expose cloud achievements');
assert(questView.unlockedBuildings.has('mall_south'), 'quest view should expose cloud building unlocks');

const malformed = normalizePlayerProgress({ currency: -5, inventory: null, achievements: 'bad' });
assert(malformed.currency === 0 && Object.keys(malformed.inventory).length === 0, 'malformed snapshots should fall back safely');

console.log('playerProgress tests passed');
