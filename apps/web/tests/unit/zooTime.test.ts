import assert from 'node:assert/strict';
import test from 'node:test';
import {
  beijingDateParts,
  isFirstFriday,
  isZooMeetingDay,
  isZooMeetingHour,
  isZooMeetingWindow,
  isZooRain,
} from '../../src/city/zoo/zooTime';

// 北京时间正午 = UTC 04:00。
const beijingNoon = (year: number, month: number, day: number) => Date.UTC(year, month - 1, day, 4, 0, 0);

test('first Friday covers several months and rejects ordinary Fridays', () => {
  assert.equal(isFirstFriday(beijingNoon(2026, 11, 6)), true);
  assert.equal(isFirstFriday(beijingNoon(2026, 12, 4)), true);
  assert.equal(isFirstFriday(beijingNoon(2027, 1, 1)), true);
  assert.equal(isFirstFriday(beijingNoon(2027, 2, 5)), true);
  assert.equal(isFirstFriday(beijingNoon(2026, 11, 13)), false);
  assert.equal(isFirstFriday(beijingNoon(2026, 11, 1)), false);
  assert.equal(isZooMeetingDay(beijingNoon(2026, 11, 6)), true);
  assert.equal(isZooMeetingDay(beijingNoon(2026, 11, 7)), false);
});

test('first Friday is decided on the Asia/Shanghai calendar, not UTC', () => {
  const beforeBeijingMidnight = Date.UTC(2026, 10, 5, 16, 30, 0);
  const beforeBeijingMidnightEnd = Date.UTC(2026, 10, 6, 15, 59, 59);
  const afterBeijingMidnight = Date.UTC(2026, 10, 6, 16, 0, 0);
  assert.deepEqual(beijingDateParts(beforeBeijingMidnight), { year: 2026, month: 11, day: 6, weekday: 5 });
  assert.equal(isFirstFriday(beforeBeijingMidnight), true);
  assert.equal(isFirstFriday(beforeBeijingMidnightEnd), true);
  assert.equal(isFirstFriday(afterBeijingMidnight), false);
});

test('meeting window is 21:30 inclusive to 24:00 exclusive', () => {
  assert.equal(isZooMeetingHour(21 + 29 / 60 + 59 / 3600), false);
  assert.equal(isZooMeetingHour(21.5), true);
  assert.equal(isZooMeetingHour(23 + 59 / 60 + 59 / 3600), true);
  assert.equal(isZooMeetingHour(24), false);
  assert.equal(isZooMeetingHour(0), false);
  assert.equal(isZooMeetingHour(Number.NaN), false);
});

test('a meeting night requires both the calendar date and the game-hour window', () => {
  const firstFriday = beijingNoon(2026, 11, 6);
  const ordinaryFriday = beijingNoon(2026, 11, 13);
  assert.equal(isZooMeetingWindow({ now: firstFriday, gameHour: 21.5 }), true);
  assert.equal(isZooMeetingWindow({ now: firstFriday, gameHour: 23.99 }), true);
  assert.equal(isZooMeetingWindow({ now: firstFriday, gameHour: 21.49 }), false);
  assert.equal(isZooMeetingWindow({ now: ordinaryFriday, gameHour: 22 }), false);
});

test('rain helper reads the weather value', () => {
  assert.equal(isZooRain('rain'), true);
  assert.equal(isZooRain('clear'), false);
  assert.equal(isZooRain('snow'), false);
  assert.equal(isZooRain(undefined), false);
});
