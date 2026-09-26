import { donateCity, getCityConfig, getCityState, loadCityGovernance, subscribeCityGovernance, type CityMutationResult, type CityProject, type CityState } from '../../city/cityGovernanceClient';
import { clearCityConstructionDrafts, renderCityPersonalAreas } from './cityGovernanceAreas';
import { actionButton as button, card, money } from './cityGovernanceDom';
import { getCityVotingSessionId, loadCityVotes, voteCity, type CityVotes } from '../../city/cityVotingClient';

let root: HTMLDialogElement | null = null;
let unsubscribe: (() => void) | null = null;
let activeTab: 'collective' | 'personal' = 'collective';
let activeBuilding = '';
let operationError = '';
let operationNotice = '';
const pendingActions = new Set<string>();
const donationDrafts = new Map<string, string>();
const tabScrollTop = new Map<string, number>();
let returnFocus: HTMLElement | null = null;
let myVotes: CityVotes | null = null;
let votesLoading: AbortController | null = null;
let voteError = '';
const voting = new Set<string>();
let votesLoadSequence = 0;
const INPUT_SELECTOR = '[data-city-input],select[aria-label]';
const FOCUS_SELECTOR = '[data-city-focus],[aria-label]';
const CARD_SELECTOR = '[data-city-project],[data-city-area],[data-city-plot]';

export function isCityGovernancePanelOpen(): boolean { return root?.open ?? false; }

function focusedCardKey(element: HTMLElement | null): string | undefined {
  const card = element?.closest<HTMLElement>(CARD_SELECTOR);
  return card?.dataset.cityProject ?? card?.dataset.cityArea ?? card?.dataset.cityPlot;
}

function handleLoginRequired(): void {
  if (!root?.open) return;
  closeCityGovernancePanel();
}

function focusAction(dataKey: 'projectId' | 'cityPlot' | 'cityArea', id: string): void {
  const prefix = dataKey === 'projectId' ? 'donate' : dataKey === 'cityArea' ? 'area-build' : 'plot-build';
  const action = [...root?.querySelectorAll<HTMLButtonElement>('button[data-city-focus]') ?? []]
    .find((element) => element.dataset.cityFocus === `${prefix}:${id}` && !element.disabled);
  const fallback = root?.querySelector<HTMLButtonElement>('.city-governance-tabs button.active');
  (action ?? fallback)?.focus({ preventScroll: true });
}

function updateFeedback(): void {
  for (const [selector, message] of [
    ['[data-city-feedback]', operationError],
    ['[data-city-notice]', operationNotice],
    ['[data-city-vote-feedback]', activeTab === 'collective' ? voteError : ''],
  ] as const) {
    const region = root?.querySelector<HTMLElement>(selector);
    if (!region) continue;
    region.hidden = !message;
    if (region.textContent !== message) region.textContent = message;
  }
}

function render(preferredFocusKey?: string): void {
  if (!root) return;
  const focused = root.contains(document.activeElement) ? document.activeElement as HTMLElement : null;
  const focusKey = preferredFocusKey ?? focused?.dataset.cityFocus ?? focused?.getAttribute('aria-label');
  const focusProject = focusedCardKey(focused);
  const previousBody = root.querySelector<HTMLElement>('.city-governance-body');
  if (previousBody?.dataset.cityTab) tabScrollTop.set(previousBody.dataset.cityTab, previousBody.scrollTop);
  const values = new Map([...root.querySelectorAll<HTMLInputElement | HTMLSelectElement>(INPUT_SELECTOR)].map((input) => [input.dataset.cityInput ?? input.getAttribute('aria-label'), input.value]));
  const config = getCityConfig();
  const state = getCityState();
  const header = root.querySelector<HTMLElement>('.city-governance-head')!;
  const title = document.createElement('h2');
  const activeProject = config?.projects.find((project) => project.buildingId === activeBuilding);
  title.id = 'city-governance-title';
  title.textContent = activeProject ? `众议院 · ${activeProject.name}` : '众议院';
  header.replaceChildren(title, button('关闭', closeCityGovernancePanel, false, 'close'));
  const tabs = root.querySelector<HTMLElement>('.city-governance-tabs')!;
  tabs.replaceChildren();
  for (const [tab, label] of [['collective', '城市集体建设'], ['personal', '个人建设']] as const) {
    const tabButton = button(label, () => { activeTab = tab; render(); }, false, `tab:${tab}`);
    tabButton.classList.toggle('active', activeTab === tab);
    tabButton.setAttribute('aria-pressed', String(activeTab === tab));
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
    if (focused) restorePanelFocus(focusKey, focusProject, focused);
    return;
  }
  const list = document.createElement('div');
  list.className = 'city-governance-list';
  if (activeTab === 'collective') renderCollective(list, config.projects, state);
  else renderPersonal(list, config, state);
  body.append(list);
  body.dataset.cityTab = activeTab;
  body.scrollTop = tabScrollTop.get(activeTab) ?? 0;
  for (const input of root.querySelectorAll<HTMLInputElement | HTMLSelectElement>(INPUT_SELECTOR)) {
    const previous = values.get(input.dataset.cityInput ?? input.getAttribute('aria-label'));
    if (previous !== undefined) input.value = previous;
  }
  if (focused) restorePanelFocus(focusKey, focusProject, focused);
}

