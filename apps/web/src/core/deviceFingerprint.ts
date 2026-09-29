const FINGERPRINT_KEY = 'minicityDeviceFingerprint';

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

export async function getDeviceFingerprint(): Promise<string | null> {
  try {
    const cached = localStorage.getItem(FINGERPRINT_KEY);
    if (cached && /^[a-f0-9]{64}$/.test(cached)) return cached;
    const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(collectSignals()));
    const hash = hex(digest);
    try { localStorage.setItem(FINGERPRINT_KEY, hash); } catch { /* private mode */ }
    return hash;
  } catch {
    return null;
  }
}
