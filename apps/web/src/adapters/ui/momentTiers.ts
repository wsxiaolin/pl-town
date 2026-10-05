// Pure tier-ladder logic for the moment splash — kept free of asset imports
// (and of the DOM) so node:test can pin the invariants directly. The view
// (momentSplashView) owns the layers; this module owns the decisions.

/** Layer element ids, coarsest → sharpest (index = level - 1). */
export const MOMENT_LAYER_IDS = [
  'bootMomentStep1',
  'bootMomentStep2',
  'bootMomentImg',
] as const;

export type TierDecision = 'reveal' | 'retire' | 'keep';

/**
 * Reveal decision for one tier of the three-sharpness ladder:
 * - decodeOk && level > shown  → 'reveal': this tier takes the screen
 * - decodeOk && level < shown  → 'retire':  a sharper tier already owns the
 *   screen; this layer must not contribute pixels underneath
 * - decodeOk && level = shown  → 'keep':    this tier IS what is showing —
 *   a re-delivered decode must never retire the screen's own layer
 * - !decodeOk                  → 'keep':    leave everything as-is; coarser
 *   layers stay as the on-screen fallback, a hidden layer stays hidden
 */
export function tierDecision(level: number, decodeOk: boolean, shownLevel: number): TierDecision {
  if (!decodeOk) return 'keep';
  if (level > shownLevel) return 'reveal';
  if (level < shownLevel) return 'retire';
  return 'keep';
}

/**
 * Per-layer screen state, coarsest → sharpest (index = level - 1):
 * - 'hidden'  never revealed (opacity 0, no classes)
 * - 'front'   the tier currently owning the screen
 * - 'retired' out of the animation/compositing game (see writeLayerStates:
 *   drift stops immediately, visibility drops after the crossfade window)
 */
export type LayerState = 'hidden' | 'front' | 'retired';

/**
 * Fold ONE decode completion into the ladder's layer states. Pure: the view
 * derives the states from the DOM, folds the event here, and writes the
 * classes back — so every rule below is unit-pinned, not view-implicit.
 *
 * - decode failure → unchanged (coarser tiers remain the on-screen fallback;
 *   in the view this is the decode() `.catch` path, which never calls this)
 * - reveals (level above everything showing) → this layer becomes 'front'
 *   AND every coarser 'front' layer is retired. Retiring on reveal — not
 *   only on late arrival — is what keeps the NORMAL in-order climb from
 *   compositing and drifting three fullscreen blurred layers for the whole
 *   heavy splash (review #201 B1: the old per-layer decision never fired a
 *   retire in that order).
 * - late arrival (a sharper tier already won) → this layer retires quietly
 * - re-delivery of the tier already front → unchanged
 * - out-of-range level → unchanged (defensive; callers index MOMENT_LAYER_IDS)
 */
export function applyDecodeEvent(
  states: readonly LayerState[],
  level: number,
  decodeOk: boolean,
): readonly LayerState[] {
  if (!decodeOk) return states;
  const index = level - 1;
  if (index < 0 || index >= states.length) return states;
  const highestFront = states.reduce(
    (max, state, i) => (state === 'front' ? i + 1 : max),
    0,
  );
  const decision = tierDecision(level, true, highestFront);
  if (decision === 'reveal') {
    return states.map((state, i) => {
      if (i === index) return 'front';
      // Retire coarser tiers that are still showing; 'hidden' coarser tiers
      // stay hidden (retiring them would be a no-op class flip).
      if (i < index && state === 'front') return 'retired';
      return state;
    });
  }
  if (decision === 'retire') {
    return states.map((state, i) => (i === index ? 'retired' : state));
  }
  return states;
}
