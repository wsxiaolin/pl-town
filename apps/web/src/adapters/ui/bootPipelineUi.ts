// Heavy boot pipeline — first visit / version update / lost precache.
// Fetches EVERY bundled asset (texture packs, CG stills, GLB models, activity
// art, moment stills) so the city afterwards boots instantly from the HTTP
// cache. Progress is file-level with byte counters (~0.1 MB emission steps);
// the lifecycle orchestrates stages (download → scene → precompile → ready)
// and this module owns the asset fetching and the bottom progress bar UI.

import { bundledAssetUrls as assetUrls } from '../../core/bundledAssets';

export type DownloadProgress = {
  loadedBytes: number;
  loadedFiles: number;
  totalFiles: number;
  failedFiles: number;
  done: boolean;
};

export type PipelineStage = 'download' | 'scene' | 'precompile' | 'ready';

export type BootPipelineUi = {
  beginStage: (stage: PipelineStage, label?: string) => void;
  setStageProgress: (stage: PipelineStage, fraction: number) => void;
  setDetail: (text: string) => void;
  setGpu: (text: string) => void;
  show: () => void;
};

const STAGE_WEIGHTS: Record<PipelineStage, number> = { download: 0.68, scene: 0.06, precompile: 0.22, ready: 0.04 };
const STAGE_LABELS: Record<PipelineStage, string> = {
  download: '下载城市资源',
  scene: '构建小城场景',
  precompile: '预编译渲染管线',
  ready: '即将进入小城',
};

export function createBootPipelineUi(): BootPipelineUi {
  const root = document.getElementById('bootPipeline');
  const stageEl = document.getElementById('bootPipelineStage');
  const percentEl = document.getElementById('bootPipelinePercent');
  const fillEl = document.getElementById('bootPipelineFill');
  const detailEl = document.getElementById('bootPipelineDetail');
  const gpuEl = document.getElementById('bootGpuLine');
  const current: Record<PipelineStage, number> = { download: 0, scene: 0, precompile: 0, ready: 0 };

  const publish = () => {
    const total = (Object.keys(current) as PipelineStage[])
      .reduce((sum, stage) => sum + current[stage] * STAGE_WEIGHTS[stage], 0);
    const percent = Math.min(100, Math.round(total * 100));
    if (fillEl) fillEl.style.transform = `scaleX(${total})`;
    if (percentEl) percentEl.textContent = `${percent}%`;
  };

  return {
    beginStage(stage, label) {
      current[stage] = 0;
      if (stageEl) stageEl.textContent = label || STAGE_LABELS[stage];
      publish();
    },
    setStageProgress(stage, fraction) {
      current[stage] = Math.max(0, Math.min(1, fraction));
      if (stageEl) stageEl.textContent = STAGE_LABELS[stage];
      publish();
    },
    setDetail(text) { if (detailEl) detailEl.textContent = text; },
    setGpu(text) {
      if (!gpuEl) return;
      gpuEl.textContent = text;
      gpuEl.hidden = !text;
    },
    show() { root?.classList.add('is-active'); },
  };
}

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
