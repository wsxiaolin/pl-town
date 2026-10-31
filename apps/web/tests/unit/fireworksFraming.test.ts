import assert from 'node:assert/strict';
import test from 'node:test';
import { CAMERA_OFFSET } from '../../src/city/data/cityConfig';
import { terrainHeight } from '../../src/city/data/terrain/heightfield/terrainHeight';
import {
  burstRadius,
  planShell,
  shellPosition,
  BASE_BURST_RADIUS,
} from '../../src/city/fireworks/fireworksPhysics';
import { defaultFireworkDesign, type FireworkDesign } from '../../src/city/fireworks/fireworksDesign';
import { buildFireworkMortars, FIREWORK_BARGES } from '../../src/city/fireworks/fireworksMortars';
import { frameShowAct, planShowOrigins, SHOW_TARGET_Y_JITTER } from '../../src/city/fireworks/showFraming';

/** 把世界点投到「固定偏移正交相机」的归一化屏幕坐标（与 scene 一致）。 */
function projector(targetX: number, targetZ: number, zoom: number, aspect: number) {
  const offset = CAMERA_OFFSET;
  const forward = normalize({ x: -offset.x, y: -offset.y, z: -offset.z });
  const right = normalize(cross(forward, { x: 0, y: 1, z: 0 }));
  const up = cross(right, forward);
  // cameraController 每帧把 target.y 归到地形高度，这里必须复算同一高度。
  const ground = terrainHeight(targetX, targetZ);
  const camera = { x: targetX + offset.x, y: ground + offset.y, z: targetZ + offset.z };
  return (x: number, y: number, z: number): { x: number; y: number } => {
    const rel = { x: x - camera.x, y: y - camera.y, z: z - camera.z };
    return { x: dot(rel, right) / zoom / aspect, y: dot(rel, up) / zoom };
  };
}

const dot = (a: { x: number; y: number; z: number }, b: typeof a): number => a.x * b.x + a.y * b.y + a.z * b.z;
const cross = (a: { x: number; y: number; z: number }, b: typeof a) => ({
  x: a.y * b.z - a.z * b.y,
  y: a.z * b.x - a.x * b.z,
  z: a.x * b.y - a.y * b.x,
});
function normalize(a: { x: number; y: number; z: number }) {
  const length = Math.hypot(a.x, a.y, a.z) || 1;
  return { x: a.x / length, y: a.y / length, z: a.z / length };
}

function screenBounds(designs: FireworkDesign[], aspect: number) {
  const framing = frameShowAct(designs, 3, aspect);
  const project = projector(framing.targetX, framing.targetZ, framing.zoom, aspect);
  let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
  const add = (x: number, y: number, z: number) => {
    const p = project(x, y, z);
    x0 = Math.min(x0, p.x); x1 = Math.max(x1, p.x);
    y0 = Math.min(y0, p.y); y1 = Math.max(y1, p.y);
  };
  framing.origins.forEach((origin, index) => {
    add(origin.mortar.x, origin.mortar.y - 1.1, origin.mortar.z);
    add(origin.mortar.x, origin.mortar.y + 2.6, origin.mortar.z);
    const radius = Math.max(BASE_BURST_RADIUS * 0.6, burstRadius(designs[index]!));
    const burst = shellPosition(origin.plan, origin.mortar, origin.plan.fuseTime);
    for (const [ax, ay, az] of [[0, 0, 0], [1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]] as const) {
      add(burst.x + ax * radius, burst.y + ay * radius, burst.z + az * radius);
    }
  });
  return { framing, x0, x1, y0, y1 };
}

test('mortar table matches the three barges and stays inside the launch zone', () => {
  const mortars = buildFireworkMortars();
  assert.equal(FIREWORK_BARGES.length, 3);
  assert.equal(mortars.length, FIREWORK_BARGES.length * 3);
  for (const mortar of mortars) {
    assert.ok(mortar.x > -70 && mortar.x < -48, `mortar x ${mortar.x} outside launch water`);
    assert.ok(mortar.z > -26 && mortar.z < 0, `mortar z ${mortar.z} outside launch water`);
    assert.ok(mortar.y > 1 && mortar.y < 2);
    assert.ok(Number.isFinite(mortar.heading));
  }
  // 炮口互不重合（同幕多支烟花需要各自的升空点）。
  const keys = new Set(mortars.map((mortar) => `${mortar.x.toFixed(2)}:${mortar.z.toFixed(2)}`));
  assert.equal(keys.size, mortars.length);
});

