/**
 * 火烧小城效果 — 城市像一张二维纸片，从东侧被火点燃，向西蔓延烧尽、卷曲成灰。
 *
 * 触发：调用 `createBurnCityEffect(...).trigger()`。当前由点击「文训社（外环）」接入。
 *
 * 实现思路：
 *  1. 用一张离屏 WebGLRenderTarget，从正上方拍摄当前城市（俯视 → 城市被拍成
 *     一张扁平纸片贴图），保留原始 isometric 相机的「东 = +x / -z、西 = -x / +z」
 *     方位，使火焰从屏幕东侧向西侧蔓延。
 *  2. 不创建第二个 WebGL 上下文（软件渲染/移动端多上下文易丢失），而是把烧灼
 *     quad 接入主帧循环：城市每帧渲染完成后，用主 renderer 在默认帧缓冲上叠加
 *     一张全屏 quad，材质是自定义烧灼 ShaderMaterial——以经过时间驱动的「烧灼
 *     进度」作为 x 方向的火线，火线前方（未烧）显示城市纸片，火线处发光发烫，
 *     火线后方逐渐碳化、卷曲并淡出透明。
 *  3. 烧灼期间主 3D 场景被 quad 完全覆盖（quad 未烧区显示俯视纸片），烧尽后
 *     quad 淡出，露出主画布。
 *
 * 全部资源在效果结束时释放，不残留进程或额外的 WebGL 上下文。
 */
import * as THREE from 'three';
import { gsap } from 'gsap';

export type BurnCityEffectOptions = {
  /** 主场景，用于俯视拍摄纸片贴图。 */
  getScene: () => THREE.Scene | null;
  /** 主渲染器，用于把城市渲染到离屏 target，以及叠加烧灼 quad。 */
  getRenderer: () => THREE.WebGLRenderer | null;
  /** 城市范围半径（用于决定俯视相机视野），默认沿用 CITY_LIMIT=42。 */
  cityLimit?: number;
  /** 是否减少动画（prefers-reduced-motion）。 */
  reduced?: boolean;
};

export type BurnOverlay = {
  /** 每帧城市渲染后调用：在主画布上叠加烧灼层。仅在 active 时实际绘制。 */
  render: (renderer: THREE.WebGLRenderer) => void;
  /** 当前是否正在烧灼（帧循环据此决定是否调用 render）。 */
  isActive: () => boolean;
  /** 当前烧灼进度 0..1（诊断用）。 */
  getProgress: () => number;
};

// ─── 烧灼着色器 ──────────────────────────────────────────────────────────────
// progress：0=未烧，1=完全烧尽。由 CPU 端 GSAP 随时间推进。
// uSpread：火焰前沿在归一化 x 方向的位置（东→西），随 progress 推进。
const VERT = /* glsl */ `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = vec4(position.xy, 0.0, 1.0);
}
`;

