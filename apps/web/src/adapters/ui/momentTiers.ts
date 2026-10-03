// Pure tier-ladder logic for the moment splash — kept free of asset imports
// (and of the DOM) so node:test can pin the invariants directly. The view
// (momentSplashView) owns the layers; this module owns the decisions.

/** Layer element ids, coarsest → sharpest (index = level - 1). */
export const MOMENT_LAYER_IDS = [
  'bootMomentStep1',
  'bootMomentStep2',
  'bootMomentStep3',
  'bootMomentStep4',
  'bootMomentImg',
] as const;

export type TierDecision = 'reveal' | 'retire' | 'keep';

/**
 * Reveal decision for one tier of the five-sharpness ladder:
 * - decodeOk && level > shown  → 'reveal': this tier takes the screen
 * - decodeOk && level ≤ shown  → 'retire':  a sharper tier already won; hide
 *   this layer (stops compositing/drifting under the winner)
 * - !decodeOk                   → 'keep':    leave as-is; coarser layers stay
 *   as the on-screen fallback, a hidden layer stays hidden
 */
export function tierDecision(level: number, decodeOk: boolean, shownLevel: number): TierDecision {
  if (!decodeOk) return 'keep';
  return level > shownLevel ? 'reveal' : 'retire';
}
