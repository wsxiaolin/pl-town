const STORAGE_KEY = 'minicity.tutorial.v1';
const CALM_CHECK_MS = 280;

type TutorialPlacement = 'center' | 'bottom' | 'top' | 'left' | 'right';

type TutorialStep = {
  kicker: string;
  title: string;
  lead: string;
  hint: string;
  target?: string;
  placement: TutorialPlacement;
  action?: string;
};

export type OnboardingTutorialControllerOptions = {
  document: Document;
  signal: AbortSignal;
  storage?: Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;
};

const STEPS: TutorialStep[] = [
  {
    kicker: 'WELCOME · 新居民报到',
    title: '欢迎来到物实小城',
    lead: '这是一座会呼吸的小城。日光、夜色和天气都在慢慢流转，故事藏在街道与建筑里。',
    hint: '接下来会依次点亮你真正会用到的入口。',
    placement: 'center',
  },
  {
    kicker: 'MOVE · 出发',
    title: '先学会走路',
    lead: '点击道路，角色会沿着路网走过去；键盘也能直接移动。',
    hint: '触屏按住拖动，可唤出方向盘。',
    target: '.you-block',
    placement: 'right',
    action: '试着点一下道路',
  },
  {
    kicker: 'MAP · 全景地图',
    title: '打开地图看看',
    lead: '小城比第一眼看起来更大。地图能搜索建筑，并在走远后解锁传送。',
    hint: '点亮的按钮就是入口。',
    target: '#mapToggle',
    placement: 'bottom',
    action: '打开地图',
  },
  {
    kicker: 'PHONE · 居民手机',
    title: '你的生活入口',
    lead: '公聊、住宅和背包都收在这部手机里。',
    hint: '右下角这个按钮随时都能打开。',
    target: '#onlinePanelToggle',
    placement: 'left',
    action: '打开手机',
  },
  {
    kicker: 'IDENTITY · 居民身份',
    title: '签下你的名字',
    lead: '昵称加密码，就是这座城的居民证。成就与进度会跟着身份保存。',
    hint: '之后也能从这里重新登录。',
    target: '#logoUser',
    placement: 'bottom',
  },
  {
    kicker: 'READY · 上路吧',
    title: '故事由你继续',
    lead: '去遇见街道、建筑和还在等你的人。',
    hint: '控制台输入 window._mini.tutorial.start() 可重看引导。',
    placement: 'center',
  },
];

function isOverlayBlocking(element: Element | null): boolean {
  if (!element) return false;
  const style = element.ownerDocument.defaultView?.getComputedStyle(element);
  if (!style || style.display === 'none' || style.visibility === 'hidden') return false;
  return !element.classList.contains('hidden') && !element.classList.contains('is-ready');
}

