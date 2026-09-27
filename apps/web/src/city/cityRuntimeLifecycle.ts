import { gsap } from 'gsap';
import { destroyCG, initCG, OPENING_CG_ENABLED } from './cg';
import { destroyMusterCG } from './musterCg';
import { stopInvasionCG } from './invasionCg';
import { preloadTextureResources } from './textureResourcePreloader';
import { readRenderSettings } from '../rendering/createRenderer';
import { applyGpuSuggestedRenderSettings, describeGpuForBoot, probeGpu } from '../rendering/gpuCapability';
import { resolveBootDecision, markBootComplete, type BootDecision } from './bootGate';
import { refreshServerVersion } from '../core/serverVersionProbe';
import { createBootPipelineUi, type BootPipelineUi } from '../adapters/ui/bootPipelineUi';
import { describeDownload, downloadAllAssets, type AssetDownloadInclude } from '../core/assetDownloader';
import { configureMomentSplash, showMomentHeavy, showMomentSplash, stopMomentPresentation } from '../adapters/ui/momentSplashView';
import { disposeCityGovernance, loadCityGovernance } from './cityGovernanceClient';
import { closeCityGovernancePanel, disposeCityGovernancePanel } from '../adapters/ui/cityGovernancePanel';

/** Hard ceiling for the heavy boot's networked + precompile stages. */
const BOOT_WATCHDOG_MS = 240_000;

export function createCityRuntimeLifecycle(options: {
  reduced: boolean;
  isNight: () => boolean;
  initCity: () => void;
  /**
   * Precompile shaders + warm-up frames before reveal. REQUIRED: the frame
   * loop is held (holdRender) when the city initializes, and this is the
   * release path — a missing release would leave a permanently black canvas.
   */
  prepareFirstFrame: (onProgress?: (fraction: number) => void, signal?: AbortSignal) => Promise<void>;
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
    configureMomentSplash({ reduced: options.reduced });
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
      // The texture preload is a pop-in mitigation, not a correctness need —
      // TextureLoader lazily loads anything not cached yet. Bound it so even
      // a fully-evicted HTTP cache can never put 41 MB on the FAST path
      // (review r3#1); the preloader keeps streaming in the background.
      await Promise.race([texturePreload, new Promise((resolve) => window.setTimeout(resolve, 2_500))]);
      if (!started || signal.aborted) return;
      // The light path is the DEFAULT path — give it its own watchdog so a
      // backgrounded tab (rAF frozen → warm-up frames stalled) cannot seal
      // the visitor behind the splash forever either.
      const lightAbort = new AbortController();
      const forwardSessionAbort = () => lightAbort.abort();
      signal.addEventListener('abort', forwardSessionAbort, { once: true });
      const lightWatchdog = window.setTimeout(() => lightAbort.abort(), 30_000);
      try {
        await bootCity(pipeline, false, () => Promise.resolve(null), lightAbort.signal);
      } finally {
        window.clearTimeout(lightWatchdog);
        signal.removeEventListener('abort', forwardSessionAbort);
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

    // Server probe started concurrently with stage 1 when the decision itself
    // never probed (first-visit / build-changed): awaiting it after the
    // precompile would stall the reveal on a cold backend.
    const lateProbe = decision.serverVersion === null
      ? refreshServerVersion().catch(() => null)
      : Promise.resolve<string | null>(decision.serverVersion);

    const gpu = probeGpu();
    applyGpuSuggestedRenderSettings(gpu);
    showMomentHeavy();
    pipeline.show();
    pipeline.setGpu(describeGpuForBoot(gpu));
    pipeline.beginStage('download');

    // Stage 1 downloads the NON-texture bundle (models, moments, activities,
    // CG while enabled). Textures are owned exclusively by the preloader
    // pass below so the two fetchers never race the same URLs with 6+6
    // workers (review r5#B1). HD-off boots download ~3 MB, not 41.
    const texturesEnabled = readRenderSettings().textureRendering;
    const include: AssetDownloadInclude = { textures: false, cg: OPENING_CG_ENABLED };
    pipeline.setDetail(`${bootReasonDetail(decision)}${texturesEnabled ? '' : '，高清贴图将按需加载'}`);

    let download: Awaited<ReturnType<typeof downloadAllAssets>> | null = null;
    let downloadFailed = false;
    try {
      download = await downloadAllAssets((progress) => {
        pipeline.setStageProgress('download', progress.loadedFiles / Math.max(1, progress.totalFiles));
        pipeline.setDetail(describeDownload(progress));
      }, bootAbort.signal, include);
      downloadFailed = download.failedFiles > 0;
    } catch {
      downloadFailed = true;
      pipeline.setDetail('部分资源下载失败，已回退程序化材质');
    }
    if (!started || signal.aborted) { finish(); return; }

    // Texture pass, still inside the download stage's budget. The forced
    // call aborts any ambient run in flight and re-opens the full pass —
    // textures are fetched exactly once and the 240 s watchdog bounds them
    // (the degraded branch then skips the completion markers).
    if (texturesEnabled) {
      pipeline.setDetail(downloadFailed ? '校验高清材质包（含修复下载）…' : '下载高清材质包…');
      await preloadTextureResources(true, bootAbort.signal, true).catch(() => {});
    } else {
      await texturePreload; // resolves immediately: the ambient pass skipped
    }
    if (bootAbort.signal.aborted) {
      // Watchdog fired mid-pipeline: keep its honest hint, no fake 100%.
      console.debug('[boot] pipeline aborted by watchdog — degrading');
    } else if (download) {
      pipeline.setStageProgress('download', 1);
      pipeline.setDetail(describeDownload(download));
    }
    if (!started || signal.aborted) { finish(); return; }

    await bootCity(pipeline, true, () => lateProbe, bootAbort.signal);
    finish();
  }

  async function bootCity(
    pipeline: BootPipelineUi,
    heavy: boolean,
    resolveServerVersion: () => Promise<string | null>,
    precompileSignal?: AbortSignal,
  ) {
    if (!started) return;
    try {
      // The boot watchdog (when provided) bounds governance too — the light
      // path's 30 s budget must actually cover the whole critical path.
      await loadCityGovernance(precompileSignal ?? eventController.signal);
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

    // Precompile runs on BOTH paths: the frame loop is held until the
    // programs are linked and the warm-up frames uploaded textures, so the
    // reveal never lands on a shader-compilation freeze (light boots used to
    // freeze exactly there when the visitor skipped the splash early).
    if (heavy) {
      pipeline.beginStage('precompile');
      try {
        await options.prepareFirstFrame((fraction) => {
          pipeline.setStageProgress('precompile', fraction);
          if (fraction < 1) pipeline.setDetail(`预编译着色器与首帧预热 ${Math.round(fraction * 100)}%`);
        }, precompileSignal);
      } catch (error) {
        console.error('First-frame precompile failed', error);
      }
    } else {
      await options.prepareFirstFrame(undefined, precompileSignal).catch((error) => console.error('First-frame precompile failed', error));
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
        // here. When the decision never probed (first-visit / build-changed),
        // take a fresh probe now so a build+server double deploy doesn't
        // cost returning visitors a second heavy boot (review r3#4).
        const consumedServerVersion = await resolveServerVersion();
        markBootComplete(consumedServerVersion);
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
