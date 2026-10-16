import * as THREE from 'three';
import type { AlpineRangeField } from '../../city/data/terrain/heightfield/alpineField';
import { fbm2, smoothStep } from '../../city/data/terrain/heightfield/noiseCore';

// 连续山体高度场现位于数据层（heightfield/alpineField.ts），渲染与导航共享
// 同一份真值。这里只负责把场几何化为可渲染网格，并保持既有导出路径。
export { createAlpineRangeField } from '../../city/data/terrain/heightfield/alpineField';
export { LANPING_ALPINE_FIELD } from '../../city/data/terrain/heightfield/alpineField';
export type { AlpineRangeField } from '../../city/data/terrain/heightfield/alpineField';

const noise = (x: number, z: number, seed: number, scale: number, octaves = 3): number =>
  fbm2(x / scale, z / scale, seed, 65536, octaves);

/** Nested Cartesian samples: the coarse LOD uses exactly the same surface. */
export function buildAlpineRangeGeometry(field: AlpineRangeField, spacing: number): THREE.BufferGeometry {
  if (!Number.isFinite(spacing) || spacing <= 0) throw new Error('Invalid alpine grid spacing');
  const { x0, x1, z0, z1 } = field.bounds;
  const nx = Math.ceil((x1 - x0) / spacing);
  const nz = Math.ceil((z1 - z0) / spacing);
  const positions = new Float32Array((nx + 1) * (nz + 1) * 3);
  const colors = new Float32Array(positions.length);
  const grass = new THREE.Color(0x74ae48);
  const rock = new THREE.Color(0xa5b7c5);
  const warmRock = new THREE.Color(0xb4aa9b);
  const snow = new THREE.Color(0xe2ebef);
  const haze = new THREE.Color(0xd4e1e6);
  const tint = new THREE.Color();
  for (let iz = 0; iz <= nz; iz += 1) {
    for (let ix = 0; ix <= nx; ix += 1) {
      const x = Math.min(x1, x0 + ix * spacing);
      const z = Math.min(z1, z0 + iz * spacing);
      const y = field.heightAt(x, z);
      const index = (iz * (nx + 1) + ix) * 3;
      positions.set([x, y, z], index);
      // Fixed derivative radius keeps material bands consistent across LODs.
      const dx = (field.heightAt(x + 0.8, z) - field.heightAt(x - 0.8, z)) / 1.6;
      const dz = (field.heightAt(x, z + 0.8) - field.heightAt(x, z - 0.8)) / 1.6;
      const up = 1 / Math.sqrt(1 + dx * dx + dz * dz);
      const variation = noise(x, z, 0xab23, 17);
      const rockWeight = 1 - smoothStep(0.80, 0.96, up);
      tint.copy(grass).lerp(rock, rockWeight);
      tint.multiplyScalar(0.98 + variation * 0.06);
      tint.lerp(haze, (1 - smoothStep(-290, -160, z)) * 0.32);
      // Restrict the new palette to elevated rock: the world-ground seam uses
      // the exact original grass/noise/haze formula on the entire perimeter.
      const exposed = rockWeight * smoothStep(2, 14, y);
      const warmth = smoothStep(-0.45, 0.6, noise(x, z, 0x6a91, 95));
      tint.lerp(warmRock, exposed * warmth * 0.52);
      const snowWeight = smoothStep(78, 94, y + variation * 9)
        * smoothStep(0.32, 0.64, up) * smoothStep(-0.28, 0.12, noise(x, z, 0x93ad, 9));
      tint.lerp(snow, snowWeight * 0.85);
      colors.set([tint.r, tint.g, tint.b], index);
    }
  }
  const indices: number[] = [];
  for (let iz = 0; iz < nz; iz += 1) {
    for (let ix = 0; ix < nx; ix += 1) {
      const a = iz * (nx + 1) + ix;
      const b = a + 1;
      const c = a + nx + 1;
      const d = c + 1;
      indices.push(a, c, b, b, c, d);
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();
  return geometry;
}
