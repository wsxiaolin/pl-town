import assert from 'node:assert/strict';
import test from 'node:test';
import { MOMENT_LAYER_IDS, applyDecodeEvent, tierDecision, type LayerState } from '../../src/adapters/ui/momentTiers';

test('a decoded tier sharper than what is showing reveals', () => {
  assert.equal(tierDecision(1, true, 0), 'reveal');
  assert.equal(tierDecision(2, true, 1), 'reveal');
  assert.equal(tierDecision(3, true, 2), 'reveal');
});

test('a decoded tier that is not sharper retires (never goes backwards)', () => {
  // Slow tier arrives after a faster one already won the screen: hide it,
  // do not let network jitter make the picture coarser.
  assert.equal(tierDecision(1, true, 2), 'retire');
  assert.equal(tierDecision(2, true, 3), 'retire');
});

test('a re-delivered decode of the tier already showing keeps it on screen', () => {
  // level === shown means THIS tier is the front layer — retiring it would
  // blank the screen the decode event just confirmed.
  assert.equal(tierDecision(1, true, 1), 'keep');
  assert.equal(tierDecision(3, true, 3), 'keep');
});

test('a tier that failed to decode is kept exactly as-is (fallback stays, hidden stays hidden)', () => {
  assert.equal(tierDecision(1, false, 0), 'keep');
  assert.equal(tierDecision(2, false, 1), 'keep');
  assert.equal(tierDecision(3, false, 2), 'keep');
});

test('the ladder is fixed at three layers, coarsest first', () => {
  // index = level - 1; the full still is the last rung, not a step.
  assert.equal(MOMENT_LAYER_IDS.length, 3);
  assert.equal(MOMENT_LAYER_IDS[0], 'bootMomentStep1');
  assert.equal(MOMENT_LAYER_IDS[1], 'bootMomentStep2');
  assert.equal(MOMENT_LAYER_IDS[2], 'bootMomentImg');
});

// ─── applyDecodeEvent: the whole-ladder fold (review #201 B1) ───────────────
// The old per-layer decision never retired anything in the NORMAL arrival
// order — the exact order real visitors hit — so three blurred fullscreen
// layers kept compositing for the whole heavy splash. The fold pins the
// terminal layer states, which is what the screen actually shows.

test('in-order ladder: each reveal retires the coarser tiers (B1)', () => {
  let states: readonly LayerState[] = ['hidden', 'hidden', 'hidden'];
  states = applyDecodeEvent(states, 1, true);
  assert.deepEqual(states, ['front', 'hidden', 'hidden']);
  states = applyDecodeEvent(states, 2, true);
  assert.deepEqual(states, ['retired', 'front', 'hidden']);
  states = applyDecodeEvent(states, 3, true);
  assert.deepEqual(states, ['retired', 'retired', 'front']);
});

test('out-of-order decode: late coarser tier retires itself, screen never goes backwards', () => {
  let states: readonly LayerState[] = ['hidden', 'hidden', 'hidden'];
  // L2 wins the screen first, slow L1 lands after it, L3 settles last.
  states = applyDecodeEvent(states, 2, true);
  assert.deepEqual(states, ['hidden', 'front', 'hidden']);
  states = applyDecodeEvent(states, 1, true);
  assert.deepEqual(states, ['retired', 'front', 'hidden']);
  states = applyDecodeEvent(states, 3, true);
  assert.deepEqual(states, ['retired', 'retired', 'front']);
});

test('decode failure leaves every layer exactly as-is', () => {
  const states: readonly LayerState[] = ['front', 'hidden', 'hidden'];
  assert.deepEqual(applyDecodeEvent(states, 2, false), states);
  assert.deepEqual(applyDecodeEvent(states, 3, false), states);
});

test('a duplicate decode of the tier already front does not retire it', () => {
  assert.deepEqual(
    applyDecodeEvent(['front', 'hidden', 'hidden'], 1, true),
    ['front', 'hidden', 'hidden'],
  );
});

test('out-of-range levels are ignored (defensive)', () => {
  const states: readonly LayerState[] = ['front', 'hidden', 'hidden'];
  assert.deepEqual(applyDecodeEvent(states, 0, true), states);
  assert.deepEqual(applyDecodeEvent(states, 4, true), states);
});

test('replaying the ladder via events is monotonic across arrival orders', () => {
  for (const order of [[1, 2, 3], [2, 1, 3], [3, 2, 1], [1, 3, 2]]) {
    let states: readonly LayerState[] = ['hidden', 'hidden', 'hidden'];
    for (const level of order) states = applyDecodeEvent(states, level, true);
    // Whatever the network order, the ladder settles on the sharpest tier
    // alone — the invariant the B1 fix exists to guarantee.
    assert.deepEqual(states, ['retired', 'retired', 'front']);
  }
});
