import assert from 'node:assert/strict';
import test from 'node:test';
import * as THREE from 'three';
import {
  applyStoryLockedBuildingPresentation,
  restoreStoryLockedBuildingPresentation,
} from '../../src/city/storyLockedBuildingPresentation';

function makeBuilding() {
  const group = new THREE.Group();
  const material = new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0x336699, emissiveIntensity: 0.8 });
  group.add(new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), material));
  return { group, material };
}

test('locking darkens the building and restores the original material', () => {
  const { group, material } = makeBuilding();
  const label = { hidden: false, tabIndex: 0 } as unknown as HTMLElement;

  applyStoryLockedBuildingPresentation([{ group, labelEl: label }]);

  const locked = (group.children[0] as THREE.Mesh).material as THREE.MeshStandardMaterial;
  assert.notEqual(locked, material);
  assert.equal(group.userData.storyLocked, true);
  assert.equal(label.hidden, true);
  assert.equal(locked.emissiveIntensity, 0);
  assert.ok((locked.color?.getHex() ?? 0xffffff) < 0xffffff);

  restoreStoryLockedBuildingPresentation([{ group, labelEl: label }]);

  const restored = (group.children[0] as THREE.Mesh).material;
  assert.equal(restored, material);
  assert.equal(group.userData.storyLocked, false);
  assert.equal(label.hidden, false);
  assert.equal(label.tabIndex, 0);
});

test('re-applying the lock does not compound the darkening', () => {
  const { group, material } = makeBuilding();

  applyStoryLockedBuildingPresentation([{ group }]);
  const first = ((group.children[0] as THREE.Mesh).material as THREE.MeshStandardMaterial).color!.getHex();
  applyStoryLockedBuildingPresentation([{ group }]);
  const second = ((group.children[0] as THREE.Mesh).material as THREE.MeshStandardMaterial).color!.getHex();

  assert.equal(second, first);

  restoreStoryLockedBuildingPresentation([{ group }]);
  assert.equal((group.children[0] as THREE.Mesh).material, material);
});
