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

// ── 报纸排版引擎 ──────────────────────────────────────────

/** 一个版面的语义板块（由 section block 切分） */
interface NewsSection {
  /** 板块标题，取自 kind=section 的 text；头版前的引导内容为 '' */
  title: string;
  /** 该板块的所有 blocks（含 section 标题本身） */
  blocks: NewspaperBlock[];
}

/** 按版面内容大小评估板块权重，用于决定栏宽 */
function estimateSectionWeight(blocks: readonly NewspaperBlock[]): number {
  let weight = 0;
  for (const b of blocks) {
    if (b.kind === 'link') weight += 2;
    else if (b.kind === 'text') weight += b.text.length > 40 ? 2 : 1;
    else if (b.kind === 'section') weight += 0;
    else weight += 1;
  }
  return weight;
}

/** 判断板块是否为"无实质内容"，需过滤 */
const EMPTY_PATTERNS = [
  /^无$/, /^暂无$/, /^本周暂无/,
  /不予收录/, /没有.*冲精.*作品/, /目前没有发现/,
  /没有支持未满/, /好吧，忘记写了/,
];

function sectionHasContent(section: NewsSection): boolean {
  const meaningful = section.blocks.filter(
    (b) => b.kind !== 'section' && b.kind !== 'separator' && b.kind !== 'motto',
  );
  // 含 link 的板块一定保留
  if (meaningful.some((b) => b.kind === 'link')) return true;
  // 含非空且非说明性括号文字的板块保留
  const substantive = meaningful.filter(
    (b) =>
      b.kind === 'text' &&
      b.text.trim() !== '' &&
      !b.text.startsWith('（') &&
      !EMPTY_PATTERNS.some((re) => re.test(b.text.trim())),
  );
  // 有 label 也算有结构
  if (meaningful.some((b) => b.kind === 'label')) return substantive.length > 0;
  return substantive.length > 0;
}

/** 将扁平 blocks 切分为语义板块 */
function splitSections(blocks: readonly NewspaperBlock[]): NewsSection[] {
  const sections: NewsSection[] = [];
  let current: NewsSection = { title: '', blocks: [] };
  for (const block of blocks) {
    if (block.kind === 'section') {
      if (current.blocks.length > 0) sections.push(current);
      current = { title: block.text, blocks: [block] };
    } else {
      current.blocks.push(block);
    }
  }
  if (current.blocks.length > 0) sections.push(current);
  return sections;
}

/** 渲染单个板块容器 */
function renderSectionColumn(document: Document, section: NewsSection): HTMLElement {
  const col = document.createElement('div');
  col.className = 'np-col';
  for (const block of section.blocks) {
    col.appendChild(renderBlock(document, block));
  }
  return col;
}

function renderPage(document: Document, issue: NewspaperIssue, pageIndex: number): HTMLElement {
  const page = issue.pages[pageIndex] ?? { title: '头版', blocks: [] };
  const sheet = document.createElement('article');
  sheet.className = 'np-sheet';

  // ── 报头 ──
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

  // ── 正文排版 ──
  const body = document.createElement('div');
  body.className = 'np-body';

  const allSections = splitSections(page.blocks);

  // 分离头版引导区（motto / separator 等，在第一个 section 之前的内容）
  const firstSectionIdx = allSections.findIndex((s) => s.title !== '');
  const preamble = firstSectionIdx > 0 ? allSections.slice(0, firstSectionIdx) : [];
  const namedSections = firstSectionIdx >= 0 ? allSections.slice(firstSectionIdx) : allSections;

  // 过滤无实质内容的板块
  const contentSections = namedSections.filter(sectionHasContent);

  // 引导区（motto + separator + 精知优选的 intro text）渲染为跨栏头条
  if (preamble.length > 0) {
    const headline = document.createElement('div');
    headline.className = 'np-headline';
    for (const sec of preamble) {
      for (const block of sec.blocks) {
        headline.appendChild(renderBlock(document, block));
      }
    }
    body.appendChild(headline);
  }

  // 按权重排序：最大的板块放头条跨栏，其余按多栏排版
  if (contentSections.length > 0) {
    const weighted = contentSections.map((s) => ({
      section: s,
      weight: estimateSectionWeight(s.blocks),
    }));

    // 权重最大的板块做跨栏头条（如果有多个板块且权重差距明显）
    const maxWeight = Math.max(...weighted.map((w) => w.weight));
    const leadCandidates = weighted.filter((w) => w.weight >= maxWeight * 0.6);
    const hasLead = leadCandidates.length < weighted.length && contentSections.length >= 3;

    if (hasLead) {
      // 头条跨栏
      const lead = weighted.reduce((best, w) => (w.weight > best.weight ? w : best));
      const leadCol = renderSectionColumn(document, lead.section);
      leadCol.classList.add('np-col-lead');
      body.appendChild(leadCol);

      // 其余板块多栏排列
      const rest = contentSections.filter((s) => s !== lead.section);
      if (rest.length > 0) {
        const grid = document.createElement('div');
        grid.className = 'np-grid';
        for (const sec of rest) {
          grid.appendChild(renderSectionColumn(document, sec));
        }
        body.appendChild(grid);
      }
    } else {
      // 板块不多时全部多栏
      const grid = document.createElement('div');
      grid.className = 'np-grid';
      for (const sec of contentSections) {
        grid.appendChild(renderSectionColumn(document, sec));
      }
      body.appendChild(grid);
    }
  }

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