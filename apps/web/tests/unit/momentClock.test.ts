import assert from 'node:assert/strict';
import test from 'node:test';
import { momentForDate, momentForHour } from '../../src/core/momentClock';

test('moment boundaries switch exactly at 5/11/17/20 local hours', () => {
  const expected = (hour: number): string =>
    hour >= 5 && hour < 11 ? 'dawn'
    : hour >= 11 && hour < 17 ? 'noon'
    : hour >= 17 && hour < 20 ? 'dusk'
    : 'night';
  for (let hour = 0; hour < 24; hour += 1) {
    assert.equal(momentForHour(hour).name, expected(hour), `hour ${hour}`);
  }
});

test('boundary probes hit the documented edges', () => {
  assert.equal(momentForHour(4).name, 'night');
  assert.equal(momentForHour(5).name, 'dawn');
  assert.equal(momentForHour(10).name, 'dawn');
  assert.equal(momentForHour(11).name, 'noon');
  assert.equal(momentForHour(16).name, 'noon');
  assert.equal(momentForHour(17).name, 'dusk');
  assert.equal(momentForHour(19).name, 'dusk');
  assert.equal(momentForHour(20).name, 'night');
  assert.equal(momentForHour(23).name, 'night');
  assert.equal(momentForHour(0).name, 'night');
});

test('captions carry the moment label for the boot splash', () => {
  assert.ok(momentForHour(12).caption.includes('正午'));
  assert.ok(momentForHour(21).caption.includes('夜幕'));
});

test('momentForDate reads the caller-provided clock', () => {
  assert.equal(momentForDate(new Date('2026-09-26T03:00:00')).name, 'night');
  assert.equal(momentForDate(new Date('2026-09-26T06:00:00')).name, 'dawn');
  assert.equal(momentForDate(new Date('2026-09-26T14:00:00')).name, 'noon');
  assert.equal(momentForDate(new Date('2026-09-26T18:00:00')).name, 'dusk');
});
