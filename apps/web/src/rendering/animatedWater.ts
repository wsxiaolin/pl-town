// Shared animated-water factories.
//
// The sea surface (`createAnimatedWaterSurface`) uses a hand-written shader
// instead of three's mirror `Water`: a single scene-wide planar reflection
// target is fragile (nesting mirrors corrupts every surface, see MEMORY) and
// the stock shader washes out under the city's ACES tone mapping. The custom
// shader builds the look from first principles — sun-glitter specular, fresnel
// sky reflection, a depth-driven colour ramp and an animated foam line — which
// reads like real game water and stays cheap enough for software rendering.
//
// `createPondWaterSurface` remains for tiny puddles: same idea, no shore band.
import * as THREE from 'three';
import waterNormalsUrl from '../assets/textures/waternormals.jpg';

export type AnimatedWaterConfig = {
  sunDirection?: THREE.Vector3;
  /** Deep-water body colour, seen offshore. */
  waterColorDay: THREE.Color;
  waterColorNight: THREE.Color;
  sunColorDay: THREE.Color;
  sunColorNight: THREE.Color;
  /** Micro-normal strength; higher reads choppier. */
  distortionScale: number;
  /** Multiplier on the shader time uniform — lower drifts slower. */
  timeScale: number;
  /** Normal-tile density across world units. */
  size?: number;
  alpha?: number;
  /** Clear, sunlit colour near the shore. */
  shallowWaterDay?: THREE.Color;
  shallowWaterNight?: THREE.Color;
  skyZenithDay?: THREE.Color;
  skyZenithNight?: THREE.Color;
  skyHorizonDay?: THREE.Color;
  skyHorizonNight?: THREE.Color;
  foamColorDay?: THREE.Color;
  foamColorNight?: THREE.Color;
  /** uv.x at or below which the water is fully deep. */
  shoreDeep?: number;
  /** uv.x at or above which the water is fully shallow. */
  shoreShallow?: number;
  foamStart?: number;
  foamEnd?: number;
  foamStrength?: number;
  foamNoiseScale?: number;
  /** Extra foam painted on the tallest wave crests. */
  crestFoam?: number;
  /** How strongly far water fades toward the horizon colour. */
  hazeStrength?: number;
  fresnelBase?: number;
  reflectionStrength?: number;
  skySunGlow?: number;
  specularPower?: number;
  specularStrength?: number;
  /** Peak vertical swell in world units. */
  waveHeight?: number;
  /** Swell speed multiplier. */
  waveSpeed?: number;
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
    // Normal maps are data textures, not colour; keep them out of sRGB.
    sharedWaterNormals.colorSpace = THREE.NoColorSpace;
  }
  return sharedWaterNormals;
}

// The swell is a sum of sines. Derivatives are analytic so the fragment stage
// gets a correct world-space normal without extra normal-map samples.
const SEA_VERTEX = /* glsl */ `
uniform float uTime;
uniform float uWaveHeight;
uniform float uWaveSpeed;
varying vec3 vWorldPosition;
varying vec3 vWaveNormal;
varying vec2 vUv;
varying float vWave;

void main() {
  vUv = uv;
  vec3 p = position;
  vec2 xz = p.xz;
  float t = uTime * uWaveSpeed;

  float phaseA = xz.x * 0.18 + xz.y * 0.06 + t;
  float phaseB = xz.x * -0.11 + xz.y * 0.27 - t * 0.85;
  float phaseC = xz.x * 0.62 - xz.y * 0.48 + t * 1.6;

  float height = (sin(phaseA) * 0.55 + sin(phaseB) * 0.35 + sin(phaseC) * 0.12) * uWaveHeight;
  p.y += height;
  vWave = uWaveHeight > 0.0001 ? height / uWaveHeight : 0.0;

  float dhdx = (cos(phaseA) * 0.18 * 0.55 + cos(phaseB) * -0.11 * 0.35 + cos(phaseC) * 0.62 * 0.12) * uWaveHeight;
  float dhdz = (cos(phaseA) * 0.06 * 0.55 + cos(phaseB) * 0.27 * 0.35 + cos(phaseC) * -0.48 * 0.12) * uWaveHeight;
  vec3 localNormal = vec3(-dhdx, 1.0, -dhdz);

  vWaveNormal = normalize((modelMatrix * vec4(localNormal, 0.0)).xyz);

  vec4 worldPosition = modelMatrix * vec4(p, 1.0);
  vWorldPosition = worldPosition.xyz;
  gl_Position = projectionMatrix * viewMatrix * worldPosition;
}
`;

