import assert from 'node:assert/strict';
import test from 'node:test';
import { createReflectionRefreshGate } from '../../src/rendering/reflectionRenderCadence';

test('reflection refreshes are capped at the configured cadence', () => {
  const shouldRefresh = createReflectionRefreshGate(1000 / 30);
  const camera = {};

  assert.equal(shouldRefresh(0, camera), true);
  assert.equal(shouldRefresh(16, camera), false);
  assert.equal(shouldRefresh(34, camera), true);
  assert.equal(shouldRefresh(50, camera), false);
  assert.equal(shouldRefresh(68, camera), true);
});

test('camera switches and clock resets refresh immediately', () => {
  const shouldRefresh = createReflectionRefreshGate(1000 / 30);
  const cityCamera = {};
  const firstPersonCamera = {};

  assert.equal(shouldRefresh(100, cityCamera), true);
  assert.equal(shouldRefresh(110, firstPersonCamera), true);
  assert.equal(shouldRefresh(1, firstPersonCamera), true);
  assert.equal(shouldRefresh(10, firstPersonCamera), false);
});
