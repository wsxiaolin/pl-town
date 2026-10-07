// 烟花粒子引擎：升空壳（带拖尾）→ 高空爆裂。所有形状的初速分布由
// city/fireworks/fireworksDesign.buildBurstSeeds 提供（纯数学，设计器 2D
// 预览共用），本文件只负责物理积分、顶点缓冲与渲染。
//
// 渲染约束：
// - 复用主 renderer/scene（AGENTS.md：不创建第二个 WebGL 上下文）；
// - 自定义点精灵 shader 用「世界尺寸 × 每帧像素比例」换算点大小，正交
//   相机任意缩放下烟花观感一致；
// - AdditiveBlending + depthWrite:false，渲染序在水面上方（renderOrder 9）；
// - 全部几何/材质在 dispose() 释放，跟随 weatherEffect 的生命周期契约。
import * as THREE from 'three';
import { buildBurstSeeds, PATTERN_RADIUS_SCALE, type BurstSeed, type FireworkDesign } from '../city/fireworks/fireworksDesign';
import { CAMERA_OFFSET_BILLBOARD_NORMAL } from '../city/fireworks/fireworksConstants';

const MAX_SHELLS = 8;
const MAX_BURSTS = 10;
const TRAIL_CAPACITY = 2200;
const GRAVITY = 7.2;
const SHELL_SPEED = 34;
const BASE_RADIUS = 7.0;

