// S014 动物园怪谈：每月例会夜的时间判定。
//
// 混合口径（实现计划 §2「真实日期 / 时间 / 天气事件」）：
// - 日期用真实北京时间（Asia/Shanghai）日历判断「每月第一个周五」；
// - 时段用加速后的 townGameHour() 判断 21:30–24:00，与 HUD 时钟和 NPC
//   排班一致（现实一分钟 = 游戏一小时）。
//
// now / gameHour 都可注入：测试可以锁定日历与窗口边界，运行时不传即用
// 当前真实时间和当前游戏时钟。
import { townGameHour } from '../../gameplay/time/townClock';

export const ZOO_MEETING_START_HOUR = 21.5;
export const ZOO_MEETING_END_HOUR = 24;
const BEIJING_OFFSET_MS = 8 * 60 * 60 * 1000;

export interface ZooMeetingClock {
  /** 真实时间戳（毫秒）；缺省 Date.now()。 */
  now?: number;
  /** 游戏小时（0–24）；缺省由 now 走 townGameHour()。 */
  gameHour?: number;
}

export interface BeijingDateParts {
  year: number;
  month: number;
  day: number;
  weekday: number;
}

/** 北京时间日历分量。weekday 与 Date#getDay 一致：周日=0，周五=5。 */
export function beijingDateParts(timestamp: number): BeijingDateParts {
  if (!Number.isFinite(timestamp)) throw new Error('timestamp must be finite');
  const date = new Date(timestamp + BEIJING_OFFSET_MS);
  return {
    year: date.getUTCFullYear(),
    month: date.getUTCMonth() + 1,
    day: date.getUTCDate(),
    weekday: date.getUTCDay(),
  };
}

/** 每月第一个周五：周五且日期落在 1–7 号。 */
export function isFirstFriday(timestamp: number): boolean {
  const { day, weekday } = beijingDateParts(timestamp);
  return weekday === 5 && day <= 7;
}

/** 例会夜的日期部分（不含时段）。 */
export function isZooMeetingDay(timestamp = Date.now()): boolean {
  return isFirstFriday(timestamp);
}

/** 21:30 ≤ 游戏小时 < 24:00。24:00 即次日 00:00，因此用左闭右开。 */
export function isZooMeetingHour(gameHour: number): boolean {
  return Number.isFinite(gameHour) && gameHour >= ZOO_MEETING_START_HOUR && gameHour < ZOO_MEETING_END_HOUR;
}

/** 例会夜 + 窗口同时成立时返回 true。 */
export function isZooMeetingWindow(clock: ZooMeetingClock = {}): boolean {
  const now = clock.now ?? Date.now();
  const hour = clock.gameHour ?? townGameHour(now);
  return isFirstFriday(now) && isZooMeetingHour(hour);
}

/** 雨天判定：cityGraphics 把天气写在 document.body.dataset.weather。 */
export function isZooRain(weather: string | null | undefined): boolean {
  return weather === 'rain';
}

/** 下一次例会夜的北京日期键（YYYY-MM-DD），供暂停提示使用。 */
export function nextZooMeetingDayKey(timestamp = Date.now()): string {
  const parts = beijingDateParts(timestamp);
  for (let offset = 0; offset <= 40; offset += 1) {
    const candidate = Date.UTC(parts.year, parts.month - 1, parts.day + offset, 4, 0, 0);
    if (!isFirstFriday(candidate)) continue;
    return new Date(candidate + BEIJING_OFFSET_MS).toISOString().slice(0, 10);
  }
  return new Date(timestamp + BEIJING_OFFSET_MS).toISOString().slice(0, 10);
}
