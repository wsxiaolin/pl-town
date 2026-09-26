// Heavy boot pipeline — first visit / version update / lost precache.
// Fetches EVERY bundled asset (texture packs, CG stills, GLB models, activity
// art, moment stills) so the city afterwards boots instantly from the HTTP
// cache. Progress is file-level with byte counters (~0.1 MB emission steps);
// the lifecycle orchestrates stages (download → scene → precompile → ready)
// and this module owns the asset fetching and the bottom progress bar UI.


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
