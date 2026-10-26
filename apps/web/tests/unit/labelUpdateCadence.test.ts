import assert from 'node:assert/strict';
import test from 'node:test';
import { createLabelUpdateGate } from '../../src/rendering/labelUpdateCadence';

function view(camera: unknown, firstPersonActive = false, viewportWidth = 1000, viewportHeight = 600) {
  return { camera, firstPersonActive, viewportWidth, viewportHeight };
}

test('label projection is capped at the configured cadence', () => {
  const shouldUpdate = createLabelUpdateGate(1000 / 30);
  const camera = {};

  assert.equal(shouldUpdate(0, view(camera)), true);
  assert.equal(shouldUpdate(16, view(camera)), false);
  assert.equal(shouldUpdate(34, view(camera)), true);
  assert.equal(shouldUpdate(50, view(camera)), false);
});

test('view changes and clock resets update labels immediately', () => {
  const shouldUpdate = createLabelUpdateGate(1000 / 30);
  const overheadCamera = {};
  const firstPersonCamera = {};

  assert.equal(shouldUpdate(100, view(overheadCamera)), true);
  assert.equal(shouldUpdate(110, view(firstPersonCamera, true)), true);
  assert.equal(shouldUpdate(115, view(firstPersonCamera, true, 800, 600)), true);
  assert.equal(shouldUpdate(120, view(firstPersonCamera, false, 800, 600)), true);
  assert.equal(shouldUpdate(1, view(firstPersonCamera, false, 800, 600)), true);
  assert.equal(shouldUpdate(10, view(firstPersonCamera, false, 800, 600)), false);
});
