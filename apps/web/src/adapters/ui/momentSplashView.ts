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
import dawnPreviewUrl from '../../assets/moments/dawn-preview.webp';
import noonUrl from '../../assets/moments/noon.webp';
import noonPreviewUrl from '../../assets/moments/noon-preview.webp';
import duskUrl from '../../assets/moments/dusk.webp';
import duskPreviewUrl from '../../assets/moments/dusk-preview.webp';
import nightUrl from '../../assets/moments/night.webp';
import nightPreviewUrl from '../../assets/moments/night-preview.webp';
import { momentForHour, type MomentName } from '../../core/momentClock';

type ViewMoment = { name: MomentName; caption: string; url: string; previewUrl: string };

const IMAGE_BY_NAME: Record<MomentName, { url: string; previewUrl: string }> = {
  dawn: { url: dawnUrl, previewUrl: dawnPreviewUrl },
  noon: { url: noonUrl, previewUrl: noonPreviewUrl },
  dusk: { url: duskUrl, previewUrl: duskPreviewUrl },
  night: { url: nightUrl, previewUrl: nightPreviewUrl },
};

function viewMoment(hour: number): ViewMoment {
  const moment = momentForHour(hour);
  return {
    name: moment.name,
    caption: moment.caption,
    url: IMAGE_BY_NAME[moment.name].url,
    previewUrl: IMAGE_BY_NAME[moment.name].previewUrl,
  };
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

function paintMoment(moment: ViewMoment): void {
  // Progressive reveal in two layers: the ~1 KB preview webp lands almost
  // instantly and shows blurred (CSS blur + scale hides its softness), then
  // the full still fades in over it once the browser has decoded it — the
  // picture goes soft → sharp instead of popping in from a black frame.
  const preview = document.getElementById('bootMomentPreview') as HTMLImageElement | null;
  if (preview && preview.getAttribute('src') !== moment.previewUrl) preview.src = moment.previewUrl;
  if (preview) preview.classList.add('is-front');

  const img = document.getElementById('bootMomentImg') as HTMLImageElement | null;
  if (img) {
    if (img.getAttribute('src') !== moment.url) {
      // Fade the full still in from zero: decode() first so the crossfade
      // never exposes a half-decoded bitmap. On decode failure (corrupt
      // fetch) still flip is-front — the blurred preview keeps the screen
      // from falling back to bare black.
      img.classList.remove('is-front');
      img.src = moment.url;
      img.decode().then(() => img.classList.add('is-front')).catch(() => img.classList.add('is-front'));
    } else if (!img.classList.contains('is-front')) {
      // Same still re-painted (heavy retargets the splash): already loading
      // or loaded — just make sure it sits in front.
      img.decode().then(() => img.classList.add('is-front')).catch(() => img.classList.add('is-front'));
    }
  }
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
  const preview = document.getElementById('bootMomentPreview') as HTMLImageElement | null;
  const img = document.getElementById('bootMomentImg') as HTMLImageElement | null;
  if (!preview && !img) return;
  if (preview) preview.style.animation = 'none';
  if (img) img.style.animation = 'none';
  // Clear only after the boot fade has fully finished — clearing earlier
  // would flash a blank frame during the fade-out.
  window.setTimeout(() => {
    preview?.removeAttribute('src');
    img?.removeAttribute('src');
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
