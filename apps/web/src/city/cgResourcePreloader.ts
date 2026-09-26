import { bundledAssetUrls } from '../core/bundledAssets';

const assetUrls = bundledAssetUrls;

let preloadScheduled = false;

function appendPreload(url: string): void {
  if (document.head.querySelector(`link[data-cg-preload="${CSS.escape(url)}"]`)) return;

  const link = document.createElement('link');
  link.rel = 'preload';
  link.href = url;
  link.dataset.cgPreload = url;
  if (/\.(?:png|jpe?g|webp|avif)(?:$|\?)/i.test(url)) {
    link.as = 'image';
  } else {
    link.as = 'fetch';
    link.crossOrigin = 'anonymous';
  }
  document.head.append(link);
}

export function preloadLikelyCGResources(): void {
  if (preloadScheduled) return;
  preloadScheduled = true;

  const preload = () => Object.values(assetUrls).forEach(appendPreload);
  if ('requestIdleCallback' in window) {
    window.requestIdleCallback(preload, { timeout: 1500 });
  } else {
    globalThis.setTimeout(preload, 0);
  }
}
