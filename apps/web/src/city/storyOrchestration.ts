import type { Scene } from 'three';
import type { CityDialogController } from '../adapters/ui/cityDialogController';
import type { EchoStoryControllerOptions } from './echo/echoStoryController';
import { createEchoSuspendedController, type EchoStoryHandle } from './echo/echoSuspendedController';
import { createYesterdaySongController } from './yesterday/yesterdaySongController';
import { createMagiStoryController } from './magi/magiStoryController';
import { createOvercoatStoryController } from './overcoat/overcoatStoryController';
import { createChatRuinsStoryController } from './chatRuins/chatRuinsStoryController';
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
  echo: Omit<EchoStoryControllerOptions, 'setStoryPoints' | 'setActiveActors' | 'awardAchievement' | 'showToast' | 'getQuestContext' | 'updateNpcSchedules'>;
  getQuestContext: EchoStoryControllerOptions['getQuestContext'];
  awardAchievement: (id: string, name: string) => void;
  showToast?: (message: string) => void;
  updateNpcSchedules: () => void;
  /** S001 会沉的城端口（涂鸦欠条领取/玩家位置/对话框惰性引用）。 */
  chatRuins?: {
    claimReward?: (rewardId: string) => boolean | Promise<boolean>;
    getPlayerPosition?: () => { x: number; z: number } | null;
    getDialogs?: () => CityDialogController | null;
  };
  /** 场景 story 兴趣点激活集合统一出口（echo 与 S001 并集后下发）。 */
  setActiveStoryPoints: (ids: readonly string[]) => void;
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

  // 场景 story 兴趣点（echo 与 S001 各自上报，并集后统一下发渲染层）。
  let echoStoryPoints: ReadonlySet<string> = new Set();
  let chatRuinsStoryPoints: ReadonlySet<string> = new Set();
  function mergeStoryPoints() {
    options.setActiveStoryPoints([...echoStoryPoints, ...chatRuinsStoryPoints]);
  }

  // 「回声」槽位：暂停期间由占位控制器顶上（剧情内容不进包）。开关翻转后
  // esbuild 保留动态加载分支——真控制器按需加载并替换占位，同时补跑启动序列。
  const echoOptions: EchoStoryControllerOptions = {
    ...options.echo,
    setStoryPoints: (ids) => { echoStoryPoints = new Set(ids); mergeStoryPoints(); },
    getQuestContext: options.getQuestContext,
    awardAchievement: options.awardAchievement,
    showToast: options.showToast,
    updateNpcSchedules: options.updateNpcSchedules,
    setActiveActors: (ids) => { echoActiveActors = new Set(ids); mergeActiveStoryActorIds(); },
  };
  let echoDisposed = false;
  let echoBootScene: Scene | null = null;
  let echoBootstrapped = false;
  const echo: { current: EchoStoryHandle } = {
    current: createEchoSuspendedController({ showToast: options.showToast }),
  };
  // No typeof guard here on purpose: any runtime fallback would make the
  // replaced expression non-foldable for rollup's DCE and the story chunk
  // could sneak back into the build. Absent-flag node contexts are expected
  // to throw ReferenceError (see global.d.ts) — the flag is a build contract.
  if (!__ECHO_STORY_SUSPENDED__) {
    void import('./echo/echoStoryController').then(({ createEchoStoryController }) => {
      if (echoDisposed) return;
      const real = createEchoStoryController(echoOptions);
      echo.current = real;
      // Replay the boot sequence whichever order the lazy load and setupEcho
      // land in; bootstrapEcho is idempotent per controller.
      if (echoBootstrapped) {
        if (echoBootScene) real.setupScene(echoBootScene);
        real.setupGuide();
        real.restoreAchievements();
      }
    }).catch(() => { /* lazy chunk failure: the suspended shim keeps the city playable */ });
  }

  function bootstrapEcho(controller: EchoStoryHandle): void {
    if (!echoBootstrapped) return;
    if (echoBootScene) controller.setupScene(echoBootScene);
    controller.setupGuide();
    controller.restoreAchievements();
  }

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
  // S001 会沉的城（2026-10-31）：静态挂载（laxy 瓦/墓碑先生是常驻 NPC，
  // 不走 actor 显隐合并）。兴趣点上报与 echo 并集下发；接近触发由控制器
  // 内部 800ms 轮询驱动（start() 启动）。
  const chatRuins = createChatRuinsStoryController({
    ...shared,
    claimReward: options.chatRuins?.claimReward,
    getPlayerPosition: options.chatRuins?.getPlayerPosition,
    getDialogs: options.chatRuins?.getDialogs,
    setStoryPoints: (ids) => { chatRuinsStoryPoints = new Set(ids); mergeStoryPoints(); },
  });
  chatRuins.announceGuide();
  chatRuins.syncActiveActors();
  chatRuins.start();

  const listControllers = () => [
    ['echo', echo.current],
    ['yesterday', yesterday],
    ['magi', magi],
    ['overcoat', overcoat],
    ['chatruins', chatRuins],
  ] as const;

  const gate = createStoryEntryGate(listControllers);
  const router = createStoryRouter({
    listControllers,
    gate,
    showToast: options.showToast ?? showUnlockToast,
  });

  return {
    // Live slot: the suspended shim or the lazily loaded real controller.
    // Consumers MUST go through this getter — `const { echo } = stories` is
    // type-legal but pins the shim forever: the lazy swap below only rewrites
    // echo.current, a destructured copy would silently keep serving the
    // suspended controller after restore, with no error anywhere.
    get echo() { return echo.current; },
    yesterday,
    magi,
    overcoat,
    chatRuins,
    router,
    getActiveStoryActorIds: () => activeStoryActorIds,
    announceGuide() {
      echo.current.announceGuide();
      yesterday.announceGuide();
      magi.announceGuide();
      overcoat.announceGuide();
    },
    setupEcho(scene: Scene) {
      echoBootScene = scene;
      echoBootstrapped = true;
      bootstrapEcho(echo.current);
    },
    dispose() {
      echoDisposed = true;
      echoBootstrapped = false;
      echoBootScene = null;
      echo.current.dispose();
      yesterday.dispose();
      magi.dispose();
      overcoat.dispose();
      chatRuins.dispose();
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
