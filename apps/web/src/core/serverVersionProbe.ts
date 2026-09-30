// Server identity probe — fetches the /town-api/version fingerprint the
// boot gate compares. Networking lives in core/ per Agents.md; the decision
// matrix and storage markers stay in city/bootGate.
import { hasTownApiBase, townApiUrl } from './townApi';

// Light-path budget: this probe sits on the reveal critical path for every
// daily visit, so a black-holed connection costs at most 1.5 s of dead
// splash. A COLD free-tier backend may exceed it on the first visit — that
// round fails open (local decision) and the NEXT visit catches the change,
// while governance (already parallel) still serves fresh content (r8#4).
const PROBE_TIMEOUT_MS = 1_500;

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