const FRAG = /* glsl */ `
precision highp float;
varying vec2 vUv;
uniform sampler2D uPhoto;
uniform float uProgress;   // 全局烧灼进度 0..1（控制火线位置与碳化）
uniform float uTime;       // 运行时间（s），驱动火焰/噪声抖动
uniform vec2  uResolution; // overlay canvas 物理像素
uniform float uOpacity;    // 整体不透明度（淡入/淡出时由 CPU 推进）

// 哈希与噪声
float hash21(vec2 p){
  p = fract(p * vec2(123.34, 345.45));
  p += dot(p, p + 34.345);
  return fract(p.x * p.y);
}
float noise2(vec2 p){
  vec2 i = floor(p);
  vec2 f = fract(p);
  float a = hash21(i);
  float b = hash21(i + vec2(1.0, 0.0));
  float c = hash21(i + vec2(0.0, 1.0));
  float d = hash21(i + vec2(1.0, 1.0));
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
}
float fbm(vec2 p){
  float v = 0.0;
  float a = 0.5;
  for (int i = 0; i < 5; i++){
    v += a * noise2(p);
    p *= 2.02;
    a *= 0.5;
  }
  return v;
}

void main(){
  vec2 uv = vUv;
  // 东侧（uv.x≈1）先点燃，向西（uv.x≈0）蔓延。沿 x 加噪声让火线不规则。
  float n = fbm(uv * 3.0 + vec2(uTime * 0.15, 0.0));
  float line = uProgress * 1.25 - 0.12;          // 让两端留出余量
  // 火线 x 位置：基础线性 + 噪声扰动，使前沿呈锯齿状。
  float edge = line + (n - 0.5) * 0.18;
  float dist = uv.x - edge;                       // >0 未烧，<0 已烧

  vec4 photo = texture2D(uPhoto, uv);

  // 未烧区域：略带受热发红。
  vec3 intact = photo.rgb;

  // 火线带（dist 接近 0）：明亮的橙黄火焰 + 白热核心。
  float flameBand = exp(-dist * dist / 0.0016);   // 窄火线
  float glow = exp(-dist * dist / 0.02);          // 外层暖光
  vec3 fire = mix(vec3(1.0, 0.55, 0.12), vec3(1.0, 0.95, 0.7), flameBand);
  // 火焰闪烁
  float flick = 0.6 + 0.4 * noise2(uv * 18.0 + uTime * 8.0);
  fire *= flick;

  // 已烧区域：碳化（暗灰带红余烬）并逐渐透明，边缘卷曲。
  float burn = smoothstep(0.02, -0.25, dist);     // 0 未碳化 → 1 完全碳化
  // 余烬：碳化区残留的暗红光，随时间衰减。
  float ember = burn * (0.5 + 0.5 * fbm(uv * 8.0 - uTime * 0.5));
  vec3 char = mix(vec3(0.06, 0.04, 0.03), vec3(0.18, 0.06, 0.02), ember);
  // 烧得越透越暗，最终卷成灰烬。
  float ash = smoothstep(0.0, -0.6, dist);        // 进一步烧透
  char *= (1.0 - ash * 0.85);

  // 合成：未烧 / 火线 / 已烧。
  vec3 col = intact;
  col = mix(col, char, burn);
  col += fire * flameBand * 1.6;
  col += fire * glow * 0.25;

  // alpha：未烧全显；火线半透（火光本身有 alpha）；烧透后卷曲消失。
  float alpha = 1.0;
  alpha = mix(alpha, 0.0, smoothstep(0.0, -0.5, dist));   // 烧透区透明
  // 火线边缘轻微透明，让火看起来浮在纸上。
  alpha = mix(alpha, 0.85, flameBand * 0.4);

  // 整体随进度末端完全淡出（全部烧尽后留黑）。
  alpha *= (1.0 - smoothstep(0.92, 1.0, uProgress));
  alpha *= uOpacity;

  gl_FragColor = vec4(col, alpha);
}
`;

