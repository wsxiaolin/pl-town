// 岚屏岭低多边形山脉渲染器。配置先行：逐条消费
// city/data/terrain/range-lanping.ts 的 LANPING_RANGE（1:1 映射）。
//
// 视觉参照 CG 启动图（assets/cg/echo/mountain-promise.png、observatory-song.png）：
// 富棱面的 low-poly 山体——不规则底缘剪影、锐利折面山脊线、按海拔分带的
// 草甸/岩壁/雪冠、逐面明度色斑与北/东坡面的轻微冷色偏移。山峰按
// 「麓丘 → 主脊 → 远脊」三排纵深排布，大气透视直接烘进配置颜色（远脊
// 更亮更冷，场景不加 fog）；山麓/岭肩散布 observatory-song 式叠锥针叶松。
//
// 山体生成器（径向高度场 massif，替代旧抖动圆锥）：
// - 每座峰是一张圆盘高度场网格（环 7..10 × 圆周 14..20），半径 r = width/2。
//   平面轮廓由角谐波扰动成不规则底缘；高度 = 峰型剖面 h·(1-(ρ/r)^k)
//   （k≈1.5..2.2，凹坡向山脚展开裙摆）× 迎坡不对称拉伸（lean）× 山脊
//   角谐波（ridge），再叠加 3 阶周期 value-noise fBm 细节；近底缘细节
//   渐隐、高度向埋地线光滑过渡，底环统一压到 BASE_BURY 之下。
// - 双峰变体（id 哈希决定，概率/尺寸门槛与旧版一致）不再叠第二个圆锥，
//   而是在同一张高度场里融合第二个 lobe（逐点取 max），鞍部连续、脊线锐利。
// - 几何按 non-indexed 三角形直接发射 + computeVertexNormals()：每个三角形
//   三个独立顶点，得到真正的逐面法线，棱面干净利落、不依赖共享顶点。
// - 逐面顶点色按「绝对高度 + 坡度」分带：麓草（配置主色）→ 岩壁（配置色
//   降饱和/压暗的 HSL 派生色）→ 雪冠（仅 height ≥ SNOW_MIN_PEAK_HEIGHT 的
//   峰；崖壁整体裁岩色）。带界由角谐波扰动，逐面 ±6% 明度抖动，北/东坡面
//   加轻微冷色偏移。全部带色从 renderHint.color 经 HSL 派生，远脊条目
//   自带的浅冷雾霾色阶因此原样保留（不引入无关色板）。
//
// 实现约定（对齐 westBeach.ts / AGENTS.md）：
// - 工厂不往 scene 添加任何对象，只返回 object，由调用方挂接；dispose()
//   负责从父节点移除并释放本模块创建的全部 geometry 与共享 material。
// - material 模块级共享：棱面顶点色材质一份 + 按 hex 缓存的实色材质
//   （松叶/树干），因此没有非共享材质，不标记 userData.dynamicMaterial
//   （该约定仅用于非共享材质的场景级清扫）。
// - 山体是埋入 y=0 的三维体块（基环统一压到 y=-0.35 以下），不存在
//   贴地水平面，不参与 SURFACE_Y 体系，无远镜头 z-fighting 风险。
// - 全部随机量来自 id 哈希 + 固定种子的 mulberry32 / 整数格点哈希，
//   绝不使用 Math.random。
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
// 晨溪走廊折线 v2（与河流地形协作方的边界协议一致）：松树散布的安全网，
// 距折线 < RIVER_CLEARANCE 的树位直接跳过。v2 改线后河谷在星语北城背后
// （z -95..-99），水半宽收窄到 3，clearance 相应从 11 收到 7.5。
const RIVER_POLYLINE: ReadonlyArray<readonly [number, number]> = [
  [64, -95], [42, -97], [18, -96], [-6, -98], [-28, -97], [-46, -99], [-56, -98],
];
const RIVER_CLEARANCE = 7.5;
// 峰体基座埋入深度：底环永远在地表以下，不露缝隙。
const BASE_BURY = 0.35;
// 松树沿坡面放置时的下沉量：底面略埋入地表/坡面，永不悬浮。
const PINE_SINK = 0.06;
// 松树只落在麓肩带：地表高度超过该值的候选点跳过（不把树种到峰顶附近）。
const MAX_PINE_GROUND_Y = 6.5;
// 双峰变体的确定性阈值（概率与最小主峰半径，与旧版一致）。
const TWIN_SUMMIT_PROBABILITY = 0.3;
const TWIN_MIN_RADIUS = 9;
// 雪带下限：只有海拔达到该值的峰出现雪冠分带（麓丘保持草甸-岩壁）。
const SNOW_MIN_PEAK_HEIGHT = 14;
// fBm 细节噪声格点密度：角向取整数格，噪声沿圆周周期延拓无缝。
const DETAIL_ANGULAR_CELLS = 6;
const DETAIL_RADIAL_CELLS = 3;

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

