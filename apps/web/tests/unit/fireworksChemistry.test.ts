import assert from 'node:assert/strict';
import test from 'node:test';
import { defaultFireworkDesign, normalizeFireworkDesign } from '../../src/city/fireworks/fireworksDesign';
import {
  chemistryEffect,
  chemistryReport,
  normalizeCraft,
  recommendedMortarBore,
} from '../../src/city/fireworks/fireworksChemistry';

test('default craft is a readable, warning-free reference recipe', () => {
  const design = defaultFireworkDesign();
  const report = chemistryReport({ ...design, ...design.craft });
  const total = report.starRecipe.reduce((sum, line) => sum + line.percent, 0);
  assert.ok(Math.abs(total - 100) < 0.2, `star recipe should sum to 100%, got ${total}`);
  assert.equal(report.warnings.length, 0);
  assert.ok(report.starMassG > 0);
  assert.ok(report.shopping.some((line) => line.name === '硝酸钾'));
  assert.ok(report.shopping.some((line) => line.name === '纸球壳'));
  assert.ok(report.installation.boreMm >= design.caliber + 2);
  assert.equal(report.installation.steps.length, 5);
});

test('additives and casings change the physical effect without changing the contract', () => {
  const design = defaultFireworkDesign();
  const plain = chemistryEffect(design.craft);
  const titanium = chemistryEffect({ ...design.craft, additive: 'titanium', additivePercent: 10 });
  const canister = chemistryEffect({ ...design.craft, casing: 'paper-canister' });
  const multi = chemistryEffect({ ...design.craft, casing: 'multi-break' });
  assert.ok(titanium.crackle > plain.crackle);
  assert.equal(canister.burstShape, 'canister');
  assert.equal(multi.secondaryDelay > 0, true);
  assert.ok(multi.burstRadiusScale < plain.burstRadiusScale);
});

test('craft normalization fills defaults and clamps legacy v2 designs', () => {
  const design = defaultFireworkDesign();
  const legacy = normalizeFireworkDesign({ ...design, craft: undefined });
  assert.ok(legacy);
  assert.equal(legacy.craft.formula, 'kp-gold');
  assert.equal(legacy.craft.mortarBore, recommendedMortarBore(design.caliber));

  const clamped = normalizeCraft({ formula: 'bogus', additivePercent: 99, mortarBore: 1, fuseOffset: 5 }, 150);
  assert.equal(clamped.formula, 'kp-gold');
  assert.equal(clamped.additivePercent, 15);
  assert.equal(clamped.mortarBore, 52);
  assert.equal(clamped.fuseOffset, 0.8);
});
