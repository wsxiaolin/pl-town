import assert from 'node:assert/strict';
import test from 'node:test';
import { classifyGpu } from '../../src/rendering/gpuCapability';

// Real driver strings as seen in WEBGL_debug_renderer_info across devices.
const CASES: Array<[string, string]> = [
  ['NVIDIA GeForce RTX 3080', 'discrete'],
  ['NVIDIA GeForce GTX 1650', 'discrete'],
  ['AMD Radeon RX 6800 XT (RADV)', 'discrete'],
  ['Intel(R) Arc(TM) A770 Graphics', 'discrete'],
  ['Radeon RX 570', 'discrete'],
  // APUs report like a plain "Radeon" — must NOT hit the discrete tier.
  ['AMD Radeon(TM) Graphics', 'integrated'],
  ['AMD Radeon 780M', 'integrated'],
  ['AMD Radeon(TM) Vega 8 Graphics', 'integrated'],
  ['Radeon HD 630', 'integrated'], // old iGPU class
  ['Intel(R) UHD Graphics 630', 'integrated'],
  ['Intel(R) Iris(R) Xe Graphics', 'integrated'],
  ['Mali-G78', 'integrated'],
  ['Adreno (TM) 660', 'integrated'],
  ['Apple M2', 'apple'],
  // Safari on Apple silicon reports no M-suffix at all.
  ['Apple GPU', 'apple'],
  ['SwiftShader (Software)', 'software'],
  ['llvmpipe ( LLVM 16)', 'software'],
  ['ANGLE (Basic Render)', 'software'],
  ['Some Unknown Renderer', 'unknown'],
];

test('classifyGpu maps real driver strings to the right tier', () => {
  for (const [renderer, expectedTier] of CASES) {
    assert.equal(classifyGpu(renderer).tier, expectedTier, `renderer "${renderer}"`);
  }
});
