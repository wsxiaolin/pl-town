import { townApiFetch } from './townApi';

const cacheKey = 'minicity.scene-mode';
let minimal = false;

export const isMinimalScene = () => minimal;

function remember(value: boolean) {
  try { sessionStorage.setItem(cacheKey, String(value)); } catch { /* Storage may be disabled. */ }
}

export async function loadSceneMode(): Promise<void> {
  try { minimal = sessionStorage.getItem(cacheKey) === 'true'; } catch { /* First visit or private storage. */ }
  try {
    const response = await townApiFetch('/town-api/scene-mode', { cache: 'no-store', signal: AbortSignal.timeout(4000) });
    if (!response.ok) return;
    const mode = await response.json();
    if (typeof mode?.minimal === 'boolean') {
      minimal = mode.minimal;
      remember(minimal);
    }
  } catch { /* Keep the last known mode when the city is offline. */ }
}

export function syncSceneMode(value: unknown): void {
  if (typeof value !== 'boolean' || value === minimal) return;
  remember(value);
  window.location.reload();
}
