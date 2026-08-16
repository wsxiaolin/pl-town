import { NEWSPAPER_ARCHIVE, type NewspaperBlock, type NewspaperIssue } from '../../city/data/newspapers';

export interface NewsstandControllerOptions {
  document: Document;
  signal?: AbortSignal;
}

export interface NewsstandController {
  open(): void;
  close(): void;
  isOpen(): boolean;
  openIssue(issue: NewspaperIssue): void;
}

function getElement<T extends HTMLElement>(document: Document, id: string): T {
  const element = document.getElementById(id);
  if (!element) throw new Error(`Missing newsstand element #${id}`);
  return element as T;
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

  const renderCatalog = (): void => {
    const list = getElement<HTMLDivElement>(document, 'newsstandList');
    list.replaceChildren();
    const byYear = new Map<string, NewspaperIssue[]>();
    for (const issue of NEWSPAPER_ARCHIVE) {
      const year = issue.date.split('.')[0] ?? '未注明';
      const bucket = byYear.get(year) ?? [];
      bucket.push(issue);
      byYear.set(year, bucket);
    }
    const years = [...byYear.keys()].sort((a, b) => Number(b) - Number(a));
    for (const year of years) {
      const issues = byYear.get(year) ?? [];
      const group = document.createElement('section');
      group.className = 'np-year';
      const heading = document.createElement('h3');
      heading.textContent = `${year} 年`;
      const count = document.createElement('span');
      count.className = 'np-year-count';
      count.textContent = `${issues.length} 期`;
      const headRow = document.createElement('div');
      headRow.className = 'np-year-head';
      headRow.append(heading, count);
      const entries = document.createElement('div');
      entries.className = 'np-year-list';
      for (const issue of issues) {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'np-issue';
        button.dataset.issueId = issue.id;
        const date = document.createElement('b');
        date.textContent = issue.date;
        const series = document.createElement('span');
        series.textContent = issue.series;
        const pages = document.createElement('i');
        pages.textContent = `${issue.pages.length} 版`;
        button.append(date, series, pages);
        button.addEventListener('click', () => controller.openIssue(issue), { signal: options.signal });
        entries.append(button);
      }
      group.append(headRow, entries);
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
    openIssue(issue) {
      getElement<HTMLDivElement>(document, 'newspaperOverlay').classList.add('open');
      renderIssue(issue, 0);
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
    const issue = NEWSPAPER_ARCHIVE.find((item) => item.id === getElement<HTMLDivElement>(document, 'newspaperStage').dataset.issueId);
    if (!issue) return;
    const current = Number(getElement<HTMLSpanElement>(document, 'newspaperPageNo').textContent) - 1;
    renderIssue(issue, current - 1);
  }, { signal: options.signal });
  getElement<HTMLButtonElement>(document, 'newspaperNext').addEventListener('click', () => {
    const issue = NEWSPAPER_ARCHIVE.find((item) => item.id === getElement<HTMLDivElement>(document, 'newspaperStage').dataset.issueId);
    if (!issue) return;
    const current = Number(getElement<HTMLSpanElement>(document, 'newspaperPageNo').textContent) - 1;
    renderIssue(issue, current + 1);
  }, { signal: options.signal });

  return controller;
}