const SEA_FRAGMENT = /* glsl */ `
uniform sampler2D uNormalMap;
uniform float uTime;
uniform float uSize;
uniform float uDistortionScale;
uniform vec3 uSunDirection;
uniform vec3 uSunColor;
uniform vec3 uWaterDeep;
uniform vec3 uWaterShallow;
uniform vec3 uSkyZenith;
uniform vec3 uSkyHorizon;
uniform vec3 uFoamColor;
uniform float uShoreDeep;
uniform float uShoreShallow;
uniform float uFoamStart;
uniform float uFoamEnd;
uniform float uFoamStrength;
uniform float uFoamNoiseScale;
uniform float uCrestFoam;
uniform float uHazeStrength;
uniform float uFresnelBase;
uniform float uReflectionStrength;
uniform float uSkySunGlow;
uniform float uSpecularPower;
uniform float uSpecularStrength;
uniform float uAlpha;
varying vec3 vWorldPosition;
varying vec3 vWaveNormal;
varying vec2 vUv;
varying float vWave;

void main() {
  vec2 uv = vWorldPosition.xz * uSize;
  vec2 uv0 = (uv / 103.0) + vec2(uTime / 17.0, uTime / 29.0);
  vec2 uv1 = uv / 107.0 - vec2(uTime / -19.0, uTime / 31.0);
  vec2 uv2 = uv / vec2(8907.0, 9803.0) + vec2(uTime / 101.0, uTime / 97.0);
  vec2 uv3 = uv / vec2(1091.0, 1027.0) - vec2(uTime / 109.0, uTime / -113.0);
  vec4 noise = texture2D(uNormalMap, uv0) + texture2D(uNormalMap, uv1) + texture2D(uNormalMap, uv2) + texture2D(uNormalMap, uv3);
  noise = noise * 0.5 - 1.0;
  vec3 micro = noise.xzy;
  vec3 N = normalize(vWaveNormal + vec3(micro.x, 0.0, micro.z) * uDistortionScale);

  vec3 viewDir = normalize(cameraPosition - vWorldPosition);
  float ndv = clamp(dot(N, viewDir), 0.0, 1.0);
  float fresnel = uFresnelBase + (1.0 - uFresnelBase) * pow(1.0 - ndv, 5.0);

  vec3 reflectDir = reflect(-viewDir, N);
  vec3 sky = mix(uSkyHorizon, uSkyZenith, pow(clamp(reflectDir.y, 0.0, 1.0), 0.55));
  float sunAlign = max(dot(reflectDir, uSunDirection), 0.0);
  sky += uSunColor * (pow(sunAlign, 900.0) * 2.5 + pow(sunAlign, 24.0) * uSkySunGlow);

  float shore = smoothstep(uShoreDeep, uShoreShallow, vUv.x);
  vec3 body = mix(uWaterDeep, uWaterShallow, shore);

  vec3 color = mix(body, sky, clamp(fresnel * uReflectionStrength, 0.0, 1.0));

  vec3 halfDir = normalize(viewDir + uSunDirection);
  color += uSunColor * pow(max(dot(N, halfDir), 0.0), uSpecularPower) * uSpecularStrength;

  float foamNoise = texture2D(uNormalMap, vWorldPosition.xz * uFoamNoiseScale + vec2(uTime * 0.035, uTime * 0.021)).x;
  float foam = smoothstep(uFoamStart, uFoamEnd, shore + (foamNoise - 0.5) * 0.06) * uFoamStrength;
  foam = clamp(foam + smoothstep(0.55, 1.0, vWave) * uCrestFoam, 0.0, 1.0);
  color = mix(color, uFoamColor, foam);

  float dist = length(cameraPosition - vWorldPosition);
  color = mix(color, uSkyHorizon, smoothstep(60.0, 170.0, dist) * uHazeStrength);

  gl_FragColor = vec4(color, uAlpha);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}
`;

const DEFAULT_SHALLOW_DAY = new THREE.Color(0x5fd9c8);
const DEFAULT_SHALLOW_NIGHT = new THREE.Color(0x0f3a4c);
const DEFAULT_SKY_ZENITH_DAY = new THREE.Color(0x2f7fc4);
const DEFAULT_SKY_ZENITH_NIGHT = new THREE.Color(0x081226);
const DEFAULT_SKY_HORIZON_DAY = new THREE.Color(0xcfeaf3);
const DEFAULT_SKY_HORIZON_NIGHT = new THREE.Color(0x1a2c44);
const DEFAULT_FOAM_DAY = new THREE.Color(0xf2fdff);
const DEFAULT_FOAM_NIGHT = new THREE.Color(0x9fb6c8);

