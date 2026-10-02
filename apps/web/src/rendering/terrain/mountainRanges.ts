// 岚屏岭低多边形山脉渲染器。配置先行：逐条消费
// city/data/terrain/range-lanping.ts 的 LANPING_RANGE（1:1 映射）。
//
// 视觉参照 CG 启动图（assets/cg/echo/mountain-promise.png、observatory-song.png）：
// 棱面 flat-shading 山峰按「麓丘 → 主脊 → 远脊」三排纵深排布，大气透视
// 直接烘进配置颜色（远脊更亮更冷，场景不加 fog）；山麓/岭肩散布
// observatory-song 式叠锥针叶松。
//
// 实现约定（对齐 westBeach.ts / AGENTS.md）：
// - 工厂不往 scene 添加任何对象，只返回 object，由调用方挂接；dispose()
//   负责从父节点移除并释放本模块创建的全部 geometry 与共享 material。
// - 所有 material 按 hex 共享缓存，因此没有非共享材质，不标记
//   userData.dynamicMaterial（该约定仅用于非共享材质的场景级清扫）。
// - 山体是埋入 y=0 的三维体块（基环统一压到 y=-0.35 以下），不存在
//   贴地水平面，不参与 SURFACE_Y 体系，无远镜头 z-fighting 风险。
// - 全部随机量来自 id 哈希 + 固定种子的 mulberry32，绝不使用 Math.random。
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { LANPING_RANGE } from '../../city/data/terrain/range-lanping';
import type { TerrainFeatureConfig } from '../../city/data/terrain/_types';

export type MountainTerrainOptions = { scene: THREE.Scene };

export type MountainTerrainHandle = {
  object: THREE.Group;
  dispose(): void;
};

// 固定全局种子：与 id 哈希混合，保证任何一次构建结果完全一致。
const GLOBAL_SEED = 0x1a2b3c4d;
// 澜溪走廊折线（与河流地形协作方的边界协议一致）：松树散布的安全网，
// 距折线 < RIVER_CLEARANCE 的树位直接跳过。
const RIVER_POLYLINE: ReadonlyArray<readonly [number, number]> = [
  [62, -52], [40, -58], [16, -56], [-8, -64], [-26, -66], [-42, -70], [-54, -72], [-62, -74],
];
const RIVER_CLEARANCE = 11;
// 峰体基座埋入深度：保证抖动后的底环永远在地表以下，不露缝隙。
const BASE_BURY = 0.35;
// 松树沿坡面放置时的下沉量：底面略埋入地表/坡面，永不悬浮。
const PINE_SINK = 0.06;
// 松树只落在麓肩带：地表高度超过该值的候选点跳过（不把树种到峰顶附近）。
const MAX_PINE_GROUND_Y = 6.5;
// 双峰与雪冠的确定性阈值（renderHint 之外的外观变体全部由 id 哈希决定）。
const TWIN_SUMMIT_PROBABILITY = 0.3;
const SNOW_CAP_MIN_HEIGHT = 26;

type Vec2 = readonly [number, number];

