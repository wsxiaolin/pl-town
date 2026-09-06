const STORAGE_KEY = 'minicity.tutorial.v1';
const CALM_CHECK_MS = 280;
const OVERLAY_PREVIEW_MS = 700;

type TutorialPlacement = 'center' | 'bottom' | 'top' | 'left' | 'right';

type TutorialStep = {
  kicker: string;
  title: string;
  lead: string;
  hint: string;
  target?: string;
  placement: TutorialPlacement;
  action?: string;
  opensOverlay?: boolean;
};

export type OnboardingTutorialControllerOptions = {
  document: Document;
  signal: AbortSignal;
  storage?: Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;
};

const STEPS: TutorialStep[] = [
  {
    kicker: 'MOVE · 出发',
    title: '先学会走路',
    lead: '点击道路，角色会沿着路网走过去；键盘也能直接移动。',
    hint: '触屏按住拖动，可唤出方向盘。',
    target: '.you-block',
    placement: 'right',
    action: '点击道路',
  },
  {
    kicker: 'MAP · 全景地图',
    title: '打开地图看看',
    lead: '小城比第一眼看起来更大。地图能搜索建筑，并在走远后解锁传送。',
    hint: '点亮的按钮就是入口。',
    target: '#mapToggle',
    placement: 'bottom',
    action: '打开地图',
    opensOverlay: true,
  },
  {
    kicker: 'PHONE · 居民手机',
    title: '你的生活入口',
    lead: '公聊、住宅和背包都收在这部手机里。',
    hint: '右下角这个按钮随时都能打开。',
    target: '#onlinePanelToggle',
    placement: 'left',
    action: '打开手机',
    opensOverlay: true,
  },
  {
    kicker: 'IDENTITY · 居民身份',
    title: '签下你的名字',
    lead: '昵称加密码，就是这座城的居民证。成就与进度会跟着身份保存。',
    hint: '之后也能从这里重新登录。',
    target: '#logoUser',
    placement: 'bottom',
  },
];

