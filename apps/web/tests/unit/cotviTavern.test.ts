import assert from 'node:assert/strict';
import test from 'node:test';
import * as THREE from 'three';
import { BUILDING_CONTENT, BUILDING_DEFS } from '../../src/city/data/buildings';
import { createBuildingMeshFactory } from '../../src/rendering/buildingMeshFactory';
import type { BuildingDefinition } from '../../src/city/buildingEntity';

test('Cotvi tavern keeps its plot while gaining the barkeeper dialogue tree', () => {
  const tavern = BUILDING_DEFS.find((building) => building.id === 'tavern');
  assert.ok(tavern);
  assert.equal(tavern.label, '科特维酒馆');
  assert.equal(tavern.shape, 'tavern');
  assert.deepEqual([tavern.x, tavern.z], [33, 3]);
  assert.equal(BUILDING_DEFS.filter((building) => building.x === tavern.x && building.z === tavern.z).length, 1);

  const content = BUILDING_CONTENT.tavern!;
  assert.equal(content.name, '科特维酒馆');
  assert.equal(content.slogan, '无论你是从哪来、怎么死，现在的归宿只有地下城。');
  assert.ok(content.dialogAvatar && content.dialogAvatar.length === 2);

  const tree = content.dialogTree!;
  assert.equal(tree.length, 16);
  tree.forEach((node, nodeIndex) => {
    assert.ok(node.text.length > 0, `node ${nodeIndex} carries narration`);
    assert.ok(node.options.length > 0, `node ${nodeIndex} offers a choice`);
    node.options.forEach((option) => {
      assert.ok(option.next === null || (option.next >= 0 && option.next < tree.length), `node ${nodeIndex} has a valid destination`);
    });
  });

  // Every node is reachable when walking the tree from the opening scene.
  const reachable = new Set<number>([0]);
  let frontier = [0];
  while (frontier.length) {
    const next: number[] = [];
    frontier.forEach((index) => {
      tree[index]!.options.forEach((option) => {
        if (option.next !== null && !reachable.has(option.next)) {
          reachable.add(option.next);
          next.push(option.next);
        }
      });
    });
    frontier = next;
  }
  tree.forEach((_, nodeIndex) => {
    assert.ok(reachable.has(nodeIndex), `node ${nodeIndex} is reachable`);
  });

  // The waystation's core promise and its fixtures are all present.
  const script = tree.map((node) => node.text).join('\n');
  assert.match(script, /无论你是从哪来、怎么死/);
  assert.match(script, /转生/);
  assert.match(script, /地下城/);
  assert.match(script, /油灯/);
  assert.match(script, /钢琴/);
  assert.match(script, /客房/);
  assert.match(script, /稀释金龙血/);
  assert.match(script, /残樱/);
  assert.match(script, /蓝羊/);
});

test('Cotvi tavern mesh stands two stories clear of the roads', () => {
  const tavern = BUILDING_DEFS.find((building) => building.id === 'tavern') as BuildingDefinition;
  const factory = createBuildingMeshFactory({
    palette: { BLUE: 0x3b6fe0 } as Record<string, number>,
    platformHeight: 0.2,
    makeMaterial: () => new THREE.MeshStandardMaterial(),
    makeMesh: (geometry, material) => new THREE.Mesh(geometry, material),
    addPart: (group, geometry, material, position, shadow) => {
      const mat = material instanceof THREE.Material ? material : new THREE.MeshStandardMaterial();
      const mesh = new THREE.Mesh(geometry, mat);
      if (position) mesh.position.set(position[0], position[1], position[2]);
      mesh.castShadow = shadow !== false;
      group?.add(mesh);
      return mesh;
    },
  });
  const entity = factory.builders.tavern(tavern);
  assert.ok(entity.group);
  assert.ok(entity.body, 'the tavern hall stays the raycast body');
  assert.ok(entity.labelY !== undefined && entity.labelY > 4, 'the label rides above the guest rooms');

  // The facade must stay a two-story building: the upper floor sits above the hall.
  const bounds = new THREE.Box3().setFromObject(entity.group);
  assert.ok(bounds.max.y - bounds.min.y > 4, 'two stories plus roof are visible');
  assert.ok(bounds.max.x - bounds.min.x > 3.5, 'the facade spans the old plot width');

  // Road clearance only concerns street-level geometry: the 45°-rotated
  // pyramid roof overhangs in AABB terms but starts above the second floor,
  // exactly like the old tavern's cone roof did. Union the boxes of the
  // meshes that actually reach the street.
  const groundBounds = new THREE.Box3();
  entity.group.updateMatrixWorld(true);
  entity.group.traverse((child) => {
    const mesh = child as THREE.Mesh;
    if (!mesh.isMesh) return;
    mesh.geometry.computeBoundingBox();
    const box = mesh.geometry.boundingBox!.clone().applyMatrix4(mesh.matrixWorld);
    if (box.min.y < 1.5) groundBounds.union(box);
  });
  const roadCoords = [-36, -27, -18, -12, -6, 0, 6, 12, 18, 27, 36];
  const roadHalfWidth = (position: number) => position === 0 ? 1.2 : (Math.abs(position) === 6 || Math.abs(position) === 12 ? 0.75 : 0.5);
  roadCoords.forEach((position) => {
    const halfWidth = roadHalfWidth(position);
    assert.ok(groundBounds.max.x <= position - halfWidth || groundBounds.min.x >= position + halfWidth, `tavern mesh stays clear of x=${position} road`);
    assert.ok(groundBounds.max.z <= position - halfWidth || groundBounds.min.z >= position + halfWidth, `tavern mesh stays clear of z=${position} road`);
  });

  // Neighbours keep their clearance: the sign and barrels may not crowd the
  // fried-chicken shop to the west any closer than the old tavern did.
  const friedChicken = BUILDING_DEFS.find((building) => building.id === 'fried_chicken_shop');
  assert.ok(friedChicken);
  assert.ok(groundBounds.min.x - friedChicken.x > 2.5, 'tavern stays clear of the fried-chicken shop');

  let tagged = 0;
  entity.group.traverse((child) => {
    if ((child as THREE.Mesh).isMesh && child.userData.buildingId === 'tavern') tagged += 1;
  });
  assert.ok(tagged > 10, 'the mesh parts stay tagged for raycasting');
});
