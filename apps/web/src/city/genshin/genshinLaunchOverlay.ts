// 原神启动页全屏覆盖层——原神研究院彩蛋的「云原神」正片。
//
// 视觉参考 github.com/alphardex/genshin-replica（原神启动页复刻，外部只读
// 参考），因仓库资产树已接近上限且原资产含官方版权素材，这里全部程序化
// 重绘：渐变夜空、星尘、极光、云海、神柱列与中央大门均为代码生成的
// shader / 几何，不含任何外部资源；音效由 genshinSounds（WebAudio 合成）
// 提供。
//
// 性能约定（与北城 boot 管线一致）：
//  1. 本模块只被动态 import() 引用——Vite 会拆成独立 chunk。城市 idle
//     时 controller 只预下载（fetch+eval）模块定义，本模块顶层零副作用
//     （不建场景、不挂监听），重代码（场景构建/每帧渲染）在选择「好想玩
//     原神！」后才运行。
//  2. 不创建第二个 WebGL 上下文：接入主帧循环，城市渲染在 overlay 激活
//     期间被跳过（见 frameLoop），渲染成本反而低于平时。
//  3. 退出时全部几何/材质/纹理 dispose，DOM 移除，不残留状态。
import * as THREE from 'three';
import { gsap } from 'gsap';
import { playDuang, playDoorOpen, playFlash, startAmbientPad, type PadHandle } from './genshinSounds';

export interface GenshinLaunchOverlayLike {
  isActive(): boolean;
  /** 全屏进入（DOM 挂载 + 相位时间线启动；调用前先 prewarm）。 */
  enter(): void;
  /** 进入全屏前把场景材质在主 renderer 上编译一遍（SwiftShader 软渲下的
   *  编译大头从「enter 后首帧」挪到「云原神预热阶段」）。 */
  prewarm(renderer: THREE.WebGLRenderer): void;
  render(renderer: THREE.WebGLRenderer): void;
  stop(): void;
  dispose(): void;
}

export interface GenshinLaunchOverlayOptions {
  /** 全屏体验结束后回调（已淡出并释放资源）。 */
  onExited?: (completed: boolean) => void;
  /** 用户主动中止（ESC）时回调；onExited 已覆盖，一般无需两者都用。 */
  onAborted?: () => void;
  /** prefers-reduced-motion：跳过前飞/开门动画，直接进入启动页终态。 */
  reduced?: boolean;
  /** 结束 toast（交给 controller 的 toast 通道）。 */
  showToast?: (message: string) => void;
}

type Phase = 'idle' | 'approach' | 'door' | 'dive' | 'boot' | 'exiting';

const NIGHT_HORIZON = new THREE.Color(0x123a6b);

// ─── 共享 shader 片段 ────────────────────────────────────────────────────────
const NOISE_GLSL = /* glsl */ `
float hash21(vec2 p) {
  p = fract(p * vec2(123.34, 345.45));
  p += dot(p, p + 34.345);
  return fract(p.x * p.y);
}
float noise2(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  float a = hash21(i);
  float b = hash21(i + vec2(1.0, 0.0));
  float c = hash21(i + vec2(0.0, 1.0));
  float d = hash21(i + vec2(1.0, 1.0));
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
}
float fbm(vec2 p) {
  float v = 0.0;
  float a = 0.5;
  for (int i = 0; i < 4; i++) {
    v += a * noise2(p);
    p *= 2.03;
    a *= 0.5;
  }
  return v;
}
`;

