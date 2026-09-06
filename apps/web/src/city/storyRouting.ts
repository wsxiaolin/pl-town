import type { CityDialogController } from '../adapters/ui/cityDialogController';
import type { StoryEntryGate } from './storyEntryGate';

type StoryRouteController = {
  interactNpc: (actorId: string, dialogs: CityDialogController) => boolean;
  interactBuilding: (buildingId: string, dialogs: CityDialogController) => boolean;
  ownsEntry: (kind: 'actor' | 'building', targetId: string) => boolean;
};

export type StoryRouteEntry = readonly [string, StoryRouteController];

export type StoryRouter = {
  routeNpc: (actorId: string, dialogs: CityDialogController) => boolean;
  routeBuilding: (buildingId: string, dialogs: CityDialogController) => boolean;
};

/**
 * 剧情入口统一路由：按注册顺序尝试各剧情控制器；命中互斥门时对"确属剧情入口"的
 * 目标给出提示后回落默认交互，避免静默失败。
 */
export function createStoryRouter(options: {
  listControllers: () => readonly (readonly [string, StoryRouteController | null | undefined])[];
  gate: StoryEntryGate;
  showToast?: (message: string) => void;
}): StoryRouter {
  const route = (kind: 'actor' | 'building', targetId: string, dialogs: CityDialogController): boolean => {
    const entries = options.listControllers();
    let blockedByGate = false;
    for (const [id, controller] of entries) {
      if (!controller) continue;
      if (!options.gate(id)) {
        if (controller.ownsEntry(kind, targetId)) blockedByGate = true;
        continue;
      }
      const handled = kind === 'actor' ? controller.interactNpc(targetId, dialogs) : controller.interactBuilding(targetId, dialogs);
      if (handled) return true;
    }
    if (blockedByGate) options.showToast?.('当前有剧情正在进行中，先完成它吧');
    return false;
  };

  return {
    routeNpc: (actorId, dialogs) => route('actor', actorId, dialogs),
    routeBuilding: (buildingId, dialogs) => route('building', buildingId, dialogs),
  };
}