/** 旧抖动锥遗留的纯位置哈希噪声：松树锥面微抖动仍复用（确定性）。 */
function hashNoise(angle: number, ring: number, seed: number): number {
  const value = Math.sin(angle * 127.1 + ring * 311.7 + seed * 74.7) * 43758.5453;
  return (value - Math.floor(value)) * 2 - 1;
}

// ── 确定性噪声工具（整数格点哈希 → 周期 value noise → fBm）───────────

/** 整数格点哈希，返回 [0,1)。同格点同种子永远同值。 */
function latticeNoise(ix: number, iy: number, seed: number): number {
  let hash = (Math.imul(ix, 0x27d4eb2f) ^ Math.imul(iy, 0x165667b1) ^ Math.imul(seed, 0x9e3779b1)) >>> 0;
  hash = Math.imul(hash ^ (hash >>> 15), 0x85ebca6b) >>> 0;
  hash = Math.imul(hash ^ (hash >>> 13), 0xc2b2ae35) >>> 0;
  hash = (hash ^ (hash >>> 16)) >>> 0;
  return hash / 4294967296;
}

/** 二维 value noise；x 方向按 periodX 取模回绕，沿圆周采样时天然无缝。 */
function valueNoise2(x: number, y: number, seed: number, periodX: number): number {
  const ix = Math.floor(x);
  const iy = Math.floor(y);
  const fx = x - ix;
  const fy = y - iy;
  const ux = fx * fx * (3 - 2 * fx);
  const uy = fy * fy * (3 - 2 * fy);
  const x0 = ((ix % periodX) + periodX) % periodX;
  const x1 = (x0 + 1) % periodX;
  const n00 = latticeNoise(x0, iy, seed);
  const n10 = latticeNoise(x1, iy, seed);
  const n01 = latticeNoise(x0, iy + 1, seed);
  const n11 = latticeNoise(x1, iy + 1, seed);
  return (n00 * (1 - ux) + n10 * ux) * (1 - uy) + (n01 * (1 - ux) + n11 * ux) * uy;
}

/** 2~3 阶 fBm，返回约 [-1,1]。角向频率逐阶翻倍且保持整数周期。 */
function fbm2(x: number, y: number, seed: number, periodX: number, octaves: number): number {
  let amplitude = 1;
  let sum = 0;
  let norm = 0;
  let frequency = 1;
  for (let octave = 0; octave < octaves; octave += 1) {
    sum += amplitude * (valueNoise2(x * frequency, y * frequency, seed + octave * 40503, periodX * frequency) * 2 - 1);
    norm += amplitude;
    amplitude *= 0.5;
    frequency *= 2;
  }
  return sum / norm;
}

/** 角谐波（2/3/5 倍频正弦叠加，相位由种子哈希）：山脊与带界扰动的基底。 */
function angularHarmonics(angle: number, seed: number): number {
  const phase2 = latticeNoise(101, 7, seed) * Math.PI * 2;
  const phase3 = latticeNoise(233, 13, seed) * Math.PI * 2;
  const phase5 = latticeNoise(701, 29, seed) * Math.PI * 2;
  return 0.55 * Math.sin(angle * 2 + phase2) + 0.3 * Math.sin(angle * 3 + phase3) + 0.15 * Math.sin(angle * 5 + phase5);
}

