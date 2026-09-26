import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import type { ResourcePool } from '../core/ResourcePool';

type StaticDecorationKind = 'oak' | 'pine' | 'cherry' | 'bench' | 'flowers' | 'lamp-post';

/** Merge each kind once, on demand, while keeping one mesh per placed decoration. */
export function createConstructionDecorations(resources: ResourcePool): (kind: StaticDecorationKind) => THREE.Mesh {
  const geometries = new Map<StaticDecorationKind, THREE.BufferGeometry>();
  const materialParameters = { vertexColors: true, roughness: 0.85, depthWrite: true, polygonOffset: false };
  return (kind) => {
    let geometry = geometries.get(kind);
    if (!geometry) {
      geometry = resources.geometry(mergeDecoration(kind));
      geometries.set(kind, geometry);
    }
    const material = resources.material(materialParameters, () => new THREE.MeshStandardMaterial(materialParameters));
    const mesh = new THREE.Mesh(geometry, material);
    mesh.castShadow = mesh.receiveShadow = true;
    return mesh;
  };
}

function mergeDecoration(kind: StaticDecorationKind): THREE.BufferGeometry {
  const parts: THREE.BufferGeometry[] = [];
  const add = (geometry: THREE.BufferGeometry, color: number, x: number, y: number, z: number) => {
    geometry.translate(x, y, z);
    const colors = new Float32Array(geometry.getAttribute('position').count * 3);
    const value = new THREE.Color(color);
    for (let index = 0; index < colors.length; index += 3) value.toArray(colors, index);
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    parts.push(geometry);
  };
  if (kind === 'flowers') {
    add(new THREE.CylinderGeometry(0.52, 0.47, 0.18, 16), 0x777c70, 0, 0.09, 0);
    const colors = [0xedafc4, 0xf5d176, 0xbfa4dd];
    for (let index = 0; index < 9; index++) {
      const angle = index * 2.39996;
      const radius = 0.12 + (index % 3) * 0.12;
      const x = Math.cos(angle) * radius, z = Math.sin(angle) * radius;
      add(new THREE.CylinderGeometry(0.018, 0.018, 0.22, 5), 0x54844c, x, 0.24, z);
      add(new THREE.SphereGeometry(0.09, 7, 5), colors[index % 3]!, x, 0.36, z);
    }
  } else if (kind === 'bench') {
    for (const x of [-0.48, 0.48]) add(new THREE.BoxGeometry(0.09, 0.45, 0.45), 0x515a59, x, 0.225, 0);
    add(new THREE.BoxGeometry(1.3, 0.1, 0.5), 0xa97950, 0, 0.48, 0);
    add(new THREE.BoxGeometry(1.3, 0.35, 0.08), 0xa97950, 0, 0.72, -0.22);
  } else if (kind === 'lamp-post') {
    add(new THREE.CylinderGeometry(0.08, 0.14, 0.14, 10), 0x4e5a59, 0, 0.07, 0);
    add(new THREE.CylinderGeometry(0.045, 0.065, 1.65, 8), 0x4e5a59, 0, 0.9, 0);
  } else {
    add(new THREE.CylinderGeometry(0.09, 0.16, 1.25, 9), 0x795b43, 0, 0.625, 0);
    if (kind === 'pine') {
      for (let i = 0; i < 3; i++) add(new THREE.ConeGeometry(0.72 - i * 0.16, 0.95, 9), 0x376956, 0, 1.15 + i * 0.45, 0);
    } else {
      const foliage = kind === 'cherry' ? 0xe5a2bd : 0x68944f;
      for (const [x, y, z, radius] of [[0, 1.7, 0, 0.66], [-0.42, 1.4, 0.1, 0.48], [0.4, 1.45, -0.1, 0.5]] as const) {
        add(new THREE.SphereGeometry(radius, 10, 8), foliage, x, y, z);
      }
    }
  }
  const merged = mergeGeometries(parts);
  parts.forEach((part) => part.dispose());
  if (!merged) throw new Error(`Construction ${kind} geometry could not be merged`);
  return merged;
}
