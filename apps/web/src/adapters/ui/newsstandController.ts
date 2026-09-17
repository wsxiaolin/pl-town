import { NEWSPAPER_CATALOG, type NewspaperCatalogEntry } from '../../city/data/newspapers/newspapers-catalog';
import type { NewspaperIssue, NewspaperPage } from '../../city/data/newspapers/newspapers-types';
import { buildPageLayout, type LayoutGroup, type LayoutItem, type LayoutStory, type PageLayout } from './newsstandLayout';

export interface NewsstandControllerOptions {
  document: Document;
  signal?: AbortSignal;
}

export interface NewsstandController {
  open(): void;
  close(): void;
  isOpen(): boolean;
  openIssue(issueId: string): Promise<void>;
}

function getElement<T extends HTMLElement>(document: Document, id: string): T {
  const element = document.getElementById(id);
  if (!element) throw new Error(`Missing newsstand element #${id}`);
  return element as T;
}

// 报摊内容按年份拆分为独立 chunk，仅在用户点击某期时按需加载，
// 避免在页面初始加载时拉取全部报纸正文。
const YEAR_LOADERS: Readonly<Record<string, () => Promise<{ NEWSPAPER_ISSUES_2023?: readonly NewspaperIssue[]; NEWSPAPER_ISSUES_2024?: readonly NewspaperIssue[]; NEWSPAPER_ISSUES_2025?: readonly NewspaperIssue[]; NEWSPAPER_ISSUES_2026?: readonly NewspaperIssue[] }>>> = {
  '2023': () => import('../../city/data/newspapers/newspapers-2023'),
  '2024': () => import('../../city/data/newspapers/newspapers-2024'),
  '2025': () => import('../../city/data/newspapers/newspapers-2025'),
  '2026': () => import('../../city/data/newspapers/newspapers-2026'),
};

// 历年刊物已静态归档；目录里如出现归档年份之外的条目（例如未来新增的年份），
// 加载器会缺失，此时向用户提示“暂不可用”而非静默失败。
const UNAVAILABLE_MESSAGE = '该期暂不可用';

async function loadIssue(entry: NewspaperCatalogEntry): Promise<NewspaperIssue | undefined> {
  const year = entry.date.split('.')[0] ?? '';
  const loader = YEAR_LOADERS[year];
  if (!loader) return undefined;
  let mod: Awaited<ReturnType<typeof loader>>;
  try {
    mod = await loader();
  } catch {
    // 动态 chunk 加载失败（离线、CDN 异常等）时返回 undefined，由调用方提示用户。
    return undefined;
  }
  const list = mod[`NEWSPAPER_ISSUES_${year}` as keyof typeof mod] as readonly NewspaperIssue[] | undefined;
  return list?.find((issue) => issue.id === entry.id);
}

// ── 报纸渲染 ──────────────────────────────────────────────
// 版面模型（分栏、栏目、署名、空分类折叠）由 newsstandLayout 计算，
// 这里只负责把模型映射成 DOM，保持排版逻辑可单测。

