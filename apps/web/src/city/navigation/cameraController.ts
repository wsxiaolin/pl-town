import * as THREE from 'three';
import { gsap } from 'gsap';

export type CameraControllerOptions = {
  getCamera: () => THREE.OrthographicCamera | null;
  getZoom: () => number;
  getTarget: () => THREE.Vector3;
  isEchoInterior: () => boolean;
  echoInterior: readonly [number, number];
  cameraOffset: THREE.Vector3;
};

export type CameraFocusOptions = { duration?: number };

export function createCameraController(options: CameraControllerOptions) {
  const interiorAnchor = new THREE.Vector3(8.2, 15.5, -8.2);

  function updateProjection(zoom: number): void {
    const camera = options.getCamera();
    if (!camera) return;
    const aspect = window.innerWidth / window.innerHeight;
    camera.left = -zoom * aspect;
    camera.right = zoom * aspect;
    camera.top = zoom;
    camera.bottom = -zoom;
    camera.updateProjectionMatrix();
  }

  function setTarget(x: number, z: number, instant = false): void {
    const target = options.getTarget();
    const apply = () => {
      const camera = options.getCamera();
      if (!camera) return;
      if (options.isEchoInterior()) {
        camera.position.set(options.echoInterior[0] + interiorAnchor.x, interiorAnchor.y, options.echoInterior[1] + interiorAnchor.z);
        camera.lookAt(target.x, 0.75, target.z);
        return;
      }
      camera.position.copy(target).add(options.cameraOffset);
      camera.lookAt(target);
    };
    if (instant) {
      gsap.killTweensOf(target);
      target.set(x, 0, z);
      apply();
      return;
    }
    gsap.to(target, { x, z, duration: 0.55, ease: 'power2.out', onUpdate: apply });
  }

  function focus(x: number, z: number, focusOptions: CameraFocusOptions = {}): void {
    const target = options.getTarget();
    const camera = options.getCamera();
    if (!camera) return;
    const duration = focusOptions.duration ?? 0.8;
    gsap.killTweensOf(target);
    gsap.to(target, { x, z, duration, ease: 'power2.out', onUpdate: () => {
      camera.position.copy(target).add(options.cameraOffset);
      camera.lookAt(target);
    } });
  }

  return { setTarget, focus, updateProjection, stop: () => gsap.killTweensOf(options.getTarget()) };
}
