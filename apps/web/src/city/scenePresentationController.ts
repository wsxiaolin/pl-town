import * as THREE from 'three';
import type { MaterialParameters } from '../rendering/meshFactory';

export function addCityLighting(scene: THREE.Scene, mobile: () => boolean, night: boolean): void {
  const ambient = new THREE.AmbientLight(0xFAF8F4, night ? 0.6 : 1.05);
  ambient.name = 'amb';
  scene.add(ambient);
  const directional = new THREE.DirectionalLight(0xFFFFFF, night ? 0.3 : 0.55);
  directional.name = 'dir';
  directional.position.set(18, 28, 12);
  directional.castShadow = true;
  const size = mobile() ? 512 : 1024;
  directional.shadow.mapSize.set(size, size);
  directional.shadow.camera.left = -45;
  directional.shadow.camera.right = 45;
  directional.shadow.camera.top = 45;
  directional.shadow.camera.bottom = -45;
  directional.shadow.camera.near = 0.5;
  directional.shadow.camera.far = 120;
  directional.shadow.bias = -0.0006;
  directional.shadow.normalBias = 0.02;
  scene.add(directional);
  const fill = new THREE.DirectionalLight(0xD8E8FF, 0.18);
  fill.position.set(-6, 8, -6);
  scene.add(fill);
}

export function addCityFountain(options: { scene: THREE.Scene; palette: Record<string, number>; part: (group: THREE.Group, geometry: THREE.BufferGeometry, material: THREE.Material | MaterialParameters, position: [number, number, number], shadow?: boolean) => THREE.Mesh }): void {
  const { scene, palette, part } = options;
  const group = new THREE.Group();
  part(group, new THREE.CylinderGeometry(1.8, 1.9, 0.36, 48), { color: palette.FOUNTAIN_RIM, roughness: 0.75, tex: 'stone', rx: 6, ry: 1 }, [0, 0.18, 0]);
  part(group, new THREE.CylinderGeometry(1.55, 1.55, 0.03, 48), { color: palette.FOUNTAIN_WATER, roughness: 0.05, metalness: 0.2, transparent: true, opacity: 0.85 }, [0, 0.335, 0], false);
  part(group, new THREE.CylinderGeometry(0.85, 0.95, 0.18, 32), { color: palette.FOUNTAIN_RIM, roughness: 0.75, tex: 'stone', rx: 3, ry: 1 }, [0, 0.45, 0]);
  part(group, new THREE.CylinderGeometry(0.7, 0.7, 0.03, 32), { color: palette.FOUNTAIN_WATER, roughness: 0.05, metalness: 0.2, transparent: true, opacity: 0.85 }, [0, 0.54, 0], false);
  part(group, new THREE.CylinderGeometry(0.12, 0.15, 0.7, 16), { color: 0xD4D3D0, roughness: 0.55, tex: 'stone', rx: 1, ry: 1 }, [0, 0.65, 0]);
  part(group, new THREE.SphereGeometry(0.18, 16, 16), { color: palette.BLUE, emissive: palette.BLUE, emissiveIntensity: 0.45, roughness: 0.2, metalness: 0.3 }, [0, 1.1, 0], false);
  for (let index = 0; index < 8; index += 1) {
    const angle = (index / 8) * Math.PI * 2;
    const distance = 0.25 + Math.random() * 0.15;
    part(group, new THREE.SphereGeometry(0.04 + Math.random() * 0.03, 8, 8), { color: 0xA8C8F8, emissive: 0x6A8FE0, emissiveIntensity: 0.2, transparent: true, opacity: 0.7, roughness: 0.3 }, [Math.cos(angle) * distance, 1 + Math.random() * 0.2, Math.sin(angle) * distance], false);
  }
  scene.add(group);
}
