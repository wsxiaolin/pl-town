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
let inFlight: Promise<void> | null = null;
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

function publishSoon(): void {
  if (publishQueued) return;
  publishQueued = true;
  requestAnimationFrame(() => { publishQueued = false; publish(); });
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

export function preloadTextureResources(enabled = true, signal?: AbortSignal): Promise<void> {
  if (started) return inFlight ?? Promise.resolve();
  started = true;
  const connection = (navigator as Navigator & { connection?: { saveData?: boolean; effectiveType?: string } }).connection;
  if (!enabled || connection?.saveData || connection?.effectiveType === 'slow-2g') {
    ready = true;
    inFlight = Promise.resolve();
    return inFlight;
  }
  publish();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 30_000);
  if (signal?.aborted) controller.abort();
  else signal?.addEventListener('abort', () => controller.abort(), { once: true });
  inFlight = runWithConcurrency(Object.values(textureModules), 6, controller.signal).then(() => {
    clearTimeout(timeout);
    ready = true;
    publish();
  });
  return inFlight;
}
