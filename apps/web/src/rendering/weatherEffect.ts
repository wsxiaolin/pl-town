import * as THREE from 'three';
import type { Weather } from '../city/weather';
import { RENDER_ORDER } from './layers';
import { createRainAudio } from './rainAudio';

// 雨天氛围参数。灯光昼夜基准值需与 city/themeClock.ts 的 applyTheme 保持一致
// (amb 1.05/0.60、dir 0.55/0.30);雨天在这些基准上做乘法压暗。
const AMB_BASE = { day: 1.05, night: 0.6 };
const DIR_BASE = { day: 0.55, night: 0.3 };
const RAIN_AMB_FACTOR = 0.55;
const RAIN_DIR_FACTOR = 0.2;
const FOG_COLOR = { day: 0x93a2b1, night: 0x0d1220 };
// 雨天背景在雨色与晴天底色之间插值(纹理天空无法与颜色插值,渐出结束
// 时再由 restoreSky 换回昼夜天空纹理)。
const SKY_BASE = { day: 0xf9f8f6, night: 0xd4d3ce };
// 晴天常驻一层 far=4000 的雾(视觉不可见),让材质 shader 预编译时就带上
// USE_FOG,雨天拉近雾距时不会触发全城 shader 重编译卡顿。
const CLEAR_FOG_NEAR = 400;
const CLEAR_FOG_FAR = 4000;

const RAIN_COUNT = 900;
const RAIN_RADIUS = 32;
const RAIN_TOP = 20;
// 雨丝端点偏移:约 0.62 长的细丝,带轻微风斜(参考 lab.lcrworld.xyz/rainy-store)。
const RAIN_TAIL = { x: 0.06, y: 0.62, z: 0.02 };
const RAIN_SPEED_MIN = 15;
const RAIN_SPEED_VAR = 13;

const RIPPLE_COUNT = 28;
const RIPPLE_LIFE = 1.5;
const RIPPLE_SPREAD = 22;

const PUDDLE_COUNT = 12;
const PUDDLE_CELL = 9;
// 贴地两层:分别落在草地/广场层(≈0.04)与道路面层(0.10)之上,保持 ≥0.004
// 的 Y 差避免远镜头 z-fighting(见 layers.ts 的 SURFACE_Y)。
const GROUND_Y = [0.058, 0.128] as const;

function isNightNow(): boolean {
  return typeof document !== 'undefined' && document.body.classList.contains('night');
}

const bgColor = new THREE.Color();
const _skyTarget = new THREE.Color();

function hash2(x: number, z: number, salt: number): number {
  const s = Math.sin(x * 127.1 + z * 311.7 + salt * 74.7) * 43758.5453;
  return s - Math.floor(s);
}

