// 「绘画+AI」画布覆盖层控制器：2D 涂鸦画布 + "笔画变形为小城简笔轮廓"动画。
// 纯 DOM/Canvas 交互，不依赖 Three.js，也不开第二个 WebGL 上下文。
// 动画分两段：先按弧长把用户笔画逐点变形（morph）为主城廓线，
// 再把窗、门、太阳等细节笔画按"手绘运笔"逐笔画上，播完自动收起。
import {
  CITY_DETAILS,
  CITY_SKYLINE,
  MORPH_POINT_COUNT,
  fallbackScribble,
  flattenStrokes,
  polylineLength,
  resamplePolyline,
  type SketchPoint,
} from './paintingAiCitySketch';

export interface PaintingAiCanvasHandlers {
  /** 变形播完、画布自动收起后调用（表扬 toast 由此触发）。 */
  onComplete: () => void;
  /** 用户在涂鸦阶段提前收起画布时调用。 */
  onCancel: () => void;
}

export interface PaintingAiCanvasController {
  open(handlers: PaintingAiCanvasHandlers): void;
  /** 静默收起画布：不触发 onComplete / onCancel（供剧情外部关闭复用）。 */
  close(): void;
  isOpen(): boolean;
}

type Phase = 'drawing' | 'morphing';

const INK = '#2F3A4A';
const SKY_BLUE = '#33518F';
const MORPH_MS = 1150;
const DETAILS_DELAY_MS = 620;
const DETAILS_MS = 1050;
const DONE_HOLD_MS = 1600;

function getElement<T extends HTMLElement>(document: Document, id: string): T {
  const element = document.getElementById(id);
  if (!element) throw new Error(`Missing painting canvas element #${id}`);
  return element as T;
}

const clamp01 = (value: number): number => Math.min(1, Math.max(0, value));
const easeInOutCubic = (t: number): number => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

