import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

// Guards the moment tier thumbnails against drift from their originals
// (#201 r2): the three-sharpness ladder promises L1/L2 are the SAME picture
// as the original, only smaller. If an original is re-exported and the PIL
// regeneration command (docs/moment-boot.md) is not run, the ladder would
// show a different picture before the full still lands — silently, which is
// exactly the "picture changing" this feature exists to eliminate. This
// pins the ladder shape instead of the bytes (so a legitimate regeneration
// passes without touching this check): every moment ships both steps, widths
// are exactly 32/256, and each step's aspect ratio matches its original
// within ±1px of rounding.

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const momentsDir = join(repoRoot, 'apps', 'web', 'src', 'assets', 'moments');
const MOMENTS = ['dawn', 'noon', 'dusk', 'night'];
const STEPS = [
  { suffix: 'step1', width: 32 },
  { suffix: 'step2', width: 256 },
];

/**
 * Minimal WebP dimension reader (RIFF/VP8/VP8L/VP8X) — no dependencies, so
 * the check runs wherever node does. Layouts:
 * - 'RIFF' 0..4, riffSize 4..8, 'WEBP' 8..12, chunk fourcc 12..16, chunk
 *   size 16..20, payload 20...
 * - VP8 (lossy): frame tag 20..23, sync 9d 01 2a 23..26, then 14-bit LE
 *   width and height (top 2 bits of each uint16 are scaling hints).
 * - VP8L (lossless): signature 0x2f at 20, then a little-endian bitstream
 *   from 21: 14 bits width-1, 14 bits height-1.
 * - VP8X (extended, alpha/animation): 4 flag bytes 20..24, then 24-bit LE
 *   canvas width-1 and height-1.
 */
function webpSize(buf, label) {
  if (
    buf.length < 30 ||
    buf.toString('ascii', 0, 4) !== 'RIFF' ||
    buf.toString('ascii', 8, 12) !== 'WEBP'
  ) {
    throw new Error(`${label}: not a RIFF/WEBP file`);
  }
  const chunk = buf.toString('ascii', 12, 16);
  if (chunk === 'VP8X') {
    return {
      width: 1 + (buf[24] | (buf[25] << 8) | (buf[26] << 16)),
      height: 1 + (buf[27] | (buf[28] << 8) | (buf[29] << 16)),
    };
  }
  if (chunk === 'VP8 ') {
    if (buf[23] !== 0x9d || buf[24] !== 0x01 || buf[25] !== 0x2a) {
      throw new Error(`${label}: VP8 chunk missing start code`);
    }
    return {
      width: buf.readUInt16LE(26) & 0x3fff,
      height: buf.readUInt16LE(28) & 0x3fff,
    };
  }
  if (chunk === 'VP8L') {
    const bits = buf.readUInt32LE(21);
    return { width: (bits & 0x3fff) + 1, height: ((bits >> 14) & 0x3fff) + 1 };
  }
  throw new Error(`${label}: unknown chunk '${chunk}'`);
}

function rel(path) {
  return relative(repoRoot, path).split(sep).join('/');
}

const violations = [];
for (const name of MOMENTS) {
  const originalPath = join(momentsDir, `${name}.webp`);
  if (!existsSync(originalPath)) {
    violations.push(`${rel(originalPath)}: missing original`);
    continue;
  }
  const original = webpSize(readFileSync(originalPath), rel(originalPath));
  for (const step of STEPS) {
    const stepPath = join(momentsDir, `${name}-${step.suffix}.webp`);
    if (!existsSync(stepPath)) {
      violations.push(`${rel(stepPath)}: missing (regenerate with docs/moment-boot.md)`);
      continue;
    }
    const size = webpSize(readFileSync(stepPath), rel(stepPath));
    if (size.width !== step.width) {
      violations.push(`${rel(stepPath)}: width ${size.width}, expected exactly ${step.width}`);
    }
    const expectedHeight = Math.round((original.height * step.width) / original.width);
    if (Math.abs(size.height - expectedHeight) > 1) {
      violations.push(
        `${rel(stepPath)}: height ${size.height}, expected ${expectedHeight}±1 — aspect drift from ${name}.webp (${original.width}x${original.height}); regenerate the tiers (docs/moment-boot.md)`,
      );
    }
  }
}

if (violations.length) {
  console.error('Moment tier consistency check failed:');
  for (const violation of violations) console.error(`- ${violation}`);
  process.exitCode = 1;
} else {
  console.log(`Moment tier check passed: ${MOMENTS.length} moments x ${STEPS.length} steps, widths 32/256, aspect matched.`);
}
