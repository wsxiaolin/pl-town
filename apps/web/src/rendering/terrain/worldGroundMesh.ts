import * as THREE from 'three';
import { SURFACE_Y } from '../layers';
import { terrainHeight } from '../../city/data/terrain/heightfield/terrainHeight';
import { fbm2, smoothStep } from '../../city/data/terrain/heightfield/noiseCore';
import { nearestRiverSample } from '../../city/data/terrain/heightfield/riverField';
import { LANPING_ALPINE_FIELD } from './alpineRangeGeometry';

export const WORLD_GROUND_GRASS_COLOR = 0x74ae48;

export function createWorldGroundGeometry(): THREE.BufferGeometry {
  const bounds = LANPING_ALPINE_FIELD.bounds;
  // Include mountain LOD boundary samples, including the short final cell.
  const axis = (min: number, max: number, start: number, end: number): number[] => {
    const lines = new Set<number>([start - 1, start, end, end + 1]);
    for (let value = min; value <= max; value += 2) lines.add(value);
    for (let value = start; value < end; value += 1.5) lines.add(value);
    return [...lines].sort((a, b) => a - b);
  };
  const eastEdge = Math.max(270, bounds.x1 + 2);
  const xLines = new Set(axis(-150, eastEdge, bounds.x0, bounds.x1));
  const zLines = new Set(axis(-300, 180, bounds.z0, bounds.z1));
  for (let x = -62; x <= 70; x += 0.5) xLines.add(x);
  for (let z = -118; z <= -89; z += 0.5) zLines.add(z);
  const apronX = [bounds.x0 - 1, bounds.x0, bounds.x1, bounds.x1 + 1];
  const apronZ = [bounds.z0 - 1, bounds.z0, bounds.z1, bounds.z1 + 1];
  for (const x of apronX) if (x >= -150 && x <= eastEdge) xLines.add(x);
  for (const z of apronZ) if (z >= -300 && z <= 180) zLines.add(z);
  const xs = [...xLines].sort((a, b) => a - b);
  const zs = [...zLines].sort((a, b) => a - b);
  const edgeDistance = (x: number, z: number): number => Math.min(
    x + 150 - (0.4 + 12 * smoothStep(bounds.z1, bounds.z1 + 60, z)) * (1 + Math.sin(z / 31)),
    eastEdge - x - (0.2 + 20 * smoothStep(bounds.z1, bounds.z1 + 60, z)) * (1 + Math.sin(z / 43)),
    z + 300 - (1 + Math.sin(x / 39)),
    180 - z - 18 * (1 + Math.sin(x / 47)),
  );
  const vertices: number[] = [];
  const colors: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];
  const vertexIndex = new Map<string, number>();
  const grass = new THREE.Color(WORLD_GROUND_GRASS_COLOR);
  const sand = new THREE.Color(0xc7b184);
  const stone = new THREE.Color(0xaaa28c);
  const haze = new THREE.Color(0xd4e1e6);
  const riverBed = new THREE.Color(0x40584f);
  const tint = new THREE.Color();

  const addVertex = (x: number, z: number): number => {
    const key = `${x}:${z}`;
    const cached = vertexIndex.get(key);
    if (cached !== undefined) return cached;
    const seam = x >= bounds.x0 && x <= bounds.x1 && z >= bounds.z0 && z <= bounds.z1;
    const distance = Math.max(bounds.x0 - x, x - bounds.x1, bounds.z0 - z, z - bounds.z1, 0);
    const height = seam ? 0 : terrainHeight(x, z) * smoothStep(0, 4, distance);
    const y = height - 3 * (1 - smoothStep(0, 14, edgeDistance(x, z))) * smoothStep(0, 4, distance);
    vertices.push(x, SURFACE_Y.base + y, z);
    uvs.push((x + 110) / 220, (110 - z) / 220);
    const river = nearestRiverSample(x, z);
    const bank = river ? 1 - smoothStep(river.halfWidth + 2, river.halfWidth + 9, river.d) : 0;
    tint.copy(grass).lerp(sand, bank * smoothStep(0, 6, distance));
    if (river) {
      const channel = 1 - smoothStep(river.halfWidth * 0.48, river.halfWidth * 0.92, river.d);
      tint.lerp(riverBed, channel * smoothStep(0, 5, distance) * 0.58);
    }
    if (height < -0.15 && x < -43.2) tint.lerp(stone, 0.8);
    const variation = fbm2(x / 17, z / 17, 0xab23, 65536, 3);
    tint.multiplyScalar(0.98 + variation * 0.06);
    tint.lerp(haze, (1 - smoothStep(-290, -160, z)) * 0.32);
    colors.push(tint.r / grass.r, tint.g / grass.g, tint.b / grass.b);
    const index = vertices.length / 3 - 1;
    vertexIndex.set(key, index);
    return index;
  };

  const addQuad = (x0: number, x1: number, z0: number, z1: number): void => {
    const corners = [[x0, z0], [x1, z0], [x0, z1], [x1, z1]] as const;
    if (corners.every(([x, z]) => x >= bounds.x0 && x <= bounds.x1 && z >= bounds.z0 && z <= bounds.z1)) return;
    const overlapsAlpine = x1 > bounds.x0 && x0 < bounds.x1 && z1 > bounds.z0 && z0 < bounds.z1;
    if (overlapsAlpine) return;
    if (corners.some(([x, z]) => edgeDistance(x, z) < 0)) return;
    const a = addVertex(x0, z0);
    const b = addVertex(x1, z0);
    const c = addVertex(x0, z1);
    const d = addVertex(x1, z1);
    indices.push(a, c, d, a, d, b);
  };

  const addCell = (x0: number, x1: number, z0: number, z1: number): void => {
    const nearRiver = x1 >= -80 && x0 <= 82 && z1 >= -132 && z0 <= -89;
    const divisions = nearRiver ? 4 : 1;
    for (let iz = 0; iz < divisions; iz += 1) {
      const za = z0 + ((z1 - z0) * iz) / divisions;
      const zb = z0 + ((z1 - z0) * (iz + 1)) / divisions;
      for (let ix = 0; ix < divisions; ix += 1) {
        const xa = x0 + ((x1 - x0) * ix) / divisions;
        const xb = x0 + ((x1 - x0) * (ix + 1)) / divisions;
        addQuad(xa, xb, za, zb);
      }
    }
  };

  for (let j = 0; j + 1 < zs.length; j++) {
    for (let i = 0; i + 1 < xs.length; i++) {
      addCell(xs[i]!, xs[i + 1]!, zs[j]!, zs[j + 1]!);
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();
  return geometry;
}
