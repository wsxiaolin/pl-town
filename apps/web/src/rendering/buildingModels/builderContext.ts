// Shared context handed to every building shape builder module. Mirrors the
// helpers that `buildingMeshFactory` used to close over, so per-shape modules
// stay pure functions of (context, definition).
import * as THREE from 'three';
import type { MeshHelpers } from '../meshFactory';
import type { BuildingMeshFactoryOptions } from '../buildingMeshFactory';

type Palette = Record<string, number>;

export type BuilderContext = {
  P: Palette;
  PLH: number;
  stdMat: MeshHelpers['stdMat'];
  mk: MeshHelpers['mk'];
  part: MeshHelpers['part'];
  tagMeshes: (group: THREE.Object3D, id: string) => void;
  mkBodyMat: (texKey: string, rx: number, ry: number) => THREE.MeshStandardMaterial;
};

export function createBuilderContext(options: BuildingMeshFactoryOptions): BuilderContext {
  const { palette: P, platformHeight: PLH, makeMaterial: stdMat, makeMesh: mk, addPart: part } = options;
  function tagMeshes(group: THREE.Object3D, id: string) {
    group.traverse((child: THREE.Object3D) => { if ('isMesh' in child && child.isMesh) child.userData.buildingId = id; });
  }
  function mkBodyMat(texKey: string, rx: number, ry: number): THREE.MeshStandardMaterial {
    const material = stdMat({ color: P.BUILDING_WHITE, roughness: 0.08, tex: texKey, rx, ry });
    material.emissive = new THREE.Color(P.BLUE);
    material.emissiveIntensity = 0;
    return material;
  }
  return { P, PLH, stdMat, mk, part, tagMeshes, mkBodyMat };
}
