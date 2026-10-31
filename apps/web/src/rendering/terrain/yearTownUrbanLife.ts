import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { YEAR_TOWN_URBAN_LIFE, type UrbanLifeKind } from '../../city/data/year-towns/urbanLife';
import { terrainHeight } from '../../city/data/terrain/heightfield/terrainHeight';

// 外城生活层：摊位、树木、长椅、花坛、报亭和公园。按 kind+颜色合并，
// 不为每个小道具创建 draw call；坐标来自 data/year-towns/urbanLife。
export function createYearTownUrbanLife(options: { scene: THREE.Scene }): { object: THREE.Group; dispose(): void } {
  const root = new THREE.Group();
  root.name = 'year-town-urban-life';
  const buckets = new Map<string, THREE.BufferGeometry[]>();

  const palette = {
    wood: 0x886343,
    metal: 0x56616a,
    cream: 0xe6dfcf,
    leaf: 0x5c875b,
    water: 0x6da6b5,
    stone: 0xa9a79e,
    glow: 0xffd78e,
  } as const;

  for (const spec of YEAR_TOWN_URBAN_LIFE) {
    const g = new THREE.Group();
    const local: { kind: UrbanLifeKind | 'wood' | 'metal' | 'cream' | 'leaf' | 'water' | 'stone' | 'glow'; color: number; geometry: THREE.BufferGeometry }[] = [];
    const emit = (kind: typeof local[number]['kind'], color: number, geometry: THREE.BufferGeometry, x: number, y: number, z: number, rx = 0, ry = 0, rz = 0): void => {
      geometry.applyMatrix4(new THREE.Matrix4().compose(
        new THREE.Vector3(x, y, z),
        new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, ry, rz)),
        new THREE.Vector3(1, 1, 1),
      ));
      local.push({ kind, color, geometry });
    };
    const b = (kind: typeof local[number]['kind'], color: number, w: number, h: number, d: number, x: number, y: number, z: number): void => emit(kind, color, new THREE.BoxGeometry(w, h, d), x, y, z);
    const c = (kind: typeof local[number]['kind'], color: number, rt: number, rb: number, h: number, x: number, y: number, z: number): void => emit(kind, color, new THREE.CylinderGeometry(rt, rb, h, 10), x, y, z);
    const tint = spec.tint ?? 0xb8754f;
    if (spec.kind === 'tree') {
      c('wood', palette.wood, 0.16, 0.25, 2.2, 0, 1.1, 0);
      emit('leaf', palette.leaf, new THREE.IcosahedronGeometry(1.35, 1), 0, 2.8, 0);
      emit('leaf', 0x71986b, new THREE.IcosahedronGeometry(0.95, 1), 0.8, 2.5, 0.25);
    } else if (spec.kind === 'lamp') {
      c('metal', palette.metal, 0.07, 0.12, 3.3, 0, 1.65, 0);
      b('metal', palette.metal, 0.8, 0.08, 0.08, 0.35, 3.25, 0);
      emit('glow', palette.glow, new THREE.SphereGeometry(0.22, 8, 6), 0.7, 3.05, 0);
      c('stone', palette.stone, 0.22, 0.3, 0.25, 0, 0.125, 0);
    } else if (spec.kind === 'bench') {
      b('wood', palette.wood, 2, 0.16, 0.65, 0, 0.62, 0);
      b('wood', palette.wood, 2, 0.65, 0.12, 0, 0.98, -0.29);
      b('metal', palette.metal, 0.12, 0.6, 0.55, -0.78, 0.3, 0);
      b('metal', palette.metal, 0.12, 0.6, 0.55, 0.78, 0.3, 0);
    } else if (spec.kind === 'stall') {
      b('wood', palette.wood, 3.2, 0.18, 1.7, 0, 1.05, 0);
      for (const x of [-1.4, 1.4]) for (const z of [-0.68, 0.68]) b('wood', palette.wood, 0.1, 2.7, 0.1, x, 1.35, z);
      b('stall', tint, 3.5, 0.14, 2.15, 0, 2.75, 0);
      for (const x of [-1.15, 0, 1.15]) b('cream', palette.cream, 0.46, 0.04, 2.17, x, 2.84, 0);
      for (const x of [-0.95, 0, 0.95]) b('stall', tint, 0.68, 0.4, 0.72, x, 1.35, 0);
      b('cream', palette.cream, 1.15, 0.42, 0.06, 0, 2.25, 0.88);
    } else if (spec.kind === 'parasol') {
      c('wood', palette.wood, 0.07, 0.07, 2.9, 0, 1.45, 0);
      c('parasol', tint, 0.12, 1.65, 0.65, 0, 2.65, 0);
      b('wood', palette.wood, 1.8, 0.14, 1.8, 0, 0.85, 0);
    } else if (spec.kind === 'crate') {
      b('crate', 0xa7794c, 1.05, 0.75, 0.9, 0, 0.375, 0);
      b('wood', 0x6e4d32, 1.08, 0.1, 0.1, 0, 0.35, 0.46);
      b('wood', 0x6e4d32, 1.08, 0.1, 0.1, 0, 0.35, -0.46);
    } else if (spec.kind === 'planter') {
      b('stone', palette.stone, 1.7, 0.55, 1.7, 0, 0.275, 0);
      emit('leaf', palette.leaf, new THREE.IcosahedronGeometry(0.82, 1), 0, 0.95, 0);
    } else if (spec.kind === 'kiosk') {
      b('metal', palette.metal, 1.5, 2.3, 1.1, 0, 1.15, 0);
      b('glow', palette.glow, 1.28, 1.4, 0.04, 0, 1.35, 0.57);
      b('stall', 0x477e96, 1.8, 0.18, 1.45, 0, 2.42, 0);
      b('cream', palette.cream, 1.05, 0.32, 0.05, 0, 2.05, 0.59);
    } else {
      c('stone', palette.stone, 3.3, 3.5, 0.35, 0, 0.175, 0);
      c('water', palette.water, 2.9, 2.9, 0.12, 0, 0.41, 0);
      c('stone', palette.stone, 0.48, 0.72, 1.9, 0, 1.25, 0);
      c('water', palette.water, 1.1, 1.35, 0.16, 0, 2.25, 0);
      emit('water', 0xa4d4da, new THREE.CylinderGeometry(0.08, 0.18, 1.3, 8), 0, 2.95, 0);
    }
    // 坐标约定：oldport 条目存最终世界坐标（历史草案偏移已在数据层归一化）；
    // starport 条目存草案坐标，渲染时按既定偏移映射（x−70, z+6）。
    const x = spec.x + (spec.districtId === 'island-starport' ? -70 : 0);
    const z = spec.z + (spec.districtId === 'island-starport' ? 6 : 0);
    g.position.set(x, terrainHeight(x, z), z);
    g.rotation.y = spec.rotY ?? 0;
    g.updateMatrixWorld(true);
    for (const part of local) {
      part.geometry.applyMatrix4(g.matrixWorld);
      const key = `${part.kind}-${part.color}`;
      const list = buckets.get(key) ?? [];
      list.push(part.geometry);
      buckets.set(key, list);
    }
  }

  for (const [key, geometries] of buckets) {
    const [kind, rawColor] = key.split('-');
    const merged = mergeGeometries(geometries, false);
    if (!merged) continue;
    const colored = new THREE.MeshStandardMaterial({
      color: Number(rawColor),
      flatShading: true,
      roughness: kind === 'metal' ? 0.55 : 0.86,
      metalness: kind === 'metal' ? 0.25 : 0,
      emissive: kind === 'glow' ? Number(rawColor) : 0x000000,
      emissiveIntensity: kind === 'glow' ? 0.75 : 0,
    });
    if (kind === 'glow') colored.emissive.setHex(Number(rawColor));
    const mesh = new THREE.Mesh(merged, colored);
    mesh.name = `year-town-life-${key}`;
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    root.add(mesh);
    for (const geometry of geometries) geometry.dispose();
  }

  options.scene.add(root);
  return {
    object: root,
    dispose() {
      root.parent?.remove(root);
      root.traverse((child) => {
        if (child instanceof THREE.Mesh) {
          child.geometry.dispose();
          (child.material as THREE.Material).dispose();
        }
      });

    },
  };
}
