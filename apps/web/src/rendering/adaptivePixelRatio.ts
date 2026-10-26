export type AdaptivePixelRatioOptions = {
  initialRatio: number;
  minRatio?: number;
  step?: number;
  slowFrameMs?: number;
  fastFrameMs?: number;
  slowFrames?: number;
  fastFrames?: number;
};

export function createAdaptivePixelRatioController(options: AdaptivePixelRatioOptions) {
  const maximum = options.initialRatio;
  const minimum = Math.min(maximum, options.minRatio ?? 0.75);
  const step = options.step ?? 0.25;
  const slowFrameMs = options.slowFrameMs ?? 24;
  const fastFrameMs = options.fastFrameMs ?? 18;
  const slowFrameLimit = options.slowFrames ?? 90;
  const fastFrameLimit = options.fastFrames ?? 600;
  let ratio = maximum;
  let slowFrames = 0;
  let fastFrames = 0;

  function reset() {
    slowFrames = 0;
    fastFrames = 0;
  }

  return {
    sample(frameMs: number): number | null {
      if (!Number.isFinite(frameMs) || frameMs <= 0 || frameMs > 250) {
        reset();
        return null;
      }

      if (frameMs >= slowFrameMs) {
        slowFrames += 1;
        fastFrames = 0;
      } else if (frameMs <= fastFrameMs) {
        fastFrames += 1;
        slowFrames = Math.max(0, slowFrames - 1);
      } else {
        slowFrames = Math.max(0, slowFrames - 1);
        fastFrames = 0;
      }

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
    },
    reset,
  };
}
