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
