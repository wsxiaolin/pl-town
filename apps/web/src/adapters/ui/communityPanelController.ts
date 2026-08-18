// Physics Lab community API and panel state.
const ESC_CHARS: Record<string, string> = {
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
};
const esc = (value: unknown): string => String(value ?? '').replace(/[&<>"']/g, (ch) => ESC_CHARS[ch] ?? ch);

export interface CommunityPanelOptions {
  setPhoneOpen: (open: boolean) => void;
  showUnlockToast: (message: string) => void;
}

export interface CommunityPanelController {
  openPhoneApp: (tab: string, kind?: string) => void;
  updatePhoneBindingState: () => void;
  openPhoneBinding: () => void;
  bindPhysicsLabAccount: (event: SubmitEvent) => void;
  loadPhoneMessages: (append?: boolean) => void;
  loadPhoneSocial: (kind: string) => void;
  closeWorkDetail: () => void;
  loadWorkComments: () => void;
  postWorkComment: (event: Event) => void;
  loadWorkDerivatives: () => void;
  loadWorkSupporters: () => void;
  toggleWorkSupport: () => void;
  toggleWorkStar: () => void;
  openWorksPanel: (context: string, queryOverride?: WorksQuery | null) => void;
  closeWorksPanel: () => void;
}

interface PlUser {
  ID?: string;
  Nickname?: string;
  Verification?: string;
  Level?: number;
  Signature?: string;
}

interface PlTemplate {
  ID?: string | number;
  Subject?: { Chinese?: string };
  Content?: { Chinese?: string };
}

interface PlNotificationItem {
  TemplateID?: string | number;
  Title?: string;
  Category?: string;
  Content?: string;
  Fields?: Record<string, string | undefined>;
  UserNames?: string[];
  Numbers?: { Gold?: number | string };
}

interface PlComment {
  Author?: { Nickname?: string } | null;
  Content?: string;
  SendDate?: string;
}

interface PlSocialItem extends PlUser {
  Subject?: string;
  Stars?: number;
  Comments?: number;
  User?: PlUser | null;
}

interface PublicWork {
  id: string;
  title: string;
  author: string;
  role: string;
  year: string;
  category: string;
  tags: string[];
  abstract: string;
  status: string;
  visits?: number;
  stars?: number;
  comments?: number;
  remixes?: number;
  createdAt?: string;
  verification?: string;
}

interface WorksQuery {
  title?: string;
  [key: string]: unknown;
}

interface NotificationsPayload {
  data?: PlNotificationItem[] | { $values?: PlNotificationItem[] };
  templates?: PlTemplate[];
  hasMore?: boolean;
}

interface SocialPayload {
  data?: {
    User?: PlUser;
    Statistic?: {
      ExperimentCount?: number;
      FollowerCount?: number;
      FollowingCount?: number;
    };
    $values?: PlSocialItem[];
  };
  error?: string;
}

interface WorkSummaryPayload {
  data?: {
    Summary?: string;
    Description?: string[];
    LocalizedDescription?: string;
  };
}

interface CommentsPayload {
  data?: {
    Comments?: { $values?: PlComment[] };
    $values?: PlComment[];
  };
  error?: string;
}

interface DerivativesPayload {
  data?: {
    $values?: PlSocialItem[];
    Summaries?: { $values?: PlSocialItem[] };
  };
  error?: string;
}

interface SupportersPayload {
  data?: { $values?: PlUser[] };
  error?: string;
}

interface WorksArchivePayload {
  works?: Array<Record<string, unknown>>;
}

export function createCommunityPanelController(options: CommunityPanelOptions): CommunityPanelController {
  const { setPhoneOpen, showUnlockToast } = options;
  let phoneNotificationsRequest = 0;
  let phoneNotificationsSkip = 0;
  let phoneNotificationsLoading = false;
  let phoneNotificationsHasMore = true;
  let phoneNotificationsObserver: IntersectionObserver | null = null;
  let phoneNotificationTemplates: PlTemplate[] = [];

  function openPhoneApp(tab: string, kind?: string) {
    setPhoneOpen(true);
    const button = document.querySelector(`[data-online-tab="${tab}"]`) as HTMLElement | null;
    button?.click();
    if (tab === 'social' && kind) void loadPhoneSocial(kind);
  }

  function updatePhoneBindingState() {
    const bound = Boolean(localStorage.getItem('plSession'));
    document.getElementById('phoneNotificationBind')?.toggleAttribute('hidden', bound);
    document.getElementById('phoneSocialBind')?.toggleAttribute('hidden', bound);
    document.getElementById('phoneSocialTools')?.toggleAttribute('hidden', !bound);
    document.getElementById('phoneNotifications')?.classList.toggle('bound', bound);
    if (!bound) {
      const form = document.getElementById('phoneBindForm');
      if (form) form.hidden = false;
    }
  }
  function handlePhysicsSessionExpired() {
    if (!localStorage.getItem('plSession')) return;
    localStorage.removeItem('plSession');
    localStorage.removeItem('plUser');
    updatePhoneBindingState();
    setPhoneOpen(true);
    document.querySelector('[data-online-tab="notifications"]')?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    const form = document.getElementById('phoneBindForm');
    if (form) form.hidden = false;
    const submit = form?.querySelector('button[type="submit"]');
    if (submit) submit.textContent = '重新登录';
    const prompt = document.getElementById('phoneNotificationBind');
    prompt?.classList.add('expanded');
    prompt?.classList.add('session-expired');
    const title = prompt?.querySelector('strong');
    const description = prompt?.querySelector('p');
    if (title) title.textContent = '重新连接 Physics Lab';
    if (description) description.textContent = '登录状态已过期。重新登录后，即可继续访问社区资料与作品。';
    document.getElementById('phoneBindEmail')?.focus();
    showUnlockToast('请在手机内重新登录 Physics Lab');
  }
  function openPhoneBinding() {
    setPhoneOpen(true);
    document.querySelector('[data-online-tab="notifications"]')?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    const form = document.getElementById('phoneBindForm');
    if (form) form.hidden = false;
    document.getElementById('phoneNotificationBind')?.classList.add('expanded');
    const error = document.getElementById('phoneBindError');
    if (error) error.textContent = '';
    document.getElementById('phoneBindEmail')?.focus();
  }
  async function bindPhysicsLabAccount(event: SubmitEvent) {
    event.preventDefault();
    const emailInput = document.getElementById('phoneBindEmail') as HTMLInputElement | null;
    const passwordInput = document.getElementById('phoneBindPassword') as HTMLInputElement | null;
    const error = document.getElementById('phoneBindError');
    const submit = (event.currentTarget as HTMLElement | null)?.querySelector('button[type="submit"]') as HTMLButtonElement | null;
    const email = emailInput?.value.trim() ?? '';
    const password = passwordInput?.value ?? '';
    if (!email || !password) { if (error) error.textContent = '请输入邮箱或手机号，以及密码'; return; }
    if (submit) { submit.disabled = true; submit.textContent = '正在验证…'; }
    if (error) error.textContent = '';
    try {
      const response = await fetch('/town-api/pl/login', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ login: email, password }) });
      const payload = await response.json() as { error?: string; session?: string; user?: unknown };
      if (!response.ok) throw new Error(payload.error || 'Physics Lab 登录失败');
      if (typeof payload.session === 'string') localStorage.setItem('plSession', payload.session);
      localStorage.setItem('plUser', JSON.stringify(payload.user || {}));
      const form = document.getElementById('phoneBindForm');
      if (form) form.hidden = true;
      document.getElementById('phoneNotificationBind')?.classList.remove('session-expired');
      updatePhoneBindingState();
      showUnlockToast('Physics Lab 账号已连接');
      void loadPhoneMessages();
    } catch (caught) {
      if (error) error.textContent = caught instanceof Error ? caught.message : '绑定失败';
    } finally {
      if (submit) { submit.disabled = false; submit.textContent = '确认连接'; }
    }
  }

  async function loadPhoneMessages(append = false) {
    if (phoneNotificationsLoading) return;
    const feed = document.getElementById('phoneNotifications');
    if (!feed) return;
    let results = feed.querySelector('.phone-feed-results');
    if (!results) {
      results = document.createElement('div');
      results.className = 'phone-feed-results';
      feed.appendChild(results);
    }
    const session = localStorage.getItem('plSession');
    if (!session) {
      results.remove();
      updatePhoneBindingState();
      document.getElementById('phoneNotificationBind')?.classList.add('expanded');
      return;
    }
    if (!append) { phoneNotificationsSkip = 0; phoneNotificationsHasMore = true; phoneNotificationTemplates = []; results.replaceChildren(); }
    phoneNotificationsLoading = true;
    const requestId = ++phoneNotificationsRequest;
    const bindPrompt = document.getElementById('phoneNotificationBind');
    if (bindPrompt) bindPrompt.remove();
    if (!append) results.innerHTML = '<div class="phone-feed-loading">正在同步通知…</div>';
    try {
      const response = await fetch(`/town-api/pl/notifications?skip=${phoneNotificationsSkip}&take=20`, { headers: { 'x-town-pl-session': session }, signal: AbortSignal.timeout(20_000) });
      if (response.status === 401) {
        if (requestId === phoneNotificationsRequest) {
          phoneNotificationsRequest++;
          phoneNotificationsLoading = false;
          if (bindPrompt) feed.replaceChildren(bindPrompt);
          handlePhysicsSessionExpired();
        }
        return;
      }
      if (!response.ok) throw new Error('通知暂时无法同步');
      const payload = await response.json() as NotificationsPayload;
      const items = Array.isArray(payload.data) ? payload.data : Array.isArray(payload.data?.$values) ? payload.data.$values : [];
      const templates = Array.isArray(payload.templates) ? payload.templates : [];
      const knownTemplates = new Map(phoneNotificationTemplates.map(template => [String(template.ID), template]));
      templates.forEach(template => knownTemplates.set(String(template.ID), template));
      phoneNotificationTemplates = [...knownTemplates.values()];
      if (requestId !== phoneNotificationsRequest) return;
      const rows = items.map(item => {
        const template = phoneNotificationTemplates.find(entry => String(entry.ID) === String(item.TemplateID));
        const row = document.createElement('div');
        row.className = 'chat-line';
        const author = document.createElement('b');
        author.textContent = formatNotificationText(template?.Subject?.Chinese || item.Title || item.Category || '系统', item);
        const content = document.createElement('span');
        content.textContent = formatNotificationText(template?.Content?.Chinese || item.Content || item.Fields?.Content || '', item);
        row.append(author, content);
        return row;
      });
      if (!append) results.replaceChildren();
      results.append(...rows);
      phoneNotificationsSkip += items.length;
      phoneNotificationsHasMore = Boolean(payload.hasMore) && items.length > 0;
    } catch (error) {
      if (requestId === phoneNotificationsRequest) {
        results.innerHTML = `<div class="phone-feed-empty">${esc(error instanceof Error ? error.message : '通知暂时无法同步') || '通知暂时无法同步'}</div>`;
      }
    } finally {
      phoneNotificationsLoading = false;
    }
    phoneNotificationsObserver?.disconnect();
    if (phoneNotificationsHasMore) {
      const sentinel = document.createElement('div');
      sentinel.className = 'works-sentinel';
      results.appendChild(sentinel);
      const scrollRoot = feed.parentElement || feed;
      phoneNotificationsObserver = new IntersectionObserver(e => {
        if (e.some(x => x.isIntersecting) && !phoneNotificationsLoading) void loadPhoneMessages(true);
      }, { root: scrollRoot, rootMargin: '30%' });
      phoneNotificationsObserver.observe(sentinel);
    }
    if (bindPrompt && !feed.contains(bindPrompt)) feed.prepend(bindPrompt);
    updatePhoneBindingState();
  }

  function formatNotificationText(template: string, item: PlNotificationItem) {
    const fields = item.Fields || {};
    const users = (item.UserNames || []).join(' ');
    const work = fields.Discussion || fields.Experiment || '';
    return String(template || '')
      .replace(/{Users}/g, users)
      .replace(/{Experiment}/g, work)
      .replace(/{\$Content}/g, fields.Content || '')
      .replace(/{\$TargetName}/g, fields.TargetName || '')
      .replace(/{\$Until}/g, fields.Until || '')
      .replace(/{\$Editor}/g, fields.Editor || '')
      .replace(/{\$Gold}/g, String(item.Numbers?.Gold ?? ''))
      .replace(/undefined/g, '')
      .trim();
  }

  async function loadPhoneSocial(kind: string) {
    const target = document.getElementById('phoneSocialResults');
    if (!target) return;
    const session = localStorage.getItem('plSession');
    if (!session) { target.innerHTML = '<p>请先使用 Physics Lab 账号登录。</p>'; return; }
    target.innerHTML = '<p>正在同步社区数据…</p>';
    try {
      const response = await fetch(`/town-api/pl/social?kind=${kind}`, { headers: { 'x-town-pl-session': session } });
      const payload = await response.json() as SocialPayload;
      if (response.status === 401) { handlePhysicsSessionExpired(); return; }
      if (!response.ok) throw new Error(payload.error || '社区数据暂时不可用');
      if (kind === 'profile') {
        const user = payload.data?.User || {};
        const stats = payload.data?.Statistic || {};
        target.innerHTML = '<article class="social-profile"><strong></strong><span></span><div><b></b><b></b><b></b></div></article>';
        const strong = target.querySelector('strong');
        const span = target.querySelector('span');
        if (strong) strong.textContent = user.Nickname || 'Physics Lab user';
        if (span) span.textContent = user.Verification || `Level ${user.Level || 0}`;
        const figures = target.querySelectorAll('b');
        if (figures[0]) figures[0].textContent = `${stats.ExperimentCount || 0} 作品`;
        if (figures[1]) figures[1].textContent = `${stats.FollowerCount || 0} 粉丝`;
        if (figures[2]) figures[2].textContent = `${stats.FollowingCount || 0} 关注`;
        return;
      }
      const items = payload.data?.$values || [];
      target.replaceChildren(...(items.length ? items.slice(0, 12).map(item => {
        const row = document.createElement('article');
        row.className = 'social-row';
        const user = item.User || item;
        row.innerHTML = '<div><b></b><small></small></div><span></span>';
        const title = row.querySelector('b');
        const small = row.querySelector('small');
        const stat = row.querySelector('span');
        if (title) title.textContent = item.Subject || user.Nickname || 'Untitled';
        if (small) small.textContent = item.Subject ? (user.Nickname || 'Anonymous') : (user.Signature || user.Verification || 'Resident');
        if (stat) stat.textContent = item.Subject ? `${item.Stars || 0} ★` : (user.Verification || '');
        return row;
      }) : [Object.assign(document.createElement('p'), { textContent: '这里还没有内容。' })]));
      if (!['mine', 'favorites'].includes(kind)) {
        target.querySelectorAll('.social-row').forEach((row, index) => {
          const user = items[index]?.User || items[index];
          const userId = user?.ID;
          if (!userId) return;
          const button = document.createElement('button');
          button.type = 'button';
          button.className = 'social-follow';
          button.textContent = kind === 'following' ? '取消关注' : '关注';
          button.addEventListener('click', event => {
            event.stopPropagation();
            void toggleSocialFollow(userId, kind !== 'following', button);
          });
          row.appendChild(button);
        });
      }
    } catch (error) {
      target.innerHTML = `<p>${esc(error instanceof Error ? error.message : '社区数据暂时不可用') || '社区数据暂时不可用'}</p>`;
    }
  }

  async function toggleSocialFollow(targetId: string, follow: boolean, button: HTMLButtonElement) {
    const session = localStorage.getItem('plSession');
    if (!session) return;
    button.disabled = true;
    try {
      const response = await fetch('/town-api/pl/social/follow', { method: 'POST', headers: { 'content-type': 'application/json', 'x-town-pl-session': session }, body: JSON.stringify({ targetId, action: follow ? 1 : 0 }) });
      const payload = await response.json() as { error?: string };
      if (!response.ok) throw new Error(payload.error || '');
      button.textContent = follow ? '已关注' : '已取消';
    } catch (error) {
      showUnlockToast(error instanceof Error ? error.message : 'Unable to update follow.');
    } finally {
      button.disabled = false;
    }
  }

  const PUBLIC_WORKS: PublicWork[] = [
    { id: 'field-guide', title: 'New Resident Field Guide', author: 'TurtleSim', role: 'Steward', year: '2026', category: 'Guides', tags: ['onboarding', 'city'], abstract: 'A practical route through the city for first-time residents.', status: 'Updated' },
    { id: 'building-atlas', title: 'Architecture Atlas: Main District', author: 'Greybox', role: 'Volunteer', year: '2026', category: 'Research', tags: ['architecture', 'map'], abstract: 'Measured notes and visual records for the civic buildings.', status: 'Featured' },
    { id: 'oral-history', title: 'Voices from the Plaza', author: 'Stardust Press', role: 'Volunteer', year: '2025', category: 'Stories', tags: ['oral history', 'residents'], abstract: 'Short conversations collected around the central plaza.', status: 'Archive' },
    { id: 'mutual-aid', title: 'Mutual Aid Handbook', author: 'Commons Group', role: 'Contributor', year: '2026', category: 'Guides', tags: ['community', 'help'], abstract: 'Requests, responses and repeatable ways to help a neighbour.', status: 'Updated' },
    { id: 'night-survey', title: 'After Dark: A Lighting Survey', author: 'Aster', role: 'Volunteer', year: '2025', category: 'Research', tags: ['night', 'infrastructure'], abstract: 'A walkability study of lamps, crossings and public space.', status: 'Archive' },
    { id: 'city-code', title: 'Open City Protocol', author: 'Senate Working Group', role: 'Steward', year: '2026', category: 'Civic', tags: ['governance', 'proposal'], abstract: 'A living proposal for transparent decisions and public records.', status: 'In review' },
    { id: 'garden-notes', title: 'Conservatory Growing Notes', author: 'Lin', role: 'Contributor', year: '2026', category: 'Stories', tags: ['plants', 'care'], abstract: 'Seasonal observations from the glasshouse and its keepers.', status: 'New' }
  ];
  let worksContext = 'knowledgebase';
  let worksTitleOverride = '';
  let worksCategory = 'All';
  let liveWorks: PublicWork[] = [];
  let worksLoading = false;
  let worksHasMore = false;
  let worksError = '';
  let worksQuery: WorksQuery | null = null;
  let worksObserver: IntersectionObserver | null = null;
  let activeWorkId = '';
  let activeWorkCategory: 'Discussion' | 'Experiment' = 'Experiment';
  let activeWorkStarred = false;
  const worksRequests = new Map<string, Promise<WorksArchivePayload>>();

  function openWorkDetail(work: PublicWork) {
    activeWorkId = work.id || '';
    activeWorkCategory = work.category === 'Discussion' ? 'Discussion' : 'Experiment';
    activeWorkStarred = false;
    const star = document.getElementById('workStar');
    if (star) star.textContent = '☆ 收藏/点赞';
    const title = document.getElementById('workDetailTitle');
    if (title) title.textContent = work.title;
    const byline = document.getElementById('workDetailByline');
    if (byline) byline.textContent = `${work.author} · ${work.role || 'Resident'}`;
    const stats = document.getElementById('workDetailStats');
    if (stats) stats.textContent = `${work.visits || 0} views  ·  ${work.stars || 0} stars  ·  ${work.comments || 0} comments  ·  ${work.remixes || 0} remixes`;
    const summary = document.getElementById('workDetailSummary');
    if (summary) summary.textContent = work.abstract || 'Loading the published summary…';
    const comments = document.getElementById('workComments');
    if (comments) comments.innerHTML = '<p class="work-comments-empty">Open comments to load the discussion.</p>';
    document.getElementById('workDetailPanel')?.classList.add('open');
    void loadWorkSummary(activeWorkId);
  }
  function closeWorkDetail() {
    document.getElementById('workDetailPanel')?.classList.remove('open');
    activeWorkId = '';
    activeWorkCategory = 'Experiment';
  }
  async function loadWorkSummary(id: string) {
    const session = localStorage.getItem('plSession');
    if (!session) return;
    try {
      const response = await fetch(`/town-api/pl/work/${id}`, { headers: { 'x-town-pl-session': session, 'x-town-work-category': activeWorkCategory } });
      if (!response.ok) return;
      const payload = await response.json() as WorkSummaryPayload;
      const data = payload.data || {};
      const text = data.Summary || data.Description?.[0] || data.LocalizedDescription || '';
      if (text && id === activeWorkId) {
        const summary = document.getElementById('workDetailSummary');
        if (summary) summary.textContent = text;
      }
    } catch { /* summary is optional */ }
  }
  async function loadWorkComments() {
    const box = document.getElementById('workComments');
    if (!box) return;
    if (!activeWorkId) return;
    const session = localStorage.getItem('plSession');
    if (!session) { box.innerHTML = '<p class="work-comments-empty">Sign in with Physics Lab to load comments.</p>'; return; }
    box.innerHTML = '<p class="work-comments-empty">Loading comments…</p>';
    try {
      const response = await fetch(`/town-api/pl/work/${activeWorkId}/comments`, { headers: { 'x-town-pl-session': session, 'x-town-work-category': activeWorkCategory } });
      const payload = await response.json() as CommentsPayload;
      if (!response.ok) throw new Error(payload.error || '');
      const comments = payload.data?.Comments?.$values || payload.data?.$values || [];
      box.replaceChildren(...(comments.length ? comments.map(comment => {
        const row = document.createElement('article');
        row.className = 'work-comment';
        row.innerHTML = '<b></b><p></p><small></small>';
        const author = row.querySelector('b');
        const content = row.querySelector('p');
        const date = row.querySelector('small');
        if (author) author.textContent = comment.Author?.Nickname || 'Resident';
        if (content) content.textContent = comment.Content || '';
        if (date) date.textContent = comment.SendDate ? new Date(comment.SendDate).toLocaleDateString() : '';
        return row;
      }) : [Object.assign(document.createElement('p'), { className: 'work-comments-empty', textContent: 'No comments yet.' })]));
    } catch (error) {
      box.innerHTML = `<p class="work-comments-empty">${esc(error instanceof Error ? error.message : 'Comments unavailable.') || 'Comments unavailable.'}</p>`;
    }
  }
  async function postWorkComment(event: Event) {
    event.preventDefault();
    if (!activeWorkId) return;
    const session = localStorage.getItem('plSession');
    const input = document.getElementById('workCommentInput') as HTMLInputElement | null;
    if (!input) return;
    const content = input.value.trim();
    if (!session) { showUnlockToast('Sign in with Physics Lab to comment.'); return; }
    if (!content) return;
    const submit = (event.currentTarget as HTMLElement | null)?.querySelector('button') as HTMLButtonElement | null;
    if (submit) submit.disabled = true;
    try {
      const response = await fetch(`/town-api/pl/work/${activeWorkId}/comments`, { method: 'POST', headers: { 'content-type': 'application/json', 'x-town-pl-session': session, 'x-town-work-category': activeWorkCategory }, body: JSON.stringify({ content }) });
      const payload = await response.json() as { error?: string };
      if (!response.ok) throw new Error(payload.error || '');
      input.value = '';
      await loadWorkComments();
      showUnlockToast('Comment published.');
    } catch (error) {
      showUnlockToast(error instanceof Error ? error.message : 'Unable to publish comment.');
    } finally {
      if (submit) submit.disabled = false;
    }
  }
  async function loadWorkDerivatives() {
    const box = document.getElementById('workComments');
    if (!box) return;
    if (!activeWorkId) return;
    const session = localStorage.getItem('plSession');
    if (!session) { box.innerHTML = '<p class="work-comments-empty">Sign in to view derivatives.</p>'; return; }
    box.innerHTML = '<p class="work-comments-empty">Loading derivatives…</p>';
    try {
      const response = await fetch(`/town-api/pl/work/${activeWorkId}/derivatives`, { headers: { 'x-town-pl-session': session, 'x-town-work-category': activeWorkCategory } });
      const payload = await response.json() as DerivativesPayload;
      if (!response.ok) throw new Error(payload.error || '');
      const items = payload.data?.$values || payload.data?.Summaries?.$values || [];
      box.replaceChildren(...(items.length ? items.map(item => {
        const row = document.createElement('article');
        row.className = 'work-comment derivative-row';
        row.innerHTML = '<b></b><p></p><small></small>';
        const title = row.querySelector('b');
        const author = row.querySelector('p');
        const stats = row.querySelector('small');
        if (title) title.textContent = item.Subject || 'Untitled derivative';
        if (author) author.textContent = item.User?.Nickname || 'Anonymous';
        if (stats) stats.textContent = `${item.Stars || 0} stars · ${item.Comments || 0} comments`;
        return row;
      }) : [Object.assign(document.createElement('p'), { className: 'work-comments-empty', textContent: 'No derivatives yet.' })]));
    } catch (error) {
      box.innerHTML = `<p class="work-comments-empty">${esc(error instanceof Error ? error.message : 'Derivatives unavailable.') || 'Derivatives unavailable.'}</p>`;
    }
  }
  async function loadWorkSupporters() {
    const box = document.getElementById('workComments');
    if (!box) return;
    if (!activeWorkId) return;
    const session = localStorage.getItem('plSession');
    if (!session) { box.innerHTML = '<p class="work-comments-empty">Sign in to view supporters.</p>'; return; }
    box.innerHTML = '<p class="work-comments-empty">Loading supporters…</p>';
    try {
      const response = await fetch(`/town-api/pl/work/${activeWorkId}/supporters`, { headers: { 'x-town-pl-session': session, 'x-town-work-category': activeWorkCategory } });
      const payload = await response.json() as SupportersPayload;
      if (!response.ok) throw new Error(payload.error || '');
      const items = payload.data?.$values || [];
      box.replaceChildren(...(items.length ? items.map(user => {
        const row = document.createElement('article');
        row.className = 'work-comment';
        row.innerHTML = '<b></b><p></p>';
        const name = row.querySelector('b');
        const level = row.querySelector('p');
        if (name) name.textContent = user.Nickname || 'Resident';
        if (level) level.textContent = `Level ${user.Level || 0}`;
        return row;
      }) : [Object.assign(document.createElement('p'), { className: 'work-comments-empty', textContent: 'No supporters yet.' })]));
    } catch (error) {
      box.innerHTML = `<p class="work-comments-empty">${esc(error instanceof Error ? error.message : 'Supporters unavailable.') || 'Supporters unavailable.'}</p>`;
    }
  }
  async function toggleWorkSupport() {
    if (!activeWorkId) return;
    const session = localStorage.getItem('plSession');
    if (!session) { showUnlockToast('Sign in with Physics Lab to support works.'); return; }
    const button = document.getElementById('workSupport') as HTMLButtonElement | null;
    if (button) button.disabled = true;
    try {
      const response = await fetch(`/town-api/pl/work/${activeWorkId}/support`, { method: 'POST', headers: { 'content-type': 'application/json', 'x-town-pl-session': session, 'x-town-work-category': activeWorkCategory }, body: JSON.stringify({ action: 1 }) });
      const payload = await response.json() as { error?: string };
      if (!response.ok) throw new Error(payload.error || '');
      if (button) button.textContent = '已支持';
    } catch (error) {
      showUnlockToast(error instanceof Error ? error.message : 'Unable to support work.');
    } finally {
      if (button) button.disabled = false;
    }
  }
  async function toggleWorkStar() {
    if (!activeWorkId) return;
    const session = localStorage.getItem('plSession');
    if (!session) { showUnlockToast('Sign in with Physics Lab to star works.'); return; }
    const button = document.getElementById('workStar') as HTMLButtonElement | null;
    if (button) button.disabled = true;
    try {
      const next = !activeWorkStarred;
      const response = await fetch(`/town-api/pl/work/${activeWorkId}/star`, { method: 'POST', headers: { 'content-type': 'application/json', 'x-town-pl-session': session, 'x-town-work-category': activeWorkCategory }, body: JSON.stringify({ action: next ? 1 : 0 }) });
      if (!response.ok) throw new Error('Unable to update star');
      activeWorkStarred = next;
      if (button) button.textContent = next ? '★ 已点赞' : '☆ 收藏/点赞';
    } catch (error) {
      showUnlockToast(error instanceof Error ? error.message : 'Unable to update star');
    } finally {
      if (button) button.disabled = false;
    }
  }

  function openWorksPanel(context: string, queryOverride: WorksQuery | null = null) {
    worksContext = context;
    worksTitleOverride = queryOverride?.title || '';
    worksQuery = queryOverride;
    worksCategory = 'All';
    worksObserver?.disconnect();
    document.getElementById('worksPanel')?.classList.add('open');
    void loadWorks(context, queryOverride);
  }
  function closeWorksPanel() {
    worksObserver?.disconnect();
    document.getElementById('worksPanel')?.classList.remove('open');
  }
  async function loadWorks(context: string, queryOverride: WorksQuery | null = null, append = false) {
    if (worksLoading) return;
    worksLoading = true;
    worksError = '';
    if (!append) { liveWorks = []; worksHasMore = false; }
    renderWorksPanel();
    const scope = ['senate', 'all', 'discussion', 'featured'].includes(context) ? context : 'knowledge';
    try {
      const { title: _title, ...configuredQuery } = queryOverride || {};
      const take = Number(configuredQuery.Take) || 24;
      const query: Record<string, unknown> = { ...configuredQuery };
      if (queryOverride) {
        query.Skip = (Number(configuredQuery.Skip) || 0) + liveWorks.length;
        query.From = append && liveWorks.length ? liveWorks[liveWorks.length - 1]!.id : (configuredQuery.From ?? null);
      }
      const request = queryOverride ? fetch('/town-api/works/query', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ query }) }) : fetch(`/town-api/works?scope=${scope}`);
      const requestKey = `${context}:${JSON.stringify(query)}`;
      if (!worksRequests.has(requestKey)) {
        worksRequests.set(requestKey, request.then(async response => {
          if (!response.ok) throw new Error('The public archive is temporarily unavailable.');
          return response.json() as Promise<WorksArchivePayload>;
        }).finally(() => worksRequests.delete(requestKey)));
      }
      const payload = await worksRequests.get(requestKey)!;
      if (context !== worksContext) return;
      const page: PublicWork[] = (payload.works || []).map(raw => {
        const verification = typeof raw.verification === 'string' ? raw.verification : '';
        const createdAt = typeof raw.createdAt === 'string' || typeof raw.createdAt === 'number' ? Number(raw.createdAt) : Date.now();
        return {
          id: String(raw.id ?? ''),
          title: String(raw.title ?? 'Untitled'),
          author: String(raw.author ?? 'Anonymous'),
          category: String(raw.category ?? 'Experiment'),
          tags: Array.isArray(raw.tags) ? raw.tags.map(String) : [],
          role: verification || 'Resident',
          year: new Date(createdAt).getFullYear().toString(),
          abstract: `${raw.visits ?? 0} views · ${raw.stars ?? 0} stars · ${raw.comments ?? 0} comments · ${raw.remixes ?? 0} remixes`,
          status: verification || 'Public',
          verification,
        };
      });
      const known = new Set(liveWorks.map(work => work.id));
      liveWorks.push(...page.filter(work => !known.has(work.id)));
      worksHasMore = Boolean(queryOverride) && page.length >= take;
    } catch (error) {
      if (context !== worksContext) return;
      worksError = error instanceof Error ? error.message : 'The public archive is temporarily unavailable.';
    } finally {
      if (context === worksContext) { worksLoading = false; renderWorksPanel(); }
    }
  }
  function renderWorksPanel() {
    const isSenate = worksContext === 'senate';
    const fallback = isSenate ? PUBLIC_WORKS.filter(w => w.role === 'Volunteer' || w.role === 'Steward') : PUBLIC_WORKS;
    const source = liveWorks.length ? liveWorks : (worksError ? fallback : []);
    const filtered = source;
    const viewCopy: Record<string, [string, string, string]> = {
      discussion: ['BLACK HOLE · DISCUSSIONS', 'Community discussions', 'Questions, stories and debates from the discussion district.'],
      featured: ['REVIEW DESK · SELECTED', 'Selected works', 'Featured experiments chosen by the community.'],
    };
    const copy = viewCopy[worksContext];
    const kicker = document.getElementById('worksKicker');
    if (kicker) kicker.textContent = copy?.[0] || (isSenate ? 'UPPER HOUSE · CONTRIBUTIONS' : worksContext === 'all' ? 'CITY FEED · NEW WORKS' : 'KNOWLEDGE BASE · CATALOGUE');
    const title = document.getElementById('worksTitle');
    if (title) title.textContent = worksTitleOverride || copy?.[1] || (isSenate ? 'Volunteer works' : worksContext === 'all' ? 'All public works' : 'The city knowledge base');
    const list = document.getElementById('worksList');
    if (!list) return;
    if (worksLoading && !liveWorks.length) { list.innerHTML = '<div class="works-loading"><i></i><span>Retrieving public works</span></div>'; return; }
    list.replaceChildren(...filtered.map(work => {
      const article = document.createElement('article');
      article.className = 'work-record';
      article.dataset.workId = work.id || '';
      const content = document.createElement('div');
      content.className = 'work-content';
      const meta = document.createElement('div');
      meta.className = 'work-meta';
      const category = document.createElement('span');
      category.textContent = work.category;
      const year = document.createElement('span');
      year.textContent = work.year;
      const status = document.createElement('b');
      status.textContent = work.status;
      meta.append(category, year, status);
      const title = document.createElement('h3');
      title.textContent = work.title;
      const byline = document.createElement('p');
      byline.className = 'work-byline';
      byline.textContent = `${work.author} · ${work.role}`;
      const abstract = document.createElement('p');
      abstract.className = 'work-abstract';
      abstract.textContent = work.abstract;
      const tags = document.createElement('div');
      tags.className = 'work-tags';
      (work.tags || []).forEach(tag => {
        const span = document.createElement('span');
        span.textContent = tag;
        tags.appendChild(span);
      });
      content.append(meta, title, byline, abstract, tags);
      article.appendChild(content);
      // Work detail content is temporarily disabled; restore the click handler with the detail drawer.
      return article;
    }));
    if (!filtered.length) {
      const empty = document.createElement('p');
      empty.className = 'works-empty';
      empty.textContent = 'No matching records.';
      list.appendChild(empty);
    }
    if (worksHasMore || worksLoading) {
      const sentinel = document.createElement('div');
      sentinel.className = 'works-sentinel';
      if (worksLoading) sentinel.innerHTML = '<div class="works-loading"><i></i><span>Retrieving public works</span></div>';
      list.appendChild(sentinel);
      worksObserver?.disconnect();
      worksObserver = new IntersectionObserver(entries => {
        if (entries.some(entry => entry.isIntersecting) && worksHasMore && !worksLoading) void loadWorks(worksContext, worksQuery, true);
      }, { root: list, rootMargin: '30%', threshold: 0 });
      worksObserver.observe(sentinel);
    } else worksObserver?.disconnect();
  }

  // ── Theme ─────────────────────────────────────────────────────────────────────

  return {
    openPhoneApp, updatePhoneBindingState, openPhoneBinding, bindPhysicsLabAccount,
    loadPhoneMessages, loadPhoneSocial, closeWorkDetail, loadWorkComments,
    postWorkComment, loadWorkDerivatives, loadWorkSupporters, toggleWorkSupport,
    toggleWorkStar, openWorksPanel, closeWorksPanel,
  } satisfies CommunityPanelController;
}
