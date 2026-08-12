import assert from 'node:assert/strict';
import test from 'node:test';
import { screenVectorToWorld } from '../../src/city/navigation/movementInputController';

test('screen movement maps to the isometric ground plane', () => {
  const up = screenVectorToWorld(0, -1);
  const right = screenVectorToWorld(1, 0);
  assert.ok(up.x < 0 && up.z < 0);
  assert.ok(right.x > 0 && right.z < 0);
  assert.ok(Math.abs(Math.hypot(up.x, up.z) - 1) < 0.0001);
});

test('diagonal input is normalized and idle input stays zero', () => {
  const diagonal = screenVectorToWorld(1, -1);
  assert.ok(Math.abs(Math.hypot(diagonal.x, diagonal.z) - 1) < 0.0001);
  assert.deepEqual(screenVectorToWorld(0, 0), { x: 0, z: 0 });
});
