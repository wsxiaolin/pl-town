import * as THREE from 'three';
import type { ResourcePool } from '../core/ResourcePool';

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
  /** Re-derives instance visibility from each root's live `visible` chain. */
  syncRootVisibility: () => void;
  /** Removes the generated instances and restores original mesh visibility. */
  dispose: () => void;
};

/** Meshes kept out of retained batches because gameplay toggles them directly. */
export type RetainedStaticMeshOptions = {
  excludeMesh?: (mesh: THREE.Mesh) => boolean;
  /** Destination for generated batches; defaults to the scene root. */
  parent?: THREE.Object3D;
  /**
   * Leaves generated instances visible only while `key` is visible. Retained
   * batches hide their source meshes, so a root that can be hidden at runtime
   * would otherwise keep drawing through the batch.
   */
  trackRootVisibility?: boolean;
};

type BatchGroup = {
  geometry: THREE.BufferGeometry;
  material: THREE.Material;
  castShadow: boolean;
  receiveShadow: boolean;
  renderOrder: number;
  meshes: THREE.Mesh[];
  /** Per-mesh local scale used when a primitive was canonicalized to a unit shape. */
  scales?: Array<[number, number, number] | null>;
};

const BATCH_CELL_SIZE = 18;
const hiddenInstanceMatrix = new THREE.Matrix4().makeScale(0, 0, 0);

/** True when `root` and every ancestor up to (excluding) `stop` are visible. */
function hasVisibleAncestor(root: THREE.Object3D | undefined, stop: THREE.Object3D): boolean {
  for (let node: THREE.Object3D | null = root ?? null; node && node !== stop; node = node.parent) {
    if (!node.visible) return false;
  }
  return true;
}

type CanonicalStaticGeometry = {
  geometry: THREE.BufferGeometry;
  scale: [number, number, number] | null;
};

function cachedCanonicalGeometry(
  cache: Map<string, THREE.BufferGeometry>,
  resources: ResourcePool,
  key: string,
  create: () => THREE.BufferGeometry,
): THREE.BufferGeometry {
  let geometry = cache.get(key);
  if (!geometry) {
    geometry = resources.geometry(create());
    cache.set(key, geometry);
  }
  return geometry;
}

/**
 * Replaces residence primitives with shared unit geometry so instance
 * matrices can carry their dimensions. Without this, every generated size
 * became a separate draw call despite sharing its material and shader.
 */
