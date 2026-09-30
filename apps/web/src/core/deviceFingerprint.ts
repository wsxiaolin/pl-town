const FINGERPRINT_KEY = 'minicityDeviceFingerprint.v2';

const hex = (buffer: ArrayBuffer): string => [...new Uint8Array(buffer)].map((byte) => byte.toString(16).padStart(2, '0')).join('');

const collectSignals = (): string => {
  const nav = navigator as Navigator & { deviceMemory?: number; hardwareConcurrency?: number };
  const screenInfo = typeof screen === 'undefined' ? '' : `${screen.width}x${screen.height}x${screen.colorDepth}`;
  return [
    nav.userAgent ?? '',
    nav.language ?? '',
    [...(nav.languages ?? [])].join(','),
    String(nav.hardwareConcurrency ?? 0),
    String(nav.deviceMemory ?? 0),
    screenInfo,
    Intl.DateTimeFormat().resolvedOptions().timeZone ?? '',
    String(new Date().getTimezoneOffset()),
  ].join('|');
};

const randomSalt = (): string => {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return hex(bytes.buffer);
};

type StoredFingerprint = { salt: string; hash: string };

const readStored = (): StoredFingerprint | null => {
  try {
    const raw = localStorage.getItem(FINGERPRINT_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as StoredFingerprint;
    if (parsed && /^[a-f0-9]{32}$/.test(parsed.salt) && /^[a-f0-9]{64}$/.test(parsed.hash)) return parsed;
  } catch { /* private mode or corrupt cache */ }
  return null;
};

export async function getDeviceFingerprint(): Promise<string | null> {
  try {
    const cached = readStored();
    if (cached) return cached.hash;
    const salt = randomSalt();
    const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(`${salt}|${collectSignals()}`));
    const hash = hex(digest);
    try { localStorage.setItem(FINGERPRINT_KEY, JSON.stringify({ salt, hash })); } catch { /* private mode */ }
    return hash;
  } catch {
    return null;
  }
}
