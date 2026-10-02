// Single source of truth for every bundled asset URL + its group. The group
// comes from the glob KEY (source path), because Vite flattens emitted URLs —
// see core/assetGroups.ts. import.meta.glob used to be duplicated across
// modules; one module keeps the pattern, extensions, and grouping in exactly
// one place.
//
// 「回声」暂停（vite.config.ts __ECHO_STORY_SUSPENDED__ = 'true'）时排除其 CG：
// 否则 eager glob 仍会把 2.3MB 的剧情图 emit 进产物、把 URL 写进主包映射表、
// 并让全量下载管线向玩家下发。恢复上线时删除 `!../assets/cg/echo/**` 这一行
// （与 __ECHO_STORY_SUSPENDED__ 翻转为 'false' 同一批提交）。
import { classifyAssetKey, type BundledAssetGroup } from './assetGroups';

type AssetModules = Record<string, string>;

export type BundledAsset = { url: string; group: BundledAssetGroup };

export const bundledAssets: BundledAsset[] = Object.entries(
  import.meta.glob(['../assets/**/*.{png,jpg,jpeg,webp,avif,glb}', '!../assets/cg/echo/**'], {
    eager: true,
    import: 'default',
    query: '?url',
  }) as AssetModules,
).map(([key, url]) => ({ url, group: classifyAssetKey(key) }));

/** Flat URL list (order preserved) for consumers that don't care about groups. */
export const bundledAssetUrls: string[] = bundledAssets.map((asset) => asset.url);