export function createWeatherEffect(options: {
  scene: THREE.Scene;
  getCursor: () => THREE.Object3D | null;
  restoreSky: () => void;
  onWeatherChanged?: (weather: Weather | null) => void;
}) {
  const { scene } = options;
  scene.fog = new THREE.Fog(0xffffff, CLEAR_FOG_NEAR, CLEAR_FOG_FAR);

  // ── 雨丝:LineSegments,粒子在世界空间固定(盒随玩家平移时反向补偿)──
  const rainGeo = new THREE.BufferGeometry();
  const rainArr = new Float32Array(RAIN_COUNT * 6);
  rainGeo.setAttribute('position', new THREE.BufferAttribute(rainArr, 3));
  const rainMat = new THREE.LineBasicMaterial({
    color: 0xa8c8ee,
    transparent: true,
    opacity: 0,
    depthWrite: false,
  });
  const rain = new THREE.LineSegments(rainGeo, rainMat);
  rain.frustumCulled = false;
  rain.visible = false;
  rain.renderOrder = RENDER_ORDER.transparentSurface;
  scene.add(rain);

  const drops = Array.from({ length: RAIN_COUNT }, () => ({
    x: (Math.random() - 0.5) * RAIN_RADIUS * 2,
    y: Math.random() * RAIN_TOP,
    z: (Math.random() - 0.5) * RAIN_RADIUS * 2,
    v: RAIN_SPEED_MIN + Math.random() * RAIN_SPEED_VAR,
  }));

  // ── 地面涟漪:平放扩散圆环(参考 rainy-store 的 RingGeometry 方案)──
  const rippleGeo = new THREE.RingGeometry(0.5, 0.58, 24);
  const ripples = Array.from({ length: RIPPLE_COUNT }, () => {
    const mat = new THREE.MeshBasicMaterial({
      color: 0x9cc8f0,
      transparent: true,
      opacity: 0,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    const mesh = new THREE.Mesh(rippleGeo, mat);
    mesh.rotation.x = -Math.PI / 2;
    mesh.renderOrder = RENDER_ORDER.transparentSurface;
    mesh.visible = false;
    scene.add(mesh);
    return { mesh, t: Math.random() * RIPPLE_LIFE };
  });

  // ── 雨天水洼:按世界坐标网格 hash 固定布置,玩家移动时随机到的世界
  //    位置总是同一批,往返一致(不像随机重生成那样闪现)。
  const puddleGeo = new THREE.CircleGeometry(1, 18);
  const puddles = Array.from({ length: PUDDLE_COUNT }, () => {
    const mat = new THREE.MeshBasicMaterial({
      color: 0x1d2c42,
      transparent: true,
      opacity: 0,
      depthWrite: false,
    });
    const mesh = new THREE.Mesh(puddleGeo, mat);
    mesh.rotation.x = -Math.PI / 2;
    mesh.renderOrder = RENDER_ORDER.transparentSurface;
    mesh.visible = false;
    scene.add(mesh);
    return mesh;
  });
  let puddleCellX = NaN;
  let puddleCellZ = NaN;

  function placePuddles(cursor: THREE.Object3D): void {
    const cx = Math.floor(cursor.position.x / PUDDLE_CELL);
    const cz = Math.floor(cursor.position.z / PUDDLE_CELL);
    if (cx === puddleCellX && cz === puddleCellZ) return;
    puddleCellX = cx;
    puddleCellZ = cz;
    let index = 0;
    for (let ox = -1; ox <= 1 && index < PUDDLE_COUNT; ox += 1) {
      for (let oz = -1; oz <= 1 && index < PUDDLE_COUNT; oz += 1) {
        if (hash2(cx + ox, cz + oz, 3) > 0.62) continue;
        const mesh = puddles[index];
        if (!mesh) continue;
        const angle = hash2(cx + ox, cz + oz, 1) * Math.PI;
        mesh.position.set(
          (cx + ox + 0.15 + hash2(cx + ox, cz + oz, 2) * 0.7) * PUDDLE_CELL,
          GROUND_Y[hash2(cx + ox, cz + oz, 4) > 0.5 ? 1 : 0],
          (cz + oz + 0.15 + hash2(cx + ox, cz + oz, 5) * 0.7) * PUDDLE_CELL,
        );
        mesh.rotation.z = angle;
        mesh.scale.set(0.5 + hash2(cx + ox, cz + oz, 6) * 1.1, 0.35 + hash2(cx + ox, cz + oz, 7) * 0.7, 1);
        mesh.visible = true;
        index += 1;
      }
    }
    for (; index < PUDDLE_COUNT; index += 1) {
      const spare = puddles[index];
      if (spare) spare.visible = false;
    }
  }

  // ── 湿度渐变:0(晴)→ 1(雨),驱动雨丝/涟漪/水洼/雾/灯光的插值 ──
  // 用帧循环 delta 手写推进而不是 gsap:gsap 的 lagSmoothing 在低帧率
  // (软件渲染/低端机)下会把秒级 tween 拉长一个量级,渐变会"卡住"。
  const RAMP_IN_SECONDS = 2.2;
  const RAMP_OUT_SECONDS = 2.6;
  const wetness = { v: 0, target: 0, restorePending: false };
  let weather: Weather = 'clear';
  let hadRainAmbient = false;
  const rainAudio = createRainAudio();

  function ambientBase(night: boolean): { amb: number; dir: number; fog: number } {
    return {
      amb: night ? AMB_BASE.night : AMB_BASE.day,
      dir: night ? DIR_BASE.night : DIR_BASE.day,
      fog: night ? FOG_COLOR.night : FOG_COLOR.day,
    };
  }

  function applyAmbient(cursor: THREE.Object3D | null): void {
    const night = isNightNow();
    const w = wetness.v;
    const base = ambientBase(night);
    const fog = scene.fog as THREE.Fog | null;
    if (fog && w > 0.001) {
      fog.color.setHex(base.fog);
      fog.near = THREE.MathUtils.lerp(CLEAR_FOG_NEAR, 52, w);
      fog.far = THREE.MathUtils.lerp(CLEAR_FOG_FAR, 215, w);
      bgColor.setHex(base.fog).lerp(_skyTarget.setHex(night ? SKY_BASE.night : SKY_BASE.day), 1 - w);
      scene.background = bgColor;
    }
    if (w > 0.02) {
      hadRainAmbient = true;
      const amb = scene.getObjectByName('amb') as THREE.Light | null;
      const dir = scene.getObjectByName('dir') as THREE.Light | null;
      if (amb) amb.intensity = THREE.MathUtils.lerp(base.amb, base.amb * RAIN_AMB_FACTOR, w);
      if (dir) dir.intensity = THREE.MathUtils.lerp(base.dir, base.dir * RAIN_DIR_FACTOR, w);
    }
    rainMat.opacity = 0.3 * w;
    rainAudio.setIntensity(w);
    for (const ripple of ripples) {
      ripple.mesh.visible = w > 0.05;
      (ripple.mesh.material as THREE.MeshBasicMaterial).opacity = 0.42 * w * (1 - ripple.t / RIPPLE_LIFE);
    }
    let puddleIndex = 0;
    for (const puddle of puddles) {
      if (!puddle.visible) continue;
      const mat = puddle.material as THREE.MeshBasicMaterial;
      mat.opacity = w * (0.72 + 0.08 * Math.sin(puddleIndex * 1.4));
      puddleIndex += 1;
    }
    if (cursor) placePuddles(cursor);
  }

  function set(next: Weather): void {
    weather = next;
    options.onWeatherChanged?.(next);
    if (next === 'rain') {
      wetness.target = 1;
      wetness.restorePending = false;
      rain.visible = true;
      rainAudio.start();
    } else {
      wetness.target = 0;
      wetness.restorePending = hadRainAmbient;
      rainAudio.stop();
    }
  }

  function advanceWetness(delta: number): void {
    if (wetness.v === wetness.target) return;
    const seconds = wetness.target > wetness.v ? RAMP_IN_SECONDS : RAMP_OUT_SECONDS;
    const step = delta / seconds;
    if (wetness.target > wetness.v) wetness.v = Math.min(wetness.target, wetness.v + step);
    else wetness.v = Math.max(wetness.target, wetness.v - step);
    if (wetness.v === 0 && wetness.target === 0) {
      rain.visible = false;
      // 渐出落定后把雾参数精确归位到晴天档:插值最后一帧 w 已低于可见
      // 阈值,fog 不再被写入,若不归位 far 会停在残差值上。
      const fog = scene.fog as THREE.Fog | null;
      if (fog) {
        fog.near = CLEAR_FOG_NEAR;
        fog.far = CLEAR_FOG_FAR;
        fog.color.setHex(0xffffff);
      }
      if (wetness.restorePending) {
        wetness.restorePending = false;
        hadRainAmbient = false;
        const base = ambientBase(isNightNow());
        const amb = scene.getObjectByName('amb') as THREE.Light | null;
        const dir = scene.getObjectByName('dir') as THREE.Light | null;
        if (amb) amb.intensity = base.amb;
        if (dir) dir.intensity = base.dir;
        options.restoreSky();
      }
    }
  }

  function update(delta: number): void {
    advanceWetness(delta);
    if (!rain.visible && wetness.v <= 0.001) return;
    const cursor = options.getCursor();
    const w = wetness.v;

    // 雨丝跟随玩家:盒平移时把位移反向补偿进粒子,让雨滴保持世界固定。
    if (cursor) {
      const dx = cursor.position.x - rain.position.x;
      const dz = cursor.position.z - rain.position.z;
      if (dx !== 0 || dz !== 0) {
        for (const drop of drops) {
          drop.x -= dx;
          drop.z -= dz;
        }
        rain.position.set(cursor.position.x, 0, cursor.position.z);
      }
    }

    for (let i = 0; i < RAIN_COUNT; i += 1) {
      const drop = drops[i];
      if (!drop) continue;
      drop.y -= drop.v * delta;
      if (drop.y < 0.2) {
        drop.y = RAIN_TOP + Math.random() * 4;
        drop.x = (Math.random() - 0.5) * RAIN_RADIUS * 2;
        drop.z = (Math.random() - 0.5) * RAIN_RADIUS * 2;
      }
      const i6 = i * 6;
      rainArr[i6] = drop.x;
      rainArr[i6 + 1] = drop.y;
      rainArr[i6 + 2] = drop.z;
      rainArr[i6 + 3] = drop.x + RAIN_TAIL.x;
      rainArr[i6 + 4] = drop.y + RAIN_TAIL.y;
      rainArr[i6 + 5] = drop.z + RAIN_TAIL.z;
    }
    rainGeo.getAttribute('position').needsUpdate = true;

    for (const ripple of ripples) {
      ripple.t += delta;
      if (ripple.t > RIPPLE_LIFE) {
        ripple.t = 0;
        const x = (cursor?.position.x ?? 0) + (Math.random() - 0.5) * RIPPLE_SPREAD * 2;
        const z = (cursor?.position.z ?? 0) + (Math.random() - 0.5) * RIPPLE_SPREAD * 2;
        ripple.mesh.position.set(x, GROUND_Y[Math.random() > 0.5 ? 1 : 0], z);
      }
      const p = ripple.t / RIPPLE_LIFE;
      const s = 0.12 + 0.9 * (1 - (1 - p) * (1 - p));
      ripple.mesh.scale.setScalar(s);
      (ripple.mesh.material as THREE.MeshBasicMaterial).opacity = 0.42 * w * (1 - p);
    }

    applyAmbient(cursor);
  }

  function dispose(): void {
    rainAudio.dispose();
    rain.visible = false;
    rain.removeFromParent();
    rainGeo.dispose();
    rainMat.dispose();
    for (const ripple of ripples) {
      ripple.mesh.removeFromParent();
      (ripple.mesh.material as THREE.Material).dispose();
    }
    rippleGeo.dispose();
    for (const puddle of puddles) {
      puddle.removeFromParent();
      (puddle.material as THREE.Material).dispose();
    }
    puddleGeo.dispose();
    scene.fog = null;
    options.restoreSky();
    options.onWeatherChanged?.(null);
  }

  return { set, update, dispose, current: () => weather };
}