const SKY_VERT = /* glsl */ `
varying vec3 vWorld;
void main() {
  vWorld = (modelMatrix * vec4(position, 1.0)).xyz;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

const SKY_FRAG = /* glsl */ `
precision highp float;
varying vec3 vWorld;
uniform float uTime;
${NOISE_GLSL}
void main() {
  vec3 dir = normalize(vWorld);
  float h = clamp(dir.y * 0.5 + 0.5, 0.0, 1.0);
  // 夜空：天顶深蓝 → 地平线暖金，地平线处星云微光。
  vec3 zenith = vec3(0.024, 0.05, 0.13);
  vec3 horizon = vec3(0.55, 0.34, 0.16);
  vec3 col = mix(horizon, zenith, pow(h, 0.62));
  float glowband = smoothstep(0.08, 0.0, abs(dir.y - 0.05));
  col += vec3(0.32, 0.16, 0.06) * glowband * 0.55;
  // 缓慢流动的薄云。
  float cloud = fbm(vec2(atan(dir.z, dir.x) * 2.6, dir.y * 5.0) + uTime * 0.006);
  col += vec3(0.10, 0.07, 0.05) * cloud * smoothstep(0.05, 0.4, h);
  gl_FragColor = vec4(col, 1.0);
}
`;

const STAR_VERT = /* glsl */ `
attribute float aPhase;
attribute float aSize;
uniform float uTime;
varying float vTwinkle;
void main() {
  vTwinkle = 0.55 + 0.45 * sin(uTime * 1.7 + aPhase * 6.2831);
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  gl_PointSize = aSize * (300.0 / -mv.z) * 0.02 + 1.2;
  gl_Position = projectionMatrix * mv;
}
`;

const STAR_FRAG = /* glsl */ `
precision highp float;
varying float vTwinkle;
void main() {
  vec2 d = gl_PointCoord - vec2(0.5);
  float r = length(d);
  float alpha = smoothstep(0.5, 0.06, r) * vTwinkle;
  gl_FragColor = vec4(vec3(0.92, 0.95, 1.0), alpha);
}
`;

const AURORA_VERT = /* glsl */ `
uniform float uTime;
varying vec2 vUv;
varying float vWave;
void main() {
  vUv = uv;
  vec3 p = position;
  // 顶点级波浪：让光带随 x 缓慢起伏流动（不同相位错开层次）。
  float wave = sin(p.x * 0.045 + uTime * 0.22) * 6.0
             + sin(p.x * 0.017 - uTime * 0.13) * 9.0;
  p.y += wave * uv.y;
  p.z += sin(p.x * 0.03 + uTime * 0.16) * 5.0 * uv.y;
  vWave = wave;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
}
`;

const AURORA_FRAG = /* glsl */ `
precision highp float;
varying vec2 vUv;
varying float vWave;
uniform float uTime;
${NOISE_GLSL}
void main() {
  // 流动的幕帘条纹：fbm 沿光带横向滚动。
  float curtain = fbm(vec2(vUv.x * 7.0 + uTime * 0.05, vUv.y * 2.2 - uTime * 0.018));
  float bands = 0.45 + 0.55 * fbm(vec2(vUv.x * 18.0 - uTime * 0.09, vUv.y * 3.0));
  float intensity = curtain * bands;
  // 底缘亮、顶缘淡出。
  float fade = smoothstep(0.0, 0.35, vUv.y) * (1.0 - smoothstep(0.55, 1.0, vUv.y));
  intensity *= fade * 1.9;
  // 绿→青→紫的极光渐变。
  vec3 col = mix(vec3(0.05, 0.85, 0.45), vec3(0.15, 0.45, 0.95), vUv.y);
  col = mix(col, vec3(0.55, 0.2, 0.8), smoothstep(0.5, 1.0, vUv.y) * 0.6);
  col *= intensity;
  gl_FragColor = vec4(col, clamp(intensity, 0.0, 0.9));
}
`;

const SEA_VERT = /* glsl */ `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

const SEA_FRAG = /* glsl */ `
precision highp float;
varying vec2 vUv;
uniform float uTime;
${NOISE_GLSL}
void main() {
  vec2 uv = vUv * vec2(9.0, 5.0);
  // 双层滚动云海：粗波 + 细浪。
  float base = fbm(uv + vec2(uTime * 0.012, uTime * 0.004));
  float detail = fbm(uv * 2.3 - vec2(uTime * 0.017, 0.0));
  float h = base * 0.72 + detail * 0.28;
  // 远处（uv.y 小）抬升为地平线亮带，近处压暗。
  float depth = smoothstep(0.0, 0.42, vUv.y);
  vec3 near = vec3(0.05, 0.09, 0.17);
  vec3 far = vec3(0.62, 0.47, 0.34);
  vec3 col = mix(far, near, depth);
  col += vec3(0.18, 0.13, 0.08) * pow(h, 2.0) * (1.0 - depth * 0.7);
  float alpha = 0.85 + 0.15 * smoothstep(0.35, 0.0, h);
  gl_FragColor = vec4(col, alpha);
}
`;

