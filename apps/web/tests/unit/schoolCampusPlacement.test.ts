import assert from 'node:assert/strict';
import test from 'node:test';
import * as THREE from 'three';
import { BUILDING_DEFS } from '../../src/city/data/buildings';
import { buildSchoolCampus } from '../../src/rendering/schoolCampusBuilding';
import type { BuildingDefinition } from '../../src/city/buildingEntity';

// 回归钉（2026-10-18）：school_north / school_east 原先共用一座 3×3 的单体
// 「小学堂」。重建为完整校园后，锁定三件事：
// 1. 坐标仍落在返回的 group 上（标签投影/埋深起吊消费它）；
// 2. 占地不越过街区边界（8×4.4 以内），避免压到人行道外的道路；
// 3. 确实是多体量校园（网格数量、体量高度），而不是退回单盒子；
// 4. 屋顶三角形朝外，FrontSide 材质下从上方能看到坡屋面（曾经整片屋顶
//    因绕序反了被裁掉，只剩檐口平板）。

const MAIN_Z_FOR_TEST = -1.35;

const makeHelpers = () => {
  const material = () => new THREE.MeshStandardMaterial();
  return {
    platformHeight: 0.3,
    makeMaterial: material,
    makeMesh: (geometry: THREE.BufferGeometry, mat: THREE.Material) => new THREE.Mesh(geometry, mat),
    addPart: (
      group: THREE.Group | null,
      geometry: THREE.BufferGeometry,
      matOrParams: THREE.Material | Record<string, unknown>,
      position?: readonly number[],
      shadow = true,
    ) => {
      const mesh = new THREE.Mesh(geometry, matOrParams instanceof THREE.Material ? matOrParams : material());
      if (position) mesh.position.set(position[0]!, position[1]!, position[2]!);
      mesh.castShadow = shadow;
      mesh.receiveShadow = true;
      if (group) group.add(mesh);
      return mesh;
    },
  };
};

for (const id of ['school_north', 'school_east'] as const) {
  test(`${id} is rebuilt as a campus that stays inside its block`, () => {
    const definition = BUILDING_DEFS.find((building) => building.id === id);
    assert.ok(definition, `${id} 已登记在建筑目录`);

    const entity = buildSchoolCampus(makeHelpers(), definition as BuildingDefinition);
    assert.equal(entity.group.position.x, definition!.x, 'group.x = definition.x');
    assert.equal(entity.group.position.z, definition!.z, 'group.z = definition.z');
    assert.equal(entity.group.position.y, 0, 'builder 不设 y（埋深由 sceneController 负责）');
    assert.equal(entity.skipFacadeDecal, true, '校园自带窗框/门廊，跳过整面 facade 贴花');

    const bounds = new THREE.Box3().setFromObject(entity.group);
    const size = bounds.getSize(new THREE.Vector3());
    // 街区可用宽度约 8.0、进深约 5.0；校园不得越过自己的街区。
    assert.ok(size.x <= 8.0, `footprint width ${size.x.toFixed(2)} 应 <= 8.0`);
    assert.ok(size.z <= 4.4, `footprint depth ${size.z.toFixed(2)} 应 <= 4.4`);
    // 同时确认它真的长大了：围合校园基座 7.9 × 4.35、钟楼总高约 4.0。
    assert.ok(size.x >= 7.6, `footprint width ${size.x.toFixed(2)} 应 >= 7.6`);
    assert.ok(size.z >= 4.1, `footprint depth ${size.z.toFixed(2)} 应 >= 4.1`);
    assert.ok(size.y >= 3.6, `campus height ${size.y.toFixed(2)} 应 >= 3.6`);
    assert.ok(bounds.min.y >= -0.01, `campus 不应埋入地下（min.y=${bounds.min.y.toFixed(3)}）`);

    let meshes = 0;
    entity.group.traverse((object) => { if ((object as THREE.Mesh).isMesh) meshes += 1; });
    assert.ok(meshes >= 80, `multi-volume campus expected >= 80 meshes, got ${meshes}`);

    // 从正上方打在钟楼东侧的坡屋面上：绕序正确时先命中山坡，绕序反了
    // 会直接穿过屋顶命中 2.48 高的檐口平板。
    const raycaster = new THREE.Raycaster(
      new THREE.Vector3(definition!.x + 2.0, 20, definition!.z + MAIN_Z_FOR_TEST),
      new THREE.Vector3(0, -1, 0),
    );
    const roofHit = raycaster.intersectObject(entity.group, true)[0];
    assert.ok(roofHit, '屋顶坡面应能被上方射线命中');
    assert.ok(roofHit.point.y > 2.55, `屋顶坡面高度 ${roofHit.point.y.toFixed(2)} 应高于檐口 2.48`);

    const body = entity.body as THREE.Mesh | undefined;
    assert.ok(body, '主楼 body 存在（供碰撞/交互定位）');
    const parameters = (body!.geometry as THREE.BoxGeometry).parameters;
    assert.ok(parameters.width >= 6 && parameters.height >= 1.6 && parameters.depth >= 1.2, '主楼体量符合校园尺度');
    assert.ok((entity.labelY ?? 0) >= 3.2, `labelY ${entity.labelY} 应高于钟楼`);
  });
}
