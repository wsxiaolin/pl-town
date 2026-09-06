import type { CityDialogController } from '../adapters/ui/cityDialogController';
import type { StoryEntryGate } from './storyEntryGate';

type StoryRouteController = {
  interactNpc: (actorId: string, dialogs: CityDialogController) => boolean | 'blocked';
  interactBuilding: (buildingId: string, dialogs: CityDialogController) => boolean | 'blocked';
  ownsEntry: (kind: 'actor' | 'building', targetId: string) => boolean;
};

export type StoryRouteEntry = readonly [string, StoryRouteController];

export type StoryRouter = {
  routeNpc: (actorId: string, dialogs: CityDialogController) => 'handled' | 'blocked' | 'unhandled';
  routeBuilding: (buildingId: string, dialogs: CityDialogController) => 'handled' | 'blocked' | 'unhandled';
};

/**
 * 剧情入口统一路由：按注册顺序尝试各剧情控制器；命中互斥门时对"确属剧情入口"的
 * 目标给出提示并消费交互，避免默认交互覆盖提示。
 */
export function createStoryRouter(options: {
  listControllers: () => readonly (readonly [string, StoryRouteController | null | undefined])[];
  gate: StoryEntryGate;
  showToast?: (message: string) => void;
}): StoryRouter {
  const route = (kind: 'actor' | 'building', targetId: string, dialogs: CityDialogController): 'handled' | 'blocked' | 'unhandled' => {
    const entries = options.listControllers();
    let blockedByGate = false;
    for (const [id, controller] of entries) {
      if (!controller) continue;
      if (!options.gate(id)) {
        if (controller.ownsEntry(kind, targetId)) blockedByGate = true;
        continue;
      }
      const handled = kind === 'actor' ? controller.interactNpc(targetId, dialogs) : controller.interactBuilding(targetId, dialogs);
      if (handled === 'blocked') return 'blocked';
      if (handled) return 'handled';
    }
    if (blockedByGate) {
      options.showToast?.('当前有剧情正在进行中，先完成它吧');
      return 'blocked';
    }
    return 'unhandled';
  };

  return {
    routeNpc: (actorId, dialogs) => route('actor', actorId, dialogs),
    routeBuilding: (buildingId, dialogs) => route('building', buildingId, dialogs),
  };
}
