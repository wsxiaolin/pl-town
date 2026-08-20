export type Weather = 'clear' | 'rain' | 'snow' | 'snow-deep';

const WEATHER_KEY = 'minicityWeather';
const WEATHER_VALUES: readonly Weather[] = ['clear', 'rain', 'snow', 'snow-deep'];

export function isWeather(value: string | null | undefined): value is Weather {
  return WEATHER_VALUES.includes(value as Weather);
}

export function readWeather(): Weather {
  try {
    const saved = localStorage.getItem(WEATHER_KEY);
    return isWeather(saved) ? saved : 'clear';
  } catch {
    return 'clear';
  }
}

export function hasWeatherPreference(): boolean {
  try {
    return isWeather(localStorage.getItem(WEATHER_KEY));
  } catch {
    return false;
  }
}

export function weatherForDay(day: number): Weather {
  const cycle = ((day % 9) + 9) % 9;
  return cycle === 3 || cycle === 7 ? 'rain' : cycle === 5 ? 'snow' : 'clear';
}

export function persistWeather(weather: Weather): void {
  try { localStorage.setItem(WEATHER_KEY, weather); } catch { /* Storage can be unavailable. */ }
}
