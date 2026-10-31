// 烟花一次性特效：爆闪、冲击波、水面光环与烟雾。
// 烟雾用环形缓冲 Points（软圆片 + 普通混合），爆闪/冲击波用短命 Sprite/Mesh。
// 所有自建材质与几何由 dispose 统一释放；纹理只创建一次。
import * as THREE from 'three';
import { CAMERA_OFFSET_BILLBOARD_NORMAL } from '../city/fireworks/fireworksConstants';
import { FIREWORK_GRAVITY, FIREWORK_WIND } from '../city/fireworks/fireworksPhysics';

const SMOKE_CAPACITY = 260;
const SMOKE_VERT = /* glsl */ `
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
const SMOKE_FRAG = /* glsl */ `
  varying vec3 vColor;
  varying float vAlpha;
  void main() {
    float d = length(gl_PointCoord - vec2(0.5));
    float soft = smoothstep(0.5, 0.05, d);
    if (soft * vAlpha < 0.005) discard;
    gl_FragColor = vec4(vColor, vAlpha * soft);
    #include <colorspace_fragment>
  }
`;

type Transient = {
  object: THREE.Object3D;
  material: THREE.Material;
  age: number;
  life: number;
  startScale: number;
  endScale: number;
  opacity: number;
  kind: 'sprite' | 'ring' | 'water';
};

function glowTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 128;
  const ctx = canvas.getContext('2d')!;
  const gradient = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
  gradient.addColorStop(0, 'rgba(255,255,255,1)');
  gradient.addColorStop(0.22, 'rgba(255,246,220,0.85)');
  gradient.addColorStop(0.55, 'rgba(255,200,120,0.28)');
  gradient.addColorStop(1, 'rgba(255,160,70,0)');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, 128, 128);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

export function createFireworksFx(scene: THREE.Scene) {
  const texture = glowTexture();
  const billboardNormal = new THREE.Vector3(
    CAMERA_OFFSET_BILLBOARD_NORMAL.x,
    CAMERA_OFFSET_BILLBOARD_NORMAL.y,
    CAMERA_OFFSET_BILLBOARD_NORMAL.z,
  ).normalize();
  const ringGeometry = new THREE.RingGeometry(0.86, 1, 40);
  const transients: Transient[] = [];

  // ── 烟雾 Points 环形缓冲 ────────────────────────────────
  const smokePositions = new Float32Array(SMOKE_CAPACITY * 3);
  const smokeColors = new Float32Array(SMOKE_CAPACITY * 3);
  const smokeAlphas = new Float32Array(SMOKE_CAPACITY);
  const smokeSizes = new Float32Array(SMOKE_CAPACITY);
  const smokeLife = new Float32Array(SMOKE_CAPACITY);
  const smokeLifeTotal = new Float32Array(SMOKE_CAPACITY);
  const smokeBaseAlpha = new Float32Array(SMOKE_CAPACITY);
  const smokeSizeBase = new Float32Array(SMOKE_CAPACITY);
  const smokeGrowth = new Float32Array(SMOKE_CAPACITY);
  const smokeVelocity = new Float32Array(SMOKE_CAPACITY * 3);
  let smokeCursor = 0;
  let smokeUsed = 0;
  const smokeGeometry = new THREE.BufferGeometry();
  smokeGeometry.setAttribute('position', new THREE.BufferAttribute(smokePositions, 3));
  smokeGeometry.setAttribute('aColor', new THREE.BufferAttribute(smokeColors, 3));
  smokeGeometry.setAttribute('aAlpha', new THREE.BufferAttribute(smokeAlphas, 1));
  smokeGeometry.setAttribute('aSize', new THREE.BufferAttribute(smokeSizes, 1));
  smokeGeometry.setDrawRange(0, 0);
  const smokeMaterial = new THREE.ShaderMaterial({
    vertexShader: SMOKE_VERT,
    fragmentShader: SMOKE_FRAG,
    uniforms: { uPixelScale: { value: 10 } },
    transparent: true,
    depthWrite: false,
    blending: THREE.NormalBlending,
  });
  const smokePoints = new THREE.Points(smokeGeometry, smokeMaterial);
  smokePoints.frustumCulled = false;
  smokePoints.renderOrder = 8;
  scene.add(smokePoints);

  function spawnSmoke(x: number, y: number, z: number, count: number, radius: number): void {
    for (let i = 0; i < count; i += 1) {
      const index = smokeCursor;
      smokeCursor = (smokeCursor + 1) % SMOKE_CAPACITY;
      smokeUsed = Math.min(SMOKE_CAPACITY, smokeUsed + 1);
      const angle = Math.random() * Math.PI * 2;
      const spread = radius * (0.15 + Math.random() * 0.55);
      smokePositions[index * 3] = x + Math.cos(angle) * spread;
      smokePositions[index * 3 + 1] = y + (Math.random() - 0.4) * radius * 0.25;
      smokePositions[index * 3 + 2] = z + Math.sin(angle) * spread;
      smokeVelocity[index * 3] = Math.cos(angle) * (0.25 + Math.random() * 0.45);
      smokeVelocity[index * 3 + 1] = 0.1 + Math.random() * 0.25;
      smokeVelocity[index * 3 + 2] = Math.sin(angle) * (0.25 + Math.random() * 0.45);
      const tone = 0.28 + Math.random() * 0.1;
      smokeColors[index * 3] = tone;
      smokeColors[index * 3 + 1] = tone * 0.98;
      smokeColors[index * 3 + 2] = tone * 0.95;
      smokeLife[index] = 3.2 + Math.random() * 2.2;
      smokeLifeTotal[index] = smokeLife[index]!;
      smokeBaseAlpha[index] = 0.13 + Math.random() * 0.08;
      smokeAlphas[index] = smokeBaseAlpha[index]!;
      smokeSizeBase[index] = radius * (0.28 + Math.random() * 0.2);
      smokeGrowth[index] = radius * (0.15 + Math.random() * 0.12);
      smokeSizes[index] = smokeSizeBase[index]!;
    }
  }

  function addTransient(
    object: THREE.Object3D,
    material: THREE.Material,
    life: number,
    startScale: number,
    endScale: number,
    opacity: number,
    kind: Transient['kind'],
  ): void {
    object.renderOrder = 10;
    scene.add(object);
    transients.push({ object, material, age: 0, life, startScale, endScale, opacity, kind });
  }

  function flash(position: { x: number; y: number; z: number }, color: THREE.Color, radius: number): void {
    const material = new THREE.SpriteMaterial({
      map: texture,
      color,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    const sprite = new THREE.Sprite(material);
    sprite.position.set(position.x, position.y, position.z);
    sprite.scale.setScalar(radius * 0.8);
    addTransient(sprite, material, 0.42, radius * 0.8, radius * 2.6, 1, 'sprite');
  }

  function shockwave(position: { x: number; y: number; z: number }, color: THREE.Color, radius: number): void {
    const material = new THREE.MeshBasicMaterial({
      color,
      transparent: true,
      opacity: 0.42,
      depthWrite: false,
      side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending,
    });
    const ring = new THREE.Mesh(ringGeometry, material);
    ring.position.set(position.x, position.y, position.z);
    ring.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), billboardNormal);
    ring.scale.setScalar(0.5);
    addTransient(ring, material, 0.65, 0.5, radius * 2.1, 0.42, 'ring');
  }

  function waterGlow(position: { x: number; z: number }, color: THREE.Color, radius: number): void {
    const material = new THREE.MeshBasicMaterial({
      color,
      transparent: true,
      opacity: 0.3,
      depthWrite: false,
      side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending,
    });
    const ring = new THREE.Mesh(ringGeometry, material);
    ring.position.set(position.x, 0.26, position.z);
    ring.rotation.x = -Math.PI / 2;
    ring.scale.setScalar(radius * 0.6);
    addTransient(ring, material, 1.1, radius * 0.6, radius * 1.9, 0.3, 'water');
  }

  function muzzle(position: { x: number; y: number; z: number }): void {
    flash({ x: position.x, y: position.y, z: position.z }, new THREE.Color(0xffd08a), 0.75);
    spawnSmoke(position.x, position.y, position.z, 5, 0.8);
  }

  function setPixelScale(scale: number): void {
    smokeMaterial.uniforms.uPixelScale!.value = scale;
  }

  function update(dt: number): void {
    for (let i = transients.length - 1; i >= 0; i -= 1) {
      const item = transients[i]!;
      item.age += dt;
      const t = Math.min(1, item.age / item.life);
      const scale = item.startScale + (item.endScale - item.startScale) * t;
      if (item.kind === 'sprite') item.object.scale.setScalar(scale);
      else item.object.scale.setScalar(scale);
      const material = item.material as THREE.MeshBasicMaterial | THREE.SpriteMaterial;
      material.opacity = item.opacity * Math.pow(1 - t, 1.6);
      if (t >= 1) {
        scene.remove(item.object);
        item.material.dispose();
        transients.splice(i, 1);
      }
    }
    if (smokeUsed > 0) {
      let hasLiveSmoke = false;
      for (let i = 0; i < smokeUsed; i += 1) {
        if (smokeLife[i]! <= 0) { smokeAlphas[i] = 0; continue; }
        smokeLife[i]! -= dt;
        if (smokeLife[i]! <= 0) { smokeAlphas[i] = 0; continue; }
        hasLiveSmoke = true;
        smokePositions[i * 3]! += (smokeVelocity[i * 3]! + FIREWORK_WIND.x * 0.3) * dt;
        smokePositions[i * 3 + 1]! += smokeVelocity[i * 3 + 1]! * dt;
        smokePositions[i * 3 + 2]! += (smokeVelocity[i * 3 + 2]! + FIREWORK_WIND.z * 0.3) * dt;
        smokeVelocity[i * 3 + 1]! -= FIREWORK_GRAVITY * 0.006 * dt;
        smokeSizes[i]! += smokeGrowth[i]! * dt;
        const fade = smokeLife[i]! / smokeLifeTotal[i]!;
        smokeAlphas[i] = smokeBaseAlpha[i]! * Math.pow(fade, 1.6);
      }
      smokeGeometry.getAttribute('position').needsUpdate = true;
      smokeGeometry.getAttribute('aColor').needsUpdate = true;
      smokeGeometry.getAttribute('aAlpha').needsUpdate = true;
      smokeGeometry.getAttribute('aSize').needsUpdate = true;
      if (hasLiveSmoke) {
        smokeGeometry.setDrawRange(0, smokeUsed);
      } else {
        smokeCursor = 0;
        smokeUsed = 0;
        smokeGeometry.setDrawRange(0, 0);
      }
    }
  }

  function dispose(): void {
    for (const item of transients) {
      scene.remove(item.object);
      item.material.dispose();
    }
    transients.length = 0;
    scene.remove(smokePoints);
    smokeGeometry.dispose();
    smokeMaterial.dispose();
    ringGeometry.dispose();
    texture.dispose();
  }

  return { flash, shockwave, waterGlow, muzzle, spawnSmoke, setPixelScale, update, dispose };
}

export type FireworksFx = ReturnType<typeof createFireworksFx>;
