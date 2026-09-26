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
import noonUrl from '../../assets/moments/noon.webp';
import duskUrl from '../../assets/moments/dusk.webp';
import nightUrl from '../../assets/moments/night.webp';
import { momentForDate, momentForHour, type MomentName } from '../../core/momentClock';

export { momentForDate, momentForHour };
export type { MomentName };

type ViewMoment = { name: MomentName; caption: string; url: string };

const IMAGE_BY_NAME: Record<MomentName, string> = {
  dawn: dawnUrl,
  noon: noonUrl,
  dusk: duskUrl,
  night: nightUrl,
};

function viewMoment(hour: number): ViewMoment {
  const moment = momentForHour(hour);
  return { name: moment.name, caption: moment.caption, url: IMAGE_BY_NAME[moment.name] };
}

// ─── boot screen gate state ──────────────────────────────────────────────────

const MIN_SPLASH_MS = 2_600; // Even a cached visit gets a breath of the still.
const SLIDESHOW_FADE_MS = 1_800;

let cityReady = false;
let minimumElapsed = false;
let skipRequested = false;
let revealListeners: (() => void) | null = null;
let presentationStopped = false;

function bootScreen(): HTMLElement | null {
  return document.getElementById('bootScreen');
}

function swapToMoment(moment: ViewMoment, instant: boolean): void {
  const screen = bootScreen();
  if (!screen) return;
  const imgA = document.getElementById('bootMomentImgA') as HTMLImageElement | null;
  const imgB = document.getElementById('bootMomentImgB') as HTMLImageElement | null;
  if (!imgA || !imgB) return;
  const showingA = imgA.classList.contains('is-front');
  const target = showingA ? imgB : imgA;
  const previous = showingA ? imgA : imgB;
  target.src = moment.url;
  const show = () => {
    target.classList.add('is-front');
    previous.classList.remove('is-front');
  };
  if (instant) show();
  else window.setTimeout(show, 30); // let the browser decode before fading
  const caption = document.getElementById('bootMomentCaption');
  if (caption) {
    caption.classList.remove('is-visible');
    window.setTimeout(() => {
      caption.textContent = moment.caption;
      caption.classList.add('is-visible');
    }, instant ? 60 : SLIDESHOW_FADE_MS / 2);
  }
}

function showCurrentMoment(): void {
  swapToMoment(viewMoment(new Date().getHours()), true);
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
  // Keyboard parity for the "点击进入" hint (it is a CSS ::after, invisible
  // to assistive tech on its own).
  screen.addEventListener('keydown', (event) => {
    if (event.key === 'Enter' || event.key === ' ' || event.key === 'Escape') skip();
  }, { capture: true });
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
  if (!screen) return;
  screen.classList.add('is-moment', 'is-splash');
  swapToMoment(viewMoment(new Date().getHours()), true);
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
  // The pipeline rewrites its detail line constantly — stop screen-reader
  // announcements from churning while it does.
  screen.setAttribute('aria-live', 'off');
  showCurrentMoment();
  bindSkip();
}

function scheduleMinimumElapsed(): void {
  window.setTimeout(notifyMinimumElapsed, MIN_SPLASH_MS);
}

/**
 * Reveal completed (or the session tore down): the stills are hidden, so stop
 * their slow drift animations and drop the decoded bitmaps. Keeps GPU/CPU
 * memory from idling on an invisible 60fps transform for the whole session.
 */
function freezeMomentPresentation(): void {
  for (const id of ['bootMomentImgA', 'bootMomentImgB']) {
    const img = document.getElementById(id) as HTMLImageElement | null;
    if (!img) continue;
    img.style.animation = 'none';
    // Clear only after the boot fade has fully finished — clearing earlier
    // would flash a blank frame during the fade-out.
    window.setTimeout(() => { img.removeAttribute('src'); }, SLIDESHOW_FADE_MS + 400);
  }
}

export function stopMomentPresentation(): void {
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
export function notifyMinimumElapsed(): void {
  minimumElapsed = true;
  checkReveal();
}
