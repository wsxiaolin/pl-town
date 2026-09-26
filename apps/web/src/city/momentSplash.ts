// Moment splash — replaces the opening CG with a still of the city at the
// visitor's current time of day. Four stills (dawn / noon / dusk / night)
// share one composition; the local clock picks which one greets the visitor.
//
// Light visit: the boot screen shows the matching still with a slow drift and
// a small caption, holds for a breath, then fades into the city or login.
// Heavy visit: all four stills slowly cycle behind the download pipeline, so
// the wait reads as one day passing over the city.

import dawnUrl from '../assets/moments/dawn.webp';
import noonUrl from '../assets/moments/noon.webp';
import duskUrl from '../assets/moments/dusk.webp';
import nightUrl from '../assets/moments/night.webp';

export type MomentName = 'dawn' | 'noon' | 'dusk' | 'night';

type MomentDefinition = {
  name: MomentName;
  label: string;
  caption: string;
  url: string;
  /** Inclusive start hour (local time); the last moment wraps past midnight. */
  fromHour: number;
};

// 5:00–10:59 dawn · 11:00–16:59 noon · 17:00–19:59 dusk · 20:00–4:59 night
const MOMENTS: MomentDefinition[] = [
  { name: 'dawn', label: '清晨', caption: '清晨的物实小城', url: dawnUrl, fromHour: 5 },
  { name: 'noon', label: '正午', caption: '正午的物实小城', url: noonUrl, fromHour: 11 },
  { name: 'dusk', label: '黄昏', caption: '黄昏的物实小城', url: duskUrl, fromHour: 17 },
  { name: 'night', label: '夜晚', caption: '夜幕下的物实小城', url: nightUrl, fromHour: 20 },
];

export function momentForHour(hour: number): MomentDefinition {
  const ordered = [...MOMENTS].sort((a, b) => a.fromHour - b.fromHour);
  // MOMENTS is a non-empty constant; the last entry (20:00) covers deep night.
  let current: MomentDefinition = ordered[ordered.length - 1]!;
  for (const moment of ordered) {
    if (hour >= moment.fromHour) current = moment;
  }
  return current;
}

export function momentForDate(date = new Date()): MomentDefinition {
  return momentForHour(date.getHours());
}

// ─── boot screen presentation ────────────────────────────────────────────────

const MIN_SPLASH_MS = 2_600; // Even a cached visit gets a breath of the still.
const SLIDESHOW_FADE_MS = 1_800;

let cityReady = false;
let minimumElapsed = false;
let skipRequested = false;
let revealListeners: (() => void) | null = null;
let slideshowTimer: number | null = null;
let revealBound = false;

function bootScreen(): HTMLElement | null {
  return document.getElementById('bootScreen');
}

function setMomentImage(img: HTMLImageElement | null, url: string): void {
  if (!img) return;
  img.src = url;
}

function swapToMoment(moment: MomentDefinition, instant: boolean): void {
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

function startSlideshow(): void {
  stopSlideshow();
  // Heavy boot holds the CURRENT real-world moment: the still must match the
  // clock outside, so no day-passing cycle — the progress bar carries time.
  swapToMoment(momentForDate(), true);
}

function stopSlideshow(): void {
  if (slideshowTimer !== null) {
    clearTimeout(slideshowTimer);
    slideshowTimer = null;
  }
}

function bindSkip(): void {
  if (revealBound) return;
  revealBound = true;
  bootScreen()?.addEventListener('pointerdown', () => { skipRequested = true; notifyReveal(); }, { capture: true });
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
  swapToMoment(momentForDate(), true);
  scheduleMinimumElapsed();
  bindSkip();
}

/** Heavy visit: the current real-world moment holds behind the pipeline. */
export function showMomentSlideshow(): void {
  const screen = bootScreen();
  if (!screen) return;
  screen.classList.remove('is-splash');
  screen.classList.add('is-moment', 'is-heavy');
  startSlideshow();
  scheduleMinimumElapsed();
  bindSkip();
}

function scheduleMinimumElapsed(): void {
  window.setTimeout(notifyMinimumElapsed, MIN_SPLASH_MS);
}

export function stopMomentPresentation(): void {
  stopSlideshow();
}

/**
 * Resolves once the boot screen may fade: the city must be ready AND the
 * moment must have been on screen long enough (or the visitor clicked).
 */
export function whenBootRevealAllowed(): Promise<void> {
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

export function requestSkipMoment(): void {
  skipRequested = true;
  checkReveal();
}
