import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import type { ResourcePool } from '../core/ResourcePool';

/** One shared, vertex-colored mesh per flower bed instead of 19 draw calls. */
export function createConstructionFlowers(resources: ResourcePool): () => THREE.Mesh {
  const parts: THREE.BufferGeometry[] = [];
  const add = (geometry: THREE.BufferGeometry, color: number, x: number, y: number, z: number) => {
    geometry.translate(x, y, z);
    const colors = new Float32Array(geometry.getAttribute('position').count * 3);
    const value = new THREE.Color(color);
    for (let index = 0; index < colors.length; index += 3) value.toArray(colors, index);
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    parts.push(geometry);
  };
  add(new THREE.CylinderGeometry(0.52, 0.47, 0.18, 16), 0x777c70, 0, 0.09, 0);
  const colors = [0xedafc4, 0xf5d176, 0xbfa4dd];
  for (let index = 0; index < 9; index++) {
    const angle = index * 2.39996;
    const radius = 0.12 + (index % 3) * 0.12;
    const x = Math.cos(angle) * radius, z = Math.sin(angle) * radius;
    add(new THREE.CylinderGeometry(0.018, 0.018, 0.22, 5), 0x54844c, x, 0.24, z);
    add(new THREE.SphereGeometry(0.09, 7, 5), colors[index % 3]!, x, 0.36, z);
  }
  const merged = mergeGeometries(parts);
  parts.forEach((part) => part.dispose());
  if (!merged) throw new Error('Construction flower geometry could not be merged');
  const geometry = resources.geometry(merged);
  const material = resources.material({ kind: 'construction-flowers' }, () =>
    new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.85 }));
  return () => {
    const mesh = new THREE.Mesh(geometry, material);
    mesh.castShadow = mesh.receiveShadow = true;
    return mesh;
  };
}
