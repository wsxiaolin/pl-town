import * as THREE from 'three';

export type StaticMeshBatchResult = {
  batches: number;
  sourceMeshes: number;
};

export type RetainedStaticMeshRoot = {
  key: string;
  root: THREE.Object3D;
};

export type RetainedStaticMeshBatch = StaticMeshBatchResult & {
  setVisible: (key: string, visible: boolean) => void;
};

type BatchGroup = {
  geometry: THREE.BufferGeometry;
  material: THREE.Material;
  castShadow: boolean;
  receiveShadow: boolean;
  renderOrder: number;
  meshes: THREE.Mesh[];
};

const BATCH_CELL_SIZE = 18;
const hiddenInstanceMatrix = new THREE.Matrix4().makeScale(0, 0, 0);

function canBatch(mesh: THREE.Mesh): boolean {
  if (mesh instanceof THREE.InstancedMesh || mesh instanceof THREE.SkinnedMesh) return false;
  if (Array.isArray(mesh.material) || mesh.material.transparent) return false;
  if (mesh.morphTargetInfluences?.length) return false;
  return Object.keys(mesh.userData).length === 0;
}

export function batchStaticMeshes(
  scene: THREE.Scene,
  roots: readonly THREE.Object3D[],
  excludedRoots: ReadonlySet<THREE.Object3D> = new Set(),
): StaticMeshBatchResult {
  scene.updateMatrixWorld(true);
  const groups = new Map<string, BatchGroup>();

  for (const root of roots) {
    if (excludedRoots.has(root)) continue;
    root.traverse((object) => {
      if (!(object instanceof THREE.Mesh) || !canBatch(object)) return;
      const material = object.material as THREE.Material;
      const worldElements = object.matrixWorld.elements;
      const cellX = Math.floor(worldElements[12]! / BATCH_CELL_SIZE);
      const cellZ = Math.floor(worldElements[14]! / BATCH_CELL_SIZE);
      const key = [
        object.geometry.uuid,
        material.uuid,
        cellX,
        cellZ,
        object.castShadow ? 1 : 0,
        object.receiveShadow ? 1 : 0,
        object.renderOrder,
      ].join(':');
      let group = groups.get(key);
      if (!group) {
        group = {
          geometry: object.geometry,
          material,
          castShadow: object.castShadow,
          receiveShadow: object.receiveShadow,
          renderOrder: object.renderOrder,
          meshes: [],
        };
        groups.set(key, group);
      }
      group.meshes.push(object);
    });
  }

  let batches = 0;
  let sourceMeshes = 0;
  for (const group of groups.values()) {
    if (group.meshes.length < 2) continue;
    const batch = new THREE.InstancedMesh(group.geometry, group.material, group.meshes.length);
    batch.name = `static-decoration-batch:${batches}`;
    batch.castShadow = group.castShadow;
    batch.receiveShadow = group.receiveShadow;
    batch.renderOrder = group.renderOrder;
    batch.instanceMatrix.setUsage(THREE.StaticDrawUsage);
    batch.userData.staticDecorationBatch = true;
    for (let index = 0; index < group.meshes.length; index += 1) {
      batch.setMatrixAt(index, group.meshes[index]!.matrixWorld);
    }
    batch.instanceMatrix.needsUpdate = true;
    batch.computeBoundingBox();
    batch.computeBoundingSphere();
    scene.add(batch);
    for (const mesh of group.meshes) mesh.removeFromParent();
    batches += 1;
    sourceMeshes += group.meshes.length;
  }

  return { batches, sourceMeshes };
}

/**
 * Batches static visuals while retaining their source meshes for raycasting and
 * stateful presentation changes. Retained source meshes stay in their original
 * hierarchy but remain hidden from the renderer.
 */
export function batchRetainedStaticMeshes(
  scene: THREE.Scene,
  roots: readonly RetainedStaticMeshRoot[],
): RetainedStaticMeshBatch {
  scene.updateMatrixWorld(true);
  const groups = new Map<string, BatchGroup & { keys: string[] }>();

  for (const { key: rootKey, root } of roots) {
    root.traverse((object) => {
      if (!(object instanceof THREE.Mesh) || object instanceof THREE.InstancedMesh || object instanceof THREE.SkinnedMesh) return;
      if (Array.isArray(object.material) || object.material.transparent || object.morphTargetInfluences?.length) return;
      const material = object.material as THREE.Material;
      const worldElements = object.matrixWorld.elements;
      const cellX = Math.floor(worldElements[12]! / BATCH_CELL_SIZE);
      const cellZ = Math.floor(worldElements[14]! / BATCH_CELL_SIZE);
      const batchKey = [
        object.geometry.uuid,
        material.uuid,
        cellX,
        cellZ,
        object.castShadow ? 1 : 0,
        object.receiveShadow ? 1 : 0,
        object.renderOrder,
      ].join(':');
      let group = groups.get(batchKey);
      if (!group) {
        group = {
          geometry: object.geometry,
          material,
          castShadow: object.castShadow,
          receiveShadow: object.receiveShadow,
          renderOrder: object.renderOrder,
          meshes: [],
          keys: [],
        };
        groups.set(batchKey, group);
      }
      group.meshes.push(object);
      group.keys.push(rootKey);
    });
  }

  const instancesByKey = new Map<string, Array<{ batch: THREE.InstancedMesh; index: number; matrix: THREE.Matrix4 }>>();
  let batches = 0;
  let sourceMeshes = 0;
  for (const group of groups.values()) {
    if (group.meshes.length < 2) continue;
    const batch = new THREE.InstancedMesh(group.geometry, group.material, group.meshes.length);
    batch.name = `retained-static-batch:${batches}`;
    batch.castShadow = group.castShadow;
    batch.receiveShadow = group.receiveShadow;
    batch.renderOrder = group.renderOrder;
    batch.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    batch.userData.retainedStaticBatch = true;
    for (let index = 0; index < group.meshes.length; index += 1) {
      const mesh = group.meshes[index]!;
      const matrix = mesh.matrixWorld.clone();
      batch.setMatrixAt(index, matrix);
      mesh.visible = false;
      const key = group.keys[index]!;
      const instances = instancesByKey.get(key) ?? [];
      instances.push({ batch, index, matrix });
      instancesByKey.set(key, instances);
    }
    batch.instanceMatrix.needsUpdate = true;
    batch.computeBoundingBox();
    batch.computeBoundingSphere();
    scene.add(batch);
    batches += 1;
    sourceMeshes += group.meshes.length;
  }

  return {
    batches,
    sourceMeshes,
    setVisible(key, visible) {
      const changedBatches = new Set<THREE.InstancedMesh>();
      for (const instance of instancesByKey.get(key) ?? []) {
        instance.batch.setMatrixAt(instance.index, visible ? instance.matrix : hiddenInstanceMatrix);
        changedBatches.add(instance.batch);
      }
      for (const batch of changedBatches) batch.instanceMatrix.needsUpdate = true;
    },
  };
}
