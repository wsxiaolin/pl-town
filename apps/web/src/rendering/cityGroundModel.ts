import * as THREE from 'three';
import type { CityGroundExclusion, CityGroundPlanConfig } from '../city/data/terrain/_types';

type GroundReliefConfig = CityGroundPlanConfig['relief'];
type GroundPavingConfig = CityGroundPlanConfig['paving'];

/** Create a gently triangulated, repeatable city-wide earth surface. */
export function createGroundReliefGeometry(config: GroundReliefConfig, baseY: number): THREE.BufferGeometry {
  const geometry = new THREE.BufferGeometry();
  const positions: number[] = [];
  const colors: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];
  const columns = config.segments + 1;
  const rows = config.segments + 1;
  const color = new THREE.Color();

  for (let row = 0; row < rows; row += 1) {
    const z = (row / config.segments - 0.5) * config.depth;
    for (let column = 0; column < columns; column += 1) {
      const x = (column / config.segments - 0.5) * config.width;
      const broad = valueNoise(x * 0.055, z * 0.055, config.seed);
      const fine = valueNoise(x * 0.16, z * 0.16, config.seed + 197);
      const relief = (broad * 0.72 + fine * 0.28) * config.amplitude;
      positions.push(x, baseY + relief, z);
      uvs.push(column / config.segments, row / config.segments);

      const tint = 0.98 + valueNoise(x * 0.21, z * 0.21, config.seed + 911) * 0.045;
      color.setRGB(tint, tint, tint);
      colors.push(color.r, color.g, color.b);
    }
  }

  for (let row = 0; row < config.segments; row += 1) {
    for (let column = 0; column < config.segments; column += 1) {
      const topLeft = row * columns + column;
      const topRight = topLeft + 1;
      const bottomLeft = topLeft + columns;
      const bottomRight = bottomLeft + 1;
      indices.push(topLeft, bottomLeft, topRight, topRight, bottomLeft, bottomRight);
    }
  }

  geometry.name = 'city-ground-low-poly-relief';
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  geometry.computeBoundingSphere();
  return geometry;
}

/** Build the central plaza's inset stone blocks into one deterministic mesh. */
export function createPlazaPavingGeometry(
  config: GroundPavingConfig,
  groundY: number,
): THREE.BufferGeometry {
  const positions: number[] = [];
  const colors: number[] = [];
  const uvs: number[] = [];
  const columns = Math.max(1, Math.floor(config.width / (config.tileWidth + config.joint)));
  const rows = Math.max(1, Math.floor(config.depth / (config.tileDepth + config.joint)));
  const stepX = config.tileWidth + config.joint;
  const stepZ = config.tileDepth + config.joint;
  const startX = config.x - ((columns - 1) * stepX) / 2;
  const startZ = config.z - ((rows - 1) * stepZ) / 2;

  for (let row = 0; row < rows; row += 1) {
    const rowSeed = config.seed + row * 733;
    const stagger = row % 2 === 0 ? 0 : stepX * 0.5;
    for (let column = 0; column < columns; column += 1) {
      const tileSeed = rowSeed + column * 1597;
      const jitterX = (hash01(tileSeed) - 0.5) * 0.09;
      const jitterZ = (hash01(tileSeed + 1) - 0.5) * 0.045;
      const centerX = startX + column * stepX + stagger + jitterX;
      const centerZ = startZ + row * stepZ + jitterZ;
      const width = config.tileWidth * (0.94 + hash01(tileSeed + 2) * 0.075);
      const depth = config.tileDepth * (0.94 + hash01(tileSeed + 3) * 0.075);
      const halfWidth = width / 2;
      const halfDepth = depth / 2;
      const minX = config.x - config.width / 2;
      const maxX = config.x + config.width / 2;
      const minZ = config.z - config.depth / 2;
      const maxZ = config.z + config.depth / 2;
      if (centerX - halfWidth < minX || centerX + halfWidth > maxX
        || centerZ - halfDepth < minZ || centerZ + halfDepth > maxZ) continue;
      if (isExcluded(centerX, centerZ, halfWidth, halfDepth, config.exclusions)) continue;

      const height = config.minLift + (config.maxLift - config.minLift) * hash01(tileSeed + 4);
      const topY = groundY + height;
      const shade = 0.92 + hash01(tileSeed + 5) * 0.12;
      const darkShade = shade * 0.78;
      const bevel = Math.min(config.bevel, width * 0.12, depth * 0.12);
      const x0 = centerX - halfWidth;
      const x1 = centerX + halfWidth;
      const z0 = centerZ - halfDepth;
      const z1 = centerZ + halfDepth;
      const topRing = [
        [x0 + bevel, z0], [x0, z0 + bevel], [x0, z1 - bevel], [x0 + bevel, z1],
        [x1 - bevel, z1], [x1, z1 - bevel], [x1, z0 + bevel], [x1 - bevel, z0],
      ] as const;
      const bottomRing = [
        [x0, z0], [x0, z0 + bevel], [x0, z1 - bevel], [x0, z1],
        [x1, z1], [x1, z1 - bevel], [x1, z0 + bevel], [x1, z0],
      ] as const;
      const topColor = [shade, shade, shade] as const;
      const sideColor = [darkShade, darkShade, darkShade] as const;
      const topCenter: Point3 = [centerX, topY, centerZ];

      for (let point = 0; point < topRing.length; point += 1) {
        const next = (point + 1) % topRing.length;
        const a = topRing[point]!;
        const b = topRing[next]!;
        addTriangle(
          topCenter,
          [a[0], topY, a[1]],
          [b[0], topY, b[1]],
          topColor,
          [0.5, 0.5],
          [a[0] - centerX + halfWidth, a[1] - centerZ + halfDepth],
          [b[0] - centerX + halfWidth, b[1] - centerZ + halfDepth],
        );
        const bottomA = bottomRing[point]!;
        const bottomB = bottomRing[next]!;
        addQuad(
          [bottomA[0], groundY, bottomA[1]],
          [bottomB[0], groundY, bottomB[1]],
          [b[0], topY, b[1]],
          [a[0], topY, a[1]],
          sideColor,
          [0, 0], [1, 0], [1, 1], [0, 1],
        );
      }
    }
  }

  const geometry = new THREE.BufferGeometry();
  geometry.name = 'city-plaza-beveled-paving';
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geometry.computeVertexNormals();
  geometry.computeBoundingSphere();
  return geometry;

  function addTriangle(
    a: Point3,
    b: Point3,
    c: Point3,
    color: readonly [number, number, number],
    uvA: readonly [number, number],
    uvB: readonly [number, number],
    uvC: readonly [number, number],
  ): void {
    addVertex(a, color, uvA);
    addVertex(b, color, uvB);
    addVertex(c, color, uvC);
  }

  function addQuad(
    a: Point3,
    b: Point3,
    c: Point3,
    d: Point3,
    color: readonly [number, number, number],
    uvA: readonly [number, number],
    uvB: readonly [number, number],
    uvC: readonly [number, number],
    uvD: readonly [number, number],
  ): void {
    addTriangle(a, b, c, color, uvA, uvB, uvC);
    addTriangle(a, c, d, color, uvA, uvC, uvD);
  }

  function addVertex(point: Point3, tint: readonly [number, number, number], uv: readonly [number, number]): void {
    positions.push(point[0], point[1], point[2]);
    colors.push(tint[0], tint[1], tint[2]);
    uvs.push(uv[0], uv[1]);
  }
}

