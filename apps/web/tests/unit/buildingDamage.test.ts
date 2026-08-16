import assert from 'node:assert/strict';
import test from 'node:test';
import * as THREE from 'three';
import { applyBuildingDestroyedPresentation, isBuildingDestroyed } from '../../src/city/buildingDamage';

test('destroying a building adds rubble and marks it unavailable', () => {
  const group = new THREE.Group();
  group.add(new THREE.Mesh(new THREE.BoxGeometry(2, 2, 2), new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0x223344 })));
  const body = group.children[0] as THREE.Mesh;
  const building = { id: 'library', group, body };

  assert.equal(applyBuildingDestroyedPresentation(building), true);
  assert.equal(isBuildingDestroyed(building), true);
  assert.equal(group.getObjectByName('building-destruction-rubble')?.children.length, 8);
  assert.equal(body.scale.y, 0.48);
  assert.equal(applyBuildingDestroyedPresentation(building), false);
});

test('destroying a residence uses its body mesh and remains idempotent', () => {
  const group = new THREE.Group();
  const body = new THREE.Mesh(new THREE.BoxGeometry(1.6, 1.2, 1.4), new THREE.MeshStandardMaterial({ color: 0xe5d1b8 }));
  group.add(body);
  const residence = { id: 'residence:12.00:-6.00', group, body };

  assert.equal(applyBuildingDestroyedPresentation(residence), true);
  assert.equal(isBuildingDestroyed(residence), true);
  assert.equal(group.getObjectByName('building-destruction-rubble')?.children.length, 8);
  assert.equal(body.scale.y, 0.48);
  assert.equal(applyBuildingDestroyedPresentation(residence), false);
});
