import * as THREE from 'three';
import type { ResourcePool } from '../core/ResourcePool';
import { RENDER_ORDER } from './layers';

export type MaterialParameters = Record<string, unknown> & {
  tex?: string;
  rx?: number;
  ry?: number;
  transparent?: boolean;
};

export type MeshHelpers = {
  stdMat: (params?: MaterialParameters | null) => THREE.MeshStandardMaterial;
  mk: (geo: THREE.BufferGeometry, mat: THREE.Material) => THREE.Mesh;
  part: (
    group: THREE.Group | null,
    geo: THREE.BufferGeometry,
    matOrParams: THREE.Material | MaterialParameters,
    pos?: [number, number, number],
    shadow?: boolean,
  ) => THREE.Mesh;
};

export function createMeshHelpers(
  resources: ResourcePool,
  repeatTexture: (key: string, rx?: number, ry?: number) => THREE.Texture | null,
): MeshHelpers {
  function stdMat(p?: MaterialParameters | null): THREE.MeshStandardMaterial {
    if (!p) return new THREE.MeshStandardMaterial();
    const texKey = p.tex, rx = p.rx || 1, ry = p.ry || 1;
    const o: Record<string, unknown> = {};
    Object.keys(p).forEach(k => { if (k !== 'tex' && k !== 'rx' && k !== 'ry') o[k] = p[k]; });
    if (texKey) {
      const t = repeatTexture(texKey, rx, ry);
      if (t) o.map = t;
    }
    if (o.transparent) o.depthWrite = false;
    return new THREE.MeshStandardMaterial(o);
  }

  function mk(geo: THREE.BufferGeometry, mat: THREE.Material): THREE.Mesh {
    return new THREE.Mesh(resources.geometry(geo), mat);
  }

  function part(
    group: THREE.Group | null,
    geo: THREE.BufferGeometry,
    matOrParams: THREE.Material | MaterialParameters,
    pos?: [number, number, number],
    shadow = true,
  ): THREE.Mesh {
    const mat = matOrParams instanceof THREE.Material
      ? matOrParams
      : resources.material({ kind: 'part', ...matOrParams }, () => stdMat(matOrParams));
    const m = new THREE.Mesh(resources.geometry(geo), mat);
    if (pos) m.position.set(pos[0], pos[1], pos[2]);
    m.castShadow = shadow;
    m.receiveShadow = true;
    if (mat.transparent) m.renderOrder = RENDER_ORDER.transparentSurface;
    if (group) group.add(m);
    return m;
  }

  return { stdMat, mk, part };
}
