import { CHENXI_RIVER_STATIONS } from '../river-chenxi';
import { smoothStep } from './noiseCore';

export const RIVER_DEPTH = 0.5;
export const RIVER_BANK_WIDTH = 2;

export interface RiverSample {
  readonly x: number;
  readonly z: number;
  readonly s: number;
  readonly waterY: number;
  readonly halfWidth: number;
  readonly nx: number;
  readonly nz: number;
}

// Cubic Hermite tangents preserve the westward direction and smooth the bends.
// Elevation and width use monotone smoothstep interpolation between stations.
function buildRiverSamples(): readonly RiverSample[] {
  const points: Array<{ x: number; z: number; waterY: number; halfWidth: number }> = [];
  const stations = CHENXI_RIVER_STATIONS;
  for (let i = 0; i + 1 < stations.length; i += 1) {
    const a = stations[i]!;
    const b = stations[i + 1]!;
    const prev = stations[Math.max(0, i - 1)]!;
    const next = stations[Math.min(stations.length - 1, i + 2)]!;
    const count = Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]) / 0.4);
    for (let j = 0; j < count; j += 1) {
      const t = j / count;
      const t2 = t * t;
      const t3 = t2 * t;
      const h00 = 2 * t3 - 3 * t2 + 1;
      const h10 = t3 - 2 * t2 + t;
      const h01 = -2 * t3 + 3 * t2;
      const h11 = t3 - t2;
      const coord = (axis: 0 | 1) => h00 * a[axis] + h10 * (b[axis] - prev[axis]) / (i === 0 ? 1 : 2)
        + h01 * b[axis] + h11 * (next[axis] - a[axis]) / (i + 2 === stations.length ? 1 : 2);
      const k = smoothStep(0, 1, t);
      points.push({ x: coord(0), z: coord(1), halfWidth: a[2] + (b[2] - a[2]) * k, waterY: a[3] + (b[3] - a[3]) * k });
    }
  }
  const last = stations[stations.length - 1]!;
  points.push({ x: last[0], z: last[1], halfWidth: last[2], waterY: last[3] });
  let s = 0;
  return points.map((point, i) => {
    const prev = points[Math.max(0, i - 1)]!;
    const next = points[Math.min(points.length - 1, i + 1)]!;
    if (i > 0) s += Math.hypot(point.x - prev.x, point.z - prev.z);
    const len = Math.hypot(next.x - prev.x, next.z - prev.z);
    return { ...point, s, nx: (next.z - prev.z) / len, nz: -(next.x - prev.x) / len };
  });
}

export const RIVER_SAMPLES = buildRiverSamples();

// Include a rounded spring cap, clipped by the same radial bank profile.
export function riverWaterRows(): readonly (RiverSample & { extent: number })[] {
  const source = RIVER_SAMPLES[0]!;
  const radius = source.halfWidth + RIVER_BANK_WIDTH;
  const cap = Array.from({ length: 10 }, (_, i) => {
    const along = radius * (1 - i / 10);
    return { ...source, x: source.x + source.nz * along, z: source.z - source.nx * along,
      extent: Math.sqrt(Math.max(0, radius * radius - along * along)) };
  });
  return [...cap, ...RIVER_SAMPLES.map((sample) => ({ ...sample, extent: sample.halfWidth + RIVER_BANK_WIDTH }))];
}

export function nearestRiverSample(x: number, z: number): (RiverSample & { d: number }) | null {
  if (x < -80 || x > 82 || z < -132 || z > -89) return null;
  let best: (RiverSample & { d: number }) | null = null;
  for (let i = 0; i + 1 < RIVER_SAMPLES.length; i += 1) {
    const a = RIVER_SAMPLES[i]!;
    const b = RIVER_SAMPLES[i + 1]!;
    // X bounds prune the dense westward curve for heightfield mesh sampling.
    if (x < b.x - 22 || x > a.x + 22) continue;
    const dx = b.x - a.x;
    const dz = b.z - a.z;
    const k = Math.max(0, Math.min(1, ((x - a.x) * dx + (z - a.z) * dz) / (dx * dx + dz * dz)));
    const px = a.x + dx * k;
    const pz = a.z + dz * k;
    const d = Math.hypot(x - px, z - pz);
    if (best && d >= best.d) continue;
    const len = Math.hypot(dx, dz);
    best = { x: px, z: pz, s: a.s + (b.s - a.s) * k, d,
      halfWidth: a.halfWidth + (b.halfWidth - a.halfWidth) * k,
      waterY: a.waterY + (b.waterY - a.waterY) * k, nx: dz / len, nz: -dx / len };
  }
  return best;
}

export function riverWaterYAt(x: number, z: number): number | null {
  const hit = nearestRiverSample(x, z);
  return hit && hit.d <= hit.halfWidth + RIVER_BANK_WIDTH ? hit.waterY : null;
}

// Absolute channel profile: a deep rounded bed, a wet bank above water, then
// a broad valley shoulder returning to background. Radial endpoint distance
// naturally closes the spring, with no zero-width end-cap division.
export function riverValleyAt(x: number, z: number): number {
  if (z >= -90) return 0;
  const hit = nearestRiverSample(x, z);
  if (!hit) return 0;
  const { d, halfWidth, waterY } = hit;
  const bedY = waterY - RIVER_DEPTH;
  if (d <= halfWidth) return bedY + 0.12 * (d / halfWidth) ** 2;
  const bankEnd = halfWidth + RIVER_BANK_WIDTH;
  const bankY = waterY + 0.10;
  let height: number;
  if (d <= bankEnd) height = bedY + 0.12 + (bankY - bedY - 0.12) * smoothStep(halfWidth, bankEnd, d);
  else height = bankY * (1 - smoothStep(bankEnd, bankEnd + 10, d));
  // Only the outer shoulder fades toward the plateau; the wet channel stays deep.
  return height * (1 - smoothStep(-92, -90, z));
}