function canonicalizeStaticGeometry(
  geometry: THREE.BufferGeometry,
  cache: Map<string, THREE.BufferGeometry>,
  resources: ResourcePool,
): CanonicalStaticGeometry {
  const parameters = (geometry as THREE.BufferGeometry & {
    parameters?: Record<string, number | boolean>;
  }).parameters;
  if (!parameters) return { geometry, scale: null };

  switch (geometry.type) {
    case 'BoxGeometry': {
      const widthSegments = Number(parameters.widthSegments ?? 1);
      const heightSegments = Number(parameters.heightSegments ?? 1);
      const depthSegments = Number(parameters.depthSegments ?? 1);
      return {
        geometry: cachedCanonicalGeometry(
          cache,
          resources,
          `box:${widthSegments}:${heightSegments}:${depthSegments}`,
          () => new THREE.BoxGeometry(1, 1, 1, widthSegments, heightSegments, depthSegments),
        ),
        scale: [Number(parameters.width), Number(parameters.height), Number(parameters.depth)],
      };
    }
    case 'CylinderGeometry': {
      const radiusBottom = Number(parameters.radiusBottom);
      const radiusTop = Number(parameters.radiusTop);
      if (!(radiusBottom > 0)) return { geometry, scale: null };
      const radialSegments = Number(parameters.radialSegments ?? 8);
      const heightSegments = Number(parameters.heightSegments ?? 1);
      const openEnded = Boolean(parameters.openEnded);
      const thetaStart = Number(parameters.thetaStart ?? 0);
      const thetaLength = Number(parameters.thetaLength ?? Math.PI * 2);
      const ratio = radiusTop / radiusBottom;
      return {
        geometry: cachedCanonicalGeometry(
          cache,
          resources,
          `cyl:${ratio}:${radialSegments}:${heightSegments}:${openEnded}:${thetaStart}:${thetaLength}`,
          () => new THREE.CylinderGeometry(ratio, 1, 1, radialSegments, heightSegments, openEnded, thetaStart, thetaLength),
        ),
        scale: [radiusBottom, Number(parameters.height), radiusBottom],
      };
    }
    case 'ConeGeometry': {
      const radialSegments = Number(parameters.radialSegments ?? 8);
      const heightSegments = Number(parameters.heightSegments ?? 1);
      const openEnded = Boolean(parameters.openEnded);
      const thetaStart = Number(parameters.thetaStart ?? 0);
      const thetaLength = Number(parameters.thetaLength ?? Math.PI * 2);
      return {
        geometry: cachedCanonicalGeometry(
          cache,
          resources,
          `cone:${radialSegments}:${heightSegments}:${openEnded}:${thetaStart}:${thetaLength}`,
          () => new THREE.ConeGeometry(1, 1, radialSegments, heightSegments, openEnded, thetaStart, thetaLength),
        ),
        scale: [Number(parameters.radius), Number(parameters.height), Number(parameters.radius)],
      };
    }
    case 'IcosahedronGeometry': {
      const detail = Number(parameters.detail ?? 0);
      const radius = Number(parameters.radius);
      return {
        geometry: cachedCanonicalGeometry(cache, resources, `ico:${detail}`, () => new THREE.IcosahedronGeometry(1, detail)),
        scale: [radius, radius, radius],
      };
    }
    case 'SphereGeometry': {
      const radius = Number(parameters.radius);
      if (!(radius > 0)) return { geometry, scale: null };
      const widthSegments = Number(parameters.widthSegments ?? 8);
      const heightSegments = Number(parameters.heightSegments ?? 6);
      const phiStart = Number(parameters.phiStart ?? 0);
      const phiLength = Number(parameters.phiLength ?? Math.PI * 2);
      const thetaStart = Number(parameters.thetaStart ?? 0);
      const thetaLength = Number(parameters.thetaLength ?? Math.PI);
      return {
        geometry: cachedCanonicalGeometry(
          cache,
          resources,
          `sphere:${widthSegments}:${heightSegments}:${phiStart}:${phiLength}:${thetaStart}:${thetaLength}`,
          () => new THREE.SphereGeometry(1, widthSegments, heightSegments, phiStart, phiLength, thetaStart, thetaLength),
        ),
        scale: [radius, radius, radius],
      };
    }
    default:
      return { geometry, scale: null };
  }
}

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
  resources: ResourcePool,
  options: RetainedStaticMeshOptions = {},
): RetainedStaticMeshBatch {
  scene.updateMatrixWorld(true);
  const groups = new Map<string, BatchGroup & { keys: string[] }>();
  const canonicalGeometryCache = new Map<string, THREE.BufferGeometry>();
  const parent = options.parent ?? scene;
  const rootByKey = new Map<string, THREE.Object3D>();

  for (const { key: rootKey, root } of roots) {
    rootByKey.set(rootKey, root);
    root.traverse((object) => {
      if (!(object instanceof THREE.Mesh) || object instanceof THREE.InstancedMesh || object instanceof THREE.SkinnedMesh) return;
      if (Array.isArray(object.material) || object.material.transparent || object.morphTargetInfluences?.length) return;
      if (options.excludeMesh?.(object)) return;
      const material = object.material as THREE.Material;
      // Primitive pieces share unit geometry; each original size is carried by
      // its instance matrix so generated dimensions can join the same batch.
      const canonical = canonicalizeStaticGeometry(object.geometry, canonicalGeometryCache, resources);
      const batchKey = [
        canonical.geometry.uuid,
        material.uuid,
        object.castShadow ? 1 : 0,
        object.receiveShadow ? 1 : 0,
        object.renderOrder,
      ].join(':');
      let group = groups.get(batchKey);
      if (!group) {
        group = {
          geometry: canonical.geometry,
          material,
          castShadow: object.castShadow,
          receiveShadow: object.receiveShadow,
          renderOrder: object.renderOrder,
          meshes: [],
          scales: [],
          keys: [],
        };
        groups.set(batchKey, group);
      }
      group.meshes.push(object);
      group.scales?.push(canonical.scale);
      group.keys.push(rootKey);
    });
  }

  const instancesByKey = new Map<string, Array<{ batch: THREE.InstancedMesh; index: number; matrix: THREE.Matrix4 }>>();
  const hiddenKeys = new Set<string>();
  const scaleMatrix = new THREE.Matrix4();
  const createdBatches: THREE.InstancedMesh[] = [];
  const hiddenMeshes: THREE.Mesh[] = [];
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
      const scale = group.scales?.[index];
      if (scale) matrix.multiply(scaleMatrix.makeScale(scale[0], scale[1], scale[2]));
      const key = group.keys[index]!;
      // Batch creation already respects a root that is hidden right now.
      const hidden = options.trackRootVisibility === true
        && !hasVisibleAncestor(rootByKey.get(key)!, parent);
      batch.setMatrixAt(index, hidden ? hiddenInstanceMatrix : matrix);
      mesh.visible = false;
      hiddenMeshes.push(mesh);
      const instances = instancesByKey.get(key) ?? [];
      instances.push({ batch, index, matrix });
      instancesByKey.set(key, instances);
      if (hidden) hiddenKeys.add(key);
    }
    batch.instanceMatrix.needsUpdate = true;
    batch.computeBoundingBox();
    batch.computeBoundingSphere();
    parent.add(batch);
    createdBatches.push(batch);
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
      if (visible) hiddenKeys.delete(key);
      else hiddenKeys.add(key);
      for (const batch of changedBatches) batch.instanceMatrix.needsUpdate = true;
    },
    /**
     * Re-derives instance visibility from the live `visible` chain of every
     * root. Interior scenes hide whole roots (roof, ceiling) at runtime; without
     * this the hidden meshes would keep drawing through the batch.
     */
    syncRootVisibility() {
      if (options.trackRootVisibility !== true) return;
      for (const [key, root] of rootByKey) {
        if (!instancesByKey.has(key)) continue;
        const visible = hasVisibleAncestor(root, parent);
        if (visible === !hiddenKeys.has(key)) continue;
        this.setVisible(key, visible);
      }
    },
    dispose() {
      for (const batch of createdBatches) {
        batch.removeFromParent();
        batch.dispose();
      }
      for (const mesh of hiddenMeshes) mesh.visible = true;
      createdBatches.length = 0;
      hiddenMeshes.length = 0;
      instancesByKey.clear();
      hiddenKeys.clear();
    },
  };
}
