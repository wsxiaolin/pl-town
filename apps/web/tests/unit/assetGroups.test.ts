import assert from 'node:assert/strict';
import test from 'node:test';
import { classifyAssetKey } from '../../src/core/assetGroups';

// The classifier must key off the GLOB KEY (source path), never the emitted
// URL: Vite flattens asset output, so a production URL has no `textures/`
// segment. These cases pin both shapes (review r6#B1 regression guard).
test('classifyAssetKey reads the source-path glob key, not the flattened build URL', () => {
  // Glob keys (what import.meta.glob actually yields).
  assert.equal(classifyAssetKey('../assets/textures/brick_red_color.png'), 'textures');
  assert.equal(classifyAssetKey('../assets/cg/act1-8.png'), 'cg');
  assert.equal(classifyAssetKey('../assets/moments/night.webp'), 'other');
  assert.equal(classifyAssetKey('../assets/models/tree.glb'), 'other');
  // Dev-server URLs keep the source path — classification still works.
  assert.equal(classifyAssetKey('/src/assets/textures/brick_red_color.png'), 'textures');
  // Production URLs are FLAT (hash-named, no directory) — a URL-based
  // classifier would return 'other' here and the download filter would be a
  // no-op. The key-based one never sees these strings.
  assert.equal(classifyAssetKey('/assets/brick_red_color-i_gCGM29.png'), 'other');
});
