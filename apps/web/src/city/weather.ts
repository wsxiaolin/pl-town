export type Weather = 'clear' | 'rain' | 'snow' | 'snow-deep';

const WEATHER_VALUES: readonly Weather[] = ['clear', 'rain', 'snow', 'snow-deep'];

export function isWeather(value: string | null | undefined): value is Weather {
  return WEATHER_VALUES.includes(value as Weather);
}
