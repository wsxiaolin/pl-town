import * as THREE from 'three';
import { YEAR_TOWNS, type YearTownSpec } from '../../city/data/year-towns/towns';
import { TRANSIT_STATIONS } from '../../city/data/year-towns/transit';
import { YEAR_TOWN_BUILDING_EXTRAS } from '../../city/data/year-towns/gen-buildings';
import { inferPlot } from '../../city/data/buildings/_shapeDefaults';
import type { BuildingEntity } from '../../city/buildingEntity';

// 年份镇镇区地面（T6 视觉补强）：岛台顶面目前只有顶面顶点色，从落地视角看
// 是「一块彩色平台」而不是城区。本模块在同一岛台面上叠加一层单 mesh 的
// 铺装系统——主街 + 人行道 + 路缘 + 站前小广场 + 建筑散水/地块 + 台缘石墙。
//
// 布局只消费既有唯一事实源：
// - 镇心/台面半径/台面高：towns.ts；
// - 主街轴向：生成器同款「站台月台 → 镇心」向量（transit.ts）；
// - 建筑落位/形状：gen-buildings + BuildingEntity（散水按建成后 Box3 实测）；
// - 地块颜色：shape 级 inferPlot（与主城 plot 语义同源，不另写颜色表）。
//
// 性能：所有镇共用 1 个 draw call、1 张 256² 程序化铺装纹理、1 个材质；
// 三角面约 3k（主街/广场/115 个散水 + 石墙），远低于设计 §12 的单镇预算。
// 水面/沙线/岛体仍由 archipelagoIsles 唯一负责，本模块不新增 Water。

const TILE_WORLD = 1.8;
const STREET_HALF = 1.75;
const WALK_OUTER = 2.3;
const CURB = 0.1;
const PAVING_Y = 0.015;
const WALK_Y = 0.02;
const PLOT_Y = 0.03;

type Surface = {
  positions: number[];
  colors: number[];
  uvs: number[];
};

type Point2 = readonly [number, number];

