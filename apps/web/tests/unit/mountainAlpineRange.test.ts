import assert from 'node:assert/strict';
import test from 'node:test';
import * as THREE from 'three';
import { LANPING_RANGE } from '../../src/city/data/terrain/range-lanping';
import { buildAlpineRangeGeometry, createAlpineRangeField } from '../../src/rendering/terrain/alpineRangeGeometry';
import { createMountainTerrain } from '../../src/rendering/terrain/mountainRanges';
import { fbm2, smoothStep } from '../../src/city/data/terrain/heightfield/noiseCore';

test('isolated peak has meter-scale angular gullies with intact summit and toe', () => {
  const peak = { id: 'erosion-probe', kind: 'mountain' as const, x: 0, z: -200, width: 160, depth: 152, height: 100 };
  const field = createAlpineRangeField([peak]);
  const deviations: number[] = [];
  // The rear face avoids the meadow and the three major spur envelopes.
  for (let i = 0; i <= 160; i++) {
    const angle = -2.6 + i * 0.01;
    const u = Math.cos(angle) * 0.48;
    const v = Math.sin(angle) * 0.48;
    const px = (u - 0.26 * v) / 1.0468;
    const pz = (v + 0.18 * u) / 1.0468;
    const x = (px - 0.11) * 80;
    const z = -200 + (pz - 0.09) * 76;
    const radius = Math.abs(u) * (u < 0 ? 0.84 : 1.08) + Math.abs(v) * (v < 0 ? 0.95 : 0.79);
    const warp = fbm2(x / 45, z / 45, 0x7193, 65536, 3) * 0.025;
    const baseline = 100 * Math.pow(Math.max(0, 1 - radius * (1 + warp)), 1.12);
    deviations.push(field.heightAt(x, z) - baseline);
  }
  assert.ok(Math.min(...deviations) < -7, 'gullies carve at least seven world units into mid-slope');
  assert.ok(Math.max(...deviations) > 6, 'interleaved ribs rise above the original planar face');
  let turns = 0;
  for (let i = 1; i < deviations.length - 1; i++) {
    if ((deviations[i]! - deviations[i - 1]!) * (deviations[i + 1]! - deviations[i]!) < 0) turns++;
  }
  assert.ok(turns >= 5, `several gullies and ribs cross the sampled 90-degree face: ${turns}`);
  assert.ok(field.heightAt(-8.8, -206.84) > 99);
  assert.equal(field.heightAt(field.bounds.x0, -200), 0);
});

test('alpine perimeter keeps the exact world-ground palette in both LODs', () => {
  const field = createAlpineRangeField(LANPING_RANGE);
  for (const spacing of [1.5, 3]) {
    const geometry = buildAlpineRangeGeometry(field, spacing);
    const p = geometry.getAttribute('position');
    const c = geometry.getAttribute('color');
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i), z = p.getZ(i);
      if (Math.min(Math.abs(x - field.bounds.x0), Math.abs(x - field.bounds.x1),
        Math.abs(z - field.bounds.z0), Math.abs(z - field.bounds.z1)) > 1e-4) continue;
      const expected = new THREE.Color(0x74ae48)
        .multiplyScalar(0.98 + fbm2(x / 17, z / 17, 0xab23, 65536, 3) * 0.06)
        .lerp(new THREE.Color(0xd4e1e6), (1 - smoothStep(-290, -160, z)) * 0.32);
      assert.ok(Math.abs(c.getX(i) - expected.r) < 1e-6);
      assert.ok(Math.abs(c.getY(i) - expected.g) < 1e-6);
      assert.ok(Math.abs(c.getZ(i) - expected.b) < 1e-6);
    }
    geometry.dispose();
  }
});

