// Single source of truth for every bundled asset URL. import.meta.glob used
// to be duplicated in bootPipeline and cgResourcePreloader (and would have
// kept duplicating per consumer); one module keeps the pattern, extensions,
// and chunk placement in exactly one place.
type AssetModules = Record<string, string>;

export const bundledAssetUrls: string[] = Object.values(
  import.meta.glob('../assets/**/*.{png,jpg,jpeg,webp,avif,glb}', {
    eager: true,
    import: 'default',
    query: '?url',
  }) as AssetModules,
);
