// 岚屏岭低多边形山脉渲染器。配置先行：逐条消费
// city/data/terrain/range-lanping.ts 的 LANPING_RANGE（1:1 映射）。
//
// 视觉参照 CG 启动图（assets/cg/echo/mountain-promise.png）：连绵成环的
// 巨型岭链充满地平线——裂瓣形不规则底缘、沿种子轴拉伸的棱线剪影、锐利
// 折面山脊，表面由三平面（triplanar）程序纹理按「海拔 + 坡度 + 低频噪声」
// 混合成草甸/岩壁/雪冠，无二值分带、无锯齿带界；逐面保留轻微明度色斑与
// 北/东坡面冷色偏移作为 AO 式色调（config 颜色 → 向白混合的链级色调，
// 远脊条目自带的浅冷雾霾色阶因此保留）。山体按「麓丘 → 主脊 → 远脊」
// 三排纵深排布；山麓裙摆散布 observatory-song 式叠锥针叶松。
//
// v5 精细化（2026-10-04，sin 反馈「太粗糙、太小、山脚地面缺处理」）：
// - 多峰 massif：主峰外按体量融合 1..3 座沿链轴偏移的副峰（逐点 max），
//   一条配置 = 一段连绵山脉，剪影不再孤立；
// - 网格密度分级翻倍（主脊 22 环 × 40 段）+ 山脊角谐波加 7 倍频小项
//   + fBm 细节格点加密（角 10 / 径 6）+ 纹理尺度 5 → 3.2：同体量下
//   折面数量约 4×，棱线细腻度质变；
// - 麓原裙（piedmont）：每座山脚生成朝城收束（半径 = 审计半径 r，不进
//   城区/导航盒）、背城展开（1.5r）的缓坡基座（最高 1.2..7 单位），
//   山体从麓原上拔起而非「切」进平地；麓原网格进 raycast 集，
//   松树/碎石可贴坡；
// - 坡脚碎石带（talus）：每座山脚散布 3..7 块 flatShading 砾石，
//   打破底缘的几何切割线。
//
// 山体生成器（径向高度场 massif）：
// - 每座峰是一张圆盘高度场网格，半径 r = width/2。平面底盘由 3..5 瓣
//   低频角向噪声扰动（±22..30%，永不圆/椭圆），并沿 id 种子轴拉伸
//   （横轴收窄 1/1.25..1/1.6）使山体读作岭而非圆顶；高度 = 峰型剖面
//   h·(1-ρ^k)（k 2.2..2.8，凹坡陡壁）× 迎坡不对称 × 双频山脊角谐波
//   （主脊 0.12..0.18·h + 偏轴副脊），再叠加 fBm 细节；近底缘细节渐隐、
//   底环统一压到 BASE_BURY 之下。
// - 双峰变体在同一张高度场里融合第二个 lobe（逐点取 max），鞍部连续。
// - 几何按 non-indexed 三角形直接发射 + computeVertexNormals()：真正的
//   逐面法线，棱面干净利落。
// - 表面材质：MeshStandardMaterial + onBeforeCompile 三平面纹理混合
//   （'grass'/'stone'/'snow_ground'，proceduralTextureLibrary 公开 API
//   取图、与 createCitySurfaces 共用同一 ResourcePool 缓存）。混合权重
//   在片元着色器里按世界坐标高度占比 + 坡度（面法线 y）+ 低频 3D 噪声
//   smoothstep 计算；世界空间三平面 UV，≈5 世界单位/格。逐面顶点色作
//   为色调乘子保留。纹理库不可用时回退纯顶点色材质（色调加强）。
// - 世界裙板（apron）：±110 之外的三片 y=0 草地（与地表基面同高、仅
//   相接不重叠），承接外移后的山链基座；不覆盖西侧海域。
//
// 实现约定（对齐 westBeach.ts / AGENTS.md）：
// - 工厂不往 scene 添加任何对象，只返回 object，由调用方挂接；dispose()
//   负责从父节点移除并释放本模块创建的全部 geometry 与 material。经纹理
//   库取得的纹理归 ResourcePool 所有，一律不在本模块释放。
// - material 在工厂内共享（山体/崖壁/裙板各一份 + 按 hex 缓存的松树
//   实色材质），不标记 userData.dynamicMaterial（该约定仅用于非共享
//   材质的场景级清扫）。
// - 山体是埋入 y=0 的三维体块（基环统一压到 y=-0.35 以下），裙板与
//   地表基面同为 SURFACE_Y.base=0、仅边缘相接，均无远镜头 z-fighting。
// - 全部随机量来自 id 哈希 + 固定种子的 mulberry32 / 整数格点哈希，
//   绝不使用 Math.random（纹理库 canvas 生成器内部的 Math.random 是
//   既有行为，与本模块无关）。
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { LANPING_RANGE } from '../../city/data/terrain/range-lanping';
import type { TerrainFeatureConfig } from '../../city/data/terrain/_types';
import { getActiveProceduralTextureLibrary } from '../proceduralTextureLibrary';
import { RENDER_ORDER, SURFACE_Y } from '../layers';

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
const PINE_SINK = 0.06;
// 松树只落在坡脚带：地表高度超过该值的候选点跳过。v5 麓丘 h 32..58，
// 麓原最高抬 7——坡面在 ~55% 半径外即超过旧阈值 12，放宽到 22
// （树群配置点已对准麓原缓坡带）。
const MAX_PINE_GROUND_Y = 22;
// 多峰 massif：主峰外按体量融合 1..3 座副峰（沿主峰拉伸轴 ± 偏移，
// 逐点 max，鞍部连续）。副峰包络被主峰半径 r 完全包含（偏移 + 副半径
// ≤ 0.75 + 0.64 < 1.0，审计安全不变）。
const MULTI_SUMMIT_MAX_RADIUS = 40; // 主峰 r ≥ 40：2..3 副峰
const MULTI_SUMMIT_MIN_RADIUS = 18; // 主峰 r ≥ 18：1..2 副峰
const MULTI_SUMMIT_SMALL_PROBABILITY = 0.3; // 小丘：30% 概率单副峰
// 雪带下限：只有海拔达到该值的峰出雪。v5 主脊 h 104..208、麓丘 h 32..58，
// 抬高到 44（溪谷侧丘 13..24 永不出雪，麓丘保持草甸-岩壁，主脊全面雪冠）。
const SNOW_MIN_PEAK_HEIGHT = 44;
// 三平面纹理世界尺度：v5 从 5 收到 3.2（单位面积纹理格数 ×2.4）。
const TERRAIN_TEXTURE_SCALE = 3.2;
// aBand.y 的「无雪带」哨兵值：雪线 smoothstep 永远达不到。
const NO_SNOW_BAND = 99;

