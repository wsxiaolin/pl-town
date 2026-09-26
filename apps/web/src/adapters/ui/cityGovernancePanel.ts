import { donateCity, getCityConfig, getCityState, loadCityGovernance, subscribeCityGovernance, type CityMutationResult, type CityProject } from '../../city/cityGovernanceClient';
import { clearCityConstructionDrafts, renderCityPersonalAreas } from './cityGovernanceAreas';
import { actionButton as button, card, money } from './cityGovernanceDom';

let root: HTMLElement | null = null;
let unsubscribe: (() => void) | null = null;
let activeTab: 'collective' | 'personal' = 'collective';
let activeBuilding = '';
let operationError = '';
let operationNotice = '';
const pendingActions = new Set<string>();
const donationDrafts = new Map<string, string>();

function focusAction(dataKey: 'projectId' | 'plotId' | 'cityArea', id: string): void {
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
  // Only the donation handler is independent of the rendered card controls.
  // Area quantity handlers update their own preview, total and action nodes.
  if (previous.dataset.focusKey.startsWith('amount:') && previous instanceof HTMLInputElement && replacement instanceof HTMLInputElement) {
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
  const actionKey = `${dataKey}:${id}`;
  if (pendingActions.has(actionKey)) return;
  pendingActions.add(actionKey);
  operationError = '';
  operationNotice = '';
  render();
  try {
    const result = await mutation();
    operationNotice = result.replayed ? '上一笔已成功，未重复扣费。' : '';
  } catch (error) {
    operationError = error instanceof Error ? error.message : '建设失败，请重试';
  } finally {
    pendingActions.delete(actionKey);
    render();
    if (operationError && root?.classList.contains('open')) focusAction(dataKey, id);
  }
}

function renderCollective(list: HTMLElement, projects: CityProject[], progress: Array<{ id: string; funded: number; built: boolean }>): void {
  const groups = [
    { title: '公共建筑', description: '待建建筑及其地皮暂不显示；共同筹建完成后开放。', projects: projects.filter((project) => project.kind === 'building') },
    { title: '道路与绿化', description: '共同建设道路、灯光和公共装饰。', projects: projects.filter((project) => project.kind !== 'building') },
  ];
  for (const group of groups) {
    if (!group.projects.length) continue;
    const heading = document.createElement('div');
    heading.className = 'city-governance-group-note';
    const title = document.createElement('h3');
    title.textContent = group.title;
    const description = document.createElement('p');
    description.textContent = group.description;
    heading.append(title, description);
    list.append(heading);
    for (const project of group.projects) {
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
          // Focus restoration can replace the freshly rendered input.
          const liveInput = item.querySelector<HTMLInputElement>('input');
          if (!liveInput) return;
          const value = Number(liveInput.value);
          void submit('projectId', project.id, () => donateCity(project.id, value));
        }, pendingActions.has(`projectId:${project.id}`), `donate:${project.id}`));
      }
      list.append(item);
    }
  }
}

function renderPersonal(list: HTMLElement, config: NonNullable<ReturnType<typeof getCityConfig>>, state: NonNullable<ReturnType<typeof getCityState>>): void {
  renderCityPersonalAreas(list, config, state, render, (message) => {
    operationError = message;
    operationNotice = '';
    updateFeedback();
  }, (message) => {
    operationNotice = message;
    updateFeedback();
  }, (dataKey, id) => { if (root?.classList.contains('open')) focusAction(dataKey, id); });
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
    unsubscribe = subscribeCityGovernance(() => {
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
  clearCityConstructionDrafts();
}
