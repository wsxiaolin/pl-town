import type { BuildingEntity } from '../../city/buildingEntity';

// UI adapter for the bulletin board's outbound navigation. The board opens a
// standalone page (bulletin.html) rather than an in-city panel, so every DOM
// decision the feature needs lives here: resolving the page URL against the
// document base (subpath deployments such as GitHub Pages keep working),
// opening the tab while user activation is still live, and degrading to a
// clickable bar when the popup blocker swallows a walk-up arrival. The
// city-side interaction logic stays DOM-free and receives this as an
// injected seam, matching the module boundary the codebase already draws.

/** Resolves the bulletin page URL against the given base URI. */
export function resolveBulletinBoardUrl(base: string): string {
  return new URL('bulletin.html', base).href;
}

/** The bulletin page URL for the current document (baseURI keeps subpath deployments working). */
export function bulletinBoardUrl(): string {
  return resolveBulletinBoardUrl(document.baseURI);
}

let fallbackEl: HTMLDivElement | null = null;
let fallbackTimer: number | undefined;

// Popup-blocker fallback: a self-owned link bar instead of the shared
// #unlockToast — achievement / event toasts reuse that element and would
// otherwise overwrite (and hide the link of) this prompt within moments.
function showBulletinBoardFallback(url: string): void {
  fallbackEl?.remove();
  window.clearTimeout(fallbackTimer);
  const bar = document.createElement('div');
  bar.className = 'bulletin-fallback';
  bar.setAttribute('role', 'status');
  bar.setAttribute('aria-live', 'polite');
  const text = document.createElement('span');
  text.textContent = '浏览器拦下了新标签页——';
  const link = document.createElement('a');
  link.href = url;
  link.target = '_blank';
  link.rel = 'noopener noreferrer';
  link.textContent = '查看公告板';
  bar.append(text, link);
  // Clicking the bar's padding dismisses it; the link itself navigates.
  bar.addEventListener('click', (event) => { if (event.target === bar) bar.remove(); });
  document.body.append(bar);
  fallbackEl = bar;
  fallbackTimer = window.setTimeout(() => bar.remove(), 10_000);
}

/**
 * Opens the announcement page in a new tab. Returns false when the popup
 * blocker swallowed the call — a walk-up arrival has no user activation left
 * by the time the character reaches the board — in which case a bar with a
 * real link takes over: one more genuine click then gets the board open.
 */
export function openBulletinBoardTab(): boolean {
  const url = bulletinBoardUrl();
  const tab = window.open(url, '_blank', 'noopener');
  if (tab) return true;
  showBulletinBoardFallback(url);
  return false;
}

/**
 * Building labels that are outbound links rather than walk-and-interact
 * targets: the browser then owns the navigation, so middle-click, ⌘-click and
 * keyboard activation all work natively without user-activation bookkeeping.
 */
export function externalBulletinLabelHref(building: Pick<BuildingEntity, 'id'>): string | null {
  return building.id === 'bulletin' ? bulletinBoardUrl() : null;
}
