// 原神研究院体验控制器：建筑点击 → 打字机对话（哒哒哒）→ 选择
// 「好想玩原神！」→「云原神！」预热（此时才真正构建启动页场景、预编译
// shader）→ 全屏启动页（genshinLaunchOverlay）。
//
// 性能设计（用户要求「初始小城下载资源时提前下载源码，但代码只在必要的
// 时候运行」）：
//  1. scheduleGenshinIdlePrefetch() 在小城起来后的空闲时刻（requestIdleCallback）
//     预下载动态 import 的启动页 chunk——genshinLaunchOverlay.ts 顶层零副作用，
//     eval 只注册函数与 shader 字符串，不建场景、不占显存。
//  2. 真正的重代码（场景构建 + renderer.compile + 每帧渲染 + 音频）只在
//     用户选择「好想玩原神！」之后运行（ensureLaunchOverlay）。
//  3. 体验结束/中止时 overlay 内部已 dispose 全部几何/材质，controller 只
//     释放音频上下文并清空引用。
import type * as THREE from 'three';
import type { CityDialogController } from '../../adapters/ui/cityDialogController';
import type { GenshinLaunchOverlayLike } from './genshinLaunchOverlay';
import { playTypeTick, disposeGenshinAudio } from './genshinSounds';

export interface GenshinInstituteControllerOptions {
  dialogs: () => CityDialogController | null;
  getRenderer: () => THREE.WebGLRenderer | null;
  showToast: (message: string) => void;
  reduced: boolean;
  signal?: AbortSignal;
}

// 「好想玩原神！」必须是对话的第二个选项（用户指定的交互节奏）。
export const GENSHIN_LAUNCH_OPTION_TEXT = '好想玩原神！';

// 启动页 chunk 的模块缓存：预取与正式加载共用一个 Promise。
let modulePromise: Promise<typeof import('./genshinLaunchOverlay')> | null = null;

function loadOverlayModule(): Promise<typeof import('./genshinLaunchOverlay')> {
  modulePromise ??= import('./genshinLaunchOverlay');
  return modulePromise;
}

/** 小城起来后的空闲时刻预下载启动页源码（仅下载 + 零副作用 eval，不运行渲染）。 */
export function scheduleGenshinIdlePrefetch(): void {
  if (typeof window === 'undefined') return;
  if (modulePromise) return;
  const start = () => {
    void loadOverlayModule().catch(() => { modulePromise = null; });
  };
  if ('requestIdleCallback' in window) {
    window.requestIdleCallback(start, { timeout: 4000 });
  } else {
    globalThis.setTimeout(start, 2000);
  }
}

export function createGenshinInstituteController(options: GenshinInstituteControllerOptions) {
  let overlay: GenshinLaunchOverlayLike | null = null;
  let prewarming = false;
  let tickTimer: number | undefined;

  /** typewriter 的每字节拍（与 cityDialogController.renderLine 的公式一致，
   *  用于让「哒哒」声和文字逐字动画对齐；若那边改公式需同步这里）。 */
  function typewriterStepMs(text: string): number {
    const count = Math.max(Array.from(text).length - 1, 1);
    return Math.min(90, 3600 / count) * 1.5;
  }

  function startTypeTicks(text: string): void {
    stopTypeTicks();
    const characters = Array.from(text).length;
    const stepMs = typewriterStepMs(text);
    let played = 0;
    tickTimer = window.setInterval(() => {
      played += 1;
      if (played >= characters) stopTypeTicks();
      else playTypeTick();
    }, stepMs);
  }

  function stopTypeTicks(): void {
    if (tickTimer !== undefined) {
      window.clearInterval(tickTimer);
      tickTimer = undefined;
    }
  }

  function openStory(model: Parameters<CityDialogController['openStory']>[0]): void {
    const dialogs = options.dialogs();
    if (!dialogs) return;
    if (model.presentation?.typewriter) startTypeTicks(model.text);
    dialogs.openStory(model);
  }

  function closeDialog(): void {
    stopTypeTicks();
    options.dialogs()?.closeNpc();
  }

  function interact(): void {
    if (overlay?.isActive()) {
      options.showToast('原神正在启动中……');
      return;
    }
    if (prewarming) {
      options.showToast('云原神正在预热，稍等一下下。');
      return;
    }
    openStory({
      title: '原神研究院',
      role: '提瓦特研究所 · 北城分部',
      text: '欢迎来到原神研究院。这里的学者毕生只研究一个课题——原神，到底怎么启动。你来得正好，今天的研究成果，想亲眼看看吗？',
      variant: 'story',
      presentation: { typewriter: true, optionStaggerMs: 90, selectionDelayMs: 220 },
      options: [
        { text: '原神是什么？', onPick: explainGenshin },
        { text: GENSHIN_LAUNCH_OPTION_TEXT, onPick: startCloudGenshin },
        { text: '告辞', onPick: () => closeDialog() },
      ],
    });
  }

  function explainGenshin(): void {
    openStory({
      title: '原神研究院',
      role: '提瓦特研究所 · 北城分部',
      text: '《原神》是米哈游的开放世界冒险游戏。我们研究院把它的启动页复刻了下来——门、云、极光，一样不少。至于启动之后卡住的 5.6%……那是另一个课题了。',
      variant: 'story',
      presentation: { typewriter: true, optionStaggerMs: 90, selectionDelayMs: 220 },
      options: [
        { text: GENSHIN_LAUNCH_OPTION_TEXT, onPick: startCloudGenshin },
        { text: '先不玩了', onPick: () => closeDialog() },
      ],
    });
  }

  async function startCloudGenshin(): Promise<void> {
    closeDialog();
    let cancelled = false;
    openStory({
      title: '云原神！',
      role: '云端预热中 · 稍候',
      text: '正在为你预热启动页……（其实源码早就悄悄下载好了，这就是云原神的实力。）',
      variant: 'story',
      options: [{ text: '取消', onPick: () => { cancelled = true; closeDialog(); } }],
    });
    prewarming = true;
    try {
      const module = await loadOverlayModule();
      if (cancelled || options.signal?.aborted) return;
      const renderer = options.getRenderer();
      if (!renderer) return;
      const instance = module.createGenshinLaunchOverlay({
        reduced: options.reduced,
        showToast: options.showToast,
        onExited: (completed) => {
          overlay = null;
          disposeGenshinAudio();
          if (completed) options.showToast('欢迎回到物实市。');
        },
        onAborted: () => {
          overlay = null;
          disposeGenshinAudio();
        },
      });
      // 预热阶段完成重活：场景构建 + shader 编译（SwiftShader 软渲下的大头）。
      instance.prewarm(renderer);
      if (cancelled || options.signal?.aborted) {
        instance.dispose();
        return;
      }
      overlay = instance;
      closeDialog();
      instance.enter();
    } catch (error) {
      options.showToast('云原神预热失败，稍后再试。');
      // eslint-disable-next-line no-console
      console.warn('[genshin] launch overlay failed', error);
    } finally {
      prewarming = false;
    }
  }

  return {
    interact,
    getOverlay: () => overlay,
    isActive: () => Boolean(overlay?.isActive()),
    /** ESC 中止全屏体验（由 MiniCityApp 的键盘绑定转发）。 */
    stop: () => overlay?.stop(),
    dispose() {
      stopTypeTicks();
      overlay?.dispose();
      overlay = null;
      disposeGenshinAudio();
    },
  };
}

export type GenshinInstituteController = ReturnType<typeof createGenshinInstituteController>;