function restorePanelFocus(focusKey: string | null | undefined, projectId?: string, previous?: HTMLElement): void {
  if (!root) return;
  const replacement = focusKey ? [...root.querySelectorAll<HTMLElement>(FOCUS_SELECTOR)]
    .find((element) => (element.dataset.cityFocus ?? element.getAttribute('aria-label')) === focusKey) : undefined;
  if (replacement && !replacement.hasAttribute('disabled')) {
    // Number inputs do not expose their caret. Reuse the focused donation draft
    // node, whose listener does not close over any other rendered controls.
    if (focusKey?.startsWith('donate-input:') && previous instanceof HTMLInputElement
      && previous.dataset.cityFocus === focusKey && replacement instanceof HTMLInputElement) {
      replacement.replaceWith(previous);
      previous.focus({ preventScroll: true });
    } else replacement.focus({ preventScroll: true });
  }
  else {
    const project = projectId ? [...root.querySelectorAll<HTMLElement>(CARD_SELECTOR)]
      .find((element) => focusedCardKey(element) === projectId) : undefined;
    const nextAction = project?.querySelector<HTMLElement>('button:not(:disabled), input:not(:disabled), select:not(:disabled)');
    (nextAction ?? root.querySelector<HTMLButtonElement>('.city-governance-tabs button.active')
      ?? root.querySelector<HTMLButtonElement>('.city-governance-head button'))?.focus({ preventScroll: true });
  }
}

async function submitDonation(projectId: string, mutation: () => Promise<CityMutationResult>): Promise<void> {
  if (pendingActions.has(projectId)) return;
  pendingActions.add(projectId);
  operationError = '';
  operationNotice = '';
  render();
  try {
    const result = await mutation();
    operationNotice = result.replayed ? '上一笔已成功，未重复扣费。' : '';
  } catch (error) {
    operationError = error instanceof Error ? error.message : '建设失败，请重试';
  } finally {
    pendingActions.delete(projectId);
    render();
    if (operationError && root?.open) focusAction('projectId', projectId);
  }
}

function renderCollective(list: HTMLElement, projects: CityProject[], state: CityState): void {
  const currentVotes = myVotes?.sessionId === getCityVotingSessionId() && myVotes?.epoch === state.epoch ? myVotes : null;
  const explanation = document.createElement('p');
  explanation.className = 'city-governance-intro';
  explanation.textContent = '新城从众议院起步，建筑由居民共同捐建，建成后开放对应的剧情、商店等功能。为期待的建筑投票，每位居民每项一票；投票不消耗金币，捐款满额后即可建成。';
  list.append(explanation);
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
      const saved = state.projects.find((entry) => entry.id === project.id);
      const item = card(project.name, project.description);
      item.dataset.cityProject = project.id;
      item.dataset.buildingId = project.buildingId ?? '';
      item.classList.toggle('active', project.buildingId === activeBuilding);
      const detail = document.createElement('p');
      detail.textContent = saved?.built ? '已建成，全城居民共享' : `募捐进度 ${money(saved?.funded ?? 0)} / ${money(project.cost)}`;
      item.append(detail);
      if (project.kind === 'building') {
        const total = document.createElement('p');
        total.dataset.cityVoteCount = project.id;
        total.textContent = `${saved?.votes ?? 0} 位居民支持建设`;
        item.append(total);
        if (!saved?.built) {
          const voted = currentVotes?.projectIds.includes(project.id);
          const action = button(voted ? '已投票' : voting.has(project.id) ? '正在投票…' : '投票建设', async () => {
            voteError = '';
            votesLoading?.abort();
            votesLoading = null;
            voting.add(project.id);
            render();
            let retryFocus: string | undefined;
            try { myVotes = await voteCity(project.id); }
            catch (error) {
              voteError = error instanceof Error ? error.message : '投票失败，请重试';
              const currentFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
              if (focusedCardKey(currentFocus) === project.id) retryFocus = `vote:${project.id}`;
            }
            finally { voting.delete(project.id); render(retryFocus); }
          }, Boolean(voted) || voting.has(project.id), `vote:${project.id}`);
          item.append(action);
        }
      }
      if (!saved?.built) {
        const amount = document.createElement('input');
        amount.type = 'number'; amount.min = '1'; amount.step = '1';
        amount.value = donationDrafts.get(project.id) ?? String(Math.min(project.cost - (saved?.funded ?? 0), 100));
        amount.dataset.cityInput = project.id;
        amount.dataset.cityFocus = `donate-input:${project.id}`;
        amount.addEventListener('input', () => donationDrafts.set(project.id, amount.value));
        amount.setAttribute('aria-label', `${project.name}捐款金额`);
        const action = button('捐款', () => {
          // Focus restoration can replace the freshly rendered input.
          const liveInput = item.querySelector<HTMLInputElement>('input');
          if (!liveInput) return;
          const value = Number(liveInput.value);
          void submitDonation(project.id, () => donateCity(project.id, value));
        }, pendingActions.has(project.id), `donate:${project.id}`);
        item.append(amount, action);
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
  }, (dataKey, id) => { if (root?.open) focusAction(dataKey, id); });
}

