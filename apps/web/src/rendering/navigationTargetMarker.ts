import * as THREE from 'three';
import { RENDER_ORDER, SURFACE_Y } from './layers';

const MARKER_COLOR = 0xf28c28;
const PULSE_COUNT = 3;
const PULSE_DURATION_SECONDS = 1.8;
const INITIAL_OPACITY = 0.5;
const FINAL_SCALE = 2.5;

export type NavigationTargetMarker = ReturnType<typeof createNavigationTargetMarker>;

export function createNavigationTargetMarker(scene: THREE.Scene) {
  const root = new THREE.Group();
  root.name = 'navigation-target-marker';
  root.visible = false;
  root.userData.navigationTargetMarker = true;

  const ringGeometry = new THREE.RingGeometry(0.46, 0.6, 48);
  const rings = Array.from({ length: PULSE_COUNT }, (_, index) => {
    const material = new THREE.MeshBasicMaterial({
      color: MARKER_COLOR,
      transparent: true,
      opacity: INITIAL_OPACITY,
      depthWrite: false,
      side: THREE.DoubleSide,
    });
    const ring = new THREE.Mesh(ringGeometry, material);
    ring.name = `navigation-target-pulse-${index + 1}`;
    ring.position.y = SURFACE_Y.navigationTarget;
    ring.rotation.x = -Math.PI / 2;
    ring.renderOrder = RENDER_ORDER.overlay;
    ring.userData.navigationTargetPulse = index;
    root.add(ring);
    return ring;
  });

  const octahedronGeometry = new THREE.OctahedronGeometry(0.38);
  const octahedronMaterial = new THREE.MeshStandardMaterial({
    color: MARKER_COLOR,
    emissive: 0x7a2b05,
    emissiveIntensity: 0.45,
    roughness: 0.35,
    metalness: 0.15,
    flatShading: true,
  });
  const octahedron = new THREE.Mesh(octahedronGeometry, octahedronMaterial);
  octahedron.name = 'navigation-target-octahedron';
  octahedron.position.y = 1.05;
  octahedron.scale.y = 1.65;
  octahedron.renderOrder = RENDER_ORDER.overlay;
  octahedron.userData.navigationTargetOctahedron = true;
  root.add(octahedron);
  scene.add(root);

  let elapsedSeconds = 0;

  function updatePulses(): void {
    rings.forEach((ring, index) => {
      const phase = (elapsedSeconds / PULSE_DURATION_SECONDS + index / PULSE_COUNT) % 1;
      const scale = 1 + (FINAL_SCALE - 1) * phase;
      ring.scale.setScalar(scale);
      (ring.material as THREE.MeshBasicMaterial).opacity = INITIAL_OPACITY * (1 - phase);
    });
  }

  function show(position: THREE.Vector3): void {
    root.position.set(position.x, 0, position.z);
    root.visible = true;
    elapsedSeconds = 0;
    octahedron.rotation.y = 0;
    updatePulses();
  }

  function hide(): void {
    root.visible = false;
  }

  function update(deltaSeconds: number): void {
    if (!root.visible) return;
    elapsedSeconds += Math.max(0, deltaSeconds);
    octahedron.rotation.y = elapsedSeconds * 2.4;
    updatePulses();
  }

  function dispose(): void {
    scene.remove(root);
    ringGeometry.dispose();
    rings.forEach((ring) => (ring.material as THREE.Material).dispose());
    octahedronGeometry.dispose();
    octahedronMaterial.dispose();
  }

  return { show, hide, update, dispose, isVisible: () => root.visible };
}
