import { donateCity, getCityConfig, getCityState, isCityGovernanceLoading, loadCityGovernance, refreshCityGovernanceSession, subscribeCityGovernance, type CityMutationResult, type CityProject, type CityState } from '../../city/cityGovernanceClient';
import { actionButton as button, card, money, trackPendingActionFocus, withPanelFocusRestoration } from './cityGovernanceDom';
import { getCityVotingSessionId, loadCityVotes, voteCity, type CityVotes } from '../../city/cityVotingClient';

let root: HTMLDialogElement | null = null;
let unsubscribe: (() => void) | null = null;
let activeBuilding = '';
let operationError = '';
let errorActionKey = '';
let operationNotice = '';
let rendering = false;
const pendingActions = new Map<string, symbol>();
const donationDrafts = new Map<string, string>();
// The single construction list keeps its scroll position across rerenders. The
// short loading/unavailable fallback is not a real list, so its clamped zero is
// never captured; only the last list-backed scroll is restored.
let bodyScrollTop = 0;
let bodyHasList = false;
let returnFocus: HTMLElement | null = null;
let myVotes: CityVotes | null = null;
let votesUnavailableSession: number | null = null;
let votesLoading: AbortController | null = null;
let voteError = '';
let voteNotice = '';
let voteFeedbackRevision = 0;
let votesEpoch: string | null = null;
let unavailableFocus: { key: string; projectId?: string; fallback: Element | null } | null = null;
const voting = new Map<string, { sessionId: number | null }>();
let votesLoadSequence = 0;
// Only the donation input is restored from the previous DOM value; every other
// control is a button that rerenders from the trusted state.
const INPUT_SELECTOR = '[data-city-input]';
const FOCUS_SELECTOR = '[data-city-focus],[aria-label]';
const CARD_SELECTOR = '[data-city-project]';

export function isCityGovernancePanelOpen(): boolean { return root?.open ?? false; }

function focusedCardKey(element: HTMLElement | null): string | undefined {
  const card = element?.closest<HTMLElement>(CARD_SELECTOR);
  return card?.dataset.cityProject;
}

function handleLoginRequired(): void {
  if (!root?.open) return;
  closeCityGovernancePanel();
}

function focusAction(id: string): void {
  const action = [...root?.querySelectorAll<HTMLButtonElement>('button[data-city-focus]') ?? []]
    .find((element) => element.dataset.cityFocus === `donate:${id}` && !element.disabled);
  const fallback = root?.querySelector<HTMLButtonElement>('.city-governance-head button');
  (action ?? fallback)?.focus({ preventScroll: true });
}

function updateFeedback(): void {
  for (const [selector, message] of [
    ['[data-city-feedback]', operationError],
    ['[data-city-notice]', operationNotice],
    // Vote failures belong to the collective construction view, which is the
    // only view the panel shows now.
    ['[data-city-vote-feedback]', voteError],
    ['[data-city-vote-notice]', voteNotice],
  ] as const) {
    const region = root?.querySelector<HTMLElement>(selector);
    if (!region) continue;
    // Keep both status regions in the accessibility tree before success.
    // Their empty states collapse visually in CSS, not with display:none/hidden.
    if (region.getAttribute('role') !== 'status') region.hidden = !message;
    if (region.textContent !== message) region.textContent = message;
  }
}

function acceptVotes(result: CityVotes): void {
  votesUnavailableSession = null;
  // Votes cannot be removed within one resident's epoch. An older GET or a
  // second project's receipt must not erase an already confirmed choice.
  myVotes = myVotes?.sessionId === result.sessionId && myVotes.epoch === result.epoch
    ? { ...result, projectIds: [...new Set([...myVotes.projectIds, ...result.projectIds])] } : result;
}

function render(preferredFocusKey?: string): void {
  if (!root || rendering) return;
  rendering = true;
  try {
    // Authentication notifications can synchronously request another render.
    // Clear the old resident's drafts before reading any DOM values or receipts.
    refreshCityGovernanceSession();
    withPanelFocusRestoration(() => renderContents(preferredFocusKey));
  } finally { rendering = false; }
}

