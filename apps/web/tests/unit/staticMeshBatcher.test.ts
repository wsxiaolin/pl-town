import assert from 'node:assert/strict';
import test from 'node:test';
import * as THREE from 'three';
import { ResourcePool } from '../../src/core/ResourcePool';
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
  const resources = new ResourcePool();
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
  ], resources);
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

test('retained batches share unit primitives across dimensions and former spatial cells', () => {
  const scene = new THREE.Scene();
  const resources = new ResourcePool();
  const material = new THREE.MeshBasicMaterial({ color: 0xffffff });
  const firstRoot = new THREE.Group();
  const secondRoot = new THREE.Group();
  const first = new THREE.Mesh(new THREE.BoxGeometry(2, 4, 6), material);
  const second = new THREE.Mesh(new THREE.BoxGeometry(3, 5, 7), material);
  firstRoot.add(first);
  secondRoot.add(second);
  firstRoot.position.x = 1;
  secondRoot.position.x = 100;
  scene.add(firstRoot, secondRoot);

  const result = batchRetainedStaticMeshes(scene, [
    { key: 'first', root: firstRoot },
    { key: 'second', root: secondRoot },
  ], resources);
  const batch = scene.children.find((child): child is THREE.InstancedMesh => child instanceof THREE.InstancedMesh)!;
  const matrix = new THREE.Matrix4();

  assert.deepEqual({ batches: result.batches, sourceMeshes: result.sourceMeshes }, { batches: 1, sourceMeshes: 2 });
  assert.deepEqual((batch.geometry as THREE.BoxGeometry).parameters, {
    width: 1,
    height: 1,
    depth: 1,
    widthSegments: 1,
    heightSegments: 1,
    depthSegments: 1,
  });
  batch.getMatrixAt(0, matrix);
  assert.deepEqual(new THREE.Vector3().setFromMatrixScale(matrix).toArray(), [2, 4, 6]);
  batch.getMatrixAt(1, matrix);
  assert.deepEqual(new THREE.Vector3().setFromMatrixScale(matrix).toArray(), [3, 5, 7]);
  assert.deepEqual(new THREE.Vector3().setFromMatrixPosition(matrix).toArray(), [100, 0, 0]);
});

test('dispose removes batches and restores the original meshes', () => {
  const scene = new THREE.Scene();
  const resources = new ResourcePool();
  const material = new THREE.MeshBasicMaterial({ color: 0xffffff });
  const root = new THREE.Group();
  const first = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), material);
  const second = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), material);
  first.position.x = 1;
  second.position.x = 2;
  root.add(first, second);
  scene.add(root);

  const result = batchRetainedStaticMeshes(scene, [{ key: 'root', root }], resources);
  assert.equal(first.visible, false);

  result.dispose();

  assert.equal(scene.children.filter((child) => child instanceof THREE.InstancedMesh).length, 0);
  assert.equal(first.visible, true);
  assert.equal(second.visible, true);
});

test('tracked roots hide their instances while the root itself is hidden', () => {
  const scene = new THREE.Scene();
  const resources = new ResourcePool();
  const material = new THREE.MeshBasicMaterial({ color: 0xffffff });
  const roof = new THREE.Group();
  const first = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), material);
  const second = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), material);
  first.position.x = 1;
  second.position.x = 2;
  roof.add(first, second);
  const wall = new THREE.Group();
  const third = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), material);
  const fourth = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), material);
  third.position.x = 3;
  fourth.position.x = 4;
  wall.add(third, fourth);
  scene.add(roof, wall);

  const result = batchRetainedStaticMeshes(scene, [
    { key: 'roof', root: roof },
    { key: 'wall', root: wall },
  ], resources, { trackRootVisibility: true });
  const matrix = new THREE.Matrix4();
  const instanceScales = () => scene.children
    .filter((child): child is THREE.InstancedMesh => child instanceof THREE.InstancedMesh)
    .flatMap((instance) => Array.from({ length: instance.count }, (_, index) => {
      instance.getMatrixAt(index, matrix);
      return new THREE.Vector3().setFromMatrixScale(matrix).x;
    }));
  // Instance order follows traversal: roof meshes first, then wall meshes.
  const hidden = [0, 0, 1, 1];
  const shown = [1, 1, 1, 1];

  roof.visible = false;
  result.syncRootVisibility();
  assert.deepEqual(instanceScales(), hidden);

  roof.visible = true;
  result.syncRootVisibility();
  assert.deepEqual(instanceScales(), shown);
});

test('disposing a replaced batch keeps the meshes the replacement took over hidden', () => {
  const scene = new THREE.Scene();
  const resources = new ResourcePool();
  const material = new THREE.MeshBasicMaterial({ color: 0xffffff });
  const root = new THREE.Group();
  const meshes = [1, 2, 3].map((x) => {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), material);
    mesh.position.x = x;
    root.add(mesh);
    return mesh;
  });
  scene.add(root);
  const roots = [{ key: 'root', root }];

  // Rebuild order mirrors cityConstructionScene.rebuildDecorationBatch: the
  // replacement batch is built first, the previous one is disposed afterwards.
  const first = batchRetainedStaticMeshes(scene, roots, resources);
  const second = batchRetainedStaticMeshes(scene, roots, resources);
  first.dispose();

  for (const mesh of meshes) assert.equal(mesh.visible, false);
  assert.equal(scene.children.filter((child) => child instanceof THREE.InstancedMesh).length, 1);

  second.dispose();
  for (const mesh of meshes) assert.equal(mesh.visible, true);
  assert.equal(scene.children.filter((child) => child instanceof THREE.InstancedMesh).length, 0);
});

test('excluded meshes stay out of retained batches', () => {
  const scene = new THREE.Scene();
  const resources = new ResourcePool();
  const material = new THREE.MeshBasicMaterial({ color: 0xffffff });
  const root = new THREE.Group();
  const roof = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), material);
  roof.userData.echoInteriorRoof = true;
  const ceiling = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), material);
  ceiling.position.x = 1;
  ceiling.userData.echoInteriorCeiling = true;
  const wall = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), material);
  wall.position.x = 2;
  const trim = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), material);
  trim.position.x = 3;
  root.add(roof, ceiling, wall, trim);
  scene.add(root);

  const result = batchRetainedStaticMeshes(scene, [{ key: 'interior', root }], resources, {
    excludeMesh: (mesh) => mesh.userData.echoInteriorRoof === true
      || mesh.userData.echoInteriorCeiling === true,
  });

  assert.equal(result.sourceMeshes, 2);
  assert.equal(result.batches, 1);
  assert.equal(roof.visible, true);
  assert.equal(ceiling.visible, true);
  assert.equal(wall.visible, false);
  assert.equal(trim.visible, false);
});

test('retained batches honour the parent option and stay out of the scene root', () => {
  const scene = new THREE.Scene();
  const resources = new ResourcePool();
  const material = new THREE.MeshBasicMaterial({ color: 0xffffff });
  const container = new THREE.Group();
  const root = new THREE.Group();
  const first = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), material);
  const second = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), material);
  first.position.x = 1;
  second.position.x = 2;
  root.add(first, second);
  container.add(root);
  scene.add(container);

  const result = batchRetainedStaticMeshes(scene, [{ key: 'root', root }], resources, { parent: container });

  assert.equal(result.batches, 1);
  assert.equal(container.children.filter((child) => child instanceof THREE.InstancedMesh).length, 1);
  assert.equal(scene.children.filter((child) => child instanceof THREE.InstancedMesh).length, 0);
});
