// 烟花玩法装配件：把「引擎（粒子）→ 主题（春节装饰）→ 云端客户端 →
// 设计台 / 观景秀」这条装配链从 MiniCityApp 组合根里抽出来。组合根只保留
// 一次创建、帧回调转发、多人消息转发与销毁，避免 MiniCityApp 越过
// check:source-size 的 1000 行上限。
import type * as THREE from 'three';
import { createFireworksEngine } from '../../rendering/fireworksEngine';
import { createSpringFestivalDecor } from '../../rendering/springFestivalDecor';
import { createFestivalThemeController, type CityTheme } from '../festivalThemeController';
import {
  createFireworksClient,
  type FireworksClientMessage,
  type FireworksServerMessage,
} from './fireworksClient';
import { createObservationDeckShow, type CameraSnapshot } from './observationDeckShow';
import { createFireworksDesignerController } from '../../adapters/ui/fireworksDesignerController';
import { FIREWORKS_SHOP_FEATURE_ID, OBSERVATION_DECK_FEATURE_ID } from './fireworksFeatureIds';
import type { BuildingFeatureRegistry } from '../buildingFeatures/buildingFeatureRegistry';
import type { CityDialogController } from '../../adapters/ui/cityDialogController';

type SpringFestivalHelpers = Parameters<typeof createSpringFestivalDecor>[0]['helpers'];

export type FireworksDebug = {
  openDesigner: () => void;
  startShow: () => void;
  setTheme: (id: string) => void;
  launch: (design: unknown, x?: number, z?: number) => void;
};

export interface FireworksPlaykitDeps {
  scene: THREE.Scene;
  getViewportHeight: () => number;
  getIsNight: () => boolean;
  decorHelpers: SpringFestivalHelpers;
  view: {
    getZoom: () => number;
    snapshot: () => CameraSnapshot;
    restoreSnapshot: (snapshot: CameraSnapshot) => void;
    setCinematic: (active: boolean) => void;
    clearPlayerPath: () => void;
  };
  camera: {
    focus: (x: number, z: number, options: { zoom: number; duration: number }) => void;
    stop: () => void;
  } | undefined;
  movement: { setLocked: (active: boolean) => void } | undefined;
  getDialogs: () => CityDialogController | null;
  getMultiplayer: () => {
    sendFireworks: (message: FireworksClientMessage) => boolean;
    progression: { getProgress: () => { currency: number }; isOnline: () => boolean };
  } | undefined;
  showToast: (message: string) => void;
  registry: BuildingFeatureRegistry;
  signal: AbortSignal;
  document: Document;
}

export interface FireworksPlaykit {
  debug: FireworksDebug;
  update: (delta: number, elapsed: number) => void;
  applyTheme: (theme: unknown) => void;
  handleServerMessage: (message: unknown) => void;
  dispose: () => void;
}

// 组合根在 init 早期（installDebugApi）就要拿到 debug 句柄，而装配件在稍后
// 才创建。这里导出一个稳定的转发对象，内部指向当前活动装配件。
let active: FireworksPlaykit | null = null;

export const fireworksDebug: FireworksDebug = {
  openDesigner: () => active?.debug.openDesigner(),
  startShow: () => active?.debug.startShow(),
  setTheme: (id: string) => active?.debug.setTheme(id),
  launch: (design: unknown, x = -58, z = -12) => active?.debug.launch(design, x, z),
};

// 多人控制器的主题 / 烟花消息回调（稳定对象，可直接展开进 options）。
export const fireworksHandlers = {
  onTheme: (theme: unknown) => active?.applyTheme(theme),
  onFireworksMessage: (message: unknown) => active?.handleServerMessage(message),
};

export function createFireworksPlaykit(deps: FireworksPlaykitDeps): FireworksPlaykit {
  const engine = createFireworksEngine({
    scene: deps.scene,
    getZoom: () => deps.view.getZoom(),
    getViewportHeight: deps.getViewportHeight,
  });
  const theme = createFestivalThemeController({
    createDecor: () => createSpringFestivalDecor({
      scene: deps.scene,
      helpers: deps.decorHelpers,
      getIsNight: deps.getIsNight,
    }),
    showToast: deps.showToast,
  });
  const client = createFireworksClient({
    send: (message) => deps.getMultiplayer()?.sendFireworks(message) ?? false,
  });
  const designer = createFireworksDesignerController({
    document: deps.document,
    signal: deps.signal,
    client,
    showToast: deps.showToast,
    getCurrency: () => deps.getMultiplayer()?.progression.getProgress().currency ?? 0,
    isOnline: () => deps.getMultiplayer()?.progression.isOnline() ?? false,
  });
  const deckShow = createObservationDeckShow({
    engine,
    client,
    document: deps.document,
    signal: deps.signal,
    dialogs: deps.getDialogs,
    getCameraSnapshot: () => deps.view.snapshot(),
    focusCamera: (x, z, zoom) => deps.camera?.focus(x, z, { zoom, duration: 1.4 }),
    stopCamera: () => deps.camera?.stop(),
    restoreCamera: (snapshot) => deps.view.restoreSnapshot(snapshot),
    setCinematicActive: (isActive) => {
      deps.view.setCinematic(isActive);
      deps.movement?.setLocked(isActive);
    },
    clearPlayerPath: () => deps.view.clearPlayerPath(),
    showToast: deps.showToast,
  });

  const debug: FireworksDebug = {
    openDesigner: () => designer.open(),
    startShow: () => deckShow.interact(),
    setTheme: (id: string) => theme.apply({ id }),
    launch: (design: unknown, x = -58, z = -12) => engine.launch(
      design as Parameters<typeof engine.launch>[0],
      { x, z },
    ),
  };

  const unregister = [
    deps.registry.register({
      id: FIREWORKS_SHOP_FEATURE_ID,
      interact: () => { designer.open(); return true; },
    }),
    deps.registry.register({
      id: OBSERVATION_DECK_FEATURE_ID,
      interact: () => { deckShow.interact(); return true; },
    }),
  ];

  const playkit: FireworksPlaykit = {
    debug,
    update: (delta, elapsed) => {
      engine.update(delta, elapsed);
      theme.update(elapsed);
    },
    applyTheme: (value) => theme.apply(value as CityTheme),
    handleServerMessage: (message) => client.handleServerMessage(message as FireworksServerMessage),
    dispose: () => {
      unregister.forEach((fn) => fn());
      deckShow.dispose();
      designer.dispose();
      client.dispose();
      theme.dispose();
      engine.dispose();
      if (active === playkit) active = null;
    },
  };
  active = playkit;
  return playkit;
}
