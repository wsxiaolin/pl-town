import * as THREE from 'three';
import { gsap } from 'gsap';

export type CameraControllerOptions = {
  getCamera: () => THREE.OrthographicCamera | null;
  getZoom: () => number;
  setZoom: (zoom: number) => void;
  getTarget: () => THREE.Vector3;
  isEchoInterior: () => boolean;
  echoInterior: readonly [number, number];
  cameraOffset: THREE.Vector3;
};

export type CameraFocusOptions = { duration?: number; zoom?: number };

export function createCameraController(options: CameraControllerOptions) {
  const interiorAnchor = new THREE.Vector3(8.2, 15.5, -8.2);
  const zoomTween = { value: options.getZoom() };
  let sequence: gsap.core.Timeline | null = null;

  function apply(target: THREE.Vector3): void {
    const camera = options.getCamera();
    if (!camera) return;
    if (options.isEchoInterior()) {
      camera.position.set(options.echoInterior[0] + interiorAnchor.x, interiorAnchor.y, options.echoInterior[1] + interiorAnchor.z);
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
      apply(target);
      return;
    }
    gsap.to(target, { x, z, duration: 0.55, ease: 'power2.out', onUpdate: () => apply(target) });
  }

  function focus(x: number, z: number, focusOptions: CameraFocusOptions = {}): void {
    const target = options.getTarget();
    const camera = options.getCamera();
    if (!camera) return;
    const duration = focusOptions.duration ?? 0.8;
    gsap.killTweensOf(target);
    gsap.to(target, { x, z, duration, ease: 'power2.out', onUpdate: () => apply(target) });
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
