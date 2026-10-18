import { applyNoiseLattice, mulberry32 } from './textureNoise';

type Canvas2D = CanvasRenderingContext2D;
type RGB = [number, number, number];
type Paint = (key: string, size: number, draw: (ctx: Canvas2D, size: number) => void) => void;

function shade(base: RGB, s: number): string {
  return `rgb(${Math.floor(base[0] * s)},${Math.floor(base[1] * s)},${Math.floor(base[2] * s)})`;
}

/** 居民楼扩展墙面/屋顶贴图（青灰砖楼、象牙石居两家材料族使用的程序化贴图）。
 *  独立成模块以控制 proceduralTextureLibrary.ts 的单文件体积。 */
export function registerResidentTexturePainters(paint: Paint): void {
  // --- Residence pale brick: cool grey masonry for the 青灰砖楼 family ---
  paint('residence_brick_pale', 256, (ctx, s) => {
    ctx.fillStyle = '#B7BBC0'; ctx.fillRect(0, 0, s, s);
    const rand = mulberry32(0x1a2b3c4d);
    const bw = 34, bh = 16;
    for (let y = 0; y < s; y += bh) {
      const off = ((y / bh) % 2) * (bw / 2);
      for (let x = -bw; x < s + bw; x += bw) {
        const bx = x + off, sh = 0.94 + rand() * 0.12;
        ctx.fillStyle = shade([198, 202, 207], sh);
        ctx.fillRect(bx + 1, y + 1, bw - 3, bh - 3);
        ctx.fillStyle = 'rgba(90,96,104,0.16)';
        ctx.fillRect(bx, y + bh - 2, bw, 2);
      }
    }
    applyNoiseLattice(ctx, s, 0.02, 0x11);
  });

  // --- Residence grey stone: light ashlar blocks for the 象牙石居 family ---
  paint('residence_stone_gray', 256, (ctx, s) => {
    ctx.fillStyle = '#DBD6CA'; ctx.fillRect(0, 0, s, s);
    const rand = mulberry32(0x2b3c4d5e);
    const rows = 8, rh = s / rows;
    for (let r = 0; r < rows; r += 1) {
      const cols = r % 2 === 0 ? 3 : 4;
      const cw = s / cols;
      const off = r % 2 === 0 ? 0 : -cw / 2;
      for (let c = -1; c <= cols; c += 1) {
        const x = c * cw + off, sh = 0.95 + rand() * 0.1;
        ctx.fillStyle = shade([219, 214, 202], sh);
        ctx.fillRect(x + 1, r * rh + 1, cw - 2, rh - 2);
        ctx.fillStyle = 'rgba(150,140,124,0.22)';
        ctx.fillRect(x, r * rh, cw, 1.5);
        ctx.fillRect(x, r * rh, 1.5, rh);
      }
    }
    applyNoiseLattice(ctx, s, 0.018, 0x12);
  });

  // --- Residence charcoal roof: dark slate shingles for the 青灰砖楼 family ---
  paint('roof_charcoal', 256, (ctx, s) => {
    ctx.fillStyle = '#3A3F45'; ctx.fillRect(0, 0, s, s);
    const rand = mulberry32(0x3c4d5e6f);
    const tile = 24;
    for (let y = 0; y < s; y += tile) {
      const off = ((y / tile) % 2) * (tile / 2);
      for (let x = -tile; x < s + tile; x += tile) {
        const bx = x + off, sh = 0.82 + rand() * 0.26;
        ctx.fillStyle = shade([58, 63, 69], sh);
        ctx.fillRect(bx + 1, y + 1, tile - 3, tile - 3);
        ctx.fillStyle = 'rgba(0,0,0,0.2)';
        ctx.fillRect(bx + tile - 3, y, 3, tile);
        ctx.fillRect(bx, y + tile - 3, tile, 3);
      }
    }
    applyNoiseLattice(ctx, s, 0.022, 0x13);
  });

  // --- Window reflection: a printed sky/neighbour reflection so panes read as
  //     glass with something behind them instead of a flat coloured rectangle. ---
  paint('window_reflection', 256, (ctx, s) => {
    const sky = ctx.createLinearGradient(0, 0, 0, s);
    sky.addColorStop(0, '#d6e7f2');
    sky.addColorStop(0.52, '#9dbacf');
    sky.addColorStop(1, '#5d7284');
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, s, s);
    // Soft cloud band across the upper half.
    ctx.fillStyle = 'rgba(255,255,255,0.22)';
    ctx.fillRect(0, s * 0.16, s, s * 0.07);
    ctx.fillStyle = 'rgba(255,255,255,0.12)';
    ctx.fillRect(0, s * 0.27, s, s * 0.04);
    // Reflected neighbour rooflines in the lower-left third.
    ctx.fillStyle = 'rgba(54,68,80,0.32)';
    ctx.fillRect(s * 0.06, s * 0.48, s * 0.3, s * 0.52);
    ctx.fillRect(s * 0.36, s * 0.6, s * 0.22, s * 0.4);
    ctx.fillStyle = 'rgba(54,68,80,0.2)';
    ctx.fillRect(s * 0.58, s * 0.7, s * 0.18, s * 0.3);
    // Diagonal skylight streak.
    ctx.save();
    ctx.strokeStyle = 'rgba(255,255,255,0.42)';
    ctx.lineWidth = s * 0.07;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(s * 0.12, s * 0.08);
    ctx.lineTo(s * 0.66, s * 0.94);
    ctx.stroke();
    ctx.restore();
    applyNoiseLattice(ctx, s, 0.018, 0x14);
  });

  // --- Residence copper roof: weathered green standing-seam panels ---
  paint('roof_copper', 256, (ctx, s) => {
    ctx.fillStyle = '#59806F'; ctx.fillRect(0, 0, s, s);
    const rand = mulberry32(0x4d5e6f70);
    const seam = 32;
    for (let x = 0; x < s; x += seam) {
      const sh = 0.9 + rand() * 0.16;
      ctx.fillStyle = shade([89, 128, 111], sh);
      ctx.fillRect(x, 0, seam - 3, s);
      ctx.fillStyle = 'rgba(20,45,36,0.35)';
      ctx.fillRect(x + seam - 3, 0, 3, s);
      ctx.fillStyle = 'rgba(255,255,255,0.08)';
      ctx.fillRect(x + 1, 0, 2, s);
    }
    for (let i = 0; i < 40; i += 1) {
      ctx.fillStyle = 'rgba(120,180,150,0.18)';
      ctx.fillRect(rand() * s, rand() * s, 1 + rand() * 2, 3 + rand() * 10);
    }
    applyNoiseLattice(ctx, s, 0.02, 0x15);
  });
}
