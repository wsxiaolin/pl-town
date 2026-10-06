// Moment splash view — the boot-screen presentation of the current day
// moment (drifting still + caption + skip). The pure moment mapping lives in
// core/momentClock.ts; this view only binds it to the boot DOM and the four
// stills.
//
// Light visit: the still shows with a slow drift, holds for a breath, then
// fades into the city or login. Heavy visit: the SAME current-moment still
// holds behind the download pipeline — the splash must match the clock
// outside, so there is no day-passing cycle; the progress bar carries time.

import dawnUrl from '../../assets/moments/dawn.webp';
import dawnStep1Url from '../../assets/moments/dawn-step1.webp';
import dawnStep2Url from '../../assets/moments/dawn-step2.webp';
import noonUrl from '../../assets/moments/noon.webp';
import noonStep1Url from '../../assets/moments/noon-step1.webp';
import noonStep2Url from '../../assets/moments/noon-step2.webp';
import duskUrl from '../../assets/moments/dusk.webp';
import duskStep1Url from '../../assets/moments/dusk-step1.webp';
import duskStep2Url from '../../assets/moments/dusk-step2.webp';
import nightUrl from '../../assets/moments/night.webp';
import nightStep1Url from '../../assets/moments/night-step1.webp';
import nightStep2Url from '../../assets/moments/night-step2.webp';
import { momentForHour, type MomentName } from '../../core/momentClock';
import { MOMENT_LAYER_IDS, applyDecodeEvent, type LayerState } from './momentTiers';

// The ladder length is pinned at the type level (S2): every moment feeds
// exactly three layers, so a short ladder that would silently drop the top or
// a long one that would never show cannot compile.
type ViewMoment = { name: MomentName; caption: string; levels: readonly [string, string, string] };

const IMAGE_BY_NAME: Record<MomentName, readonly [string, string, string]> = {
  dawn: [dawnStep1Url, dawnStep2Url, dawnUrl],
  noon: [noonStep1Url, noonStep2Url, noonUrl],
  dusk: [duskStep1Url, duskStep2Url, duskUrl],
  night: [nightStep1Url, nightStep2Url, nightUrl],
};

function viewMoment(hour: number): ViewMoment {
  const moment = momentForHour(hour);
  return { name: moment.name, caption: moment.caption, levels: IMAGE_BY_NAME[moment.name] };
}

// ─── boot screen gate state ──────────────────────────────────────────────────

const MIN_SPLASH_MS = 2_600; // Even a cached visit gets a breath of the still.
const MIN_SPLASH_REDUCED_MS = 1_200; // prefers-reduced-motion: shorter hold.
const REVEAL_CLEANUP_DELAY_MS = 2_200; // boot fade-out + margin before src drop.

let reducedMotion = false;

let cityReady = false;
let minimumElapsed = false;
let skipRequested = false;
let revealListeners: (() => void) | null = null;
let presentationStopped = false;

function bootScreen(): HTMLElement | null {
  return document.getElementById('bootScreen');
}

/** Splash behaviour knobs; call once before the first splash paints. */
export function configureMomentSplash(options: { reduced: boolean }): void {
  reducedMotion = options.reduced;
}

// Layer screen state, coarsest → sharpest (index = level - 1). The DOM
// classes are the visible truth; every decode completion reads them, folds
// the event through the pure applyDecodeEvent, and writes them back. This
// keeps the ladder monotonic (a slow tier arriving after a faster one stays
// under the winner) AND retires coarser layers the moment a sharper tier
// reveals (review #201 B1: the old code never retired in the normal in-order
// climb, so blurred fullscreen layers kept compositing and drifting for the
// whole heavy splash).
function readLayerStates(): LayerState[] {
  return MOMENT_LAYER_IDS.map((id) => {
    const layer = document.getElementById(id);
    // is-retired dominates: a retired-from-front layer keeps is-front (its
    // opacity crossfades under the incoming tier) but is out of the race.
    if (layer?.classList.contains('is-retired')) return 'retired';
    if (layer?.classList.contains('is-front')) return 'front';
    return 'hidden';
  });
}

// 'retired' only ADDS is-retired and deliberately leaves is-front as it was:
// a retiree that was front keeps its opacity so the incoming tier crossfades
// OVER it (no dark bleed while the winner is still fading in — the full
// still's fade is 1.6s); a retiree that was hidden stays hidden. CSS drops
// visibility (and with it compositing) 1.6s after the class flips, and
// freezes the drift at its current transform.
function writeLayerStates(states: readonly LayerState[]): void {
  MOMENT_LAYER_IDS.forEach((id, index) => {
    const layer = document.getElementById(id);
    if (!layer) return;
    const state = states[index];
    if (state === 'retired') {
      layer.classList.add('is-retired');
    } else {
      layer.classList.remove('is-retired');
      layer.classList.toggle('is-front', state === 'front');
    }
  });
}

