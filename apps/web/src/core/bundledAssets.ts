// Single source of truth for every bundled asset URL + its group. The group
// comes from the glob KEY (source path), because Vite flattens emitted URLs —
// see core/assetGroups.ts. import.meta.glob used to be duplicated across
// modules; one module keeps the pattern, extensions, and grouping in exactly
// one place.
import { classifyAssetKey, type BundledAssetGroup } from './assetGroups';

type AssetModules = Record<string, string>;

export type BundledAsset = { url: string; group: BundledAssetGroup };

export const bundledAssets: BundledAsset[] = Object.entries(
  import.meta.glob('../assets/**/*.{png,jpg,jpeg,webp,avif,glb}', {
    eager: true,
    import: 'default',
    query: '?url',
  }) as AssetModules,
).map(([key, url]) => ({ url, group: classifyAssetKey(key) }));

/** Flat URL list (order preserved) for consumers that don't care about groups. */
export const bundledAssetUrls: string[] = bundledAssets.map((asset) => asset.url);
