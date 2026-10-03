import * as THREE from 'three';
import { MINGLAN_ISLES } from '../../city/data/terrain/sea-minglan';
import type { TerrainFeatureConfig } from '../../city/data/terrain/_types';

// 明澜外海渲染：低多边形离岛 + 远岸岬角群 + 外海底层水面。
// 配置契约见 city/data/terrain/sea-minglan.ts（坐标/清空距核对记录在同文件头注释）。
//
// 视觉基准是 CG 片头图（assets/cg/echo/mountain-promise.png、observatory-song.png）：
// 折面平影体块（逐面烘焙色块）、柔和粉彩、远景把雾霾烘进颜色——
// 因此不用 scene.fog（仓库禁用），远处岬角直接用更浅更冷的色阶。
//
// 岛体/山丘生成器（径向高度场，替代旧抖动 icosahedron/圆锥）：
// - 每个岛/丘是一张圆盘高度场网格（环 8..9 × 圆周 14..18），平面轮廓由
//   角谐波扰动成不规则底缘；离岛用穹顶剖面 h·sqrt(1-(ρ/r)^k)（近椭球、
//   顶部平缓），岬角用尖峰剖面 h·(1-(ρ/r)^k) + 迎坡不对称 + 山脊角谐波；
//   叠加 3 阶周期 value-noise fBm 细节，底环埋到外海底面之下。
// - 几何按 non-indexed 三角形直接发射 + computeVertexNormals()：每三角形
//   独立法线 = 干净折面。
// - 逐面顶点色：离岛按绝对高度分带（水线深青 → 沙滩带 → 草甸渐变 →
//   岩顶，与沙线盘同色的暖沙水线带），岬角按既有三档雾霾色阶分带；
//   逐面 ±6% 明度抖动 + 北/东坡轻微冷色偏移。
// - 灯塔、松树、叠石、沙线盘、水下裙、外海平面等道具与坐标契约全部保留；
//   岛面 props 的落地高度改为直接求值生成器剖面（与网格同一函数），贴面更准。
//
// y 体系（对齐 rendering/layers.ts 的 z-fighting 规则，任意水平面与
// 0 / 0.018 / 0.036 / 0.04 / 0.06 / 0.065 / 0.07 均保持 >0.004 间距）：
//   海面（westBeach，既有）     y = 0.06
//   沙线盘（本文件，唯一新增水平面之一） y = 0.085   （与海面差 0.025）
//   外海底面（本文件，唯一新增水平面之二） y = -0.4   （与地表 y=0 差 0.4）
//   岛穹底环                    y = -0.55  （在外海底面之下，被裙体遮住）
//   岬角山丘底环                y = -1.35  （坡面斜面延伸到海底面之下收尾）
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
const PROP_SINK = 0.45; // 岛面props下沉量（覆盖顶部细节噪声的不确定性）
const ISLE_BURY_Y = -0.55; // 岛穹底环：埋入外海底面（-0.4）之下，被裙体遮住
const HILL_BURY_Y = -0.75; // 岬角山丘底环：局部埋深，世界底缘 = -0.6 + (-0.75)
// 水线沙滩分带（绝对高度）：深青 < 0.2 ≤ 沙滩 < 1.25 ≤ 草甸。
const ISLE_DEEP_BAND_Y = 0.2;
const ISLE_SAND_BAND_Y = 1.25;
// fBm 细节噪声格点密度：角向取整数格，噪声沿圆周周期延拓无缝。
const ISLE_DETAIL_ANGULAR_CELLS = 5;
const ISLE_DETAIL_RADIAL_CELLS = 3;

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

// 岬角群簇内偏移表（相对配置中心；每丘半径 12-16、高 8-15，与配置包络一致）。
// 簇内山丘相互交叠成山脊剪影（CG 折面群山画法）；最东两丘与浪花带
// （westBeach 的 shore-surf，x ≥ -47.4）保持 ≥12 间距（轮廓谐波幅度 ≤10%
// 已计入核对：最大东伸 -61.1，距浪花带 ≥13.7）。
type HeadlandHillSpec = { offsetX: number; offsetZ: number; radius: number; height: number };

