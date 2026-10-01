import assert from 'node:assert/strict';
import test from 'node:test';
import * as THREE from 'three';
import { applyBuildingDestroyedPresentation, isBuildingDestroyed, readDestroyedIds, restoreBuildingPresentation, writeDestroyedIds, type DamageableBuilding } from '../../src/city/buildingDamage';
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

function damageFixture(savedIds: string[] = []) {
  const values = new Map<string, string>();
  const storage = {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => values.set(key, value),
  };
  writeDestroyedIds(savedIds, storage);
  const buildings: DamageableBuilding[] = ['research', 'commons'].map((id) => {
    const group = new THREE.Group();
    const body = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshStandardMaterial());
    group.add(body);
    return { id, group, body };
  });
  const controller = createBuildingDamageController({
    getBuildings: () => buildings,
    getResidences: () => [],
    invalidateMap: () => undefined,
    refreshResidenceLabels: () => undefined,
    storage,
  });
  return { storage, controller, research: buildings[0]!, commons: buildings[1]! };
}

function hideForConstruction(building: DamageableBuilding): () => void {
  building.group.userData.constructionPending = true;
  restoreBuildingPresentation(building);
  const children = [...building.group.children];
  const body = building.body;
  building.group.clear();
  building.body = undefined;
  return () => {
    building.group.userData.constructionPending = false;
    building.group.add(...children);
    building.body = body;
  };
}

test('saved damage survives a pending cold start and another building damage save', () => {
  const { storage, controller, research } = damageFixture(['research', 'unloaded-building']);
  const completeConstruction = hideForConstruction(research);
  controller.applyPersisted();
  assert.equal(isBuildingDestroyed(research), false);
  assert.equal(controller.destroyBuilding('research'), false);
  assert.equal(research.group.children.length, 0);

  assert.equal(controller.destroyBuilding('commons'), true);
  assert.deepEqual(readDestroyedIds(storage), ['research', 'unloaded-building', 'commons']);
  completeConstruction();
  controller.applyPersisted();
  assert.equal(isBuildingDestroyed(research), true);
  assert.equal(research.group.getObjectByName('building-destruction-rubble')?.children.length, 8);
});

test('construction hiding does not repair damage when another building is saved', () => {
  const { storage, controller, research } = damageFixture();
  assert.equal(controller.destroyBuilding('research'), true);
  const completeConstruction = hideForConstruction(research);
  controller.applyPersisted();
  assert.equal(controller.destroyBuilding('commons'), true);
  assert.deepEqual(readDestroyedIds(storage), ['research', 'commons']);

  completeConstruction();
  controller.applyPersisted();
  assert.equal(isBuildingDestroyed(research), true);
  assert.equal(research.body?.scale.y, 0.48);
  controller.applyPersisted();
  assert.equal(research.body?.scale.y, 0.48);
  assert.equal(research.group.getObjectByName('building-destruction-rubble')?.children.length, 8);
  assert.equal(controller.restoreBuilding('research'), true);
  controller.applyPersisted();
  assert.equal(isBuildingDestroyed(research), false);
  assert.deepEqual(readDestroyedIds(storage), ['commons']);
});

test('explicit repair clears pending damage without revealing construction meshes', () => {
  const { storage, controller, research } = damageFixture(['research', 'unloaded-building']);
  const completeConstruction = hideForConstruction(research);
  controller.applyPersisted();
  assert.equal(controller.restoreBuilding('research'), true);
  assert.equal(controller.restoreBuilding('research'), false);
  assert.equal(research.group.children.length, 0);
  assert.equal(research.group.userData.constructionPending, true);
  assert.deepEqual(readDestroyedIds(storage), ['unloaded-building']);
  completeConstruction();
  controller.applyPersisted();
  assert.equal(isBuildingDestroyed(research), false);
});

test('global repair clears pending and visible damage without erasing unloaded ids', () => {
  const { storage, controller, research, commons } = damageFixture(['research', 'unloaded-building']);
  const completeConstruction = hideForConstruction(research);
  controller.applyPersisted();
  assert.equal(controller.destroyBuilding('commons'), true);
  assert.equal(controller.restoreAll(), 2);
  assert.equal(controller.restoreAll(), 0);
  assert.equal(isBuildingDestroyed(commons), false);
  assert.equal(research.group.children.length, 0);
  assert.deepEqual(readDestroyedIds(storage), ['unloaded-building']);
  completeConstruction();
  controller.applyPersisted();
  assert.equal(isBuildingDestroyed(research), false);
});

test('saved damage reapplies to replacement meshes and repairs their original presentation', () => {
  const { storage, controller, research } = damageFixture(['research']);
  controller.applyPersisted();
  const material = new THREE.MeshStandardMaterial({ color: 0x123456 });
  const replacement = new THREE.Mesh(new THREE.BoxGeometry(2, 3, 2), material);
  research.group.clear();
  research.group.add(replacement);
  research.body = replacement;
  research.group.userData.buildingState = 'default';
  research.group.userData.destroyed = false;
  controller.applyPersisted();
  assert.equal(isBuildingDestroyed(research), true);
  assert.equal(replacement.scale.y, 0.48);
  assert.notEqual(replacement.material, material);
  assert.equal(controller.restoreBuilding('research'), true);
  controller.applyPersisted();
  assert.equal(replacement.material, material);
  assert.equal(replacement.scale.y, 1);
  assert.equal(research.group.getObjectByName('building-destruction-rubble'), undefined);
  assert.deepEqual(readDestroyedIds(storage), []);
});
