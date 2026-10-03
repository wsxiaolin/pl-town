import type { MiniCityDebugApi } from './city/debugApi';

declare global {
  interface Window {
    _mini?: MiniCityDebugApi;
  }

  /** Injected by vite.config.ts `define` — compile-time story suspension switch.
   *
   * Deliberately global (unlike the module-local `declare const` of the other
   * three defines) so storyOrchestration can read it without an import cycle.
   * Side effect: calling createStoryOrchestration outside Vite (e.g. a node
   * unit test without a stub) throws ReferenceError — that is intentional
   * fail-fast, the flag is a build-time contract, not a runtime option. Node
   * tests stub it via `(globalThis as any).__ECHO_STORY_SUSPENDED__ = true`
   * (see tests/unit/bootStorage.test.ts:10). */
  const __ECHO_STORY_SUSPENDED__: boolean;
}

export {};
