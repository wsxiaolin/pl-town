/**
 * Resolves a pending promise early when the boot watchdog aborts. Used so a
 * stuck shader compile can never trap the visitor behind the splash forever —
 * the render gate releases and the boot degrades gracefully. Resolving with
 * `undefined` (instead of rejecting) keeps the boot flow on its normal
 * "continue degraded" path; callers never use the resolved value.
 */
export function abortable<T>(promise: Promise<T>, signal?: AbortSignal): Promise<T> {
  if (!signal) return promise;
  if (signal.aborted) return Promise.resolve(undefined as T);
  return new Promise<T>((resolve, reject) => {
    const onAbort = () => resolve(undefined as T);
    signal.addEventListener('abort', onAbort, { once: true });
    promise.then(
      (value) => { signal.removeEventListener('abort', onAbort); resolve(value); },
      (error) => { signal.removeEventListener('abort', onAbort); reject(error); },
    );
  });
}
