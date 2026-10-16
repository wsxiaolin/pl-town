import * as THREE from 'three';
import { LANPING_RANGE } from '../../city/data/terrain/range-lanping';
import { hashString, mulberry32 } from '../../city/data/terrain/heightfield/noiseCore';
import { buildAlpineRangeGeometry, LANPING_ALPINE_FIELD } from './alpineRangeGeometry';

export type MountainTerrainOptions = { scene: THREE.Scene };
export type MountainTerrainHandle = { object: THREE.Group; dispose(): void };

export function createMountainTerrain(options: MountainTerrainOptions): MountainTerrainHandle {
  void options.scene;
  const object = new THREE.Group();
  object.name = 'lanping-mountain-terrain';
  const geometries = new Set<THREE.BufferGeometry>();
  const materials = new Set<THREE.Material>();
  const track = <T extends THREE.BufferGeometry>(geometry: T): T => {
    geometries.add(geometry);
    return geometry;
  };
  const material = (color: number): THREE.MeshStandardMaterial => {
    const result = new THREE.MeshStandardMaterial({ color, roughness: 0.96, metalness: 0 });
    materials.add(result);
    return result;
  };
  const field = LANPING_ALPINE_FIELD;
  const surface = material(0xffffff);
  surface.vertexColors = true;
  surface.customProgramCacheKey = () => 'alpine-eroded-rock-v2';
  surface.onBeforeCompile = (shader) => {
    shader.vertexShader = shader.vertexShader.replace('#include <common>', `#include <common>
varying vec3 vAlpineWorldPosition;`)
      .replace('#include <project_vertex>', `#include <project_vertex>
vAlpineWorldPosition = (modelMatrix * vec4(transformed, 1.0)).xyz;`);
    shader.fragmentShader = shader.fragmentShader.replace('#include <common>', `#include <common>
varying vec3 vAlpineWorldPosition;
float alpineHash(vec3 p) {
  p = fract(p * 0.1031);
  p += dot(p, p.yzx + 33.33);
  return fract((p.x + p.y) * p.z);
}
float alpineNoise(vec3 p) {
  vec2 projected = p.xz + p.y * vec2(0.37, 0.61);
  vec2 cell = floor(projected);
  vec2 f = fract(projected);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(alpineHash(vec3(cell, 0)), alpineHash(vec3(cell + vec2(1,0), 0)), f.x),
             mix(alpineHash(vec3(cell + vec2(0,1), 0)), alpineHash(vec3(cell + vec2(1,1), 0)), f.x), f.y);
}`)
      .replace('#include <color_fragment>', `#include <color_fragment>
vec3 alpineP = vAlpineWorldPosition;
float alpineRock = (1.0 - smoothstep(1.08, 1.45, diffuseColor.g / max(diffuseColor.b, 0.001)))
  * smoothstep(2.0, 14.0, alpineP.y);
float alpineBroad = alpineNoise(alpineP * 0.075);
float alpineMedium = alpineNoise(alpineP * 0.28 + alpineBroad * 1.8);
float alpineFootprint = length(fwidth(alpineP));
float alpineFine = mix(0.5, alpineNoise(alpineP * 0.72), 1.0 - smoothstep(0.6, 2.4, alpineFootprint));
// Meter-scale fractures run downhill; tilted beds cross them at a wider spacing.
float alpineCrackPhase = dot(alpineP.xz, vec2(1.15, 0.83))
  + alpineBroad * 6.0 + alpineMedium * 2.4 + alpineP.y * 0.07;
float alpineCrackWidth = max(0.07, fwidth(alpineCrackPhase) * 0.65);
float alpineCrack = 1.0 - smoothstep(0.08, 0.08 + alpineCrackWidth,
  abs(sin(alpineCrackPhase)));
float alpineBedPhase = alpineP.y * 0.48 + alpineP.x * 0.12 - alpineP.z * 0.09 + alpineBroad * 7.0;
float alpineBed = sin(alpineBedPhase) * (1.0 - smoothstep(0.5, 2.5, fwidth(alpineBedPhase)));
float alpineRelief = (alpineMedium - 0.5) * 0.48 + (alpineFine - 0.5) * 0.16
   + alpineBed * 0.012 - alpineCrack * 0.035;
float alpineShade = 0.78 + alpineBroad * 0.26 + alpineMedium * 0.26
   + alpineFine * 0.10 + alpineBed * 0.018 - alpineCrack * 0.045;
diffuseColor.rgb *= mix(1.0, alpineShade, alpineRock);`)
      .replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>
// Screen derivatives perturb the standard material normal before its lighting.
vec3 alpineDx = dFdx(-vViewPosition);
vec3 alpineDy = dFdy(-vViewPosition);
vec3 alpineR1 = cross(alpineDy, normal);
vec3 alpineR2 = cross(normal, alpineDx);
float alpineDet = dot(alpineDx, alpineR1);
vec3 alpineGradient = sign(alpineDet) * (dFdx(alpineRelief) * alpineR1 + dFdy(alpineRelief) * alpineR2);
normal = normalize(abs(alpineDet) * normal - alpineRock * alpineGradient * 0.55);`);
  };
  const lod = new THREE.LOD();
  lod.name = 'lanping-continuous-alpine-range';
  const centerX = (field.bounds.x0 + field.bounds.x1) / 2;
  const centerZ = (field.bounds.z0 + field.bounds.z1) / 2;
  lod.position.set(centerX, 0, centerZ);
  for (const [spacing, distance] of [[1.5, 0], [3, 480]] as const) {
    const geometry = track(buildAlpineRangeGeometry(field, spacing));
    geometry.translate(-centerX, 0, -centerZ);
    const mesh = new THREE.Mesh(geometry, surface);
    mesh.name = `lanping-alpine-grid:${spacing}`;
    // Preserve LOD ownership when the world's static decoration batcher traverses us.
    mesh.userData.alpineLod = true;
    mesh.receiveShadow = true;
    mesh.castShadow = false;
    lod.addLevel(mesh, distance, 0.12);
  }
  lod.levels[1]!.object.visible = false;
  object.add(lod);

  const cliffMaterial = material(0x778590);
  const cliffGeometry = track(new THREE.DodecahedronGeometry(1, 0));
  for (const feature of LANPING_RANGE) {
    if (feature.kind !== 'cliff') continue;
    const cliff = new THREE.Mesh(cliffGeometry, cliffMaterial);
    const height = feature.height ?? 6;
    cliff.name = `crag:${feature.id}`;
    cliff.position.set(feature.x, height * 0.36, feature.z);
    cliff.scale.set((feature.width ?? 12) / 2, height * 0.64, (feature.depth ?? 5) / 2);
    cliff.castShadow = feature.renderHint?.castShadow ?? true;
    object.add(cliff);
  }

  const trunkMaterial = material(0x69513d);
  const foliageMaterial = material(0x365e49);
  const trunkGeometry = track(new THREE.CylinderGeometry(0.06, 0.11, 0.8, 5));
  const crownGeometry = track(new THREE.ConeGeometry(0.65, 1.9, 7));
  for (const feature of LANPING_RANGE) {
    if (feature.kind !== 'forest') continue;
    const random = mulberry32(hashString(feature.id));
    for (let index = 0; index < 12; index += 1) {
      const x = feature.x + (random() - 0.5) * (feature.width ?? 10);
      const z = feature.z + (random() - 0.5) * (feature.depth ?? 10);
      const y = Math.max(0, field.heightAt(x, z));
      const slope = Math.hypot(field.heightAt(x + 0.5, z) - field.heightAt(x - 0.5, z),
        field.heightAt(x, z + 0.5) - field.heightAt(x, z - 0.5));
      if (y > 28 || slope > 0.9 || (z > -113 && z < -88)) continue;
      const tree = new THREE.Group();
      tree.name = `${feature.id}:pine-${index}`;
      tree.position.set(x, y - 0.05, z);
      tree.scale.setScalar(0.8 + random() * 0.7);
      const trunk = new THREE.Mesh(trunkGeometry, trunkMaterial);
      trunk.position.y = 0.4;
      const crown = new THREE.Mesh(crownGeometry, foliageMaterial);
      crown.position.y = 1.45;
      trunk.castShadow = crown.castShadow = true;
      tree.add(trunk, crown);
      object.add(tree);
    }
  }

  return {
    object,
    dispose() {
      object.removeFromParent();
      for (const geometry of geometries) geometry.dispose();
      for (const owned of materials) owned.dispose();
      geometries.clear();
      materials.clear();
      object.clear();
    },
  };
}