const HEADLAND_HILLS: Record<string, readonly HeadlandHillSpec[]> = {
  'headland-nw': [
    { offsetX: -1.5, offsetZ: 4, radius: 15, height: 13 },
    { offsetX: 8.5, offsetZ: -2, radius: 13, height: 10 },
    { offsetX: -12.5, offsetZ: -5, radius: 16, height: 15 },
    { offsetX: 5.5, offsetZ: 9, radius: 12, height: 9 },
    { offsetX: -9.5, offsetZ: 7, radius: 14, height: 11 },
    { offsetX: 9.5, offsetZ: -8, radius: 12, height: 8 },
  ],
  'headland-sw': [
    { offsetX: 2.5, offsetZ: -5.5, radius: 14, height: 12 },
    { offsetX: 8.5, offsetZ: 1.5, radius: 12, height: 9 },
    { offsetX: -8.5, offsetZ: -0.5, radius: 16, height: 14 },
    { offsetX: -2.5, offsetZ: -10.5, radius: 12, height: 8 },
    { offsetX: -10.5, offsetZ: 8.5, radius: 13, height: 10 },
    { offsetX: 9.5, offsetZ: 10.5, radius: 12, height: 8 },
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

/** 角谐波（2/3/5 倍频正弦叠加，相位由种子哈希）：轮廓与带界扰动的基底。 */
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

// 折面顶点抖动：偏移按"量化坐标 + 种子"哈希取值，因此共享/重合顶点
// （索引接缝、PolyhedronGeometry 的逐面复制）获得相同偏移，不会撕开网格。
// 保留给道具类小网格（沙线盘/水下裙/松树/叠石）继续使用。
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
// CG 图里那种"一块一块"的折面色斑即由此而来（道具类小网格继续使用）。
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

// ── 径向高度场（离岛穹顶 / 岬角山丘共用）─────────────────────────

type HillLobe = {
  offsetX: number; // 归一化（除以 radius）的 lobe 圆心
  offsetZ: number;
  radius: number; // 归一化
  k: number; // 剖面指数：穹顶 2.0..2.35，尖峰 1.55..1.95
  leanAngle: number; // 迎坡不对称方向（穹顶为 0）
  lean: number;
  silhouetteAmp: number; // 平面底缘不规则度
  silSeed: number;
  ridgeAmp: number; // 山脊角谐波幅度
  ridgeSeed: number;
};

type HillShape = {
  height: number;
  bury: number; // 底环局部 y（负值 = 埋入海底面之下）
  mode: 'dome' | 'peak';
  detailAmp: number;
  detailSeed: number;
  lobe: HillLobe;
};

/** lobe 在归一化坐标 (xn, zn) 处的高度占比（0..约1.1）。 */
function lobeFraction(lobe: HillLobe, mode: 'dome' | 'peak', xn: number, zn: number): number {
  const dx = xn - lobe.offsetX;
  const dz = zn - lobe.offsetZ;
  const rho = Math.hypot(dx, dz);
  const angle = Math.atan2(dz, dx);
  const silhouette = 1 + lobe.silhouetteAmp * angularHarmonics(angle, lobe.silSeed);
  const rhoN = rho / silhouette;
  if (rhoN >= 1) return 0;
  let profile: number;
  if (mode === 'dome') {
    // 穹顶：sqrt(1-(ρ/r)^k)≈椭球，顶部平缓、水线处收进沙线盘。
    profile = Math.sqrt(Math.max(0, 1 - Math.pow(rhoN, lobe.k)));
  } else {
    // 尖峰：迎坡方向剖面半径拉长 → 缓坡长脊；背坡收短 → 陡峭反坡。
    const stretched = rhoN / (1 + lobe.lean * Math.cos(angle - lobe.leanAngle));
    profile = 1 - Math.pow(stretched, lobe.k);
  }
  if (profile <= 0) return 0;
  // 山脊角谐波：不同方位坡面整体隆起/凹陷，折面投影成放射状脊线。
  return profile * (1 + lobe.ridgeAmp * angularHarmonics(angle, lobe.ridgeSeed));
}

/** 岛/丘表面世界高度：剖面 + fBm 细节 + 底缘埋地过渡。 */
function hillSurfaceY(shape: HillShape, xn: number, zn: number): number {
  const rho = Math.min(Math.hypot(xn, zn), 1);
  const fraction = lobeFraction(shape.lobe, shape.mode, xn, zn);
  const angle = Math.atan2(zn, xn);
  const rimFade = 1 - smoothStep(0.7, 1, rho); // 近底缘细节渐隐，底环干净
  const detail = fbm2(
    (angle / (Math.PI * 2)) * ISLE_DETAIL_ANGULAR_CELLS,
    rho * ISLE_DETAIL_RADIAL_CELLS,
    shape.detailSeed,
    ISLE_DETAIL_ANGULAR_CELLS,
    3,
  ) * shape.detailAmp * rimFade;
  const surfaced = Math.max(0, fraction + detail);
  const buryBlend = Math.pow(rho, 7); // 底环精确落在 bury，向内光滑过渡
  return shape.height * surfaced * (1 - buryBlend) + shape.bury * buryBlend;
}

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
 * computeVertexNormals 得到真正的逐面法线：每个三角形都是一块干净折面。
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

function createIsleProfile(height: number, seed: number): HillShape {
  const random = mulberry32(seed);
  return {
    height,
    bury: ISLE_BURY_Y,
    mode: 'dome',
    detailAmp: 0.035 + random() * 0.02,
    detailSeed: Math.floor(random() * 0x7fffffff),
    lobe: {
      offsetX: 0,
      offsetZ: 0,
      radius: 1,
      k: 2.0 + random() * 0.35, // 穹顶剖面：近椭球、顶部平缓
      leanAngle: 0,
      lean: 0,
      silhouetteAmp: 0.05 + random() * 0.02, // 收敛：水线轮廓不越出沙线盘
      silSeed: Math.floor(random() * 0x7fffffff),
      ridgeAmp: 0.04 + random() * 0.02,
      ridgeSeed: Math.floor(random() * 0x7fffffff),
    },
  };
}

function createHillProfile(height: number, seed: number): HillShape {
  const random = mulberry32(seed);
  return {
    height,
    bury: HILL_BURY_Y,
    mode: 'peak',
    detailAmp: 0.03 + random() * 0.015,
    detailSeed: Math.floor(random() * 0x7fffffff),
    lobe: {
      offsetX: 0,
      offsetZ: 0,
      radius: 1,
      k: 1.55 + random() * 0.4, // 尖峰剖面：凹坡向山脚展开裙摆
      leanAngle: random() * Math.PI * 2,
      lean: random() * 0.16,
      silhouetteAmp: 0.07 + random() * 0.03, // ≤10%：与浪花带间距核对已计入
      silSeed: Math.floor(random() * 0x7fffffff),
      ridgeAmp: 0.06 + random() * 0.04,
      ridgeSeed: Math.floor(random() * 0x7fffffff),
    },
  };
}

// 离岛分带：水线深青 → 沙滩（与沙线盘同色）→ 草甸渐变 → 岩顶。
function isleBandColor(height: number, bandSeed: number): FacetBandPaint {
  const rockLine = Math.max(1.9, height * 0.74);
  return (target, centroidX, centroidY, centroidZ) => {
    const wobble = 0.12 * angularHarmonics(Math.atan2(centroidZ, centroidX), bandSeed);
    const y = centroidY + wobble;
    if (y < ISLE_DEEP_BAND_Y) {
      target.copy(ISLE_DEEP);
    } else if (y < ISLE_SAND_BAND_Y) {
      target.copy(SAND_RIM);
    } else if (y < rockLine) {
      target.copy(ISLE_VEGETATION).lerp(ISLE_SAGE, clamp01((y - ISLE_SAND_BAND_Y) / (rockLine - ISLE_SAND_BAND_Y)));
    } else {
      target.copy(ISLE_ROCK);
    }
  };
}

// 岬角分带：既有三档雾霾色阶按归一化高度过渡（带界谐波扰动）。
function headlandBandColor(
  palette: readonly [THREE.Color, THREE.Color, THREE.Color],
  buryY: number,
  height: number,
  bandSeed: number,
): FacetBandPaint {
  const [low, mid, high] = palette;
  return (target, centroidX, centroidY, centroidZ, _normalX, normalY) => {
    const wobble = 0.04 * angularHarmonics(Math.atan2(centroidZ, centroidX), bandSeed);
    const steep = 1 - clamp01(normalY);
    const band = clamp01((centroidY - buryY) / height + steep * 0.1 + wobble);
    if (band <= 0.5) {
      target.copy(low).lerp(mid, band * 2);
    } else {
      target.copy(mid).lerp(high, (band - 0.5) * 2);
    }
  };
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

  const profile = createIsleProfile(height, seed);
  const rings = radius >= 9 ? 9 : 8;
  const segments = radius >= 9 ? 18 : radius >= 6 ? 16 : 14;
  const domeGeometry = buildRadialFieldGeometry({
    radius,
    rings,
    segments,
    planRadius: (angle) => 1 + profile.lobe.silhouetteAmp * angularHarmonics(angle, profile.lobe.silSeed),
    surfaceY: (xn, zn) => hillSurfaceY(profile, xn, zn),
  });
  paintFacets(domeGeometry, isleBandColor(height, (seed + 0x68bc21) >>> 0), (seed ^ 0x9e3779b9) >>> 0);
  const dome = addMesh(context, domeGeometry, shared.facet, feature.id);
  dome.position.set(centerX, 0, centerZ);

  const rim = addMesh(context, buildSandRimGeometry(radius, seed), shared.facet, `${feature.id}-sand-rim`);
  rim.position.set(centerX, SAND_RIM_Y, centerZ);

  const skirt = addMesh(context, buildSkirtGeometry(radius, seed), shared.skirt, `${feature.id}-skirt`);
  skirt.position.set(centerX, SKIRT_TOP_Y - (SKIRT_TOP_Y - SKIRT_BOTTOM_Y) / 2, centerZ);

  const decor = ISLE_DECOR[feature.id];
  if (!decor) return;
  // 岛面高度：直接求值生成器剖面（与网格同一函数），props 精确贴面。
  const surfaceAt = (offsetX: number, offsetZ: number): number =>
    hillSurfaceY(profile, offsetX / radius, offsetZ / radius);
  (decor.pines ?? []).forEach((pine, index) => {
    const baseY = surfaceAt(pine.offsetX, pine.offsetZ) - PROP_SINK;
    buildPine(context, { facet: shared.facet }, centerX + pine.offsetX, baseY, centerZ + pine.offsetZ, pine.scale, seed + 100 + index * 10);
  });
  (decor.boulders ?? []).forEach((boulder, index) => {
    buildBoulder(
      context,
      shared.facet,
      centerX + boulder.offsetX,
      surfaceAt(boulder.offsetX, boulder.offsetZ),
      centerZ + boulder.offsetZ,
      boulder,
      seed + 200 + index * 10,
    );
  });
  if (decor.lighthouse) {
    const baseY = surfaceAt(decor.lighthouse.offsetX, decor.lighthouse.offsetZ) - PROP_SINK + 0.05;
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
  const palette: readonly [THREE.Color, THREE.Color, THREE.Color] = feature.id === 'headland-nw'
    ? [HILL_NW_LOW, HILL_NW_MID, HILL_NW_HIGH]
    : [HILL_SW_LOW, HILL_SW_MID, HILL_SW_HIGH];
  const seedBase = hashString(feature.id);
  hills.forEach((hill, index) => {
    const profile = createHillProfile(hill.height, seedBase + index * 7919);
    const rings = hill.radius >= 14 ? 9 : 8;
    const segments = hill.radius >= 14 ? 18 : 16;
    const geometry = buildRadialFieldGeometry({
      radius: hill.radius,
      rings,
      segments,
      planRadius: (angle) => 1 + profile.lobe.silhouetteAmp * angularHarmonics(angle, profile.lobe.silSeed),
      surfaceY: (xn, zn) => hillSurfaceY(profile, xn, zn),
    });
    const bandSeed = (seedBase + index * 104729) >>> 0;
    const jitterSeed = (seedBase + index * 104729 + 0x9e3779b9) >>> 0;
    paintFacets(geometry, headlandBandColor(palette, profile.bury, hill.height, bandSeed), jitterSeed);
    // 底环局部 y=-0.75、mesh 挂在 SKIRT_BOTTOM_Y：峰顶世界高度 ≈ h-0.6，
    // 与旧圆锥可见峰高一致；底缘深藏在外海底面（-0.4）之下。
    const mesh = addMesh(context, geometry, shared.facet, `${feature.id}-hill-${index}`);
    mesh.position.set(feature.x + hill.offsetX, SKIRT_BOTTOM_Y, feature.z + hill.offsetZ);
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
