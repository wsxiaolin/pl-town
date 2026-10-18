// On-demand diagnostics: shows which (archetype, variant) pairs the real
// centre/pair lot grid can produce. Run from the repo root:
//   npx tsx apps/web/tests/diagnostics/residence-variant-coverage.ts
import { residenceStyleSeedForLot, residenceArchetypeFor, residenceVariantFor, residenceYardVariantFor } from '../../src/rendering/residence/index';

const centers = [-33, -27, -21, -15, -9, -3, 3, 9, 15, 21, 27, 33];
const pairs: Array<[number, number]> = [[0, 0], [-1.35, 1.15], [1.25, -1.2]];
const counts = new Map<string, number>();
const yardCounts = [0, 0, 0, 0];
for (const x of centers) {
  for (const z of centers) {
    if (Math.hypot(x, z) < 4.8) continue;
    const dist = Math.max(Math.abs(x), Math.abs(z));
    const density = dist > 24 ? 0.5 : dist > 12 ? 0.8 : 1;
    pairs.forEach(([dx, dz], k) => {
      const seeded = Math.abs(Math.round((x + 41) * 97 + (z + 43) * 193 + k * 389)) % 1000 / 1000;
      if (seeded > density) return;
      const lx = x + dx;
      const lz = z + dz;
      const seed = residenceStyleSeedForLot(lx, lz);
      const archetype = residenceArchetypeFor(lx, lz, seed);
      const variant = residenceVariantFor(lx, lz, seed);
      const key = `${archetype}/${variant}`;
      counts.set(key, (counts.get(key) ?? 0) + 1);
      if (archetype === 4) yardCounts[residenceYardVariantFor(lx, lz, seed)]! += 1;
    });
  }
}
for (let archetype = 0; archetype < 8; archetype += 1) {
  const row = [0, 1, 2, 3].map((variant) => counts.get(`${archetype}/${variant}`) ?? 0);
  console.log(`archetype ${archetype}: ${row.join(' ')}`);
}
console.log(`courtyard yard variants: ${yardCounts.join(' ')}`);
