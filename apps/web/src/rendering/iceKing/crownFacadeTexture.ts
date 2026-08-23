export function drawIceKingCrownFacade(
  ctx: CanvasRenderingContext2D,
  size: number,
  addNoise: (ctx: CanvasRenderingContext2D, size: number, opacity: number) => void,
): void {
  const gradient = ctx.createLinearGradient(0, 0, size, size);
  gradient.addColorStop(0, '#E8A838');
  gradient.addColorStop(0.3, '#F0C050');
  gradient.addColorStop(0.5, '#FFF1C0');
  gradient.addColorStop(0.7, '#F0C050');
  gradient.addColorStop(1, '#D49028');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, size, size);
  for (let y = 0; y < size; y += 48) {
    for (let x = 0; x < size; x += 48) {
      ctx.fillStyle = 'rgba(255,255,255,0.06)';
      ctx.beginPath();
      ctx.moveTo(x + 24, y);
      ctx.lineTo(x + 48, y + 24);
      ctx.lineTo(x + 24, y + 48);
      ctx.lineTo(x, y + 24);
      ctx.closePath();
      ctx.fill();
    }
  }
  ctx.fillStyle = 'rgba(180,120,20,0.18)';
  ctx.fillRect(0, size * 0.22, size, 4);
  ctx.fillRect(0, size * 0.78, size, 4);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = 'bold 96px "Segoe UI", Arial, sans-serif';
  ctx.strokeStyle = 'rgba(140,80,0,0.5)';
  ctx.lineWidth = 8;
  ctx.strokeText('King Ice', size / 2, size / 2);
  ctx.fillStyle = '#FFFFFF';
  ctx.shadowColor = 'rgba(0,0,0,0.25)';
  ctx.shadowBlur = 8;
  ctx.shadowOffsetX = 2;
  ctx.shadowOffsetY = 2;
  ctx.fillText('King Ice', size / 2, size / 2);
  ctx.shadowColor = 'transparent';
  addNoise(ctx, size, 0.02);
}
