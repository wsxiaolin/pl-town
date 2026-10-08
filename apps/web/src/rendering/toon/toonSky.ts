import * as THREE from 'three';

/**
 * Anime-style sky dome for the first-person mode: a hand-painted gradient
 * (saturated zenith → creamy horizon), drifting procedural clouds, a soft
 * sun glow by day, stars and a moon by night — plus a matching distance fog
 * so buildings melt into the horizon like a cel-painted backdrop.
 *
 * The dome follows the camera every frame and reads the city's day/night
 * flag with a smooth lerp, so theme changes stay immersive while walking.
 */

const DOME_RADIUS = 240;
const DAY_ZENITH = new THREE.Color('#3d8ce8');
const DAY_HORIZON = new THREE.Color('#d8ecff');
const DAY_SUN = new THREE.Color('#fff4d6');
const DAY_CLOUD = new THREE.Color('#ffffff');
const NIGHT_ZENITH = new THREE.Color('#070b22');
const NIGHT_HORIZON = new THREE.Color('#25335f');
const NIGHT_MOON = new THREE.Color('#e8f0ff');
const NIGHT_CLOUD = new THREE.Color('#8a97c4');
const DAY_FOG = new THREE.Color('#c6e2f5');
const NIGHT_FOG = new THREE.Color('#131c38');

const SKY_VERTEX = /* glsl */ `
varying vec3 vDirection;
void main() {
  vDirection = normalize(position);
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

const SKY_FRAGMENT = /* glsl */ `
uniform float uTime;
uniform float uNight;
uniform vec3 uSunDirection;
uniform vec3 uDayZenith;
uniform vec3 uDayHorizon;
uniform vec3 uDaySun;
uniform vec3 uDayCloud;
uniform vec3 uNightZenith;
uniform vec3 uNightHorizon;
uniform vec3 uNightMoon;
uniform vec3 uNightCloud;
varying vec3 vDirection;

float hash12(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * 0.1031);
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}

float valueNoise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  float a = hash12(i);
  float b = hash12(i + vec2(1.0, 0.0));
  float c = hash12(i + vec2(0.0, 1.0));
  float d = hash12(i + vec2(1.0, 1.0));
  return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
}

float fbm(vec2 p) {
  float value = 0.0;
  float amplitude = 0.5;
  for (int i = 0; i < 4; i++) {
    value += amplitude * valueNoise(p);
    p = p * 2.13 + vec2(17.3, 9.1);
    amplitude *= 0.5;
  }
  return value;
}

