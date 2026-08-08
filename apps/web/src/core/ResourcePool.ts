import * as THREE from 'three';

type TextureFactory = () => THREE.Texture;

export class ResourcePool {
  private readonly textures = new Map<string, THREE.Texture>();
  private readonly geometries = new Map<string, THREE.BufferGeometry>();
  private readonly materials = new Map<string, THREE.MeshStandardMaterial>();

  texture(key: string, factory: TextureFactory): THREE.Texture {
    const cached = this.textures.get(key);
    if (cached) return cached;
    const texture = factory();
    this.textures.set(key, texture);
    return texture;
  }

  geometry<T extends THREE.BufferGeometry>(geometry: T): T {
    const parameters = 'parameters' in geometry ? geometry.parameters : undefined;
    const key = `${geometry.type}:${stableStringify(parameters)}`;
    const cached = this.geometries.get(key);
    if (cached) {
      geometry.dispose();
      return cached as T;
    }
    this.geometries.set(key, geometry);
    return geometry;
  }

  material(params: Record<string, unknown>, factory: () => THREE.MeshStandardMaterial): THREE.MeshStandardMaterial {
    const key = stableStringify(params);
    const cached = this.materials.get(key);
    if (cached) return cached;
    const material = factory();
    this.materials.set(key, material);
    return material;
  }

  dispose(): void {
    this.materials.forEach((material) => material.dispose());
    this.geometries.forEach((geometry) => geometry.dispose());
    this.textures.forEach((texture) => texture.dispose());
    this.materials.clear();
    this.geometries.clear();
    this.textures.clear();
  }
}

function stableStringify(value: unknown): string {
  if (value === undefined) return '';
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`;
  const object = value as Record<string, unknown>;
  return `{${Object.keys(object).sort().map((key) => `${key}:${stableStringify(object[key])}`).join(',')}}`;
}
