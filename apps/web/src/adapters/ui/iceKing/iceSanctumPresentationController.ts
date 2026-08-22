import * as THREE from 'three';
import { gsap } from 'gsap';

type Cursor = THREE.Object3D & { position: THREE.Vector3 };

export type IceSanctumCameraFocusOptions = {
  duration?: number;
  zoom?: number;
  ease?: string;
  onComplete?: () => void;
};

export interface IceSanctumPresentationController {
  enter(playCinematic?: boolean): void;
  leave(): void;
  fadeOutTimeSkipBlackout(): void;
  returnThroughBlackout(onCovered: () => Promise<void>): Promise<void>;
  schedule(callback: () => void, delayMs: number): number;
  isCinematic(): boolean;
  dispose(): void;
}

export function createIceSanctumPresentationController(options: {
  getCursor: () => Cursor | null;
  getNpcWorldPosition: () => THREE.Vector3;
  setCameraTarget: (x: number, z: number, instant?: boolean) => void;
  focusCamera: (x: number, z: number, focusOptions?: IceSanctumCameraFocusOptions) => void;
  stopCameraFocus: () => void;
}): IceSanctumPresentationController {
  const pauseDuration = 1;
  const focusDuration = 1.8;
  const holdDuration = 0.9;
  const returnDuration = 1.6;
  const exitAt = pauseDuration + focusDuration + holdDuration;
  const timers = new Set<number>();
  let cinematic = false;
  let cinematicOverlay: HTMLElement | null = null;
  let cinematicTimeline: ReturnType<typeof gsap.timeline> | null = null;
  let timeSkipFadeOverlay: HTMLElement | null = null;

  function schedule(callback: () => void, delayMs: number): number {
    const timerId = window.setTimeout(() => {
      timers.delete(timerId);
      callback();
    }, delayMs);
    timers.add(timerId);
    return timerId;
  }

  function removeCinematicOverlay(): void {
    cinematicOverlay?.remove();
    cinematicOverlay = null;
    document.body.classList.remove('ice-sanctum-cinematic-active');
  }

  function removeTimeSkipFadeOverlay(): void {
    timeSkipFadeOverlay?.remove();
    timeSkipFadeOverlay = null;
  }

  function cancelCinematic(): void {
    cinematicTimeline?.kill();
    cinematicTimeline = null;
    options.stopCameraFocus();
    removeCinematicOverlay();
    cinematic = false;
  }

  function completeCinematic(): void {
    cinematicTimeline = null;
    removeCinematicOverlay();
    cinematic = false;
    const cursor = options.getCursor();
    if (cursor) options.setCameraTarget(cursor.position.x, cursor.position.z, true);
  }

  function startCinematic(): void {
    const cursor = options.getCursor();
    if (!cursor) return;
    cinematic = true;
    document.body.classList.add('ice-sanctum-cinematic-active');
    const overlay = document.createElement('div');
    overlay.className = 'ice-sanctum-cinematic';
    overlay.setAttribute('aria-hidden', 'true');
    const topMask = document.createElement('div');
    topMask.className = 'ice-sanctum-cinematic-mask ice-sanctum-cinematic-mask-top';
    const bottomMask = document.createElement('div');
    bottomMask.className = 'ice-sanctum-cinematic-mask ice-sanctum-cinematic-mask-bottom';
    overlay.append(topMask, bottomMask);
    document.body.append(overlay);
    cinematicOverlay = overlay;

    const playerPosition = cursor.position.clone();
    const icePosition = options.getNpcWorldPosition();
    const timelineClock = { progress: 0 };
    options.setCameraTarget(playerPosition.x, playerPosition.z, true);
    gsap.set(topMask, { yPercent: -100 });
    gsap.set(bottomMask, { yPercent: 100 });
    cinematicTimeline = gsap.timeline({ onComplete: completeCinematic });
    cinematicTimeline.call(() => options.focusCamera(icePosition.x, icePosition.z, {
      duration: focusDuration,
      ease: 'power3.out',
    }), [], pauseDuration);
    cinematicTimeline.to([topMask, bottomMask], { yPercent: 0, duration: 0.9, ease: 'power3.out' }, pauseDuration);
    cinematicTimeline.call(() => {
      const currentCursor = options.getCursor();
      if (currentCursor) options.focusCamera(currentCursor.position.x, currentCursor.position.z, {
        duration: returnDuration,
        ease: 'power3.out',
      });
    }, [], exitAt);
    cinematicTimeline.to(topMask, { yPercent: -100, duration: 1.2, ease: 'power3.inOut' }, exitAt);
    cinematicTimeline.to(bottomMask, { yPercent: 100, duration: 1.2, ease: 'power3.inOut' }, exitAt);
    cinematicTimeline.to(timelineClock, { progress: 1, duration: returnDuration, ease: 'none' }, exitAt);
  }

  function enter(playCinematic = true): void {
    cancelCinematic();
    removeTimeSkipFadeOverlay();
    document.body.classList.remove('ice-sanctum-returning');
    document.body.classList.remove('ice-sanctum-return-revealing');
    document.body.classList.add('ice-sanctum-active');
    if (playCinematic) startCinematic();
  }

  function leave(): void {
    cancelCinematic();
    removeTimeSkipFadeOverlay();
    document.body.classList.remove('ice-sanctum-active');
  }

  function fadeOutTimeSkipBlackout(): void {
    removeTimeSkipFadeOverlay();
    const overlay = document.createElement('div');
    overlay.className = 'ice-sanctum-time-skip-fade';
    overlay.setAttribute('aria-hidden', 'true');
    document.body.append(overlay);
    timeSkipFadeOverlay = overlay;
    requestAnimationFrame(() => requestAnimationFrame(() => overlay.classList.add('is-fading')));
    schedule(() => {
      if (timeSkipFadeOverlay === overlay) timeSkipFadeOverlay = null;
      overlay.remove();
    }, 2_100);
  }

  function wait(delayMs: number): Promise<void> {
    return new Promise((resolve) => { schedule(resolve, delayMs); });
  }

  async function returnThroughBlackout(onCovered: () => Promise<void>): Promise<void> {
    document.body.classList.remove('ice-sanctum-return-revealing');
    document.body.classList.add('ice-sanctum-returning');
    await wait(1_500);
    try { await onCovered(); }
    finally {
      document.body.classList.add('ice-sanctum-return-revealing');
      await wait(1_500);
      document.body.classList.remove('ice-sanctum-returning', 'ice-sanctum-return-revealing');
    }
  }

  function dispose(): void {
    timers.forEach((timerId) => window.clearTimeout(timerId));
    timers.clear();
    leave();
    document.body.classList.remove('ice-sanctum-returning', 'ice-sanctum-return-revealing');
  }

  return { enter, leave, fadeOutTimeSkipBlackout, returnThroughBlackout, schedule, isCinematic: () => cinematic, dispose };
}
