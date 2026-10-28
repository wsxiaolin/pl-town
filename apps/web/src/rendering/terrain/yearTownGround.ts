import * as THREE from 'three';
import { YEAR_DISTRICTS, YEAR_ISLAND_SPECS, YEAR_TOWNS, islandOutlinePolygon, yearTownsOfDistrict, type IslandStreetGrid, type YearDistrictSpec, type YearTownSpec } from '../../city/data/year-towns/towns';
import { terrainHeight } from '../../city/data/terrain/heightfield/terrainHeight';
import { YEAR_TOWN_SURFACE_Y } from './yearTownGroundLayers';
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
const CURB = 0.1;
const L = YEAR_TOWN_SURFACE_Y;

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

function pushSegmentStrip(
  surface: Surface,
  x0: number,
  z0: number,
  x1: number,
  z1: number,
  halfWidth: number,
  layerOffset: number,
  color: THREE.Color,
): void {
  const dx = x1 - x0;
  const dz = z1 - z0;
  const length = Math.hypot(dx, dz);
  if (length < 0.01) return;
  const ux = dx / length;
  const uz = dz / length;
  const px = -uz * halfWidth;
  const pz = ux * halfWidth;
  const sections = Math.max(1, Math.ceil(length / 2));
  for (let index = 0; index < sections; index += 1) {
    const start = index / sections;
    const end = (index + 1) / sections;
    const ax = x0 + dx * start;
    const az = z0 + dz * start;
    const bx = x0 + dx * end;
    const bz = z0 + dz * end;
    const a: [number, number, number] = [ax + px, terrainHeight(ax + px, az + pz) + layerOffset, az + pz];
    const b: [number, number, number] = [bx + px, terrainHeight(bx + px, bz + pz) + layerOffset, bz + pz];
    const c: [number, number, number] = [bx - px, terrainHeight(bx - px, bz - pz) + layerOffset, bz - pz];
    const d: [number, number, number] = [ax - px, terrainHeight(ax - px, az - pz) + layerOffset, az - pz];
    pushTriangle(surface, a, b, c, color);
    pushTriangle(surface, a, c, d, color);
  }
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

function boxExtents(building: BuildingEntity): { width: number; depth: number } {
  const box = new THREE.Box3().setFromObject(building.group);
  if (box.isEmpty()) return { width: 0, depth: 0 };
  return { width: box.max.x - box.min.x, depth: box.max.z - box.min.z };
}

/**
 * 城市街网：按 districts 的 grid 定义铺主街/次街/人行道/路缘，并画站前广场。
 * 与旧放射干道互斥——有 grid 的岛不再画放射臂。
 */
function addStreetGrid(surface: Surface, district: YearDistrictSpec): void {
  const grid: IslandStreetGrid | undefined = district.grid;
  if (!grid) return;
  const base = district.topY;
  const sidewalk = tint(0xc9c2b4);
  const paving = tint(0x8e8b84, 0.92);
  const curb = tint(0xe0dacd);

  for (const street of grid.streets) {
    const half = street.halfWidth;
    const walkExtra = street.kind === 'avenue' ? 1.2 : street.kind === 'promenade' ? 0.65 : 0.9;
    const roadColor = street.kind === 'promenade' ? tint(0xb8aa91) : paving;
    pushSegmentStrip(surface, street.x0, street.z0, street.x1, street.z1, half + walkExtra, L.sidewalk, sidewalk);
    pushSegmentStrip(surface, street.x0, street.z0, street.x1, street.z1, half, L.road, roadColor);
    if (street.kind !== 'promenade') {
      pushSegmentStrip(surface, street.x0, street.z0, street.x1, street.z1, half, L.curb, curb);
      pushSegmentStrip(surface, street.x0, street.z0, street.x1, street.z1, Math.max(0, half - CURB), L.road, roadColor);
    }
    if (street.kind === 'avenue') {
      pushSegmentStrip(surface, street.x0, street.z0, street.x1, street.z1, 0.09, L.centerline, tint(0xe8e4da));
    }
  }

  for (const { x, z, radius, kind } of grid.plazas ?? []) {
    const plazaColor = kind === 'water' ? tint(0xc7c0b0) : tint(0xd6cfc0);
    pushDisc(surface, x, z, radius, base + L.plaza, tint(0xd6cfc0), 56);
    pushRing(surface, x, z, radius, radius + (kind === 'market' ? 1.2 : 0.75), base + L.plazaRing, plazaColor, 56);
  }
}

function addDistrictGround(surface: Surface, district: YearDistrictSpec): void {
  const base = district.topY;
  const sidewalk = tint(0xc9c2b4);
  const paving = tint(0x8e8b84, 0.92);
  const plaza = tint(0xd6cfc0);
  const curb = tint(0xe0dacd);
  const cx = district.x;
  const cz = district.z;

  // 旧布局保留圆形中心；新街网的公共空间由 plazas 明确定义。
  if (!district.grid) {
    pushDisc(surface, cx, cz, 9.2, base + L.plaza, plaza, 64);
    pushRing(surface, cx, cz, 9.2, 10.4, base + L.plazaRing, tint(0xb8ad9a), 64);
    pushRing(surface, cx, cz, 2.4, 3.2, base + L.innerRing, tint(0x8f8674), 48);
    pushDisc(surface, cx, cz, 2.4, base + L.innerDisc, tint(0xa8c08a), 40);
  }

  // 有城市街网的岛不再画放射干道（改用 addStreetGrid 的规则路网）。
  for (const town of district.grid ? [] : yearTownsOfDistrict(district.id)) {
    const dx = town.x - cx;
    const dz = town.z - cz;
    const length = Math.hypot(dx, dz);
    if (length < 11) continue;
    const ux = dx / length;
    const uz = dz / length;
    const px = -uz;
    const pz = ux;
    const s0 = 10.2;
    const s1 = length - 1.2;
    const at = (s: number, lateral: number): Point2 => [cx + ux * s + px * lateral, cz + uz * s + pz * lateral];
    const strip = (a: number, b: number, lat0: number, lat1: number, y: number, color: THREE.Color) => {
      pushQuad(surface, at(a, lat0), at(b, lat0), at(b, lat1), at(a, lat1), y, color);
    };
    strip(s0, s1, -3.4, 3.4, base + L.sidewalk, sidewalk);
    strip(s0, s1, -2.3, 2.3, base + L.road, paving);
    strip(s0, s1, 2.3, 2.45, base + L.curb, curb);
    strip(s0, s1, -2.45, -2.3, base + L.curb, curb);
    strip(s0, s1, -0.08, 0.08, base + L.centerline, tint(0xe8e4da));

    // 片区主街：从大城干道进入片区中心，止于中心，远端留给 XL 地标。
    const point = (s: number, lat: number): Point2 => [town.x + ux * s - uz * lat, town.z + uz * s + ux * lat];
    const seg = (a: number, b: number, lat0: number, lat1: number, y: number, color: THREE.Color) => {
      pushQuad(surface, point(a, lat0), point(b, lat0), point(b, lat1), point(a, lat1), y, color);
    };
    seg(-16.5, 0, -2.3, 2.3, base + L.street, paving);
    seg(-16.5, 0, 2.3, 2.5, base + L.curb, curb);
    seg(-16.5, 0, -2.5, -2.3, base + L.curb, curb);
  }

  // 码头：旧港城朝南（南海）、星港城朝西（西臂），轴向与岛缘齐平，
  // 栈桥停在台缘内侧，不悬空到滩坡上。
  const edge = district.plateauR - 1.6;
  const deck = tint(0xb08a5e);
  const cap = tint(0x8f6b46);
  if (district.id === 'island-oldport') {
    pushRect(surface, cx, cz + edge, 4.0, 7.2, base + L.dock, deck);
    pushRect(surface, cx, cz + edge + 3.0, 4.0, 1.2, base + L.dockCap, cap);
  } else {
    pushRect(surface, cx - edge, cz, 7.2, 4.0, base + L.dock, deck);
    pushRect(surface, cx - edge - 3.0, cz, 1.2, 4.0, base + L.dockCap, cap);
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
    const y = town.topY + L.plot + hash01(building.id) * 0.0012;
    pushRect(surface, building.x, building.z, pad, pad, y, border);
    pushRect(surface, building.x, building.z, pad - 0.34, pad - 0.34, y + 0.006, body);
  }
}

function addSeawall(surface: Surface, town: Pick<YearTownSpec, 'x' | 'z' | 'topY' | 'plateauR'>): void {
  const base = town.topY;
  const stone = tint(0xb9b0a0);
  pushWallRing(surface, town.x, town.z, town.plateauR - 0.4, town.plateauR + 0.12, town.plateauR + 0.5, base + 0.04, base - 0.55, stone);
}

function addOutlineSeawall(surface: Surface, island: YearDistrictSpec): void {
  if (!island.outline) {
    addSeawall(surface, island);
    return;
  }
  const polygon = islandOutlinePolygon(island.outline);
  const center = { x: island.x, z: island.z };
  const stone = tint(0xb9b0a0);
  for (let i = 0; i < polygon.length; i += 1) {
    const a = polygon[i]!;
    const b = polygon[(i + 1) % polygon.length]!;
    const normA = Math.hypot(a[0], a[1]) || 1;
    const normB = Math.hypot(b[0], b[1]) || 1;
    const innerA: Point2 = [center.x + a[0] * (1 - 0.35 / normA), center.z + a[1] * (1 - 0.35 / normA)];
    const innerB: Point2 = [center.x + b[0] * (1 - 0.35 / normB), center.z + b[1] * (1 - 0.35 / normB)];
    const outerA: Point2 = [center.x + a[0] * (1 + 0.16 / normA), center.z + a[1] * (1 + 0.16 / normA)];
    const outerB: Point2 = [center.x + b[0] * (1 + 0.16 / normB), center.z + b[1] * (1 + 0.16 / normB)];
    pushQuad(surface, innerA, innerB, outerB, outerA, island.topY + 0.04, stone);
    pushTriangle(surface, [outerA[0], island.topY + 0.04, outerA[1]], [outerA[0], island.topY - 0.55, outerA[1]], [outerB[0], island.topY - 0.55, outerB[1]], stone);
    pushTriangle(surface, [outerA[0], island.topY + 0.04, outerA[1]], [outerB[0], island.topY - 0.55, outerB[1]], [outerB[0], island.topY + 0.04, outerB[1]], stone);
  }
}

export type YearTownGround = {
  object: THREE.Mesh;
  dispose(): void;
};

export function createYearTownGround(options: { scene: THREE.Scene; buildings: readonly BuildingEntity[] }): YearTownGround {
  const surface: Surface = { positions: [], colors: [], uvs: [] };
  for (const district of YEAR_DISTRICTS) addDistrictGround(surface, district);
  for (const island of YEAR_ISLAND_SPECS) addStreetGrid(surface, island);
  for (const town of YEAR_TOWNS) addPlots(surface, town, options.buildings);
  for (const island of YEAR_ISLAND_SPECS) addOutlineSeawall(surface, island);

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