function renderContents(preferredFocusKey?: string): void {
  if (!root) return;
  const focused = root.contains(document.activeElement) ? document.activeElement as HTMLElement : null;
  const resumedFocus = focused && unavailableFocus?.fallback === focused ? unavailableFocus : null;
  const focusKey = preferredFocusKey ?? resumedFocus?.key ?? focused?.dataset.cityFocus ?? focused?.getAttribute('aria-label');
  const focusProject = resumedFocus?.projectId ?? focusedCardKey(focused);
  const values = new Map([...root.querySelectorAll<HTMLInputElement | HTMLSelectElement>(INPUT_SELECTOR)].map((input) => [input.dataset.cityInput ?? input.getAttribute('aria-label'), input.value]));
  const config = getCityConfig();
  const state = getCityState();
  const loading = isCityGovernanceLoading();
  const header = root.querySelector<HTMLElement>('.city-governance-head')!;
  const title = document.createElement('h2');
  const activeProject = config?.projects.find((project) => project.buildingId === activeBuilding);
  title.id = 'city-governance-title';
  // Today only the built-in commons buildings open this panel, and the server
  // rejects projects whose building is in initialBuiltBuildingIds, so this
  // branch is unreachable. Keep it defensively titled for independently
  // deployed configs that may still attach a project to the opened building.
  title.textContent = activeProject ? `众议院 · ${activeProject.name}` : '众议院';
  header.replaceChildren(title, button('关闭', closeCityGovernancePanel, false, 'close'));
  const status = root.querySelector<HTMLElement>('[data-city-status]')!;
  status.textContent = state ? `云端进度 #${state.revision}` : loading ? '正在加载建设进度…' : '城市建设数据暂时不可用';
  updateFeedback();
  const body = root.querySelector<HTMLElement>('.city-governance-body')!;
  if (bodyHasList) bodyScrollTop = body.scrollTop;
  body.replaceChildren();
  if (!config || !state) {
    bodyHasList = false;
    if (loading) {
      body.append(document.createTextNode('正在加载建设进度，请稍候…'));
    } else {
      body.append(document.createTextNode('城市建设数据暂时不可用，请稍后重试。'));
      body.append(button('重试', () => {
        const retry = body.querySelector('button');
        if (retry instanceof HTMLButtonElement) retry.disabled = true;
        void loadCityGovernance().finally(render);
      }, false, 'reload'));
    }
    if (focused) restorePanelFocus(focusKey, focusProject, focused);
    // Keep focus inside the modal while the matching snapshot loads. Restore
    // the previous control only if the user stays on that temporary fallback.
    unavailableFocus = focused && focusKey
      ? { key: focusKey, projectId: focusProject, fallback: document.activeElement } : null;
    return;
  }
  unavailableFocus = null;
  const list = document.createElement('div');
  list.className = 'city-governance-list';
  renderCollective(list, config.projects, state);
  body.append(list);
  bodyHasList = true;
  body.scrollTop = bodyScrollTop;
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
      donationDrafts.set(focusKey.slice('donate-input:'.length), previous.value);
      replacement.replaceWith(previous);
      previous.focus({ preventScroll: true });
    } else replacement.focus({ preventScroll: true });
  }
  else {
    const project = projectId ? [...root.querySelectorAll<HTMLElement>(CARD_SELECTOR)]
      .find((element) => focusedCardKey(element) === projectId) : undefined;
    const nextAction = project?.querySelector<HTMLElement>('button:not(:disabled), input:not(:disabled), select:not(:disabled)');
    (nextAction ?? root.querySelector<HTMLButtonElement>('.city-governance-head button'))?.focus({ preventScroll: true });
  }
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
    if (root === submittedPanel && root?.open && refreshCityGovernanceSession() === session) {
      const restoreActionFocus = focus.shouldRestore(failed);
      render();
      if (restoreActionFocus) focusAction(id);
    }
  }
}

