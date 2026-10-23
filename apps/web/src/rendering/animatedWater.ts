// Shared animated-water factory built on three's mirror Water shader.
// Both the west-beach sea and the city ponds use it; per-surface config
// controls calmness, clarity, color and how fast the ripples drift.
import * as THREE from 'three';
import { Water } from 'three/examples/jsm/objects/Water.js';
import waterNormalsUrl from '../assets/textures/waternormals.jpg';

export type AnimatedWaterConfig = {
  sunDirection?: THREE.Vector3;
  waterColorDay: THREE.Color;
  waterColorNight: THREE.Color;
  sunColorDay: THREE.Color;
  sunColorNight: THREE.Color;
  /** Ripple distortion strength — lower is calmer. */
  distortionScale: number;
  /** Multiplier on the shader time uniform — lower drifts slower. */
  timeScale: number;
  /** Normal-tile density; small surfaces need a higher value to show ripples. */
  size?: number;
  /** Water opacity; below 1 keeps the surface translucent so a shallow bed shows through. */
  alpha?: number;
  /** Fresnel base reflectance — lower reads as clearer water. */
  fresnelBase?: number;
  /** Scalar on the specular highlight strength — lower keeps small calm surfaces from blowing out white. */
  specularScale?: number;
  /** Base brightness mixed in by the reflection term. */
  reflectionBase?: number;
  /** Weight of the mirrored reflection sample — lower reads as clearer water. */
  reflectionWeight?: number;
  /** Mirror render-target resolution; small surfaces can use a tiny target. */
  textureWidth?: number;
  textureHeight?: number;
  /** Optional near-shore color blend for the sea surface. The open sea stays
   *  deep and opaque; from tens of world units offshore the color eases toward
   *  a lighter aqua so the shallows read as lit-through water, with no visible
   *  band edge. Displacement and transparency live on the caller's dedicated
   *  surf strip (see westBeach.ts), not here: this mesh is large, coarse
   *  (1.5 units per column) and double-rendered by the mirror pass, so it must
   *  stay a single opaque, unmoved sheet. */
  shoreBlend?: {
    /** Ribbon span in world units covered by uv.x 0 → 1. */
    ribbonDepth: number;
    /** Distance from the waterline (world units) over which the blend fades. */
    width: number;
  };
  side?: THREE.Side;
  renderOrder?: number;
};

export type AnimatedWaterSurface = {
  water: THREE.Mesh;
  update(elapsedSeconds: number): void;
  setDaylight(value: number, instant?: boolean): void;
};

let sharedWaterNormals: THREE.Texture | null = null;

// Near-shore colour the sea eases toward, simulating lit-through shallows.
// Kept deliberately muted (blue-teal rather than vivid aqua) so the contrast
// with the deep navy open ocean stays low — a saturated tint reads as a
// visible halo or colour band from any zoomed-out view, even with a wide
// smoothstep gradient. Authoring note: must be a *uniform lerped with the
// daylight clock*, not a shader literal — a literal keeps shining at full
// brightness after dark while the rest of the sea dims. Pairs with the surf
// strip in westBeach.ts: this band is deliberately wider than the strip's
// seaward extent (SURF_SEAWARD there, `width` here) so the strip's root fade
// always happens over already-tinted water.
const SHALLOW_TINT_DAY = new THREE.Color(0x1e7a96);
const SHALLOW_TINT_NIGHT = new THREE.Color(0x0e2e3c);

function getWaterNormals(): THREE.Texture {
  if (!sharedWaterNormals) {
    sharedWaterNormals = new THREE.TextureLoader().load(waterNormalsUrl);
    sharedWaterNormals.wrapS = sharedWaterNormals.wrapT = THREE.RepeatWrapping;
  }
  return sharedWaterNormals;
}

function glslFloat(value: number): string {
  return Number.isInteger(value) ? `${value}.0` : `${value}`;
}

