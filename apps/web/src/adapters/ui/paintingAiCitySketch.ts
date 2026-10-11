// 「绘画+AI」变形目标：一座小城的简笔轮廓。
// 坐标为归一化素描空间（x/y ∈ [0,1]，y 向下），渲染时按画布短边等比缩放居中。
// 主轮廓是一条连续笔画（地面 + 钟楼 + 山墙小屋 + 公寓 + 穹顶会堂 + 小屋），
// 细节笔画（旗、钟面、窗、门、太阳、树、地面虚线）在变形后半段逐笔画上。
// 提供笔画重采样/展平等纯几何辅助，供画布控制器做"笔画变形"动画。

export type SketchPoint = { x: number; y: number };

const pts = (coords: Array<[number, number]>): SketchPoint[] => coords.map(([x, y]) => ({ x, y }));

const circle = (cx: number, cy: number, r: number, segments = 18): SketchPoint[] => {
  const points: SketchPoint[] = [];
  for (let i = 0; i <= segments; i++) {
    const angle = (i / segments) * Math.PI * 2;
    points.push({ x: cx + Math.cos(angle) * r, y: cy + Math.sin(angle) * r });
  }
  return points;
};

/** 主轮廓：变形时用户笔画的落点。 */
export const CITY_SKYLINE: SketchPoint[] = pts([
  [0.03, 0.84], [0.04, 0.84],
  [0.04, 0.62], [0.1, 0.5], [0.16, 0.62], [0.16, 0.84],
  [0.2, 0.84], [0.2, 0.4], [0.23, 0.28], [0.26, 0.4], [0.26, 0.84],
  [0.3, 0.84], [0.3, 0.5], [0.4, 0.5], [0.4, 0.42], [0.43, 0.42], [0.43, 0.5], [0.44, 0.5], [0.44, 0.84],
  [0.48, 0.84], [0.48, 0.6],
  [0.495, 0.515], [0.52, 0.475], [0.55, 0.46], [0.58, 0.475], [0.605, 0.515], [0.62, 0.6],
  [0.62, 0.84],
  [0.68, 0.84], [0.68, 0.66], [0.74, 0.54], [0.8, 0.66], [0.8, 0.84],
  [0.97, 0.84],
]);

/** 细节笔画：按顺序逐笔出现，营造"AI 一笔笔画完"的手绘感。 */
export const CITY_DETAILS: SketchPoint[][] = [
  pts([[0.23, 0.28], [0.23, 0.19]]),
  pts([[0.23, 0.19], [0.285, 0.215], [0.23, 0.245]]),
  circle(0.23, 0.47, 0.022),
  pts([[0.325, 0.565], [0.325, 0.63]]),
  pts([[0.36, 0.565], [0.36, 0.63]]),
  pts([[0.395, 0.565], [0.395, 0.63]]),
  pts([[0.325, 0.7], [0.325, 0.77]]),
  pts([[0.395, 0.7], [0.395, 0.77]]),
  pts([[0.535, 0.84], [0.535, 0.73], [0.575, 0.73], [0.575, 0.84]]),
  pts([[0.07, 0.7], [0.07, 0.77]]),
  pts([[0.13, 0.7], [0.13, 0.77]]),
  pts([[0.72, 0.7], [0.72, 0.78]]),
  circle(0.88, 0.2, 0.05),
  pts([[0.885, 0.84], [0.885, 0.75]]),
  circle(0.885, 0.695, 0.05),
  pts([[0.1, 0.885], [0.17, 0.885]]),
  pts([[0.33, 0.885], [0.44, 0.885]]),
  pts([[0.56, 0.885], [0.64, 0.885]]),
  pts([[0.78, 0.885], [0.85, 0.885]]),
];

/** 主轮廓与用户笔画统一重采样到的点数。 */
export const MORPH_POINT_COUNT = 144;

export function polylineLength(points: readonly SketchPoint[]): number {
  let total = 0;
  for (let i = 1; i < points.length; i++) {
    total += Math.hypot(points[i]!.x - points[i - 1]!.x, points[i]!.y - points[i - 1]!.y);
  }
  return total;
}

/** 按弧长把折线均匀重采样为 count 个点（首尾点保留）。 */
export function resamplePolyline(points: readonly SketchPoint[], count: number): SketchPoint[] {
  if (points.length === 0) return [];
  if (points.length === 1 || count <= 1) return [points[0]!, ...Array.from({ length: Math.max(0, count - 1) }, () => points[0]!)].slice(0, count);
  const total = polylineLength(points);
  if (total <= 1e-6) return Array.from({ length: count }, () => points[0]!);
  const step = total / (count - 1);
  const sampled: SketchPoint[] = [points[0]!];
  let index = 1;
  let carried = 0;
  let previous = points[0]!;
  while (sampled.length < count - 1 && index < points.length) {
    const current = points[index]!;
    const segment = Math.hypot(current.x - previous.x, current.y - previous.y);
    if (carried + segment >= step) {
      const ratio = (step - carried) / segment;
      const next = { x: previous.x + (current.x - previous.x) * ratio, y: previous.y + (current.y - previous.y) * ratio };
      sampled.push(next);
      previous = next;
      carried = 0;
    } else {
      carried += segment;
      previous = current;
      index++;
    }
  }
  while (sampled.length < count) sampled.push(points[points.length - 1]!);
  return sampled;
}

/** 把多笔笔画按绘制顺序展平为一条折线（笔画间的跳跃在变形中被视作连续运笔）。 */
export function flattenStrokes(strokes: readonly SketchPoint[][]): SketchPoint[] {
  const flattened: SketchPoint[] = [];
  for (const stroke of strokes) flattened.push(...stroke);
  return flattened;
}

/** 画布为空时的兜底"随手涂鸦"：一团越画越大的螺旋，保证变形照常发生。 */
export function fallbackScribble(): SketchPoint[] {
  const points: SketchPoint[] = [];
  for (let i = 0; i <= 60; i++) {
    const t = i / 60;
    const angle = t * Math.PI * 4.5;
    const radius = 0.04 + t * 0.13;
    points.push({ x: 0.5 + Math.cos(angle) * radius, y: 0.5 + Math.sin(angle) * radius * 0.8 });
  }
  return points;
}
