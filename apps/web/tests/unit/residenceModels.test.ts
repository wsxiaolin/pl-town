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

test('gable ridge cap follows the ridge axis instead of crossing the slopes', () => {
  const meshes: THREE.Mesh[] = [];
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
