const textureModules = import.meta.glob('../assets/textures/**/*.{png,jpg,jpeg,webp,avif}', {
  eager: true,
  import: 'default',
  query: '?url',
}) as Record<string, string>;

type TextureProgress = {
  loadedBytes: number;
  totalBytes: number;
  loadedFiles: number;
  totalFiles: number;
  failedFiles: number;
};

const failedUrls = new Set<string>();
let ready = false;
let started = false;
let progress: TextureProgress = {
  loadedBytes: 0,
  totalBytes: 0,
  loadedFiles: 0,
  totalFiles: Object.values(textureModules).length,
  failedFiles: 0,
};
const listeners = new Set<(state: TextureProgress) => void>();

function publish(): void {
  const state = { ...progress };
  listeners.forEach((listener) => listener(state));
  const bar = document.getElementById('textureLoadProgress') as HTMLProgressElement | null;
  const detail = document.getElementById('textureLoadDetail');
  const ratio = progress.totalBytes > 0
    ? progress.loadedBytes / progress.totalBytes
    : progress.loadedFiles / Math.max(1, progress.totalFiles);
  if (bar) bar.value = Math.min(1, ratio);
  if (detail) {
    const percent = Math.round(Math.min(1, ratio) * 100);
    detail.textContent = progress.failedFiles > 0
      ? `资源 ${percent}% · ${progress.failedFiles} 个资源将使用程序化材质`
      : `资源 ${percent}% · ${progress.loadedFiles}/${progress.totalFiles}`;
  }
}

async function readTexture(url: string): Promise<void> {
  try {
    const response = await fetch(url);
    if (!response.ok) throw new Error(`Texture request failed: ${response.status}`);
    const contentLength = Number(response.headers.get('content-length') ?? 0);
    progress.totalBytes += contentLength;
    if (!response.body) {
      progress.loadedBytes += contentLength;
      progress.loadedFiles += 1;
      publish();
      return;
    }
    const reader = response.body.getReader();
    while (true) {
      const chunk = await reader.read();
      if (chunk.done) break;
      progress.loadedBytes += chunk.value.byteLength;
      publish();
    }
    progress.loadedFiles += 1;
  } catch {
    failedUrls.add(url);
    progress.failedFiles += 1;
    progress.loadedFiles += 1;
  }
  publish();
}

export function isTextureResourceReady(): boolean {
  return ready;
}

export function isTextureResourceAvailable(url: string): boolean {
  return !failedUrls.has(url);
}

export function subscribeTextureResourceProgress(listener: (state: TextureProgress) => void): () => void {
  listeners.add(listener);
  listener({ ...progress });
  return () => listeners.delete(listener);
}

export function preloadTextureResources(): void {
  if (started) return;
  started = true;
  publish();
  void Promise.all(Object.values(textureModules).map(readTexture)).then(() => {
    ready = true;
    publish();
    document.getElementById('textureLoadPanel')?.classList.add('is-complete');
    window.dispatchEvent(new CustomEvent('minicity:textures-ready'));
  });
}
