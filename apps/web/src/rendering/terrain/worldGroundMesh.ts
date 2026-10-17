import * as THREE from 'three';
import { SURFACE_Y } from '../layers';
import { terrainHeight } from '../../city/data/terrain/heightfield/terrainHeight';
import { fbm2, smoothStep } from '../../city/data/terrain/heightfield/noiseCore';
import { nearestRiverSample } from '../../city/data/terrain/heightfield/riverField';
import { LANPING_ALPINE_FIELD } from './alpineRangeGeometry';

export const WORLD_GROUND_GRASS_COLOR = 0x74ae48;

export function createWorldGroundGeometry(): THREE.BufferGeometry {
  const bounds = LANPING_ALPINE_FIELD.bounds;
  // Include both mountain LOD boundary samples, including the short final cell.
  const axis = (min: number, max: number, start: number, end: number): number[] => {
    const lines = new Set<number>([start - 1, start, end, end + 1]);
    for (let value = min; value <= max; value += 2) lines.add(value);
    for (let value = start; value < end; value += 1.5) lines.add(value);
    return [...lines].sort((a, b) => a - b);
  };
  const eastEdge = Math.max(270, bounds.x1 + 2);
  const xs = axis(-150, eastEdge, bounds.x0, bounds.x1);
  const zs = axis(-300, 180, bounds.z0, bounds.z1);
  const edgeDistance = (x: number, z: number): number => Math.min(
    x + 150 - (0.4 + 12 * smoothStep(bounds.z1, bounds.z1 + 60, z)) * (1 + Math.sin(z / 31)),
    eastEdge - x - (0.2 + 20 * smoothStep(bounds.z1, bounds.z1 + 60, z)) * (1 + Math.sin(z / 43)),
    z + 300 - (1 + Math.sin(x / 39)),
    180 - z - 18 * (1 + Math.sin(x / 47)),
  );
  const positions: number[] = [];
  const colors: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];
  const vertices = new Map<number, number>();
  const grass = new THREE.Color(WORLD_GROUND_GRASS_COLOR);
  const sand = new THREE.Color(0xc7b184);
  const stone = new THREE.Color(0xaaa28c);
  const haze = new THREE.Color(0xd4e1e6);
  const tint = new THREE.Color();
  const vertex = (i: number, j: number): number => {
    const key = j * xs.length + i;
    const cached = vertices.get(key);
    if (cached !== undefined) return cached;
    const x = xs[i]!;
    const z = zs[j]!;
    const seam = x >= bounds.x0 && x <= bounds.x1 && z >= bounds.z0 && z <= bounds.z1;
    const distance = Math.max(bounds.x0 - x, x - bounds.x1, bounds.z0 - z, z - bounds.z1, 0);
    // Mountain perimeter is exactly y=0, below the western sea surface.
    // Blend only the adjacent outer strip to keep the shared edge watertight.
    const height = seam ? 0 : terrainHeight(x, z) * smoothStep(0, 4, distance);
    const y = height - 3 * (1 - smoothStep(0, 14, edgeDistance(x, z))) * smoothStep(0, 4, distance);
    positions.push(x, SURFACE_Y.base + y, z);
    uvs.push((x + 110) / 220, (110 - z) / 220);
    const river = nearestRiverSample(x, z);
    const bank = river ? 1 - smoothStep(river.halfWidth + 2, river.halfWidth + 9, river.d) : 0;
    tint.copy(grass).lerp(sand, bank * smoothStep(0, 6, distance));
    if (height < -0.15 && x < -43.2) tint.lerp(stone, 0.8);
    // Match alpineRangeGeometry's flat perimeter tint in linear color space.
    const variation = fbm2(x / 17, z / 17, 0xab23, 65536, 3);
    tint.multiplyScalar(0.98 + variation * 0.06);
    tint.lerp(haze, (1 - smoothStep(-290, -160, z)) * 0.32);
    colors.push(tint.r / grass.r, tint.g / grass.g, tint.b / grass.b);
    const index = positions.length / 3 - 1;
    vertices.set(key, index);
    return index;
  };
  for (let j = 0; j + 1 < zs.length; j++) {
    for (let i = 0; i + 1 < xs.length; i++) {
      const x0 = xs[i]!;
      const x1 = xs[i + 1]!;
      const z0 = zs[j]!;
      const z1 = zs[j + 1]!;
      if (x0 >= bounds.x0 && x1 <= bounds.x1 && z0 >= bounds.z0 && z1 <= bounds.z1) continue;
      if (Math.min(edgeDistance(x0, z0), edgeDistance(x1, z0), edgeDistance(x0, z1), edgeDistance(x1, z1)) < 0) continue;
      const a = vertex(i, j);
      const b = vertex(i + 1, j);
      const c = vertex(i, j + 1);
      const d = vertex(i + 1, j + 1);
      indices.push(a, c, d, a, d, b);
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();
  return geometry;
}