export function createPaintingAiCanvasController(options: { document: Document; signal?: AbortSignal }): PaintingAiCanvasController {
  const { document } = options;
  const overlay = getElement<HTMLDivElement>(document, 'paintingOverlay');
  const canvas = getElement<HTMLCanvasElement>(document, 'paintingCanvas');
  const badge = getElement<HTMLDivElement>(document, 'paintingBadge');
  const doneButton = getElement<HTMLButtonElement>(document, 'paintingDone');
  const clearButton = getElement<HTMLButtonElement>(document, 'paintingClear');
  const closeButton = getElement<HTMLButtonElement>(document, 'paintingClose');
  const context = canvas.getContext('2d');
  if (!context) throw new Error('Painting canvas requires a 2D context');
  const ctx = context;

  const signal = options.signal;
  let handlers: PaintingAiCanvasHandlers | null = null;
  let open = false;
  let phase: Phase = 'drawing';
  let strokes: SketchPoint[][] = [];
  let activeStroke: SketchPoint[] | null = null;
  let dpr = 1;
  let rafHandle = 0;
  let closeTimer = 0;
  let resultNotified = false;
  // morphing 状态提到控制器级：窗口 resize 时能按当前进度重绘当前帧
  // （backing store 更新后 canvas 像素清空，必须重画，否则画面空白）。
  let morphFrom: readonly SketchPoint[] | null = null;
  let morphTo: readonly SketchPoint[] | null = null;
  let morphStart = 0;

  const BADGE_IDLE = 'AI 待命 · 画完点「交给 AI」';
  const BADGE_MORPHING = 'AI 变形中…笔迹正在成为一座小城';
  const BADGE_DONE = '作品完成 · 一座小城诞生了';

  interface Fit { rect: DOMRect; scale: number; ox: number; oy: number }
  const fit = (): Fit => {
    const rect = canvas.getBoundingClientRect();
    const scale = Math.min(rect.width, rect.height) * 0.84;
    return { rect, scale, ox: (rect.width - scale) / 2, oy: (rect.height - scale) / 2 };
  };

  const toPixel = (point: SketchPoint, space: Fit): { x: number; y: number } => ({
    x: space.ox + point.x * space.scale,
    y: space.oy + point.y * space.scale,
  });

  const resizeBackingStore = (): void => {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    const rect = canvas.getBoundingClientRect();
    canvas.width = Math.max(1, Math.round(rect.width * dpr));
    canvas.height = Math.max(1, Math.round(rect.height * dpr));
  };

  const beginPath = (lineWidth: number, color: string): void => {
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.lineWidth = lineWidth;
    ctx.strokeStyle = color;
    ctx.beginPath();
  };

  /** 画一条折线；budget 为剩余可画弧长（素描空间单位），返回消耗后的余量。 */
  const drawPolyline = (points: readonly SketchPoint[], space: Fit, budget: number, withJitter: number, seed: number): number => {
    if (points.length === 0) return budget;
    let remaining = budget;
    const first = toPixel(jitter(points[0]!, 0, withJitter, seed), space);
    ctx.moveTo(first.x, first.y);
    let previous = points[0]!;
    for (let i = 1; i < points.length; i++) {
      const current = points[i]!;
      const segment = Math.hypot(current.x - previous.x, current.y - previous.y);
      if (segment > remaining) {
        const ratio = remaining / segment;
        const tip = toPixel(jitter({ x: previous.x + (current.x - previous.x) * ratio, y: previous.y + (current.y - previous.y) * ratio }, i, withJitter, seed), space);
        ctx.lineTo(tip.x, tip.y);
        return 0;
      }
      const pixel = toPixel(jitter(current, i, withJitter, seed), space);
      ctx.lineTo(pixel.x, pixel.y);
      remaining -= segment;
      previous = current;
    }
    return remaining;
  };

  const jitter = (point: SketchPoint, index: number, amplitude: number, seed: number): SketchPoint => {
    if (amplitude <= 0) return point;
    const wobble = Math.sin(index * 12.9898 + seed * 78.233) * 43758.5453;
    const noise = (wobble - Math.floor(wobble)) * 2 - 1;
    return { x: point.x + noise * amplitude, y: point.y - noise * amplitude };
  };

  const renderDrawing = (): void => {
    const space = fit();
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, space.rect.width, space.rect.height);
    beginPath(5, INK);
    for (const stroke of strokes) drawPolyline(stroke, space, Number.POSITIVE_INFINITY, 0, 0);
    if (activeStroke && activeStroke.length > 0) drawPolyline(activeStroke, space, Number.POSITIVE_INFINITY, 0, 0);
    ctx.stroke();
  };

  const renderMorphFrame = (from: readonly SketchPoint[], to: readonly SketchPoint[], elapsedMs: number): void => {
    const space = fit();
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, space.rect.width, space.rect.height);
    const t = clamp01(elapsedMs / MORPH_MS);
    const eased = easeInOutCubic(t);
    const morphed = from.map((point, index) => {
      // from/to 已在 startMorph 里重采样到同一弧长点数，逐点一一对应；
      // 越界兜底仅作防御（不构成塌缩路径）。
      const target = to[index] ?? to[to.length - 1] ?? point;
      return { x: point.x + (target.x - point.x) * eased, y: point.y + (target.y - point.y) * eased };
    });
    beginPath(4.5 - eased, eased < 0.55 ? INK : SKY_BLUE);
    drawPolyline(morphed, space, Number.POSITIVE_INFINITY, (1 - eased) * 0.012, 7);
    ctx.stroke();
    // 细节笔画：从 DETAILS_DELAY_MS 起，按总弧长比例逐笔画上。
    const detailProgress = clamp01((elapsedMs - DETAILS_DELAY_MS) / DETAILS_MS);
    if (detailProgress > 0) {
      const total = CITY_DETAILS.reduce((sum, stroke) => sum + polylineLength(stroke), 0);
      let budget = total * detailProgress;
      for (const stroke of CITY_DETAILS) {
        if (budget <= 0) break;
        beginPath(3.2, INK);
        budget = drawPolyline(stroke, space, budget, 0, 0);
        ctx.stroke();
      }
    }
  };

  const startMorph = (): void => {
    if (!open || phase !== 'drawing') return;
    phase = 'morphing';
    overlay.classList.add('is-morphing');
    badge.textContent = BADGE_MORPHING;
    doneButton.disabled = true;
    clearButton.disabled = true;
    const drawn = flattenStrokes(strokes);
    const source = drawn.length >= 2 ? drawn : fallbackScribble();
    // 源笔迹与城廓线都重采样到同一弧长点数：逐点 lerp 才是真正的
    // 「按弧长对应变形」。旧实现只采样 from（144 点）而 target 直接取
    // 34 点 CITY_SKYLINE，index≥34 的 ~76% 笔迹点全部塌缩到最后一个
    // 顶点，中间帧被吸向一隅（审查 BLOCKER）。
    const pointCount = Math.max(MORPH_POINT_COUNT, CITY_SKYLINE.length);
    const from = resamplePolyline(source, pointCount);
    const to = resamplePolyline(CITY_SKYLINE, pointCount);
    morphFrom = from;
    morphTo = to;
    morphStart = performance.now();
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      renderMorphFrame(from, to, MORPH_MS + DETAILS_MS + DETAILS_DELAY_MS);
      finishMorph();
      return;
    }
    const start = morphStart;
    const totalMs = DETAILS_DELAY_MS + DETAILS_MS;
    const frame = (now: number): void => {
      const elapsed = now - start;
      renderMorphFrame(from, to, elapsed);
      if (elapsed < totalMs) {
        rafHandle = requestAnimationFrame(frame);
      } else {
        finishMorph();
      }
    };
    rafHandle = requestAnimationFrame(frame);
  };

  const finishMorph = (): void => {
    morphFrom = null;
    morphTo = null;
    overlay.classList.remove('is-morphing');
    overlay.classList.add('is-done');
    badge.textContent = BADGE_DONE;
    closeTimer = window.setTimeout(() => {
      close();
      notifyComplete();
    }, DONE_HOLD_MS);
  };

  const notifyComplete = (): void => {
    if (resultNotified) return;
    resultNotified = true;
    handlers?.onComplete();
    handlers = null;
  };

  const requestClose = (): void => {
    if (!open) return;
    if (phase === 'drawing') {
      close();
      if (!resultNotified) {
        resultNotified = true;
        handlers?.onCancel();
        handlers = null;
      }
      return;
    }
    // 变形已开始：无论何时收起都算完成，表扬照常送达。
    close();
    notifyComplete();
  };

  const pointFromEvent = (event: PointerEvent): SketchPoint => {
    const space = fit();
    return { x: (event.clientX - space.rect.left - space.ox) / space.scale, y: (event.clientY - space.rect.top - space.oy) / space.scale };
  };

  const onPointerDown = (event: PointerEvent): void => {
    if (!open || phase !== 'drawing') return;
    canvas.setPointerCapture(event.pointerId);
    activeStroke = [pointFromEvent(event)];
  };
  const onPointerMove = (event: PointerEvent): void => {
    if (!activeStroke) return;
    activeStroke.push(pointFromEvent(event));
    renderDrawing();
  };
  const endStroke = (): void => {
    if (!activeStroke) return;
    if (activeStroke.length > 1) strokes.push(activeStroke);
    activeStroke = null;
    renderDrawing();
  };

  const bind = (element: HTMLElement, type: string, listener: EventListener): void => {
    element.addEventListener(type, listener, { signal });
  };

  bind(canvas, 'pointerdown', onPointerDown as EventListener);
  bind(canvas, 'pointermove', onPointerMove as EventListener);
  bind(canvas, 'pointerup', endStroke as EventListener);
  bind(canvas, 'pointercancel', endStroke as EventListener);
  bind(doneButton, 'click', () => startMorph());
  bind(clearButton, 'click', () => {
    if (phase !== 'drawing') return;
    strokes = [];
    activeStroke = null;
    renderDrawing();
  });
  bind(closeButton, 'click', () => requestClose());
  // 画布打开期间窗口尺寸变化（旋转屏/改窗口）：backing store 跟随更新
  // 并按当前阶段重绘，否则 canvas 像素保持旧分辨率、fit() 用新 rect
  // 计算坐标导致绘制错位/拉伸（审查 🟡）。
  options.document.defaultView?.addEventListener('resize', () => {
    if (!open) return;
    resizeBackingStore();
    if (phase === 'morphing' && morphFrom && morphTo) {
      renderMorphFrame(morphFrom, morphTo, performance.now() - morphStart);
    } else {
      renderDrawing();
    }
  }, { signal });

  return {
    open(newHandlers) {
      if (open) return;
      handlers = newHandlers;
      resultNotified = false;
      strokes = [];
      activeStroke = null;
      phase = 'drawing';
      badge.textContent = BADGE_IDLE;
      doneButton.disabled = false;
      clearButton.disabled = false;
      overlay.classList.remove('is-morphing', 'is-done');
      resizeBackingStore();
      renderDrawing();
      open = true;
      overlay.classList.add('open');
    },
    close() {
      if (!open) return;
      open = false;
      if (rafHandle) cancelAnimationFrame(rafHandle);
      rafHandle = 0;
      if (closeTimer) window.clearTimeout(closeTimer);
      closeTimer = 0;
      activeStroke = null;
      overlay.classList.remove('open', 'is-morphing', 'is-done');
    },
    isOpen: () => open,
  };
}
