const DEFAULT_REFLECTION_INTERVAL_MS = 1000 / 30;

/** Limits mirror refreshes while allowing camera switches and clock resets through immediately. */
export function createReflectionRefreshGate(intervalMs = DEFAULT_REFLECTION_INTERVAL_MS) {
  let lastCamera: unknown;
  let lastRefreshAt = Number.NEGATIVE_INFINITY;

  return (now: number, camera: unknown): boolean => {
    if (camera === lastCamera && now >= lastRefreshAt && now - lastRefreshAt < intervalMs) return false;
    lastCamera = camera;
    lastRefreshAt = now;
    return true;
  };
}