const ROAD_FRAG = /* glsl */ `
precision highp float;
varying vec2 vUv;
uniform float uTime;
${NOISE_GLSL}
void main() {
  // 中央光带：向门汇聚的流光。
  float lane = 1.0 - smoothstep(0.06, 0.34, abs(vUv.x - 0.5));
  float flow = 0.55 + 0.45 * sin((vUv.y * 13.0 - uTime * 1.35) * 6.2831);
  float sparkle = fbm(vec2(vUv.x * 4.0, vUv.y * 30.0 - uTime * 2.4));
  float end = 1.0 - smoothstep(0.72, 1.0, vUv.y);
  float intensity = lane * (0.35 + 0.5 * flow + 0.3 * sparkle) * end;
  vec3 col = mix(vec3(0.25, 0.5, 0.9), vec3(0.95, 0.85, 0.55), flow * 0.5);
  col *= intensity;
  gl_FragColor = vec4(col, intensity * 0.85);
}
`;

// ─── 工具 ────────────────────────────────────────────────────────────────────
function makeDisposeBag() {
  const geometries = new Set<THREE.BufferGeometry>();
  const materials = new Set<THREE.Material>();
  const textures = new Set<THREE.Texture>();
  return {
    add<T extends THREE.BufferGeometry>(g: T): T { geometries.add(g); return g; },
    mat<T extends THREE.Material>(m: T): T { materials.add(m); return m; },
    tex<T extends THREE.Texture>(t: T): T { textures.add(t); return t; },
    dispose() {
      geometries.forEach((g) => g.dispose());
      materials.forEach((m) => m.dispose());
      textures.forEach((t) => t.dispose());
      geometries.clear(); materials.clear(); textures.clear();
    },
  };
}

interface SceneRig {
  root: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  uniforms: Array<{ value: number }>;
  doorGroup: THREE.Group;
  doorWings: [THREE.Object3D, THREE.Object3D];
  doorGlow: THREE.Mesh;
  skyMat: THREE.ShaderMaterial;
}

