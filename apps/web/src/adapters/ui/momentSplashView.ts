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
import dawnStep3Url from '../../assets/moments/dawn-step3.webp';
import dawnStep4Url from '../../assets/moments/dawn-step4.webp';
import noonUrl from '../../assets/moments/noon.webp';
import noonStep1Url from '../../assets/moments/noon-step1.webp';
import noonStep2Url from '../../assets/moments/noon-step2.webp';
import noonStep3Url from '../../assets/moments/noon-step3.webp';
import noonStep4Url from '../../assets/moments/noon-step4.webp';
import duskUrl from '../../assets/moments/dusk.webp';
import duskStep1Url from '../../assets/moments/dusk-step1.webp';
import duskStep2Url from '../../assets/moments/dusk-step2.webp';
import duskStep3Url from '../../assets/moments/dusk-step3.webp';
import duskStep4Url from '../../assets/moments/dusk-step4.webp';
import nightUrl from '../../assets/moments/night.webp';
import nightStep1Url from '../../assets/moments/night-step1.webp';
import nightStep2Url from '../../assets/moments/night-step2.webp';
import nightStep3Url from '../../assets/moments/night-step3.webp';
import nightStep4Url from '../../assets/moments/night-step4.webp';
import { momentForHour, type MomentName } from '../../core/momentClock';

type ViewMoment = { name: MomentName; caption: string; levels: readonly string[] };

const IMAGE_BY_NAME: Record<MomentName, readonly string[]> = {
  dawn: [dawnStep1Url, dawnStep2Url, dawnStep3Url, dawnStep4Url, dawnUrl],
  noon: [noonStep1Url, noonStep2Url, noonStep3Url, noonStep4Url, noonUrl],
  dusk: [duskStep1Url, duskStep2Url, duskStep3Url, duskStep4Url, duskUrl],
  night: [nightStep1Url, nightStep2Url, nightStep3Url, nightStep4Url, nightUrl],
};

/** Layer element ids, coarsest → sharpest (index = level - 1). */
const MOMENT_LAYER_IDS = [
  'bootMomentStep1',
  'bootMomentStep2',
  'bootMomentStep3',
  'bootMomentStep4',
  'bootMomentImg',
] as const;

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

// Highest tier currently on screen. Reveals are monotonic: a layer only ever
// fades in when it is sharper than whatever is already showing — a slow tier
// that arrives AFTER a faster one stays hidden underneath (network jitter
// must never make the picture go backwards).
let shownMomentLevel = 0;

function paintMoment(moment: ViewMoment): void {
  shownMomentLevel = 0;
  moment.levels.forEach((levelUrl, index) => {
    const layerId = MOMENT_LAYER_IDS[index];
    if (!layerId) return; // levels and layers are both fixed at five
    const layer = document.getElementById(layerId) as HTMLImageElement | null;
    if (!layer) return;
    const level = index + 1;
    if (layer.getAttribute('src') !== levelUrl) {
      layer.classList.remove('is-front');
      layer.src = levelUrl;
    }
    // decode() gates the fade so a tier never shows a half-decoded bitmap.
    // A tier that fails to decode is simply skipped — the coarser layers
    // underneath keep the screen from going bare.
    layer.decode()
      .then(() => { if (level > shownMomentLevel) { shownMomentLevel = level; layer.classList.add('is-front'); } })
      .catch(() => { /* coarser tiers remain as the fallback */ });
  });
  const caption = document.getElementById('bootMomentCaption');
  if (caption) {
    caption.textContent = moment.caption;
    caption.classList.add('is-visible');
  }
}

function showCurrentMoment(): void {
  paintMoment(viewMoment(new Date().getHours()));
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
    paintMoment(viewMoment(new Date().getHours()));
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