// ── 世界裙板（apron）────────────────────────────────────────────
// createCitySurfaces farMat 配方（220×220 / repeat 24 → ≈9.17 单位/格）
// 换算到裙板尺寸；色调比白昼 farMat(0xd8d4cc) 略暗（远处压暗可接受；
// 夜间主题同步只遍历 groundMats 数组，裙板不参与，色差有限）。
const APRON_TEXTURE_KEY = 'ground6';
const APRON_COLOR = 0xcdc9c0;
const APRON_TILES_PER_UNIT = 24 / 220;
// 三片裙板：与既有 220×220 地表基面（±110）同高（SURFACE_Y.base=0）、
// 仅边缘相接不重叠；东瓣 z 收到 ±110 与北/南瓣相接，避免三瓣之间
// 共面重叠（远镜头 z-fighting，AGENTS.md 红线）；西缘止于 x=-260，
// 不进入西侧海域（海面本体 x∈[-140,-42], z∈[-112,112]）。
const APRON_LOBES: ReadonlyArray<readonly [number, number, number, number]> = [
  // [width, depth, centerX, centerZ]
  [520, 310, 0, -265], // 北瓣 x∈[-260,260] z∈[-420,-110]
  [310, 220, 265, 0], // 东瓣 x∈[110,420] z∈[-110,110]
  [520, 310, 0, 265], // 南瓣 x∈[-260,260] z∈[110,420]
];

import {
  BASE_BURY,
  DETAIL_ANGULAR_CELLS,
  DETAIL_RADIAL_CELLS,
  hashString,
  mulberry32,
  hashNoise,
  angularHarmonics,
  angularLobes,
  smoothStep,
  clamp01,
  type Vec2,
  type MassifLobe,
  type MassifShape,
  massifSurfaceY,
  buildRadialFieldGeometry,
} from './massifGeometry';


// ── 逐面顶点色（链级色调 + AO 式明度抖动 + 冷色偏移）+ 着色器分带参数 ──

type FacetBake = {
  height: number;
  /** 雪线高度占比（0..1）；null = 该峰无雪带（aBand.y 烘成 NO_SNOW_BAND）。 */
  snowLine: number | null;
  /** 链级色调（配置色向白混合），纹理提供细节，顶点色提供色调与色斑。 */
  tint: THREE.Color;
};

/**
 * 逐面烘焙两组顶点属性：
 * - color：tint × ±6% 明度抖动 × 北/东坡面轻微冷色偏移（大气散射背光面）。
 * - aBand (vec2)：x = 面心高度占比，y = 该峰雪线占比（或 NO_SNOW_BAND）。
 *   草甸/岩壁/雪冠的混合完全交给片元着色器（smoothstep + 噪声），不再
 *   存在顶点色分带与锯齿带界。
 */
