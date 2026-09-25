// Heavy boot pipeline — first visit / version update / lost precache.
// Downloads EVERY bundled asset (texture packs, CG stills, GLB models,
// activity art, moment stills) with honest byte-level progress, so the city
// afterwards boots instantly from the HTTP cache. The lifecycle orchestrates
// stages (download → scene → precompile → ready); this module owns the
// asset fetching and the bottom progress bar UI.

type AssetModules = Record<string, string>;

const assetUrls: string[] = Object.values(
  import.meta.glob('../assets/**/*.{png,jpg,jpeg,webp,avif,glb}', {
    eager: true,
    import: 'default',
    query: '?url',
  }) as AssetModules,
);

export type DownloadProgress = {
  loadedBytes: number;
  totalBytes: number;
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
  hide: () => void;
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
    hide() { root?.classList.remove('is-active'); },
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
    loadedBytes: 0, totalBytes: 0, loadedFiles: 0, totalFiles: assetUrls.length, failedFiles: 0, done: false,
  };
  if (assetUrls.length === 0) { progress.done = true; onProgress({ ...progress }); return progress; }

  let cursor = 0;
  const concurrency = Math.min(6, assetUrls.length);

  const fetchOne = async (url: string): Promise<void> => {
    try {
      const response = await fetch(url, { signal });
      if (!response.ok) throw new Error(String(response.status));
      const length = Number(response.headers.get('content-length') ?? 0);
      if (Number.isFinite(length) && length > 0) progress.totalBytes += length;
      if (response.body) {
        const reader = response.body.getReader();
        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          progress.loadedBytes += value.byteLength;
          onProgress({ ...progress });
        }
      }
      progress.loadedFiles += 1;
    } catch (error) {
      if (signal?.aborted) return;
      progress.failedFiles += 1;
      void error;
    }
    onProgress({ ...progress });
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
