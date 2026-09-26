import { decorateCity, donateCity, getCityConfig, getCityState, loadCityGovernance, refreshCityGovernanceSession, subscribeCityGovernance, type CityMutationResult, type CityProject } from '../../city/cityGovernanceClient';

let root: HTMLElement | null = null;
let unsubscribe: (() => void) | null = null;
let activeTab: 'collective' | 'personal' = 'collective';
let activeBuilding = '';
let operationError = '';
let operationNotice = '';
const pendingActions = new Map<string, symbol>();
const donationDrafts = new Map<string, string>();
const decorationDrafts = new Map<string, string>();

const money = (value: number) => `${value.toLocaleString()} 金币`;

function button(label: string, action: () => void, disabled = false, focusKey = ''): HTMLButtonElement {
  const element = document.createElement('button');
  element.type = 'button';
  element.textContent = label;
  element.disabled = disabled;
  if (focusKey) element.dataset.focusKey = focusKey;
  element.addEventListener('click', action);
  return element;
}

function focusAction(dataKey: 'projectId' | 'plotId', id: string): void {
  for (const item of root?.querySelectorAll<HTMLElement>('.city-governance-card') ?? []) {
    if (item.dataset[dataKey] === id) {
      const action = item.querySelector<HTMLButtonElement>('button');
      if (action) {
        // Failed actions should scroll back into view so the user can retry.
        action.focus();
        return;
      }
      break;
    }
  }
  const fallback = root?.querySelector<HTMLButtonElement>('.city-governance-tabs button.active')
    ?? root?.querySelector<HTMLButtonElement>('.city-governance-tabs button');
  fallback?.focus();
}

function updateFeedback(): void {
  for (const [selector, message] of [['[data-city-feedback]', operationError], ['[data-city-notice]', operationNotice]] as const) {
    const region = root?.querySelector<HTMLElement>(selector);
    if (!region) continue;
    region.hidden = !message;
    if (region.textContent !== message) region.textContent = message;
  }
}

function restoreFocus(previous: HTMLElement | null): void {
  if (!root || !previous?.dataset.focusKey) return;
  const replacement = Array.from(root.querySelectorAll<HTMLElement>('[data-focus-key]'))
    .find((control) => control.dataset.focusKey === previous.dataset.focusKey);
  if (!replacement) {
    root.querySelector<HTMLButtonElement>('.city-governance-tabs button.active')?.focus({ preventScroll: true });
    return;
  }
  // Number inputs do not expose selectionStart. Reuse the focused draft input
  // itself so a city broadcast preserves the caret and partially typed values.
  // Keep even an unedited focused value: changing it while typing is surprising.
  if (previous instanceof HTMLInputElement && replacement instanceof HTMLInputElement) {
    if (previous.dataset.focusKey.startsWith('amount:')) {
      donationDrafts.set(previous.dataset.focusKey.slice('amount:'.length), previous.value);
    }
    replacement.replaceWith(previous);
    previous.focus({ preventScroll: true });
  } else replacement.focus({ preventScroll: true });
}

function render(): void {
  if (!root) return;
  const focused = document.activeElement instanceof HTMLElement && root.contains(document.activeElement)
    ? document.activeElement : null;
  const scrollTop = root.querySelector('.city-governance-body')?.scrollTop ?? 0;
  const config = getCityConfig();
  const state = getCityState();
  const header = root.querySelector<HTMLElement>('.city-governance-head')!;
  const title = document.createElement('h2');
  const activeProject = config?.projects.find((project) => project.buildingId === activeBuilding);
  title.textContent = activeProject ? `城市治理 · ${activeProject.name}` : '城市治理';
  header.replaceChildren(title, button('关闭', closeCityGovernancePanel, false, 'close'));
  const tabs = root.querySelector<HTMLElement>('.city-governance-tabs')!;
  tabs.replaceChildren();
  for (const [tab, label] of [['collective', '城市集体建设'], ['personal', '个人建设']] as const) {
    const tabButton = button(label, () => { activeTab = tab; render(); }, false, `tab:${tab}`);
    tabButton.classList.toggle('active', activeTab === tab);
    tabs.append(tabButton);
  }
  const status = root.querySelector<HTMLElement>('[data-city-status]')!;
  status.textContent = state ? `云端进度 #${state.revision}` : '正在等待云端城市配置...';
  updateFeedback();
  const body = root.querySelector<HTMLElement>('.city-governance-body')!;
  body.replaceChildren();
  if (!config || !state) {
    body.append(document.createTextNode('城市建设数据暂时不可用，请稍后重试。'));
    body.append(button('重试', () => {
      const retry = body.querySelector('button');
      if (retry instanceof HTMLButtonElement) retry.disabled = true;
      void loadCityGovernance().finally(render);
    }, false, 'reload'));
    restoreFocus(focused);
    return;
  }
  const list = document.createElement('div');
  list.className = 'city-governance-list';
  if (activeTab === 'collective') renderCollective(list, config.projects, state.projects);
  else renderPersonal(list, config, state);
  body.append(list);
  body.scrollTop = scrollTop;
  restoreFocus(focused);
}

