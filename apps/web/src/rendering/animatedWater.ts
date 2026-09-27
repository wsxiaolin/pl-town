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
  /** Optional shoreline wave lap. Displaces vertices near uv.x = 1 (the shore
   *  edge of the ribbon) so the waterline advances and retreats along the
   *  beach instead of sitting on a fixed line. The fragment stage adds the
   *  shallow-water gradient: a paler, more translucent band that lets the
   *  sand show through, plus noise-broken foam that rides the crest. */
  shoreWaves?: {
    /** Cross-shore advance/retreat of the waterline, in local x units. */
    reach?: number;
    /** Crest lift at the waterline, in local y units. */
    lift?: number;
    /** Hard world-x ceiling for the displaced waterline. Keeps the crest
     *  from ever lapping over shore-side objects (e.g. the asphalt road),
     *  which would z-fight with them. */
    maxAdvanceX?: number;
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
  if (config.shoreWaves) {
    // Lap the water at the shore edge: vertices near uv.x = 1 (the shoreline)
    // swing toward the beach and lift as each crest arrives, then fall back,
    // while the open sea (uv.x near 0) stays still so the mirror stays calm.
    // The fragment stage then turns the same shore band into a shallow-water
    // gradient: paler tint, translucent alpha (sand shows through) and
    // noise-broken foam along the advancing waterline.
    // Frequencies are tuned against the already time-scaled `time` uniform.
    const reach = glslFloat(config.shoreWaves.reach ?? 1.15);
    const lift = glslFloat(config.shoreWaves.lift ?? 0.26);
    // Hard stop for the waterline. Without it the crest slides under the
    // asphalt road (road top ~0.085, water base 0.06) and the two surfaces
    // flicker against each other as the wave rises and falls.
    const limitX = glslFloat(config.shoreWaves.maxAdvanceX ?? 1e9);
    material.onBeforeCompile = (shader) => {
      shader.vertexShader = shader.vertexShader
        .replace(
          'void main() {',
          /* glsl */ `
          varying float vShore;
          varying float vCrest;
          varying float vFoamEdge;
          void main() {
          vec3 shorePos = position;
          {
            float shoreEnv = smoothstep(0.42, 0.96, uv.x);
            float lap = sin(time * 2.1 + position.z * 0.35) * 0.62
              + sin(time * 3.4 - position.z * 0.22 + 2.1) * 0.30;
            float roll = sin(time * 1.6 - (1.0 - uv.x) * 48.0 + position.z * 0.55);
            float crest = pow(max(lap, 0.0), 1.35);
            shorePos.x += shoreEnv * lap * ${reach};
            shorePos.x = min(shorePos.x, ${limitX});
            // The 0.03 base lift keeps the shallow band riding just above the
            // sand plane (sand sits 0.01 above the flat water level) so the
            // translucent sheet never sinks beneath the beach it should cover.
            shorePos.y += shoreEnv * (0.03 + crest * ${lift} + max(roll, 0.0) * ${lift} * 0.3);
            vShore = uv.x;
            vCrest = crest * shoreEnv;
            vFoamEdge = smoothstep(0.62, 0.98, uv.x) * (0.3 + 0.7 * crest);
          }`,
        )
        .replace(/vec4\( position, 1\.0 \)/g, 'vec4( shorePos, 1.0 )');
      shader.fragmentShader = shader.fragmentShader
        .replace(
          'void main() {',
          /* glsl */ `
          varying float vShore;
          varying float vCrest;
          varying float vFoamEdge;
          void main() {`,
        )
        .replace(
          'gl_FragColor = vec4( outgoingLight, alpha );',
          /* glsl */ `
          {
            // Shallow-water gradient: blend toward a pale aqua as the bed
            // shallows and let the sand show through the translucent sheet.
            vec3 shallowTint = mix(waterColor, vec3(0.44, 0.78, 0.74), 0.62);
            float shallowBand = smoothstep(0.30, 0.92, vShore);
            outgoingLight = mix(outgoingLight, shallowTint, shallowBand * 0.55);
            // Foam rides the advancing waterline: noise breaks it into
            // pockets so it reads as bubbles, and it only shows while a
            // crest is actually pushing in. Tint with sunColor so night
            // dims the foam with everything else.
            float foamNoise = getNoise(worldPosition.xz * 2.6 + time * 0.22).x * 0.5 + 0.5;
            float foam = vFoamEdge * smoothstep(0.38, 0.72, foamNoise + vCrest * 0.42);
            outgoingLight = mix(outgoingLight, sunColor * 0.9, foam * 0.8);
            float shoreAlpha = mix(alpha, alpha * 0.45, smoothstep(0.28, 0.95, vShore));
            gl_FragColor = vec4( outgoingLight, max(shoreAlpha, foam * 0.9) );
          }`,
        );
    };
    // The shore band must blend over the sand, so the surface renders in the
    // transparent pass even when the configured deep-water alpha is 1.
    material.transparent = true;
    // The displacement moves vertices past the geometry's computed bounding
    // sphere, which would let frustum culling pop the shore edge in/out.
    water.frustumCulled = false;
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
    },
    setDaylight(value, instant = false) {
      daylightTarget = value;
      if (instant) daylight = value;
    },
  };
}
