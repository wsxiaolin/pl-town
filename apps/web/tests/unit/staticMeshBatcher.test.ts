import assert from 'node:assert/strict';
import test from 'node:test';
import * as THREE from 'three';
import { batchRetainedStaticMeshes, batchStaticMeshes } from '../../src/rendering/staticMeshBatcher';

test('static decoration meshes with shared resources collapse into one batch', () => {
  const scene = new THREE.Scene();
  const root = new THREE.Group();
  const geometry = new THREE.BoxGeometry(1, 1, 1);
  const material = new THREE.MeshBasicMaterial({ color: 0xffffff });
  const first = new THREE.Mesh(geometry, material);
  const second = new THREE.Mesh(geometry, material);
  first.position.set(1, 0, 0);
  second.position.set(3, 0, 0);
  root.add(first, second);
  scene.add(root);

  const result = batchStaticMeshes(scene, [root]);
  const batches = scene.children.filter((child) => child instanceof THREE.InstancedMesh);

  assert.deepEqual(result, { batches: 1, sourceMeshes: 2 });
  assert.equal(root.children.length, 0);
  assert.equal(batches.length, 1);
  assert.equal((batches[0] as THREE.InstancedMesh).count, 2);
});

test('interactive and unique meshes remain untouched', () => {
  const scene = new THREE.Scene();
  const root = new THREE.Group();
  root.add(new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshBasicMaterial()));
  scene.add(root);

  const result = batchStaticMeshes(scene, [root], new Set([root]));

  assert.deepEqual(result, { batches: 0, sourceMeshes: 0 });
  assert.equal(root.children.length, 1);
});

test('retained batches keep source meshes for interaction and toggle individual roots', () => {
  const scene = new THREE.Scene();
  const geometry = new THREE.BoxGeometry(1, 1, 1);
  const material = new THREE.MeshBasicMaterial({ color: 0xffffff });
  const firstRoot = new THREE.Group();
  const secondRoot = new THREE.Group();
  const first = new THREE.Mesh(geometry, material);
  const second = new THREE.Mesh(geometry, material);
  firstRoot.add(first);
  secondRoot.add(second);
  firstRoot.position.x = 1;
  secondRoot.position.x = 3;
  scene.add(firstRoot, secondRoot);

  const result = batchRetainedStaticMeshes(scene, [
    { key: 'first', root: firstRoot },
    { key: 'second', root: secondRoot },
  ]);
  const batch = scene.children.find((child): child is THREE.InstancedMesh => child instanceof THREE.InstancedMesh)!;
  const matrix = new THREE.Matrix4();

  assert.deepEqual({ batches: result.batches, sourceMeshes: result.sourceMeshes }, { batches: 1, sourceMeshes: 2 });
  assert.equal(first.parent, firstRoot);
  assert.equal(second.parent, secondRoot);
  assert.equal(first.visible, false);
  assert.equal(second.visible, false);

  result.setVisible('first', false);
  batch.getMatrixAt(0, matrix);
  assert.deepEqual(new THREE.Vector3().setFromMatrixScale(matrix).toArray(), [0, 0, 0]);
  batch.getMatrixAt(1, matrix);
  assert.deepEqual(new THREE.Vector3().setFromMatrixPosition(matrix).toArray(), [3, 0, 0]);

  result.setVisible('first', true);
  batch.getMatrixAt(0, matrix);
  assert.deepEqual(new THREE.Vector3().setFromMatrixPosition(matrix).toArray(), [1, 0, 0]);
});
