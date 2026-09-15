import type { CityDialogController } from '../adapters/ui/cityDialogController';
import { createEchoStoryController, type EchoStoryControllerOptions } from './echo/echoStoryController';
import { createYesterdaySongController } from './yesterday/yesterdaySongController';
import { createMagiStoryController } from './magi/magiStoryController';
import { createOvercoatStoryController } from './overcoat/overcoatStoryController';
import { createStoryEntryGate } from './storyEntryGate';
import { createStoryRouter } from './storyRouting';
import { showUnlockToast } from './toast';

type SideStoryFactory = typeof createYesterdaySongController;

function createTrackedSideStory(
  factory: SideStoryFactory,
  options: {
    awardAchievement: (id: string, name: string) => void;
    showToast: (message: string) => void;
    getQuestContext: EchoStoryControllerOptions['getQuestContext'];
    onActorsChanged: (ids: Set<string>) => void;
  },
) {
  const controller = factory({
    awardAchievement: options.awardAchievement,
    showToast: options.showToast,
    getQuestContext: options.getQuestContext,
    onActiveActorsChanged: (ids) => options.onActorsChanged(new Set(ids)),
  });
  controller.announceGuide();
  controller.syncActiveActors();
  return controller;
}

export function createStoryOrchestration(options: {
  echo: Omit<EchoStoryControllerOptions, 'setActiveActors' | 'awardAchievement' | 'showToast' | 'getQuestContext' | 'updateNpcSchedules'>;
  getQuestContext: EchoStoryControllerOptions['getQuestContext'];
  awardAchievement: (id: string, name: string) => void;
  showToast?: (message: string) => void;
  updateNpcSchedules: () => void;
}) {
  let echoActiveActors = new Set<string>();
  let yesterdayActiveActors = new Set<string>();
  let magiActiveActors = new Set<string>();
  let overcoatActiveActors = new Set<string>();
  let activeStoryActorIds = new Set<string>();

  function mergeActiveStoryActorIds() {
    activeStoryActorIds = new Set([...echoActiveActors, ...yesterdayActiveActors, ...magiActiveActors, ...overcoatActiveActors]);
    options.updateNpcSchedules();
  }

  const echo = createEchoStoryController({
    ...options.echo,
    getQuestContext: options.getQuestContext,
    awardAchievement: options.awardAchievement,
    showToast: options.showToast,
    updateNpcSchedules: options.updateNpcSchedules,
    setActiveActors: (ids) => { echoActiveActors = new Set(ids); mergeActiveStoryActorIds(); },
  });

  const shared = {
    awardAchievement: options.awardAchievement,
    showToast: options.showToast ?? showUnlockToast,
    getQuestContext: options.getQuestContext,
  };
  const yesterday = createTrackedSideStory(createYesterdaySongController, {
    ...shared,
    onActorsChanged: (ids) => { yesterdayActiveActors = ids; mergeActiveStoryActorIds(); },
  });
  const magi = createTrackedSideStory(createMagiStoryController, {
    ...shared,
    onActorsChanged: (ids) => { magiActiveActors = ids; mergeActiveStoryActorIds(); },
  });
  const overcoat = createTrackedSideStory(createOvercoatStoryController, {
    ...shared,
    onActorsChanged: (ids) => { overcoatActiveActors = ids; mergeActiveStoryActorIds(); },
  });

  const listControllers = () => [
    ['echo', echo],
    ['yesterday', yesterday],
    ['magi', magi],
    ['overcoat', overcoat],
  ] as const;

  const gate = createStoryEntryGate(listControllers);
  const router = createStoryRouter({
    listControllers,
    gate,
    showToast: options.showToast ?? showUnlockToast,
  });

  return {
    echo,
    yesterday,
    magi,
    overcoat,
    router,
    getActiveStoryActorIds: () => activeStoryActorIds,
    announceGuide() {
      echo.announceGuide();
      yesterday.announceGuide();
      magi.announceGuide();
      overcoat.announceGuide();
    },
    setupEcho(scene: Parameters<typeof echo.setupScene>[0]) {
      echo.setupScene(scene);
      echo.setupGuide();
      echo.restoreAchievements();
    },
    dispose() {
      echo.dispose();
      yesterday.dispose();
      magi.dispose();
      overcoat.dispose();
    },
  };
}

export type StoryOrchestration = ReturnType<typeof createStoryOrchestration>;

export function routeNpcDialog(
  router: StoryOrchestration['router'],
  dialogs: CityDialogController | null,
  npcId: string,
  openDefault: () => void,
  onHandled: () => void,
): void {
  const storyResult = dialogs ? router.routeNpc(npcId, dialogs) : 'unhandled';
  if (storyResult === 'handled') { onHandled(); return; }
  if (storyResult === 'blocked') return;
  openDefault();
}