function renderCollective(list: HTMLElement, projects: CityProject[], state: CityState): void {
  const sessionId = getCityVotingSessionId();
  const votesUnavailable = sessionId !== null && votesUnavailableSession === sessionId;
  const currentVotes = myVotes?.sessionId === sessionId && myVotes?.epoch === state.epoch ? myVotes : null;
  // Built projects (resident-funded or default-standing gifts) have no vote,
  // donation or progress to offer, so they leave the agenda instead of idling
  // as "已建成" cards. A town that finished everything keeps a friendly note.
  const agenda = projects.filter((project) => {
    const saved = state.projects.find((entry) => entry.id === project.id);
    return !saved?.built;
  });
  const explanation = document.createElement('p');
  explanation.className = 'city-governance-intro';
  explanation.textContent = '新城从众议院起步，建筑由居民共同捐建，建成后开放对应的剧情、商店等功能。'
    + (votesUnavailable ? '捐款满额后即可建成。' : '为期待的建筑投票，每位居民每项一票；投票不消耗金币，捐款满额后即可建成。');
  list.append(explanation);
  if (votesUnavailable) {
    const notice = document.createElement('p');
    notice.className = 'city-governance-intro';
    notice.dataset.cityVotesUnavailable = 'true';
    notice.append('当前服务端暂不支持投票，仍可参与捐款。',
      button('重新检测投票', () => { void refreshVotes(); render(); }, Boolean(votesLoading), 'votes-reload'));
    list.append(notice);
  }
  if (!agenda.length) {
    const empty = document.createElement('p');
    empty.className = 'city-governance-intro';
    empty.dataset.cityAgendaEmpty = 'true';
    empty.textContent = '当前没有待筹建的工程——已建成的建筑由全城居民共享。';
    list.append(empty);
    return;
  }
  const groups = [
    { id: 'buildings', title: '公共建筑', description: '选择希望共同筹建的公共建筑，查看进度并参与捐款。', projects: agenda.filter((project) => project.kind === 'building') },
    { id: 'landscape', title: '道路与绿化', description: '共同建设道路、灯光和公共装饰。', projects: agenda.filter((project) => project.kind !== 'building') },
  ];
  const navigation = document.createElement('nav');
  navigation.className = 'city-governance-group-links';
  navigation.setAttribute('aria-label', '建设项目分类');
  if (agenda.length) list.append(navigation);
  for (const group of groups) {
    if (!group.projects.length) continue;
    const heading = document.createElement('div');
    heading.className = 'city-governance-group-note';
    const title = document.createElement('h2');
    title.id = `city-project-group-${group.id}`;
    title.tabIndex = -1;
    title.dataset.cityFocus = `group:${group.id}`;
    title.textContent = group.title;
    const jump = button(group.title, () => {
      title.scrollIntoView({ block: 'start' });
      title.focus({ preventScroll: true });
    }, false, `group-jump:${group.id}`);
    jump.setAttribute('aria-controls', title.id);
    navigation.append(jump);
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
      if (project.kind === 'building' && !votesUnavailable) {
        if (saved?.votes !== undefined) {
          const total = document.createElement('p');
          total.dataset.cityVoteCount = project.id;
          total.textContent = `${saved.votes} 位居民支持建设`;
          item.append(total);
        }
        if (!saved?.built) {
          const voted = currentVotes?.projectIds.includes(project.id);
          const pendingVote = voting.get(project.id)?.sessionId === sessionId;
          const action = button(voted ? '已投票' : pendingVote ? '正在投票…' : '投票建设', async () => {
            const operation = { sessionId: getCityVotingSessionId() };
            if (voting.get(project.id)?.sessionId === operation.sessionId) return;
            const panel = root;
            const isCurrent = () => root === panel && root?.open && operation.sessionId === getCityVotingSessionId()
              && voting.get(project.id) === operation;
            voteError = '';
            voteFeedbackRevision += 1;
            voteNotice = '';
            votesLoading?.abort();
            votesLoading = null;
            voting.set(project.id, operation);
            render();
            let retryFocus: string | undefined;
            try {
              const result = await voteCity(project.id);
              if (result && isCurrent()) {
                acceptVotes(result);
                voteNotice = `「${project.name}」投票成功，已计入建设支持。`;
              }
            }
            catch (error) {
              if (!isCurrent()) return;
              voteError = error instanceof Error ? error.message : '投票失败，请重试';
              voteFeedbackRevision += 1;
              const currentFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
              if (focusedCardKey(currentFocus) === project.id) retryFocus = `vote:${project.id}`;
            }
            finally {
              const current = isCurrent();
              if (voting.get(project.id) === operation) voting.delete(project.id);
              if (current) render(retryFocus);
            }
          }, Boolean(voted) || pendingVote, `vote:${project.id}`);
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
        }, pendingActions.has(`projectId:${project.id}`), `donate:${project.id}`);
        item.append(amount, action);
      }
      list.append(item);
    }
  }
}

