import { isWeather, type Weather } from './weather';

export function createWeatherController(options: {
  initial?: Weather;
  apply: (weather: Weather, changed: boolean) => void;
}) {
  let weather: Weather = options.initial ?? 'clear';

  function get(): Weather {
    return weather;
  }

  function set(next: Weather): void {
    if (!isWeather(next)) return;
    const changed = next !== weather;
    weather = next;
    options.apply(weather, changed);
  }

  return { get, set };
}
