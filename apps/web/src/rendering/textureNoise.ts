// Shared grain lattice for procedural texture painters.
//
// One 256² random field serves every painter, with a per-call random offset
// so grains stay uncorrelated between textures. The old per-pixel
// Math.random() loop cost ~2.4 s of boot CPU across 62 painters; a lattice
// lookup keeps the pixel loop random-free, and Uint8ClampedArray clamps on
// store so the manual min/max branches are gone too.

const NOISE_LATTICE_SIZE = 256;
const NOISE_LATTICE_MASK = NOISE_LATTICE_SIZE - 1;

let noiseLattice: Float32Array | null = null;

export function applyNoiseLattice(ctx: CanvasRenderingContext2D, size: number, amount: number): void {
  if (!noiseLattice) {
    noiseLattice = new Float32Array(NOISE_LATTICE_SIZE * NOISE_LATTICE_SIZE);
    for (let i = 0; i < noiseLattice.length; i++) noiseLattice[i] = Math.random() - 0.5;
  }
  const lattice = noiseLattice;
  const ox = (Math.random() * NOISE_LATTICE_SIZE) | 0;
  const oy = (Math.random() * NOISE_LATTICE_SIZE) | 0;
  const img = ctx.getImageData(0, 0, size, size);
  const data = img.data;
  const scale = amount * 255;
  for (let y = 0, p = 0; y < size; y++) {
    const row = ((y + oy) & NOISE_LATTICE_MASK) << 8;
    for (let x = 0; x < size; x++, p += 4) {
      const n = lattice[row + ((x + ox) & NOISE_LATTICE_MASK)]! * scale;
      data[p]! += n;
      data[p + 1]! += n;
      data[p + 2]! += n;
    }
  }
  ctx.putImageData(img, 0, 0);
}
