// 烟花粒子引擎：发射船点火 → 升空壳（带拖尾）→ 引信开爆 → 星体燃烧。
// 所有运动学来自 city/fireworks/fireworksPhysics（纯模块），设计器 2D
// 预览共用同一套弹道与星体解析解，保证「所见即所得」。
//
// 渲染约束：
// - 复用主 renderer/scene（AGENTS.md：不创建第二个 WebGL 上下文）；
// - 自定义点精灵 shader 用「世界尺寸 × 每帧像素比例」换算点大小，正交
//   相机任意缩放下烟花观感一致；
// - AdditiveBlending + depthWrite:false，渲染序在水面上方（renderOrder 9）；
// - 全部几何/材质在 dispose() 释放，跟随 weatherEffect 的生命周期契约。
import * as THREE from 'three';
import {
  buildBurstSeeds,
  normalizeFireworkDesign,
  seedBurstMath,
  type BurstSeed,
  type FireworkDesign,
} from '../city/fireworks/fireworksDesign';
import {
  burstRadius,
  planShell,
  sampleStar,
  shellPosition,
  type ShellPlan,
} from '../city/fireworks/fireworksPhysics';
import { createFireworksBarges } from './fireworksBarge';
import { createFireworksFx, type FireworksFx } from './fireworksFx';

const MAX_SHELLS = 8;
const MAX_BURSTS = 10;
const TRAIL_CAPACITY = 7000;

const STAR_VERT = /* glsl */ `
  attribute float aSize;
  attribute float aAlpha;
  attribute vec3 aColor;
  varying vec3 vColor;
  varying float vAlpha;
  uniform float uPixelScale;
  void main() {
    vColor = aColor;
    vAlpha = aAlpha;
    vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
    gl_PointSize = max(aSize * uPixelScale, 1.0);
    gl_Position = projectionMatrix * mvPosition;
  }
`;
const STAR_FRAG = /* glsl */ `
  varying vec3 vColor;
  varying float vAlpha;
  void main() {
    float d = length(gl_PointCoord - vec2(0.5));
    float disc = smoothstep(0.5, 0.08, d);
    if (disc * vAlpha < 0.008) discard;
    gl_FragColor = vec4(vColor, vAlpha * disc);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`;

type Rgb = { r: number; g: number; b: number };

function hexToRgb(hex: string): Rgb {
  const value = parseInt(hex.slice(1), 16);
  // eslint-disable-next-line no-bitwise
  return { r: ((value >> 16) & 255) / 255, g: ((value >> 8) & 255) / 255, b: (value & 255) / 255 };
}

function mix(a: Rgb, b: Rgb, t: number): Rgb {
  return { r: a.r + (b.r - a.r) * t, g: a.g + (b.g - a.g) * t, b: a.b + (b.b - a.b) * t };
}

type Burst = {
  points: THREE.Points;
  geometry: THREE.BufferGeometry;
  positionAttr: THREE.BufferAttribute;
  colorAttr: THREE.BufferAttribute;
  alphaAttr: THREE.BufferAttribute;
  sizeAttr: THREE.BufferAttribute;
  positions: Float32Array;
  colors: Float32Array;
  alphas: Float32Array;
  sizes: Float32Array;
  seeds: BurstSeed[];
  emitTimers: Float32Array;
  center: { x: number; y: number; z: number };
  age: number;
  maxLife: number;
  primary: Rgb;
  secondary: Rgb;
  trailColor: Rgb;
  trail: FireworkDesign['trail'];
};

type Shell = {
  design: FireworkDesign;
  plan: ShellPlan;
  origin: { x: number; y: number; z: number };
  age: number;
  group: THREE.Group;
  trailTimer: number;
  onBurst?: () => void;
  done: boolean;
};

export type FireworksEngineOptions = {
  scene: THREE.Scene;
  /** 当前正交半高（zoom），用于把世界尺寸换算成像素点大小。 */
  getZoom: () => number;
  /** 渲染视口高度（px）。 */
  getViewportHeight: () => number;
};