// Lightweight animated water for small surfaces. It shares the sea's normal
// tiles and day/night tinting, but renders with a plain shader — no mirror
// render target — so it can never nest the mirror pass that breaks the sea.
const POND_WATER_VERTEX = /* glsl */ `
uniform float time;
uniform float waveHeight;
varying vec3 vWorldPosition;
varying vec2 vUv;
void main() {
  vec4 worldPosition = modelMatrix * vec4(position, 1.0);
  float swellA = sin(dot(worldPosition.xz, vec2(0.18, 0.07)) - time * 1.15);
  float swellB = sin(dot(worldPosition.xz, vec2(-0.11, 0.22)) - time * 0.74 + 1.3);
  worldPosition.y += (swellA * 0.58 + swellB * 0.42) * waveHeight;
  vWorldPosition = worldPosition.xyz;
  vUv = uv;
  gl_Position = projectionMatrix * viewMatrix * worldPosition;
}
`;

const POND_WATER_FRAGMENT = /* glsl */ `
uniform sampler2D normalSampler;
uniform float time;
uniform float size;
uniform vec3 sunDirection;
uniform vec3 sunColor;
uniform vec3 waterColor;
uniform float alpha;
uniform float mouthEnabled;
uniform vec2 mouthRange;
uniform vec3 mouthSeaColor;
varying vec3 vWorldPosition;
varying vec2 vUv;

void main() {
  vec2 uv = vWorldPosition.xz * size;
  vec2 uv0 = (uv / 103.0) + vec2(time / 17.0, time / 29.0);
  vec2 uv1 = uv / 107.0 - vec2(time / -19.0, time / 31.0);
  vec2 uv2 = uv / vec2(8907.0, 9803.0) + vec2(time / 101.0, time / 97.0);
  vec2 uv3 = uv / vec2(1091.0, 1027.0) - vec2(time / 109.0, time / -113.0);
  vec4 noise = texture2D(normalSampler, uv0) + texture2D(normalSampler, uv1) + texture2D(normalSampler, uv2) + texture2D(normalSampler, uv3);
  noise = noise * 0.5 - 1.0;
  vec3 surfaceNormal = normalize(noise.xzy * vec3(1.5, 1.0, 1.5));
  vec3 lightDir = normalize(sunDirection);
  float sunDiffuse = max(dot(surfaceNormal, lightDir), 0.0);
  vec3 viewDir = normalize(cameraPosition - vWorldPosition);
  vec3 halfDir = normalize(lightDir + viewDir);
  float specular = pow(max(dot(surfaceNormal, halfDir), 0.0), 48.0);
  float fresnel = pow(1.0 - clamp(dot(viewDir, surfaceNormal), 0.0, 1.0), 4.0);
  vec3 color = waterColor;
  color += sunColor * sunDiffuse * 0.12;
  color += sunColor * specular * 0.22;
  color = mix(color, mix(waterColor, sunColor, 0.35), fresnel * 0.28);
  // 河口羽流渐变（mouthEnabled = 1 时生效，其余水面走原路径）：从
  // mouthRange.x（河口侧）向 mouthRange.y（海内，x 更小）把 alpha 渐隐
  // 至 0、水色混向 mouthSeaColor —— 河水以楔形羽流没入海面，取代两种
  // 水体之间生硬的几何边界。前 1/4 保持满色，让湾口仍是"水"而非"雾"。
  float outAlpha = alpha;
  if (mouthEnabled > 0.5) {
    float t = clamp((vWorldPosition.x - mouthRange.x) / (mouthRange.y - mouthRange.x), 0.0, 1.0);
    float ease = smoothstep(0.25, 1.0, t);
    outAlpha *= 1.0 - ease;
    color = mix(color, mouthSeaColor, ease * 0.7);
  }
  gl_FragColor = vec4(color, outAlpha);
}
`;

