import assert from 'node:assert/strict';
import test from 'node:test';
import { screenVectorToWorld } from '../../src/city/navigation/movementInputController';
import { retainPathOnFailedReroute } from '../../src/city/navigation/playerController';
import * as THREE from 'three';

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

test('a failed repeated click keeps the active automatic route', () => {
  const active = [new THREE.Vector3(0, 0, -6), new THREE.Vector3(0, 0, -12)];
  assert.equal(retainPathOnFailedReroute(active, []), active);
  const replacement = [new THREE.Vector3(6, 0, 0)];
  assert.equal(retainPathOnFailedReroute(active, replacement), replacement);
});
