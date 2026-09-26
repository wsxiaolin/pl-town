// Asset downloader — streams every bundled asset through the HTTP cache with
// file-level progress (~0.1 MB emission steps). Network orchestration lives
// in core/ per Agents.md; the DOM progress bar is adapters/ui/bootPipelineUi.
import { bundledAssetUrls as assetUrls } from './bundledAssets';

export type DownloadProgress = {
  loadedBytes: number;
  loadedFiles: number;
  totalFiles: number;
  failedFiles: number;
  done: boolean;
};

/**
 * Fetch every bundled asset so the HTTP cache holds the full city. Progress
 * is byte-based via stream readers; individual failures are tolerated (the
 * scene falls back to procedural materials) and reported in the result.
 */
export async function downloadAllAssets(
  onProgress: (progress: DownloadProgress) => void,
  signal?: AbortSignal,
): Promise<DownloadProgress> {
  const progress: DownloadProgress = {
    loadedBytes: 0, loadedFiles: 0, totalFiles: assetUrls.length, failedFiles: 0, done: false,
  };
  if (assetUrls.length === 0) { progress.done = true; onProgress({ ...progress }); return progress; }

  let cursor = 0;
  const concurrency = Math.min(6, assetUrls.length);

  // 45 MB arrives as thousands of stream chunks — emitting per chunk would
  // hammer the DOM. Cap updates to ~0.1 MB steps (file completions pass).
  let emittedBytes = -1;
  let emittedFiles = -1;
  const emit = (force = false): void => {
    if (!force && progress.loadedBytes - emittedBytes < 102_400 && progress.loadedFiles === emittedFiles) return;
    emittedBytes = progress.loadedBytes;
    emittedFiles = progress.loadedFiles;
    onProgress({ ...progress });
  };

  const fetchOne = async (url: string): Promise<void> => {
    try {
      const response = await fetch(url, { signal });
      if (!response.ok) throw new Error(String(response.status));
      if (response.body) {
        const reader = response.body.getReader();
        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          progress.loadedBytes += value.byteLength;
          emit();
        }
      }
      progress.loadedFiles += 1;
      emit(true);
    } catch (error) {
      if (signal?.aborted) return;
      progress.failedFiles += 1;
      void error;
      emit(true);
    }
  };

  const workers = Array.from({ length: concurrency }, async () => {
    while (cursor < assetUrls.length && !signal?.aborted) {
      const url = assetUrls[cursor];
      cursor += 1;
      if (url !== undefined) await fetchOne(url);
    }
  });
  await Promise.all(workers);

  progress.done = true;
  onProgress({ ...progress });
  return progress;
}

export function describeDownload(progress: DownloadProgress): string {
  const mega = (bytes: number) => `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
  const base = `资源 ${Math.min(100, Math.round((progress.loadedFiles / Math.max(1, progress.totalFiles)) * 100))}% · ${mega(progress.loadedBytes)}`;
  return progress.failedFiles > 0 ? `${base} · ${progress.failedFiles} 个将回退程序化材质` : base;
}
