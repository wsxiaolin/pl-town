export type OnboardingTutorialHint = {
  text: string;
  /** Optional keyboard chips, e.g. 'W A S D' renders four kbd keys. */
  keys?: string;
};

export type OnboardingTutorialStep = {
  kicker: string;
  title: string;
  lead: string;
  hints: OnboardingTutorialHint[];
};

export type OnboardingTutorialControllerOptions = {
  document: Document;
  signal: AbortSignal;
  storage?: Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;
  /** Called once the card is actually revealed (after waiting for a calm screen). */
  onReveal?: () => void;
};

const STORAGE_KEY = 'minicity.tutorial.v1';
const CALM_CHECK_INTERVAL_MS = 350;

/**
 * The tutorial copy mirrors the same facts documented in docs/new-user-guide.md.
 * Keep both in sync when gameplay changes (movement, map teleport, phone tabs).
 */
const TUTORIAL_STEPS: OnboardingTutorialStep[] = [
  {
    kicker: 'Welcome · 新居民报到',
    title: '欢迎来到物实小城',
    lead: '一座为物理实验室社区而建的小城。现实的 1 分钟是小城的 1 小时——白天黑夜、晴雨落雪，都在缓缓流转。',
    hints: [
      { text: '顶栏右侧的时间是小城时间，跟着现实昼夜走。' },
      { text: '这份引导随时可以跳过，之后在小城玩得开心就好。' },
    ],
  },
  {
    kicker: 'Move · 出发',
    title: '先学会走路',
    lead: '三种方式都能让角色动起来，选最顺手的一种。',
    hints: [
      { text: '点击任意道路，角色会沿着路网自己走过去。' },
      { text: '或用键盘直接移动：', keys: 'W A S D' },
      { text: '触屏设备：按住屏幕拖动，唤出方向盘。' },
    ],
  },
  {
    kicker: 'Explore · 城市探索',
    title: '点开一栋建筑',
    lead: '每栋建筑都有自己的故事，头顶的小标签会先告诉你它是谁。',
    hints: [
      { text: '报摊收藏每一期《星辉周刊》。' },
      { text: '书院陈列居民作品，音乐厅可以点歌。' },
      { text: '纪念碑铭记为小城付出过的人。' },
    ],
  },
  {
    kicker: 'Map · 全景地图',
    title: '打开地图看看',
    lead: '小城不小，地图会告诉你路怎么走。',
    hints: [
      { text: '顶栏「地图」按钮展开全景地图。' },
      { text: '搜索框支持按建筑名称、编号模糊查找。' },
      { text: '累计步行 100 米后解锁传送，一键抵达想去的地方。' },
    ],
  },
  {
    kicker: 'Phone · 居民手机',
    title: '你的手机在兜里',
    lead: '右下角的手机图标是居民生活的入口。',
    hints: [
      { text: '公聊：和全镇居民实时连线。' },
      { text: '住宅：认领一间小屋，进度保存在服务器。' },
      { text: '背包：存放物实币与收集到的物品。' },
    ],
  },
  {
    kicker: 'Identity · 唯一身份',
    title: '签下你的名字',
    lead: '一个昵称加一个密码，就是这座城的居民证。',
    hints: [
      { text: '顶栏「登录」用昵称与密码建立身份。' },
      { text: '昵称至少两个字，支持中文、英文、数字。' },
      { text: '成就与游戏进度会跟随这个身份保存。' },
    ],
  },
  {
    kicker: 'Render · 画面与性能',
    title: '调一杯合适的画质',
    lead: '顶栏的齿轮是画面设置，卡顿时先来这里。',
    hints: [
      { text: '节能 / 均衡 / 高清 / 极致四档画质。' },
      { text: '手机建议「均衡」，桌面可以试试「高清」。' },
      { text: '仍不流畅时，可以关闭实时阴影。' },
    ],
  },
  {
    kicker: 'Ready · 上路吧',
    title: '小城的故事，由你继续',
    lead: '祝你玩得开心。迷路时，控制台里的 window._mini 还有更多玩法等着你。',
    hints: [
      { text: '浏览器控制台输入 window._mini.tutorial.start() 可重看本引导。' },
      { text: '完整玩家手册在仓库 docs/new-user-guide.md。' },
    ],
  },
];