function buildScene(bag: ReturnType<typeof makeDisposeBag>): SceneRig {
  const root = new THREE.Scene();
  root.fog = new THREE.Fog(NIGHT_HORIZON.getHex(), 55, 240);

  const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 420);
  camera.position.set(0, 7.5, 64);
  camera.lookAt(0, 9.5, -14);

  const uniforms: Array<{ value: number }> = [];

  // 渐变夜空（大球内壁）。
  const skyMat = new THREE.ShaderMaterial({
    vertexShader: SKY_VERT,
    fragmentShader: SKY_FRAG,
    side: THREE.BackSide,
    depthWrite: false,
    uniforms: { uTime: { value: 0 } },
  });
  bag.mat(skyMat);
  uniforms.push(skyMat.uniforms.uTime!);
  root.add(new THREE.Mesh(bag.add(new THREE.SphereGeometry(320, 40, 24)), skyMat));

  // 星尘（上半球壳）。
  const starCount = 1300;
  const positions = new Float32Array(starCount * 3);
  const phases = new Float32Array(starCount);
  const sizes = new Float32Array(starCount);
  for (let i = 0; i < starCount; i += 1) {
    const theta = Math.random() * Math.PI * 2;
    const phi = Math.acos(THREE.MathUtils.lerp(0.05, 0.92, Math.random()));
    const r = THREE.MathUtils.lerp(210, 290, Math.random());
    positions[i * 3] = r * Math.sin(phi) * Math.cos(theta);
    positions[i * 3 + 1] = r * Math.cos(phi);
    positions[i * 3 + 2] = r * Math.sin(phi) * Math.sin(theta);
    phases[i] = Math.random();
    sizes[i] = THREE.MathUtils.lerp(1.4, 4.2, Math.random() * Math.random());
  }
  const starGeo = bag.add(new THREE.BufferGeometry());
  starGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  starGeo.setAttribute('aPhase', new THREE.BufferAttribute(phases, 1));
  starGeo.setAttribute('aSize', new THREE.BufferAttribute(sizes, 1));
  const starMat = bag.mat(new THREE.ShaderMaterial({
    vertexShader: STAR_VERT,
    fragmentShader: STAR_FRAG,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    uniforms: { uTime: { value: 0 } },
  }));
  uniforms.push(starMat.uniforms.uTime!);
  root.add(new THREE.Points(starGeo, starMat));

  // 极光（两道相位错开的光带）。
  const auroraMat = bag.mat(new THREE.ShaderMaterial({
    vertexShader: AURORA_VERT,
    fragmentShader: AURORA_FRAG,
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    blending: THREE.AdditiveBlending,
    uniforms: { uTime: { value: 0 } },
  }));
  uniforms.push(auroraMat.uniforms.uTime!);
  for (const [x, y, z, rot] of [[-34, 66, -96, 0.28], [30, 78, -120, -0.2]] as const) {
    const ribbon = new THREE.Mesh(bag.add(new THREE.PlaneGeometry(300, 64, 90, 14)), auroraMat);
    ribbon.position.set(x, y, z);
    ribbon.rotation.z = rot;
    root.add(ribbon);
  }

  // 云海。
  const seaMat = bag.mat(new THREE.ShaderMaterial({
    vertexShader: SEA_VERT,
    fragmentShader: SEA_FRAG,
    transparent: true,
    depthWrite: false,
    uniforms: { uTime: { value: 0 } },
  }));
  uniforms.push(seaMat.uniforms.uTime!);
  const sea = new THREE.Mesh(bag.add(new THREE.PlaneGeometry(760, 560, 1, 1)), seaMat);
  sea.rotation.x = -Math.PI / 2;
  sea.position.set(0, -3, -60);
  root.add(sea);

  // 神柱列（左右各五根，透视纵深排开；柱身/柱饰共享几何）。
  const columnGeo = bag.add(new THREE.CylinderGeometry(0.85, 1.0, 13, 10));
  const capitalGeo = bag.add(new THREE.BoxGeometry(2.5, 0.7, 2.5));
  const baseGeo = bag.add(new THREE.BoxGeometry(2.9, 0.9, 2.9));
  const ringGeo = bag.add(new THREE.TorusGeometry(1.02, 0.09, 8, 20));
  const stoneMat = new THREE.MeshStandardMaterial({ color: 0xcfc4ae, roughness: 0.82, metalness: 0.05 });
  const goldMat = new THREE.MeshStandardMaterial({ color: 0xe8b23c, roughness: 0.32, metalness: 0.6, emissive: 0x664410, emissiveIntensity: 0.5 });
  bag.mat(stoneMat);
  bag.mat(goldMat);
  const columns = new THREE.Group();
  for (let i = 0; i < 5; i += 1) {
    const z = 16 - i * 8.5;
    for (const side of [-1, 1]) {
      const pillar = new THREE.Group();
      const shaft = new THREE.Mesh(columnGeo, stoneMat);
      shaft.position.y = 6.5;
      const base = new THREE.Mesh(baseGeo, stoneMat);
      base.position.y = 0.45;
      const capital = new THREE.Mesh(capitalGeo, stoneMat);
      capital.position.y = 13.35;
      const ring = new THREE.Mesh(ringGeo, goldMat);
      ring.position.y = 12.1;
      ring.rotation.x = Math.PI / 2;
      pillar.add(shaft, base, capital, ring);
      pillar.position.set(side * 11.5, -1.5, z);
      columns.add(pillar);
    }
  }
  root.add(columns);

  // 中央大门（石框 + 双扇门体 + 门缝白光）。
  const doorGroup = new THREE.Group();
  const frameMat = new THREE.MeshStandardMaterial({ color: 0xd8cbae, roughness: 0.7, metalness: 0.1 });
  const gateMat = new THREE.MeshStandardMaterial({ color: 0x2c3f66, roughness: 0.4, metalness: 0.3, emissive: 0x101c33, emissiveIntensity: 0.6 });
  const trimMat = goldMat;
  bag.mat(frameMat);
  bag.mat(gateMat);
  const jambGeo = bag.add(new THREE.BoxGeometry(1.4, 16.5, 2.4));
  const lintelGeo = bag.add(new THREE.BoxGeometry(12.6, 1.6, 2.6));
  const wingGeo = bag.add(new THREE.BoxGeometry(4.6, 14.4, 0.7));
  const glowGeo = bag.add(new THREE.PlaneGeometry(1.2, 14.2));
  const glowMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0 });
  bag.mat(glowMat);
  const jambL = new THREE.Mesh(jambGeo, frameMat);
  jambL.position.set(-5.6, 8.2, 0);
  const jambR = new THREE.Mesh(jambGeo, frameMat);
  jambR.position.set(5.6, 8.2, 0);
  const lintel = new THREE.Mesh(lintelGeo, frameMat);
  lintel.position.set(0, 17.3, 0);
  // 金饰门环。
  const sealGeo = bag.add(new THREE.TorusGeometry(1.5, 0.16, 8, 26));
  const seal = new THREE.Mesh(sealGeo, trimMat);
  seal.position.set(0, 15.2, 1.15);
  doorGroup.add(jambL, jambR, lintel, seal);
  const wingL = new THREE.Mesh(wingGeo, gateMat);
  wingL.position.set(-2.32, 7.4, 0.3);
  const wingR = new THREE.Mesh(wingGeo, gateMat);
  wingR.position.set(2.32, 7.4, 0.3);
  doorGroup.add(wingL, wingR);
  const doorGlow = new THREE.Mesh(glowGeo, glowMat);
  doorGlow.position.set(0, 7.6, -0.4);
  doorGroup.add(doorGlow);
  doorGroup.position.set(0, -34, -26);
  root.add(doorGroup);

  // 发光路（脚下 → 大门）。
  const roadMat = bag.mat(new THREE.ShaderMaterial({
    vertexShader: SEA_VERT,
    fragmentShader: ROAD_FRAG,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    uniforms: { uTime: { value: 0 } },
  }));
  uniforms.push(roadMat.uniforms.uTime!);
  const road = new THREE.Mesh(bag.add(new THREE.PlaneGeometry(9, 108, 1, 1)), roadMat);
  road.rotation.x = -Math.PI / 2;
  road.position.set(0, -1.6, 18);
  root.add(road);

  return { root, camera, uniforms, doorGroup, doorWings: [wingL, wingR], doorGlow, skyMat };
}

