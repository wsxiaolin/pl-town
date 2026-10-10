// 世界地形共享材质与逐面烘焙（v7 从 mountainRanges.ts 抽出）：山体、崖壁
// 与城缘草甸共用同一套「三平面程序纹理混合」管线，保证贴图尺度、分带
// 权重与色调在所有地形要素上一致。
//
// - createTerrainFacetMaterial：MeshStandardMaterial + onBeforeCompile 三平面
//   纹理混合（'grass'/'stone'/'snow_ground'，proceduralTextureLibrary 公开
//   API 取图、与 createCitySurfaces 共用同一 ResourcePool 缓存）。混合权重
//   在片元着色器里按世界坐标高度占比 + 坡度（面法线 y）+ 低频 3D 噪声
//   smoothstep 计算；世界空间三平面 UV，≈3.2 世界单位/格。v7 在岩壁权重
//   上叠加沉积岩层理（strata）：世界高度正弦条带经低频噪声扰动相位，
//   只调制岩石颜色明度——崖壁读作层积岩而非均质陡坡。
// - bakeFacetTintAndBand：逐面顶点色（色调 × ±6% 明度抖动 × 北/东坡面冷色
//   偏移）+ aBand (高度占比, 雪线) 烘焙，供片元分带与雪线使用。
// - terrainChainTint：链级色调（配置色向白混合），有纹理时保持轻微、
//   回退时加强。
import * as THREE from 'three';
import { mulberry32 } from './massifGeometry';

// 三平面纹理世界尺度：v5 从 5 收到 3.2（单位面积纹理格数 ×2.4）。
export const TERRAIN_TEXTURE_SCALE = 3.2;
// aBand.y 的「无雪带」哨兵值：雪线 smoothstep 永远达不到。
export const NO_SNOW_BAND = 99;

export type TerrainShaderUniforms = {
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

export function createTerrainFacetMaterial(uniforms: TerrainShaderUniforms): THREE.MeshStandardMaterial {
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
  // v7 沉积岩层理：世界高度正弦条带 + 低频噪声扰动相位，只在岩壁
  // 权重上调制明度与冷暖——崖壁读作层积岩，草甸/雪冠不受影响。
  float strataPhase = vWorldPos.y * 0.85
    + terrainValueNoise(vWorldPos * vec3(0.09, 0.045, 0.09) + vec3(3.7)) * 4.2;
  float strata = sin(strataPhase);
  rockCol *= 1.0 + strata * vec3(0.062, 0.05, 0.07) * rockW;
  diffuseColor.rgb *= grassCol * grassW + rockCol * rockW + snowCol * snowW;
}`,
      );
  };
  // 两份材质（山体/崖壁）共用同一份着色器源与 uniform 结构，仅
  // uAllRock 值不同 —— 固定 cacheKey 让 three 复用同一程序。
  material.customProgramCacheKey = () => 'lanping-terrain-triplanar-v1';
  return material;
}

export function createPlainFacetMaterial(): THREE.MeshStandardMaterial {
  // 纹理库不可用（纹理渲染关闭等）时的回退：纯顶点色色调（烘焙时加强）。
  return new THREE.MeshStandardMaterial({
    color: 0xffffff,
    vertexColors: true,
    flatShading: true,
    roughness: 0.96,
    metalness: 0,
  });
}

export type FacetBake = {
  height: number;
  /** 雪线高度占比（0..1）；null = 该峰无雪带（aBand.y 烘成 NO_SNOW_BAND）。 */
  snowLine: number | null;
  /** 链级色调（配置色向白混合），纹理提供细节，顶点色提供色调与色斑。 */
  tint: THREE.Color;
};

/**
 * 逐面烘焙两组顶点属性（要求非索引几何：每 3 个连续顶点为一个面）：
 * - color：tint × ±6% 明度抖动 × 北/东坡面轻微冷色偏移（大气散射背光面）。
 * - aBand (vec2)：x = 面心高度占比，y = 该峰雪线占比（或 NO_SNOW_BAND）。
 */
export function bakeFacetTintAndBand(geometry: THREE.BufferGeometry, bake: FacetBake, jitterSeed: number): void {
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

/** 链级色调：配置色向白混合。有纹理时轻微（0.3），回退时加强（0.85）。 */
export function terrainChainTint(colorHex: number, tintStrength: number): THREE.Color {
  return new THREE.Color(colorHex).lerp(new THREE.Color(0xffffff), 1 - tintStrength);
}

function smoothStep(edge0: number, edge1: number, x: number): number {
  const t = Math.min(1, Math.max(0, (x - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
}

function clamp01(x: number): number {
  return Math.min(1, Math.max(0, x));
}