export type PondWaterConfig = {
  sunDirection: THREE.Vector3;
  waterColorDay: THREE.Color;
  waterColorNight: THREE.Color;
  sunColorDay: THREE.Color;
  sunColorNight: THREE.Color;
  timeScale: number;
  size: number;
  alpha?: number;
  /** 轻量水面的顶点涌浪幅度（世界单位）。河面保持很小以免切河床；外海可略高。 */
  waveHeight?: number;
  /** 河口入海羽流渐变（可选）。xStart 是河口侧满色满 alpha 的起点，
   *  xEnd（更靠海、更小的 x）是 alpha 归零处；水色沿途混向 seaColor。
   *  仅河口湾等"没入另一片水"的水面使用——普通池塘保持默认直通路径。 */
  mouthFade?: {
    xStart: number;
    xEnd: number;
    seaColorDay: THREE.Color;
    seaColorNight: THREE.Color;
  };
};

export function createPondWaterSurface(
  geometry: THREE.BufferGeometry,
  config: PondWaterConfig,
): AnimatedWaterSurface {
  const mouth = config.mouthFade;
  const uniforms: Record<string, THREE.IUniform> = {
    normalSampler: { value: getWaterNormals() },
    time: { value: 0 },
    size: { value: config.size },
    sunDirection: { value: config.sunDirection.clone().normalize() },
    sunColor: { value: config.sunColorDay.clone() },
    waterColor: { value: config.waterColorDay.clone() },
    alpha: { value: config.alpha ?? 1 },
    waveHeight: { value: config.waveHeight ?? 0.028 },
    mouthEnabled: { value: mouth ? 1 : 0 },
    mouthRange: { value: mouth ? new THREE.Vector2(mouth.xStart, mouth.xEnd) : new THREE.Vector2(0, -1) },
    mouthSeaColor: { value: (mouth ? mouth.seaColorDay : new THREE.Color(0x000000)).clone() },
  };
  const material = new THREE.ShaderMaterial({
    uniforms,
    vertexShader: POND_WATER_VERTEX,
    fragmentShader: POND_WATER_FRAGMENT,
    transparent: (config.alpha ?? 1) < 1,
    side: THREE.DoubleSide,
  });
  const water = new THREE.Mesh(geometry, material);
  // Transparent water must never claim the depth buffer. The river bed and the
  // sea can share a shoreline, so depth writes make their result camera-order
  // dependent at grazing angles.
  material.depthWrite = false;
  water.renderOrder = 4;
  water.castShadow = false;
  water.userData.dynamicMaterial = material;

  let daylight = 1;
  let daylightTarget = 1;
  let lastElapsed = 0;

  return {
    water,
    update(elapsedSeconds) {
      const dt = Math.min(Math.max(elapsedSeconds - lastElapsed, 0), 0.1);
      lastElapsed = elapsedSeconds;
      daylight += (daylightTarget - daylight) * Math.min(1, dt * 2.5);
      uniforms['time']!.value = elapsedSeconds * config.timeScale;
      const waterColor = uniforms['waterColor']!.value as THREE.Color;
      waterColor.copy(config.waterColorDay).lerp(config.waterColorNight, 1 - daylight);
      const sunColor = uniforms['sunColor']!.value as THREE.Color;
      sunColor.copy(config.sunColorDay).lerp(config.sunColorNight, 1 - daylight);
      if (mouth) {
        const mouthSeaColor = uniforms['mouthSeaColor']!.value as THREE.Color;
        mouthSeaColor.copy(mouth.seaColorDay).lerp(mouth.seaColorNight, 1 - daylight);
      }
    },
    setDaylight(value, instant = false) {
      daylightTarget = value;
      if (instant) daylight = value;
    },
  };
}

