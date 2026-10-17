import * as THREE from 'three';
import { gsap } from 'gsap';
import { terrainHeight } from '../data/terrain/heightfield/terrainHeight';

export type CameraControllerOptions = {
  getCamera: () => THREE.OrthographicCamera | null;
  getZoom: () => number;
  setZoom: (zoom: number) => void;
  getTarget: () => THREE.Vector3;
  isInteriorActive: () => boolean;
  defaultInteriorCenter: readonly [number, number];
  getInteriorCenter?: () => readonly [number, number];
  getInteriorCameraOffset?: () => readonly [number, number, number] | null;
  getInteriorFollowsTarget?: () => boolean;
  cameraOffset: THREE.Vector3;
};

export type CameraFocusOptions = {
  duration?: number;
  zoom?: number;
  ease?: string;
  onComplete?: () => void;
};

export function createCameraController(options: CameraControllerOptions) {
  const interiorAnchor = new THREE.Vector3(8.2, 15.5, -8.2);
  const zoomTween = { value: options.getZoom() };
  let sequence: gsap.core.Timeline | null = null;

  function apply(target: THREE.Vector3): void {
    const camera = options.getCamera();
    if (!camera) return;
    // 相机目标 y 跟随地形（方案 §6.2/§6.4）：演出序列的补间只动 x/z，
    // 每帧在此统一取地面高——城内恒 0 无感，城外镜头随地形；正交相机
    // offset.y 足够高（远高于地形最大 3.4），不穿地。
    target.y = terrainHeight(target.x, target.z);
    if (options.isInteriorActive()) {
      camera.position.set(
        options.defaultInteriorCenter[0] + interiorAnchor.x,
        interiorAnchor.y,
        options.defaultInteriorCenter[1] + interiorAnchor.z,
      );
      camera.lookAt(target.x, 0.75, target.z);
      return;
    }
    camera.position.copy(target).add(options.cameraOffset);
    camera.lookAt(target);
  }

  function applyCameraTarget(): void {
    const camera = options.getCamera();
    if (!camera) return;
    const target = options.getTarget();
    // 相机目标 y 跟随地形（方案 §6.2）：setTarget（含 gsap 补间 onUpdate）
    // 与 focus 的公共跟随路径统一在此取地面高——台地内恒 0 零回归。
    target.y = terrainHeight(target.x, target.z);
    if (options.isInteriorActive()) {
      const center = options.getInteriorCenter?.() ?? options.defaultInteriorCenter;
      const offset = options.getInteriorCameraOffset?.();
      const followsTarget = Boolean(offset && options.getInteriorFollowsTarget?.());
      camera.position.set(
        (followsTarget ? target.x : center[0]) + (offset?.[0] ?? interiorAnchor.x),
        offset?.[1] ?? interiorAnchor.y,
        (followsTarget ? target.z : center[1]) + (offset?.[2] ?? interiorAnchor.z),
      );
      camera.lookAt(target.x, 0.75, target.z);
      return;
    }
    camera.position.copy(target).add(options.cameraOffset);
    camera.lookAt(target);
  }

  function updateProjection(zoom: number): void {
    const camera = options.getCamera();
    if (!camera) return;
    const aspect = window.innerWidth / window.innerHeight;
    camera.left = -zoom * aspect;
    camera.right = zoom * aspect;
    camera.top = zoom;
    camera.bottom = -zoom;
    camera.updateProjectionMatrix();
    options.setZoom(zoom);
  }

  function setTarget(x: number, z: number, instant = false): void {
    const target = options.getTarget();
    if (instant) {
      gsap.killTweensOf(target);
      target.set(x, 0, z);
      applyCameraTarget();
      return;
    }
    gsap.to(target, { x, z, duration: 0.55, ease: 'power2.out', onUpdate: applyCameraTarget });
  }

  function focus(x: number, z: number, focusOptions: CameraFocusOptions = {}): void {
    const target = options.getTarget();
    const camera = options.getCamera();
    if (!camera) return;
    const duration = focusOptions.duration ?? 0.8;
    gsap.killTweensOf(target);
    gsap.to(target, {
      x,
      z,
      duration,
      ease: focusOptions.ease ?? 'power2.out',
      onUpdate: applyCameraTarget,
      onComplete: focusOptions.onComplete,
    });
    if (focusOptions.zoom !== undefined) {
      zoomTween.value = options.getZoom();
      gsap.to(zoomTween, { value: focusOptions.zoom, duration, ease: 'power2.inOut', onUpdate: () => updateProjection(zoomTween.value) });
    }
  }

  function playSequence(shots: readonly { x: number; z: number; zoom: number; duration: number }[], onComplete: () => void): void {
    sequence?.kill();
    sequence = gsap.timeline({ onComplete: () => { sequence = null; onComplete(); } });
    shots.forEach((shot) => sequence!.to(options.getTarget(), {
      x: shot.x, z: shot.z, duration: shot.duration, ease: 'power2.inOut',
      onStart: () => {
        zoomTween.value = options.getZoom();
        gsap.to(zoomTween, { value: shot.zoom, duration: shot.duration, ease: 'power2.inOut', onUpdate: () => updateProjection(zoomTween.value) });
      },
      onUpdate: () => apply(options.getTarget()),
    }));
  }

  return { setTarget, focus, playSequence, updateProjection, stop: () => { sequence?.kill(); sequence = null; gsap.killTweensOf(options.getTarget()); gsap.killTweensOf(zoomTween); } };
}
