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
  side?: THREE.Side;
  renderOrder?: number;
};

export type AnimatedWaterSurface = {
  water: THREE.Mesh;
  update(elapsedSeconds: number): void;
  setDaylight(value: number, instant?: boolean): void;
};

let sharedWaterNormals: THREE.Texture | null = null;

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
varying vec3 vWorldPosition;
void main() {
  vec4 worldPosition = modelMatrix * vec4(position, 1.0);
  vWorldPosition = worldPosition.xyz;
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
varying vec3 vWorldPosition;

void main() {
  vec2 uv = vWorldPosition.xz * size;
  vec2 uv0 = (uv / 103.0) + vec2(time / 17.0, time / 29.0);
  vec2 uv1 = uv / 107.0 - vec2(time / -19.0, time / 31.0);
  vec2 uv2 = uv / vec2(8907.0, 9803.0) + vec2(time / 101.0, time / 97.0);
  vec2 uv3 = uv / vec2(1091.0, 1027.0) - vec2(time / 109.0, time / -113.0);
  vec4 noise = texture2D(normalSampler, uv0) + texture2D(normalSampler, uv1) + texture2D(normalSampler, uv2) + texture2D(normalSampler, uv3);
  noise = noise * 0.5 - 1.0;
  vec3 surfaceNormal = normalize(noise.xzy * vec3(1.5, 1.0, 1.5));
  float sunDiffuse = max(dot(surfaceNormal, normalize(sunDirection)), 0.0);
  vec3 color = waterColor;
  color += sunColor * pow(sunDiffuse, 6.0) * 0.1;
  gl_FragColor = vec4(color, alpha);
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
};

export function createPondWaterSurface(
  geometry: THREE.BufferGeometry,
  config: PondWaterConfig,
): AnimatedWaterSurface {
  const uniforms: Record<string, THREE.IUniform> = {
    normalSampler: { value: getWaterNormals() },
    time: { value: 0 },
    size: { value: config.size },
    sunDirection: { value: config.sunDirection.clone().normalize() },
    sunColor: { value: config.sunColorDay.clone() },
    waterColor: { value: config.waterColorDay.clone() },
    alpha: { value: config.alpha ?? 1 },
  };
  const material = new THREE.ShaderMaterial({
    uniforms,
    vertexShader: POND_WATER_VERTEX,
    fragmentShader: POND_WATER_FRAGMENT,
    transparent: (config.alpha ?? 1) < 1,
    side: THREE.DoubleSide,
  });
  const water = new THREE.Mesh(geometry, material);
  water.renderOrder = 3;
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
    },
    setDaylight(value, instant = false) {
      daylightTarget = value;
      if (instant) daylight = value;
    },
  };
}
