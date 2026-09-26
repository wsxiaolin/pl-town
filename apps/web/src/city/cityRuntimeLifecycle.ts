import { gsap } from 'gsap';
import { destroyCG, initCG } from './cg';
import { destroyMusterCG } from './musterCg';
import { stopInvasionCG } from './invasionCg';
import { preloadTextureResources } from './textureResourcePreloader';
import { readRenderSettings } from '../rendering/createRenderer';
import { applyGpuSuggestedRenderSettings, describeGpuForBoot, probeGpu } from '../rendering/gpuCapability';
import { resolveBootDecision, markBootComplete, type BootDecision } from './bootGate';
import { createBootPipelineUi, describeDownload, downloadAllAssets, type BootPipelineUi } from '../adapters/ui/bootPipelineUi';
import { showMomentHeavy, showMomentSplash, stopMomentPresentation } from '../adapters/ui/momentSplashView';
import { disposeCityGovernance, loadCityGovernance } from './cityGovernanceClient';
import { closeCityGovernancePanel, disposeCityGovernancePanel } from '../adapters/ui/cityGovernancePanel';

/** Hard ceiling for the heavy boot's networked + precompile stages. */
const BOOT_WATCHDOG_MS = 240_000;

export function createCityRuntimeLifecycle(options: {
  reduced: boolean;
  isNight: () => boolean;
  initCity: () => void;
  /** Heavy boot only: precompile shaders + warm-up frames before reveal. */
  prepareFirstFrame?: (onProgress?: (fraction: number) => void, signal?: AbortSignal) => Promise<void>;
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
      // The light path is the DEFAULT path — give it its own watchdog so a
      // backgrounded tab (rAF frozen → warm-up frames stalled) cannot seal
      // the visitor behind the splash forever either.
      const lightAbort = new AbortController();
      const lightWatchdog = window.setTimeout(() => lightAbort.abort(), 30_000);
      try {
        await bootCity(pipeline, false, undefined, lightAbort.signal);
      } finally {
        window.clearTimeout(lightWatchdog);
      }
      return;
    }

    await runHeavyBoot(decision, pipeline, signal, texturePreload);
  }

  /**
   * Heavy boot — first visit, updated build/server, or lost precache.
   * Download everything, build the scene, precompile the render pipeline,
   * then persist the precache marker so future visits take the fast path.
   * A 240 s watchdog bounds the networked stages: a single stalled response
   * (or a backgrounded tab freezing the rAF-driven precompile) degrades to
   * the procedural-fallback boot instead of trapping the visitor on the
   * splash forever. A degraded boot does NOT write the completion markers —
   * the next visit re-runs the heavy pipeline for the missing parts.
   */
  async function runHeavyBoot(decision: BootDecision, pipeline: BootPipelineUi, signal: AbortSignal, texturePreload: Promise<void>) {
    const bootAbort = new AbortController();
    const forwardSessionAbort = () => bootAbort.abort();
    signal.addEventListener('abort', forwardSessionAbort, { once: true });
    const watchdog = window.setTimeout(() => {
      pipeline.setDetail('加载超时，正在尽力进入小城…');
      bootAbort.abort();
    }, BOOT_WATCHDOG_MS);
    const finish = () => {
      window.clearTimeout(watchdog);
      signal.removeEventListener('abort', forwardSessionAbort);
    };

    const gpu = probeGpu();
    applyGpuSuggestedRenderSettings(gpu);
    showMomentHeavy();
    pipeline.show();
    pipeline.setGpu(describeGpuForBoot(gpu));
    pipeline.beginStage('download');
    pipeline.setDetail(bootReasonDetail(decision));

    let downloadFailed = false;
    try {
      const download = await downloadAllAssets((progress) => {
        pipeline.setStageProgress('download', progress.loadedFiles / Math.max(1, progress.totalFiles));
        pipeline.setDetail(describeDownload(progress));
      }, bootAbort.signal);
      if (bootAbort.signal.aborted) {
        // Keep the watchdog's honest hint; the bar stays where it stopped.
      } else {
        pipeline.setStageProgress('download', 1);
        pipeline.setDetail(describeDownload(download));
      }
      downloadFailed = download.failedFiles > 0;
    } catch {
      downloadFailed = true;
      pipeline.setDetail('部分资源下载失败，已回退程序化材质');
    }
    if (!started || signal.aborted) { finish(); return; }

    // Texture preload re-runs with force ONLY when the bulk download left
    // gaps (failures or an aborted watchdog pass): stage 1 already streamed
    // every asset through the HTTP cache, so re-running on a clean download
    // would just sit at 68% re-reading the cache with no progress to show.
    let sceneStageBegun = false;
    if (bootAbort.signal.aborted || downloadFailed) {
      sceneStageBegun = true;
      pipeline.beginStage('scene');
      pipeline.setDetail('校验高清材质包…');
      await texturePreload;
      await preloadTextureResources(true, bootAbort.signal, true).catch(() => {});
    } else {
      await texturePreload;
    }
    if (!started || signal.aborted) { finish(); return; }

    await bootCity(pipeline, true, decision.serverVersion, bootAbort.signal, sceneStageBegun);
    finish();
  }

  async function bootCity(pipeline: BootPipelineUi, heavy: boolean, serverVersion?: string | null, precompileSignal?: AbortSignal, sceneStageBegun = false) {
    if (!started) return;
    try {
      await loadCityGovernance(eventController.signal);
    } catch { /* governance is optional; the city opens without it. */ }
    if (!started) return;

    if (heavy && !sceneStageBegun) {
      pipeline.beginStage('scene');
      pipeline.setDetail('装配建筑与居民…');
    }
    try {
      options.initCity();
    } catch (error) {
      console.error('City initialization failed', error);
    }
    if (!started) return;

    // Precompile runs on BOTH paths: the frame loop is held until the
    // programs are linked and the warm-up frames uploaded textures, so the
    // reveal never lands on a shader-compilation freeze (light boots used to
    // freeze exactly there when the visitor skipped the splash early).
    if (heavy) {
      pipeline.beginStage('precompile');
      try {
        await options.prepareFirstFrame?.((fraction) => {
          pipeline.setStageProgress('precompile', fraction);
          if (fraction < 1) pipeline.setDetail(`预编译着色器与首帧预热 ${Math.round(fraction * 100)}%`);
        }, precompileSignal);
      } catch (error) {
        console.error('First-frame precompile failed', error);
      }
    } else {
      await options.prepareFirstFrame?.().catch((error) => console.error('First-frame precompile failed', error));
    }
    if (!started) return;

    if (heavy) {
      if (precompileSignal?.aborted) {
        // Degraded boot (watchdog fired mid-pipeline): enter the city, but
        // do NOT write the completion markers — the precache is incomplete,
        // so the next visit must re-run the update instead of trusting a
        // half-landed cache.
        pipeline.setDetail('本次预缓存未完成，下次进入将重新同步');
      } else {
        pipeline.beginStage('ready');
        pipeline.setStageProgress('ready', 1);
        pipeline.setDetail('一切就绪');
        // Precache landed — future visits skip the heavy pipeline entirely.
        // The server version observed by THIS boot only becomes "consumed"
        // here: a boot abandoned mid-download must re-run the update.
        markBootComplete(serverVersion);
      }
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