export function createAnimatedWaterSurface(
  geometry: THREE.BufferGeometry,
  config: AnimatedWaterConfig,
): AnimatedWaterSurface {
  const water = new Water(geometry, {
    waterNormals: getWaterNormals(),
    sunDirection: (config.sunDirection ?? new THREE.Vector3(0.5, 0.8, 0.35)).clone().normalize(),
    sunColor: config.sunColorDay.clone(),
    waterColor: config.waterColorDay.clone(),
    distortionScale: config.distortionScale,
    alpha: config.alpha ?? 1,
    textureWidth: config.textureWidth ?? 512,
    textureHeight: config.textureHeight ?? 512,
    side: config.side ?? THREE.DoubleSide,
    fog: false,
  });
  water.renderOrder = config.renderOrder ?? 3;
  water.castShadow = false;
  const material = water.material as THREE.ShaderMaterial;
  if (config.size !== undefined) material.uniforms['size']!.value = config.size;
  if ((config.alpha ?? 1) < 1) material.transparent = true;
  // The stock Water shader reflects the sky almost entirely (rf0 = 0.3, 0.9
  // reflection weight), which washes the surface white. Real water has a
  // fresnel base near 0.02, so lower both to let the body color dominate.
  material.fragmentShader = material.fragmentShader
    .replace('float rf0 = 0.3;', `float rf0 = ${glslFloat(config.fresnelBase ?? 0.02)};`)
    .replace(
      'vec3( 0.1 ) + reflectionSample * 0.9 + reflectionSample * specularLight',
      `vec3( ${glslFloat(config.reflectionBase ?? 0.08)} ) + reflectionSample * ${glslFloat(config.reflectionWeight ?? 0.45)} + reflectionSample * specularLight * ${glslFloat(config.specularScale ?? 1)}`,
    );
  material.needsUpdate = true;
  if (config.shoreBlend) {
    // Keep the reflection plane flat; long-wave slopes change the lighting
    // without moving the sheet through the sand or the mirror clipping plane.
    // Reuse three's Water normals (https://threejs.org/examples/?q=water).
    const normalAnchor = 'vec3 surfaceNormal = normalize( noise.xzy * vec3( 1.5, 1.0, 1.5 ) );';
    if (material.fragmentShader.includes(normalAnchor)) {
      material.fragmentShader = material.fragmentShader.replace(normalAnchor, /* glsl */ `
        float swellA = dot(worldPosition.xz, vec2(0.78, 0.32)) - time * 1.35;
        float swellB = dot(worldPosition.xz, vec2(-0.24, 1.12)) - time * 0.85;
        vec2 swellSlope = vec2(0.78, 0.32) * cos(swellA) * 0.13
          + vec2(-0.24, 1.12) * cos(swellB) * 0.065;
        vec3 surfaceNormal = normalize(noise.xzy * vec3(1.15, 1.0, 1.15)
          + vec3(-swellSlope.x, 0.0, -swellSlope.y));
      `);
    }
    // Near-shore shallow tint, measured in world units rather than uv so the
    // band keeps its width no matter how deep the ribbon geometry runs. The
    // `time` uniform here is already time-scaled by the caller.
    const ribbonDepth = glslFloat(config.shoreBlend.ribbonDepth);
    const width = glslFloat(config.shoreBlend.width);
    // The tint follows the daylight clock via the shoreTint uniform (lerped
    // in update()); declaring it on the material pre-compile means the
    // renderer picks it up like any ShaderMaterial uniform.
    material.uniforms['shoreTint'] = { value: SHALLOW_TINT_DAY.clone() };
    material.onBeforeCompile = (shader) => {
      const vertexAnchor = 'void main() {';
      const fragmentAnchor = 'gl_FragColor = vec4( outgoingLight, alpha );';
      // Validate every anchor before mutating the shaders. Patching only some
      // of them would declare shoreTint/vShoreDist in one stage and not the
      // other, so the shore tint is all-or-nothing.
      if (!shader.vertexShader.includes(vertexAnchor)
        || !shader.fragmentShader.includes(vertexAnchor)
        || !shader.fragmentShader.includes(fragmentAnchor)) {
        console.warn('[animatedWater] shoreBlend shader anchors not found — the shore tint was skipped.');
        return;
      }
      const patchedVertex = shader.vertexShader.replace(
        vertexAnchor,
        /* glsl */ `
        varying float vShoreDist;
        void main() {
          vShoreDist = (1.0 - uv.x) * ${ribbonDepth};`,
      );
      const patchedFragment = shader.fragmentShader
        .replace(
          'void main() {',
          /* glsl */ `
          varying float vShoreDist;
          uniform vec3 shoreTint;
          void main() {`,
        )
        .replace(
          fragmentAnchor,
          /* glsl */ `
          {
            // Two-stage depth gradient: the near band (0-20 world units from
            // shore) blends strongly toward the shallow-water tint, simulating
            // sunlight penetrating the water column over the sand shelf. The
            // outer hint (0-${width} units) adds a faint depth cue across the
            // full ribbon so the open ocean reads as gradually lighter without
            // a visible transition band or hard line at any zoom level. Using
            // a muted tint (see SHALLOW_TINT_DAY) keeps the colour delta small
            // enough that the combined blend is never jarring. Stays opaque —
            // the sea floor and any offshore models must not bleed through.
            vec3 shallowTint = mix(waterColor, shoreTint, 0.62);
            float nearBlend = (1.0 - smoothstep(0.0, 20.0, vShoreDist)) * 0.44;
            float midBlend  = (1.0 - smoothstep(0.0, ${width}, vShoreDist)) * 0.11;
            outgoingLight = mix(outgoingLight, shallowTint, nearBlend + midBlend);
            // Two crossing swell directions at different speeds give a
            // naturally irregular open-ocean surface rather than a single set
            // of parallel corduroy bands. pow(4) broadens the crest peaks so
            // they read as rolling swells visible from the city camera; the
            // crest colour leans slightly brighter than the shore tint for a
            // subtle foam glint without blowing out white.
            float swellA = pow(max(0.0, sin(dot(worldPosition.xz, vec2(0.78, 0.32)) - time * 1.35)), 4.0);
            float swellB = pow(max(0.0, sin(dot(worldPosition.xz, vec2(-0.20, 0.98)) - time * 0.84 + 1.7)), 4.0);
            vec3 crestTint = mix(shoreTint, vec3(0.72, 0.88, 0.95), 0.40);
            // v9 回调（sin 2026-10-12「地面闪烁」复测）：0.068×(0.80+0.48)
            // 双向叠加从城视角读作频闪光斑（同机位帧差 8.8 万像素主体）。
            // 降到 0.046×(0.62+0.38)：峰值亮度 -38%、闪烁频率不变，涌动
            // 特征保留； swelling 斜率（252-255 行顶点法线扰动）不动。
            outgoingLight += crestTint * (swellA * 0.62 + swellB * 0.38) * 0.046;
            gl_FragColor = vec4( outgoingLight, alpha );
          }`,
        );
      shader.vertexShader = patchedVertex;
      shader.fragmentShader = patchedFragment;
    };
  }
  // Keep the marker the scene-interest-points dispose pass looks for.
  water.userData.dynamicMaterial = material;

  // Daylight eases toward the theme-clock target inside update(), so the
  // unlit water shader follows the day/night transition smoothly.
  let daylight = 1;
  let daylightTarget = 1;
  let lastElapsed = 0;

  return {
    water,
    update(elapsedSeconds) {
      const dt = Math.min(Math.max(elapsedSeconds - lastElapsed, 0), 0.1);
      lastElapsed = elapsedSeconds;
      daylight += (daylightTarget - daylight) * Math.min(1, dt * 2.5);
      const uniforms = material.uniforms;
      if (uniforms.time) uniforms.time.value = elapsedSeconds * config.timeScale;
      const waterColor = uniforms.waterColor!.value as THREE.Color;
      waterColor.copy(config.waterColorDay).lerp(config.waterColorNight, 1 - daylight);
      const sunColor = uniforms.sunColor!.value as THREE.Color;
      sunColor.copy(config.sunColorDay).lerp(config.sunColorNight, 1 - daylight);
      // Only the shoreBlend sea carries the shallow tint; ponds never set it.
      if (config.shoreBlend) {
        const shoreTint = uniforms.shoreTint!.value as THREE.Color;
        shoreTint.copy(SHALLOW_TINT_DAY).lerp(SHALLOW_TINT_NIGHT, 1 - daylight);
      }
    },
    setDaylight(value, instant = false) {
      daylightTarget = value;
      if (instant) daylight = value;
    },
  };
}