// Bumped on every paintMoment: decode callbacks carry their paint's token,
// so a decode that resolves after a NEWER paint (e.g. splash → heavy repaint
// with a different moment) can never flip layers the newer paint owns.
let paintToken = 0;

// Direct = the full still only (the pre-ladder behaviour): the cached-visit
// path and the pre-decision first paint. Ladder = every tier in parallel with
// monotonic blur-to-sharp reveals: reserved for heavy boots, the only visits
// that actually have to download the stills (sin: 渐进式只服务于首次下载).
type PaintMode = 'direct' | 'ladder';

function paintMoment(moment: ViewMoment, mode: PaintMode): void {
  const token = ++paintToken;
  // Literal index (not length-1): the tuple type pins the full still at rung
  // 3, and a computed index would drag in noUncheckedIndexedAccess's
  // string | undefined.
  const fullUrl = moment.levels[2];
  const fullLayerId = MOMENT_LAYER_IDS[MOMENT_LAYER_IDS.length - 1];
  const fullLayer = fullLayerId
    ? (document.getElementById(fullLayerId) as HTMLImageElement | null)
    : null;
  const alreadySharp =
    mode === 'ladder' &&
    fullLayer?.classList.contains('is-front') === true &&
    fullLayer.getAttribute('src') === fullUrl;
  if (alreadySharp) {
    // Heavy repaint while the full still is ALREADY on screen (a cached
    // visit re-routed to heavy by a server-changed probe): the picture is
    // sharp, so keep it — re-running the ladder would only re-blur it.
    return;
  }
  // Direct paints touch ONLY the full layer (tier srcs stay unset — a cached
  // visit must not fire a single tier request); the ladder spreads every
  // level across its layer in parallel so total time ≈ the full still's own.
  const levelOffset = mode === 'direct' ? moment.levels.length - 1 : 0;
  const urls = mode === 'direct' ? [fullUrl] : moment.levels;
  urls.forEach((levelUrl, urlIndex) => {
    const index = levelOffset + urlIndex;
    const layerId = MOMENT_LAYER_IDS[index];
    if (!layerId) return;
    const layer = document.getElementById(layerId) as HTMLImageElement | null;
    if (!layer) return;
    const level = index + 1;
    if (layer.getAttribute('src') !== levelUrl) {
      layer.classList.remove('is-front', 'is-retired');
      layer.src = levelUrl;
    }
    // decode() gates the fade so a tier never shows a half-decoded bitmap.
    // Not every engine exposes decode() (Safari < 14); without it the tier
    // simply reveals on load-complete via the is-front swap below — the
    // worst case is one frame of browser-native progressive draw.
    const decoded = typeof layer.decode === 'function' ? layer.decode() : Promise.resolve();
    decoded
      .then(() => {
        if (token !== paintToken) return; // a newer paint owns the layers now
        // decodeOk=true here; the .catch path folds the same event as a
        // fallback reveal (see below).
        writeLayerStates(applyDecodeEvent(readLayerStates(), level, true));
      })
      .catch(() => {
        // Fallback reveal (#201 r2): a rejected decode() must not leave the
        // splash a silent #0b1018 slab for the whole boot — fold the event
        // anyway so the layer takes the screen with whatever the browser
        // can render (native progressive draw / partial bitmap / nothing,
        // which is never worse than staying hidden). decodeOk=false stays
        // the pure model's "leave as-is" contract, so this passes true.
        if (token !== paintToken) return;
        writeLayerStates(applyDecodeEvent(readLayerStates(), level, true));
      });
  });
  const caption = document.getElementById('bootMomentCaption');
  if (caption) {
    caption.textContent = moment.caption;
    caption.classList.add('is-visible');
  }
}

function showCurrentMoment(): void {
  paintMoment(viewMoment(new Date().getHours()), 'ladder');
}

function bindSkip(): void {
  const screen = bootScreen();
  if (!screen || screen.dataset.momentSkipBound) return;
  // Element-scoped flag instead of a module boolean: Vite HMR re-evaluates
  // this module but keeps the same DOM, so a module flag would stack
  // duplicate listeners across hot updates.
  screen.dataset.momentSkipBound = 'true';
  const skip = (): void => { skipRequested = true; notifyReveal(); };
  screen.addEventListener('pointerdown', skip, { capture: true });
  // Keyboard access goes through the sr-only #bootSkipButton (a real
  // <button>: native focus, Enter/Space semantics, announced by screen
  // readers) — the container itself stays a polite live region for boot
  // progress (review r7#5).
  document.getElementById('bootSkipButton')?.addEventListener('click', skip);
}

function notifyReveal(): void {
  revealListeners?.();
}

function checkReveal(): void {
  if (cityReady && (minimumElapsed || skipRequested)) notifyReveal();
}