type Point3 = readonly [number, number, number];

function isExcluded(
  x: number,
  z: number,
  halfWidth: number,
  halfDepth: number,
  exclusions: readonly CityGroundExclusion[],
): boolean {
  return exclusions.some((exclusion) => {
    if (exclusion.kind === 'rect') {
      return x + halfWidth > exclusion.minX && x - halfWidth < exclusion.maxX
        && z + halfDepth > exclusion.minZ && z - halfDepth < exclusion.maxZ;
    }
    if (exclusion.kind === 'circle') {
      const dx = Math.max(Math.abs(x - exclusion.x) - halfWidth, 0);
      const dz = Math.max(Math.abs(z - exclusion.z) - halfDepth, 0);
      return dx * dx + dz * dz < exclusion.radius * exclusion.radius;
    }
    return Math.abs(x - exclusion.x) < exclusion.halfWidth + halfWidth
      || Math.abs(z - exclusion.z) < exclusion.halfWidth + halfDepth;
  });
}

function valueNoise(x: number, z: number, seed: number): number {
  const x0 = Math.floor(x);
  const z0 = Math.floor(z);
  const tx = smoothstep(x - x0);
  const tz = smoothstep(z - z0);
  const a = hashSigned(x0, z0, seed);
  const b = hashSigned(x0 + 1, z0, seed);
  const c = hashSigned(x0, z0 + 1, seed);
  const d = hashSigned(x0 + 1, z0 + 1, seed);
  return lerp(lerp(a, b, tx), lerp(c, d, tx), tz);
}

function hash01(value: number): number {
  let hash = value | 0;
  hash = Math.imul(hash ^ (hash >>> 16), 0x45d9f3b);
  hash = Math.imul(hash ^ (hash >>> 16), 0x45d9f3b);
  hash ^= hash >>> 16;
  return (hash >>> 0) / 0xffffffff;
}

function hashSigned(x: number, z: number, seed: number): number {
  const hash = Math.imul(x, 374761393) + Math.imul(z, 668265263) + Math.imul(seed, 1442695041);
  return hash01(hash | 0) * 2 - 1;
}

function smoothstep(value: number): number {
  return value * value * (3 - 2 * value);
}

function lerp(a: number, b: number, weight: number): number {
  return a + (b - a) * weight;
}
