// On-demand diagnostics: instantiate every residence archetype/family headlessly
// with a stub mesh factory so we can catch runtime errors in the model builders
// and watch the per-house mesh budget. Not part of the Playwright suite.
//
// Run from the repo root:
//   npx tsx apps/web/tests/diagnostics/residence-mesh-count.ts
import * as THREE from 'three';
import {
  createResidenceModel,
  RESIDENCE_STYLE_COUNT,
  residenceStyleFor,
  residenceStyleSeedForLot,
} from '../../src/rendering/residence/index';
import type { MeshHelpers } from '../../src/rendering/meshFactory';

// Material pooling mirrors the real ResourcePool so the merged mesh count is
// representative of what the browser will actually draw.
const materialPool = new Map<unknown, THREE.Material>();
const stubPart: MeshHelpers['part'] = (group, geometry, material, position) => {
  const key = (material as THREE.Material).isMaterial ? material : JSON.stringify(material);
  let pooled = materialPool.get(key);
  if (!pooled) {
    pooled = new THREE.MeshStandardMaterial({ color: 0xffffff });
    materialPool.set(key, pooled);
  }
  const mesh = new THREE.Mesh(geometry, pooled);
  if (position) mesh.position.set(position[0], position[1], position[2]);
  if (group) group.add(mesh);
  return mesh;
};

// Style coverage on the same dense grid the unit test uses.
const styles = new Set<number>();
for (let x = -39; x <= 39; x += 3) {
  for (let z = -39; z <= 39; z += 3) {
    styles.add(residenceStyleFor(x, z, residenceStyleSeedForLot(x, z)));
  }
}

// Mesh budget on a representative sample.
let totalMeshes = 0;
let houses = 0;
let minMeshes = Number.POSITIVE_INFINITY;
let maxMeshes = 0;
const perArchetype = new Map<number, { count: number; sum: number; max: number }>();

for (let xi = 0; xi < 14; xi += 1) {
  for (let zi = 0; zi < 14; zi += 1) {
    const x = xi * 5 - 33;
    const z = zi * 5 - 33;
    const seed = Math.abs(Math.round(x * 31 + z));
    const model = createResidenceModel({
      x,
      z,
      variationSeed: seed,
      lotType: (xi + zi) % 3,
      isNight: (xi + zi) % 2 === 0,
      part: stubPart,
    });
    let meshes = 0;
    model.group.traverse((object) => {
      if ((object as THREE.Mesh).isMesh) meshes += 1;
    });
    totalMeshes += meshes;
    houses += 1;
    minMeshes = Math.min(minMeshes, meshes);
    maxMeshes = Math.max(maxMeshes, meshes);
    const archetype = model.styleId % 8;
    const entry = perArchetype.get(archetype) ?? { count: 0, sum: 0, max: 0 };
    entry.count += 1;
    entry.sum += meshes;
    entry.max = Math.max(entry.max, meshes);
    perArchetype.set(archetype, entry);
  }
}

console.log(`styles seen: ${styles.size} / ${RESIDENCE_STYLE_COUNT}`);
console.log(`houses: ${houses}`);
console.log(`meshes/house (raw, before static instancing): min ${minMeshes}, avg ${(totalMeshes / houses).toFixed(1)}, max ${maxMeshes}`);
for (const [archetype, entry] of [...perArchetype.entries()].sort((a, b) => a[0] - b[0])) {
  console.log(`  archetype ${archetype}: avg ${(entry.sum / entry.count).toFixed(1)}, max ${entry.max}`);
}
if (styles.size !== RESIDENCE_STYLE_COUNT) {
  throw new Error(`expected ${RESIDENCE_STYLE_COUNT} styles, saw ${styles.size}`);
}
