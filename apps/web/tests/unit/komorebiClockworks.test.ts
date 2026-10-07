import assert from 'node:assert/strict';
import test from 'node:test';
import * as THREE from 'three';
import { BUILDING_DEFS } from '../../src/city/data/buildings';
import { buildKomorebiWorkshop, updateKomorebiClockworks } from '../../src/rendering/komorebiClockworks';
import type { BuildingDefinition } from '../../src/city/buildingEntity';

// 与 meshFactory.part 同构的桩：材质不走资源池，但 castShadow 语义保持一致，
// 用于钉住“微小道具不进 shadow pass”的回归约束。
const makeHelpers = () => {
  const makeMaterial = () => new THREE.MeshStandardMaterial();
  return {
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

const KOMOREBI_ID = 'north_komorebi';

test('komorebi workshop meshes stay tagged and mostly shadow-free', () => {
  const definition = BUILDING_DEFS.find((b) => b.id === KOMOREBI_ID);
  assert.ok(definition, 'north_komorebi 已登记在建筑目录');
  const entity = buildKomorebiWorkshop({ platformHeight: 0.3, ...makeHelpers() }, definition as BuildingDefinition);
  let meshes = 0;
  let casters = 0;
  entity.group.traverse((child) => {
    const mesh = child as THREE.Mesh;
    if (!mesh.isMesh) return;
    meshes += 1;
    if (mesh.castShadow) casters += 1;
    assert.equal(mesh.userData.buildingId, KOMOREBI_ID, '全部 mesh 都打上 buildingId（拾取/巡查依赖）');
  });
  assert.ok(meshes > 300, `代表结构移植量完整（实测 ${meshes} 件）`);
  // shadow 优化回归钉：亚分米装饰件不投影，仅结构大件进 shadow pass。
  assert.ok(casters / meshes <= 0.4, `castShadow 比例 ${casters}/${meshes} 应 ≤ 40%（当前 ${Math.round((casters / meshes) * 100)}%）`);
  // 包围盒落在地块内（14×SCALE≈8.68 半宽 + 地皮余量）。
  const bounds = new THREE.Box3().setFromObject(entity.group);
  const half = (14 * 0.62) / 2;
  assert.ok(bounds.min.x >= definition.x - half - 0.5 && bounds.max.x <= definition.x + half + 0.5, 'x 包围盒在地块内');
  assert.ok(bounds.min.z >= definition.z - half - 0.5 && bounds.max.z <= definition.z + half + 0.5, 'z 包围盒在地块内');
  // 活件全部注册（updateKomorebiClockworks 的契约）。
  const anim = entity.group.userData.komorebiAnim as Record<string, unknown> | undefined;
  assert.ok(anim, 'komorebiAnim 已挂载');
  assert.ok(anim.wheel instanceof THREE.Group, '水车已注册');
  assert.equal((anim.gears as unknown[]).length, 3, '三枚啮合齿轮');
  assert.ok(anim.pendulum instanceof THREE.Group, '钟摆已注册');
  assert.ok(anim.minuteHand instanceof THREE.Group && anim.hourHand instanceof THREE.Group, '时针/分针已注册');
  assert.equal((anim.birdDoors as unknown[]).length, 2, '布谷鸟双开门');
  assert.ok(anim.cuckoo instanceof THREE.Group, '布谷鸟已注册');
  assert.ok(anim.musicBarrel instanceof THREE.Group, '音乐桶已注册');
  assert.equal((anim.sprigs as unknown[]).length, 2, '两丛摇曳草茎');
  // 导航足迹与原作基座一致。
  assert.deepEqual(entity.group.userData.navigationFootprint, { width: 14 * 0.62, depth: 14 * 0.62 });
});

test('updateKomorebiClockworks drives anims and skips non-komorebi buildings', () => {
  const plain = new THREE.Group();
  const kGroup = new THREE.Group();
  const anim = {
    wheel: new THREE.Group(),
    gears: [{ g: new THREE.Group(), ratio: -1, phase: 0.5 }],
    pendulum: new THREE.Group(),
    minuteHand: new THREE.Group(),
    hourHand: new THREE.Group(),
    birdDoors: [{ g: new THREE.Group(), side: 1 }, { g: new THREE.Group(), side: -1 }],
    cuckoo: new THREE.Group(),
    musicBarrel: new THREE.Group(),
    sprigs: [new THREE.Group()],
  };
  anim.cuckoo.position.z = 0.88;
  kGroup.userData.komorebiAnim = anim;

  updateKomorebiClockworks([{ group: plain }, { group: kGroup }], 21, false);
  // 传动系：水车 0.105 rad/s，齿轮按传动比反向。
  assert.equal(anim.wheel.rotation.z, 21 * 0.105);
  assert.equal(anim.gears[0]!.g.rotation.z, 0.5 + 21 * 0.105 * -1);
  assert.ok(Math.abs(anim.pendulum.rotation.z - Math.sin(21 * 1.7) * 0.17) < 1e-9);
  // 指针走本地真实时间（与断言取时可能跨秒，容差放宽到 1/60 圈）。
  const now = new Date();
  const minutes = now.getMinutes() + now.getSeconds() / 60;
  const hours = (now.getHours() % 12) + minutes / 60;
  assert.ok(Math.abs(anim.minuteHand.rotation.z + (minutes / 60) * Math.PI * 2) < 0.02);
  assert.ok(Math.abs(anim.hourHand.rotation.z + (hours / 12) * Math.PI * 2) < 0.02);
  // 布谷鸟报时 t=21 处于开门+探头段（32 秒循环）。
  assert.ok(anim.birdDoors[0]!.g.rotation.y > 0.5, '正门开门');
  assert.ok(anim.birdDoors[1]!.g.rotation.y < -0.5, '对侧门反向开门');
  assert.ok(anim.cuckoo.position.z > 1.0, '布谷鸟探出');
  assert.equal(anim.musicBarrel.rotation.x, 21 * 0.16);
  assert.notEqual(anim.sprigs[0]!.rotation.z, 0, '草茎摇曳');
  // 闭门时段（t=5）。
  anim.birdDoors[0]!.g.rotation.y = 9;
  anim.cuckoo.position.z = 9;
  updateKomorebiClockworks([{ group: kGroup }], 5, false);
  assert.equal(anim.birdDoors[0]!.g.rotation.y, 0, 't=5 门保持关闭');
  assert.equal(anim.cuckoo.position.z, 0.88, 't=5 布谷鸟收回');
  // reduced 偏好：完全跳过。
  anim.wheel.rotation.z = 0;
  updateKomorebiClockworks([{ group: kGroup }], 100, true);
  assert.equal(anim.wheel.rotation.z, 0, 'reduced 时跳过更新');
});
