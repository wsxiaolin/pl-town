/**
 * Resolves a pending promise early when the boot watchdog aborts. Used so a
 * stuck shader compile can never trap the visitor behind the splash forever —
 * the render gate releases and the boot degrades gracefully. Resolving with
 * `undefined` (instead of rejecting) keeps the boot flow on its normal
 * "continue degraded" path; callers never use the resolved value.
 */
export function abortable<T>(promise: Promise<T>, signal?: AbortSignal): Promise<T | undefined> {
  if (!signal) return promise;
  if (signal.aborted) return Promise.resolve(undefined);
  return new Promise<T | undefined>((resolve, reject) => {
    const onAbort = () => resolve(undefined);
    signal.addEventListener('abort', onAbort, { once: true });
    promise.then(
      (value) => { signal.removeEventListener('abort', onAbort); resolve(value); },
      (error) => { signal.removeEventListener('abort', onAbort); reject(error); },
    );
  });
}

/**
 * Combines several abort signals into one, equivalent to `AbortSignal.any`.
 * The House of Commons panels run on browsers that predate its rollout
 * (HarmonyOS/HuaweiBrowser Chromium <116 surfaced "AbortSignal.any is not a
 * function"), so the native path is used only when present and the manual
 * composition is the fallback. Listeners detach after the first abort; the
 * composite never aborts on its own.
 */
export function combineAbortSignals(signals: readonly AbortSignal[]): AbortSignal {
  if (typeof AbortSignal.any === 'function') return AbortSignal.any([...signals]);
  const controller = new AbortController();
  const abort = (source: AbortSignal) => controller.abort(source.reason);
  for (const signal of signals) {
    if (signal.aborted) { abort(signal); return controller.signal; }
    signal.addEventListener('abort', () => abort(signal), { once: true });
  }
  return controller.signal;
}
