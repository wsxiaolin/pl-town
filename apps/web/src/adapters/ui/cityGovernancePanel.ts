import { donateCity, getCityConfig, getCityState, loadCityGovernance, refreshCityGovernanceSession, subscribeCityGovernance, type CityMutationResult, type CityProject } from '../../city/cityGovernanceClient';
import { clearCityConstructionDrafts, renderCityPersonalAreas } from './cityGovernanceAreas';
import { actionButton as button, card, money, trackPendingActionFocus } from './cityGovernanceDom';

let root: HTMLElement | null = null;
let unsubscribe: (() => void) | null = null;
let activeTab: 'collective' | 'personal' = 'collective';
let activeBuilding = '';
let operationError = '';
let errorActionKey = '';
let operationNotice = '';
let rendering = false;
const pendingActions = new Map<string, symbol>();
const donationDrafts = new Map<string, string>();

function focusAction(dataKey: 'projectId' | 'plotId' | 'cityArea', id: string): void {
  for (const item of root?.querySelectorAll<HTMLElement>('.city-governance-card') ?? []) {
    if (item.dataset[dataKey] === id) {
      const focusKey = `${dataKey === 'projectId' ? 'donate' : dataKey === 'cityArea' ? 'area-build' : 'decorate'}:${id}`;
      const action = Array.from(item.querySelectorAll<HTMLButtonElement>('button[data-focus-key]'))
        .find((control) => control.dataset.focusKey === focusKey);
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
  // Only the donation handler is independent of the rendered card controls.
  // Area quantity handlers update their own preview, total and action nodes.
  if (previous.dataset.focusKey.startsWith('amount:') && previous instanceof HTMLInputElement && replacement instanceof HTMLInputElement) {
    donationDrafts.set(previous.dataset.focusKey.slice('amount:'.length), previous.value);
    replacement.replaceWith(previous);
    previous.focus({ preventScroll: true });
  } else replacement.focus({ preventScroll: true });
}

function render(): void {
  if (!root || rendering) return;
  rendering = true;
  try {
    // Cross-tab authentication changes notify subscribers synchronously. Refresh
    // before reading drafts, and let that notification clear them without a
    // nested render appending a second list to the same panel body.
    refreshCityGovernanceSession();
    renderContents();
  } finally { rendering = false; }
}

function renderContents(): void {
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

async function submitDonation(id: string, mutation: () => Promise<CityMutationResult>): Promise<void> {
  const session = refreshCityGovernanceSession();
  const submittedPanel = root;
  const actionKey = `projectId:${id}`;
  if (pendingActions.has(actionKey)) return;
  const config = getCityConfig();
  const targetName = config?.projects.find((project) => project.id === id)?.name ?? '该项目';
  // Capture the submitted target before a refresh can replace its catalog entry.
  const targetPrefix = `「${targetName}」`;
  const action = Symbol(actionKey);
  pendingActions.set(actionKey, action);
  const focus = trackPendingActionFocus(`donate:${id}`);
  let failed = false;
  // Retrying this target replaces its error; another card's request does not.
  if (errorActionKey === actionKey) { operationError = ''; errorActionKey = ''; }
  operationNotice = '';
  render();
  try {
    const result = await mutation();
    if (!result || root !== submittedPanel || refreshCityGovernanceSession() !== session) return;
    operationNotice = result.replayed ? '上一笔已成功，未重复扣费。' : '';
  } catch (error) {
    if (root !== submittedPanel || refreshCityGovernanceSession() !== session) return;
    failed = true;
    const message = error instanceof Error ? error.message : '建设失败，请重试';
    operationError = message.startsWith(targetPrefix) ? message : `${targetPrefix}${message}`;
    errorActionKey = actionKey;
  } finally {
    focus.dispose();
    if (pendingActions.get(actionKey) === action) pendingActions.delete(actionKey);
    if (root === submittedPanel && root?.classList.contains('open') && refreshCityGovernanceSession() === session) {
      const restoreActionFocus = focus.shouldRestore(failed);
      render();
      if (restoreActionFocus) focusAction('projectId', id);
    }
  }
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
        void submitDonation(project.id, () => donateCity(project.id, value));
      }, pendingActions.has(`projectId:${project.id}`), `donate:${project.id}`));
    }
    list.append(item);
  }
}

function renderPersonal(list: HTMLElement, config: NonNullable<ReturnType<typeof getCityConfig>>, state: NonNullable<ReturnType<typeof getCityState>>): void {
  renderCityPersonalAreas(list, config, state, {
    rerender: () => { if (root?.classList.contains('open')) render(); },
    reportError: (message, actionKey) => {
      if (message || errorActionKey === actionKey) {
        operationError = message;
        errorActionKey = message ? actionKey : '';
      }
      operationNotice = '';
      updateFeedback();
    },
    reportNotice: (message) => { operationNotice = message; updateFeedback(); },
    focusAction: (dataKey, id) => { if (root?.classList.contains('open')) focusAction(dataKey, id); },
  });
}

export function openCityGovernancePanel(buildingId = ''): void {
  if (activeBuilding !== buildingId) { operationError = ''; errorActionKey = ''; operationNotice = ''; }
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
        clearCityConstructionDrafts();
        operationError = '';
        errorActionKey = '';
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
  errorActionKey = '';
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
  errorActionKey = '';
  operationError = '';
  operationNotice = '';
  pendingActions.clear();
  donationDrafts.clear();
  clearCityConstructionDrafts();
}
