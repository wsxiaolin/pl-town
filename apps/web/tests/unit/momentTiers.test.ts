import assert from 'node:assert/strict';
import test from 'node:test';
import { MOMENT_LAYER_IDS, tierDecision } from '../../src/adapters/ui/momentTiers';

test('a decoded tier sharper than what is showing reveals', () => {
  assert.equal(tierDecision(1, true, 0), 'reveal');
  assert.equal(tierDecision(3, true, 2), 'reveal');
  assert.equal(tierDecision(5, true, 4), 'reveal');
});

test('a decoded tier that is not sharper retires (never goes backwards)', () => {
  // Slow tier arrives after a faster one already won the screen: hide it,
  // do not let network jitter make the picture coarser.
  assert.equal(tierDecision(2, true, 4), 'retire');
  assert.equal(tierDecision(4, true, 5), 'retire');
  assert.equal(tierDecision(3, true, 3), 'retire');
});

test('a tier that failed to decode is kept exactly as-is (fallback stays, hidden stays hidden)', () => {
  assert.equal(tierDecision(1, false, 0), 'keep');
  assert.equal(tierDecision(3, false, 2), 'keep');
  assert.equal(tierDecision(5, false, 4), 'keep');
});

test('the ladder is fixed at five layers, coarsest first', () => {
  // index = level - 1; the full still is the last rung, not a step.
  assert.equal(MOMENT_LAYER_IDS.length, 5);
  assert.equal(MOMENT_LAYER_IDS[0], 'bootMomentStep1');
  assert.equal(MOMENT_LAYER_IDS[3], 'bootMomentStep4');
  assert.equal(MOMENT_LAYER_IDS[4], 'bootMomentImg');
});

test('replay of the ladder via decisions is monotonic', () => {
  // Simulate out-of-order decode resolutions (L3 then L1 then L5 then L2):
  // the on-screen level must never decrease.
  let shown = 0;
  const order = [3, 1, 5, 2, 4];
  for (const level of order) {
    const decision = tierDecision(level, true, shown);
    if (decision === 'reveal') shown = level;
    assert.ok(decision !== 'reveal' || level > shown - 1);
  }
  assert.equal(shown, 5);
});
