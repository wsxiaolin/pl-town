import * as THREE from 'three';
import { MINGLAN_ISLES } from '../../city/data/terrain/sea-minglan';
import type { TerrainFeatureConfig } from '../../city/data/terrain/_types';

// 明澜外海渲染：低多边形离岛 + 远岸岬角群 + 外海底层水面。
// 配置契约见 city/data/terrain/sea-minglan.ts（坐标/清空距核对记录在同文件头注释）。
//
// 视觉基准是 CG 片头图（assets/cg/echo/mountain-promise.png、observatory-song.png）：
// 折面平影体块（flatShading + 逐面烘焙色块）、柔和粉彩、远景把雾霾烘进颜色——
// 因此不用 scene.fog（仓库禁用），远处岬角直接用更浅更冷的色阶。
//
// y 体系（对齐 rendering/layers.ts 的 z-fighting 规则，任意水平面与
// 0 / 0.018 / 0.036 / 0.04 / 0.06 / 0.065 / 0.07 均保持 >0.004 间距）：
//   海面（westBeach，既有）     y = 0.06
//   沙线盘（本文件，唯一新增水平面之一） y = 0.085   （与海面差 0.025）
//   外海底面（本文件，唯一新增水平面之二） y = -0.4   （与地表 y=0 差 0.4）
//   岛裙/岬角锥底                y = -0.6   （斜面 + 底缘在外海底面之下）
//   岛体/山体其余表面均为斜面或折面，不构成水平面。
// 所有网格 castShadow/receiveShadow = false（覆盖在镜面海上，避免阴影 acne）；
// 运行时材质统一打 mesh.userData.dynamicMaterial 标记（westBeach.ts 约定）。

export type MinglanIslesOptions = {
  scene: THREE.Scene;
};

export type MinglanIslesHandle = {
  object: THREE.Group;
  dispose(): void;
};

// ── 调色板（日间粉彩；雾霾烘入远景色阶）──────────────────────────
const ISLE_DEEP = new THREE.Color(0x2b5a63); // 岛脚水线下的深青
const ISLE_VEGETATION = new THREE.Color(0x8a9c6e); // 橄榄/鼠尾草绿基色
const ISLE_SAGE = new THREE.Color(0xa8b57e); // 上坡浅草
const ISLE_ROCK = new THREE.Color(0xc7b291); // 峰顶暖岩
const SAND_RIM = new THREE.Color(0xe6d3a4); // 沙线盘（暖白沙）
const SKIRT_TEAL = 0x2b5a63; // 水下裙纯色
const PINE_DEEP = new THREE.Color(0x47714f); // 松树深绿
const PINE_LIGHT = new THREE.Color(0x58805c); // 松树梢
const BOULDER_LOW = new THREE.Color(0x8f8a7e); // 叠石暗面
const BOULDER_HIGH = new THREE.Color(0xc0b195); // 叠石亮面
const HILL_NW_LOW = new THREE.Color(0xa3b8ba); // 北岬群：更冷更浅（雾霾烘焙）
const HILL_NW_MID = new THREE.Color(0xb2c1bf);
const HILL_NW_HIGH = new THREE.Color(0xc9cabc);
const HILL_SW_LOW = new THREE.Color(0xa8bab2); // 南岬群：微暖半档
const HILL_SW_MID = new THREE.Color(0xb6c2b8);
const HILL_SW_HIGH = new THREE.Color(0xcbcabd);
const OUTER_OCEAN_COLOR = 0x25667c; // 外海：深蓝青哑光
const LIGHTHOUSE_WHITE = 0xf3f0e7;
const LIGHTHOUSE_CAP = 0xb26249;
const LIGHTHOUSE_GLOW = 0xffc879; // 灯窗自发光（静态，无真实光源）

// ── y 常量 ──────────────────────────────────────────────────────
const SAND_RIM_Y = 0.085;
const SAND_RIM_MARGIN = 1.5; // 沙线盘半径 = 岛半径 + 1.5
const SKIRT_TOP_Y = 0.082; // 裙顶略低于沙线盘（0.003），藏在盘沿之下
const SKIRT_BOTTOM_Y = -0.6;
const OCEAN_Y_FALLBACK = -0.4;
const PROP_SINK = 0.45; // 岛面props下沉量（覆盖顶部抖动的不确定性）

type ColorStop = { y: number; color: THREE.Color };

