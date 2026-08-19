import assert from 'node:assert/strict';
import test from 'node:test';
import * as THREE from 'three';
import { updateCityLabels } from '../../src/city/labelController';

test('city labels avoid redundant DOM writes and hide offscreen entries', () => {
  (globalThis as any).window = { innerWidth: 1000, innerHeight: 600 };
  let transformWrites = 0;
  const values: Record<string, string> = {};
  const style = new Proxy(values, {
    set(target, property, value) {
      if (property === 'transform') transformWrites += 1;
      target[String(property)] = String(value);
      return true;
    },
  });
  const labelEl = { style } as unknown as HTMLElement;
  const group = new THREE.Group();
  const camera = new THREE.OrthographicCamera(-5, 5, 5, -5, 0.1, 20);
  camera.position.set(0, 5, 5);
  camera.lookAt(0, 0, 0);
  camera.updateProjectionMatrix();
  camera.updateMatrixWorld(true);
  const options = {
    camera,
    buildings: [{ group, labelEl, labelY: 1 }],
    residences: [],
    isStoryLocked: () => false,
    worldPosition: new THREE.Vector3(),
  };

  updateCityLabels(options);
  updateCityLabels(options);
  assert.equal(transformWrites, 1);
  assert.equal(values.visibility, '');
  const projected = new THREE.Vector3(0, 1, 0).project(camera);
  assert.equal(
    values.transform,
    `translate3d(${(projected.x * 0.5 + 0.5) * 1000}px,${(-projected.y * 0.5 + 0.5) * 600}px,0) translate(-50%,-50%)`,
  );

  group.position.x = 20;
  updateCityLabels(options);
  assert.equal(values.visibility, 'hidden');
});