export function createFireworksEngine(options: FireworksEngineOptions) {
  const { scene } = options;
  const barges = createFireworksBarges(scene);
  const fx = createFireworksFx(scene);
  const starMaterial = new THREE.ShaderMaterial({
    vertexShader: STAR_VERT,
    fragmentShader: STAR_FRAG,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    uniforms: { uPixelScale: { value: 10 } },
  });

  // ── 星体拖尾 / 升空拖尾共用环形缓冲 ─────────────────────
  const trailPositions = new Float32Array(TRAIL_CAPACITY * 3);
  const trailColors = new Float32Array(TRAIL_CAPACITY * 3);
  const trailAlphas = new Float32Array(TRAIL_CAPACITY);
  const trailSizes = new Float32Array(TRAIL_CAPACITY);
  const trailLife = new Float32Array(TRAIL_CAPACITY);
  const trailLifeTotal = new Float32Array(TRAIL_CAPACITY);
  const trailBaseAlpha = new Float32Array(TRAIL_CAPACITY);
  let trailCursor = 0;
  let trailUsed = 0;
  const trailGeometry = new THREE.BufferGeometry();
  trailGeometry.setAttribute('position', new THREE.BufferAttribute(trailPositions, 3));
  trailGeometry.setAttribute('aColor', new THREE.BufferAttribute(trailColors, 3));
  trailGeometry.setAttribute('aAlpha', new THREE.BufferAttribute(trailAlphas, 1));
  trailGeometry.setAttribute('aSize', new THREE.BufferAttribute(trailSizes, 1));
  trailGeometry.setDrawRange(0, 0);
  const trailPoints = new THREE.Points(trailGeometry, starMaterial);
  trailPoints.frustumCulled = false;
  trailPoints.renderOrder = 9;
  scene.add(trailPoints);

  function spawnTrail(x: number, y: number, z: number, color: Rgb, life: number, size: number, alpha: number): void {
    const i = trailCursor;
    trailCursor = (trailCursor + 1) % TRAIL_CAPACITY;
    trailUsed = Math.min(TRAIL_CAPACITY, trailUsed + 1);
    trailPositions[i * 3] = x;
    trailPositions[i * 3 + 1] = y;
    trailPositions[i * 3 + 2] = z;
    trailColors[i * 3] = color.r;
    trailColors[i * 3 + 1] = color.g;
    trailColors[i * 3 + 2] = color.b;
    trailAlphas[i] = alpha;
    trailSizes[i] = size;
    trailLife[i] = life;
    trailLifeTotal[i] = life;
    trailBaseAlpha[i] = alpha;
  }

  const paletteCache = new Map<string, Rgb>();
  const colorOf = (hex: string): Rgb => {
    let color = paletteCache.get(hex);
    if (!color) {
      color = hexToRgb(hex);
      paletteCache.set(hex, color);
    }
    return color;
  };

  // ── 升空壳模型（共享几何/材质，按弹径缩放）────────────────
  const shellBodyGeometry = new THREE.CylinderGeometry(0.085, 0.11, 0.5, 8);
  const shellNoseGeometry = new THREE.ConeGeometry(0.085, 0.22, 8);
  const shellBodyMaterial = new THREE.MeshStandardMaterial({
    color: 0x6d2320,
    emissive: 0xffb347,
    emissiveIntensity: 1.4,
    roughness: 0.5,
  });
  const shellNoseMaterial = new THREE.MeshStandardMaterial({
    color: 0xd9a441,
    emissive: 0xffd9a0,
    emissiveIntensity: 1.1,
    roughness: 0.4,
  });

  function buildShellModel(design: FireworkDesign): THREE.Group {
    const scale = Math.max(0.7, Math.min(1.6, design.caliber / 150));
    const group = new THREE.Group();
    const body = new THREE.Mesh(shellBodyGeometry, shellBodyMaterial);
    body.scale.setScalar(scale);
    group.add(body);
    const nose = new THREE.Mesh(shellNoseGeometry, shellNoseMaterial);
    nose.position.y = 0.36 * scale;
    nose.scale.setScalar(scale);
    group.add(nose);
    return group;
  }

  const bursts: Burst[] = [];
  const shells: Shell[] = [];
  const pendingTimers = new Set<number>();

  function removeBurst(index: number): void {
    const burst = bursts[index];
    if (!burst) return;
    scene.remove(burst.points);
    burst.geometry.dispose();
    bursts.splice(index, 1);
  }

  function createBurst(design: FireworkDesign, center: { x: number; y: number; z: number }): void {
    const radius = burstRadius(design);
    // 固定种子：设计器预览与观景引擎得到同一套星体分布。
    seedBurstMath(20261007);
    const seeds = buildBurstSeeds(design, radius);
    if (seeds.length === 0) return;
    if (bursts.length >= MAX_BURSTS) removeBurst(0);

    const count = seeds.length;
    const primary = colorOf(design.colors.primary);
    const secondary = colorOf(design.colors.secondary);
    const trailColor = colorOf(design.colors.trail);
    const positions = new Float32Array(count * 3);
    const colors = new Float32Array(count * 3);
    const alphas = new Float32Array(count);
    const sizes = new Float32Array(count);
    for (let i = 0; i < count; i += 1) {
      positions[i * 3] = center.x;
      positions[i * 3 + 1] = center.y;
      positions[i * 3 + 2] = center.z;
      colors[i * 3] = primary.r;
      colors[i * 3 + 1] = primary.g;
      colors[i * 3 + 2] = primary.b;
    }
    const geometry = new THREE.BufferGeometry();
    const positionAttr = new THREE.BufferAttribute(positions, 3);
    const colorAttr = new THREE.BufferAttribute(colors, 3);
    const alphaAttr = new THREE.BufferAttribute(alphas, 1);
    const sizeAttr = new THREE.BufferAttribute(sizes, 1);
    geometry.setAttribute('position', positionAttr);
    geometry.setAttribute('aColor', colorAttr);
    geometry.setAttribute('aAlpha', alphaAttr);
    geometry.setAttribute('aSize', sizeAttr);
    const points = new THREE.Points(geometry, starMaterial);
    points.frustumCulled = false;
    points.renderOrder = 9;
    scene.add(points);

    const emitTimers = new Float32Array(count);
    for (let i = 0; i < count; i += 1) emitTimers[i] = Math.random() * 0.06;
    bursts.push({
      points,
      geometry,
      positionAttr,
      colorAttr,
      alphaAttr,
      sizeAttr,
      positions,
      colors,
      alphas,
      sizes,
      seeds,
      emitTimers,
      center,
      age: 0,
      maxLife: Math.max(...seeds.map((seed) => seed.life)) + 0.2,
      primary,
      secondary,
      trailColor,
      trail: design.trail,
    });

    fx.flash(center, new THREE.Color(design.colors.primary), radius);
    fx.shockwave(center, new THREE.Color(design.colors.trail), radius);
    fx.spawnSmoke(center.x, center.y, center.z, 18, radius);
    fx.waterGlow(center, new THREE.Color(design.colors.trail), radius);
  }

  function updateBurst(burst: Burst, dt: number, elapsed: number): void {
    burst.age += dt;
    const { seeds, positions, colors, alphas, sizes, emitTimers } = burst;
    const age = burst.age;
    for (let i = 0; i < seeds.length; i += 1) {
      const seed = seeds[i]!;
      const sample = sampleStar(seed, age, elapsed);
      if (!sample.alive) {
        alphas[i] = 0;
        continue;
      }
      positions[i * 3] = burst.center.x + sample.x;
      positions[i * 3 + 1] = burst.center.y + sample.y;
      positions[i * 3 + 2] = burst.center.z + sample.z;
      alphas[i] = sample.alpha;
      sizes[i] = sample.size;
      const tint = mix(burst.primary, burst.secondary, seed.colorMix);
      const heat = 1 + Math.exp(-age * 3.2) * 0.55;
      colors[i * 3] = tint.r * heat;
      colors[i * 3 + 1] = tint.g * heat;
      colors[i * 3 + 2] = tint.b * heat;

      if (burst.trail === 'none' || sample.alpha < 0.16) continue;
      emitTimers[i]! -= dt;
      if (emitTimers[i]! > 0) continue;
      if (burst.trail === 'glitter') {
        emitTimers[i] = 0.07 + Math.random() * 0.05;
        if (Math.random() > 0.45) continue;
        const sparkle = Math.random() > 0.5
          ? { r: 1, g: 0.95, b: 0.75 }
          : burst.trailColor;
        spawnTrail(positions[i * 3]!, positions[i * 3 + 1]!, positions[i * 3 + 2]!, sparkle,
          0.26 + Math.random() * 0.16, Math.max(0.35, sample.size * 0.38), 0.7);
      } else {
        emitTimers[i] = 0.035 + Math.random() * 0.02;
        spawnTrail(positions[i * 3]!, positions[i * 3 + 1]!, positions[i * 3 + 2]!, burst.trailColor,
          0.4 + Math.random() * 0.22, Math.max(0.3, sample.size * 0.45), 0.5);
      }
    }
    burst.positionAttr.needsUpdate = true;
    burst.colorAttr.needsUpdate = true;
    burst.alphaAttr.needsUpdate = true;
    burst.sizeAttr.needsUpdate = true;
    burst.geometry.setDrawRange(0, seeds.length);
  }

  function explode(shell: Shell): void {
    const center = shellPosition(shell.plan, shell.origin, shell.plan.fuseTime);
    createBurst(shell.design, center);
    scene.remove(shell.group);
    shell.onBurst?.();
  }

  function launch(
    designInput: FireworkDesign,
    origin: { x: number; z: number },
    opts?: { delay?: number; onBurst?: () => void; targetYJitter?: number },
  ): void {
    const design = normalizeFireworkDesign(designInput);
    if (!design) return;
    const start = () => {
      if (shells.filter((shell) => !shell.done).length >= MAX_SHELLS) return;
      const jitter = opts?.targetYJitter ?? 0;
      const launchDesign: FireworkDesign = jitter > 0
        ? { ...design, height: Math.max(24, Math.min(90, Math.round(design.height + (Math.random() * 2 - 1) * jitter))) }
        : design;
      const mortar = barges.pickMortar(origin.x, origin.z);
      const plan = planShell(launchDesign, mortar.heading, mortar.y);
      const group = buildShellModel(launchDesign);
      const position = shellPosition(plan, mortar, 0);
      group.position.set(position.x, position.y, position.z);
      scene.add(group);
      shells.push({
        design: launchDesign,
        plan,
        origin: { x: mortar.x, y: position.y, z: mortar.z },
        age: 0,
        group,
        trailTimer: 0,
        onBurst: opts?.onBurst,
        done: false,
      });
      fx.muzzle(mortar);
      fx.spawnSmoke(mortar.x, mortar.y, mortar.z, 4, 0.7);
    };
    if (opts?.delay && opts.delay > 0) {
      const timer = window.setTimeout(() => {
        pendingTimers.delete(timer);
        start();
      }, opts.delay * 1000);
      pendingTimers.add(timer);
    } else {
      start();
    }
  }

  function update(dt: number, elapsed: number): void {
    const step = Math.min(dt, 0.1);
    barges.update(elapsed);

    // 升空壳：解析弹道 + 拖尾 + 引信。
    for (let i = shells.length - 1; i >= 0; i -= 1) {
      const shell = shells[i]!;
      if (shell.done) { shells.splice(i, 1); continue; }
      shell.age += step;
      const position = shellPosition(shell.plan, shell.origin, Math.min(shell.age, shell.plan.fuseTime));
      shell.group.position.set(position.x, position.y, position.z);
      const ahead = shellPosition(shell.plan, shell.origin, Math.min(shell.age + 0.02, shell.plan.fuseTime));
      const direction = new THREE.Vector3(ahead.x - position.x, ahead.y - position.y, ahead.z - position.z);
      if (direction.lengthSq() > 1e-6) {
        shell.group.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction.normalize());
      }
      shell.trailTimer -= step;
      if (shell.trailTimer <= 0) {
        shell.trailTimer = 0.026;
        spawnTrail(position.x + (Math.random() - 0.5) * 0.08, position.y, position.z + (Math.random() - 0.5) * 0.08,
          colorOf(shell.design.colors.trail), 0.5, Math.max(0.12, shell.design.caliber / 900), 0.8);
      }
      if (shell.age >= shell.plan.fuseTime) {
        shell.done = true;
        explode(shell);
        shells.splice(i, 1);
      }
    }

    // 星体爆裂云。
    for (let i = bursts.length - 1; i >= 0; i -= 1) {
      const burst = bursts[i]!;
      updateBurst(burst, step, elapsed);
      if (burst.age >= burst.maxLife) removeBurst(i);
    }

    // 拖尾衰减。空闲时保持零 draw range，避免软件渲染器每帧上传整块缓冲。
    if (trailUsed > 0) {
      let hasLiveTrail = false;
      for (let i = 0; i < trailUsed; i += 1) {
        if (trailLife[i]! <= 0) { trailAlphas[i] = 0; continue; }
        trailLife[i]! -= step;
        if (trailLife[i]! <= 0) { trailAlphas[i] = 0; continue; }
        hasLiveTrail = true;
        const fade = trailLife[i]! / trailLifeTotal[i]!;
        trailAlphas[i] = trailBaseAlpha[i]! * fade * fade;
      }
      trailGeometry.getAttribute('position').needsUpdate = true;
      trailGeometry.getAttribute('aColor').needsUpdate = true;
      trailGeometry.getAttribute('aAlpha').needsUpdate = true;
      trailGeometry.getAttribute('aSize').needsUpdate = true;
      if (hasLiveTrail) {
        trailGeometry.setDrawRange(0, trailUsed);
      } else {
        trailCursor = 0;
        trailUsed = 0;
        trailGeometry.setDrawRange(0, 0);
      }
    }

    fx.update(step);

    // 像素比例：正交半高 zoom 下每世界单位对应的像素数。
    const zoom = Math.max(options.getZoom(), 0.5);
    const pixelScale = options.getViewportHeight() / (2 * zoom);
    starMaterial.uniforms.uPixelScale!.value = pixelScale;
    fx.setPixelScale(pixelScale);
  }

  function activeCount(): number {
    return bursts.length + shells.filter((shell) => !shell.done).length;
  }

  function dispose(): void {
    for (const timer of pendingTimers) window.clearTimeout(timer);
    pendingTimers.clear();
    for (const burst of bursts) {
      scene.remove(burst.points);
      burst.geometry.dispose();
    }
    bursts.length = 0;
    for (const shell of shells) scene.remove(shell.group);
    shells.length = 0;
    scene.remove(trailPoints);
    trailGeometry.dispose();
    starMaterial.dispose();
    shellBodyGeometry.dispose();
    shellNoseGeometry.dispose();
    shellBodyMaterial.dispose();
    shellNoseMaterial.dispose();
    fx.dispose();
    barges.dispose();
  }

  return { launch, update, dispose, activeCount };
}

export type FireworksEngine = ReturnType<typeof createFireworksEngine>;
