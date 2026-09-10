import assert from 'node:assert/strict';
import test from 'node:test';
import { createCityThemeSync } from '../../src/city/cityThemeSync';

test('theme sync applies daylight and refreshes weather independently of clock internals', () => {
  const calls: string[] = [];
  const theme = createCityThemeSync({
    applyClock: (night, instant) => calls.push(`clock:${night}:${instant}`),
    syncClock: () => calls.push('sync'),
    setWaterDaylight: (daylight, instant) => calls.push(`water:${daylight}:${instant}`),
    refreshWeatherVisual: () => calls.push('weather'),
  });

  theme.applyTheme(true, false);
  theme.syncTimeAndTheme();

  assert.deepEqual(calls, ['clock:true:false', 'water:0:false', 'sync', 'weather']);
});
