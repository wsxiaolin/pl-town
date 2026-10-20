// Shared grain lattice for procedural texture painters.
//
// One 256² random field serves every painter, with a per-call offset so grains
// stay uncorrelated between textures. The old per-pixel Math.random() loop cost
// ~2.4 s of boot CPU across 62 painters; a lattice lookup keeps the pixel loop
// random-free, and Uint8ClampedArray clamps on store so the manual min/max
// branches are gone too.
//
// Both the lattice and the per-call offsets use a seeded PRNG so every boot
// paints identical pixels. That keeps visual regression runs stable and makes
// the painter output reproducible for offline/cached rendering.

const NOISE_LATTICE_SIZE = 256;
const NOISE_LATTICE_MASK = NOISE_LATTICE_SIZE - 1;
const NOISE_LATTICE_SEED = 0x51ed270b;

let noiseLattice: Float32Array | null = null;
let noiseCallIndex = 0;

/** Small, fast, deterministic PRNG (mulberry32). */
export function mulberry32(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function applyNoiseLattice(
  ctx: CanvasRenderingContext2D,
  size: number,
  amount: number,
  seed = 0,
): void {
  if (!noiseLattice) {
    noiseLattice = new Float32Array(NOISE_LATTICE_SIZE * NOISE_LATTICE_SIZE);
    const random = mulberry32(NOISE_LATTICE_SEED);
    for (let i = 0; i < noiseLattice.length; i++) noiseLattice[i] = random() - 0.5;
  }
  // Explicit seeds win; otherwise a monotonically increasing counter keeps
  // textures uncorrelated while remaining deterministic across boots.
  const offsetSeed = (seed || ++noiseCallIndex * 0x9e3779b1) >>> 0;
  const lattice = noiseLattice;
  const ox = (offsetSeed * 1103515245 + 12345) >>> 8 & NOISE_LATTICE_MASK;
  const oy = ((offsetSeed * 1103515245 + 12345) >>> 16) & NOISE_LATTICE_MASK;
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
