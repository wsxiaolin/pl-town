import { townApiFetch } from './core/townApi';

// The bulletin board's standalone page: renders the announcement feed exactly
// as the Physics Lab client publishes it (version notes, events, community
// links). All copy arrives from the upstream API, so every string is written
// through textContent — never innerHTML — to keep third-party text inert.

type Announcement = {
  id: string;
  subject: string;
  content: string;
  link: string | null;
  linkText: string | null;
  start: string | null;
  finish: string | null;
  priority: number;
  isAttendance: boolean;
};

type Feed = { source: 'live'; cached: boolean; announcements: Announcement[] };

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const board = $('board');
const state = $('state');

const formatDate = (iso: string | null): string => {
  if (!iso) return '';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day}`;
};

function showState(kind: 'loading' | 'error' | 'empty', message: string): void {
  state.hidden = false;
  state.textContent = '';
  if (kind === 'loading') {
    const spinner = document.createElement('span');
    spinner.className = 'spinner';
    state.append(spinner, document.createElement('br'), message);
  } else {
    state.append(message);
    if (kind === 'error') {
      const retry = document.createElement('button');
      retry.type = 'button';
      retry.textContent = '重试';
      retry.addEventListener('click', () => { void load(); });
      state.append(document.createElement('br'), retry);
    }
  }
}

function renderNotice(announcement: Announcement): HTMLElement {
  const notice = document.createElement('article');
  notice.className = 'notice';

  const title = document.createElement('h2');
  title.className = 'notice-subject';
  title.textContent = announcement.subject;
  notice.append(title);

  const meta = document.createElement('p');
  meta.className = 'notice-meta';
  const start = formatDate(announcement.start);
  if (start) {
    const span = document.createElement('span');
    span.textContent = `${start} 起`;
    meta.append(span);
  }
  const finish = formatDate(announcement.finish);
  if (finish) {
    const span = document.createElement('span');
    span.textContent = `至 ${finish}`;
    meta.append(span);
  }
  if (announcement.isAttendance) {
    const badge = document.createElement('span');
    badge.className = 'badge';
    badge.textContent = '可签到';
    meta.append(badge);
  }
  if (meta.childNodes.length > 0) notice.append(meta);

  if (announcement.content) {
    const body = document.createElement('p');
    body.className = 'notice-content';
    body.textContent = announcement.content;
    notice.append(body);
  }

  // Upstream links are already narrowed to http(s) on the server; the extra
  // protocol guard here keeps the page safe even against a rogue response.
  if (announcement.link && /^https?:\/\//i.test(announcement.link)) {
    const actions = document.createElement('div');
    actions.className = 'notice-actions';
    const anchor = document.createElement('a');
    anchor.href = announcement.link;
    anchor.target = '_blank';
    anchor.rel = 'noopener noreferrer';
    anchor.textContent = announcement.linkText || '查看详情';
    actions.append(anchor);
    notice.append(actions);
  }
  return notice;
}

async function load(): Promise<void> {
  board.querySelectorAll('.notice').forEach((node) => node.remove());
  showState('loading', '正在从社区取回公告……');
  try {
    const response = await townApiFetch('/town-api/announcements');
    if (!response.ok) throw new Error(`公告服务暂时不可用（${response.status}）`);
    const feed = await response.json() as Feed;
    if (!Array.isArray(feed.announcements) || feed.announcements.length === 0) {
      showState('empty', '公告板上暂时空空如也，社区还没有张贴新的通告。');
      return;
    }
    state.hidden = true;
    for (const announcement of feed.announcements) board.append(renderNotice(announcement));
  } catch (error) {
    showState('error', error instanceof Error ? error.message : '公告加载失败，请稍后再试。');
  }
}

void load();