function element<K extends keyof HTMLElementTagNameMap>(
  document: Document,
  tag: K,
  className?: string,
  text?: string,
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function renderMasthead(document: Document, issue: NewspaperIssue, page: NewspaperPage, pageIndex: number): HTMLElement {
  const masthead = element(document, 'header', 'np-masthead');
  const title = element(document, 'h2', 'np-issue-title', issue.title);
  const dateline = element(document, 'p', 'np-dateline');
  const parts = [page.title, issue.date];
  parts.forEach((part, index) => {
    if (index > 0) dateline.append(element(document, 'span', 'np-dateline-dot', '◆'));
    dateline.append(element(document, 'span', 'np-dateline-item', part));
  });
  masthead.append(element(document, 'p', 'np-kicker', `第 ${pageIndex + 1} 版`), title, dateline);
  return masthead;
}

function renderItem(document: Document, item: LayoutItem): HTMLLIElement {
  const li = element(document, 'li', 'np-item');
  if (item.kind === 'link') {
    const hrefType = item.hrefType ?? 'discussion';
    const link = element(document, 'span', `np-link np-link-${hrefType}`);
    if (item.href) link.dataset.href = item.href;
    const badge = element(document, 'i');
    badge.textContent = hrefType === 'experiment' ? '实' : '讨';
    link.append(badge, element(document, 'b', undefined, item.text));
    li.append(link);
  } else {
    li.append(element(document, 'span', 'np-item-text', item.text));
  }
  if (item.byline) li.append(element(document, 'em', 'np-byline', `／${item.byline}`));
  return li;
}

function renderItems(document: Document, items: readonly LayoutItem[], multiColumn = false): HTMLUListElement {
  const list = element(document, 'ul', multiColumn ? 'np-items np-items--multi' : 'np-items');
  for (const item of items) list.append(renderItem(document, item));
  return list;
}

function renderGroup(document: Document, group: LayoutGroup): HTMLElement {
  const box = element(document, 'div', 'np-group');
  box.append(element(document, 'h4', 'np-group-label', group.label), renderItems(document, group.items));
  return box;
}

function renderProse(document: Document, paragraphs: readonly string[]): HTMLElement {
  const prose = element(document, 'div', 'np-prose');
  for (const text of paragraphs) prose.append(element(document, 'p', 'np-paragraph', text));
  return prose;
}

function renderStory(document: Document, story: LayoutStory, lead: boolean): HTMLElement {
  const section = element(document, 'section', lead ? 'np-story np-story--lead' : 'np-story');
  const head = element(document, 'header', 'np-story-head');
  head.append(element(document, 'h3', 'np-story-title', story.title));
  section.append(head);

  for (const note of story.deck) section.append(element(document, 'p', 'np-story-deck', note));
  for (const band of story.bands) {
    const row = element(document, 'div', 'np-story-band');
    row.append(element(document, 'span', 'np-story-band-text', band));
    section.append(row);
  }
  if (story.paragraphs.length > 0) section.append(renderProse(document, story.paragraphs));
  if (story.loose.length > 0) section.append(renderItems(document, story.loose, story.loose.length > 3));

  if (story.groups.length > 0) {
    const groups = element(document, 'div', 'np-groups');
    for (const group of story.groups) groups.append(renderGroup(document, group));
    section.append(groups);
  }

  if (story.emptyLabels.length > 0) {
    const muted = element(document, 'p', 'np-empty-labels');
    muted.append(element(document, 'span', 'np-empty-labels-title', '本栏暂无'));
    muted.append(element(document, 'span', 'np-empty-labels-list', story.emptyLabels.join(' · ')));
    section.append(muted);
  }

  return section;
}

function renderFront(document: Document, layout: PageLayout): HTMLElement | null {
  const empty =
    layout.motto === null &&
    layout.separator === null &&
    layout.frontItems.length === 0 &&
    layout.frontParagraphs.length === 0;
  if (empty) return null;
  const front = element(document, 'div', 'np-front');
  if (layout.motto !== null) front.append(element(document, 'p', 'np-motto', layout.motto));
  if (layout.separator !== null) {
    const band = element(document, 'div', 'np-front-band');
    band.append(element(document, 'span', 'np-front-band-text', layout.separator));
    front.append(band);
  }
  if (layout.frontParagraphs.length > 0) front.append(renderProse(document, layout.frontParagraphs));
  if (layout.frontItems.length > 0) front.append(renderItems(document, layout.frontItems, true));
  return front;
}

function renderPage(document: Document, issue: NewspaperIssue, pageIndex: number): HTMLElement {
  const page = issue.pages[pageIndex] ?? { title: '头版', blocks: [] };
  const layout = buildPageLayout(page);

  const sheet = element(document, 'article', 'np-sheet');
  const body = element(document, 'div', 'np-body');

  const front = renderFront(document, layout);
  if (front) body.append(front);

  const stories = layout.stories;
  const hasBody = stories.length > 0 || layout.frontParagraphs.length > 0 || layout.frontItems.length > 0;
  if (!hasBody) {
    body.append(element(document, 'div', 'np-blank', '本版暂无内容'));
  } else if (stories.length > 0) {
    let leadIndex = 0;
    for (let index = 1; index < stories.length; index += 1) {
      const story = stories[index];
      const best = stories[leadIndex];
      if (story && best && story.weight > best.weight) leadIndex = index;
    }
    stories.forEach((story, index) => {
      body.append(renderStory(document, story, index === leadIndex));
    });
  }

  sheet.append(renderMasthead(document, issue, page, pageIndex), body);
  return sheet;
}

export function createNewsstandController(options: NewsstandControllerOptions): NewsstandController {
  const { document } = options;
  let opened = false;
  const loaded = new Map<string, NewspaperIssue>();
  // openIssue 防竞态序号：每次发起异步加载自增，await 后若序号已变说明有更新的点击。
  let clickSeq = 0;

  const renderCatalog = (): void => {
    const list = getElement<HTMLDivElement>(document, 'newsstandList');
    list.replaceChildren();
    const byYear = new Map<string, NewspaperCatalogEntry[]>();
    for (const entry of NEWSPAPER_CATALOG) {
      const year = entry.date.split('.')[0] ?? '未注明';
      const bucket = byYear.get(year) ?? [];
      bucket.push(entry);
      byYear.set(year, bucket);
    }
    const years = [...byYear.keys()].sort((a, b) => Number(b) - Number(a));
    for (const year of years) {
      const entries = byYear.get(year) ?? [];
      const group = document.createElement('section');
      group.className = 'np-year';
      const heading = document.createElement('h3');
      heading.textContent = `${year} 年`;
      const count = document.createElement('span');
      count.className = 'np-year-count';
      count.textContent = `${entries.length} 期`;
      const headRow = document.createElement('div');
      headRow.className = 'np-year-head';
      headRow.append(heading, count);
      const items = document.createElement('div');
      items.className = 'np-year-list';
      for (const entry of entries) {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'np-issue';
        button.dataset.issueId = entry.id;
        const date = document.createElement('b');
        date.textContent = entry.date;
        const series = document.createElement('span');
        series.textContent = entry.series;
        const pages = document.createElement('i');
        pages.textContent = `${entry.pageCount} 版`;
        button.append(date, series, pages);
        button.addEventListener('click', () => {
          void controller.openIssue(entry.id);
        }, { signal: options.signal });
        items.append(button);
      }
      group.append(headRow, items);
      list.append(group);
    }
  };

  const renderIssue = (issue: NewspaperIssue, pageIndex: number): void => {
    const pages = issue.pages;
    const current = Math.min(Math.max(pageIndex, 0), pages.length - 1);
    getElement<HTMLDivElement>(document, 'newspaperStage').replaceChildren(renderPage(document, issue, current));
    getElement<HTMLSpanElement>(document, 'newspaperPageNo').textContent = `${current + 1}`;
    getElement<HTMLSpanElement>(document, 'newspaperPageTotal').textContent = `${pages.length}`;
    getElement<HTMLButtonElement>(document, 'newspaperPrev').disabled = current === 0;
    getElement<HTMLButtonElement>(document, 'newspaperNext').disabled = current >= pages.length - 1;
    const meta = getElement<HTMLSpanElement>(document, 'newspaperMeta');
    meta.textContent = `${issue.series} ${issue.date}`;
    (getElement<HTMLDivElement>(document, 'newspaperStage').dataset.issueId = issue.id);
  };

  // 当某期加载失败或年份未归档时，向用户展示可见提示，而不是静默无反应。
  const renderUnavailable = (entry: NewspaperCatalogEntry): void => {
    const sheet = document.createElement('article');
    sheet.className = 'np-sheet np-unavailable';
    const heading = document.createElement('h2');
    heading.className = 'np-issue-title';
    heading.textContent = entry.title;
    const note = document.createElement('p');
    note.className = 'np-text';
    note.textContent = UNAVAILABLE_MESSAGE;
    sheet.append(heading, note);
    getElement<HTMLDivElement>(document, 'newspaperStage').replaceChildren(sheet);
    getElement<HTMLSpanElement>(document, 'newspaperPageNo').textContent = '0';
    getElement<HTMLSpanElement>(document, 'newspaperPageTotal').textContent = '0';
    getElement<HTMLButtonElement>(document, 'newspaperPrev').disabled = true;
    getElement<HTMLButtonElement>(document, 'newspaperNext').disabled = true;
    getElement<HTMLSpanElement>(document, 'newspaperMeta').textContent = `${entry.series} ${entry.date}`;
    delete getElement<HTMLDivElement>(document, 'newspaperStage').dataset.issueId;
  };

  const getLoadedIssue = async (): Promise<NewspaperIssue | undefined> => {
    const id = getElement<HTMLDivElement>(document, 'newspaperStage').dataset.issueId;
    if (!id) return undefined;
    const cached = loaded.get(id);
    if (cached) return cached;
    const entry = NEWSPAPER_CATALOG.find((item) => item.id === id);
    if (!entry) return undefined;
    const issue = await loadIssue(entry);
    if (issue) loaded.set(id, issue);
    return issue;
  };

  const controller: NewsstandController = {
    open() {
      if (opened) return;
      opened = true;
      renderCatalog();
      getElement<HTMLDivElement>(document, 'newsstandPanel').classList.add('open');
    },
    close() {
      if (!opened) return;
      opened = false;
      getElement<HTMLDivElement>(document, 'newsstandPanel').classList.remove('open');
      getElement<HTMLDivElement>(document, 'newspaperOverlay').classList.remove('open');
    },
    isOpen: () => opened,
    async openIssue(issueId) {
      const cached = loaded.get(issueId);
      if (cached) {
        getElement<HTMLDivElement>(document, 'newspaperOverlay').classList.add('open');
        renderIssue(cached, 0);
        return;
      }
      const entry = NEWSPAPER_CATALOG.find((item) => item.id === issueId);
      if (!entry) return;
      // 防竞态：连续点击不同年份的冷期次会触发多个并发 import()，
      // 用单调递增的序号保证只有“最后一次点击”的渲染会生效。
      const seq = ++clickSeq;
      const issue = await loadIssue(entry);
      if (seq !== clickSeq) return;
      getElement<HTMLDivElement>(document, 'newspaperOverlay').classList.add('open');
      if (issue) {
        loaded.set(issueId, issue);
        renderIssue(issue, 0);
      } else {
        renderUnavailable(entry);
      }
    },
  };

  getElement<HTMLButtonElement>(document, 'newsstandClose').addEventListener('click', () => controller.close(), { signal: options.signal });
  getElement<HTMLButtonElement>(document, 'newspaperClose').addEventListener('click', () => {
    getElement<HTMLDivElement>(document, 'newspaperOverlay').classList.remove('open');
  }, { signal: options.signal });
  getElement<HTMLButtonElement>(document, 'newspaperBack').addEventListener('click', () => {
    getElement<HTMLDivElement>(document, 'newspaperOverlay').classList.remove('open');
  }, { signal: options.signal });
  getElement<HTMLButtonElement>(document, 'newspaperPrev').addEventListener('click', () => {
    void (async () => {
      const issue = await getLoadedIssue();
      if (!issue) return;
      const current = Number(getElement<HTMLSpanElement>(document, 'newspaperPageNo').textContent) - 1;
      renderIssue(issue, current - 1);
    })();
  }, { signal: options.signal });
  getElement<HTMLButtonElement>(document, 'newspaperNext').addEventListener('click', () => {
    void (async () => {
      const issue = await getLoadedIssue();
      if (!issue) return;
      const current = Number(getElement<HTMLSpanElement>(document, 'newspaperPageNo').textContent) - 1;
      renderIssue(issue, current + 1);
    })();
  }, { signal: options.signal });

  return controller;
}