type PineSpot = { offsetX: number; offsetZ: number; scale: number };

type BoulderSpot = {
  offsetX: number;
  offsetZ: number;
  scaleX: number;
  scaleY: number;
  scaleZ: number;
  tiltX: number;
  tiltZ: number;
};

type IsleDecor = {
  pines?: readonly PineSpot[];
  boulders?: readonly BoulderSpot[];
  lighthouse?: { offsetX: number; offsetZ: number };
};

// 各岛装饰布置（偏移相对岛心；坐标契约变更时与 sea-minglan.ts 同步核对）。
const ISLE_DECOR: Record<string, IsleDecor> = {
  // 星屿：松树环 + 小灯塔（白身、暖红顶、自发光灯窗）
  'isle-xingyu': {
    pines: [
      { offsetX: 2.8, offsetZ: -1.6, scale: 1.15 },
      { offsetX: -3.2, offsetZ: 2.4, scale: 1.3 },
      { offsetX: 0.8, offsetZ: 3.6, scale: 1.0 },
      { offsetX: -1.4, offsetZ: -3.4, scale: 1.2 },
    ],
    lighthouse: { offsetX: 3.6, offsetZ: -3.0 },
  },
  // 叠石：3-5 块倾斜折面巨石
  'isle-dieshi': {
    boulders: [
      { offsetX: 1.2, offsetZ: 0.6, scaleX: 1.7, scaleY: 1.25, scaleZ: 1.5, tiltX: 0.1, tiltZ: 0.16 },
      { offsetX: -1.4, offsetZ: 1.2, scaleX: 1.4, scaleY: 1.05, scaleZ: 1.35, tiltX: -0.08, tiltZ: -0.22 },
      { offsetX: 0.2, offsetZ: -1.6, scaleX: 1.9, scaleY: 1.35, scaleZ: 1.6, tiltX: 0.18, tiltZ: 0.1 },
      { offsetX: -0.9, offsetZ: -0.7, scaleX: 1.1, scaleY: 0.9, scaleZ: 1.05, tiltX: 0.12, tiltZ: -0.14 },
    ],
  },
  // 远屿：一座松树丛
  'isle-yuanyu': {
    pines: [
      { offsetX: 1.6, offsetZ: -1.2, scale: 1.25 },
      { offsetX: -2.6, offsetZ: 1.8, scale: 1.4 },
      { offsetX: 3.4, offsetZ: 1.2, scale: 1.1 },
      { offsetX: -1.8, offsetZ: -3.6, scale: 1.35 },
      { offsetX: 0.6, offsetZ: 4.6, scale: 1.2 },
    ],
  },
  // 螺洲：素面圆岛，无装饰
};

// 岬角群簇内偏移表（相对配置中心；每丘半径 12-20、高 8-16，与配置包络一致）。
// 簇内山丘相互交叠成山脊剪影（CG 折面群山画法）；最东两丘与浪花带
// （westBeach 的 shore-surf，x ≥ -47.4）保持 ≥12 间距。
type HeadlandHillSpec = { offsetX: number; offsetZ: number; radius: number; height: number; segments: number };

const HEADLAND_HILLS: Record<string, readonly HeadlandHillSpec[]> = {
  'headland-nw': [
    { offsetX: -1.5, offsetZ: 4, radius: 15, height: 13, segments: 7 },
    { offsetX: 8.5, offsetZ: -2, radius: 13, height: 10, segments: 5 },
    { offsetX: -12.5, offsetZ: -5, radius: 16, height: 15, segments: 6 },
    { offsetX: 5.5, offsetZ: 9, radius: 12, height: 9, segments: 6 },
    { offsetX: -9.5, offsetZ: 7, radius: 14, height: 11, segments: 7 },
    { offsetX: 9.5, offsetZ: -8, radius: 12, height: 8, segments: 5 },
  ],
  'headland-sw': [
    { offsetX: 2.5, offsetZ: -5.5, radius: 14, height: 12, segments: 7 },
    { offsetX: 8.5, offsetZ: 1.5, radius: 12, height: 9, segments: 5 },
    { offsetX: -8.5, offsetZ: -0.5, radius: 16, height: 14, segments: 6 },
    { offsetX: -2.5, offsetZ: -10.5, radius: 12, height: 8, segments: 6 },
    { offsetX: -10.5, offsetZ: 8.5, radius: 13, height: 10, segments: 7 },
    { offsetX: 9.5, offsetZ: 10.5, radius: 12, height: 8, segments: 5 },
  ],
};