function lerpPair(uniform: THREE.IUniform, day: THREE.Color, night: THREE.Color, daylight: number): void {
  (uniform.value as THREE.Color).copy(day).lerp(night, 1 - daylight);
}

export function createAnimatedWaterSurface(
  geometry: THREE.BufferGeometry,
  config: AnimatedWaterConfig,
): AnimatedWaterSurface {
  const day = {
    deep: config.waterColorDay.clone(),
    shallow: (config.shallowWaterDay ?? DEFAULT_SHALLOW_DAY).clone(),
    skyZenith: (config.skyZenithDay ?? DEFAULT_SKY_ZENITH_DAY).clone(),
    skyHorizon: (config.skyHorizonDay ?? DEFAULT_SKY_HORIZON_DAY).clone(),
    sun: config.sunColorDay.clone(),
    foam: (config.foamColorDay ?? DEFAULT_FOAM_DAY).clone(),
  };
  const night = {
    deep: config.waterColorNight.clone(),
    shallow: (config.shallowWaterNight ?? DEFAULT_SHALLOW_NIGHT).clone(),
    skyZenith: (config.skyZenithNight ?? DEFAULT_SKY_ZENITH_NIGHT).clone(),
    skyHorizon: (config.skyHorizonNight ?? DEFAULT_SKY_HORIZON_NIGHT).clone(),
    sun: config.sunColorNight.clone(),
    foam: (config.foamColorNight ?? DEFAULT_FOAM_NIGHT).clone(),
  };
  const alpha = config.alpha ?? 1;
  const uniforms: Record<string, THREE.IUniform> = {
    uNormalMap: { value: getWaterNormals() },
    uTime: { value: 0 },
    uSize: { value: config.size ?? 1 },
    uDistortionScale: { value: config.distortionScale },
    uSunDirection: { value: (config.sunDirection ?? new THREE.Vector3(0.5, 0.8, 0.35)).clone().normalize() },
    uSunColor: { value: day.sun.clone() },
    uWaterDeep: { value: day.deep.clone() },
    uWaterShallow: { value: day.shallow.clone() },
    uSkyZenith: { value: day.skyZenith.clone() },
    uSkyHorizon: { value: day.skyHorizon.clone() },
    uFoamColor: { value: day.foam.clone() },
    uShoreDeep: { value: config.shoreDeep ?? 0.45 },
    uShoreShallow: { value: config.shoreShallow ?? 0.985 },
    uFoamStart: { value: config.foamStart ?? 0.965 },
    uFoamEnd: { value: config.foamEnd ?? 1 },
    uFoamStrength: { value: config.foamStrength ?? 0.85 },
    uFoamNoiseScale: { value: config.foamNoiseScale ?? 0.08 },
    uCrestFoam: { value: config.crestFoam ?? 0.12 },
    uHazeStrength: { value: config.hazeStrength ?? 0.3 },
    uFresnelBase: { value: config.fresnelBase ?? 0.02 },
    uReflectionStrength: { value: config.reflectionStrength ?? 1 },
    uSkySunGlow: { value: config.skySunGlow ?? 0.15 },
    uSpecularPower: { value: config.specularPower ?? 180 },
    uSpecularStrength: { value: config.specularStrength ?? 1.6 },
    uWaveHeight: { value: config.waveHeight ?? 0.08 },
    uWaveSpeed: { value: config.waveSpeed ?? 0.6 },
    uAlpha: { value: alpha },
  };
  const material = new THREE.ShaderMaterial({
    uniforms,
    vertexShader: SEA_VERTEX,
    fragmentShader: SEA_FRAGMENT,
    transparent: alpha < 1,
    side: config.side ?? THREE.DoubleSide,
  });
  const water = new THREE.Mesh(geometry, material);
  water.renderOrder = config.renderOrder ?? 3;
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
      uniforms['uTime']!.value = elapsedSeconds * config.timeScale;
      lerpPair(uniforms['uWaterDeep']!, day.deep, night.deep, daylight);
      lerpPair(uniforms['uWaterShallow']!, day.shallow, night.shallow, daylight);
      lerpPair(uniforms['uSkyZenith']!, day.skyZenith, night.skyZenith, daylight);
      lerpPair(uniforms['uSkyHorizon']!, day.skyHorizon, night.skyHorizon, daylight);
      lerpPair(uniforms['uSunColor']!, day.sun, night.sun, daylight);
      lerpPair(uniforms['uFoamColor']!, day.foam, night.foam, daylight);
    },
    setDaylight(value, instant = false) {
      daylightTarget = value;
      if (instant) daylight = value;
    },
  };
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
