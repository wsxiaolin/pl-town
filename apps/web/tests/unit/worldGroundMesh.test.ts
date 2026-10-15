import assert from 'node:assert/strict';
import test from 'node:test';
import * as THREE from 'three';
import { LANPING_RANGE } from '../../src/city/data/terrain/range-lanping';
import { buildAlpineRangeGeometry, createAlpineRangeField } from '../../src/rendering/terrain/alpineRangeGeometry';
import { createWorldGroundGeometry, WORLD_GROUND_GRASS_COLOR } from '../../src/rendering/terrain/worldGroundMesh';
import { terrainHeight } from '../../src/city/data/terrain/heightfield/terrainHeight';

test('world cells exclude alpine bounds and share exact flat, colored perimeter vertices', () => {
  const field = createAlpineRangeField(LANPING_RANGE);
  const { x0, x1, z0, z1 } = field.bounds;
  const world = createWorldGroundGeometry();
  const positions = world.getAttribute('position');
  const colors = world.getAttribute('color');
  const index = world.getIndex()!;
  const grass = new THREE.Color(WORLD_GROUND_GRASS_COLOR);
  const vertices = new Map<string, number>();
  for (let i = 0; i < positions.count; i++) vertices.set(`${positions.getX(i)}:${positions.getZ(i)}`, i);
  for (let i = 0; i < index.count; i += 3) {
    const ids = [index.getX(i), index.getX(i + 1), index.getX(i + 2)];
    const x = ids.reduce((sum, id) => sum + positions.getX(id), 0) / 3;
    const z = ids.reduce((sum, id) => sum + positions.getZ(id), 0) / 3;
    assert.ok(x <= x0 || x >= x1 || z <= z0 || z >= z1, 'no world triangle inside alpine rectangle');
  }
  for (const spacing of [1.5, 3]) {
    const alpine = buildAlpineRangeGeometry(field, spacing);
    const ap = alpine.getAttribute('position');
    const ac = alpine.getAttribute('color');
    for (let i = 0; i < ap.count; i++) {
      const x = ap.getX(i);
      const z = ap.getZ(i);
      if (Math.min(Math.abs(x - x0), Math.abs(x - x1), Math.abs(z - z0), Math.abs(z - z1)) > 1e-4) continue;
      const id = vertices.get(`${x}:${z}`);
      assert.notEqual(id, undefined, `shared boundary sample ${x},${z}`);
      assert.equal(positions.getY(id!), ap.getY(i));
      assert.ok(Math.abs(colors.getX(id!) * grass.r - ac.getX(i)) < 1e-6);
      assert.ok(Math.abs(colors.getY(id!) * grass.g - ac.getY(i)) < 1e-6);
      assert.ok(Math.abs(colors.getZ(id!) * grass.b - ac.getZ(i)) < 1e-6);
    }
    alpine.dispose();
  }
  const mesh = new THREE.Mesh(world, new THREE.MeshBasicMaterial());
  const ray = new THREE.Raycaster();
  for (const [x, z] of [[0, 0], [220, 80], [0, -298], [-130, 0], [0, 160], [-60, -70]]) {
    ray.set(new THREE.Vector3(x!, 100, z!), new THREE.Vector3(0, -1, 0));
    const hits = ray.intersectObject(mesh);
    assert.ok(hits.length > 0, `continuous outer coverage at ${x},${z}`);
    if (x === -60) assert.ok(Math.abs(hits[0]!.point.y - terrainHeight(x, z!)) < 0.03, 'western seabed retains sea priority');
  }
  assert.ok(world.boundingBox!.min.x <= -148 && world.boundingBox!.max.x >= 268);
  assert.ok(world.boundingBox!.min.z <= -298 && world.boundingBox!.max.z >= 178);
  mesh.material.dispose();
  world.dispose();
});
