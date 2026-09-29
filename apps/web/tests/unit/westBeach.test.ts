import assert from 'node:assert/strict';
import test from 'node:test';
import {
  WEST_BEACH,
  WEST_RING_ROAD_END_X,
  shorelineX,
  westBeachWaterlineMaxX,
} from '../../src/city/data/cityConfig';

// The shore-splash system's safety net: these tests lock the invariants the
// rendering code (westBeach.ts) relies on but cannot assert at runtime.

test('the coastline wobble stays inside the budget westBeachWaterlineMaxX allows', () => {
  // 1.2 is the sum of shorelineX's wobble amplitudes (0.85 + 0.35), checked
  // here independently: if the amplitudes are ever retuned without updating
  // westBeachWaterlineMaxX, the waterline budget silently lies.
  let landmost = -Infinity;
  for (let z = -112; z <= 112; z += 0.05) landmost = Math.max(landmost, shorelineX(z));
  const budget = WEST_BEACH.coastlineX + 1.2;
  assert.ok(
    landmost <= budget + 1e-9,
    `coastline reaches ${landmost.toFixed(3)}, past the ${budget} wobble budget westBeachWaterlineMaxX assumes`,
  );
});

test('the lapping waterline can never reach the west ring road', () => {
  const waterlineMax = westBeachWaterlineMaxX(WEST_BEACH.surfReach);
  assert.ok(
    waterlineMax < WEST_RING_ROAD_END_X,
    `furthest waterline ${waterlineMax.toFixed(3)} must stay west of the road end ${WEST_RING_ROAD_END_X}`,
  );
});

test('the swim pushback lands on dry sand, clear of both surf and road', () => {
  // safeReturnX is derived (WEST_BEACH getter); these bounds keep it honest:
  // landward of the furthest lapping waterline (dry feet) yet still seaward
  // of the west road arm (no teleport onto asphalt).
  assert.ok(
    WEST_BEACH.safeReturnX > westBeachWaterlineMaxX(),
    `safeReturnX ${WEST_BEACH.safeReturnX.toFixed(3)} must be landward of the furthest waterline ${westBeachWaterlineMaxX().toFixed(3)}`,
  );
  assert.ok(
    WEST_BEACH.safeReturnX < WEST_RING_ROAD_END_X,
    `safeReturnX ${WEST_BEACH.safeReturnX.toFixed(3)} must stay seaward of the road end ${WEST_RING_ROAD_END_X}`,
  );
});
