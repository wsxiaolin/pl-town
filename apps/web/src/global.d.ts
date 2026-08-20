import type { MiniCityDebugApi } from './city/debugApi';

declare global {
  interface Window {
    _mini?: MiniCityDebugApi;
  }
}

export {};
