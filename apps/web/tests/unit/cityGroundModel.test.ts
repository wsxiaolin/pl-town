import assert from 'node:assert/strict';
import test from 'node:test';
import * as THREE from 'three';
import { CITY_GROUND_PLAN } from '../../src/city/data/terrain/_cityGround';
import { SURFACE_Y } from '../../src/rendering/layers';
import { createGroundReliefGeometry, createPlazaPavingGeometry } from '../../src/rendering/cityGroundModel';

test('city ground relief is low-poly and stable for a fixed seed', () => {
  const first = createGroundReliefGeometry(CITY_GROUND_PLAN.relief, SURFACE_Y.district);
  const second = createGroundReliefGeometry(CITY_GROUND_PLAN.relief, SURFACE_Y.district);
  const alternate = createGroundReliefGeometry(
    { ...CITY_GROUND_PLAN.relief, seed: CITY_GROUND_PLAN.relief.seed + 1 },
    SURFACE_Y.district,
  );
  const positions = first.getAttribute('position');
  const secondPositions = second.getAttribute('position');
  const heights = Array.from({ length: positions.count }, (_, index) => positions.getY(index));

  assert.deepEqual(Array.from(positions.array), Array.from(secondPositions.array));
  assert.notDeepEqual(Array.from(positions.array), Array.from(alternate.getAttribute('position').array));
  assert.equal(first.index?.count, CITY_GROUND_PLAN.relief.segments ** 2 * 6);
  assert.ok(Math.min(...heights) >= SURFACE_Y.district - CITY_GROUND_PLAN.relief.amplitude);
  assert.ok(Math.max(...heights) <= SURFACE_Y.district + CITY_GROUND_PLAN.relief.amplitude);
  assert.ok(new Set(heights).size > 20, 'relief should not collapse to a flat plane');

  first.dispose();
  second.dispose();
  alternate.dispose();
});

test('plaza pavers are repeatable and leave road, fountain, and lawn clearances', () => {
  const config = CITY_GROUND_PLAN.paving;
  const first = createPlazaPavingGeometry(config, SURFACE_Y.plaza);
  const second = createPlazaPavingGeometry(config, SURFACE_Y.plaza);
  const positions = first.getAttribute('position');
  const secondPositions = second.getAttribute('position');
  const heights = Array.from({ length: positions.count }, (_, index) => positions.getY(index));
  const bounds = new THREE.Box3().setFromBufferAttribute(positions as THREE.BufferAttribute);

  assert.deepEqual(Array.from(positions.array), Array.from(secondPositions.array));
  assert.ok(positions.count > 10_000, 'paving should contain a detailed tile field');
  assert.ok(first.getAttribute('uv').count === positions.count);
  assert.ok(bounds.min.x >= config.x - config.width / 2 && bounds.max.x <= config.x + config.width / 2);
  assert.ok(bounds.min.z >= config.z - config.depth / 2 && bounds.max.z <= config.z + config.depth / 2);
  assert.ok(Math.min(...heights) >= SURFACE_Y.plaza - 1e-5);
  assert.ok(Math.max(...heights) <= SURFACE_Y.cityGroundDetail + 1e-5);

  for (let index = 0; index < positions.count; index += 1) {
    const x = positions.getX(index);
    const z = positions.getZ(index);
    assert.ok(Math.abs(x - config.x) >= 1.7 || Math.abs(z - config.z) >= 1.7, 'main road corridor must stay clear');
    assert.ok(Math.hypot(x - config.x, z - config.z) >= 3.2, 'central ring walk must stay clear');
    assert.ok(!config.exclusions.some((exclusion) => exclusion.kind === 'rect'
      && x > exclusion.minX && x < exclusion.maxX && z > exclusion.minZ && z < exclusion.maxZ));
  }

  first.dispose();
  second.dispose();
});