function hashString(text: string): number {
  // FNV-1a 32bit
  let hash = 0x811c9dc5;
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

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

/** 纯位置哈希噪声：同一同角度/环号永远得到同一值，接缝重复顶点因此同步抖动。 */
function hashNoise(angle: number, ring: number, seed: number): number {
  const value = Math.sin(angle * 127.1 + ring * 311.7 + seed * 74.7) * 43758.5453;
  return (value - Math.floor(value)) * 2 - 1;
}

type JitterOptions = {
  height: number;
  heightSegments: number;
  seed: number;
  radialAmp: number;
  yAmp: number;
  buryBase: number;
};

/** 对 ConeGeometry（底环在 y=0）做确定性顶点抖动，尖顶保持不动。 */
function jitterCone(geometry: THREE.BufferGeometry, options: JitterOptions): THREE.BufferGeometry {
  const { height, heightSegments, seed, radialAmp, yAmp, buryBase } = options;
  const position = geometry.getAttribute('position') as THREE.BufferAttribute;
  const ringTotal = heightSegments + 1;
  for (let index = 0; index < position.count; index += 1) {
    const x = position.getX(index);
    const y = position.getY(index);
    const z = position.getZ(index);
    const radial = Math.hypot(x, z);
    if (radial < 1e-5) continue; // 尖顶保持锐利
    const ring = Math.min(ringTotal - 1, Math.round((y + height / 2) / (height / heightSegments)));
    const angle = Math.atan2(z, x);
    const taper = Math.pow(1 - ring / ringTotal, 1.2);
    const radialNoise = hashNoise(angle, ring, seed);
    const yNoise = hashNoise(angle + 91.7, ring + 17, seed);
    const nextRadial = radial * (1 + radialAmp * taper * radialNoise);
    position.setX(index, Math.cos(angle) * nextRadial);
    position.setZ(index, Math.sin(angle) * nextRadial);
    // 底环整体压到 buryBase（埋地），其余环小幅起伏。
    position.setY(index, ring === 0 ? buryBase : y + yAmp * height * taper * yNoise);
  }
  position.needsUpdate = true;
  geometry.computeVertexNormals();
  geometry.translate(0, height / 2, 0); // 底环移到 y ≈ buryBase，尖顶在 y = height
  return geometry;
}

type PeakBuild = {
  radius: number;
  height: number;
};

function createPeakGeometry(
  peak: PeakBuild,
  rng: () => number,
  radialSegments: number,
  heightSegments: number,
  radialAmp: number,
): THREE.BufferGeometry {
  const geometry = new THREE.ConeGeometry(peak.radius, peak.height, radialSegments, heightSegments, true);
  return jitterCone(geometry, {
    height: peak.height,
    heightSegments,
    seed: rng() * 1000,
    radialAmp,
    yAmp: 0.045,
    buryBase: -BASE_BURY,
  });
}

export function createMountainTerrain(options: MountainTerrainOptions): MountainTerrainHandle {
  void options.scene; // 工厂不挂接场景：调用方决定 object 的挂载点
  const object = new THREE.Group();
  object.name = 'lanping-mountain-terrain';

  const geometries = new Set<THREE.BufferGeometry>();
  const materials = new Map<number, THREE.MeshStandardMaterial>();
  const solidMeshes: THREE.Mesh[] = []; // 供松树贴坡取高（山体 + 崖壁）

  const materialFor = (color: number): THREE.MeshStandardMaterial => {
    const existing = materials.get(color);
    if (existing) return existing;
    const material = new THREE.MeshStandardMaterial({
      color,
      flatShading: true,
      roughness: 0.96,
      metalness: 0,
    });
    materials.set(color, material);
    return material;
  };

  const track = <T extends THREE.BufferGeometry>(geometry: T): T => {
    geometries.add(geometry);
    return geometry;
  };

  function buildMountain(feature: TerrainFeatureConfig): void {
    const color = feature.renderHint?.color ?? 0x648a84;
    const castShadow = feature.renderHint?.castShadow ?? false;
    const material = materialFor(color);
    const rng = mulberry32((hashString(feature.id) ^ GLOBAL_SEED) >>> 0);
    const radius = (feature.width ?? 20) / 2;
    const depthRadius = (feature.depth ?? feature.width ?? 20) / 2;
    const height = feature.height ?? 12;
    const group = new THREE.Group();
    group.name = `peak:${feature.id}`;
    group.position.set(feature.x, 0, feature.z);
    group.rotation.y = rng() * Math.PI * 2;

    const radialSegments = 4 + Math.floor(rng() * 4); // 4..7
    const heightSegments = 2 + Math.floor(rng() * 2); // 2..3
    const main = new THREE.Mesh(track(createPeakGeometry({ radius, height }, rng, radialSegments, heightSegments, 0.15)), material);
    main.name = `${feature.id}:main`;
    main.castShadow = castShadow;
    main.receiveShadow = false;
    main.scale.z = depthRadius / radius;
    group.add(main);
    solidMeshes.push(main);

    // 双峰：部分峰体按 id 哈希叠加一座较小的偏轴副峰，剪影更接近 CG。
    const twin = rng() < TWIN_SUMMIT_PROBABILITY && radius >= 9;
    if (twin) {
      const azimuth = rng() * Math.PI * 2;
      const offset = radius * 0.42;
      const twinRadius = radius * 0.6;
      const twinHeight = height * 0.7;
      const twinGeometry = track(createPeakGeometry(
        { radius: twinRadius, height: twinHeight },
        rng,
        4 + Math.floor(rng() * 3),
        2,
        0.15,
      ));
      const twinMesh = new THREE.Mesh(twinGeometry, material);
      twinMesh.name = `${feature.id}:twin`;
      twinMesh.position.set(Math.cos(azimuth) * offset, 0, Math.sin(azimuth) * offset);
      twinMesh.castShadow = castShadow;
      twinMesh.receiveShadow = false;
      twinMesh.scale.z = depthRadius / radius;
      group.add(twinMesh);
      solidMeshes.push(twinMesh);
    }

    // 雪冠：最高的几座远脊峰顶加一顶浅色岩雪小锥。
    if (height >= SNOW_CAP_MIN_HEIGHT) {
      const capHeight = height * 0.16;
      const capRadius = radius * 0.2;
      const capGeometry = track(jitterCone(
        new THREE.ConeGeometry(capRadius, capHeight, Math.max(5, radialSegments - 1), 1, true),
        { height: capHeight, heightSegments: 1, seed: rng() * 1000, radialAmp: 0.1, yAmp: 0.03, buryBase: -0.15 },
      ));
      const cap = new THREE.Mesh(capGeometry, materialFor(0xe6eef0));
      cap.name = `${feature.id}:cap`;
      cap.position.y = height - capHeight * 0.55;
      cap.castShadow = false;
      cap.receiveShadow = false;
      group.add(cap);
    }

    object.add(group);
  }

  function buildCliff(feature: TerrainFeatureConfig): void {
    const color = feature.renderHint?.color ?? 0x7e8a83;
    const material = materialFor(color);
    const rng = mulberry32((hashString(feature.id) ^ GLOBAL_SEED) >>> 0);
    const radius = (feature.width ?? 12) / 2;
    const height = feature.height ?? 6;
    const geometry = track(createPeakGeometry({ radius, height }, rng, 5, 2, 0.2));
    const crag = new THREE.Mesh(geometry, material);
    crag.name = `crag:${feature.id}`;
    crag.position.set(feature.x, 0, feature.z);
    crag.scale.z = (feature.depth ?? feature.width ?? 12) / (feature.width ?? 12);
    crag.rotation.y = rng() * Math.PI * 2;
    crag.castShadow = feature.renderHint?.castShadow ?? true;
    crag.receiveShadow = false;
    object.add(crag);
    solidMeshes.push(crag);
  }

  // ── 针叶松（observatory-song 式：细干 + 2~3 层叠锥）──────────────
  const TRUNK_COLOR = 0x6e5138;
  function buildPineGeometry(variant: number): THREE.BufferGeometry {
    const parts: THREE.BufferGeometry[] = [];
    const trunk = new THREE.CylinderGeometry(0.05, 0.09, 0.5, 5);
    trunk.translate(0, 0.25, 0);
    parts.push(trunk);
    const stack: Array<[number, number, number]> = variant === 0
      ? [[0.62, 0.95, 0.85], [0.42, 0.8, 1.4]] // 两层冠
      : variant === 1
        ? [[0.58, 0.85, 0.8], [0.44, 0.75, 1.32], [0.28, 0.62, 1.78]] // 三层冠
        : [[0.5, 0.9, 0.82], [0.36, 0.8, 1.36], [0.22, 0.66, 1.8]]; // 窄高冠
    for (const [coneRadius, coneHeight, coneY] of stack) {
      const cone = new THREE.ConeGeometry(coneRadius, coneHeight, 6);
      cone.translate(0, coneY, 0);
      parts.push(cone);
    }
    const merged = mergeGeometries(parts, true) ?? new THREE.BufferGeometry();
    parts.forEach((part) => part.dispose());
    return track(merged);
  }

  function buildForest(feature: TerrainFeatureConfig, pineVariants: THREE.BufferGeometry[]): void {
    const rng = mulberry32((hashString(feature.id) ^ GLOBAL_SEED) >>> 0);
    const foliageMaterial = materialFor(feature.renderHint?.color ?? 0x3c6b50);
    const trunkMaterial = materialFor(TRUNK_COLOR);
    const envelopeRadius = Math.min(feature.width ?? 10, feature.depth ?? 10) / 2;
    const count = 8 + Math.floor(rng() * 7); // 8..14 棵
    const group = new THREE.Group();
    group.name = `forest:${feature.id}`;
    group.position.set(feature.x, 0, feature.z);

    const placed: Vec2[] = [];
    const raycaster = new THREE.Raycaster();
    raycaster.far = 160;
    const down = new THREE.Vector3(0, -1, 0);
    const origin = new THREE.Vector3();

    for (let index = 0; index < count; index += 1) {
      let spot: Vec2 | null = null;
      let spotGroundY = 0;
      for (let attempt = 0; attempt < 60 && !spot; attempt += 1) {
        const angle = rng() * Math.PI * 2;
        const distance = envelopeRadius * Math.sqrt(rng());
        const candidate: Vec2 = [Math.cos(angle) * distance, Math.sin(angle) * distance];
        // 安全网：河流走廊 ±11 内不放树（配置层已保证，渲染层再挡一次）。
        const worldX = feature.x + candidate[0];
        const worldZ = feature.z + candidate[1];
        let riverDistance = Infinity;
        for (let segment = 0; segment + 1 < RIVER_POLYLINE.length; segment += 1) {
          const a = RIVER_POLYLINE[segment];
          const b = RIVER_POLYLINE[segment + 1];
          if (!a || !b) continue;
          const [ax, az] = a;
          const [bx, bz] = b;
          const dx = bx - ax;
          const dz = bz - az;
          const lengthSq = dx * dx + dz * dz;
          const t = Math.max(0, Math.min(1, ((worldX - ax) * dx + (worldZ - az) * dz) / lengthSq));
          riverDistance = Math.min(riverDistance, Math.hypot(worldX - (ax + t * dx), worldZ - (az + t * dz)));
        }
        if (riverDistance < RIVER_CLEARANCE) continue;
        if (placed.some(([px, pz]) => Math.hypot(px - candidate[0], pz - candidate[1]) < 1.1)) continue;

        // 贴坡：向下 raycast 山体/崖壁取地表高度（含抖动后的真实坡面）。
        // 只保留麓肩带（平地与山坡下段）的点位，峰顶附近不放树。
        origin.set(worldX, 80, worldZ);
        raycaster.set(origin, down);
        const hit = raycaster.intersectObjects(solidMeshes, false)[0];
        const groundY = hit ? hit.point.y : 0;
        if (groundY > MAX_PINE_GROUND_Y) continue;
        spot = candidate;
        spotGroundY = groundY;
      }
      if (!spot) continue;
      placed.push(spot);

      const scale = 0.55 + rng() * 0.6;
      const variant = Math.floor(rng() * pineVariants.length) % pineVariants.length;
      const geometry = pineVariants[variant];
      if (!geometry) continue;
      const pine = new THREE.Mesh(geometry, [trunkMaterial, foliageMaterial, foliageMaterial, foliageMaterial]);
      pine.name = `${feature.id}:pine-${index}`;
      pine.position.set(spot[0], spotGroundY - PINE_SINK, spot[1]);
      pine.scale.setScalar(scale);
      pine.rotation.y = rng() * Math.PI * 2;
      pine.castShadow = feature.renderHint?.castShadow ?? true;
      pine.receiveShadow = false;
      group.add(pine);
    }
    object.add(group);
  }

  // 先山体与崖壁（构成可 raycast 的地表），再森林贴坡。
  for (const feature of LANPING_RANGE) {
    if (feature.kind === 'mountain') buildMountain(feature);
    else if (feature.kind === 'cliff') buildCliff(feature);
  }
  object.updateMatrixWorld(true);
  const pineVariants = [0, 1, 2].map((variant) => buildPineGeometry(variant));
  for (const feature of LANPING_RANGE) {
    if (feature.kind === 'forest') buildForest(feature, pineVariants);
  }

  return {
    object,
    dispose(): void {
      object.removeFromParent();
      for (const geometry of geometries) geometry.dispose();
      geometries.clear();
      for (const material of materials.values()) material.dispose();
      materials.clear();
      solidMeshes.length = 0;
    },
  };
}