async function submit(dataKey: 'projectId' | 'plotId', id: string, mutation: () => Promise<CityMutationResult>): Promise<void> {
  const session = refreshCityGovernanceSession();
  const submittedPanel = root;
  const actionKey = `${dataKey}:${id}`;
  if (pendingActions.has(actionKey)) return;
  const action = Symbol(actionKey);
  pendingActions.set(actionKey, action);
  const focused = document.activeElement as HTMLElement | null;
  let returnFocus = focused?.dataset.focusKey === `${dataKey === 'projectId' ? 'donate' : 'decorate'}:${id}`;
  let failed = false;
  operationError = '';
  operationNotice = '';
  render();
  // Rebuilding a disabled button loses focus. Restore it on success only if
  // the user has not since focused, clicked or typed elsewhere in the page.
  const focusController = new AbortController();
  const movedOn = () => { returnFocus = false; };
  for (const event of ['focusin', 'pointerdown', 'keydown']) {
    document.addEventListener(event, movedOn, { capture: true, signal: focusController.signal });
  }
  try {
    const result = await mutation();
    if (!result || root !== submittedPanel || refreshCityGovernanceSession() !== session) return;
    operationNotice = result.replayed ? '上一笔已成功，未重复扣费。' : '';
  } catch (error) {
    if (root !== submittedPanel || refreshCityGovernanceSession() !== session) return;
    failed = true;
    operationError = error instanceof Error ? error.message : '建设失败，请重试';
  } finally {
    focusController.abort();
    if (pendingActions.get(actionKey) === action) pendingActions.delete(actionKey);
    if (root === submittedPanel && root?.classList.contains('open') && refreshCityGovernanceSession() === session) {
      const restoreSuccessFocus = returnFocus && document.activeElement === document.body;
      render();
      if (failed || restoreSuccessFocus) focusAction(dataKey, id);
    }
  }
}

function card(title: string, description: string): HTMLElement {
  const item = document.createElement('article');
  item.className = 'city-governance-card';
  const heading = document.createElement('h3');
  heading.textContent = title;
  const copy = document.createElement('p');
  copy.textContent = description;
  item.append(heading, copy);
  return item;
}

function renderCollective(list: HTMLElement, projects: CityProject[], progress: Array<{ id: string; funded: number; built: boolean }>): void {
  for (const project of projects) {
    const saved = progress.find((entry) => entry.id === project.id);
    const item = card(project.name, project.description);
    item.dataset.projectId = project.id;
    item.dataset.buildingId = project.buildingId ?? '';
    item.classList.toggle('active', project.buildingId === activeBuilding);
    const detail = document.createElement('p');
    detail.textContent = saved?.built ? '已建成，全城居民共享' : `募捐进度 ${money(saved?.funded ?? 0)} / ${money(project.cost)}`;
    item.append(detail);
    if (!saved?.built) {
      const amount = document.createElement('input');
      amount.type = 'number'; amount.min = '1'; amount.step = '1';
      amount.value = donationDrafts.get(project.id) ?? String(Math.min(project.cost - (saved?.funded ?? 0), 100));
      amount.dataset.focusKey = `amount:${project.id}`;
      amount.addEventListener('input', () => { donationDrafts.set(project.id, amount.value); });
      amount.setAttribute('aria-label', `${project.name}捐款金额`);
      item.append(amount, button('捐款', () => {
        // Focus restoration can replace the freshly rendered amount node.
        // Submit exactly the value in the current card, not a captured draft.
        const liveInput = item.querySelector<HTMLInputElement>('input');
        if (!liveInput) return;
        const value = Number(liveInput.value);
        void submit('projectId', project.id, () => donateCity(project.id, value));
      }, pendingActions.has(`projectId:${project.id}`), `donate:${project.id}`));
    }
    list.append(item);
  }
}

