// Moment splash — replaces the opening CG with a still of the city at the
// visitor's current time of day. Four stills (dawn / noon / dusk / night)
// share one composition; the local clock picks which one greets the visitor.
//
// Light visit: the boot screen shows the matching still with a slow drift and
// a small caption, holds for a breath, then fades into the city or login.
// Heavy visit: the SAME current-moment still holds behind the download
// pipeline — the splash must match the clock outside, so there is no
// day-passing cycle; the progress bar carries the sense of time.

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
const MOMENTS: readonly MomentDefinition[] = [
  { name: 'dawn', label: '清晨', caption: '清晨的物实小城', url: dawnUrl, fromHour: 5 },
  { name: 'noon', label: '正午', caption: '正午的物实小城', url: noonUrl, fromHour: 11 },
  { name: 'dusk', label: '黄昏', caption: '黄昏的物实小城', url: duskUrl, fromHour: 17 },
  { name: 'night', label: '夜晚', caption: '夜幕下的物实小城', url: nightUrl, fromHour: 20 },
];

// Precomputed once — momentForHour must not clone+sort on every probe.
const ORDERED_MOMENTS: readonly MomentDefinition[] = [...MOMENTS].sort((a, b) => a.fromHour - b.fromHour);

export function momentForHour(hour: number): MomentDefinition {
  // ORDERED_MOMENTS is a non-empty constant; the last entry (20:00) covers
  // deep night.
  let current: MomentDefinition = ORDERED_MOMENTS[ORDERED_MOMENTS.length - 1]!;
  for (const moment of ORDERED_MOMENTS) {
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
let revealBound = false;

function bootScreen(): HTMLElement | null {
  return document.getElementById('bootScreen');
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

function showCurrentMoment(): void {
  swapToMoment(momentForDate(), true);
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
export function showMomentHeavy(): void {
  const screen = bootScreen();
  if (!screen) return;
  screen.classList.remove('is-splash');
  screen.classList.add('is-moment', 'is-heavy');
  showCurrentMoment();
  scheduleMinimumElapsed();
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
