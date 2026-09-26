import assert from 'node:assert/strict';
import test from 'node:test';
import * as THREE from 'three';
import { applyBuildingDestroyedPresentation } from '../../src/city/buildingDamage';
import { createBuildingAvailability, storyLockedBuildingIds } from '../../src/city/buildingAvailability';
import { applyCityState, disposeCityGovernance, isConstructionPending, loadCityGovernance } from '../../src/city/cityGovernanceClient';

test('storyLockedBuildingIds only keeps flagged definitions', () => {
  const ids = storyLockedBuildingIds([
    { id: 'library' },
    { id: 'echo_cabin', storyLocked: true },
    { id: 'mall', storyLocked: false },
  ]);
  assert.deepEqual([...ids], ['echo_cabin']);
});

test('building availability treats story-lock and destruction independently', () => {
  const lockedGroup = new THREE.Group();
  const openGroup = new THREE.Group();
  openGroup.add(new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshStandardMaterial()));
  const destroyedResidence = { id: 'residence:1.00:2.00', label: 'Residence', group: new THREE.Group() };
  destroyedResidence.group.add(new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshStandardMaterial()));
  applyBuildingDestroyedPresentation({ id: destroyedResidence.id, group: destroyedResidence.group, body: destroyedResidence.group.children[0] as THREE.Mesh });

  const availability = createBuildingAvailability({
    storyLockedIds: new Set(['echo_cabin']),
    getResidences: () => [destroyedResidence],
    isConstructionPending: () => false,
  });

  assert.equal(availability.isStoryLocked({ id: 'echo_cabin' }), true);
  assert.equal(availability.isBuildingUnavailable({ id: 'echo_cabin', group: lockedGroup }), true);
  assert.equal(availability.isBuildingUnavailable({ id: 'library', group: openGroup }), false);
  assert.equal(availability.isResidenceUnavailable('residence:1.00:2.00'), true);
  assert.equal(availability.isResidenceUnavailable('missing'), true);
});

test('applyGloballyUnlocked clears a story lock in place', () => {
  const group = new THREE.Group();
  const availability = createBuildingAvailability({
    storyLockedIds: new Set(['echo_cabin']),
    getResidences: () => [],
    isConstructionPending: () => false,
  });

  assert.equal(availability.isStoryLocked({ id: 'echo_cabin' }), true);

  availability.applyGloballyUnlocked(['echo_cabin', 'library']);

  assert.equal(availability.isStoryLocked({ id: 'echo_cabin' }), false);
  assert.equal(availability.isBuildingUnavailable({ id: 'echo_cabin', group }), false);
  // Unrelated ids in the catalog must never be marked story-locked.
  assert.equal(availability.isStoryLocked({ id: 'library' }), false);
});

test('applyGloballyUnlocked is authoritative and re-locks when the id disappears', () => {
  const availability = createBuildingAvailability({
    storyLockedIds: new Set(['echo_cabin']),
    getResidences: () => [],
    isConstructionPending: () => false,
  });

  availability.applyGloballyUnlocked(['echo_cabin']);
  assert.equal(availability.isStoryLocked({ id: 'echo_cabin' }), false);

  // Admin turns the global unlock back off: the building locks again.
  availability.applyGloballyUnlocked([]);
  assert.equal(availability.isStoryLocked({ id: 'echo_cabin' }), true);
});

test('construction visibility also blocks interaction until the project is completed', () => {
  const group = new THREE.Group();
  let pending = true;
  const availability = createBuildingAvailability({ storyLockedIds: new Set(), getResidences: () => [], isConstructionPending: () => pending });
  const building = { id: 'library', group };
  availability.applyGloballyUnlocked(['library']);
  assert.equal(availability.isBuildingUnavailable(building), true);
  pending = false;
  assert.equal(availability.isBuildingUnavailable(building), false);
});

