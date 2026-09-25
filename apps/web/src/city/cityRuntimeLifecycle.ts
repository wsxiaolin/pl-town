import { gsap } from 'gsap';
import { destroyCG, initCG } from './cg';
import { destroyMusterCG } from './musterCg';
import { stopInvasionCG } from './invasionCg';
import { preloadTextureResources } from './textureResourcePreloader';
import { readRenderSettings } from '../rendering/createRenderer';
import { applyGpuSuggestedRenderSettings, describeGpuForBoot, probeGpu } from '../rendering/gpuCapability';
import { resolveBootDecision, markBootComplete, type BootDecision } from './bootGate';
import { createBootPipelineUi, describeDownload, downloadAllAssets, type BootPipelineUi } from './bootPipeline';
import { showMomentSlideshow, showMomentSplash, stopMomentPresentation } from './momentSplash';
import { showUnlockToast } from './toast';
import { disposeCityGovernance, loadCityGovernance } from './cityGovernanceClient';
import { closeCityGovernancePanel, disposeCityGovernancePanel } from '../adapters/ui/cityGovernancePanel';

export function createCityRuntimeLifecycle(options: {
  reduced: boolean;
  isNight: () => boolean;
  initCity: () => void;
  /** Heavy boot only: precompile shaders + warm-up frames before reveal. */
  prepareFirstFrame?: (onProgress?: (fraction: number) => void) => Promise<void>;
  startTutorial: () => void;
  proceedToCity: () => void;
  showLogin: () => void;
  disposeSession: () => void;
}) {
  let started = false;
  let eventController = new AbortController();

  async function start() {
    if (started) return;
    started = true;
    eventController = new AbortController();
    window.addEventListener('minicity:login-required', options.showLogin, { signal: eventController.signal });
    initCG({
      onFinish: () => {
        if (localStorage.getItem('minicityUser')) options.proceedToCity();
        else options.showLogin();
      },
      reduced: options.reduced,
    });
    document.body.classList.remove('day', 'night');
    document.body.classList.add(options.isNight() ? 'night' : 'day');

    // The moment still paints synchronously — today's sky greets the visitor
    // while the boot decision (and any heavy pipeline) resolves in background.
    showMomentSplash();
    const pipeline = createBootPipelineUi();
    const signal = eventController.signal;
    const texturePreload = preloadTextureResources(readRenderSettings().textureRendering, signal).catch(() => {});

    let decision: BootDecision;
    try {
      decision = await resolveBootDecision();
    } catch {
      decision = { mode: 'light', reason: 'cached', buildId: '', serverVersion: null };
    }
    if (!started || signal.aborted) return;

    if (decision.mode === 'light') {
      await texturePreload;
      if (!started || signal.aborted) return;
      await bootCity(pipeline, false);
      return;
    }

    await runHeavyBoot(decision, pipeline, signal, texturePreload);
  }

  /**
   * Heavy boot — first visit, updated build/server, or lost precache.
   * Download everything, build the scene, precompile the render pipeline,
   * then persist the precache marker so future visits take the fast path.
   */
  async function runHeavyBoot(decision: BootDecision, pipeline: BootPipelineUi, signal: AbortSignal, texturePreload: Promise<void>) {
    const gpu = probeGpu();
    applyGpuSuggestedRenderSettings(gpu);
    showMomentSlideshow();
    pipeline.show();
    pipeline.setGpu(describeGpuForBoot(gpu));
    pipeline.beginStage('download');
    pipeline.setDetail(bootReasonDetail(decision));

    try {
      const download = await downloadAllAssets((progress) => {
        pipeline.setStageProgress('download', progress.loadedFiles / Math.max(1, progress.totalFiles));
        pipeline.setDetail(describeDownload(progress));
      }, signal);
      pipeline.setStageProgress('download', 1);
      pipeline.setDetail(describeDownload(download));
    } catch {
      pipeline.setDetail('部分资源下载失败，已回退程序化材质');
    }
    if (!started || signal.aborted) return;

    // Texture preload re-runs with force: it populates the runtime texture
    // registry from the just-filled HTTP cache, ignoring data-saver modes.
    pipeline.beginStage('scene');
    pipeline.setDetail('校验高清材质包…');
    await texturePreload;
    await preloadTextureResources(true, signal, true).catch(() => {});
    if (!started || signal.aborted) return;

    await bootCity(pipeline, true);
  }

  async function bootCity(pipeline: BootPipelineUi, heavy: boolean) {
    if (!started) return;
    try {
      await loadCityGovernance(eventController.signal);
    } catch { /* governance is optional; the city opens without it. */ }
    if (!started) return;

    if (heavy) {
      pipeline.beginStage('scene');
      pipeline.setDetail('装配建筑与居民…');
    }
    try {
      options.initCity();
    } catch (error) {
      console.error('City initialization failed', error);
    }
    if (!started) return;

    if (heavy && options.prepareFirstFrame) {
      pipeline.beginStage('precompile');
      try {
        await options.prepareFirstFrame((fraction) => {
          pipeline.setStageProgress('precompile', fraction);
          if (fraction < 1) pipeline.setDetail(`预编译着色器与首帧预热 ${Math.round(fraction * 100)}%`);
        });
      } catch (error) {
        console.error('First-frame precompile failed', error);
      }
      if (!started) return;
      pipeline.beginStage('ready');
      pipeline.setStageProgress('ready', 1);
      pipeline.setDetail('一切就绪');
      // Precache landed — future visits skip the heavy pipeline entirely.
      markBootComplete();
    }

    window.dispatchEvent(new CustomEvent('minicity:city-ready'));
    options.startTutorial();
  }

  function destroy() {
    if (!started) return;
    started = false;
    options.disposeSession();
    closeCityGovernancePanel();
    disposeCityGovernancePanel();
    disposeCityGovernance();
    destroyCG();
    stopInvasionCG();
    destroyMusterCG();
    stopMomentPresentation();
    eventController.abort();
    gsap.globalTimeline.clear();
    document.getElementById('labelsWrap')?.replaceChildren();
    document.getElementById('mapIcons')?.replaceChildren();
  }

  return {
    get started() { return started; },
    get signal() { return eventController.signal; },
    start,
    destroy,
  };
}

function bootReasonDetail(decision: BootDecision): string {
  switch (decision.reason) {
    case 'first-visit': return '首次进入小城，需要下载完整资源包';
    case 'build-changed': return '检测到小城有更新，正在同步最新资源';
    case 'server-changed': return '服务端已更新，正在同步最新资源';
    case 'precache-missing': return '本地预编译缓存缺失，正在重建';
    case 'forced': return '已手动要求完整加载';
    default: return '正在准备资源';
  }
}