function bakeFacetTintAndBand(geometry: THREE.BufferGeometry, bake: FacetBake, jitterSeed: number): void {
  const position = geometry.getAttribute('position') as THREE.BufferAttribute;
  const normal = geometry.getAttribute('normal') as THREE.BufferAttribute;
  const faceCount = Math.floor(position.count / 3);
  const colors = new Float32Array(position.count * 3);
  const bands = new Float32Array(position.count * 2);
  const random = mulberry32(jitterSeed);
  const tint = new THREE.Color();
  const snowBand = bake.snowLine ?? NO_SNOW_BAND;
  for (let face = 0; face < faceCount; face += 1) {
    const first = face * 3;
    const centroidY = (position.getY(first) + position.getY(first + 1) + position.getY(first + 2)) / 3;
    // non-indexed：同一三角形三顶点法线一致，取第一顶点即面法线。
    const normalX = normal.getX(first);
    const normalZ = normal.getZ(first);
    tint.copy(bake.tint);
    const brightness = 0.94 + random() * 0.12; // ±6% 逐面明度色斑（CG 折面色块）
    const north = smoothStep(0.15, 0.8, -normalZ);
    const east = smoothStep(0.15, 0.8, normalX) * 0.6;
    const cool = Math.min(1, north + east);
    tint.setRGB(
      Math.min(1, tint.r * brightness * (1 - 0.05 * cool)),
      Math.min(1, tint.g * brightness),
      Math.min(1, tint.b * brightness * (1 + 0.05 * cool)),
    );
    const heightFraction = clamp01(centroidY / bake.height);
    for (let corner = 0; corner < 3; corner += 1) {
      const vertex = first + corner;
      colors[vertex * 3] = tint.r;
      colors[vertex * 3 + 1] = tint.g;
      colors[vertex * 3 + 2] = tint.b;
      bands[vertex * 2] = heightFraction;
      bands[vertex * 2 + 1] = snowBand;
    }
  }
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  geometry.setAttribute('aBand', new THREE.BufferAttribute(bands, 2));
}

// ── 三平面程序纹理材质（MeshStandardMaterial + onBeforeCompile）────

type TerrainShaderUniforms = {
  uGrassMap: { value: THREE.Texture | null };
  uRockMap: { value: THREE.Texture | null };
  uSnowMap: { value: THREE.Texture | null };
  uTexScale: { value: number };
  uAllRock: { value: number };
};

/** 片元内低频 3D value noise：带界扰动用，确定性（格点哈希）。 */
const TERRAIN_NOISE_GLSL = `
float terrainHash(vec3 p) {
  p = fract(p * 0.3183099 + vec3(0.71, 0.113, 0.419));
  p *= 17.0;
  return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
}
float terrainValueNoise(vec3 x) {
  vec3 i = floor(x);
  vec3 f = fract(x);
  f = f * f * (3.0 - 2.0 * f);
  return mix(
    mix(mix(terrainHash(i), terrainHash(i + vec3(1.0, 0.0, 0.0)), f.x),
        mix(terrainHash(i + vec3(0.0, 1.0, 0.0)), terrainHash(i + vec3(1.0, 1.0, 0.0)), f.x), f.y),
    mix(mix(terrainHash(i + vec3(0.0, 0.0, 1.0)), terrainHash(i + vec3(1.0, 0.0, 1.0)), f.x),
        mix(terrainHash(i + vec3(0.0, 1.0, 1.0)), terrainHash(i + vec3(1.0, 1.0, 1.0)), f.x), f.y),
    f.z);
}
`;

