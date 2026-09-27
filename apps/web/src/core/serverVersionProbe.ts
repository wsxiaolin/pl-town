// Server identity probe — fetches the /town-api/version fingerprint the
// boot gate compares. Networking lives in core/ per Agents.md; the decision
// matrix and storage markers stay in city/bootGate.
import { hasTownApiBase, townApiUrl } from './townApi';

const PROBE_TIMEOUT_MS = 4_500; // covers a cold-starting free-tier backend

export async function probeServerVersion(signal: AbortSignal): Promise<string | null> {
  // Static hosting (e.g. Pages without an API base) has nothing to probe —
  // decide locally instead of 404-ing on every light visit.
  if (!hasTownApiBase()) return null;
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

export async function refreshServerVersion(): Promise<string | null> {
  return probeServerVersion(AbortSignal.timeout(PROBE_TIMEOUT_MS));
}