export function createOnboardingTutorialController(options: OnboardingTutorialControllerOptions) {
  const doc = options.document;
  const storage = options.storage ?? doc.defaultView?.localStorage;
  let stepIndex = 0;
  let active = false;
  let calmPoll = 0;

  const overlay = doc.getElementById('tutorialOverlay');
  const kicker = doc.getElementById('tutorialKicker');
  const count = doc.getElementById('tutorialCount');
  const title = doc.getElementById('tutorialTitle');
  const lead = doc.getElementById('tutorialLead');
  const hints = doc.getElementById('tutorialHints');
  const dots = doc.getElementById('tutorialDots');
  const skipButton = doc.getElementById('tutorialSkip') as HTMLButtonElement | null;
  const prevButton = doc.getElementById('tutorialPrev') as HTMLButtonElement | null;
  const nextButton = doc.getElementById('tutorialNext') as HTMLButtonElement | null;

  function isCompleted(): boolean {
    return storage?.getItem(STORAGE_KEY) === 'done';
  }

  function markCompleted(): void {
    try {
      storage?.setItem(STORAGE_KEY, 'done');
    } catch {
      // Private browsing may block storage; the tutorial simply won't auto-show again.
    }
  }

  function reset(): void {
    try {
      storage?.removeItem(STORAGE_KEY);
    } catch {
      // Ignore storage failures.
    }
  }

  /**
   * The card must not cover the boot screen, the opening CG, or the login
   * overlay, so it waits until those are gone before revealing itself.
   */
  function isScreenCalm(): boolean {
    const boot = doc.getElementById('bootScreen');
    if (boot && !boot.classList.contains('is-ready') && boot.isConnected) return false;
    const login = doc.getElementById('loginOverlay');
    if (login && login.isConnected && login.style.display !== 'none' && !login.classList.contains('hidden')) return false;
    const cg = doc.getElementById('cgOverlay');
    if (cg && cg.classList.contains('active')) return false;
    return true;
  }

  function renderHint(hint: OnboardingTutorialHint): HTMLLIElement {
    const item = doc.createElement('li');
    item.className = 'tutorial-hint';
    item.append(hint.text);
    if (hint.keys) {
      for (const key of hint.keys.split(' ')) {
        const chip = doc.createElement('kbd');
        chip.textContent = key;
        item.append(' ', chip);
      }
    }
    return item;
  }

  function render(): void {
    const step = TUTORIAL_STEPS[stepIndex];
    if (!step) return;
    const isFinal = stepIndex === TUTORIAL_STEPS.length - 1;
    if (kicker) kicker.textContent = step.kicker;
    if (title) title.textContent = step.title;
    if (lead) lead.textContent = step.lead;
    if (count) count.textContent = `${String(stepIndex + 1).padStart(2, '0')} / ${String(TUTORIAL_STEPS.length).padStart(2, '0')}`;
    if (hints) {
      hints.replaceChildren(...step.hints.map(renderHint));
    }
    if (dots) {
      dots.replaceChildren(...TUTORIAL_STEPS.map((_, index) => {
        const dot = doc.createElement('span');
        dot.className = index === stepIndex ? 'tutorial-dot is-active' : 'tutorial-dot';
        return dot;
      }));
    }
    if (prevButton) prevButton.disabled = stepIndex === 0;
    if (nextButton) nextButton.textContent = isFinal ? '开始探索' : '下一步';
  }

  function reveal(): void {
    if (!overlay || active) return;
    active = true;
    stepIndex = 0;
    overlay.hidden = false;
    render();
    requestAnimationFrame(() => requestAnimationFrame(() => overlay.classList.add('open')));
    nextButton?.focus({ preventScroll: true });
    options.onReveal?.();
  }

  function dismiss(markDone: boolean): void {
    if (!overlay || !active) return;
    active = false;
    window.clearInterval(calmPoll);
    calmPoll = 0;
    if (markDone) markCompleted();
    overlay.classList.remove('open');
    window.setTimeout(() => {
      if (!active) overlay.hidden = true;
    }, 360);
  }

  function start(): void {
    if (active || !overlay || overlay.isConnected === false) return;
    if (isScreenCalm()) {
      reveal();
      return;
    }
    // Boot / CG / login still on stage: retry shortly until the screen is calm.
    window.clearInterval(calmPoll);
    calmPoll = window.setInterval(() => {
      if (isScreenCalm()) {
        window.clearInterval(calmPoll);
        calmPoll = 0;
        reveal();
      }
    }, CALM_CHECK_INTERVAL_MS);
  }

  function next(): void {
    if (stepIndex >= TUTORIAL_STEPS.length - 1) {
      dismiss(true);
      return;
    }
    stepIndex += 1;
    render();
  }

  function previous(): void {
    if (stepIndex === 0) return;
    stepIndex -= 1;
    render();
  }

  skipButton?.addEventListener('click', () => dismiss(true), { signal: options.signal });
  prevButton?.addEventListener('click', previous, { signal: options.signal });
  nextButton?.addEventListener('click', next, { signal: options.signal });

  options.document.defaultView?.addEventListener('keydown', (event) => {
    if (!active) return;
    const target = event.target;
    if (target instanceof HTMLElement && target.closest('input, textarea, select, [contenteditable="true"]')) return;
    if (event.key === 'ArrowRight' || event.key === 'Enter') {
      event.preventDefault();
      next();
    } else if (event.key === 'ArrowLeft') {
      event.preventDefault();
      previous();
    } else if (event.key === 'Escape') {
      event.preventDefault();
      dismiss(true);
    }
  }, { signal: options.signal });

  options.signal.addEventListener('abort', () => {
    window.clearInterval(calmPoll);
    calmPoll = 0;
    if (overlay && active) {
      active = false;
      overlay.hidden = true;
      overlay.classList.remove('open');
    }
  });

  return {
    start,
    reset,
    isCompleted,
    isActive: () => active,
    stepCount: TUTORIAL_STEPS.length,
  };
}

export type OnboardingTutorialController = ReturnType<typeof createOnboardingTutorialController>;
