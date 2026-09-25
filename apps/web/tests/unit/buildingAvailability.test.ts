import assert from 'node:assert/strict';
import test from 'node:test';
import * as THREE from 'three';
import { applyBuildingDestroyedPresentation } from '../../src/city/buildingDamage';
import { createBuildingAvailability, storyLockedBuildingIds } from '../../src/city/buildingAvailability';

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
  });

  availability.applyGloballyUnlocked(['echo_cabin']);
  assert.equal(availability.isStoryLocked({ id: 'echo_cabin' }), false);

  // Admin turns the global unlock back off: the building locks again.
  availability.applyGloballyUnlocked([]);
  assert.equal(availability.isStoryLocked({ id: 'echo_cabin' }), true);
});

test('construction visibility also blocks interaction until the project is completed', () => {
  const group = new THREE.Group();
  const availability = createBuildingAvailability({ storyLockedIds: new Set(), getResidences: () => [] });
  const building = { id: 'library', group };
  group.userData.constructionPending = true;
  availability.applyGloballyUnlocked(['library']);
  assert.equal(availability.isBuildingUnavailable(building), true);
  group.userData.constructionPending = false;
  assert.equal(availability.isBuildingUnavailable(building), false);
});
