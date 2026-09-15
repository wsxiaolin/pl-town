export function createCityThemeSync(options: {
  applyClock: (night: boolean, instant?: boolean) => void;
  syncClock: () => void;
  setWaterDaylight: (daylight: number, instant?: boolean) => void;
  refreshWeatherVisual: () => void;
}) {
  function applyTheme(night: boolean, instant?: boolean) {
    options.applyClock(night, instant);
    options.setWaterDaylight(night ? 0 : 1, instant);
  }

  function syncTimeAndTheme() {
    options.syncClock();
    options.refreshWeatherVisual();
  }

  return { applyTheme, syncTimeAndTheme };
}

export type CityThemeSync = ReturnType<typeof createCityThemeSync>;