test('alpine field preserves a dominant summit, connected saddles and the river clearance', () => {
  const field = createAlpineRangeField(LANPING_RANGE);
  const again = createAlpineRangeField(LANPING_RANGE);
  let max = 0;
  for (let x = field.bounds.x0; x <= field.bounds.x1; x += 3) {
    for (let z = field.bounds.z0; z <= field.bounds.z1; z += 3) {
      const y = field.heightAt(x, z);
      assert.ok(Number.isFinite(y));
      assert.equal(y, again.heightAt(x, z));
      max = Math.max(max, y);
    }
  }
  assert.ok(max > 95 && max < 103, `pointed dominant summit: ${max}`);
  const hero = LANPING_RANGE.find(feature => feature.id === 'range-lanping-hero')!;
  assert.ok(hero.width! / hero.height! >= 1.6, 'hero has a broad pyramid footprint');
  assert.ok(field.heightAt(hero.x - 30, hero.z) > 45);
  assert.ok(field.heightAt(hero.x + 30, hero.z) > 35);
  assert.ok(field.heightAt(hero.x - 30, hero.z) - field.heightAt(hero.x + 30, hero.z) > 15,
    'eccentric summit has unequal shoulders');
  const summitX = hero.x - hero.width! * 0.055;
  const summitZ = hero.z - hero.depth! * 0.045;
  assert.ok(field.heightAt(summitX, summitZ) > 99);
  assert.ok(field.heightAt(summitX + 12, summitZ) < 84, 'upper peak narrows sharply');
  for (let x = -100; x <= 100; x += 2) {
    assert.equal(field.heightAt(x, -107), 0, 'mountains stay north of the river landscape');
  }
  for (let t = 0; t <= 1; t += 0.025) {
    assert.ok(field.heightAt(-62 + 96 * t, -176 - 14 * t) > 1, 'west-to-hero saddle stays joined');
  }
});

test('three isolated tilted meadows retain gentle slopes without repeated elevation bands', () => {
  const field = createAlpineRangeField(LANPING_RANGE);
  for (const [x, z] of [[3.6, -165.52], [162.8, -172.32], [-86.48, -146.88]]) {
    const dx = field.heightAt(x! + 0.5, z!) - field.heightAt(x! - 0.5, z!);
    const dz = field.heightAt(x!, z! + 0.5) - field.heightAt(x!, z! - 0.5);
    const slope = Math.hypot(dx, dz);
    assert.ok(slope > 0.06 && slope < 0.22, `tilted meadow at ${x},${z}: ${slope}`);
  }
  // The back face descends continuously through the former 24-unit contour levels.
  const heights = Array.from({ length: 21 }, (_, i) => field.heightAt(25.2, -214 - i * 2));
  for (let i = 1; i < heights.length; i++) {
    assert.ok(heights[i - 1]! - heights[i]! > 1, 'no repeated flat steps on the upper back face');
  }
});

test('range covers its rectangle with a zero-height perimeter and continuous slopes', () => {
  const field = createAlpineRangeField(LANPING_RANGE);
  const duplicate = createAlpineRangeField([...LANPING_RANGE, ...LANPING_RANGE]);
  const { x0, x1, z0, z1 } = field.bounds;
  for (let x = x0; x <= x1; x += 2) {
    assert.equal(field.heightAt(x, z0), 0);
    assert.equal(field.heightAt(x, z1), 0);
    for (let z = z0; z <= z1; z += 2) {
      const y = field.heightAt(x, z);
      assert.ok(y >= 0);
      assert.equal(y, duplicate.heightAt(x, z), 'overlapping primitives never accumulate height');
      assert.ok(Math.abs(y - field.heightAt(x + 0.1, z)) < 0.8, `continuous x slope at ${x},${z}`);
      assert.ok(Math.abs(y - field.heightAt(x, z + 0.1)) < 0.8, `continuous z slope at ${x},${z}`);
    }
  }
  for (let z = z0; z <= z1; z += 2) {
    assert.equal(field.heightAt(x0, z), 0);
    assert.equal(field.heightAt(x1, z), 0);
  }
});

test('Cartesian mesh has upward winding, unique cells and identical coarse/fine samples', () => {
  const field = createAlpineRangeField(LANPING_RANGE);
  const fine = buildAlpineRangeGeometry(field, 1.5);
  const coarse = buildAlpineRangeGeometry(field, 3);
  const positions = new Map<string, number>();
  const p = fine.getAttribute('position');
  for (let i = 0; i < p.count; i += 1) positions.set(`${p.getX(i)}:${p.getZ(i)}`, p.getY(i));
  const q = coarse.getAttribute('position');
  for (let i = 0; i < q.count; i += 1) assert.equal(positions.get(`${q.getX(i)}:${q.getZ(i)}`), q.getY(i));
  const triangles = new Set<string>();
  const index = fine.getIndex()!;
  const nx = Math.ceil((field.bounds.x1 - field.bounds.x0) / 1.5);
  const nz = Math.ceil((field.bounds.z1 - field.bounds.z0) / 1.5);
  assert.equal(index.count, nx * nz * 6, 'every rectangular cell is covered, including the apron');
  for (let i = 0; i < index.count; i += 3) {
    const a = index.getX(i), b = index.getX(i + 1), c = index.getX(i + 2);
    const up = (p.getZ(b) - p.getZ(a)) * (p.getX(c) - p.getX(a))
      - (p.getX(b) - p.getX(a)) * (p.getZ(c) - p.getZ(a));
    assert.ok(up > 0);
    const key = [a, b, c].sort((u, v) => u - v).join(':');
    assert.ok(!triangles.has(key));
    triangles.add(key);
  }
  assert.ok(index.count > coarse.getIndex()!.count * 3);
  fine.dispose();
  coarse.dispose();
});

