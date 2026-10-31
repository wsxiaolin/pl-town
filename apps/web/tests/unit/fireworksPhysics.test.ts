import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildBurstSeeds,
  decodePatternCells,
  defaultFireworkDesign,
  emptyGrid,
  encodePatternCells,
  normalizeFireworkDesign,
  recommendedBreakCharge,
  recommendedLiftCharge,
  seedBurstMath,
  validateFireworkDesign,
} from '../../src/city/fireworks/fireworksDesign';
import {
  burstRadius,
  craftReport,
  planShell,
  sampleStar,
  shellPosition,
} from '../../src/city/fireworks/fireworksPhysics';

test('recommended charges scale with caliber and the default design reaches its target', () => {
  assert.equal(recommendedLiftCharge(50), 10);
  assert.equal(recommendedBreakCharge(50), 5);
  assert.equal(recommendedLiftCharge(150), 68);
  assert.equal(recommendedBreakCharge(150), 29);
  assert.ok(recommendedLiftCharge(200) > recommendedLiftCharge(150));
  assert.ok(recommendedBreakCharge(200) > recommendedBreakCharge(150));

  const design = defaultFireworkDesign();
  const plan = planShell(design);
  assert.equal(plan.reachable, true);
  assert.ok(Math.abs(plan.burstHeight - design.height) < 0.01);
  assert.ok(plan.fuseTime > 2 && plan.fuseTime < 5);
  const report = craftReport(design);
  assert.deepEqual(report.warnings, []);
  assert.ok(report.radius > 5 && report.radius < 10);

  const minimumCaliber = {
    ...design,
    caliber: 50,
    liftCharge: recommendedLiftCharge(50),
    breakCharge: recommendedBreakCharge(50),
  };
  assert.equal(validateFireworkDesign(minimumCaliber), null);
});

test('launch angle lowers vertical reach and heading rotates horizontal velocity', () => {
  const base = defaultFireworkDesign();
  const vertical = planShell({ ...base, launchAngle: 0 });
  const angledX = planShell({ ...base, launchAngle: 18 }, 0);
  const angledZ = planShell({ ...base, launchAngle: 18 }, Math.PI / 2);

  assert.ok(angledX.apexHeight < vertical.apexHeight);
  assert.ok(angledX.vx > 0);
  assert.ok(Math.abs(angledX.vz) < 1e-10);
  assert.ok(Math.abs(angledZ.vx) < 1e-10);
  assert.ok(angledZ.vz > 0);
  assert.ok(Math.abs(angledX.apexHeight - angledZ.apexHeight) < 1e-10);

  const muzzleY = 1.56;
  const fromMortar = planShell(base, 0, muzzleY);
  assert.equal(shellPosition(fromMortar, { x: 4, z: 7 }, 0).y, muzzleY);
});

test('undercharge caps the burst height and surfaces a craft warning', () => {
  const design = { ...defaultFireworkDesign(), height: 86, liftCharge: 20 };
  const plan = planShell(design);
  assert.equal(plan.reachable, false);
  assert.ok(plan.burstHeight < design.height);
  assert.ok(plan.fuseTime > 0);
  const report = craftReport(design);
  assert.ok(report.warnings.some((warning) => warning.includes('装药不足')));
});

test('burst radius grows with caliber and break charge', () => {
  const base = defaultFireworkDesign();
  const small = burstRadius({ ...base, caliber: 75, breakCharge: 10 });
  const largeCaliber = burstRadius({ ...base, caliber: 250, breakCharge: recommendedBreakCharge(250) });
  const largeCharge = burstRadius({ ...base, breakCharge: 120 });
  assert.ok(small < burstRadius(base));
  assert.ok(burstRadius(base) < largeCaliber);
  assert.ok(burstRadius(base) < largeCharge);
});

test('stars are deterministic under a fixed seed and burn out at the end of life', () => {
  const design = defaultFireworkDesign();
  const radius = burstRadius(design);
  seedBurstMath(20261007);
  const first = buildBurstSeeds(design, radius);
  seedBurstMath(20261007);
  const second = buildBurstSeeds(design, radius);
  assert.equal(first.length, second.length);
  assert.deepEqual(first[0], second[0]);

  const seed = first[0]!;
  const early = sampleStar(seed, 0.2, 0.2);
  const late = sampleStar(seed, seed.life + 0.1, seed.life + 0.1);
  assert.equal(early.alive, true);
  assert.equal(late.alive, false);
  assert.ok(Math.hypot(early.x, early.y, early.z) > 0);
});

test('crossette parents split into four independently moving child stars', () => {
  const design = { ...defaultFireworkDesign(), shape: 'crossette' as const, starCount: 120 };
  seedBurstMath(20261007);
  const seeds = buildBurstSeeds(design, burstRadius(design));
  assert.equal(seeds.length, 120);

  const family = seeds.slice(0, 4);
  assert.deepEqual(family.map((seed) => seed.splitChild), [0, 1, 2, 3]);
  assert.ok(family.every((seed) => seed.vx === family[0]!.vx && seed.vy === family[0]!.vy && seed.vz === family[0]!.vz));
  const splitTime = family[0]!.life * family[0]!.splitAt!;
  assert.equal(family.filter((seed) => sampleStar(seed, splitTime * 0.5, 0).alive).length, 1);
  const children = family.map((seed) => sampleStar(seed, splitTime + 0.2, splitTime + 0.2));
  assert.equal(children.filter((sample) => sample.alive && sample.child).length, 4);
  assert.equal(new Set(children.map((sample) => `${sample.x.toFixed(4)},${sample.y.toFixed(4)},${sample.z.toFixed(4)}`)).size, 4);
});

test('v1 designs preserve burst radius while invalid v2 fields are rejected', () => {
  for (const size of [60, 120, 160]) {
    const upgraded = normalizeFireworkDesign({
      v: 1,
      height: 55,
      shape: 'willow',
      colors: { primary: '#ffd76e', secondary: '#ff5f8a', trail: '#ffe9b0' },
      size,
      sparkle: 40,
    });
    assert.ok(upgraded);
    assert.equal(upgraded.v, 2);
    assert.equal(upgraded.caliber, 150);
    assert.equal(upgraded.liftCharge, recommendedLiftCharge(150));
    assert.ok(Math.abs(burstRadius(upgraded) - 7 * size / 100) < 0.12);
  }

  const design = defaultFireworkDesign();
  assert.equal(normalizeFireworkDesign(design)?.v, 2);
  assert.equal(normalizeFireworkDesign({ ...design, trail: 'spark' }), null);
  assert.equal(normalizeFireworkDesign({ ...design, caliber: 10 }), null);
  assert.equal(normalizeFireworkDesign({ ...design, starCount: 5000 }), null);
  assert.equal(validateFireworkDesign(design), null);
  assert.ok(validateFireworkDesign({ ...design, burnTime: 99 }));
});

test('pattern cells round-trip through the shared base64 encoding', () => {
  const grid = emptyGrid();
  grid[0] = true;
  grid[10] = true;
  grid[grid.length - 1] = true;
  grid[5 * 21 + 7] = true;
  const cells = encodePatternCells(grid);
  const decoded = decodePatternCells({ cols: 21, rows: 21, cells });
  assert.deepEqual(decoded, grid);
});