function smoothStep(edge0: number, edge1: number, x: number): number {
  const t = Math.min(1, Math.max(0, (x - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
}

function clamp01(x: number): number {
  return Math.min(1, Math.max(0, x));
}

// ── 径向高度场 massif ───────────────────────────────────────────

/** 单个山体 lobe（主峰或双峰副瓣）。偏移/半径按主峰半径归一化。 */
type MassifLobe = {
  offsetX: number;
  offsetZ: number;
  radius: number;
  heightFraction: number; // 相对 shape.height 的高度比
  k: number; // 峰型剖面指数（1.5..2.2，凹坡）
  leanAngle: number; // 迎坡不对称方向
  lean: number; // 迎坡拉伸量（0..0.2）
  silhouetteAmp: number; // 平面底缘不规则度
  silSeed: number;
  ridgeAmp: number; // 山脊角谐波幅度
  ridgeSeed: number;
};

type MassifShape = {
  height: number;
  bury: number; // 底环 y（负值 = 埋地）
  detailAmp: number; // fBm 细节幅度（相对 height）
  detailSeed: number;
  main: MassifLobe;
  twin: MassifLobe | null;
};

/** lobe 在归一化坐标 (xn, zn) 处的高度占比（0..约1.1）。 */
function lobeFraction(lobe: MassifLobe, xn: number, zn: number): number {
  const dx = xn - lobe.offsetX;
  const dz = zn - lobe.offsetZ;
  const rho = Math.hypot(dx, dz);
  const angle = Math.atan2(dz, dx);
  const silhouette = 1 + lobe.silhouetteAmp * angularHarmonics(angle, lobe.silSeed);
  const rhoN = rho / silhouette;
  if (rhoN >= 1) return 0;
  // 迎坡方向剖面半径拉长 → 缓坡长脊；背坡收短 → 陡峭反坡（不对称 massif）。
  const stretched = rhoN / (1 + lobe.lean * Math.cos(angle - lobe.leanAngle));
  const profile = 1 - Math.pow(stretched, lobe.k);
  if (profile <= 0) return 0;
  // 山脊角谐波：不同方位的坡面整体隆起/凹陷，折面投影成放射状脊线。
  return profile * (1 + lobe.ridgeAmp * angularHarmonics(angle, lobe.ridgeSeed));
}

/** massif 表面世界高度：双 lobe max 融合 + fBm 细节 + 底缘埋地过渡。 */
function massifSurfaceY(shape: MassifShape, xn: number, zn: number): number {
  const rho = Math.min(Math.hypot(xn, zn), 1);
  let fraction = lobeFraction(shape.main, xn, zn);
  if (shape.twin) {
    const twinFraction = lobeFraction(shape.twin, xn, zn) * shape.twin.heightFraction;
    if (twinFraction > fraction) fraction = twinFraction;
  }
  const angle = Math.atan2(zn, xn);
  const rimFade = 1 - smoothStep(0.72, 1, rho); // 近底缘细节渐隐，底环干净
  const detail = fbm2(
    (angle / (Math.PI * 2)) * DETAIL_ANGULAR_CELLS,
    rho * DETAIL_RADIAL_CELLS,
    shape.detailSeed,
    DETAIL_ANGULAR_CELLS,
    3,
  ) * shape.detailAmp * rimFade;
  const surfaced = Math.max(0, fraction + detail);
  const buryBlend = Math.pow(rho, 6); // 底环精确落在 bury，向内光滑过渡
  return shape.height * surfaced * (1 - buryBlend) + shape.bury * buryBlend;
}

// ── 圆盘高度场 → non-indexed 折面网格 ───────────────────────────

type RadialFieldParams = {
  radius: number;
  rings: number;
  segments: number;
  /** 归一化平面轮廓（角谐波不规则底缘），与表面函数共用同一谐波。 */
  planRadius: (angle: number) => number;
  /** 归一化坐标 (xn, zn) → 局部世界高度（含埋地）。 */
  surfaceY: (xn: number, zn: number) => number;
};

function radialFieldVertex(params: RadialFieldParams, ring: number, segment: number, out: THREE.Vector3): void {
  if (ring <= 0) {
    out.set(0, params.surfaceY(0, 0), 0);
    return;
  }
  const rhoN = ring / params.rings;
  const angularOffset = ring % 2 === 0 ? 0 : 0.5; // 奇数环错开半扇区，棱面呈菱形交织
  const wrapped = ((segment % params.segments) + params.segments) % params.segments;
  const angle = ((wrapped + angularOffset) / params.segments) * Math.PI * 2;
  const radial = rhoN * params.radius * params.planRadius(angle);
  const x = Math.cos(angle) * radial;
  const z = Math.sin(angle) * radial;
  out.set(x, params.surfaceY(x / params.radius, z / params.radius), z);
}

/**
 * 圆盘高度场 → non-indexed 三角形网格。逐三角形直接发射顶点（不共享），
 * computeVertexNormals 得到真正的逐面法线：每个三角形都是一块干净棱面。
 */
function buildRadialFieldGeometry(params: RadialFieldParams): THREE.BufferGeometry {
  const positions: number[] = [];
  const apex = new THREE.Vector3();
  const a = new THREE.Vector3();
  const b = new THREE.Vector3();
  const c = new THREE.Vector3();
  const d = new THREE.Vector3();
  const emit = (p: THREE.Vector3, q: THREE.Vector3, r: THREE.Vector3): void => {
    positions.push(p.x, p.y, p.z, q.x, q.y, q.z, r.x, r.y, r.z);
  };
  radialFieldVertex(params, 0, 0, apex);
  for (let segment = 0; segment < params.segments; segment += 1) {
    radialFieldVertex(params, 1, segment, a);
    radialFieldVertex(params, 1, segment + 1, b);
    emit(apex, b, a); // 中心扇面（绕向朝外）
  }
  for (let ring = 1; ring < params.rings; ring += 1) {
    for (let segment = 0; segment < params.segments; segment += 1) {
      radialFieldVertex(params, ring, segment, a);
      radialFieldVertex(params, ring, segment + 1, b);
      radialFieldVertex(params, ring + 1, segment, c);
      radialFieldVertex(params, ring + 1, segment + 1, d);
      emit(a, d, c); // 环间四边形 → 两三角形（绕向朝外）
      emit(a, b, d);
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.computeVertexNormals();
  return geometry;
}

// ── 逐面顶点色（分带 + 抖动 + 冷色偏移）─────────────────────────

type FacetBandPaint = (
  target: THREE.Color,
  centroidX: number,
  centroidY: number,
  centroidZ: number,
  normalX: number,
  normalY: number,
  normalZ: number,
) => void;

/**
 * 逐面烘焙顶点色：bandColor 决定基色，再统一叠加 ±6% 明度抖动与北/东坡面
 * 的轻微冷色偏移（r/b 通道小幅反向移动，模拟大气散射的背光面）。
 */
function paintFacets(geometry: THREE.BufferGeometry, bandColor: FacetBandPaint, jitterSeed: number): void {
  const position = geometry.getAttribute('position') as THREE.BufferAttribute;
  const normal = geometry.getAttribute('normal') as THREE.BufferAttribute;
  const faceCount = Math.floor(position.count / 3);
  const colors = new Float32Array(position.count * 3);
  const random = mulberry32(jitterSeed);
  const tint = new THREE.Color();
  for (let face = 0; face < faceCount; face += 1) {
    const first = face * 3;
    const centroidX = (position.getX(first) + position.getX(first + 1) + position.getX(first + 2)) / 3;
    const centroidY = (position.getY(first) + position.getY(first + 1) + position.getY(first + 2)) / 3;
    const centroidZ = (position.getZ(first) + position.getZ(first + 1) + position.getZ(first + 2)) / 3;
    // non-indexed：同一三角形三顶点法线一致，取第一顶点即面法线。
    const normalX = normal.getX(first);
    const normalY = normal.getY(first);
    const normalZ = normal.getZ(first);
    tint.setRGB(0, 0, 0);
    bandColor(tint, centroidX, centroidY, centroidZ, normalX, normalY, normalZ);
    const brightness = 0.94 + random() * 0.12; // ±6% 逐面明度色斑（CG 折面色块）
    const north = smoothStep(0.15, 0.8, -normalZ);
    const east = smoothStep(0.15, 0.8, normalX) * 0.6;
    const cool = Math.min(1, north + east);
    tint.setRGB(
      Math.min(1, tint.r * brightness * (1 - 0.05 * cool)),
      Math.min(1, tint.g * brightness),
      Math.min(1, tint.b * brightness * (1 + 0.05 * cool)),
    );
    for (let corner = 0; corner < 3; corner += 1) {
      const offset = (first + corner) * 3;
      colors[offset] = tint.r;
      colors[offset + 1] = tint.g;
      colors[offset + 2] = tint.b;
    }
  }
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
}

// ── 山体分带色板（全部由配置色 HSL 派生，远脊雾霾色自动保留）─────

type MassifPalette = {
  grass: THREE.Color;
  rock: THREE.Color;
  rockHigh: THREE.Color;
  snow: THREE.Color;
};

function deriveMassifPalette(hex: number): MassifPalette {
  const hsl = { h: 0, s: 0, l: 0 };
  new THREE.Color(hex).getHSL(hsl);
  return {
    grass: new THREE.Color().setHSL(hsl.h, hsl.s, hsl.l),
    rock: new THREE.Color().setHSL(hsl.h, hsl.s * 0.45, Math.min(0.82, Math.max(0.16, hsl.l * 0.58))),
    rockHigh: new THREE.Color().setHSL(hsl.h, hsl.s * 0.52, Math.min(0.88, hsl.l * 0.8)),
    snow: new THREE.Color().setHSL(hsl.h, hsl.s * 0.12, Math.min(0.93, 0.52 + hsl.l * 0.45)),
  };
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

  // 棱面顶点色材质：全部山体/崖壁共用一份（色斑烘焙在几何顶点色里）。
  const facetMaterial = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    vertexColors: true,
    flatShading: true,
    roughness: 0.96,
    metalness: 0,
  });

  const track = <T extends THREE.BufferGeometry>(geometry: T): T => {
    geometries.add(geometry);
    return geometry;
  };

  // 网格密度按体量分档：主峰更密（棱面更细腻），麓丘更省（总面数可控）。
  const densityFor = (radius: number, height: number): { rings: number; segments: number } => ({
    rings: height >= 24 ? 12 : height >= 16 ? 10 : height >= 10 ? 9 : 7,
    segments: radius >= 18 ? 24 : radius >= 12 ? 20 : radius >= 8 ? 16 : 14,
  });

  function buildMountain(feature: TerrainFeatureConfig): void {
    const colorHex = feature.renderHint?.color ?? 0x648a84;
    const castShadow = feature.renderHint?.castShadow ?? false;
    const rng = mulberry32((hashString(feature.id) ^ GLOBAL_SEED) >>> 0);
    const radius = (feature.width ?? 20) / 2;
    const depthRadius = (feature.depth ?? feature.width ?? 20) / 2;
    const height = feature.height ?? 12;
    const group = new THREE.Group();
    group.name = `peak:${feature.id}`;
    group.position.set(feature.x, 0, feature.z);
    group.rotation.y = rng() * Math.PI * 2;

    // 主瓣：剖面凹度、迎坡不对称、山脊谐波全部由 id 种子决定。
    const shape: MassifShape = {
      height,
      bury: -BASE_BURY,
      detailAmp: 0.035 + rng() * 0.02,
      detailSeed: Math.floor(rng() * 0x7fffffff),
      main: {
        offsetX: 0,
        offsetZ: 0,
        radius: 1,
        heightFraction: 1,
        k: 1.5 + rng() * 0.7,
        leanAngle: rng() * Math.PI * 2,
        lean: rng() * 0.18,
        silhouetteAmp: 0.09 + rng() * 0.05,
        silSeed: Math.floor(rng() * 0x7fffffff),
        ridgeAmp: 0.06 + rng() * 0.05,
        ridgeSeed: Math.floor(rng() * 0x7fffffff),
      },
      twin: null,
    };

    // 双峰：id 哈希决定（概率/门槛同旧版）；副瓣融进同一高度场（max），
    // 鞍部连续，不再是两个相交圆锥。
    if (rng() < TWIN_SUMMIT_PROBABILITY && radius >= TWIN_MIN_RADIUS) {
      const azimuth = rng() * Math.PI * 2;
      shape.twin = {
        offsetX: Math.cos(azimuth) * 0.42,
        offsetZ: Math.sin(azimuth) * 0.42,
        radius: 0.6,
        heightFraction: 0.7,
        k: 1.6 + rng() * 0.5,
        leanAngle: rng() * Math.PI * 2,
        lean: rng() * 0.12,
        silhouetteAmp: 0.08 + rng() * 0.04,
        silSeed: Math.floor(rng() * 0x7fffffff),
        ridgeAmp: 0.05 + rng() * 0.04,
        ridgeSeed: Math.floor(rng() * 0x7fffffff),
      };
    }

    const density = densityFor(radius, height);
    const geometry = track(buildRadialFieldGeometry({
      radius,
      rings: density.rings,
      segments: density.segments,
      planRadius: (angle) => 1 + shape.main.silhouetteAmp * angularHarmonics(angle, shape.main.silSeed),
      surfaceY: (xn, zn) => massifSurfaceY(shape, xn, zn),
    }));

    // 雪线：仅高峰出雪，阈值按种子浮动；带界谐波扰动（bandSeed）。
    const snowLine = height >= SNOW_MIN_PEAK_HEIGHT ? 0.55 + rng() * 0.17 : null;
    const bandSeed = Math.floor(rng() * 0x7fffffff);
    const jitterSeed = Math.floor(rng() * 0x7fffffff);
    const palette = deriveMassifPalette(colorHex);
    const rockLine = 0.45;
    paintFacets(geometry, (target, centroidX, centroidY, centroidZ, _normalX, normalY, normalZ) => {
      const wobble = 0.05 * angularHarmonics(Math.atan2(centroidZ, centroidX), bandSeed);
      const steep = 1 - clamp01(normalY); // 陡坡推向岩带（雪只留缓坡）
      const band = centroidY / height + steep * 0.18 + wobble;
      if (snowLine !== null && band >= snowLine && normalY > 0.42) {
        target.copy(palette.snow);
      } else if (band >= rockLine) {
        target.copy(palette.rock).lerp(palette.rockHigh, clamp01((band - rockLine) * 2.2));
      } else {
        target.copy(palette.grass);
      }
    }, jitterSeed);

    const mesh = new THREE.Mesh(geometry, facetMaterial);
    mesh.name = `${feature.id}:massif`;
    mesh.castShadow = castShadow;
    mesh.receiveShadow = false;
    mesh.scale.z = depthRadius / radius; // 椭圆底座：depth 独立于 width
    group.add(mesh);
    solidMeshes.push(mesh);
    object.add(group);
  }

  function buildCliff(feature: TerrainFeatureConfig): void {
    const colorHex = feature.renderHint?.color ?? 0x7e8a83;
    const rng = mulberry32((hashString(feature.id) ^ GLOBAL_SEED) >>> 0);
    const radius = (feature.width ?? 12) / 2;
    const height = feature.height ?? 6;
    const shape: MassifShape = {
      height,
      bury: -BASE_BURY,
      detailAmp: 0.05 + rng() * 0.02, // 崖壁细节更强，读作嶙峋岩体
      detailSeed: Math.floor(rng() * 0x7fffffff),
      main: {
        offsetX: 0,
        offsetZ: 0,
        radius: 1,
        heightFraction: 1,
        k: 1.8 + rng() * 0.4, // 崖壁整体更陡峭
        leanAngle: rng() * Math.PI * 2,
        lean: rng() * 0.1,
        silhouetteAmp: 0.08 + rng() * 0.04,
        silSeed: Math.floor(rng() * 0x7fffffff),
        ridgeAmp: 0.04 + rng() * 0.03,
        ridgeSeed: Math.floor(rng() * 0x7fffffff),
      },
      twin: null,
    };
    const geometry = track(buildRadialFieldGeometry({
      radius,
      rings: 5,
      segments: 12,
      planRadius: (angle) => 1 + shape.main.silhouetteAmp * angularHarmonics(angle, shape.main.silSeed),
      surfaceY: (xn, zn) => massifSurfaceY(shape, xn, zn),
    }));
    const bandSeed = Math.floor(rng() * 0x7fffffff);
    const jitterSeed = Math.floor(rng() * 0x7fffffff);
    const palette = deriveMassifPalette(colorHex);
    // 崖壁始终裁岩色：仅按高度在两级岩色间过渡，不出草/雪带。
    paintFacets(geometry, (target, centroidX, centroidY, centroidZ, _normalX, normalY) => {
      const wobble = 0.04 * angularHarmonics(Math.atan2(centroidZ, centroidX), bandSeed);
      const steep = 1 - clamp01(normalY);
      const band = clamp01(centroidY / height + steep * 0.15 + wobble);
      target.copy(palette.rock).lerp(palette.rockHigh, clamp01(band * 1.5));
    }, jitterSeed);
    const crag = new THREE.Mesh(geometry, facetMaterial);
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

  /** 叠锥锥面确定性微抖动：打破完美圆锥的机械感，剪影更接近手绘松。 */
  function jitterPineCone(cone: THREE.BufferGeometry, coneRadius: number, seed: number): void {
    const position = cone.getAttribute('position') as THREE.BufferAttribute;
    for (let index = 0; index < position.count; index += 1) {
      const x = position.getX(index);
      const y = position.getY(index);
      const z = position.getZ(index);
      const radial = Math.hypot(x, z);
      if (radial < 1e-5) continue; // 尖顶保持锐利
      const angle = Math.atan2(z, x);
      const ring = Math.round(y * 8);
      const radialNoise = hashNoise(angle * 2.3, ring, seed);
      const yNoise = hashNoise(angle + 41.3, ring + 5, seed);
      const scale = 1 + 0.07 * radialNoise;
      position.setX(index, Math.cos(angle) * radial * scale);
      position.setZ(index, Math.sin(angle) * radial * scale);
      position.setY(index, y + coneRadius * 0.09 * yNoise);
    }
    position.needsUpdate = true;
  }

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
    stack.forEach(([coneRadius, coneHeight, coneY], coneIndex) => {
      const cone = new THREE.ConeGeometry(coneRadius, coneHeight, 7);
      jitterPineCone(cone, coneRadius, (0x51 + variant * 131 + coneIndex * 17) >>> 0);
      cone.translate(0, coneY, 0);
      parts.push(cone);
    });
    const merged = mergeGeometries(parts, true) ?? new THREE.BufferGeometry();
    parts.forEach((part) => part.dispose());
    return track(merged);
  }

  /** 林地基色 → 三档叶色（色相/明度微移），逐树取色增加层次。 */
  function foliageShadeMaterials(baseHex: number): THREE.MeshStandardMaterial[] {
    const hsl = { h: 0, s: 0, l: 0 };
    new THREE.Color(baseHex).getHSL(hsl);
    const shades = [
      new THREE.Color().setHSL(hsl.h, hsl.s, hsl.l),
      new THREE.Color().setHSL((hsl.h + 0.012) % 1, hsl.s, Math.max(0, hsl.l - 0.05)),
      new THREE.Color().setHSL((hsl.h + 0.025) % 1, Math.min(1, hsl.s + 0.02), Math.min(1, hsl.l + 0.045)),
    ];
    return shades.map((shade) => materialFor(shade.getHex()));
  }

  function buildForest(feature: TerrainFeatureConfig, pineVariants: THREE.BufferGeometry[]): void {
    const rng = mulberry32((hashString(feature.id) ^ GLOBAL_SEED) >>> 0);
    const foliageMaterials = foliageShadeMaterials(feature.renderHint?.color ?? 0x3c6b50);
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
        // 安全网：河流走廊 ±7.5 内不放树（配置层已保证，渲染层再挡一次）。
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

        // 贴坡：向下 raycast massif 真实坡面取地表高度。
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
      const shadeIndex = Math.floor(rng() * foliageMaterials.length) % foliageMaterials.length;
      const foliageMaterial = foliageMaterials[shadeIndex];
      if (!foliageMaterial) continue;
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
      facetMaterial.dispose();
      solidMeshes.length = 0;
    },
  };
}