function createTexturedTerrainMaterial(uniforms: TerrainShaderUniforms): THREE.MeshStandardMaterial {
  const material = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    vertexColors: true,
    flatShading: true,
    roughness: 0.96,
    metalness: 0,
  });
  material.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uniforms);
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nattribute vec2 aBand;\nvarying vec2 vBand;\nvarying vec3 vWorldPos;')
      .replace(
        '#include <begin_vertex>',
        '#include <begin_vertex>\nvBand = aBand;\nvWorldPos = (modelMatrix * vec4(transformed, 1.0)).xyz;',
      );
    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <common>',
        `#include <common>
varying vec2 vBand;
varying vec3 vWorldPos;
uniform sampler2D uGrassMap;
uniform sampler2D uRockMap;
uniform sampler2D uSnowMap;
uniform float uTexScale;
uniform float uAllRock;
${TERRAIN_NOISE_GLSL}`,
      )
      .replace(
        '#include <color_fragment>',
        `#include <color_fragment>
{
  // 世界空间折面法线（flat 折面与光照法线一致）→ 坡度。
  vec3 terrainNormalW = normalize(cross(dFdx(vWorldPos), dFdy(vWorldPos)));
  float terrainSlope = clamp(terrainNormalW.y, 0.0, 1.0);
  float hFrac = vBand.x;
  // 低频 3D 噪声：带界大幅扰动 + 中频细节，杜绝锯齿/二值分带。
  float nLow = terrainValueNoise(vWorldPos * 0.055);
  float nMid = terrainValueNoise(vWorldPos * 0.23 + vec3(7.31, 3.77, 11.13));
  float wobble = (nLow - 0.5) * 2.0;
  // 岩壁：陡坡（slope 低）+ 高海拔缓坡（alpine 裸岩带），双路汇入。
  float steepRock = 1.0 - smoothstep(0.30, 0.52, terrainSlope + 0.12 * (nMid - 0.5));
  float altRock = smoothstep(0.34, 0.58, hFrac + 0.18 * wobble);
  float rockW = clamp(steepRock + 0.75 * altRock, 0.0, 1.0);
  // 雪冠：高海拔 + 缓坡，雪线按 vBand.y（逐峰烘焙）+ 噪声扰动。
  float snowTh = vBand.y + 0.10 * wobble + 0.08 * (nMid - 0.5);
  float snowW = smoothstep(snowTh, snowTh + 0.10, hFrac)
    * smoothstep(0.42, 0.62, terrainSlope + 0.10 * (nMid - 0.5));
  rockW *= 1.0 - snowW;
  float grassW = clamp(1.0 - rockW - snowW, 0.0, 1.0);
  // 崖壁变体：uAllRock=1 → 全岩。
  float colorMask = 1.0 - uAllRock;
  grassW *= colorMask;
  snowW *= colorMask;
  rockW = mix(rockW, 1.0, uAllRock);
  float totalW = grassW + rockW + snowW;
  grassW /= totalW;
  rockW /= totalW;
  snowW /= totalW;
  // 三平面 UV：世界空间 ≈uTexScale 单位/格。草/雪只出现在缓坡
  // （顶投影响即可），岩壁全三平面按 |法线|^4 混合。
  vec3 axisW = pow(abs(terrainNormalW), vec3(4.0));
  axisW /= (axisW.x + axisW.y + axisW.z);
  vec2 uvTop = vWorldPos.xz / uTexScale;
  vec3 grassCol = texture2D(uGrassMap, uvTop).rgb;
  vec3 snowCol = texture2D(uSnowMap, uvTop).rgb;
  vec3 rockCol = texture2D(uRockMap, uvTop).rgb * axisW.y
    + texture2D(uRockMap, vWorldPos.zy / uTexScale).rgb * axisW.x
    + texture2D(uRockMap, vWorldPos.xy / uTexScale).rgb * axisW.z;
  diffuseColor.rgb *= grassCol * grassW + rockCol * rockW + snowCol * snowW;
}`,
      );
  };
  // 两份材质（山体/崖壁）共用同一份着色器源与 uniform 结构，仅
  // uAllRock 值不同 —— 固定 cacheKey 让 three 复用同一程序。
  material.customProgramCacheKey = () => 'lanping-terrain-triplanar-v1';
  return material;
}

function createPlainFacetMaterial(): THREE.MeshStandardMaterial {
  // 纹理库不可用（纹理渲染关闭等）时的回退：纯顶点色色调（烘焙时加强）。
  return new THREE.MeshStandardMaterial({
    color: 0xffffff,
    vertexColors: true,
    flatShading: true,
    roughness: 0.96,
    metalness: 0,
  });
}

