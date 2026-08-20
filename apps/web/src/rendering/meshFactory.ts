import * as THREE from 'three';
import type { ResourcePool } from '../core/ResourcePool';
import { RENDER_ORDER } from './layers';
import type { Weather } from '../city/weather';

export type MaterialParameters = Record<string, unknown> & {
  tex?: string;
  rx?: number;
  ry?: number;
  transparent?: boolean;
};

export type MeshHelpers = {
  stdMat: (params?: MaterialParameters | null) => THREE.MeshStandardMaterial;
  mk: (geo: THREE.BufferGeometry, mat: THREE.Material) => THREE.Mesh;
  refreshWeather: () => void;
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
  getWeather: () => Weather,
): MeshHelpers {
  const weatherMaterials = new Set<THREE.MeshStandardMaterial>();

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
    const material = new THREE.MeshStandardMaterial(o);
    material.userData.weatherBaseColor = material.color.clone();
    material.userData.weatherBaseRoughness = material.roughness;
    material.userData.weatherBaseMetalness = material.metalness;
    material.userData.weatherTexture = texKey;
    material.userData.weatherRepeat = [rx, ry];
    weatherMaterials.add(material);
    applyWeather(material);
    return material;
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

  function refreshWeather(): void {
    for (const material of weatherMaterials) {
      const baseColor = material.userData.weatherBaseColor as THREE.Color;
      const baseRoughness = Number(material.userData.weatherBaseRoughness ?? 0.8);
      const baseMetalness = Number(material.userData.weatherBaseMetalness ?? 0);
      const textureKey = material.userData.weatherTexture as string | undefined;
      const repeat = material.userData.weatherRepeat as [number, number] | undefined;
      const nextTexture = textureKey ? repeatTexture(textureKey, repeat?.[0], repeat?.[1]) : null;
      material.map = nextTexture;
      applyWeather(material, baseColor, baseRoughness, baseMetalness);
      material.needsUpdate = true;
    }
  }

  function applyWeather(
    material: THREE.MeshStandardMaterial,
    baseColor = material.userData.weatherBaseColor as THREE.Color,
    baseRoughness = Number(material.userData.weatherBaseRoughness ?? 0.8),
    baseMetalness = Number(material.userData.weatherBaseMetalness ?? 0),
  ): void {
    material.color.copy(baseColor);
    material.roughness = baseRoughness;
    material.metalness = baseMetalness;
    if (getWeather() === 'rain') {
      material.roughness = Math.min(baseRoughness, 0.48);
      material.metalness = Math.max(baseMetalness, 0.08);
    } else if (getWeather() === 'snow' || getWeather() === 'snow-deep') {
      material.color.lerp(new THREE.Color(0xeaf3ff), 0.28);
      material.roughness = Math.max(baseRoughness, 0.86);
    }
  }

  return { stdMat, mk, part, refreshWeather };
}
