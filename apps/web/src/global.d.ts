import type { MiniCityDebugApi } from './city/debugApi';

declare global {
  interface Window {
    _mini?: MiniCityDebugApi;
  }

  /** Injected by vite.config.ts `define` — compile-time story suspension switch. */
  const __ECHO_STORY_SUSPENDED__: boolean;
}

export {};
