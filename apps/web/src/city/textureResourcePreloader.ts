// Texture precache — warms the HTTP cache for the HD texture pack so city
// load never blocks on the network. Fetches only; decoding happens lazily in
// TextureLoader. Per-run failures land in failedUrls so proceduralTexture_
// library can fall back to canvas textures for THIS session; an aborted pass
// (watchdog / forced upgrade) is a control path, never a failure.
const textureModules = import.meta.glob('../assets/textures/**/*.{png,jpg,jpeg,webp,avif}', {
  eager: true,
  import: 'default',
  query: '?url',
}) as Record<string, string>;

const failedUrls = new Set<string>();
let ready = false;
let activeRun: { promise: Promise<void>; controller: AbortController; forced: boolean } | null = null;

async function readTexture(url: string, signal: AbortSignal): Promise<boolean> {
  try {
    const response = await fetch(url, { signal });
    if (!response.ok) throw new Error(`Texture request failed: ${response.status}`);
    if (response.body) {
      // Drain the stream: reading the bytes is what lands them in the cache.
      const reader = response.body.getReader();
      for (;;) {
        const { done } = await reader.read();
        if (done) break;
      }
    }
    // A successful (re)read repairs an earlier failure — the URL is
    // available to the renderer again this session.
    failedUrls.delete(url);
    return true;
  } catch {
    // Abort (watchdog / forced upgrade) is a normal control path: keep the
    // URL eligible for a later pass instead of downgrading the texture to
    // procedural canvas for the whole session.
    if (signal.aborted) return false;
    failedUrls.add(url);
    return false;
  }
}

async function runWithConcurrency(
  urls: string[],
  limit: number,
  signal: AbortSignal,
  onFileDone?: (loadedFiles: number, failedFiles: number, totalFiles: number) => void,
): Promise<void> {
  let nextIndex = 0;
  let loadedFiles = 0;
  let failedFiles = 0;
  const worker = async (): Promise<void> => {
    while (nextIndex < urls.length) {
      if (signal.aborted) return;
      const url = urls[nextIndex++];
      if (url && !(await readTexture(url, signal))) failedFiles += 1;
      loadedFiles += 1;
      onFileDone?.(loadedFiles, failedFiles, urls.length);
    }
  };
  await Promise.all(Array.from({ length: Math.min(limit, urls.length) }, worker));
}

export function isTextureResourceAvailable(url: string): boolean {
  return !failedUrls.has(url);
}

export function preloadTextureResources(
  enabled = true,
  signal?: AbortSignal,
  force = false,
  onFileDone?: (loadedFiles: number, failedFiles: number, totalFiles: number) => void,
): Promise<void> {
  if (activeRun) {
    if (!force || activeRun.forced) return activeRun.promise;
    // A forced run (heavy boot repair pass) upgrades an in-flight ambient
    // pass: cancel it and restart with the long-timeout semantics.
    activeRun.controller.abort();
    void activeRun.promise.catch(() => {});
    activeRun = null;
  }
  // `enabled` = the renderer will actually read these textures. When false
  // there is nothing to precache — force cannot override that (force only
  // overrides network-frugality gates: saveData / slow-2g).
  if (!enabled) {
    ready = true;
    return Promise.resolve();
  }
  const connection = (navigator as Navigator & { connection?: { saveData?: boolean; effectiveType?: string } }).connection;
  if (!force && (connection?.saveData || connection?.effectiveType === 'slow-2g')) {
    ready = true;
    return Promise.resolve();
  }
  // A completed ambient pass already warmed the cache; a forced run still
  // re-opens it (it may be a repair pass for earlier failures).
  if (ready && !force) return Promise.resolve();
  const controller = new AbortController();
  // Force runs are primarily bounded by the lifecycle watchdog; this timer
  // is belt-and-suspenders for the case the boot flow itself stalls before
  // arming the watchdog.
  const timeout = setTimeout(() => controller.abort(), force ? 240_000 : 30_000);
  if (signal?.aborted) controller.abort();
  else signal?.addEventListener('abort', () => controller.abort(), { once: true });
  const promise = runWithConcurrency(Object.values(textureModules), 6, controller.signal, onFileDone).then(() => {
    clearTimeout(timeout);
    // Only a COMPLETED pass claims readiness — an aborted one must not
    // short-circuit a later forced re-run.
    if (!controller.signal.aborted) ready = true;
    if (activeRun?.promise === promise) activeRun = null;
  });
  activeRun = { promise, controller, forced: force };
  return promise;
}