function renderPersonal(list: HTMLElement, config: NonNullable<ReturnType<typeof getCityConfig>>, state: NonNullable<ReturnType<typeof getCityState>>): void {
  for (const plot of config.personalPlots) {
    const item = card(plot.name, '选择一项装饰，建设完成后全城居民都能看到。');
    item.dataset.plotId = plot.id;
    const occupied = state.decorations.find((entry) => entry.plotId === plot.id);
    if (occupied) {
      const owner = document.createElement('p');
      owner.textContent = `已由 ${occupied.ownerNickname} 建设：${config.decorations.find((entry) => entry.id === occupied.decorationId)?.name ?? occupied.decorationId}`;
      item.append(owner);
    } else {
      const select = document.createElement('select');
      select.dataset.focusKey = `decoration:${plot.id}`;
      select.setAttribute('aria-label', `${plot.name}装饰类型`);
      for (const id of plot.options) {
        const option = document.createElement('option');
        const decoration = config.decorations.find((entry) => entry.id === id);
        option.value = id; option.textContent = decoration ? `${decoration.name} · ${money(decoration.cost)}` : id;
        select.append(option);
      }
      const draft = decorationDrafts.get(plot.id);
      if (draft && plot.options.includes(draft)) select.value = draft;
      select.addEventListener('change', () => { decorationDrafts.set(plot.id, select.value); });
      item.append(select, button('建设', () => {
        const liveSelect = item.querySelector<HTMLSelectElement>('select');
        if (!liveSelect) return;
        const decorationId = liveSelect.value;
        void submit('plotId', plot.id, () => decorateCity(plot.id, decorationId));
      }, pendingActions.has(`plotId:${plot.id}`), `decorate:${plot.id}`));
    }
    list.append(item);
  }
}

export function openCityGovernancePanel(buildingId = ''): void {
  if (activeBuilding !== buildingId) { operationError = ''; operationNotice = ''; }
  activeBuilding = buildingId;
  if (!root) {
    root = document.createElement('section');
    root.className = 'city-governance-panel';
    root.setAttribute('aria-label', '城市治理');
    const header = document.createElement('header');
    header.className = 'city-governance-head';
    const tabs = document.createElement('nav');
    tabs.className = 'city-governance-tabs';
    const status = document.createElement('p');
    status.dataset.cityStatus = 'true';
    const feedback = document.createElement('p');
    feedback.dataset.cityFeedback = 'true';
    feedback.setAttribute('role', 'alert');
    feedback.setAttribute('aria-atomic', 'true');
    feedback.hidden = true;
    const notice = document.createElement('p');
    notice.dataset.cityNotice = 'true';
    notice.setAttribute('role', 'status');
    notice.setAttribute('aria-atomic', 'true');
    notice.hidden = true;
    const body = document.createElement('main');
    body.className = 'city-governance-body';
    root.append(header, tabs, status, feedback, notice, body);
    document.body.append(root);
    root.addEventListener('keydown', (event) => { if (event.key === 'Escape') closeCityGovernancePanel(); });
    let session = refreshCityGovernanceSession();
    unsubscribe = subscribeCityGovernance(() => {
      const nextSession = refreshCityGovernanceSession();
      if (session !== nextSession) {
        session = nextSession;
        pendingActions.clear();
        donationDrafts.clear();
        decorationDrafts.clear();
        operationError = '';
        operationNotice = '';
      }
      if (!root?.classList.contains('open')) return;
      render();
    });
  }
  root.classList.add('open');
  render();
  root.querySelector<HTMLButtonElement>('.city-governance-head button')?.focus();
}

export function closeCityGovernancePanel(): void {
  root?.classList.remove('open');
  operationError = '';
  operationNotice = '';
  updateFeedback();
}

export function disposeCityGovernancePanel(): void {
  unsubscribe?.();
  unsubscribe = null;
  root?.remove();
  root = null;
  activeBuilding = '';
  activeTab = 'collective';
  operationError = '';
  operationNotice = '';
  pendingActions.clear();
  donationDrafts.clear();
  decorationDrafts.clear();
}
