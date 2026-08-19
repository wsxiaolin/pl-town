import assert from 'node:assert/strict';
import test from 'node:test';
import * as THREE from 'three';
import { applyBuildingDestroyedPresentation, isBuildingDestroyed, readDestroyedIds, restoreBuildingPresentation, writeDestroyedIds } from '../../src/city/buildingDamage';
import { createBuildingDamageController } from '../../src/city/buildingDamageController';

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
  assert.equal(restoreBuildingPresentation(residence), true);
  assert.equal(isBuildingDestroyed(residence), false);
  assert.equal(body.scale.y, 1);
  assert.equal(group.getObjectByName('building-destruction-rubble'), undefined);
});

test('destroyed ids persist and recover from malformed storage', () => {
  const values = new Map<string, string>();
  const storage = {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => values.set(key, value),
  };
  writeDestroyedIds(['library', 'library', 'residence:1.00:2.00'], storage);
  assert.deepEqual(readDestroyedIds(storage), ['library', 'residence:1.00:2.00']);
  values.set('minicityDestroyedBuildings', '{bad json');
  assert.deepEqual(readDestroyedIds(storage), []);
});

test('residence visual batches follow destroy, restore, and persisted state', () => {
  const values = new Map<string, string>();
  const storage = {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => values.set(key, value),
  };
  const makeResidence = () => {
    const group = new THREE.Group();
    const body = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshStandardMaterial());
    group.add(body);
    return { id: 'residence:test', group, body };
  };
  const visibility: Array<[string, boolean]> = [];
  const firstResidence = makeResidence();
  const firstController = createBuildingDamageController({
    getBuildings: () => [],
    getResidences: () => [firstResidence],
    invalidateMap: () => undefined,
    refreshResidenceLabels: () => undefined,
    setResidenceVisualVisible: (id, visible) => visibility.push([id, visible]),
    storage,
  });

  assert.equal(firstController.destroyAll(), 1);
  assert.deepEqual(visibility, [['residence:test', false]]);
  assert.equal(firstController.restoreAll(), 1);
  assert.deepEqual(visibility.at(-1), ['residence:test', true]);
  assert.equal(firstController.destroyResidence('residence:test'), true);

  const recoveredVisibility: Array<[string, boolean]> = [];
  const recoveredResidence = makeResidence();
  createBuildingDamageController({
    getBuildings: () => [],
    getResidences: () => [recoveredResidence],
    invalidateMap: () => undefined,
    refreshResidenceLabels: () => undefined,
    setResidenceVisualVisible: (id, visible) => recoveredVisibility.push([id, visible]),
    storage,
  }).applyPersisted();

  assert.equal(isBuildingDestroyed(recoveredResidence), true);
  assert.deepEqual(recoveredVisibility, [['residence:test', false]]);
});