function isOverlayBlocking(element: Element | null): boolean {
  if (!element) return false;
  const style = element.ownerDocument.defaultView?.getComputedStyle(element);
  if (!style || style.display === 'none' || style.visibility === 'hidden') return false;
  if (element.classList.contains('hidden') || element.classList.contains('is-ready')) return false;
  return true;
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
  const listenerOptions = { signal: options.signal };

  let index = 0;
  let active = false;
  let previewing = false;
  let calmTimer = 0;
  let layoutTimer = 0;
  let previewTimer = 0;
  let highlighted: Element | null = null;
  let skipTargetAdvance = false;

  function isCompleted(): boolean {
    try { return storage?.getItem(STORAGE_KEY) === 'done'; } catch { return false; }
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

  function stopPolling(): void {
    if (calmTimer) window.clearInterval(calmTimer);
    calmTimer = 0;
    if (layoutTimer) window.clearInterval(layoutTimer);
    layoutTimer = 0;
    if (previewTimer) window.clearTimeout(previewTimer);
    previewTimer = 0;
  }

  function dismissTourPanels(): void {
    const mapToggle = doc.getElementById('mapToggle');
    const phoneToggle = doc.getElementById('onlinePanelToggle');
    const login = doc.getElementById('loginOverlay');
    if (doc.getElementById('mapOverlay')?.classList.contains('show')) mapToggle?.click();
    if (doc.getElementById('onlinePanel')?.classList.contains('open')) phoneToggle?.click();
    if (login && login.style.display !== 'none') {
      login.classList.add('hidden');
      login.style.display = 'none';
    }
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
    if (!active || previewing) return;
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
    if (prevButton) prevButton.disabled = index === 0 || previewing;
    if (nextButton) nextButton.textContent = last ? '完成' : (current.action ?? '继续');
    overlay?.classList.toggle('is-finale', last);
    layout();
    nextButton?.focus();
  }

  function hideTutorialShell(): void {
    overlay?.classList.remove('open');
    overlay?.setAttribute('hidden', '');
  }

  function showTutorialShell(): void {
    if (!overlay) return;
    overlay.removeAttribute('hidden');
    requestAnimationFrame(() => overlay.classList.add('open'));
  }

  function clickTarget(): void {
    const current = step();
    if (!current.target) return;
    const target = doc.querySelector(current.target);
    if (!(target instanceof HTMLElement)) return;
    skipTargetAdvance = true;
    target.click();
    skipTargetAdvance = false;
  }

  function finish(): void {
    previewing = false;
    active = false;
    stopPolling();
    dismissTourPanels();
    clearHighlight();
    overlay?.classList.remove('open', 'is-focused', 'is-finale');
    overlay?.setAttribute('hidden', '');
    markCompleted();
  }

  function abort(): void {
    previewing = false;
    active = false;
    stopPolling();
    dismissTourPanels();
    clearHighlight();
    overlay?.classList.remove('open', 'is-focused', 'is-finale');
    overlay?.setAttribute('hidden', '');
  }

  function reveal(): void {
    if (!overlay) return;
    active = true;
    overlay.removeAttribute('hidden');
    render();
    requestAnimationFrame(() => overlay.classList.add('open'));
    if (!layoutTimer) layoutTimer = window.setInterval(() => { if (active) layout(); }, 400);
  }

  function start(force = false): void {
    if (!overlay) return;
    let hasUser = false;
    try { hasUser = Boolean(storage?.getItem('minicityUser')); } catch {}
    if (!force && (isCompleted() || hasUser)) return;
    index = 0;
    previewing = false;
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

  function goTo(nextIndex: number): void {
    previewing = false;
    dismissTourPanels();
    index = nextIndex;
    showTutorialShell();
    render();
  }

  function advance(): void {
    if (index >= STEPS.length - 1) {
      finish();
      return;
    }
    goTo(index + 1);
  }

  function previewOverlayThenAdvance(): void {
    previewing = true;
    hideTutorialShell();
    clickTarget();
    previewTimer = window.setTimeout(() => {
      previewTimer = 0;
      if (!active) return;
      advance();
    }, OVERLAY_PREVIEW_MS);
  }

  function next(): void {
    if (!active || previewing) return;
    if (index >= STEPS.length - 1) {
      finish();
      return;
    }
    if (step().opensOverlay) {
      previewOverlayThenAdvance();
      return;
    }
    clickTarget();
    advance();
  }

  function prev(): void {
    if (!active || previewing || index === 0) return;
    goTo(index - 1);
  }

  function onTargetClick(event: Event): void {
    if (!active || previewing || skipTargetAdvance) return;
    const current = step();
    if (!current.target) return;
    const target = doc.querySelector(current.target);
    if (!(target && event.target instanceof Node && target.contains(event.target))) return;
    event.preventDefault();
    event.stopPropagation();
    next();
  }

  function onKeydown(event: KeyboardEvent): void {
    if (!active || previewing || event.key !== 'Tab' || !card) return;
    const focusable = [skipButton, prevButton, nextButton].filter((button): button is HTMLButtonElement => button !== null && !button.disabled);
    if (!focusable.length) return;
    const first = focusable[0]!;
    const last = focusable[focusable.length - 1]!;
    if (event.shiftKey && doc.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && doc.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }

  skipButton?.addEventListener('click', finish, listenerOptions);
  prevButton?.addEventListener('click', prev, listenerOptions);
  nextButton?.addEventListener('click', next, listenerOptions);
  doc.defaultView?.addEventListener('resize', layout, listenerOptions);
  doc.addEventListener('click', onTargetClick, { capture: true, ...listenerOptions });
  doc.addEventListener('keydown', onKeydown, listenerOptions);
  options.signal.addEventListener('abort', abort, { once: true });

  return {
    start,
    close: finish,
    next,
    prev,
    isCompleted,
    isActive: () => active,
    stepCount: STEPS.length,
  };
}

export type OnboardingTutorialController = ReturnType<typeof createOnboardingTutorialController>;
