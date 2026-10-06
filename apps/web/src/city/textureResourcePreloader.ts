// Texture precache — warms the HTTP cache for the HD texture pack so city
// load never blocks on the network. Fetches only; decoding happens lazily in
// TextureLoader. Per-run failures land in failedUrls so proceduralTexture_
// library can fall back to canvas textures for THIS session; an aborted pass
// (watchdog / forced upgrade) is a control path, never a failure.
import { bundledAssets } from '../core/bundledAssets';

// The textures-only URL list derives from the shared glob via its GROUP
// classification (glob-key based — URLs flatten in production builds), so
// the list is inlined into the bundle once, not twice (r8 nit).
const textureUrls = bundledAssets.filter((asset) => asset.group === 'textures').map((asset) => asset.url);

const failedUrls = new Set<string>();
let ready = false;
let activeRun: { promise: Promise<void>; controller: AbortController; forced: boolean } | null = null;

type TextureReadResult = 'ok' | 'failed' | 'aborted';

async function readTexture(url: string, signal: AbortSignal): Promise<TextureReadResult> {
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
    return 'ok';
  } catch {
    // Abort (watchdog / forced upgrade) is a normal control path: keep the
    // URL eligible for a later pass instead of downgrading the texture to
    // procedural canvas for the whole session — and do NOT count it as a
    // failure in progress reporting (r8 nit: the degrade path must not
    // claim procedural fallbacks for files that were merely cancelled).
    if (signal.aborted) return 'aborted';
    failedUrls.add(url);
    return 'failed';
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
      if (url && (await readTexture(url, signal)) === 'failed') failedFiles += 1;
      loadedFiles += 1;
      onFileDone?.(loadedFiles, failedFiles, urls.length);
    }
  };
  await Promise.all(Array.from({ length: Math.min(limit, urls.length) }, worker));
}

export function isTextureResourceAvailable(url: string): boolean {
  return !failedUrls.has(url);
}

export type TexturePreloadOptions = {
  /** Will the renderer actually read the HD pack this session? */
  enabled: boolean;
  /** Session/watchdog signal — aborts the pass. */
  signal?: AbortSignal;
  /** Heavy-boot repair semantics: overrides data-saver gates, not `enabled`. */
  force?: boolean;
  /** File-level progress (skipped/aborted files not counted as failures). */
  onFileDone?: (loadedFiles: number, failedFiles: number, totalFiles: number) => void;
};

export function preloadTextureResources(options: TexturePreloadOptions): Promise<void> {
  const { enabled, signal, force = false, onFileDone } = options;
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
  if (signal?.aborted) controller.abort();
  else signal?.addEventListener('abort', () => controller.abort(), { once: true });
  // Ambient runs bound themselves (30 s); a forced heavy-boot repair pass is
  // bounded by the lifecycle's 240 s watchdog via the shared signal, so it must
  // NOT arm this shorter timer — otherwise a slow-but-progressing 30–240 s
  // repair would abort mid-pass and still write the precache-done marker.
  const timeout = force ? null : setTimeout(() => controller.abort(), 30_000);
  const promise = runWithConcurrency(textureUrls, 6, controller.signal, onFileDone).then(() => {
    if (timeout !== null) clearTimeout(timeout);
    // Only a COMPLETED pass claims readiness — an aborted one must not
    // short-circuit a later forced re-run.
    if (!controller.signal.aborted) ready = true;
    if (activeRun?.promise === promise) activeRun = null;
  });
  activeRun = { promise, controller, forced: force };
  return promise;
}