export function createMountainTerrain(options: MountainTerrainOptions): MountainTerrainHandle {
  void options.scene; // 工厂不挂接场景：调用方决定 object 的挂载点
  const object = new THREE.Group();
  object.name = 'lanping-mountain-terrain';

  // 纹理：经纹理库公开 API（repeat）取图，与 createCitySurfaces 共用
  // ResourcePool 缓存；纹理归池所有，dispose() 不释放它们。
  const textureLibrary = getActiveProceduralTextureLibrary();
  const grassMap = textureLibrary?.repeat('grass', 1, 1) ?? null;
  const rockMap = textureLibrary?.repeat('stone', 1, 1) ?? null;
  const snowMap = textureLibrary?.repeat('snow_ground', 1, 1) ?? null;
  const hasTerrainTextures = Boolean(grassMap && rockMap && snowMap);

  const geometries = new Set<THREE.BufferGeometry>();
  const ownedMaterials = new Set<THREE.Material>();
  const pineMaterials = new Map<number, THREE.MeshStandardMaterial>();
  const solidMeshes: THREE.Mesh[] = []; // 供松树贴坡取高（山体 + 崖壁）

  const materialFor = (color: number): THREE.MeshStandardMaterial => {
    const existing = pineMaterials.get(color);
    if (existing) return existing;
    const material = new THREE.MeshStandardMaterial({
      color,
      flatShading: true,
      roughness: 0.96,
      metalness: 0,
    });
    pineMaterials.set(color, material);
    ownedMaterials.add(material);
    return material;
  };

  const terrainUniforms: TerrainShaderUniforms = {
    uGrassMap: { value: grassMap },
    uRockMap: { value: rockMap },
    uSnowMap: { value: snowMap },
    uTexScale: { value: TERRAIN_TEXTURE_SCALE },
    uAllRock: { value: 0 },
  };
  const cliffUniforms: TerrainShaderUniforms = { ...terrainUniforms, uAllRock: { value: 1 } };
  // 有纹理：三平面混合材质（山体/崖壁各一份，崖壁全岩）；无纹理：回退
  // 纯顶点色（一份，两处共用——Set 会去重，dispose 安全）。
  const facetMaterial = hasTerrainTextures
    ? createTexturedTerrainMaterial(terrainUniforms)
    : createPlainFacetMaterial();
  const cragMaterial = hasTerrainTextures
    ? createTexturedTerrainMaterial(cliffUniforms)
    : facetMaterial;
  ownedMaterials.add(facetMaterial);
  ownedMaterials.add(cragMaterial);
  // 顶点色调强度：有纹理时保持轻微（纹理提供细节与分带），回退时加强
  // （色调承担链级配色）。
  const tintStrength = hasTerrainTextures ? 0.3 : 0.85;
  const chainTint = (colorHex: number): THREE.Color =>
    new THREE.Color(colorHex).lerp(new THREE.Color(0xffffff), 1 - tintStrength);

  const track = <T extends THREE.BufferGeometry>(geometry: T): T => {
    geometries.add(geometry);
    return geometry;
  };

  // 网格密度按体量分档：主脊更密（棱面更细腻），麓丘/侧丘更省（总面数可控）。
  const densityFor = (radius: number, height: number): { rings: number; segments: number } => ({
    // v5 密度分级翻倍：主脊 22×40（折面 ≈ 4×），麓丘 14×24，侧丘 10×18。
    rings: height >= 60 ? 22 : height >= 30 ? 14 : height >= 15 ? 10 : 8,
    segments: radius >= 45 ? 40 : radius >= 22 ? 24 : radius >= 12 ? 18 : 14,
  });

  function buildMassifShape(height: number, rng: () => number, cliff: boolean): MassifShape {
    const main: MassifLobe = {
      offsetX: 0,
      offsetZ: 0,
      radius: 1,
      heightFraction: 1,
      k: cliff ? 2.4 + rng() * 0.5 : 2.2 + rng() * 0.6,
      elongAxis: rng() * Math.PI * 2,
      elongation: cliff ? 1.3 + rng() * 0.2 : 1.25 + rng() * 0.35,
      leanAngle: rng() * Math.PI * 2,
      lean: rng() * (cliff ? 0.1 : 0.12),
      silhouetteAmp: cliff ? 0.2 + rng() * 0.06 : 0.26 + rng() * 0.08,
      silSeed: Math.floor(rng() * 0x7fffffff),
      ridgeAmp: cliff ? 0.08 + rng() * 0.05 : 0.16 + rng() * 0.08,
      ridgeSeed: Math.floor(rng() * 0x7fffffff),
      ridgeAmp2: (cliff ? 0.04 : 0.08) + rng() * 0.05,
      crest2Shift: 0.5 + rng() * 0.9,
      crest2Seed: Math.floor(rng() * 0x7fffffff),
    };
    return { height, bury: -BASE_BURY, detailAmp: 0.06 + rng() * 0.04, detailSeed: Math.floor(rng() * 0x7fffffff), main, extraLobes: [] };
  }

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

    const shape = buildMassifShape(height, rng, false);

    // 多峰链：副峰沿主峰拉伸轴 ± 偏移（一条配置 = 一段连绵山脉），
    // 逐点 max 融进同一高度场，鞍部连续。副峰包络（偏移 + 副半径
    // ≤ 0.75 + 0.64）被主峰半径 r 完全包含——审计包围盒不变。
    let extraCount = 0;
    if (radius >= MULTI_SUMMIT_MAX_RADIUS) extraCount = 2 + Math.floor(rng() * 2);
    else if (radius >= MULTI_SUMMIT_MIN_RADIUS) extraCount = 1 + Math.floor(rng() * 2);
    else if (rng() < MULTI_SUMMIT_SMALL_PROBABILITY) extraCount = 1;
    for (let index = 0; index < extraCount; index += 1) {
      const along = (index % 2 === 0 ? 1 : -1) * (0.36 + rng() * 0.34);
      const side = (rng() - 0.5) * 0.24;
      const axis = shape.main.elongAxis;
      shape.extraLobes.push({
        offsetX: Math.cos(axis) * along - Math.sin(axis) * side,
        offsetZ: Math.sin(axis) * along + Math.cos(axis) * side,
        radius: 0.42 + rng() * 0.22,
        heightFraction: 0.55 + rng() * 0.3,
        k: 2.2 + rng() * 0.6,
        elongAxis: rng() * Math.PI * 2,
        elongation: 1.25 + rng() * 0.3,
        leanAngle: rng() * Math.PI * 2,
        lean: rng() * 0.1,
        silhouetteAmp: 0.18 + rng() * 0.08,
        silSeed: Math.floor(rng() * 0x7fffffff),
        ridgeAmp: 0.12 + rng() * 0.07,
        ridgeSeed: Math.floor(rng() * 0x7fffffff),
        ridgeAmp2: 0.05 + rng() * 0.04,
        crest2Shift: 0.5 + rng() * 0.9,
        crest2Seed: Math.floor(rng() * 0x7fffffff),
      });
    }

    const density = densityFor(radius, height);
    const silhouette = (angle: number): number =>
      1 + shape.main.silhouetteAmp * angularLobes(angle, shape.main.silSeed);
    const geometry = track(buildRadialFieldGeometry({
      radius,
      rings: density.rings,
      segments: density.segments,
      planRadius: silhouette,
      surfaceY: (xn, zn) => massifSurfaceY(shape, xn, zn),
    }));

    // 雪线：仅高峰出雪，阈值按种子浮动；带界扰动在片元着色器里完成。
    // v5：更高的山 → 更厚的雪（0.38..0.55 起步，v4 为 0.55..0.72）。
    const snowLine = height >= SNOW_MIN_PEAK_HEIGHT ? 0.38 + rng() * 0.17 : null;
    const jitterSeed = Math.floor(rng() * 0x7fffffff);
    bakeFacetTintAndBand(geometry, { height, snowLine, tint: chainTint(colorHex) }, jitterSeed);

    const mesh = new THREE.Mesh(geometry, facetMaterial);
    mesh.name = `${feature.id}:massif`;
    // 巨型山体（height ≥ 40）远超阴影相机范围：投影既不可见也白白消耗
    // depth pass —— 忽略配置 castShadow 提示，不投影也不接收。
    const giant = height >= 40;
    mesh.castShadow = giant ? false : castShadow;
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
    const shape = buildMassifShape(height, rng, true);
    shape.detailAmp = 0.05 + rng() * 0.02; // 崖壁细节更强，读作嶙峋岩体
    const geometry = track(buildRadialFieldGeometry({
      radius,
      rings: 5,
      segments: 12,
      planRadius: (angle) => 1 + shape.main.silhouetteAmp * angularLobes(angle, shape.main.silSeed),
      surfaceY: (xn, zn) => massifSurfaceY(shape, xn, zn),
    }));
    const jitterSeed = Math.floor(rng() * 0x7fffffff);
    // 崖壁整体裁岩色：全岩变体材质（uAllRock=1），高度仅影响 aBand.x。
    bakeFacetTintAndBand(geometry, { height, snowLine: null, tint: chainTint(colorHex) }, jitterSeed);
    const crag = new THREE.Mesh(geometry, cragMaterial);
    crag.name = `crag:${feature.id}`;
    crag.position.set(feature.x, 0, feature.z);
    crag.scale.z = (feature.depth ?? feature.width ?? 12) / (feature.width ?? 12);
    crag.rotation.y = rng() * Math.PI * 2;
    crag.castShadow = feature.renderHint?.castShadow ?? true;
    crag.receiveShadow = false;
    object.add(crag);
    solidMeshes.push(crag);
  }

  // ── 麓原裙（piedmont）：山脚缓坡基座 ─────────────────────────────
  // 「山附近地面也要处理」——每座山（h ≥ 14）脚下一圈缓坡草甸：朝城方向
  // （城心 ≈ (17, -23)）plan 半径收束到 1.0r（审计包围盒零外溢），背城
  // 方向展开到 1.5r；高度 lift = clamp(h×0.035, 1.2, 7) 自山脚（0.55r
  // 内）向外缘（1.05r）smoothstep 缓降，最外一环压到 -0.3 埋地防露边。
  // aBand.x 按 lift×3 归一 → 全部低于草甸/岩壁分界（0.34），纯草甸。
  const PIEDMONT_MIN_HEIGHT = 14;
  const CITY_CENTER: readonly [number, number] = [17, -23];
  const PIEDMONT_GRASS = new THREE.Color(0x86a56a);
  // 河谷带（晨溪河床 + 岸景 + 河口湾，x 含 wobble 余量）：麓原裙不得
  // 铺进河谷——北麓丘/溪谷侧丘的 piedmont 缓坡（y 可达 7）会把河床
  // （y 0.02）/ 河岸（0.024）/ 河面（0.048）整段盖在下面。这些贴谷
  // 的山由 talus 碎石带 + 岸林做山脚衔接，无需麓原。
  const RIVER_VALLEY_BOX = { x0: -62, x1: 68, z0: -110, z1: -86 };

  function buildPiedmont(feature: TerrainFeatureConfig): void {
    const radius = (feature.width ?? 20) / 2;
    const depthRadius = (feature.depth ?? feature.width ?? 20) / 2;
    // 包围盒与河谷带相交 → 跳过（主脊链 z ≤ -135 之外，天然不触发）。
    if (feature.x + radius > RIVER_VALLEY_BOX.x0 && feature.x - radius < RIVER_VALLEY_BOX.x1
      && feature.z + radius > RIVER_VALLEY_BOX.z0 && feature.z - radius < RIVER_VALLEY_BOX.z1) {
      return;
    }
    const rng = mulberry32((hashString(feature.id) ^ 0x70696564) >>> 0); // 'pied'
    const height = feature.height ?? 12;
    const lift = Math.min(7, Math.max(1.2, height * 0.035));
    // 麓原外缘裂瓣：独立种子，±0.16（比山体底缘弱——麓原是柔和过渡）。
    const lobesAmp = 0.1 + rng() * 0.06;
    const lobesSeed = Math.floor(rng() * 0x7fffffff);
    // 朝城收束（cos² 权重）：城向 = 1.0r（审计线，裂瓣幅度随收束归零
    // ——城向半径严格 ≤ r，审计包围盒零外溢），背城 = 1.5r（全幅裂瓣）。
    const squashAngle = Math.atan2(CITY_CENTER[1] - feature.z, CITY_CENTER[0] - feature.x);
    const planRadius = (angle: number): number => {
      const toward = Math.max(0, Math.cos(angle - squashAngle));
      const base = 1.5 - 0.5 * toward * toward;
      return base * (1 + lobesAmp * angularLobes(angle, lobesSeed) * (base - 1) * 2);
    };
    const geometry = track(buildRadialFieldGeometry({
      radius: radius * 1.5,
      rings: 5,
      segments: 22,
      planRadius,
      // xn/zn 以 1.5r 归一：ρ（以 r 计）= hypot(xn,zn) × 1.5。
      surfaceY: (xn, zn) => {
        const rhoR = Math.hypot(xn, zn) * 1.5;
        return lift * (1 - smoothStep(0.55, 1.05, rhoR))
          - 0.3 * smoothStep(0.92, 1.02, rhoR);
      },
    }));
    const jitterSeed = Math.floor(rng() * 0x7fffffff);
    // tint：配置色调向草绿偏 45%——主脊灰青 × 草绿 = 苔原色，麓丘 = 草绿。
    const tint = chainTint(feature.renderHint?.color ?? 0x648a84).lerp(PIEDMONT_GRASS, 0.45);
    bakeFacetTintAndBand(geometry, { height: lift * 3, snowLine: null, tint }, jitterSeed);
    const mesh = new THREE.Mesh(geometry, facetMaterial);
    mesh.name = `${feature.id}:piedmont`;
    // 修复（2026-10-05）：麓原几何以峰心为原点构建，必须摆到 feature 位置
    // ——此前漏了 position，全部 piedmont 堆在世界原点，盖住整个城区与河谷。
    mesh.position.set(feature.x, 0, feature.z);
    mesh.scale.z = depthRadius / radius;
    mesh.castShadow = false;
    mesh.receiveShadow = true;
    object.add(mesh);
    solidMeshes.push(mesh); // 松树/碎石可贴麓原坡面
  }

  // ── 坡脚碎石带（talus）：山脚环形散布的砾石 ──────────────────────
  // 打破山体底缘与麓原之间的几何切割线。贴地用与松树相同的向下 raycast
  // （在山体 + 麓原全部入列后执行）。rho 0.74..0.99 r，全部在审计
  // 包围盒之内，无导航影响（砾石不进 raycast 集）。
  const TALUS_COLORS = [0x8d8679, 0x9d968a] as const;

  function buildTalus(feature: TerrainFeatureConfig, boulderGeometry: THREE.BufferGeometry): void {
    const rng = mulberry32((hashString(feature.id) ^ 0x74616c75) >>> 0); // 'talu'
    const radius = (feature.width ?? 20) / 2;
    const depthRadius = (feature.depth ?? feature.width ?? 20) / 2;
    const count = 3 + Math.floor(rng() * 5);
    const raycaster = new THREE.Raycaster();
    raycaster.far = 160;
    const down = new THREE.Vector3(0, -1, 0);
    const origin = new THREE.Vector3();
    for (let index = 0; index < count; index += 1) {
      const angle = rng() * Math.PI * 2;
      const distR = 0.74 + rng() * 0.25;
      const worldX = feature.x + Math.cos(angle) * distR * radius;
      const worldZ = feature.z + Math.sin(angle) * distR * depthRadius;
      origin.set(worldX, 80, worldZ);
      raycaster.set(origin, down);
      const hit = raycaster.intersectObjects(solidMeshes, false)[0];
      const groundY = hit ? hit.point.y : 0;
      const scale = 0.5 + rng() * 1.7;
      const talusColor = TALUS_COLORS[Math.floor(rng() * TALUS_COLORS.length)] ?? TALUS_COLORS[0]!;
      const boulder = new THREE.Mesh(boulderGeometry, materialFor(talusColor));
      boulder.name = `${feature.id}:talus-${index}`;
      boulder.position.set(worldX, groundY + scale * 0.32, worldZ);
      boulder.scale.set(scale * (0.8 + rng() * 0.5), scale * (0.55 + rng() * 0.4), scale * (0.8 + rng() * 0.5));
      boulder.rotation.set(rng() * Math.PI, rng() * Math.PI, rng() * Math.PI);
      boulder.castShadow = true;
      boulder.receiveShadow = true;
      object.add(boulder);
    }
  }

  // ── 世界裙板：±110 之外的草地延伸，承接外移后的山链基座 ─────────
  function buildApron(): void {
    const apronGroup = new THREE.Group();
    apronGroup.name = 'lanping-mountain-apron';
    for (const [width, depth, centerX, centerZ] of APRON_LOBES) {
      const rx = Math.max(1, Math.round(width * APRON_TILES_PER_UNIT));
      const ry = Math.max(1, Math.round(depth * APRON_TILES_PER_UNIT));
      const map = textureLibrary?.repeat(APRON_TEXTURE_KEY, rx, ry) ?? null;
      // 配方对齐 createCitySurfaces farMat（tex ground6 / roughness 1），
      // 色调略暗于白昼 farMat（远处压暗可接受）。
      const material = new THREE.MeshStandardMaterial({ color: APRON_COLOR, roughness: 1, metalness: 0 });
      if (map) material.map = map;
      ownedMaterials.add(material);
      const geometry = track(new THREE.PlaneGeometry(width, depth));
      const plane = new THREE.Mesh(geometry, material);
      plane.name = `apron:${centerX}:${centerZ}`;
      plane.rotation.x = -Math.PI / 2;
      plane.position.set(centerX, SURFACE_Y.base, centerZ); // 与地表基面同高，仅相接
      plane.receiveShadow = true;
      plane.renderOrder = RENDER_ORDER.base;
      apronGroup.add(plane);
    }
    object.add(apronGroup);
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
        // 只保留坡脚带（平地与山坡下段）的点位，峰顶附近不放树。
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

  // 先山体与崖壁，再麓原裙（贴着山脚长出来，同一遍 raycast 集），
  // 然后裙板，再坡脚碎石（山体+麓原都在 raycast 集后才能贴地），
  // 最后森林贴坡。
  for (const feature of LANPING_RANGE) {
    if (feature.kind === 'mountain') {
      buildMountain(feature);
      if ((feature.height ?? 12) >= PIEDMONT_MIN_HEIGHT) buildPiedmont(feature);
    } else if (feature.kind === 'cliff') {
      buildCliff(feature);
    }
  }
  buildApron();
  object.updateMatrixWorld(true);
  const talusGeometry = track(new THREE.IcosahedronGeometry(1, 0)); // flatShading 碎石块
  for (const feature of LANPING_RANGE) {
    if (feature.kind === 'mountain' && (feature.height ?? 12) >= PIEDMONT_MIN_HEIGHT) buildTalus(feature, talusGeometry);
  }
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
      // 仅释放本模块创建的 material；纹理归 ResourcePool，不在此释放。
      for (const material of ownedMaterials) material.dispose();
      ownedMaterials.clear();
      pineMaterials.clear();
      solidMeshes.length = 0;
    },
  };
}
