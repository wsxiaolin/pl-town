import { ZOO_ACHIEVEMENT_IDS } from '../../gameplay/content/stories/zoo/zooMeta';

export const ZOO_PENDING_ACHIEVEMENTS_KEY = 'zoo.pending-achievements.v1';

const KNOWN_ACHIEVEMENTS: ReadonlySet<string> = new Set(Object.values(ZOO_ACHIEVEMENT_IDS));

export function normalizePendingAchievementIds(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  const result: string[] = [];
  for (const item of value) {
    if (typeof item === 'string' && KNOWN_ACHIEVEMENTS.has(item) && !result.includes(item)) result.push(item);
    if (result.length >= KNOWN_ACHIEVEMENTS.size) break;
  }
  return result;
}

export function parsePendingAchievementIds(raw: string | null): string[] {
  if (!raw) return [];
  try {
    return normalizePendingAchievementIds(JSON.parse(raw));
  } catch {
    return [];
  }
}
