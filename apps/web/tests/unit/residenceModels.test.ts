import assert from 'node:assert/strict';
import test from 'node:test';
import * as THREE from 'three';
import type { MeshHelpers } from '../../src/rendering/meshFactory';
import { createResidenceKit } from '../../src/rendering/residence/residenceKit';
import {
  createResidenceModel,
  RESIDENCE_STYLE_COUNT,
  residenceStyleFor,
  residenceStyleSeedForLot,
} from '../../src/rendering/residenceStyles';

// Stub factory: the real renderer supplies pooled materials/textures, but the
// model builders only need a mesh sink. This exercises every geometry path
// (boxes, cylinders, icosahedra, extrude roofs) in plain Node.
const material = new THREE.MeshStandardMaterial();
const part: MeshHelpers['part'] = (group, geometry, _material, position, shadow) => {
  const mesh = new THREE.Mesh(geometry, material);
  if (position) mesh.position.set(position[0], position[1], position[2]);
  mesh.castShadow = shadow ?? true;
  if (group) group.add(mesh);
  return mesh;
};

function countMeshes(root: THREE.Object3D): number {
  let count = 0;
  root.traverse((object) => {
    if ((object as THREE.Mesh).isMesh) count += 1;
  });
  return count;
}

test('every residence style builds real geometry without throwing', () => {
  const built = new Map<number, { meshes: number; name: string; body: THREE.Mesh }>();
  for (let x = -39; x <= 39 && built.size < RESIDENCE_STYLE_COUNT; x += 3) {
    for (let z = -39; z <= 39 && built.size < RESIDENCE_STYLE_COUNT; z += 3) {
      const seed = residenceStyleSeedForLot(x, z);
      const style = residenceStyleFor(x, z, seed);
      if (built.has(style)) continue;
      const model = createResidenceModel({
        x,
        z,
        variationSeed: seed,
        lotType: ((x + z) % 3 + 3) % 3,
        isNight: (x + z) % 2 === 0,
        part,
      });
      assert.ok(model.body instanceof THREE.Mesh, `style ${style} must expose a body mesh`);
      assert.equal(model.styleId, style);
      const meshes = countMeshes(model.group);
      assert.ok(meshes > 25, `style ${style} only produced ${meshes} meshes`);
      assert.ok(model.styleName.length > 0);
      built.set(style, { meshes, name: model.styleName, body: model.body });
    }
  }
  assert.equal(built.size, RESIDENCE_STYLE_COUNT);

  // Names encode family + archetype, so all 64 combinations are distinct.
  const names = new Set([...built.values()].map((entry) => entry.name));
  assert.equal(names.size, RESIDENCE_STYLE_COUNT);

  // Detail budget guard: raises an alarm if a future change silently strips the
  // facade / yard detail back down to a bare box.
  const counts = [...built.values()].map((entry) => entry.meshes);
  const average = counts.reduce((sum, value) => sum + value, 0) / counts.length;
  assert.ok(average > 40, `average residence detail dropped to ${average.toFixed(1)} meshes`);
});

test('gable ridge cap follows the ridge axis instead of crossing the slopes', () => {  const meshes: THREE.Mesh[] = [];
  const capPart: MeshHelpers['part'] = (group, geometry, _material, position) => {
    const mesh = new THREE.Mesh(geometry, material);
    meshes.push(mesh);
    if (position) mesh.position.set(position[0], position[1], position[2]);
    if (group) group.add(mesh);
    return mesh;
  };
  const kit = createResidenceKit({ part: capPart, isNight: false });
  const run = 2;
  const overhang = 0.14;
  for (const axis of ['z', 'x'] as const) {
    meshes.length = 0;
    const group = new THREE.Group();
    kit.gableRoof(group, { y: 0, run, span: 1.2, height: 0.4, color: 0x556677, axis });
    const cap = meshes.find((mesh) => mesh.geometry.type === 'BoxGeometry');
    assert.ok(cap, `${axis} roof must add a ridge cap`);
    const box = cap.geometry as THREE.BoxGeometry;
    assert.ok(
      Math.abs(box.parameters.depth - (run + overhang * 2)) < 1e-6,
      `${axis} ridge cap must span the run (${box.parameters.depth})`,
    );
    const expected = axis === 'x' ? Math.PI / 2 : 0;
    assert.ok(Math.abs(cap.rotation.y - expected) < 1e-6, `${axis} ridge cap rotation`);
  }
});

type FaceTri = {
  a: THREE.Vector3;
  b: THREE.Vector3;
  c: THREE.Vector3;
  n: THREE.Vector3;
  d: number;
  mesh: THREE.Mesh;
};