function hash01(seed: string): number {
  let hash = 2166136261;
  for (let i = 0; i < seed.length; i += 1) {
    hash ^= seed.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return ((hash >>> 0) % 1000) / 1000;
}

function createPavingTexture(): THREE.CanvasTexture {
  const size = 256;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    ctx.fillStyle = '#f2efe8';
    ctx.fillRect(0, 0, size, size);
    const half = size / 2;
    for (let row = 0; row < 2; row += 1) {
      for (let col = 0; col < 2; col += 1) {
        const shade = 236 + ((row * 2 + col) % 3) * 4;
        ctx.fillStyle = `rgb(${shade}, ${shade - 2}, ${shade - 8})`;
        ctx.fillRect(col * half + 1, row * half + 1, half - 2, half - 2);
      }
    }
    ctx.strokeStyle = 'rgba(92, 86, 76, 0.24)';
    ctx.lineWidth = 2;
    for (let i = 0; i <= 2; i += 1) {
      const p = i * half;
      ctx.beginPath();
      ctx.moveTo(p, 0);
      ctx.lineTo(p, size);
      ctx.moveTo(0, p);
      ctx.lineTo(size, p);
      ctx.stroke();
    }
    ctx.fillStyle = 'rgba(96, 88, 76, 0.08)';
    for (let i = 0; i < 90; i += 1) {
      const x = (i * 73) % size;
      const y = (i * 151) % size;
      ctx.fillRect(x, y, 2, 2);
    }
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  texture.needsUpdate = true;
  return texture;
}

function tint(hex: number, multiplier = 1): THREE.Color {
  return new THREE.Color(hex).multiplyScalar(multiplier);
}

function pushTriangle(
  surface: Surface,
  a: readonly [number, number, number],
  b: readonly [number, number, number],
  c: readonly [number, number, number],
  color: THREE.Color,
): void {
  surface.positions.push(a[0], a[1], a[2], b[0], b[1], b[2], c[0], c[1], c[2]);
  for (let i = 0; i < 3; i += 1) surface.colors.push(color.r, color.g, color.b);
  surface.uvs.push(a[0] / TILE_WORLD, a[2] / TILE_WORLD, b[0] / TILE_WORLD, b[2] / TILE_WORLD, c[0] / TILE_WORLD, c[2] / TILE_WORLD);
}

function pushQuad(
  surface: Surface,
  p0: Point2,
  p1: Point2,
  p2: Point2,
  p3: Point2,
  y: number,
  color: THREE.Color,
): void {
  const a: [number, number, number] = [p0[0], y, p0[1]];
  const b: [number, number, number] = [p1[0], y, p1[1]];
  const c: [number, number, number] = [p2[0], y, p2[1]];
  const d: [number, number, number] = [p3[0], y, p3[1]];
  pushTriangle(surface, a, b, c, color);
  pushTriangle(surface, a, c, d, color);
}

function pushRect(surface: Surface, x: number, z: number, width: number, depth: number, y: number, color: THREE.Color): void {
  const hw = width / 2;
  const hd = depth / 2;
  pushQuad(surface, [x - hw, z - hd], [x + hw, z - hd], [x + hw, z + hd], [x - hw, z + hd], y, color);
}

function pushDisc(surface: Surface, x: number, z: number, radius: number, y: number, color: THREE.Color, segments = 40): void {
  const center: [number, number, number] = [x, y, z];
  for (let i = 0; i < segments; i += 1) {
    const a0 = (i / segments) * Math.PI * 2;
    const a1 = ((i + 1) / segments) * Math.PI * 2;
    const p0: [number, number, number] = [x + Math.cos(a0) * radius, y, z + Math.sin(a0) * radius];
    const p1: [number, number, number] = [x + Math.cos(a1) * radius, y, z + Math.sin(a1) * radius];
    pushTriangle(surface, center, p1, p0, color);
  }
}

function pushRing(surface: Surface, x: number, z: number, inner: number, outer: number, y: number, color: THREE.Color, segments = 40): void {
  for (let i = 0; i < segments; i += 1) {
    const a0 = (i / segments) * Math.PI * 2;
    const a1 = ((i + 1) / segments) * Math.PI * 2;
    const cos0 = Math.cos(a0);
    const sin0 = Math.sin(a0);
    const cos1 = Math.cos(a1);
    const sin1 = Math.sin(a1);
    pushQuad(
      surface,
      [x + cos0 * inner, z + sin0 * inner],
      [x + cos0 * outer, z + sin0 * outer],
      [x + cos1 * outer, z + sin1 * outer],
      [x + cos1 * inner, z + sin1 * inner],
      y,
      color,
    );
  }
}

function pushWallRing(
  surface: Surface,
  x: number,
  z: number,
  innerRadius: number,
  topRadius: number,
  bottomRadius: number,
  topY: number,
  bottomY: number,
  color: THREE.Color,
  segments = 40,
): void {
  pushRing(surface, x, z, innerRadius, topRadius, topY, color, segments);
  for (let i = 0; i < segments; i += 1) {
    const a0 = (i / segments) * Math.PI * 2;
    const a1 = ((i + 1) / segments) * Math.PI * 2;
    const cos0 = Math.cos(a0);
    const sin0 = Math.sin(a0);
    const cos1 = Math.cos(a1);
    const sin1 = Math.sin(a1);
    const topA: [number, number, number] = [x + cos0 * topRadius, topY, z + sin0 * topRadius];
    const topB: [number, number, number] = [x + cos1 * topRadius, topY, z + sin1 * topRadius];
    const botB: [number, number, number] = [x + cos1 * bottomRadius, bottomY, z + sin1 * bottomRadius];
    const botA: [number, number, number] = [x + cos0 * bottomRadius, bottomY, z + sin0 * bottomRadius];
    pushTriangle(surface, topA, botA, botB, color);
    pushTriangle(surface, topA, botB, topB, color);
  }
}

function stationForTown(town: YearTownSpec) {
  return TRANSIT_STATIONS.find((station) => station.townId === town.id && station.id !== 'station-stargate');
}

function streetBasis(town: YearTownSpec) {
  const station = stationForTown(town);
  const dx = station ? town.x - station.platformX : 0;
  const dz = station ? town.z - station.platformZ : -1;
  const length = Math.hypot(dx, dz) || 1;
  const ux = dx / length;
  const uz = dz / length;
  return { ux, uz, px: -uz, pz: ux };
}

function boxExtents(building: BuildingEntity): { width: number; depth: number } {
  const box = new THREE.Box3().setFromObject(building.group);
  if (box.isEmpty()) return { width: 0, depth: 0 };
  return { width: box.max.x - box.min.x, depth: box.max.z - box.min.z };
}

function addStreet(surface: Surface, town: YearTownSpec, buildings: readonly BuildingEntity[]): void {
  const { ux, uz, px, pz } = streetBasis(town);
  const centerX = town.x;
  const centerZ = town.z;
  const at = (s: number, lateral: number): Point2 => [centerX + ux * s + px * lateral, centerZ + uz * s + pz * lateral];
  const strip = (s0: number, s1: number, lat0: number, lat1: number, y: number, color: THREE.Color) => {
    pushQuad(surface, at(s0, lat0), at(s1, lat0), at(s1, lat1), at(s0, lat1), y, color);
  };
  const rBuild = town.plateauR - 3.5;
  const sStart = -town.plateauR + 0.45;
  let sEnd = rBuild - 0.9;
  const xl = buildings.find((building) => building.id === `yt-w${town.year}-01`);
  if (xl) {
    const extents = boxExtents(xl);
    const xlS = (xl.x - centerX) * ux + (xl.z - centerZ) * uz;
    sEnd = Math.min(sEnd, xlS - Math.max(extents.width, extents.depth) / 2 - 0.55);
  }
  if (sEnd <= sStart + 1) return;

  const base = town.topY;
  const sidewalk = tint(0xc9c2b4);
  const paving = tint(0x8e8b84, 0.92);
  const curb = tint(0xd6d0c4);
  strip(sStart, sEnd, -WALK_OUTER, WALK_OUTER, base + PAVING_Y, sidewalk);
  strip(sStart, sEnd, -STREET_HALF, STREET_HALF, base + PAVING_Y + 0.004, paving);
  strip(sStart, sEnd, STREET_HALF, STREET_HALF + CURB, base + WALK_Y, curb);
  strip(sStart, sEnd, -STREET_HALF - CURB, -STREET_HALF, base + WALK_Y, curb);
  strip(sStart, sEnd, -0.08, 0.08, base + PAVING_Y + 0.01, tint(0xe8e4da));

  const foreS = sStart + 1.8;
  pushDisc(surface, centerX + ux * foreS, centerZ + uz * foreS, 2.1, base + WALK_Y + 0.004, tint(0xdcd6ca));
  pushRing(surface, centerX + ux * foreS, centerZ + uz * foreS, 2.1, 2.32, base + WALK_Y + 0.006, tint(0xb8ad9a));
  pushRing(surface, centerX + ux * foreS, centerZ + uz * foreS, 0.62, 0.8, base + WALK_Y + 0.012, tint(0x9a8f7c));

  const crossS = sStart + (sEnd - sStart) * 0.45;
  for (let i = 0; i < 5; i += 1) {
    const s0 = crossS + i * 0.46;
    strip(s0, s0 + 0.26, -STREET_HALF + 0.2, STREET_HALF - 0.2, base + PAVING_Y + 0.012, tint(0xe6e1d4));
  }
}


function addPlots(surface: Surface, town: YearTownSpec, buildings: readonly BuildingEntity[]): void {
  const theme = new THREE.Color(town.theme.groundColor);
  for (const building of buildings) {
    const extras = YEAR_TOWN_BUILDING_EXTRAS[building.id];
    if (!extras || extras.townId !== town.id) continue;
    const extents = boxExtents(building);
    const span = Math.max(extents.width, extents.depth);
    if (span <= 0.01) continue;
    const pad = Math.min(7.6, Math.max(2.2, span + 0.55));
    const shapeColor = new THREE.Color(inferPlot(building.shape).color);
    const body = shapeColor.lerp(theme, 0.32);
    const border = body.clone().multiplyScalar(0.76);
    const y = town.topY + PLOT_Y + hash01(building.id) * 0.0012;
    pushRect(surface, building.x, building.z, pad, pad, y, border);
    pushRect(surface, building.x, building.z, pad - 0.34, pad - 0.34, y + 0.006, body);
  }
}

function addSeawall(surface: Surface, town: YearTownSpec): void {
  const base = town.topY;
  const stone = tint(0xb9b0a0);
  pushWallRing(surface, town.x, town.z, town.plateauR - 0.4, town.plateauR + 0.12, town.plateauR + 0.5, base + 0.04, base - 0.55, stone);
}

function addVillageLane(surface: Surface, town: YearTownSpec, buildings: readonly BuildingEntity[]): void {
  const owned = buildings.filter((building) => YEAR_TOWN_BUILDING_EXTRAS[building.id]?.townId === town.id);
  if (owned.length === 0) return;
  let minZ = Infinity;
  let maxZ = -Infinity;
  for (const building of owned) {
    const extents = boxExtents(building);
    minZ = Math.min(minZ, building.z - extents.depth / 2);
    maxZ = Math.max(maxZ, building.z + extents.depth / 2);
  }
  const lane = tint(0x9a968c);
  const base = town.topY + PAVING_Y;
  const link = (stationId: string, targetZ: number) => {
    const station = TRANSIT_STATIONS.find((entry) => entry.id === stationId);
    if (!station) return;
    const span = Math.abs(station.platformZ - targetZ);
    if (span < 0.4) return;
    pushRect(surface, station.platformX, (station.platformZ + targetZ) / 2, 2.4, span, base, lane);
  };
  link(`station-${town.year}-ring`, maxZ + 0.25);
  link(`station-${town.year}-bridge`, minZ - 0.25);
}

export type YearTownGround = {
  object: THREE.Mesh;
  dispose(): void;
};

export function createYearTownGround(options: { scene: THREE.Scene; buildings: readonly BuildingEntity[] }): YearTownGround {
  const surface: Surface = { positions: [], colors: [], uvs: [] };
  for (const town of YEAR_TOWNS) {
    if (town.year === 2019) addVillageLane(surface, town, options.buildings);
    else addStreet(surface, town, options.buildings);
    addPlots(surface, town, options.buildings);
    addSeawall(surface, town);
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(surface.positions, 3));
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(surface.colors, 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(surface.uvs, 2));
  geometry.computeVertexNormals();
  geometry.computeBoundingSphere();

  const texture = createPavingTexture();
  const material = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    map: texture,
    vertexColors: true,
    roughness: 0.94,
    metalness: 0,
    side: THREE.DoubleSide,
    polygonOffset: true,
    polygonOffsetFactor: -2,
    polygonOffsetUnits: -2,
  });
  material.name = 'year-town-ground';
  const mesh = new THREE.Mesh(geometry, material);
  mesh.name = 'year-town-ground';
  mesh.receiveShadow = true;
  mesh.matrixAutoUpdate = false;
  options.scene.add(mesh);

  return {
    object: mesh,
    dispose() {
      mesh.parent?.remove(mesh);
      geometry.dispose();
      material.dispose();
      texture.dispose();
    },
  };
}