// ─── DOM 覆盖层 ──────────────────────────────────────────────────────────────
const ROOT_HTML = `
  <div class="gl-vignette"></div>
  <div class="gl-title">
    <span class="gl-title-cn">原神</span>
    <span class="gl-title-sub">GENSHIN IMPACT · 研究院复刻</span>
  </div>
  <button type="button" class="gl-enter">点击任意处进入</button>
  <button type="button" class="gl-door-enter">进入</button>
  <div class="gl-disclaimer">非官方社区致敬作品 · 原神及相关商标归属 miHoYo / 米哈游</div>
  <div class="gl-flash"></div>
  <div class="gl-loading">
    <div class="gl-orbit"><i></i><i></i><i></i><i></i><i></i><i></i><i></i></div>
    <div class="gl-boot-title">原神，启动！</div>
    <div class="gl-bar"><span class="gl-bar-fill"></span></div>
    <div class="gl-pct">0%</div>
  </div>
  <div class="gl-hint">按 ESC 离开</div>
`;

export function createGenshinLaunchOverlay(options: GenshinLaunchOverlayOptions = {}): GenshinLaunchOverlayLike {
  const bag = makeDisposeBag();
  const rig = buildScene(bag);
  let phase: Phase = 'idle';
  let rootEl: HTMLDivElement | null = null;
  let timeline: gsap.core.Timeline | null = null;
  let pad: PadHandle | null = null;
  let clockStart = 0;
  let exitToastShown = false;
  let resizeHandler: (() => void) | null = null;

  function el<T extends HTMLElement>(selector: string): T | null {
    return rootEl?.querySelector<T>(selector) ?? null;
  }

  function enter() {
    if (phase !== 'idle') return;
    phase = 'approach';
    const root = document.createElement('div');
    root.id = 'genshinLaunch';
    root.innerHTML = ROOT_HTML;
    document.body.append(root);
    rootEl = root;
    resizeHandler = () => { syncViewport(); };
    window.addEventListener('resize', resizeHandler);
    syncViewport();
    pad = startAmbientPad();
    clockStart = performance.now();
    // 入场淡入 + 标题浮现 + 相机前飞。
    root.classList.add('gl-phase-approach');
    root.addEventListener('click', onApproachTap, { once: true });
    timeline = gsap.timeline();
    if (options.reduced) {
      rig.camera.position.set(0, 7.5, 26);
      startBootSequence();
    } else {
      timeline.to(rig.camera.position, { z: 26, duration: 15, ease: 'power1.out' }, 0);
    }
  }

  function syncViewport() {
    if (!rootEl) return;
    const w = window.innerWidth;
    const h = window.innerHeight;
    rig.camera.aspect = w / Math.max(1, h);
    rig.camera.updateProjectionMatrix();
  }


  function onApproachTap() {
    if (phase !== 'approach') return;
    phase = 'door';
    rootEl?.classList.remove('gl-phase-approach');
    rootEl?.classList.add('gl-phase-door');
    playDuang();
    // 相机停稳（若仍在前飞，截停到附近位置）。
    timeline?.kill();
    timeline = gsap.timeline();
    timeline.to(rig.camera.position, { z: Math.max(rig.camera.position.z, 24), duration: 1.6, ease: 'power2.out' }, 0);
    // 大门自云海浮起。
    timeline.to(rig.doorGroup.position, { y: 0, duration: 1.5, ease: 'back.out(1.4)' }, 0.15);
    const enterBtn = el<HTMLButtonElement>('.gl-door-enter');
    enterBtn?.addEventListener('click', onDoorEnter);
  }

  function onDoorEnter() {
    if (phase !== 'door') return;
    phase = 'dive';
    rootEl?.classList.remove('gl-phase-door');
    rootEl?.classList.add('gl-phase-dive');
    playDoorOpen();
    timeline?.kill();
    timeline = gsap.timeline();
    // 门缝白光亮起，双扇旋开。
    timeline.to(rig.doorGlow.material, { opacity: 0.95, duration: 0.35, ease: 'power2.in' }, 0);
    timeline.to(rig.doorWings[0].rotation, { y: -1.9, duration: 0.8, ease: 'power2.inOut' }, 0.1);
    timeline.to(rig.doorWings[1].rotation, { y: 1.9, duration: 0.8, ease: 'power2.inOut' }, 0.1);
    timeline.to(rig.doorGlow.scale, { x: 5.5, duration: 0.7, ease: 'power2.in' }, 0.15);
    // 相机俯冲过门。
    timeline.to(rig.camera.position, { z: -13, duration: 1.0, ease: 'power2.in' }, 0.25);
    // 白闪 + 声。
    timeline.call(() => {
      playFlash();
      rootEl?.classList.add('flashing');
    }, [], 0.9);
    timeline.call(() => {
      rootEl?.classList.remove('flashing');
      startBootSequence();
    }, [], 2.0);
  }

  function startBootSequence() {
    if (phase === 'boot' || phase === 'exiting') return;
    phase = 'boot';
    rootEl?.classList.remove('gl-phase-dive');
    rootEl?.classList.add('gl-phase-boot');
    pad?.stop();
    const bar = el<HTMLElement>('.gl-bar-fill');
    const pct = el<HTMLElement>('.gl-pct');
    timeline?.kill();
    timeline = gsap.timeline();
    const state = { v: 0 };
    timeline.to(state, {
      v: 94.4,
      duration: 3.4,
      ease: 'power1.out',
      onUpdate() {
        if (bar) bar.style.width = `${state.v}%`;
        if (pct) pct.textContent = `${state.v.toFixed(1)}%`;
      },
    });
    // 卡在 94.4%：致敬启动页名场面，稍后自动收场。
    timeline.call(() => {
      if (!exitToastShown) {
        exitToastShown = true;
        options.showToast?.('启动就差最后 5.6%——这是仪式感。');
      }
    }, [], 3.6);
    timeline.call(() => { finish(true); }, [], 6.6);
  }

  function finish(completed: boolean) {
    if (phase === 'exiting') return;
    phase = 'exiting';
    if (!completed) options.onAborted?.();
    rootEl?.classList.add('leaving');
    window.setTimeout(() => {
      teardown();
      options.onExited?.(completed);
    }, 900);
  }

  function teardown() {
    timeline?.kill();
    timeline = null;
    pad?.stop();
    pad = null;
    if (resizeHandler) {
      window.removeEventListener('resize', resizeHandler);
      resizeHandler = null;
    }
    rootEl?.remove();
    rootEl = null;
    bag.dispose();
    phase = 'idle';
  }

  return {
    isActive: () => phase !== 'idle',
    enter,
    prewarm(renderer: THREE.WebGLRenderer) {
      renderer.compile(rig.root, rig.camera);
    },
    render(renderer: THREE.WebGLRenderer) {
      if (phase === 'idle') return;
      const t = (performance.now() - clockStart) / 1000;
      for (const u of rig.uniforms) u.value = t;
      renderer.render(rig.root, rig.camera);
    },
    stop() { finish(false); },
    dispose() { finish(false); },
  };
}