/** Light visit: single still for the current hour, quiet caption, click skips. */
export function showMomentSplash(): void {
  const screen = bootScreen();
  if (screen) {
    screen.classList.add('is-moment', 'is-splash');
    // Direct paint: the splash lands before the boot decision is known, so
    // show the full still only — a cached visit gets it instantly and never
    // fires a tier request; a cold visit re-paints as a ladder the moment
    // heavy is confirmed (first-visit decisions need no network probe).
    paintMoment(viewMoment(new Date().getHours()), 'direct');
  }
  // Armed OUTSIDE the element guard: a missing #bootScreen must not leave
  // the reveal gate permanently sealed (review r3#10).
  scheduleMinimumElapsed();
  bindSkip();
}

/** Heavy visit: the current real-world moment holds behind the pipeline. */
export function showMomentHeavy(): void {
  const screen = bootScreen();
  if (!screen) return;
  // start() already showed the splash and scheduled the minimum-elapsed
  // timer before the mode was known; heavy only retargets the presentation —
  // no second timer, no visible swap (the still is the same current moment).
  screen.classList.remove('is-splash');
  screen.classList.add('is-moment', 'is-heavy');
  // Heavy = this visit must download resources, the ONLY mode that runs the
  // sharpness ladder: the inline coarsest tier lands a first frame at once,
  // then the picture climbs as sharper tiers decode.
  showCurrentMoment();
  bindSkip();
}

function scheduleMinimumElapsed(): void {
  window.setTimeout(notifyMinimumElapsed, reducedMotion ? MIN_SPLASH_REDUCED_MS : MIN_SPLASH_MS);
}

/**
 * Reveal completed (or the session tore down): the stills are hidden, so stop
 * their slow drift animations and drop the decoded bitmaps. Keeps GPU/CPU
 * memory from idling on an invisible 60fps transform for the whole session.
 */
function freezeMomentPresentation(): void {
  const layers = MOMENT_LAYER_IDS
    .map((id) => document.getElementById(id) as HTMLImageElement | null)
    .filter((layer): layer is HTMLImageElement => layer !== null);
  if (layers.length === 0) return;
  for (const layer of layers) layer.style.animation = 'none';
  // Clear only after the boot fade has fully finished — clearing earlier
  // would flash a blank frame during the fade-out.
  window.setTimeout(() => {
    for (const layer of layers) layer.removeAttribute('src');
  }, REVEAL_CLEANUP_DELAY_MS);
}

export function stopMomentPresentation(): void {
  // No re-boot path exists today (Vite HMR full-reloads the page). If one
  // ever appears, reset presentationStopped = false and resolve any pending
  // revealListeners here instead of dropping them.
  presentationStopped = true;
  freezeMomentPresentation();
  // The sr-only skip button is a sibling of #bootScreen, so hiding the screen
  // does not remove it from the tab order. Disable it so keyboard users don't
  // land on an invisible control for the rest of the session.
  const skipButton = document.getElementById('bootSkipButton') as HTMLButtonElement | null;
  if (skipButton) { skipButton.disabled = true; skipButton.hidden = true; }
  // Defensive reset so a same-document re-boot cannot inherit stale gate
  // flags. revealBound intentionally stays: the pointer listener must not
  // stack across re-binds.
  cityReady = false;
  minimumElapsed = false;
  skipRequested = false;
  revealListeners = null;
}

/**
 * Resolves once the boot screen may fade: the city must be ready AND the
 * moment must have been on screen long enough (or the visitor clicked).
 */
export function whenBootRevealAllowed(): Promise<void> {
  if (presentationStopped || !bootScreen()) return Promise.resolve();
  return new Promise((resolve) => {
    const done = () => {
      revealListeners = null;
      resolve();
    };
    revealListeners = done;
    checkReveal();
  });
}

/** Called when the scene is prepared and `minicity:city-ready` has fired. */
export function notifyCityReady(): void {
  cityReady = true;
  checkReveal();
}

/** Called once the minimum splash display time has elapsed. */
function notifyMinimumElapsed(): void {
  minimumElapsed = true;
  checkReveal();
}

/**
 * Last-resort reveal for a boot chain that rejected catastrophically: release
 * whatever is on screen with a retry hint instead of leaving the visitor
 * sealed behind a frozen splash. Completion markers stay untouched — the next
 * visit retries the pipeline.
 */
export function forceRevealBootScreen(message: string): void {
  // The pipeline bar is display:none until is-active — show it so the
  // failure message lands somewhere VISIBLE on both paths (review r8#2:
  // a bare canvas with no message defeats the fallback's purpose).
  document.getElementById('bootPipeline')?.classList.add('is-active');
  const detail = document.getElementById('bootPipelineDetail');
  if (detail) detail.textContent = message;
  // Release the splash gate + stop the drift animation, or the reveal never
  // fires and the 26s transform keeps running behind the hidden screen.
  presentationStopped = true;
  freezeMomentPresentation();
  cityReady = true;
  notifyReveal();
  bootScreen()?.classList.add('is-ready');
}
