const textureModules = import.meta.glob('../assets/textures/**/*.{png,jpg,jpeg,webp,avif}', {
  eager: true,
  import: 'default',
  query: '?url',
}) as Record<string, string>;

export type TextureProgress = {
  loadedBytes: number;
  totalBytes: number;
  loadedFiles: number;
  totalFiles: number;
  failedFiles: number;
};

const failedUrls = new Set<string>();
let ready = false;
let started = false;
let activeRun: { promise: Promise<void>; controller: AbortController; forced: boolean } | null = null;
let progress: TextureProgress = {
  loadedBytes: 0,
  totalBytes: 0,
  loadedFiles: 0,
  totalFiles: Object.values(textureModules).length,
  failedFiles: 0,
};
export type TextureProgressListener = (state: TextureProgress) => void;
const listeners = new Set<TextureProgressListener>();
let publishQueued = false;

function publish(): void {
  const state = { ...progress };
  listeners.forEach((listener) => listener(state));
}

/**
 * Coalesces per-chunk progress into at most ~7 DOM updates per second via a
 * timer (not rAF): 45 MB arrives as thousands of chunks, and a backgrounded
 * tab stops scheduling rAF entirely, which used to freeze the progress bar.
 */
function publishSoon(): void {
  if (publishQueued) return;
  publishQueued = true;
  window.setTimeout(() => { publishQueued = false; publish(); }, 150);
}

async function readTexture(url: string, signal: AbortSignal): Promise<void> {
  try {
    const response = await fetch(url, { signal });
    if (!response.ok) throw new Error(`Texture request failed: ${response.status}`);
    const contentLength = Number(response.headers.get('content-length') ?? 0);
    progress.totalBytes += contentLength;
    if (!response.body) {
      progress.loadedBytes += contentLength;
      progress.loadedFiles += 1;
      publishSoon();
      return;
    }
    const reader = response.body.getReader();
    while (true) {
      const chunk = await reader.read();
      if (chunk.done) break;
      progress.loadedBytes += chunk.value.byteLength;
      publishSoon();
    }
    progress.loadedFiles += 1;
  } catch {
    failedUrls.add(url);
    progress.failedFiles += 1;
    progress.loadedFiles += 1;
  }
  publish();
}

async function runWithConcurrency(urls: string[], limit: number, signal: AbortSignal): Promise<void> {
  let nextIndex = 0;
  const worker = async (): Promise<void> => {
    while (nextIndex < urls.length) {
      const url = urls[nextIndex++];
      if (signal.aborted) return;
      if (url) await readTexture(url, signal);
    }
  };
  await Promise.all(Array.from({ length: Math.min(limit, urls.length) }, worker));
}

export function isTextureResourceReady(): boolean {
  return ready;
}

export function isTextureResourceAvailable(url: string): boolean {
  return !failedUrls.has(url);
}

export function subscribeTextureResourceProgress(listener: TextureProgressListener): () => void {
  listeners.add(listener);
  listener({ ...progress });
  return () => listeners.delete(listener);
}

export function preloadTextureResources(enabled = true, signal?: AbortSignal, force = false): Promise<void> {
  if (activeRun) {
    if (!force || activeRun.forced) return activeRun.promise;
    // A forced run (heavy boot) upgrades an in-flight ambient pass: the
    // precache must use the full-URL, long-timeout semantics, so cancel the
    // ambient pass and restart with force semantics.
    activeRun.controller.abort();
    void activeRun.promise.catch(() => {});
    activeRun = null;
  }
  const connection = (navigator as Navigator & { connection?: { saveData?: boolean; effectiveType?: string } }).connection;
  // force (heavy boot) ignores the texture setting and data-saver modes: the
  // precache must land in full so city load never waits on the network.
  if (!force && (!enabled || connection?.saveData || connection?.effectiveType === 'slow-2g')) {
    ready = true;
    return Promise.resolve();
  }
  // An ambient run already completed — re-running would only re-read the
  // HTTP cache; a forced run re-opens the pass even after an ambient skip so
  // the first visit still lands a complete precache.
  if (ready && !force) return Promise.resolve();
  started = true;
  // Fresh counters per run: an aborted (upgraded) ambient pass must not
  // leave its half-fetched URLs marked as failed for the city renderer.
  failedUrls.clear();
  progress = {
    loadedBytes: 0,
    totalBytes: 0,
    loadedFiles: 0,
    totalFiles: Object.values(textureModules).length,
    failedFiles: 0,
  };
  publish();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), force ? 240_000 : 30_000);
  if (signal?.aborted) controller.abort();
  else signal?.addEventListener('abort', () => controller.abort(), { once: true });
  const promise = runWithConcurrency(Object.values(textureModules), 6, controller.signal).then(() => {
    clearTimeout(timeout);
    ready = true;
    publish();
    if (activeRun?.promise === promise) activeRun = null;
  });
  activeRun = { promise, controller, forced: force };
  return promise;
}
