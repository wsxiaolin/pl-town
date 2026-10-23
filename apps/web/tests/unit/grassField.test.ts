import assert from 'node:assert/strict';
import test from 'node:test';
import * as THREE from 'three';
import { createCityGround } from '../../src/rendering/terrain/cityGround';
import {
  createGrassField,
  createGrassTuftGeometry,
} from '../../src/rendering/terrain/grassField';

test('grass tuft geometry is a rest-pose ribbon with per-vertex sway', () => {
  const geometry = createGrassTuftGeometry();
  const positions = geometry.getAttribute('position');
  const sway = geometry.getAttribute('aSwayFactor');
  const colors = geometry.getAttribute('color');
  assert.equal(positions.count, 12);
  assert.equal(sway.count, 12);
  assert.equal(colors.count, 12);
  const factors = Array.from({ length: sway.count }, (_, index) => sway.getX(index));
  assert.ok(factors.includes(0));
  assert.ok(factors.includes(1));
  const heights = Array.from({ length: positions.count }, (_, index) => positions.getY(index));
  assert.equal(Math.min(...heights), 0);
  assert.ok(Math.max(...heights) > 0.4);
  geometry.dispose();
});

test('grass field instances authored spots and skips empty input', () => {
  assert.equal(createGrassField([]), null);
  const field = createGrassField([
    { x: 1, y: 0.2, z: 2, scale: 1, yaw: 0 },
    { x: 3, y: 0.4, z: -1, scale: 1.2, yaw: 1.1 },
  ]);
  assert.ok(field);
  assert.equal(field.object.name, 'cityside-grass-field');
  assert.equal(field.count, 2);
  assert.equal(field.object.count, 2);
  assert.equal(field.object.frustumCulled, false);
  field.update(1.5);
  field.dispose();
});

test('city ground plants an instanced grass field on lawns and meadows', () => {
  const scene = new THREE.Scene();
  const first = createCityGround({ scene });
  const second = createCityGround({ scene });
  const field = first.object.getObjectByName('cityside-grass-field');
  const again = second.object.getObjectByName('cityside-grass-field');
  assert.ok(field instanceof THREE.InstancedMesh);
  assert.ok(again instanceof THREE.InstancedMesh);
  assert.ok(field.count > 80, `expected a meadow-scale field, got ${field.count}`);
  assert.equal(field.count, again.count);
  first.update(0.4);
  first.dispose();
  second.dispose();
});
