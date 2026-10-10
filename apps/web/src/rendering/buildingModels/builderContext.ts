// Shared context handed to every building shape builder module. Mirrors the
// helpers that `buildingMeshFactory` used to close over, so per-shape modules
// stay pure functions of (context, definition).
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
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
  /** Softened box with slightly rounded edges — the cel-shading friendly
   * silhouette that keeps specular highlights from breaking into hard lines.
   * Drop-in for `new THREE.BoxGeometry(w, h, d)`. */
  rbox: (w: number, h: number, d: number, radius?: number) => RoundedBoxGeometry;
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
  function rbox(w: number, h: number, d: number, radius?: number): RoundedBoxGeometry {
    const safeW = Math.max(w, 0.004);
    const safeH = Math.max(h, 0.004);
    const safeD = Math.max(d, 0.004);
    const minDim = Math.min(safeW, safeH, safeD);
    // Chunky enough to read as softened silhouettes from street distance —
    // the cel shading then breaks softly around every edge.
    const auto = Math.min(0.09, minDim * 0.22);
    const r = Math.max(0.001, Math.min(radius ?? auto, minDim / 2 - 0.001));
    return new RoundedBoxGeometry(safeW, safeH, safeD, 2, r);
  }
  return { P, PLH, stdMat, mk, part, tagMeshes, mkBodyMat, rbox };
}