function trianglesIn(model: THREE.Object3D): { meshes: THREE.Mesh[]; tris: FaceTri[] } {
  const meshes: THREE.Mesh[] = [];
  const tris: FaceTri[] = [];
  model.updateMatrixWorld(true);
  model.traverse((object) => {
    const mesh = object as THREE.Mesh;
    if (!mesh.isMesh) return;
    meshes.push(mesh);
    const geometry = mesh.geometry;
    const position = geometry.attributes.position;
    if (!position) return;
    const index = geometry.index;
    const vertex = (i: number) => new THREE.Vector3().fromBufferAttribute(position, i).applyMatrix4(mesh.matrixWorld);
    const count = index ? index.count : position.count;
    for (let i = 0; i < count; i += 3) {
      const a = vertex(index ? index.getX(i) : i);
      const b = vertex(index ? index.getX(i + 1) : i + 1);
      const c = vertex(index ? index.getX(i + 2) : i + 2);
      const n = new THREE.Vector3().subVectors(b, a).cross(new THREE.Vector3().subVectors(c, a));
      if (n.lengthSq() < 1e-12) continue;
      n.normalize();
      tris.push({ a, b, c, n, d: n.dot(a), mesh });
    }
  });
  return { meshes, tris };
}

function overlaps2D(A: [number, number][], B: [number, number][]): boolean {
  const separates = (P: [number, number][], Q: [number, number][]) => {
    for (let i = 0; i < 3; i += 1) {
      const p = P[i]!;
      const q = P[(i + 1) % 3]!;
      const nx = -(q[1] - p[1]);
      const ny = q[0] - p[0];
      let minA = Infinity;
      let maxA = -Infinity;
      let minB = Infinity;
      let maxB = -Infinity;
      for (const value of P) {
        const projected = value[0] * nx + value[1] * ny;
        minA = Math.min(minA, projected);
        maxA = Math.max(maxA, projected);
      }
      for (const value of Q) {
        const projected = value[0] * nx + value[1] * ny;
        minB = Math.min(minB, projected);
        maxB = Math.max(maxB, projected);
      }
      if (maxA < minB + 1e-4 || maxB < minA + 1e-4) return false;
    }
    return true;
  };
  return separates(A, B) && separates(B, A);
}

// Same-normal faces sitting on one plane (or within 2mm) fight for the depth
// buffer even if the meshes are distinct. Build all 64 styles, keep only pairs
// whose shared plane is reachable from outside, and require none.
test('no residence style has visible coplanar faces', () => {
  const violations: string[] = [];
  const built = new Set<number>();
  const ray = new THREE.Raycaster();

  for (let x = -39; x <= 39 && built.size < RESIDENCE_STYLE_COUNT && violations.length === 0; x += 3) {
    for (let z = -39; z <= 39 && built.size < RESIDENCE_STYLE_COUNT && violations.length === 0; z += 3) {
      const seed = residenceStyleSeedForLot(x, z);
      const style = residenceStyleFor(x, z, seed);
      if (built.has(style)) continue;
      built.add(style);
      const model = createResidenceModel({
        x,
        z,
        variationSeed: seed,
        lotType: ((x + z) % 3 + 3) % 3,
        isNight: false,
        part,
      });
      const { meshes, tris } = trianglesIn(model.group);
      const buckets = new Map<string, FaceTri[]>();
      for (const tri of tris) {
        const key = `${Math.round(tri.n.x * 1000)},${Math.round(tri.n.y * 1000)},${Math.round(tri.n.z * 1000)},${Math.round(tri.d / 0.002)}`;
        const bucket = buckets.get(key) ?? [];
        bucket.push(tri);
        buckets.set(key, bucket);
      }
      for (const bucket of buckets.values()) {
        for (let i = 0; i < bucket.length && violations.length === 0; i += 1) {
          for (let j = i + 1; j < bucket.length; j += 1) {
            const A = bucket[i]!;
            const B = bucket[j]!;
            if (A.mesh === B.mesh || Math.abs(A.d - B.d) > 0.002) continue;
            const helper = Math.abs(A.n.x) < 0.9 ? new THREE.Vector3(1, 0, 0) : new THREE.Vector3(0, 1, 0);
            const u = new THREE.Vector3().crossVectors(A.n, helper).normalize();
            const v = new THREE.Vector3().crossVectors(A.n, u).normalize();
            const project = (point: THREE.Vector3): [number, number] => [point.dot(u), point.dot(v)];
            if (!overlaps2D([project(A.a), project(A.b), project(A.c)], [project(B.a), project(B.b), project(B.c)])) continue;
            const middle = new THREE.Vector3().add(A.a).add(A.b).add(A.c).multiplyScalar(1 / 3);
            ray.set(middle.clone().addScaledVector(A.n, 8), A.n.clone().multiplyScalar(-1));
            const hits = ray.intersectObjects(meshes, false);
            if (hits.length === 0) continue;
            const first = hits[0]!.distance;
            const nearest = new Set(hits.filter((hit) => Math.abs(hit.distance - first) < 0.004).map((hit) => hit.object));
            if (!nearest.has(A.mesh) || !nearest.has(B.mesh)) continue;
            violations.push(
              `style ${style} ${model.styleName}: ${A.mesh.geometry.type} vs ${B.mesh.geometry.type} at ` +
                `n=(${A.n.x.toFixed(2)},${A.n.y.toFixed(2)},${A.n.z.toFixed(2)}) d=${A.d.toFixed(3)}`,
            );
          }
        }
      }
    }
  }

  assert.equal(built.size, RESIDENCE_STYLE_COUNT);
  assert.deepEqual(violations, []);
});