function containTabFocus(event: KeyboardEvent): void {
  if (event.key !== 'Tab' || !root) return;
  const focusable = [...root.querySelectorAll<HTMLElement>('button, input, select, textarea, a[href], [tabindex]')]
    .filter((element) => element.tabIndex >= 0 && !element.matches(':disabled')
      && element.getClientRects().length > 0 && getComputedStyle(element).visibility !== 'hidden');
  const first = focusable[0];
  const last = focusable.at(-1);
  // Native modal dialogs make the page inert, but Chromium still allows Tab
  // to reach browser chrome. Recompute visible controls after async card updates
  // so keyboard navigation keeps a complete loop inside the panel.
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
  if (activeBuilding !== buildingId) { operationError = ''; errorActionKey = ''; operationNotice = ''; voteNotice = ''; }
  activeBuilding = buildingId;
  if (root?.open) { render(); return; }
  if (!root) {
    root = document.createElement('dialog');
    root.className = 'city-governance-panel';
    root.setAttribute('aria-labelledby', 'city-governance-title');
    root.setAttribute('aria-modal', 'true');
    const header = document.createElement('header');
    header.className = 'city-governance-head';
    const status = document.createElement('p');
    status.dataset.cityStatus = 'true';
    const feedback = document.createElement('p');
    feedback.dataset.cityFeedback = 'true';
    feedback.setAttribute('role', 'alert');
    feedback.setAttribute('aria-label', '建设错误');
    feedback.setAttribute('aria-atomic', 'true');
    feedback.hidden = true;
    const notice = document.createElement('p');
    notice.dataset.cityNotice = 'true';
    notice.setAttribute('role', 'status');
    notice.setAttribute('aria-label', '建设结果');
    notice.setAttribute('aria-atomic', 'true');
    const voteFeedback = document.createElement('p');
    voteFeedback.dataset.cityVoteFeedback = 'true';
    voteFeedback.setAttribute('role', 'alert');
    voteFeedback.setAttribute('aria-label', '投票错误');
    voteFeedback.setAttribute('aria-atomic', 'true');
    voteFeedback.hidden = true;
    const voteStatus = document.createElement('p');
    voteStatus.dataset.cityVoteNotice = 'true';
    voteStatus.setAttribute('role', 'status');
    voteStatus.setAttribute('aria-label', '投票结果');
    voteStatus.setAttribute('aria-atomic', 'true');
    const body = document.createElement('main');
    body.className = 'city-governance-body';
    root.append(header, status, feedback, notice, voteFeedback, voteStatus, body);
    document.body.append(root);
    root.addEventListener('cancel', (event) => { event.preventDefault(); closeCityGovernancePanel(); });
    root.addEventListener('keydown', (event) => {
      event.stopPropagation();
      containTabFocus(event);
      if (event.key === 'Escape') { event.preventDefault(); closeCityGovernancePanel(); }
    });
    window.addEventListener('minicity:login-required', handleLoginRequired, true);
    let session = refreshCityGovernanceSession();
    unsubscribe = subscribeCityGovernance(() => {
      const nextSession = refreshCityGovernanceSession();
      if (session !== nextSession) {
        session = nextSession;
        pendingActions.clear();
        donationDrafts.clear();
        operationError = '';
        errorActionKey = '';
        operationNotice = '';
        voteError = '';
        voteNotice = '';
        votesEpoch = null;
        unavailableFocus = null;
        voting.clear();
        myVotes = null;
        votesUnavailableSession = null;
        votesLoading?.abort();
        votesLoading = null;
        // Old input nodes must not restore the previous resident's drafts.
        root?.querySelector('.city-governance-body')?.replaceChildren();
        if (root?.open) void refreshVotes();
      }
      if (!root?.open) return;
      const epoch = getCityState()?.epoch;
      if (epoch && epoch !== votesEpoch) void refreshVotes();
      render();
    });
  }
  if (!root.open) {
    returnFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
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
  const sessionId = getCityVotingSessionId();
  const epoch = getCityState()?.epoch ?? null;
  votesEpoch = epoch;
  if (myVotes && (myVotes.sessionId !== sessionId || (epoch && myVotes.epoch !== epoch))) myVotes = null;
  if (sessionId === null) { render(); return; }
  // Reopening the panel within the same session and epoch already holds the
  // confirmed votes, so skip the redundant private read. Unavailable endpoints
  // (explicit recheck), failed reads, and session or epoch changes still re-read.
  if (myVotes && epoch !== null && myVotes.sessionId === sessionId && myVotes.epoch === epoch
    && votesUnavailableSession !== sessionId) return;
  const feedbackRevision = voteFeedbackRevision;
  const controller = new AbortController();
  const panel = root;
  const isCurrent = () => !controller.signal.aborted && sequence === votesLoadSequence
    && root === panel && sessionId === getCityVotingSessionId();
  votesLoading = controller;
  try {
    const result = await loadCityVotes(controller.signal);
    if (result && isCurrent()) {
      if (result.available) acceptVotes(result.votes);
      else votesUnavailableSession = result.sessionId;
      // A read can finish after a newer vote has failed. Only clear feedback
      // that was already present when this read began.
      if (feedbackRevision === voteFeedbackRevision) voteError = '';
    }
  } catch (error) {
    if (isCurrent()) {
      votesUnavailableSession = null;
      voteError = error instanceof Error ? error.message : '读取投票记录失败';
    }
  } finally {
    if (votesLoading === controller) { votesLoading = null; if (isCurrent() && root?.open) render(); }
  }
}

export function closeCityGovernancePanel(): void {
  if (!root?.open) return;
  unavailableFocus = null;
  root.close();
  votesLoading?.abort();
  votesLoading = null;
  if (returnFocus?.isConnected) returnFocus.focus({ preventScroll: true });
  returnFocus = null;
  operationError = '';
  errorActionKey = '';
  operationNotice = '';
  voteError = '';
  voteNotice = '';
  updateFeedback();
}

export function disposeCityGovernancePanel(): void {
  closeCityGovernancePanel();
  window.removeEventListener('minicity:login-required', handleLoginRequired, true);
  unsubscribe?.();
  unsubscribe = null;
  root?.remove();
  root = null;
  unavailableFocus = null;
  activeBuilding = '';
  bodyScrollTop = 0;
  bodyHasList = false;
  errorActionKey = '';
  operationError = '';
  operationNotice = '';
  pendingActions.clear();
  donationDrafts.clear();
  myVotes = null;
  votesUnavailableSession = null;
  voteError = '';
  voteNotice = '';
  voteFeedbackRevision = 0;
  votesEpoch = null;
  voting.clear();
}