test('construction access retains the last trusted policy during config reload and network failure', async (context) => {
  const apiGlobals = ['__TOWN_VITE_API_BASE__', '__TOWN_VITE_SERVER_URL__'];
  const descriptors = apiGlobals.map((key) => Object.getOwnPropertyDescriptor(globalThis, key));
  apiGlobals.forEach((key) => Object.defineProperty(globalThis, key, { value: '', configurable: true }));
  context.after(() => {
    disposeCityGovernance();
    apiGlobals.forEach((key, index) => {
      const descriptor = descriptors[index];
      if (descriptor) Object.defineProperty(globalThis, key, descriptor);
      else Reflect.deleteProperty(globalThis, key);
    });
  });
  disposeCityGovernance();
  let version = 'construction-access-v1';
  let built = false;
  let unavailable = false;
  let reloadGate: Promise<void> | undefined;
  context.mock.method(globalThis, 'fetch', async (input: string) => {
    if (unavailable) throw new Error('offline');
    if (input.endsWith('/config')) {
      await reloadGate;
      return Response.json({ version, initialBuiltBuildingIds: ['commons'], projects: [{ id: 'library-project', buildingId: 'library' }] });
    }
    return Response.json({ epoch: 'test', revision: 1, configVersion: version, projects: [{ id: 'library-project', built, funded: built ? 3000 : 0, votes: 0 }], decorations: [] });
  });
  const building = { id: 'library', group: new THREE.Group() };
  const availability = createBuildingAvailability({ storyLockedIds: new Set(), getResidences: () => [], isConstructionPending });
  assert.equal(availability.isBuildingUnavailable(building), false);
  await loadCityGovernance();
  assert.equal(availability.isBuildingUnavailable(building), true);

  let releaseReload!: () => void;
  reloadGate = new Promise((resolve) => { releaseReload = resolve; });
  version = 'construction-access-v2';
  built = true;
  applyCityState({ epoch: 'test', revision: 1, configVersion: version, projects: [], decorations: [] });
  const reloading = loadCityGovernance();
  assert.equal(availability.isBuildingUnavailable(building), true);
  releaseReload();
  await reloading;
  assert.equal(availability.isBuildingUnavailable(building), false);

  applyCityState({ epoch: 'test', revision: 2, configVersion: version, projects: [{ id: 'library-project', funded: 0, built: false, votes: 0 }], decorations: [] });
  unavailable = true;
  await loadCityGovernance();
  assert.equal(availability.isBuildingUnavailable(building), true);
});

test('new configured buildings stay hidden when state loading fails without changing known outcomes', async (context) => {
  const apiGlobals = ['__TOWN_VITE_API_BASE__', '__TOWN_VITE_SERVER_URL__'];
  const descriptors = apiGlobals.map((key) => Object.getOwnPropertyDescriptor(globalThis, key));
  apiGlobals.forEach((key) => Object.defineProperty(globalThis, key, { value: '', configurable: true }));
  context.after(() => {
    disposeCityGovernance();
    apiGlobals.forEach((key, index) => {
      const descriptor = descriptors[index];
      if (descriptor) Object.defineProperty(globalThis, key, descriptor);
      else Reflect.deleteProperty(globalThis, key);
    });
  });
  disposeCityGovernance();
  let version = 'known-city';
  let ids = ['library', 'academy'];
  let stateGate: Promise<void> | undefined;
  let stateRequested = () => {};
  let failState = false;
  context.mock.method(globalThis, 'fetch', async (input: string) => {
    if (input.endsWith('/config')) return Response.json({ version, initialBuiltBuildingIds: ['commons'],
      projects: ids.map((id) => ({ id: `build-${id}`, buildingId: id })) });
    stateRequested();
    await stateGate;
    if (failState) throw new Error('state unavailable');
    return Response.json({ epoch: 'test', revision: 1, configVersion: version,
      projects: ids.map((id) => ({ id: `build-${id}`, built: id !== 'academy', funded: id === 'academy' ? 0 : 3000, votes: 0 })), decorations: [] });
  });
  await loadCityGovernance();
  const assertKnownOutcomes = () => {
    assert.equal(isConstructionPending('commons'), false);
    assert.equal(isConstructionPending('library'), false);
    assert.equal(isConstructionPending('academy'), true);
  };
  assertKnownOutcomes();
  version = 'expanded-city';
  ids = [...ids, 'photostudio'];
  failState = true;
  let releaseState!: () => void;
  stateGate = new Promise((resolve) => { releaseState = resolve; });
  const requested = new Promise<void>((resolve) => { stateRequested = resolve; });
  const loading = loadCityGovernance();
  await requested;
  assertKnownOutcomes();
  assert.equal(isConstructionPending('photostudio'), true);
  releaseState();
  await loading;
  assertKnownOutcomes();
  assert.equal(isConstructionPending('photostudio'), true);
  failState = false;
  await loadCityGovernance();
  assertKnownOutcomes();
  assert.equal(isConstructionPending('photostudio'), false);
  applyCityState({ epoch: 'restored-city', revision: 0, configVersion: version,
    projects: ids.map((id) => ({ id: `build-${id}`, built: false, funded: 0, votes: 0 })), decorations: [] });
  assert.equal(isConstructionPending('library'), true);
  assert.equal(isConstructionPending('photostudio'), true);
  assert.equal(isConstructionPending('commons'), false);
});
