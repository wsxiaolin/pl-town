// Boot mode gate — decides whether a visit may take the fast path (moment
// splash, everything already on the device) or must run the heavy boot
// pipeline (full asset download + shader precompile behind the classic
// "正在下载城市资源" screen). The heavy path is required when:
//   1. it is the visitor's first entry (nothing cached yet);
//   2. the deployed build changed (web bundle id or server version differs);
//   3. the precache marker is gone (storage cleared / precompile missing).
// Debug overrides: `?boot=heavy|light` query param or
// `localStorage.minicityForceBoot = 'heavy'|'light'`.

declare const __MINICITY_BUILD_ID__: string;

import { townApiUrl } from '../core/townApi';

export type BootMode = 'heavy' | 'light';
export type BootReason = 'first-visit' | 'build-changed' | 'server-changed' | 'precache-missing' | 'forced' | 'cached';

export type BootDecision = {
  mode: BootMode;
  reason: BootReason;
  buildId: string;
  serverVersion: string | null;
};

const BUILD_KEY = 'minicityBuildId';
const PRECACHE_KEY = 'minicityPrecacheDone';
const SERVER_VERSION_KEY = 'minicityServerVersion';
const FORCE_KEY = 'minicityForceBoot';

const REASON_TEXT: Record<Exclude<BootReason, 'cached'>, string> = {
  'first-visit': '首次进入，正在准备小城的全部资源',
  'build-changed': '小城有更新，正在同步最新资源',
  'server-changed': '小城服务端已更新，正在重新预编译',
  'precache-missing': '本地预编译缓存丢失，正在重新准备',
  'forced': '正在按计划准备小城资源',
};

export function bootReasonText(reason: BootReason): string {
  return reason === 'cached' ? '资源已就绪' : REASON_TEXT[reason];
}

function storedForcedMode(): BootMode | null {
  const fromStorage = localStorage.getItem(FORCE_KEY);
  const fromQuery = new URLSearchParams(window.location.search).get('boot');
  const value = fromQuery ?? fromStorage;
  return value === 'heavy' || value === 'light' ? value : null;
}

async function probeServerVersion(signal: AbortSignal): Promise<string | null> {
  try {
    const response = await fetch(townApiUrl('/town-api/version'), { cache: 'no-store', signal });
    if (!response.ok) return null;
    const data = (await response.json()) as { version?: unknown; commit?: unknown };
    const version = typeof data.version === 'string' ? data.version : '';
    const commit = typeof data.commit === 'string' ? data.commit : '';
    return [version, commit].filter(Boolean).join('+') || null;
  } catch {
    return null; // Offline / static deploy: fall back to the local judgement.
  }
}

export async function resolveBootDecision(): Promise<BootDecision> {
  const forced = storedForcedMode();
  if (forced === 'heavy') return { mode: 'heavy', reason: 'forced', buildId: currentBuildId(), serverVersion: null };
  if (forced === 'light') return { mode: 'light', reason: 'cached', buildId: currentBuildId(), serverVersion: null };

  const buildId = currentBuildId();
  const knownBuild = localStorage.getItem(BUILD_KEY);
  const knownServerVersion = localStorage.getItem(SERVER_VERSION_KEY);
  const precacheDone = localStorage.getItem(PRECACHE_KEY) === '1';

  let reason: BootReason = 'cached';
  if (!knownBuild && !precacheDone) reason = 'first-visit';
  else if (!precacheDone) reason = 'precache-missing';
  else if (knownBuild !== buildId) reason = 'build-changed';

  // The server probe only runs when the local state looks healthy — a first
  // visit or a stale build already forces the heavy path without it.
  let serverVersion: string | null = null;
  if (reason === 'cached') {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 2_000);
    serverVersion = await probeServerVersion(controller.signal);
    clearTimeout(timeout);
    if (serverVersion !== null && knownServerVersion !== null && knownServerVersion !== serverVersion) reason = 'server-changed';
  }

  // Persist the latest observed versions so the next visit can compare.
  try {
    localStorage.setItem(BUILD_KEY, buildId);
    if (serverVersion !== null) localStorage.setItem(SERVER_VERSION_KEY, serverVersion);
  } catch { /* private mode etc. — heavy boot each visit is the safe fallback. */ }

  return { mode: reason === 'cached' ? 'light' : 'heavy', reason, buildId, serverVersion };
}

/** Persist the marker that this device holds a complete precache. */
export function markBootComplete(): void {
  try {
    localStorage.setItem(BUILD_KEY, currentBuildId());
    localStorage.setItem(PRECACHE_KEY, '1');
  } catch { /* ignore. */ }
}

/** Debug/test helper: forget the precache so the next visit runs heavy again. */
export function resetBootState(): void {
  localStorage.removeItem(BUILD_KEY);
  localStorage.removeItem(PRECACHE_KEY);
}

export function currentBuildId(): string {
  return __MINICITY_BUILD_ID__;
}
