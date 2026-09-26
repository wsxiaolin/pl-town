import assert from 'node:assert/strict';
import test from 'node:test';
import { getResidentToken, RESIDENT_TOKEN_KEY } from '../../src/core/residentToken';

test('resident token reads track the current storage and fail closed when storage is unavailable', (context) => {
  const descriptor = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
  context.after(() => {
    if (descriptor) Object.defineProperty(globalThis, 'localStorage', descriptor);
    else Reflect.deleteProperty(globalThis, 'localStorage');
  });
  let token: string | null = 'resident-a';
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: {
    getItem: (key: string) => { assert.equal(key, RESIDENT_TOKEN_KEY); return token; },
  } });
  assert.equal(getResidentToken(), 'resident-a');
  token = 'resident-b';
  assert.equal(getResidentToken(), 'resident-b');
  token = null;
  assert.equal(getResidentToken(), null);
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: {
    getItem: () => { throw new Error('Storage access denied'); },
  } });
  assert.equal(getResidentToken(), null);
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, get: () => { throw new Error('SecurityError'); } });
  assert.equal(getResidentToken(), null);
  Reflect.deleteProperty(globalThis, 'localStorage');
  assert.equal(getResidentToken(), null);
});
