import * as THREE from 'three';
import { gsap } from 'gsap';

export type CameraControllerOptions = {
  getCamera: () => THREE.OrthographicCamera | null;
  getZoom: () => number;
  getTarget: () => THREE.Vector3;
  isEchoInterior: () => boolean;
  echoInterior: readonly [number, number];
  echoCenter: readonly [number, number];
  cameraOffset: THREE.Vector3;
};

export function createCameraController(options: CameraControllerOptions) {
  const interiorAnchor = new THREE.Vector3(8.2, 15.5, -8.2);
  const exteriorOffset = new THREE.Vector3(-20, 32, -20);
  const blendedOffset = new THREE.Vector3();

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

  function setTarget(x: number, z: number, instant: boolean): void {
    const target = options.getTarget();
    const apply = () => {
      const camera = options.getCamera();
      if (!camera) return;
      if (options.isEchoInterior()) {
        camera.position.set(options.echoInterior[0] + interiorAnchor.x, interiorAnchor.y, options.echoInterior[1] + interiorAnchor.z);
        camera.lookAt(target.x, 0.75, target.z);
        return;
      }
      const distance = Math.hypot(target.x - options.echoCenter[0], target.z - options.echoCenter[1]);
      const blend = Math.max(0, Math.min(1, (30 - distance) / 12));
      blendedOffset.copy(options.cameraOffset).lerp(exteriorOffset, blend);
      camera.position.copy(target).add(blendedOffset);
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

  return { setTarget, updateProjection, stop: () => gsap.killTweensOf(options.getTarget()) };
}
