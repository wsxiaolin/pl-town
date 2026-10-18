import assert from 'node:assert/strict';
import test from 'node:test';
import * as THREE from 'three';
import { BUILDING_DEFS } from '../../src/city/data/buildings';
import { buildFireworksShop } from '../../src/rendering/fireworksShopBuilding';
import { buildObservationDeck } from '../../src/rendering/observationDeckBuilding';
import type { BuildingDefinition } from '../../src/city/buildingEntity';

// 回归钉（2026-10-18 用户报告「烟花铺位置不对 / 海边观景台标签在地底下」）：
// fireworksShop / observationDeck 两个 builder 曾把定义坐标设在内层 g、
// 返回未定位的 outer —— 标签投影（labelController 消费 group.position）、
// 埋深起吊（buildingSceneController group.y=-3 → 0）全部落空，标签永远
// 钉在城中心 (0,y,0)。坐标必须写在返回的 group 上（komorebiClockworks 模式）。

// node 环境无 DOM：匾额 CanvasTexture 只需可构造的 canvas 桩（不上传 GPU）。
if (typeof (globalThis as { document?: unknown }).document === 'undefined') {
  (globalThis as { document?: unknown }).document = {
    createElement: () => ({
      width: 128, height: 64,
      getContext: () => ({ fillRect() {}, strokeRect() {}, fillText() {} }),
    }),
  };
}

const makeHelpers = () => {
  const makeMaterial = () => new THREE.MeshStandardMaterial();
  return {
    platformHeight: 0.3,
    makeMaterial,
    makeMesh: (geometry: THREE.BufferGeometry, material: THREE.Material) => new THREE.Mesh(geometry, material),
    addPart: (group: THREE.Group | null, geometry: THREE.BufferGeometry, matOrParams: THREE.Material | Record<string, unknown>, position?: readonly number[], shadow = true) => {
      const mesh = new THREE.Mesh(geometry, matOrParams instanceof THREE.Material ? matOrParams : makeMaterial());
      if (position) mesh.position.set(position[0]!, position[1]!, position[2]!);
      mesh.castShadow = shadow;
      mesh.receiveShadow = true;
      if (group) group.add(mesh);
      return mesh;
    },
  };
};

for (const id of ['fireworks_shop', 'observation_deck'] as const) {
  test(`${id} group carries definition coordinates (label/lift anchor)`, () => {
    const definition = BUILDING_DEFS.find((b) => b.id === id);
    assert.ok(definition, `${id} 已登记在建筑目录`);
    const build = id === 'fireworks_shop' ? buildFireworksShop : buildObservationDeck;
    const entity = build(makeHelpers(), definition as BuildingDefinition);

    // 核心契约：group 必须携带定义坐标 —— 标签投影、埋深起吊均消费它。
    assert.equal(entity.group.position.x, definition.x, 'group.x = definition.x');
    assert.equal(entity.group.position.z, definition.z, 'group.z = definition.z');
    assert.equal(entity.group.position.y, 0, 'builder 不设 y（埋深 -3 由 sceneController 负责）');

    // 几何真的跟着 group 走：包围盒中心 ≈ 定义坐标（而非原点）。
    const bounds = new THREE.Box3().setFromObject(entity.group);
    const centerX = (bounds.min.x + bounds.max.x) / 2;
    const centerZ = (bounds.min.z + bounds.max.z) / 2;
    assert.ok(Math.abs(centerX - definition.x) < 6, `x 包围盒中心 ${centerX.toFixed(2)} 贴近 ${definition.x}`);
    assert.ok(Math.abs(centerZ - definition.z) < 6, `z 包围盒中心 ${centerZ.toFixed(2)} 贴近 ${definition.z}`);

    // 标签锚点高度存在（labelY > 0），投影才有意义。
    assert.ok((entity.labelY ?? 0) > 0, 'labelY 已定义');

    // 全部 mesh 打上 buildingId（拾取/巡查依赖）。
    entity.group.traverse((child) => {
      const mesh = child as THREE.Mesh;
      if (!mesh.isMesh) return;
      assert.equal(mesh.userData.buildingId, id);
    });
  });
}
