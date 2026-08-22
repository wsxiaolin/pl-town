const TAU = Math.PI * 2;

export function drawCatDeathBurial(
  cx: CanvasRenderingContext2D,
  x: number,
  y: number,
  scale: number,
  weight: number,
): void {
  if (weight <= 0) return;
  cx.save();
  cx.globalAlpha = weight;
  cx.fillStyle = '#4b392b';
  cx.beginPath();
  cx.ellipse(x, y - 4 * scale, 82 * scale * weight, 27 * scale * weight, 0, 0, TAU);
  cx.fill();
  cx.strokeStyle = 'rgba(196,158,106,0.42)';
  cx.lineWidth = 1.2;
  for (let mark = -2; mark <= 2; mark += 1) {
    cx.beginPath();
    cx.arc(x + mark * 22 * scale, y - 8 * scale, 14 * scale, Math.PI * 1.1, Math.PI * 1.85);
    cx.stroke();
  }
  const progress = Math.max(0, Math.min(1, (weight - 0.72) / 0.28));
  cx.globalAlpha = progress * progress * (3 - 2 * progress);
  cx.fillStyle = '#77766d';
  cx.fillRect(x - 10 * scale, y - 72 * scale, 20 * scale, 61 * scale);
  cx.strokeStyle = 'rgba(230,226,210,0.45)';
  cx.beginPath();
  cx.moveTo(x - 5 * scale, y - 49 * scale);
  cx.lineTo(x + 5 * scale, y - 49 * scale);
  cx.stroke();
  cx.restore();
}
