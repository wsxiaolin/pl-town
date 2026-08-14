import assert from 'node:assert/strict';
import test from 'node:test';
import * as THREE from 'three';
import { findBuildingFromRaycastHits } from '../../src/city/buildingRaycast';

test('raycast building lookup skips invalid hits and selects the first available building', () => {
  const invalid = new THREE.Object3D();
  invalid.userData.buildingId = 'unknown';
  const locked = new THREE.Object3D();
  locked.userData.buildingId = 'locked';
  const visible = new THREE.Object3D();
  visible.userData.buildingId = 'library';

  const building = findBuildingFromRaycastHits({
    hits: [{ object: invalid }, { object: locked }, { object: visible }],
    buildings: [{ id: 'locked' }, { id: 'library' }],
    readUserData: (object, key) => object.userData[key],
    isUnavailable: item => item.id === 'locked',
  });

  assert.deepEqual(building, { id: 'library' });
});

test('raycast building lookup returns null when no hit maps to an available building', () => {
  const unknown = new THREE.Object3D();
  unknown.userData.buildingId = 'unknown';

  const building = findBuildingFromRaycastHits({
    hits: [{ object: unknown }],
    buildings: [{ id: 'library' }],
    readUserData: (object, key) => object.userData[key],
  });

  assert.equal(building, null);
});
