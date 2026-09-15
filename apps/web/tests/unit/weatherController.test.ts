import assert from 'node:assert/strict';
import test from 'node:test';
import { createWeatherController } from '../../src/city/weatherController';
import type { Weather } from '../../src/city/weather';

test('weather controller ignores invalid values and reports change', () => {
  const applied: Array<[Weather, boolean]> = [];
  const weather = createWeatherController({
    initial: 'clear',
    apply: (next, changed) => applied.push([next, changed]),
  });

  weather.set('rain');
  weather.set('rain');
  weather.set('not-weather' as Weather);

  assert.equal(weather.get(), 'rain');
  assert.deepEqual(applied, [['rain', true], ['rain', false]]);
});