function containTabFocus(event: KeyboardEvent): void {
  if (event.key !== 'Tab' || !root) return;
  const focusable = [...root.querySelectorAll<HTMLElement>('button, input, select, textarea, a[href], [tabindex]')]
    .filter((element) => element.tabIndex >= 0 && !element.matches(':disabled')
      && element.getClientRects().length > 0 && getComputedStyle(element).visibility !== 'hidden');
  const first = focusable[0];
  const last = focusable.at(-1);
  // Native modal dialogs make the page inert, but allow Tab to reach browser
  // chrome. Keep the keyboard loop in the panel as well.
  if (!first || !last) { event.preventDefault(); return; }
  const active = document.activeElement;
  if (event.shiftKey && (active === first || !focusable.includes(active as HTMLElement))) {
    event.preventDefault();
    last.focus();
  } else if (!event.shiftKey && (active === last || !focusable.includes(active as HTMLElement))) {
    event.preventDefault();
    first.focus();
  }
}

export function openCityGovernancePanel(buildingId = ''): void {
  if (activeBuilding !== buildingId) { operationError = ''; operationNotice = ''; }
  activeBuilding = buildingId;
  if (!root) {
    root = document.createElement('dialog');
    root.className = 'city-governance-panel';
    root.setAttribute('aria-labelledby', 'city-governance-title');
    root.setAttribute('aria-modal', 'true');
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
    const voteFeedback = document.createElement('p');
    voteFeedback.dataset.cityVoteFeedback = 'true';
    voteFeedback.setAttribute('role', 'alert');
    voteFeedback.setAttribute('aria-atomic', 'true');
    voteFeedback.hidden = true;
    const body = document.createElement('main');
    body.className = 'city-governance-body';
    root.append(header, tabs, status, feedback, notice, voteFeedback, body);
    document.body.append(root);
    root.addEventListener('cancel', (event) => { event.preventDefault(); closeCityGovernancePanel(); });
    root.addEventListener('keydown', (event) => {
      event.stopPropagation();
      containTabFocus(event);
      if (event.key === 'Escape') { event.preventDefault(); closeCityGovernancePanel(); }
    });
    window.addEventListener('minicity:login-required', handleLoginRequired, true);
    unsubscribe = subscribeCityGovernance(() => {
      if (!root?.open) return;
      if (myVotes && myVotes.epoch !== getCityState()?.epoch) { myVotes = null; void refreshVotes(); }
      render();
    });
  }
  if (!root.open) {
    returnFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    activeTab = 'collective';
  }
  voteError = '';
  if (!root.open) root.showModal();
  render();
  root.querySelector<HTMLButtonElement>('.city-governance-head button')?.focus();
  void refreshVotes();
}

async function refreshVotes(): Promise<void> {
  const sequence = ++votesLoadSequence;
  votesLoading?.abort();
  myVotes = null;
  if (getCityVotingSessionId() === null) { render(); return; }
  const controller = new AbortController();
  votesLoading = controller;
  try {
    const result = await loadCityVotes(controller.signal);
    if (controller.signal.aborted || sequence !== votesLoadSequence) return;
    myVotes = result;
  } catch (error) {
    if (!controller.signal.aborted && sequence === votesLoadSequence) voteError = error instanceof Error ? error.message : '读取投票记录失败';
  } finally {
    if (votesLoading === controller) { votesLoading = null; if (root?.open) render(); }
  }
}

export function closeCityGovernancePanel(): void {
  if (!root?.open) return;
  root.close();
  // Keep per-tab scroll across reopening so residents can return to the same
  // construction projects. Disposal starts a new city session and clears it.
  votesLoading?.abort();
  votesLoading = null;
  if (returnFocus?.isConnected) returnFocus.focus({ preventScroll: true });
  returnFocus = null;
  operationError = '';
  operationNotice = '';
  voteError = '';
  updateFeedback();
}

export function disposeCityGovernancePanel(): void {
  closeCityGovernancePanel();
  window.removeEventListener('minicity:login-required', handleLoginRequired, true);
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
  tabScrollTop.clear();
  clearCityConstructionDrafts();
  myVotes = null;
  voteError = '';
  voting.clear();
}
