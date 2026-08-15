const BEIJING_OFFSET_MS = 8 * 60 * 60 * 1000;
const REAL_MS_PER_GAME_HOUR = 60 * 1000;
const REAL_MS_PER_GAME_DAY = 24 * REAL_MS_PER_GAME_HOUR;

/** Current hour in the accelerated town clock: one real minute is one game hour. */
export function townGameHour(timestamp = Date.now()): number {
  return ((timestamp + BEIJING_OFFSET_MS) / REAL_MS_PER_GAME_HOUR) % 24;
}

/** Stable sequential day number for the accelerated town clock. */
export function townGameDay(timestamp = Date.now()): number {
  if (!Number.isFinite(timestamp)) throw new Error('timestamp must be finite');
  return Math.floor((timestamp + BEIJING_OFFSET_MS) / REAL_MS_PER_GAME_DAY);
}