test('surface colors reserve fresh green for gentle slopes and lighten distant rock', () => {
  const field = createAlpineRangeField(LANPING_RANGE);
  const geometry = buildAlpineRangeGeometry(field, 3);
  const p = geometry.getAttribute('position');
  const colors = geometry.getAttribute('color');
  let green = 0;
  let rock = 0;
  let snow = 0;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), z = p.getZ(i);
    if (p.getY(i) > 78 && colors.getX(i) > 0.55 && colors.getY(i) > 0.6) snow++;
    const dx = (field.heightAt(x + 0.8, z) - field.heightAt(x - 0.8, z)) / 1.6;
    const dz = (field.heightAt(x, z + 0.8) - field.heightAt(x, z - 0.8)) / 1.6;
    if (colors.getY(i) > colors.getZ(i) * 1.5 && p.getY(i) > 10) {
      assert.ok(Math.hypot(dx, dz) < 0.65, 'green meadow remains on gentle slopes');
      green++;
    }
    if (Math.hypot(dx, dz) > 1.1) {
      assert.ok(Math.max(colors.getX(i), colors.getZ(i)) > colors.getY(i) * 0.9,
        'steep face retains a mineral palette across warm and cool outcrops');
      rock++;
    }
  }
  assert.ok(green > 20 && rock > 100, 'both meadows and exposed rock remain visible');
  assert.ok(snow > 0 && snow < 60, `snow remains confined to a few high outcrops: ${snow}`);
  const flat = buildAlpineRangeGeometry({ bounds: { x0: 0, x1: 3, z0: -290, z1: -160 }, heightAt: () => 0 }, 3);
  const flatColors = flat.getAttribute('color');
  assert.ok(flatColors.getZ(0) > flatColors.getZ(flatColors.count - 1), 'distant ground gains atmospheric blue');
  geometry.dispose();
  flat.dispose();
});

test('mountain handle retains LOD hierarchy and disposes every owned resource once', () => {
  const scene = new THREE.Scene();
  const handle = createMountainTerrain({ scene });
  assert.equal(scene.children.length, 0);
  const lod = handle.object.children.find((child) => child instanceof THREE.LOD) as THREE.LOD;
  assert.ok(lod);
  assert.equal(lod.levels.length, 2);
  assert.ok(lod.levels[1]!.distance > 0);
  const surface = (lod.levels[0]!.object as THREE.Mesh).material as THREE.MeshStandardMaterial;
  const shader = {
    uniforms: THREE.UniformsUtils.clone(THREE.ShaderLib.standard.uniforms),
    vertexShader: THREE.ShaderLib.standard.vertexShader,
    fragmentShader: THREE.ShaderLib.standard.fragmentShader,
  };
  surface.onBeforeCompile(shader as Parameters<typeof surface.onBeforeCompile>[0], {} as THREE.WebGLRenderer);
  assert.ok(shader.vertexShader.includes('(modelMatrix * vec4(transformed, 1.0)).xyz'));
  assert.ok(shader.fragmentShader.includes('float alpineNoise(vec3 p)'));
  assert.ok(shader.fragmentShader.includes('fwidth(alpineCrackPhase)'));
  assert.ok(shader.fragmentShader.indexOf('normal = normalize(abs(alpineDet)')
    < shader.fragmentShader.indexOf('#include <lights_physical_fragment>'), 'rock normals feed standard lighting');
  assert.ok(shader.fragmentShader.includes('* smoothstep(2.0, 14.0, alpineP.y)'), 'detail fades before the ground seam');
  assert.equal(surface.map, null, 'procedural rock requires no texture assets');
  const resources = new Set<THREE.BufferGeometry | THREE.Material>();
  handle.object.traverse((child) => {
    if (child instanceof THREE.Mesh) {
      resources.add(child.geometry);
      for (const material of Array.isArray(child.material) ? child.material : [child.material]) resources.add(material);
    }
  });
  let disposed = 0;
  for (const resource of resources) {
    const onDispose = (): void => { disposed += 1; };
    if (resource instanceof THREE.Material) resource.addEventListener('dispose', onDispose);
    else resource.addEventListener('dispose', onDispose);
  }
  scene.add(handle.object);
  handle.dispose();
  handle.dispose();
  assert.equal(disposed, resources.size);
  assert.equal(scene.children.length, 0);
});
