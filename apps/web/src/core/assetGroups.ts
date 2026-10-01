// Asset group classification — BY GLOB KEY (stable source path), never by
// the emitted URL: Vite flattens asset output, so a production URL is
// `/assets/brick-hash.png` with no `textures/` segment left to match. The
// glob key (`../assets/textures/brick.png`) is the only shape that survives
// both dev and build.
export type BundledAssetGroup = 'textures' | 'cg' | 'other';

export function classifyAssetKey(key: string): BundledAssetGroup {
  if (key.includes('/textures/')) return 'textures';
  if (key.includes('/cg/')) return 'cg';
  return 'other';
}
