// 主题/昼夜接线：themeClock（天空/路径/地面/灯具昼夜换装 + 游戏时钟）与
// themeSync（时刻同步 + 水面昼光 + 天气视觉刷新）的装配从组合根抽出，
// MiniCityApp 只保留状态所有权（isNight/gameClock）与窄上下文。
import { createCityThemeSync } from './cityThemeSync';
import { createThemeClock, type ThemeClockOptions } from './themeClock';

export type CityThemeWiringOptions = Pick<
  ThemeClockOptions,
  | 'getSkyTextures' | 'getScene' | 'getPalette' | 'getPathMaterials' | 'getGroundMaterials'
  | 'getLampGlobes' | 'getIsNight' | 'setIsNight' | 'getGameClock' | 'setGameClock'
  | 'announceGuide' | 'invalidateMapShot' | 'updateNpcSchedules' | 'getStats' | 'saveStats'
> & {
  setWaterDaylight: (daylight: number, instant?: boolean) => void;
  refreshWeatherVisual: () => void;
};

export function createCityThemeWiring(options: CityThemeWiringOptions) {
  const themeClock = createThemeClock(options);

  const themeSync = createCityThemeSync({
    applyClock: (night, instant) => themeClock.applyTheme(night, instant),
    syncClock: () => themeClock.syncTimeAndTheme(),
    setWaterDaylight: options.setWaterDaylight,
    refreshWeatherVisual: options.refreshWeatherVisual,
  });

  return { themeClock, themeSync };
}
