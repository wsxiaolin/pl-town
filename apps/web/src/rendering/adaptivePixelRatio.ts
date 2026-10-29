export type AdaptivePixelRatioOptions = {
  initialRatio: number;
  minRatio?: number;
  step?: number;
  slowFrameMs?: number;
  fastFrameMs?: number;
  slowFrames?: number;
  fastFrames?: number;
  /** 观测窗口内用于估算显示节奏基线的帧数。 */
  cadenceSamples?: number;
};

/**
 * 显示节奏基线：观测窗口内帧间隔的下四分位数。取低分位而不是中位数，是
 * 因为持续掉帧会把中位数一路推高，基线一旦跟着上移，后续慢帧就永远不再
 * 被判为超预算。低分位只描述「面板能跑多快」，不会被持续过载吸收；同时它
 * 已忽略个别偶然极小值，不会被单帧抖动带偏。
 */
function cadenceFloor(intervals: readonly number[]): number {
  if (intervals.length === 0) return 0;
  const sorted = [...intervals].sort((a, b) => a - b);
  return sorted[Math.floor((sorted.length - 1) * 0.25)]!;
}

export function createAdaptivePixelRatioController(options: AdaptivePixelRatioOptions) {
  const maximum = options.initialRatio;
  const minimum = Math.min(maximum, options.minRatio ?? 0.75);
  const step = options.step ?? 0.25;
  const slowFrameMs = options.slowFrameMs ?? 24;
  const fastFrameMs = options.fastFrameMs ?? 18;
  const slowFrameLimit = options.slowFrames ?? 90;
  const fastFrameLimit = options.fastFrames ?? 600;
  const cadenceSamples = options.cadenceSamples ?? 30;
  const intervals: number[] = [];
  let ratio = maximum;
  let slowFrames = 0;
  let fastFrames = 0;
  // 面板刷新节奏的稳定估计。持续过载会把观测窗口整体推高，所以基线只允许
  // 记录「见过的更稳状态」：过载期间不下探也不上移，等到重新跑得比它快
  // 时才更新，避免把持续掉帧学成显示器刷新率。
  let stableCadence = 0;

  function reset() {
    slowFrames = 0;
    fastFrames = 0;
  }

  function pollRatio(): number | null {
    if (slowFrames >= slowFrameLimit && ratio > minimum) {
      ratio = Math.max(minimum, ratio - step);
      reset();
      return ratio;
    }
    if (fastFrames >= fastFrameLimit && ratio < maximum) {
      ratio = Math.min(maximum, ratio + step);
      reset();
      return ratio;
    }
    return null;
  }

  function isFrameOverBudget(frameMs: number, renderMs: number): boolean {
    const floor = stableCadence > 0 ? stableCadence : cadenceFloor(intervals);
    // 显示节奏本身的稳定间隔（例如 33 ms 的 30 Hz 面板）不算超预算；超出
    // 该基线一个容差，说明这一帧真的被拖长了。renderMs 单独超预算同样算。
    const cadenceTolerance = Math.max(6, floor * 0.25);
    const slowCadence = frameMs >= slowFrameMs && frameMs >= floor + cadenceTolerance;
    // 渲染调用本身已是瓶颈：要么同步渲染耗时直接超预算，要么它吃掉了
    // 超预算帧的大半预算。16 ms 快帧（render 默认等于 frameMs）不会命中，
    // 因为两者的 frameMs 都低于 slowFrameMs。
    const slowRender = renderMs >= slowFrameMs
      || (frameMs >= slowFrameMs && renderMs >= slowFrameMs * 0.5);
    return slowCadence || slowRender;
  }

  return {
    /**
     * `frameMs` 是相邻 rAF 时间戳之差，`renderMs` 是 `renderer.render()` 的
     * 同步耗时。GPU 瓶颈时后者会提前返回，只能靠真实帧间隔识别。
     */
    sample(frameMs: number, renderMs = frameMs): number | null {
      if (!Number.isFinite(frameMs) || frameMs <= 0 || frameMs > 250
        || !Number.isFinite(renderMs) || renderMs < 0) {
        reset();
        return null;
      }

      intervals.push(frameMs);
      if (intervals.length > cadenceSamples) intervals.shift();
      const overBudget = isFrameOverBudget(frameMs, renderMs);

      // 只用「这一帧本身没超预算」的窗口学习面板节奏。过载期的慢帧窗口会被
      // 跳过，基线就不会把持续掉帧学成刷新率；新节奏若比已知基线更慢（例如
      // 切到 30 Hz 的省电面板）也只在空基线时才采纳。
      if (!overBudget) {
        const candidate = cadenceFloor(intervals);
        if (candidate > 0 && (stableCadence === 0 || candidate < stableCadence)) stableCadence = candidate;
      }

      if (overBudget) {
        slowFrames += 1;
        fastFrames = 0;
      } else if (frameMs <= Math.max(fastFrameMs, stableCadence) && renderMs <= fastFrameMs) {
        fastFrames += 1;
        slowFrames = Math.max(0, slowFrames - 1);
      } else {
        slowFrames = Math.max(0, slowFrames - 1);
        fastFrames = 0;
      }

      return pollRatio();
    },
    reset,
  };
}
