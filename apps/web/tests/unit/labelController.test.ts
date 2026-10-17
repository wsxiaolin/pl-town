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
    buildings: [{ id: 'test', num: 'T1', x: 0, z: 0, shape: 'box', icon: 'test', group, labelEl, labelY: 1 }],
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

test('first person hides labels beyond the distance cap and overlapping screen neighbours', () => {
  (globalThis as any).window = { innerWidth: 1000, innerHeight: 600 };
  const makeLabel = () => {
    const values: Record<string, string> = {};
    const style = new Proxy(values, {
      set(target, property, value) {
        target[String(property)] = String(value);
        return true;
      },
    });
    return { element: { style } as unknown as HTMLElement, values };
  };
  // Perspective camera at street eye height looking straight ahead (-Z).
  const camera = new THREE.PerspectiveCamera(72, 1000 / 600, 0.1, 300);
  camera.position.set(0, 1.55, 0);
  camera.rotation.order = 'YXZ';
  camera.lookAt(0, 1.55, -10);
  camera.updateProjectionMatrix();
  camera.updateMatrixWorld(true);

  const near = makeLabel();   // 10 m ahead → kept
  const twin = makeLabel();   // same spot as near (screen overlap) → hidden, near wins
  const far = makeLabel();    // 60 m ahead → beyond cap, hidden
  const fading = makeLabel(); // 40 m ahead, inside the fade band → dimmed but visible
  const beside = makeLabel(); // 10 m ahead but far off to the side → offscreen, hidden
  const makeGroup = (x: number, z: number) => {
    const group = new THREE.Group();
    group.position.set(x, 0, z);
    return group;
  };
  const buildings = [
    { id: 'near', num: 'N', x: 0, z: -10, shape: 'box', icon: 'i', group: makeGroup(0, -10), labelEl: near.element, labelY: 4 },
    { id: 'twin', num: 'T', x: 0, z: -10, shape: 'box', icon: 'i', group: makeGroup(0, -10), labelEl: twin.element, labelY: 4.2 },
    { id: 'far', num: 'F', x: 0, z: -60, shape: 'box', icon: 'i', group: makeGroup(0, -60), labelEl: far.element, labelY: 4 },
    { id: 'fading', num: 'D', x: 0, z: -40, shape: 'box', icon: 'i', group: makeGroup(0, -40), labelEl: fading.element, labelY: 4 },
    { id: 'beside', num: 'B', x: 400, z: -10, shape: 'box', icon: 'i', group: makeGroup(400, -10), labelEl: beside.element, labelY: 4 },
  ];
  const options = {
    camera,
    buildings,
    residences: [],
    isStoryLocked: () => false,
    worldPosition: new THREE.Vector3(),
    firstPersonActive: true,
  };

  updateCityLabels(options);

  assert.equal(near.values.visibility, '');
  assert.equal(twin.values.visibility, 'hidden');
  assert.equal(far.values.visibility, 'hidden');
  assert.equal(beside.values.visibility, 'hidden');
  // The 40 m label sits in the 33→45 m fade band: visible but dimmed.
  assert.equal(fading.values.visibility, '');
  const fadeOpacity = Number(fading.values.opacity);
  assert.ok(fadeOpacity > 0 && fadeOpacity < 1, `expected a faded opacity, got ${fading.values.opacity}`);

  // Leaving first person restores the overhead full-projection behaviour:
  // the distant and side labels come back, the twin overlap is no longer culled.
  updateCityLabels({ ...options, firstPersonActive: false });
  assert.equal(near.values.visibility, '');
  assert.equal(twin.values.visibility, '');
  assert.equal(far.values.visibility, '');
  assert.equal(beside.values.visibility, 'hidden');
  // Inline fade opacity from the FP pass is cleared on the kept labels.
  assert.ok(!near.values.opacity, `expected no inline opacity, got ${near.values.opacity}`);
  assert.ok(!fading.values.opacity, `expected no inline opacity, got ${fading.values.opacity}`);
});