export function createBurnCityEffect(options: BurnCityEffectOptions): BurnOverlay & { trigger: () => boolean; dispose: () => void } {
  let active = false;
  let disposed = false;
  let overlayScene: THREE.Scene | null = null;
  let overlayCamera: THREE.OrthographicCamera | null = null;
  let quad: THREE.Mesh | null = null;
  let material: THREE.ShaderMaterial | null = null;
  let photoTarget: THREE.WebGLRenderTarget | null = null;
  let shotCamera: THREE.OrthographicCamera | null = null;
  let startWallTime = 0;
  let resizeHandler: (() => void) | null = null;
  let timeline: gsap.core.Timeline | null = null;
  // overlay 不透明度（0=透明露出主画布，1=完全覆盖）。由 GSAP 推进。
  let overlayOpacity = 0;

  function captureCityPhoto(): THREE.Texture | null {
    const scene = options.getScene();
    const renderer = options.getRenderer();
    if (!scene || !renderer) return null;

    const limit = options.cityLimit ?? 42;
    const span = limit + 6; // 略大于城市范围，留出边距
    // 俯视相机：正上方往下看，东(+x)在右、北(-z)在上，与屏幕方位一致。
    if (!shotCamera) {
      shotCamera = new THREE.OrthographicCamera(-span, span, span, -span, 0.1, 200);
      shotCamera.position.set(0, 100, 0);
      shotCamera.up.set(0, 0, -1);
      shotCamera.lookAt(0, 0, 0);
      shotCamera.updateProjectionMatrix();
    }

    const size = 1024;
    const target = new THREE.WebGLRenderTarget(size, size, {
      minFilter: THREE.LinearFilter,
      magFilter: THREE.LinearFilter,
      wrapS: THREE.ClampToEdgeWrapping,
      wrapT: THREE.ClampToEdgeWrapping,
      type: THREE.UnsignedByteType,
      depthBuffer: true,
      stencilBuffer: false,
    });
    photoTarget = target;

    const prevTarget = renderer.getRenderTarget();
    const prevBackground = scene.background;
    const prevClearAlpha = renderer.getClearAlpha();
    renderer.setRenderTarget(target);
    renderer.setClearColor(0x05060a, 1);
    renderer.clear();
    renderer.render(scene, shotCamera);
    renderer.setRenderTarget(prevTarget);
    renderer.setClearAlpha(prevClearAlpha);
    scene.background = prevBackground;
    return target.texture;
  }

  function buildOverlay(texture: THREE.Texture) {
    const renderer = options.getRenderer();
    const w = renderer ? renderer.domElement.width : window.innerWidth;
    const h = renderer ? renderer.domElement.height : window.innerHeight;

    overlayScene = new THREE.Scene();
    overlayCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);

    material = new THREE.ShaderMaterial({
      uniforms: {
        uPhoto: { value: texture },
        uProgress: { value: 0 },
        uTime: { value: 0 },
        uOpacity: { value: 0 },
        uResolution: { value: new THREE.Vector2(w, h) },
      },
      vertexShader: VERT,
      fragmentShader: FRAG,
      transparent: true,
      depthTest: false,
      depthWrite: false,
    });
    quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), material);
    quad.frustumCulled = false;
    overlayScene.add(quad);
  }

  function onResize() {
    if (!material) return;
    const renderer = options.getRenderer();
    const w = renderer ? renderer.domElement.width : window.innerWidth;
    const h = renderer ? renderer.domElement.height : window.innerHeight;
    const res = material.uniforms.uResolution;
    if (res) (res.value as THREE.Vector2).set(w, h);
  }

  function render(renderer: THREE.WebGLRenderer) {
    if (!active || !overlayScene || !overlayCamera || !material || !quad) return;
    const uTime = material.uniforms.uTime;
    if (uTime) uTime.value = (performance.now() - startWallTime) / 1000;
    const uOpacity = material.uniforms.uOpacity;
    if (uOpacity) uOpacity.value = overlayOpacity;
    // 在主画布默认帧缓冲上叠加，不清除已渲染的城市。
    const prevAutoClear = renderer.autoClear;
    renderer.autoClear = false;
    renderer.render(overlayScene, overlayCamera);
    renderer.autoClear = prevAutoClear;
  }

  function dispose() {
    if (disposed) return;
    disposed = true;
    if (resizeHandler) {
      window.removeEventListener('resize', resizeHandler);
      resizeHandler = null;
    }
    timeline?.kill();
    timeline = null;
    if (quad) {
      quad.geometry.dispose();
      quad = null;
    }
    material?.dispose();
    material = null;
    photoTarget?.dispose();
    photoTarget = null;
    shotCamera = null;
    overlayScene = null;
    overlayCamera = null;
    overlayOpacity = 0;
  }

  function trigger(): boolean {
    if (active || disposed) return false;
    const texture = captureCityPhoto();
    if (!texture) return false;
    active = true;
    disposed = false;

    buildOverlay(texture);
    startWallTime = performance.now();
    resizeHandler = onResize;
    window.addEventListener('resize', resizeHandler);

    const duration = options.reduced ? 2.4 : 5.6;
    overlayOpacity = 0;

    timeline = gsap.timeline({
      onComplete: () => {
        active = false;
        dispose();
      },
    });
    // overlay 淡入覆盖城市，火线推进，烧尽后再淡出露出主画布。
    const progressUniform = material!.uniforms.uProgress!;
    timeline.to({ o: 0 }, {
      o: 1,
      duration: 0.35,
      ease: 'power2.out',
      onUpdate() { overlayOpacity = this.targets()[0].o; },
    }, 0);
    timeline.to(progressUniform, {
      value: 1,
      duration,
      ease: 'power1.inOut',
    }, 0.1);
    timeline.to({ o: 1 }, {
      o: 0,
      duration: 0.7,
      ease: 'power2.in',
      onUpdate() { overlayOpacity = this.targets()[0].o; },
    }, duration - 0.5);

    return true;
  }

  return { trigger, dispose, render, isActive: () => active, getProgress: () => material?.uniforms.uProgress?.value ?? 0 };
}

