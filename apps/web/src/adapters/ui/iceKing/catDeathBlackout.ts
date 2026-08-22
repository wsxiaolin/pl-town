const PAUSE_MS = 260;
const FADE_MS = 620;
const HOLD_MS = 280;

type PendingBlackout = {
  root: HTMLElement;
  cancelled: boolean;
  timerId: number | null;
  resume: ((proceed: boolean) => void) | null;
};

let pendingBlackout: PendingBlackout | null = null;

export async function playCatDeathBlackout<T>(start: () => T): Promise<T | null> {
  cancelCatDeathBlackout();
  const root = document.createElement('div');
  root.className = 'cat-death-cg-transition';
  root.dataset.catDeathTransition = 'blackout';
  root.setAttribute('aria-hidden', 'true');
  const blackout: PendingBlackout = { root, cancelled: false, timerId: null, resume: null };
  pendingBlackout = blackout;
  document.body.append(root);

  if (!await wait(blackout, PAUSE_MS)) return null;
  root.classList.add('is-active');
  if (!await wait(blackout, FADE_MS + HOLD_MS)) return null;

  const result = start();
  root.classList.remove('is-active');
  root.classList.add('is-leaving');
  blackout.timerId = window.setTimeout(() => {
    root.remove();
    if (pendingBlackout === blackout) pendingBlackout = null;
  }, FADE_MS + 60);
  return result;
}

export function cancelCatDeathBlackout(): boolean {
  const blackout = pendingBlackout;
  if (!blackout) return false;
  pendingBlackout = null;
  blackout.cancelled = true;
  if (blackout.timerId !== null) window.clearTimeout(blackout.timerId);
  blackout.timerId = null;
  blackout.root.remove();
  blackout.resume?.(false);
  blackout.resume = null;
  return true;
}

function wait(blackout: PendingBlackout, duration: number): Promise<boolean> {
  if (blackout.cancelled) return Promise.resolve(false);
  return new Promise(resolve => {
    blackout.resume = resolve;
    blackout.timerId = window.setTimeout(() => {
      blackout.timerId = null;
      blackout.resume = null;
      resolve(!blackout.cancelled);
    }, duration);
  });
}