test('show origins pick distinct mortars and honour the reported burst height', () => {
  const designs = [
    defaultFireworkDesign(),
    { ...defaultFireworkDesign(), height: 90, launchAngle: 18 },
    { ...defaultFireworkDesign(), height: 24 },
  ];
  const origins = planShowOrigins(designs, 5);
  assert.equal(origins.length, 3);
  const mortarKeys = new Set(origins.map((origin) => `${origin.mortar.x.toFixed(2)}:${origin.mortar.z.toFixed(2)}`));
  assert.equal(mortarKeys.size, 3, 'each act member should launch from a different tube');
  origins.forEach((origin, index) => {
    const design = designs[index]!;
    const target = Math.min(90, design.height + SHOW_TARGET_Y_JITTER);
    // 大发射角会把竖直初速分走（vy = v0·cosθ），目标高度可能不可达；
    // 不可达时开爆发生在最高点，取景仍必须按真实开爆点计算。
    if (origin.plan.reachable) {
      assert.ok(Math.abs(origin.plan.burstHeight - target) < 0.01, `burst height ${origin.plan.burstHeight} != ${target}`);
    } else {
      assert.ok(Math.abs(origin.plan.burstHeight - origin.plan.apexHeight) < 0.01);
      assert.ok(origin.plan.burstHeight < target);
    }
    // 引擎实际在炮口点火，因此开爆点必须由该炮口推导。
    const burst = shellPosition(origin.plan, origin.mortar, origin.plan.fuseTime);
    assert.ok(Math.abs(burst.y - origin.plan.burstHeight) < 0.01);
  });
});

test('framing keeps typical and extreme designs inside the viewport', () => {
  const cases: Array<[string, FireworkDesign[]]> = [
    ['default', [defaultFireworkDesign()]],
    ['trio', [
      defaultFireworkDesign(),
      { ...defaultFireworkDesign(), height: 40 },
      { ...defaultFireworkDesign(), height: 70 },
    ]],
    ['extreme', [{ ...defaultFireworkDesign(), height: 90, launchAngle: 18, caliber: 300, breakCharge: 200 }]],
    ['mixed', [
      { ...defaultFireworkDesign(), height: 24 },
      { ...defaultFireworkDesign(), height: 90, launchAngle: 18 },
    ]],
  ];
  for (const [label, designs] of cases) {
    for (const aspect of [0.46, 1.0, 1.78]) {
      const bounds = screenBounds(designs, aspect);
      assert.ok(bounds.x0 >= -1.001 && bounds.x1 <= 1.001, `${label} a=${aspect} clipped horizontally: ${bounds.x0}..${bounds.x1}`);
      // 下沿要给屏底 HUD 留位（BOTTOM_RESERVE = 0.24 NDC），上沿不得出画。
      assert.ok(bounds.y0 >= -1 + 0.24 - 0.001, `${label} a=${aspect} hidden behind HUD: ${bounds.y0}`);
      assert.ok(bounds.y1 <= 1.001, `${label} a=${aspect} clipped vertically: ${bounds.y1}`);
      assert.ok(bounds.framing.zoom > 0 && Number.isFinite(bounds.framing.zoom));
    }
  }
});

test('framing is deterministic for the same act seed and viewport', () => {
  const designs = [defaultFireworkDesign(), { ...defaultFireworkDesign(), height: 66 }];
  const first = frameShowAct(designs, 11, 1.6);
  const second = frameShowAct(designs, 11, 1.6);
  assert.deepEqual(first, second);
  // 不同 seed 会换一批炮口，因此取景不应完全一致。
  const other = frameShowAct(designs, 12, 1.6);
  assert.notEqual(`${first.targetX}:${first.zoom}`, `${other.targetX}:${other.zoom}`);
});
