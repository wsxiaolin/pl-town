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

function safeGet(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null; // Private mode etc. — treated as "nothing known yet".
  }
}

function storedForcedMode(): BootMode | null {
  let fromStorage: string | null = null;
  try {
    fromStorage = localStorage.getItem(FORCE_KEY);
  } catch { /* private mode etc. */ }
  const fromQuery = new URLSearchParams(window.location.search).get('boot');
  const value = fromQuery ?? fromStorage;
  return value === 'heavy' || value === 'light' ? value : null;
}

async function probeServerVersion(signal: AbortSignal): Promise<string | null> {
  try {
    const response = await fetch(townApiUrl('/town-api/version'), { cache: 'no-store', signal });
    if (!response.ok) return null;
    const payload = (await response.json()) as { fingerprint?: unknown };
    if (typeof payload.fingerprint !== 'string' || !payload.fingerprint) return null;
    return payload.fingerprint;
  } catch {
    return null; // Offline / static deploy: fall back to the local judgement.
  }
}

export async function resolveBootDecision(): Promise<BootDecision> {
  const forced = storedForcedMode();
  if (forced === 'heavy') return { mode: 'heavy', reason: 'forced', buildId: currentBuildId(), serverVersion: null };
  if (forced === 'light') return { mode: 'light', reason: 'cached', buildId: currentBuildId(), serverVersion: null };

  const buildId = currentBuildId();
  const knownBuild = safeGet(BUILD_KEY);
  const knownServerVersion = safeGet(SERVER_VERSION_KEY);
  const precacheDone = safeGet(PRECACHE_KEY) === '1';

  let reason: BootReason = 'cached';
  if (!knownBuild && !precacheDone) reason = 'first-visit';
  else if (!precacheDone) reason = 'precache-missing';
  else if (knownBuild !== buildId) reason = 'build-changed';

  // The server probe only runs when the local state looks healthy — a first
  // visit or a stale build already forces the heavy path without it. 4.5 s
  // covers a cold-starting free-tier backend; AbortSignal.timeout keeps the
  // fetch itself from ever hanging the decision.
  let serverVersion: string | null = null;
  if (reason === 'cached') {
    serverVersion = await probeServerVersion(AbortSignal.timeout(4_500));
    if (serverVersion === null) console.warn('bootGate: /town-api/version probe failed — deciding locally');
    if (serverVersion !== null && knownServerVersion !== null && knownServerVersion !== serverVersion) reason = 'server-changed';
  }

  // Persist ONLY the server version, and only for a light decision (nothing
  // pending). The build id is deliberately NOT written here: markBootComplete
  // owns it, so a heavy boot that dies mid-download leaves the old build id
  // in place and the next visit re-runs the update instead of trusting a
  // precache that never landed.
  if (reason === 'cached' && serverVersion !== null) {
    try {
      localStorage.setItem(SERVER_VERSION_KEY, serverVersion);
    } catch { /* private mode etc. — heavy boot each visit is the safe fallback. */ }
  }

  return { mode: reason === 'cached' ? 'light' : 'heavy', reason, buildId, serverVersion };
}

/**
 * Persist the marker that this device holds a complete precache. The server
 * version observed by a heavy boot lands here — i.e. only after the pipeline
 * (download → precompile) actually finished.
 */
export function markBootComplete(serverVersion?: string | null): void {
  try {
    localStorage.setItem(BUILD_KEY, currentBuildId());
    localStorage.setItem(PRECACHE_KEY, '1');
    if (serverVersion) localStorage.setItem(SERVER_VERSION_KEY, serverVersion);
  } catch { /* ignore. */ }
}

export function currentBuildId(): string {
  return __MINICITY_BUILD_ID__;
}