void main() {
  vec3 direction = normalize(vDirection);
  float height = clamp(direction.y, -1.0, 1.0);

  // --- gradient sky -------------------------------------------------------
  float gradient = pow(clamp(1.0 - max(height, 0.0), 0.0, 1.0), 1.55);
  vec3 daySky = mix(uDayZenith, uDayHorizon, gradient);
  vec3 nightSky = mix(uNightZenith, uNightHorizon, gradient);
  vec3 sky = mix(daySky, nightSky, uNight);

  // --- sun / moon glow ----------------------------------------------------
  vec3 sunDir = normalize(uSunDirection);
  float sunAmount = max(dot(direction, sunDir), 0.0);
  // Three-layer anime sun: crisp core disc, tight warm inner glow, wide halo.
  vec3 dayGlow = uDaySun * (
    pow(sunAmount, 1600.0) * 2.2
    + pow(sunAmount, 90.0) * 0.55
    + pow(sunAmount, 10.0) * 0.12);
  vec3 moonDir = -sunDir;
  float moonAmount = max(dot(direction, moonDir), 0.0);
  vec3 nightGlow = uNightMoon * (
    pow(moonAmount, 1500.0) * 1.8
    + pow(moonAmount, 80.0) * 0.30
    + pow(moonAmount, 16.0) * 0.05);
  sky += mix(dayGlow, nightGlow, uNight);

  // --- stars (night only) --------------------------------------------------
  // Round soft points with per-star size, brightness and twinkle phase —
  // no square pixels, no grid feel.
  if (uNight > 0.02 && height > 0.02) {
    vec2 starCell = direction.xz / (direction.y + 0.35) * 46.0;
    vec2 cell = floor(starCell);
    vec2 cellUv = fract(starCell) - 0.5;
    float rnd = hash12(cell);
    float rnd2 = hash12(cell + 7.31);
    float on = step(0.955, rnd);
    vec2 offset = (vec2(hash12(cell + 3.1), hash12(cell + 5.7)) - 0.5) * 0.52;
    float dist = length(cellUv - offset);
    float size = 0.045 + rnd2 * 0.085;
    float star = on * smoothstep(size, size * 0.3, dist);
    float twinkle = 0.55 + 0.45 * sin(uTime * (1.5 + rnd2 * 2.5) + rnd * 40.0);
    float starFade = smoothstep(0.02, 0.35, height) * uNight;
    sky += vec3(0.92, 0.96, 1.0) * star * twinkle * starFade * (0.7 + 0.6 * rnd2);
  }

  // --- procedural clouds ---------------------------------------------------
  // Project the view ray onto a virtual cloud plane; the divide stretches
  // bands naturally toward the horizon.
  vec2 cloudUv = direction.xz / (abs(direction.y) + 0.14);
  vec2 drift = vec2(uTime * 0.006, uTime * 0.0022);
  float density = fbm(cloudUv * 1.15 + drift);
  float detail = fbm(cloudUv * 3.1 - drift * 2.4);
  float shape = smoothstep(0.52, 0.78, density + detail * 0.25);

  float cloudVisibility = smoothstep(0.02, 0.24, height) * smoothstep(0.95, 0.55, height + shape * 0.2);
  // Puffy shading: denser cloud cores read brighter, fringes fall to soft blue.
  float puff = smoothstep(0.45, 0.85, density);
  vec3 dayCloudColor = uDayCloud * (0.72 + 0.28 * puff + 0.10 * detail);
  vec3 nightCloudColor = uNightCloud * (0.5 + 0.22 * detail);
  vec3 cloudColor = mix(dayCloudColor, nightCloudColor, uNight);
  // Cloud opacity: puffy by day, thin and moody by night.
  float cloudAlpha = shape * cloudVisibility * mix(0.92, 0.55, uNight);

  sky = mix(sky, cloudColor, cloudAlpha);
  gl_FragColor = vec4(sky, 1.0);
}
`;

export type ToonSky = {
  enter(night?: boolean): void;
  exit(): void;
  update(deltaSeconds: number, night: boolean): void;
  isActive(): boolean;
};

export function createToonSky(options: {
  scene: THREE.Scene;
  /** The active first-person camera (the dome follows it every frame). */
  getCamera: () => THREE.PerspectiveCamera | null;
  /** World direction of the sun; the moon sits opposite. */
  sunDirection?: THREE.Vector3;
}): ToonSky {
  const { scene } = options;
  const sunDirection = options.sunDirection ?? new THREE.Vector3(0.45, 0.62, 0.3).normalize();

  let dome: THREE.Mesh | null = null;
  let material: THREE.ShaderMaterial | null = null;
  let fog: THREE.Fog | null = null;
  let elapsed = 0;
  let nightAmount = 0;
  let active = false;

  const uniforms = {
    uTime: { value: 0 },
    uNight: { value: 0 },
    uSunDirection: { value: sunDirection },
    uDayZenith: { value: DAY_ZENITH },
    uDayHorizon: { value: DAY_HORIZON },
    uDaySun: { value: DAY_SUN },
    uDayCloud: { value: DAY_CLOUD },
    uNightZenith: { value: NIGHT_ZENITH },
    uNightHorizon: { value: NIGHT_HORIZON },
    uNightMoon: { value: NIGHT_MOON },
    uNightCloud: { value: NIGHT_CLOUD },
  };

  function enter(night = false): void {
    if (active) return;
    active = true;
    material = new THREE.ShaderMaterial({
      uniforms,
      vertexShader: SKY_VERTEX,
      fragmentShader: SKY_FRAGMENT,
      side: THREE.BackSide,
      depthWrite: false,
      fog: false,
    });
    dome = new THREE.Mesh(new THREE.SphereGeometry(DOME_RADIUS, 32, 20), material);
    dome.name = 'toon-sky-dome';
    dome.renderOrder = -1000;
    dome.frustumCulled = false;
    const activeCamera = options.getCamera();
    if (activeCamera) dome.position.copy(activeCamera.position);
    scene.add(dome);
    // Fog starts beyond street scale so cel band contrast stays punchy.
    fog = new THREE.Fog(DAY_FOG.getHex(), 55, 210);
    scene.fog = fog;
    // Start already in the right mood — no sunrise when entering at night.
    nightAmount = night ? 1 : 0;
    uniforms.uNight.value = nightAmount;
    fog.color.copy(DAY_FOG).lerp(NIGHT_FOG, nightAmount);
  }

  function exit(): void {
    if (!active) return;
    active = false;
    if (dome) {
      scene.remove(dome);
      dome.geometry.dispose();
      dome = null;
    }
    material?.dispose();
    material = null;
    scene.fog = null;
    fog = null;
  }

  function update(deltaSeconds: number, night: boolean): void {
    if (!active || !dome || !fog) return;
    elapsed += deltaSeconds;
    const target = night ? 1 : 0;
    // A slow cinematic day/night crossfade (≈2.5 s) while walking.
    nightAmount += (target - nightAmount) * Math.min(1, deltaSeconds * 0.4);
    if (Math.abs(target - nightAmount) < 0.002) nightAmount = target;
    uniforms.uTime.value = elapsed;
    uniforms.uNight.value = nightAmount;
    const activeCamera = options.getCamera();
    if (activeCamera) dome.position.copy(activeCamera.position);
    fog.color.copy(DAY_FOG).lerp(NIGHT_FOG, nightAmount);
  }

  return { enter, exit, update, isActive: () => active };
}
