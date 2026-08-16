import { NEWSPAPER_CATALOG, type NewspaperCatalogEntry } from '../../city/data/newspapers/newspapers-catalog';
import type { NewspaperBlock, NewspaperIssue } from '../../city/data/newspapers/newspapers-types';

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

function renderBlock(document: Document, block: NewspaperBlock): HTMLElement {
  switch (block.kind) {
    case 'motto': {
      const p = document.createElement('p');
      p.className = 'np-motto';
      p.textContent = block.text;
      return p;
    }
    case 'separator': {
      const p = document.createElement('p');
      p.className = 'np-separator';
      p.textContent = block.text.replace(/[—–\-=]/g, '—');
      return p;
    }
    case 'section': {
      const h3 = document.createElement('h3');
      h3.className = 'np-section';
      h3.textContent = block.text;
      return h3;
    }
    case 'label': {
      const p = document.createElement('p');
      p.className = 'np-label';
      p.textContent = block.text;
      return p;
    }
    case 'editor': {
      const p = document.createElement('p');
      p.className = 'np-editor';
      p.textContent = block.text;
      return p;
    }
    case 'link': {
      const span = document.createElement('span');
      span.className = `np-link np-link-${block.hrefType ?? 'discussion'}`;
      const badge = document.createElement('i');
      badge.textContent = block.hrefType === 'experiment' ? '实' : '讨';
      const text = document.createElement('b');
      text.textContent = block.text;
      span.append(badge, text);
      if (block.href) span.dataset.href = block.href;
      return span;
    }
    default: {
      const p = document.createElement('p');
      p.className = 'np-text';
      p.textContent = block.text;
      return p;
    }
  }
}

function renderPage(document: Document, issue: NewspaperIssue, pageIndex: number): HTMLElement {
  const page = issue.pages[pageIndex] ?? { title: '头版', blocks: [] };
  const sheet = document.createElement('article');
  sheet.className = 'np-sheet';
  const masthead = document.createElement('header');
  masthead.className = 'np-masthead';
  const kicker = document.createElement('span');
  kicker.className = 'np-kicker';
  kicker.textContent = `${issue.series} · 第 ${pageIndex + 1} 版`;
  const heading = document.createElement('h2');
  heading.className = 'np-issue-title';
  heading.textContent = issue.title;
  const pageLine = document.createElement('p');
  pageLine.className = 'np-page-caption';
  pageLine.textContent = page.title;
  masthead.append(kicker, heading, pageLine);
  const body = document.createElement('div');
  body.className = 'np-body';
  body.append(...page.blocks.map((block) => renderBlock(document, block)));
  sheet.append(masthead, body);
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