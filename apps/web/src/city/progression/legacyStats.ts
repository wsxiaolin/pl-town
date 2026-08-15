export interface LegacyStats {
  interactions: number;
  buildingsVisited: string[];
  joinDate: number | null;
  unlockLevel: number;
  achievements: string[];
  npcsMet: string[];
  npcsTalked: number;
  distance: number;
  nightToggles: number;
}

const emptyStats = (): LegacyStats => ({
  interactions: 0,
  buildingsVisited: [],
  joinDate: null,
  unlockLevel: 0,
  achievements: [],
  npcsMet: [],
  npcsTalked: 0,
  distance: 0,
  nightToggles: 0,
});

const isRecord = (value: unknown): value is Record<string, unknown> =>
  !!value && typeof value === 'object' && !Array.isArray(value);

const asNumber = (value: unknown): number =>
  typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : 0;

const asStrings = (value: unknown): string[] =>
  Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : [];

export function getStats(storage: Pick<Storage, 'getItem'> = window.localStorage): LegacyStats {
  const raw = storage.getItem('minicityStats');
  if (!raw) return emptyStats();
  try {
    const value = JSON.parse(raw) as unknown;
    if (!isRecord(value)) return emptyStats();
    return {
      interactions: asNumber(value.interactions),
      buildingsVisited: asStrings(value.buildingsVisited),
      joinDate: typeof value.joinDate === 'number' ? value.joinDate : null,
      unlockLevel: asNumber(value.unlockLevel),
      achievements: asStrings(value.achievements),
      npcsMet: asStrings(value.npcsMet),
      npcsTalked: asNumber(value.npcsTalked),
      distance: asNumber(value.distance),
      nightToggles: asNumber(value.nightToggles),
    };
  } catch {
    return emptyStats();
  }
}

export function saveStats(stats: LegacyStats, storage: Pick<Storage, 'setItem'> = window.localStorage): void {
  storage.setItem('minicityStats', JSON.stringify(stats));
}

export function getUserId(storage: Pick<Storage, 'getItem' | 'setItem'> = window.localStorage): string {
  const existing = storage.getItem('minicityUserId');
  if (existing) return existing;
  const id = `usr_${Math.random().toString(36).slice(2, 10)}`;
  storage.setItem('minicityUserId', id);
  return id;
}

export function calcLevel(interactions: number): number {
  if (interactions >= 20) return 5;
  if (interactions >= 12) return 4;
  if (interactions >= 7) return 3;
  if (interactions >= 3) return 2;
  return 1;
}

export function formatTime(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  const remainder = seconds % 60;
  return `${minutes}m ${remainder < 10 ? `0${remainder}` : remainder}s`;
}

export function formatDate(timestamp: number): string {
  return new Date(timestamp).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

export function startTimeTracking(
  storage: Pick<Storage, 'getItem' | 'setItem'> = window.localStorage,
  setIntervalFn: typeof window.setInterval = window.setInterval.bind(window),
): number {
  return setIntervalFn(() => {
    const time = Number.parseInt(storage.getItem('minicityTime') || '0', 10) + 1;
    storage.setItem('minicityTime', String(time));
  }, 1000);
}