const PINE_TIERS = [
  { radius: 0.52, height: 0.95, baseY: 0 },
  { radius: 0.4, height: 0.8, baseY: 0.62 },
  { radius: 0.27, height: 0.62, baseY: 1.18 },
] as const;

// ── 确定性随机（固定种子；同一运行内可复现）──────────────────────
function mulberry32(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hashString(text: string): number {
  let hash = 2166136261;
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

// 折面顶点抖动：偏移按"量化坐标 + 种子"哈希取值，因此共享/重合顶点
// （索引接缝、PolyhedronGeometry 的逐面复制）获得相同偏移，不会撕开网格。
// topTaper 让顶部抖动衰减，保证岛顶 props 的落地估算稳定。
function jitterGeometry(
  geometry: THREE.BufferGeometry,
  amountXZ: number,
  amountY: number,
  seed: number,
  halfHeight: number,
  topTaper: number,
): THREE.BufferGeometry {
  const positionAttribute = geometry.getAttribute('position') as THREE.BufferAttribute;
  const offsets = new Map<number, [number, number, number]>();
  for (let index = 0; index < positionAttribute.count; index += 1) {
    const quantizedX = Math.round(positionAttribute.getX(index) * 4096);
    const quantizedY = Math.round(positionAttribute.getY(index) * 4096);
    const quantizedZ = Math.round(positionAttribute.getZ(index) * 4096);
    let hash = seed ^ 0x9e3779b9;
    hash = Math.imul(hash ^ quantizedX, 0x85ebca6b);
    hash = Math.imul(hash ^ quantizedY, 0xc2b2ae35);
    hash = Math.imul(hash ^ quantizedZ, 0x27d4eb2f);
    const key = hash >>> 0;
    let offset = offsets.get(key);
    if (!offset) {
      const random = mulberry32(key);
      const normalizedY = Math.min(Math.max(positionAttribute.getY(index) / halfHeight, 0), 1);
      const taper = 1 - topTaper * normalizedY;
      offset = [
        (random() * 2 - 1) * amountXZ * taper,
        (random() * 2 - 1) * amountY * taper,
        (random() * 2 - 1) * amountXZ * taper,
      ];
      offsets.set(key, offset);
    }
    positionAttribute.setXYZ(
      index,
      positionAttribute.getX(index) + offset[0],
      positionAttribute.getY(index) + offset[1],
      positionAttribute.getZ(index) + offset[2],
    );
  }
  positionAttribute.needsUpdate = true;
  return geometry;
}

// 逐面烘焙色阶：面平均高度在 stops 之间取色，再乘每面 ±5% 明度抖动——
// CG 图里那种"一块一块"的折面色斑即由此而来。
function applyFacetGradient(
  geometry: THREE.BufferGeometry,
  stops: readonly ColorStop[],
  seed: number,
): THREE.BufferGeometry {
  const firstStop = stops[0];
  const lastStop = stops[stops.length - 1];
  if (!firstStop || !lastStop) return geometry;
  const positionAttribute = geometry.getAttribute('position') as THREE.BufferAttribute;
  const colors = new Float32Array(positionAttribute.count * 3);
  const random = mulberry32(seed);
  const tint = new THREE.Color();
  const faceCount = Math.floor(positionAttribute.count / 3);
  for (let face = 0; face < faceCount; face += 1) {
    const first = face * 3;
    const averageY =
      (positionAttribute.getY(first) + positionAttribute.getY(first + 1) + positionAttribute.getY(first + 2)) / 3;
    let color = firstStop.color;
    if (averageY >= lastStop.y) {
      color = lastStop.color;
    } else if (averageY > firstStop.y) {
      for (let stop = 0; stop < stops.length - 1; stop += 1) {
        const low = stops[stop];
        const high = stops[stop + 1];
        if (low && high && averageY >= low.y && averageY <= high.y) {
          const t = (averageY - low.y) / (high.y - low.y);
          color = new THREE.Color().copy(low.color).lerp(high.color, t * t * (3 - 2 * t));
          break;
        }
      }
    }
    const brightness = 0.95 + random() * 0.1;
    tint.copy(color).multiplyScalar(brightness);
    for (let corner = 0; corner < 3; corner += 1) {
      const offset = (first + corner) * 3;
      colors[offset] = tint.r;
      colors[offset + 1] = tint.g;
      colors[offset + 2] = tint.b;
    }
  }
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  geometry.computeVertexNormals();
  return geometry;
}

// 抖动后的几何转非索引 + 烘焙面色（flatShading 下即成折面色块）。
// Icosahedron/PolyhedronGeometry 本就是非索引的；索引几何（圆锥/圆盘/圆柱）
// 经 toNonIndexed 复制后释放原件，抖动已随属性拷贝带入。
function facetize(geometry: THREE.BufferGeometry, stops: readonly ColorStop[], seed: number): THREE.BufferGeometry {
  if (!geometry.index) return applyFacetGradient(geometry, stops, seed);
  const faceted = geometry.toNonIndexed();
  geometry.dispose();
  return applyFacetGradient(faceted, stops, seed);
}

type BuildContext = {
  group: THREE.Group;
  geometries: Set<THREE.BufferGeometry>;
  materials: Set<THREE.Material>;
};

function addMesh(
  context: BuildContext,
  geometry: THREE.BufferGeometry,
  material: THREE.Material,
  name: string,
): THREE.Mesh {
  const mesh = new THREE.Mesh(geometry, material);
  mesh.name = name;
  mesh.castShadow = false;
  mesh.receiveShadow = false;
  mesh.userData.dynamicMaterial = material;
  context.group.add(mesh);
  context.geometries.add(geometry);
  context.materials.add(material);
  return mesh;
}

// 岛面高度估算（未抖动椭球解析值；props 下沉 PROP_SINK 抵消顶部抖动）。
function isleSurfaceY(height: number, radius: number, distance: number): number {
  const t = Math.min(distance / radius, 0.9);
  return height * Math.sqrt(1 - t * t);
}

function buildIslandDomeGeometry(radius: number, height: number, seed: number): THREE.BufferGeometry {
  const dome = new THREE.IcosahedronGeometry(1, 1);
  jitterGeometry(dome, 0.07, 0.035, seed, 1, 0.6);
  dome.scale(radius, height, radius);
  return facetize(dome, [
    { y: -height * 0.3, color: ISLE_DEEP },
    { y: height * 0.1, color: ISLE_VEGETATION },
    { y: height * 0.45, color: ISLE_SAGE },
    { y: height * 0.85, color: ISLE_ROCK },
  ], seed + 1);
}

function buildSandRimGeometry(radius: number, seed: number): THREE.BufferGeometry {
  const rimRadius = radius + SAND_RIM_MARGIN;
  const rim = new THREE.CircleGeometry(rimRadius, 12);
  rim.rotateX(-Math.PI / 2);
  jitterGeometry(rim, rimRadius * 0.05, 0, seed + 2, 1, 0);
  return facetize(rim, [{ y: 0, color: SAND_RIM }], seed + 3);
}

function buildSkirtGeometry(radius: number, seed: number): THREE.BufferGeometry {
  const skirtHeight = SKIRT_TOP_Y - SKIRT_BOTTOM_Y;
  const skirt = new THREE.CylinderGeometry(radius + 1.3, radius * 0.62, skirtHeight, 10, 1, true);
  jitterGeometry(skirt, (radius + 1.3) * 0.04, 0, seed + 4, skirtHeight / 2, 0);
  return facetize(skirt, [{ y: 0, color: new THREE.Color(SKIRT_TEAL) }], seed + 5);
}

function buildPine(context: BuildContext, materials: PineMaterials, x: number, baseY: number, z: number, scale: number, seed: number): void {
  PINE_TIERS.forEach((tier, index) => {
    const cone = new THREE.ConeGeometry(tier.radius, tier.height, 6, 1, true);
    jitterGeometry(cone, 0.05, 0.04, seed + index, tier.height / 2, 0.3);
    const geometry = facetize(cone, [
      { y: -tier.height / 2, color: PINE_DEEP },
      { y: tier.height / 2, color: PINE_LIGHT },
    ], seed + 10 + index);
    const mesh = addMesh(context, geometry, materials.facet, `minglan-pine-${index}`);
    mesh.position.set(x, baseY + tier.baseY + tier.height / 2, z);
    mesh.scale.setScalar(scale);
  });
}

function buildBoulder(
  context: BuildContext,
  material: THREE.Material,
  x: number,
  surfaceY: number,
  z: number,
  spot: BoulderSpot,
  seed: number,
): void {
  const boulder = new THREE.IcosahedronGeometry(1, 0);
  jitterGeometry(boulder, 0.15, 0.13, seed, 1, 0);
  boulder.scale(spot.scaleX, spot.scaleY, spot.scaleZ);
  const geometry = facetize(boulder, [
    { y: -spot.scaleY, color: BOULDER_LOW },
    { y: spot.scaleY * 0.85, color: BOULDER_HIGH },
  ], seed + 1);
  const mesh = addMesh(context, geometry, material, 'minglan-boulder');
  mesh.position.set(x, surfaceY - PROP_SINK + spot.scaleY * 0.5, z);
  mesh.rotation.set(spot.tiltX, (seed % 100) / 100 * Math.PI * 2, spot.tiltZ);
}

type PineMaterials = {
  facet: THREE.Material;
};

function buildIsland(
  context: BuildContext,
  feature: TerrainFeatureConfig,
  shared: SharedMaterials,
): void {
  const radius = (feature.width ?? 0) / 2;
  const height = feature.height ?? 5;
  const seed = hashString(feature.id);
  const centerX = feature.x;
  const centerZ = feature.z;

  const dome = addMesh(context, buildIslandDomeGeometry(radius, height, seed), shared.facet, feature.id);
  dome.position.set(centerX, 0, centerZ);

  const rim = addMesh(context, buildSandRimGeometry(radius, seed), shared.facet, `${feature.id}-sand-rim`);
  rim.position.set(centerX, SAND_RIM_Y, centerZ);

  const skirt = addMesh(context, buildSkirtGeometry(radius, seed), shared.skirt, `${feature.id}-skirt`);
  skirt.position.set(centerX, SKIRT_TOP_Y - (SKIRT_TOP_Y - SKIRT_BOTTOM_Y) / 2, centerZ);

  const decor = ISLE_DECOR[feature.id];
  if (!decor) return;
  (decor.pines ?? []).forEach((pine, index) => {
    const distance = Math.hypot(pine.offsetX, pine.offsetZ);
    const baseY = isleSurfaceY(height, radius, distance) - PROP_SINK;
    buildPine(context, { facet: shared.facet }, centerX + pine.offsetX, baseY, centerZ + pine.offsetZ, pine.scale, seed + 100 + index * 10);
  });
  (decor.boulders ?? []).forEach((boulder, index) => {
    const distance = Math.hypot(boulder.offsetX, boulder.offsetZ);
    buildBoulder(
      context,
      shared.facet,
      centerX + boulder.offsetX,
      isleSurfaceY(height, radius, distance),
      centerZ + boulder.offsetZ,
      boulder,
      seed + 200 + index * 10,
    );
  });
  if (decor.lighthouse) {
    const distance = Math.hypot(decor.lighthouse.offsetX, decor.lighthouse.offsetZ);
    const baseY = isleSurfaceY(height, radius, distance) - PROP_SINK + 0.05;
    const x = centerX + decor.lighthouse.offsetX;
    const z = centerZ + decor.lighthouse.offsetZ;
    const shaftGeometry = new THREE.CylinderGeometry(0.34, 0.46, 2.4, 8);
    const shaft = addMesh(context, shaftGeometry, shared.lighthouseWhite, `${feature.id}-lighthouse-shaft`);
    shaft.position.set(x, baseY + 1.2, z);
    const capGeometry = new THREE.ConeGeometry(0.6, 0.62, 8);
    const cap = addMesh(context, capGeometry, shared.lighthouseCap, `${feature.id}-lighthouse-cap`);
    cap.position.set(x, baseY + 2.4 + 0.31, z);
    const windowGeometry = new THREE.BoxGeometry(0.22, 0.3, 0.22);
    const window = addMesh(context, windowGeometry, shared.lighthouseWindow, `${feature.id}-lighthouse-window`);
    window.position.set(x + 0.38, baseY + 1.55, z + 0.18);
  }
}

function buildHeadland(context: BuildContext, feature: TerrainFeatureConfig, shared: SharedMaterials): void {
  const hills = HEADLAND_HILLS[feature.id];
  if (!hills) return;
  // 雾霾烘焙进色阶：山脚冷灰绿 → 山腰浅雾 → 峰顶淡岩色（比离岛更浅更冷）。
  const palette = feature.id === 'headland-nw'
    ? [HILL_NW_LOW, HILL_NW_MID, HILL_NW_HIGH]
    : [HILL_SW_LOW, HILL_SW_MID, HILL_SW_HIGH];
  const seedBase = hashString(feature.id);
  hills.forEach((hill, index) => {
    const cone = new THREE.ConeGeometry(hill.radius, hill.height, hill.segments, 1, true);
    jitterGeometry(cone, hill.radius * 0.05, hill.height * 0.035, seedBase + index, hill.height / 2, 0.25);
    // 锥体局部 y ∈ [-h/2, h/2]：三档色阶均布其上。
    const stops: ColorStop[] = palette.map((color, stopIndex) => ({
      y: -hill.height / 2 + (hill.height * stopIndex) / (palette.length - 1),
      color,
    }));
    const geometry = facetize(cone, stops, seedBase + 50 + index);
    const mesh = addMesh(context, geometry, shared.facet, `${feature.id}-hill-${index}`);
    mesh.position.set(feature.x + hill.offsetX, SKIRT_BOTTOM_Y + hill.height / 2, feature.z + hill.offsetZ);
  });
}

function buildOuterSea(context: BuildContext, feature: TerrainFeatureConfig, material: THREE.Material): void {
  const oceanGeometry = new THREE.PlaneGeometry(feature.width ?? 900, feature.depth ?? 900);
  oceanGeometry.rotateX(-Math.PI / 2);
  const ocean = addMesh(context, oceanGeometry, material, feature.id);
  ocean.position.set(feature.x, feature.height ?? OCEAN_Y_FALLBACK, feature.z);
}

type SharedMaterials = {
  facet: THREE.MeshStandardMaterial;
  skirt: THREE.MeshStandardMaterial;
  lighthouseWhite: THREE.MeshStandardMaterial;
  lighthouseCap: THREE.MeshStandardMaterial;
  lighthouseWindow: THREE.MeshStandardMaterial;
  ocean: THREE.MeshLambertMaterial;
};

function createSharedMaterials(): SharedMaterials {
  return {
    // 白基色 + 顶点色：所有折面体块共用一份材质，色斑烘焙在几何里。
    facet: new THREE.MeshStandardMaterial({ color: 0xffffff, vertexColors: true, flatShading: true, roughness: 0.96, metalness: 0 }),
    skirt: new THREE.MeshStandardMaterial({ color: SKIRT_TEAL, flatShading: true, roughness: 1, metalness: 0 }),
    lighthouseWhite: new THREE.MeshStandardMaterial({ color: LIGHTHOUSE_WHITE, flatShading: true, roughness: 0.6, metalness: 0 }),
    lighthouseCap: new THREE.MeshStandardMaterial({ color: LIGHTHOUSE_CAP, flatShading: true, roughness: 0.7, metalness: 0 }),
    // 灯窗：静态自发光，真实光源不建（远处小体量，纯点缀）。
    lighthouseWindow: new THREE.MeshStandardMaterial({
      color: 0x40301c,
      emissive: LIGHTHOUSE_GLOW,
      emissiveIntensity: 1.5,
      roughness: 0.6,
    }),
    ocean: new THREE.MeshLambertMaterial({ color: OUTER_OCEAN_COLOR }),
  };
}

/** 创建明澜外海（离岛 + 岬角 + 外海底层水面），一次性加入场景。 */
export function createMinglanIsles(options: MinglanIslesOptions): MinglanIslesHandle {
  const object = new THREE.Group();
  object.name = 'minglan-isles';
  const context: BuildContext = {
    group: object,
    geometries: new Set<THREE.BufferGeometry>(),
    materials: new Set<THREE.Material>(),
  };
  const shared = createSharedMaterials();

  for (const feature of MINGLAN_ISLES) {
    if (feature.kind === 'island') buildIsland(context, feature, shared);
    else if (feature.kind === 'mountain') buildHeadland(context, feature, shared);
    else if (feature.kind === 'sea') buildOuterSea(context, feature, shared.ocean);
  }

  options.scene.add(object);

  return {
    object,
    dispose() {
      object.parent?.remove(object);
      for (const geometry of context.geometries) geometry.dispose();
      for (const material of context.materials) material.dispose();
      context.geometries.clear();
      context.materials.clear();
    },
  };
}
