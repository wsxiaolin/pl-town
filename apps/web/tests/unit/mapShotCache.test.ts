import assert from 'node:assert/strict';
import test from 'node:test';
import {
  createAtlasShotStore,
  type AtlasShotRecord,
  type AtlasShotStorage,
} from '../../src/city/mapShotCache';

function memoryStorage(): AtlasShotStorage & { record: AtlasShotRecord | null } {
  const state = { record: null as AtlasShotRecord | null };
  return {
    get record() { return state.record; },
    async get() { return state.record; },
    async set(record) { state.record = record; },
    async delete() { state.record = null; },
  };
}

function failingStorage(): AtlasShotStorage {
  return {
    async get() { throw new Error('storage unavailable'); },
    async set() { throw new Error('storage unavailable'); },
    async delete() { throw new Error('storage unavailable'); },
  };
}

const SHOTS = { main: 'data:image/png;base64,main', north: 'data:image/png;base64,north' };

test('save then load round-trips shots under the same fingerprint', async () => {
  const storage = memoryStorage();
  const store = createAtlasShotStore(storage);
  store.save('build-a:default:12:10', SHOTS);
  assert.deepEqual(await store.load('build-a:default:12:10'), SHOTS);
});

test('a fingerprint mismatch never hydrates the stale paper', async () => {
  const store = createAtlasShotStore(memoryStorage());
  store.save('build-a:default:12:10', SHOTS);
  assert.deepEqual(await store.load('build-a:spring-festival:13:10'), {});
});

test('empty storage loads as empty, not as an error', async () => {
  const store = createAtlasShotStore(memoryStorage());
  assert.deepEqual(await store.load('build-a:default:12:10'), {});
});

test('clear invalidates the persisted atlas', async () => {
  const store = createAtlasShotStore(memoryStorage());
  store.save('build-a:default:12:10', SHOTS);
  store.clear();
  assert.deepEqual(await store.load('build-a:default:12:10'), {});
});

test('storage failures degrade silently instead of breaking the map', async () => {
  const store = createAtlasShotStore(failingStorage());
  assert.deepEqual(await store.load('build-a:default:12:10'), {});
  assert.doesNotThrow(() => store.save('build-a:default:12:10', SHOTS));
  assert.doesNotThrow(() => store.clear());
});