const BURST_VERT = /* glsl */ `
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
const BURST_FRAG = /* glsl */ `
  varying vec3 vColor;
  varying float vAlpha;
  void main() {
    float d = length(gl_PointCoord - vec2(0.5));
    float disc = smoothstep(0.5, 0.1, d);
    if (disc * vAlpha < 0.01) discard;
    gl_FragColor = vec4(vColor, vAlpha * disc);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`;

type Shell = {
  originX: number; originZ: number;
  y: number; targetY: number;
  swayPhase: number;
  design: FireworkDesign;
  onBurst?: () => void;
  trailTimer: number;
  done: boolean;
};

type BurstParticle = {
  x: number; y: number; z: number;
  vx: number; vy: number; vz: number;
  lifeTotal: number; lifeLeft: number;
  drag: number; gravity: number;
  size: number; colorMix: number;
  flicker: boolean; flickerPhase: number;
  splitAt: number; splitDone: boolean;
};

type Burst = {
  points: THREE.Points;
  geometry: THREE.BufferGeometry;
  positionAttr: THREE.BufferAttribute;
  alphaAttr: THREE.BufferAttribute;
  sizeAttr: THREE.BufferAttribute;
  positions: Float32Array;
  colors: Float32Array;
  alphas: Float32Array;
  sizes: Float32Array;
  particles: BurstParticle[];
  alive: boolean;
};

function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const value = parseInt(hex.slice(1), 16);
  // eslint-disable-next-line no-bitwise
  return { r: ((value >> 16) & 255) / 255, g: ((value >> 8) & 255) / 255, b: (value & 255) / 255 };
}

export type FireworksEngineOptions = {
  scene: THREE.Scene;
  /** 当前正交半高（zoom），用于把世界尺寸换算成像素点大小。 */
  getZoom: () => number;
  /** 渲染视口高度（px）。 */
  getViewportHeight: () => number;
};

export function createFireworksEngine(options: FireworksEngineOptions) {
  const { scene } = options;
  const material = new THREE.ShaderMaterial({
    vertexShader: BURST_VERT,
    fragmentShader: BURST_FRAG,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    uniforms: { uPixelScale: { value: 10 } },
  });

  // ── 拖尾：单个环形缓冲 Points ──────────────────────────────
  const trailPositions = new Float32Array(TRAIL_CAPACITY * 3);
  const trailColors = new Float32Array(TRAIL_CAPACITY * 3);
  const trailAlphas = new Float32Array(TRAIL_CAPACITY);
  const trailSizes = new Float32Array(TRAIL_CAPACITY);
  const trailLife = new Float32Array(TRAIL_CAPACITY); // 剩余寿命
  const trailLifeTotal = new Float32Array(TRAIL_CAPACITY);
  const trailBaseAlpha = new Float32Array(TRAIL_CAPACITY);
  let trailCursor = 0;
  const trailGeometry = new THREE.BufferGeometry();
  trailGeometry.setAttribute('position', new THREE.BufferAttribute(trailPositions, 3));
  trailGeometry.setAttribute('aColor', new THREE.BufferAttribute(trailColors, 3));
  trailGeometry.setAttribute('aAlpha', new THREE.BufferAttribute(trailAlphas, 1));
  trailGeometry.setAttribute('aSize', new THREE.BufferAttribute(trailSizes, 1));
  trailGeometry.setDrawRange(0, 0);
  const trailPoints = new THREE.Points(trailGeometry, material);
  trailPoints.frustumCulled = false;
  trailPoints.renderOrder = 9;
  scene.add(trailPoints);

  function spawnTrail(x: number, y: number, z: number, color: { r: number; g: number; b: number }, life: number, size: number, alpha: number): void {
    const i = trailCursor;
    trailCursor = (trailCursor + 1) % TRAIL_CAPACITY;
    trailPositions[i * 3] = x; trailPositions[i * 3 + 1] = y; trailPositions[i * 3 + 2] = z;
    trailColors[i * 3] = color.r; trailColors[i * 3 + 1] = color.g; trailColors[i * 3 + 2] = color.b;
    trailAlphas[i] = alpha;
    trailSizes[i] = size;
    trailLife[i] = life;
    trailLifeTotal[i] = life;
    trailBaseAlpha[i] = alpha;
  }

  // ── 爆裂云 ────────────────────────────────────────────────
  const bursts: Burst[] = [];
  const shells: Shell[] = [];
  const paletteCache = new Map<string, { r: number; g: number; b: number }>();
  const colorOf = (hex: string) => {
    let c = paletteCache.get(hex);
    if (!c) { c = hexToRgb(hex); paletteCache.set(hex, c); }
    return c;
  };
  const mix = (a: { r: number; g: number; b: number }, b: { r: number; g: number; b: number }, t: number) => ({
    r: a.r + (b.r - a.r) * t, g: a.g + (b.g - a.g) * t, b: a.b + (b.b - a.b) * t,
  });

  function designRadius(design: FireworkDesign): number {
    const scale = design.size / 100;
    return design.shape === 'pattern' ? BASE_RADIUS * PATTERN_RADIUS_SCALE * scale : BASE_RADIUS * scale;
  }

  function burstFromSeeds(design: FireworkDesign, x: number, y: number, z: number, radius: number): void {
    const seeds: BurstSeed[] = buildBurstSeeds(design, radius);
    if (seeds.length === 0) return;
    const count = seeds.length;
    const primary = colorOf(design.colors.primary);
    const secondary = colorOf(design.colors.secondary);
    const positions = new Float32Array(count * 3);
    const colors = new Float32Array(count * 3);
    const alphas = new Float32Array(count);
    const sizes = new Float32Array(count);
    const particles: BurstParticle[] = seeds.map((seed, i) => {
      positions[i * 3] = x; positions[i * 3 + 1] = y; positions[i * 3 + 2] = z;
      const tint = mix(primary, secondary, seed.colorMix);
      const bright = 0.8 + Math.random() * 0.35;
      colors[i * 3] = tint.r * bright; colors[i * 3 + 1] = tint.g * bright; colors[i * 3 + 2] = tint.b * bright;
      alphas[i] = 1;
      sizes[i] = seed.size;
      return {
        x, y, z, vx: seed.vx, vy: seed.vy, vz: seed.vz,
        lifeTotal: seed.life, lifeLeft: seed.life,
        drag: seed.drag, gravity: seed.gravity,
        size: seed.size, colorMix: seed.colorMix,
        flicker: seed.flicker, flickerPhase: Math.random() * Math.PI * 2,
        splitAt: seed.splitAt ?? -1, splitDone: false,
      };
    });
    const geometry = new THREE.BufferGeometry();
    const positionAttr = new THREE.BufferAttribute(positions, 3);
    const alphaAttr = new THREE.BufferAttribute(alphas, 1);
    const sizeAttr = new THREE.BufferAttribute(sizes, 1);
    geometry.setAttribute('position', positionAttr);
    geometry.setAttribute('aColor', new THREE.BufferAttribute(colors, 3));
    geometry.setAttribute('aAlpha', alphaAttr);
    geometry.setAttribute('aSize', sizeAttr);
    const points = new THREE.Points(geometry, material);
    points.frustumCulled = false;
    points.renderOrder = 9;
    scene.add(points);
    const burst: Burst = { points, geometry, positionAttr, alphaAttr, sizeAttr, positions, colors, alphas, sizes, particles, alive: true };
    bursts.push(burst);
    // 爆裂瞬间的拖尾闪光余烬。
    for (let i = 0; i < 14; i += 1) {
      spawnTrail(x + (Math.random() - 0.5) * 2, y + (Math.random() - 0.5) * 2, z + (Math.random() - 0.5) * 2,
        colorOf(design.colors.trail), 0.5 + Math.random() * 0.4, 0.22, 0.5);
    }
  }

  function explode(shell: Shell): void {
    const radius = designRadius(shell.design);
    burstFromSeeds(shell.design, shell.originX, shell.y, shell.originZ, radius);
    shell.onBurst?.();
  }

  function updateBurst(burst: Burst, dt: number, elapsed: number): void {
    const { particles, positions, alphas, sizes } = burst;
    let anyAlive = false;
    for (let i = 0; i < particles.length; i += 1) {
      const p = particles[i]!;
      if (p.lifeLeft <= 0) { alphas[i] = 0; continue; }
      p.lifeLeft -= dt;
      if (p.lifeLeft <= 0) { alphas[i] = 0; continue; }
      anyAlive = true;
      const decay = Math.exp(-p.drag * dt);
      p.vx *= decay; p.vz *= decay;
      p.vy = p.vy * decay - GRAVITY * p.gravity * dt;
      p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt;
      if (p.y < 0.4) { p.y = 0.4; p.vy = Math.abs(p.vy) * 0.25; }
      // 十字蕊：中段四分裂。
      if (!p.splitDone && p.splitAt > 0 && (p.lifeTotal - p.lifeLeft) >= p.lifeTotal * p.splitAt) {
        p.splitDone = true;
        const speed = 4.2;
        const dir = Math.random() * Math.PI * 2;
        const pitch = Math.random() * Math.PI - Math.PI / 2;
        p.vx = Math.cos(dir) * Math.cos(pitch) * speed;
        p.vz = Math.sin(dir) * Math.cos(pitch) * speed;
        p.vy = Math.sin(pitch) * speed;
        p.lifeLeft = Math.min(p.lifeLeft, 0.9);
        p.drag = 1.6;
        p.size *= 0.7;
      }
      const age = p.lifeTotal - p.lifeLeft;
      let alpha = Math.min(1, age * 9) * Math.min(1, p.lifeLeft / 0.55);
      if (p.flicker) alpha *= 0.5 + 0.5 * Math.abs(Math.sin(elapsed * 13 + p.flickerPhase));
      positions[i * 3] = p.x; positions[i * 3 + 1] = p.y; positions[i * 3 + 2] = p.z;
      alphas[i] = alpha;
      sizes[i] = p.size * (0.7 + 0.3 * Math.min(1, p.lifeLeft / p.lifeTotal + 0.4));
    }
    burst.alive = anyAlive;
    burst.positionAttr.needsUpdate = true;
    burst.alphaAttr.needsUpdate = true;
    burst.sizeAttr.needsUpdate = true;
    burst.geometry.setDrawRange(0, particles.length);
  }

  function update(dt: number, elapsed: number): void {
    // 升空壳。
    for (const shell of shells) {
      if (shell.done) continue;
      shell.y += SHELL_SPEED * dt;
      const wobble = Math.sin(elapsed * 7 + shell.swayPhase) * 0.12;
      shell.trailTimer -= dt;
      if (shell.trailTimer <= 0) {
        shell.trailTimer = 0.03;
        spawnTrail(shell.originX + wobble, shell.y, shell.originZ, colorOf(shell.design.colors.trail), 0.55, 0.16, 0.85);
      }
      if (shell.y >= shell.targetY) {
        shell.done = true;
        explode(shell);
      }
    }
    // 已爆的壳及时移出，避免长场烟花秀里数组无限累积。
    for (let i = shells.length - 1; i >= 0; i -= 1) {
      if (shells[i]!.done) shells.splice(i, 1);
    }
    // 拖尾衰减。
    for (let i = 0; i < TRAIL_CAPACITY; i += 1) {
      if (trailLife[i]! <= 0) { trailAlphas[i] = 0; continue; }
      trailLife[i]! -= dt;
      const fade = Math.max(0, trailLife[i]! / trailLifeTotal[i]!);
      trailAlphas[i] = trailBaseAlpha[i]! * fade * fade;
    }
    trailGeometry.getAttribute('position').needsUpdate = true;
    trailGeometry.getAttribute('aAlpha').needsUpdate = true;
    // 全缓冲常驻绘制（环冲缓冲自带旧余烬淡出）。
    trailGeometry.setDrawRange(0, TRAIL_CAPACITY);
    // 爆裂云。
    for (let i = bursts.length - 1; i >= 0; i -= 1) {
      const burst = bursts[i]!;
      updateBurst(burst, dt, elapsed);
      if (!burst.alive) {
        scene.remove(burst.points);
        burst.geometry.dispose();
        bursts.splice(i, 1);
      }
    }
    // 像素比例：正交半高 zoom 下每世界单位对应的像素数。
    const zoom = Math.max(options.getZoom(), 0.5);
    material.uniforms.uPixelScale!.value = options.getViewportHeight() / (2 * zoom);
  }

  function activeCount(): number {
    return bursts.length + shells.filter((shell) => !shell.done).length;
  }

  function launch(design: FireworkDesign, origin: { x: number; z: number }, opts?: { delay?: number; onBurst?: () => void; targetYJitter?: number }): void {
    const start = () => {
      if (shells.filter((shell) => !shell.done).length >= MAX_SHELLS) return;
      const jitter = opts?.targetYJitter ?? 2;
      shells.push({
        originX: origin.x, originZ: origin.z,
        y: 0.3,
        targetY: Math.max(20, design.height + (Math.random() * 2 - 1) * jitter),
        swayPhase: Math.random() * Math.PI * 2,
        design, onBurst: opts?.onBurst, trailTimer: 0, done: false,
      });
    };
    if (opts?.delay && opts.delay > 0) window.setTimeout(start, opts.delay * 1000);
    else start();
  }

  function dispose(): void {
    for (const burst of bursts) {
      scene.remove(burst.points);
      burst.geometry.dispose();
    }
    bursts.length = 0;
    shells.length = 0;
    scene.remove(trailPoints);
    trailGeometry.dispose();
    material.dispose();
  }

  return { launch, update, dispose, activeCount };
}

export type FireworksEngine = ReturnType<typeof createFireworksEngine>;
// 广告牌法线与 CAMERA_OFFSET 一致性的静态提醒（见 fireworksConstants.ts）。
void CAMERA_OFFSET_BILLBOARD_NORMAL;