export function createOnboardingTutorialController(options: OnboardingTutorialControllerOptions) {
  const doc = options.document;
  const storage = options.storage ?? doc.defaultView?.localStorage;
  const overlay = doc.getElementById('tutorialOverlay');
  const hole = doc.getElementById('tutorialHole');
  const maskTop = doc.getElementById('tutorialMaskTop');
  const maskRight = doc.getElementById('tutorialMaskRight');
  const maskBottom = doc.getElementById('tutorialMaskBottom');
  const maskLeft = doc.getElementById('tutorialMaskLeft');
  const card = doc.getElementById('tutorialCard');
  const kicker = doc.getElementById('tutorialKicker');
  const count = doc.getElementById('tutorialCount');
  const title = doc.getElementById('tutorialTitle');
  const lead = doc.getElementById('tutorialLead');
  const hint = doc.getElementById('tutorialHint');
  const dots = doc.getElementById('tutorialDots');
  const skipButton = doc.getElementById('tutorialSkip') as HTMLButtonElement | null;
  const prevButton = doc.getElementById('tutorialPrev') as HTMLButtonElement | null;
  const nextButton = doc.getElementById('tutorialNext') as HTMLButtonElement | null;

  let index = 0;
  let active = false;
  let calmTimer = 0;
  let layoutTimer = 0;
  let highlighted: Element | null = null;

  function isCompleted(): boolean {
    return storage?.getItem(STORAGE_KEY) === 'done';
  }

  function markCompleted(): void {
    try { storage?.setItem(STORAGE_KEY, 'done'); } catch {}
  }

  function isCalm(): boolean {
    return !isOverlayBlocking(doc.getElementById('bootScreen'))
      && !isOverlayBlocking(doc.getElementById('loginOverlay'))
      && !isOverlayBlocking(doc.getElementById('cgOverlay'));
  }

  function step(): TutorialStep {
    return STEPS[index] ?? STEPS[0]!;
  }

  function clearHighlight(): void {
    highlighted?.classList.remove('tutorial-target');
    highlighted = null;
  }

  function placeCard(targetBox: DOMRect | null, placement: TutorialPlacement): void {
    if (!card) return;
    const margin = 18;
    const width = card.offsetWidth || 320;
    const height = card.offsetHeight || 220;
    const viewW = doc.documentElement.clientWidth;
    const viewH = doc.documentElement.clientHeight;
    let left = (viewW - width) / 2;
    let top = (viewH - height) / 2;

    if (targetBox && placement !== 'center') {
      if (placement === 'bottom') {
        left = targetBox.left + targetBox.width / 2 - width / 2;
        top = targetBox.bottom + margin;
      } else if (placement === 'top') {
        left = targetBox.left + targetBox.width / 2 - width / 2;
        top = targetBox.top - height - margin;
      } else if (placement === 'left') {
        left = targetBox.left - width - margin;
        top = targetBox.top + targetBox.height / 2 - height / 2;
      } else {
        left = targetBox.right + margin;
        top = targetBox.top + targetBox.height / 2 - height / 2;
      }
    }

    left = Math.min(Math.max(16, left), viewW - width - 16);
    top = Math.min(Math.max(16, top), viewH - height - 16);
    card.style.left = `${Math.round(left)}px`;
    card.style.top = `${Math.round(top)}px`;
  }

  function setBox(element: HTMLElement | null, left: number, top: number, width: number, height: number): void {
    if (!element) return;
    element.style.left = `${Math.max(0, left)}px`;
    element.style.top = `${Math.max(0, top)}px`;
    element.style.width = `${Math.max(0, width)}px`;
    element.style.height = `${Math.max(0, height)}px`;
  }

  function placeHole(targetBox: DOMRect | null): void {
    const viewW = doc.documentElement.clientWidth;
    const viewH = doc.documentElement.clientHeight;
    overlay?.classList.toggle('is-focused', Boolean(targetBox));
    if (!targetBox) {
      if (hole) hole.style.opacity = '0';
      setBox(maskTop, 0, 0, viewW, viewH);
      setBox(maskRight, 0, 0, 0, 0);
      setBox(maskBottom, 0, 0, 0, 0);
      setBox(maskLeft, 0, 0, 0, 0);
      return;
    }
    const pad = 10;
    const left = Math.round(targetBox.left - pad);
    const top = Math.round(targetBox.top - pad);
    const width = Math.round(targetBox.width + pad * 2);
    const height = Math.round(targetBox.height + pad * 2);
    const right = left + width;
    const bottom = top + height;
    if (hole) {
      hole.style.opacity = '1';
      hole.style.left = `${left}px`;
      hole.style.top = `${top}px`;
      hole.style.width = `${width}px`;
      hole.style.height = `${height}px`;
    }
    setBox(maskTop, 0, 0, viewW, top);
    setBox(maskRight, right, top, viewW - right, height);
    setBox(maskBottom, 0, bottom, viewW, viewH - bottom);
    setBox(maskLeft, 0, top, left, height);
  }

  function layout(): void {
    if (!active) return;
    const current = step();
    clearHighlight();
    const target = current.target ? doc.querySelector(current.target) : null;
    const box = target?.getBoundingClientRect() ?? null;
    const usable = box && box.width > 2 && box.height > 2 ? box : null;
    if (target && usable) {
      highlighted = target;
      target.classList.add('tutorial-target');
    }
    placeHole(usable);
    placeCard(usable, usable ? current.placement : 'center');
  }

  function render(): void {
    const current = step();
    const last = index === STEPS.length - 1;
    if (kicker) kicker.textContent = current.kicker;
    if (count) count.textContent = `${String(index + 1).padStart(2, '0')} / ${String(STEPS.length).padStart(2, '0')}`;
    if (title) title.textContent = current.title;
    if (lead) lead.textContent = current.lead;
    if (hint) hint.textContent = current.hint;
    if (dots) {
      dots.innerHTML = STEPS.map((_, i) => `<i class="tutorial-dot${i === index ? ' is-active' : ''}"></i>`).join('');
    }
    if (prevButton) prevButton.disabled = index === 0;
    if (nextButton) nextButton.textContent = last ? '进入小城' : (current.action ?? '继续');
    overlay?.classList.toggle('is-finale', last);
    layout();
  }

  function stopPolling(): void {
    if (calmTimer) window.clearInterval(calmTimer);
    calmTimer = 0;
  }

  function close(): void {
    if (!active && overlay?.hidden) return;
    active = false;
    stopPolling();
    clearHighlight();
    overlay?.classList.remove('open', 'is-focused', 'is-finale');
    overlay?.setAttribute('hidden', '');
    markCompleted();
  }

  function reveal(): void {
    if (!overlay) return;
    active = true;
    overlay.removeAttribute('hidden');
    render();
    requestAnimationFrame(() => overlay.classList.add('open'));
  }

  function start(force = false): void {
    if (!overlay) return;
    if (!force && (isCompleted() || Boolean(storage?.getItem('minicityUser')))) return;
    index = 0;
    stopPolling();
    if (isCalm()) {
      reveal();
      return;
    }
    calmTimer = window.setInterval(() => {
      if (!isCalm()) return;
      stopPolling();
      reveal();
    }, CALM_CHECK_MS);
  }

  function next(): void {
    if (index >= STEPS.length - 1) {
      close();
      return;
    }
    index += 1;
    render();
  }

  function prev(): void {
    if (index === 0) return;
    index -= 1;
    render();
  }

  function onTargetClick(event: Event): void {
    if (!active) return;
    const current = step();
    if (!current.target) return;
    const target = doc.querySelector(current.target);
    if (target && (event.target instanceof Node) && target.contains(event.target)) next();
  }

  skipButton?.addEventListener('click', close);
  prevButton?.addEventListener('click', prev);
  nextButton?.addEventListener('click', next);
  doc.defaultView?.addEventListener('resize', layout);
  doc.addEventListener('click', onTargetClick, true);
  layoutTimer = window.setInterval(() => { if (active) layout(); }, 400);
  options.signal.addEventListener('abort', () => {
    window.clearInterval(layoutTimer);
    close();
  }, { once: true });

  return {
    start,
    close,
    next,
    prev,
    isCompleted,
    isActive: () => active,
    stepCount: STEPS.length,
  };
}

export type OnboardingTutorialController = ReturnType<typeof createOnboardingTutorialController>;
