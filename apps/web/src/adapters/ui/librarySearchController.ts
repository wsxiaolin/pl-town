// Library works search panel: opened by the town library building, queries the
// community projects archive (projects-ai-summary) and renders result cards.
import {
  LIBRARY_SEARCH_API_BASE,
  LIBRARY_SEARCH_YEARS,
  buildLibrarySearchUrl,
  libraryArchiveMetaUrl,
  libraryHotTermsUrl,
  libraryWorkMetaLine,
  libraryWorkTags,
  libraryWorkUrls,
  type LibrarySearchResponse,
  type LibrarySearchParams,
  type LibraryWorkRecord,
} from '../../city/data/libraryWorksSearch';

const HOT_TERMS_LIMIT = 8;

export interface LibrarySearchControllerOptions {
  document: Document;
  signal?: AbortSignal;
}

export interface LibrarySearchController {
  open: () => void;
  close: () => void;
  isOpen: () => boolean;
}

function getElement<T extends HTMLElement>(document: Document, id: string): T {
  const element = document.getElementById(id);
  if (!element) throw new Error(`Missing library search element #${id}`);
  return element as T;
}

function fmtCount(value: number): string {
  return value.toLocaleString('en-US');
}

export function createLibrarySearchController(options: LibrarySearchControllerOptions): LibrarySearchController {
  const { document, signal } = options;
  const panel = getElement<HTMLDivElement>(document, 'librarySearchPanel');
  const metaLine = getElement<HTMLParagraphElement>(document, 'librarySearchMeta');
  const form = getElement<HTMLFormElement>(document, 'librarySearchForm');
  const keywordsInput = getElement<HTMLInputElement>(document, 'libraryKeywords');
  const authorInput = getElement<HTMLInputElement>(document, 'libraryAuthor');
  const yearSelect = getElement<HTMLSelectElement>(document, 'libraryYear');
  const hotTermsRow = getElement<HTMLDivElement>(document, 'libraryHotTerms');
  const results = getElement<HTMLDivElement>(document, 'libraryResults');

  for (const year of LIBRARY_SEARCH_YEARS) {
    const option = document.createElement('option');
    option.value = String(year);
    option.textContent = `${year} 年`;
    yearSelect.appendChild(option);
  }

  let opened = false;
  let lastSearch: LibrarySearchParams | null = null;
  let searchToken = 0;

  function currentParams(): LibrarySearchParams {
    const year = Number(yearSelect.value);
    return {
      keywords: keywordsInput.value,
      author: authorInput.value,
      year: yearSelect.value && Number.isFinite(year) ? year : null,
    };
  }

  function search(params: LibrarySearchParams): void {
    lastSearch = params;
    const token = ++searchToken;
    results.replaceChildren();
    const loading = document.createElement('div');
    loading.className = 'works-loading';
    loading.innerHTML = '<i></i><span>正在翻阅馆藏目录…</span>';
    results.appendChild(loading);
    void (async () => {
      try {
        const response = await fetch(buildLibrarySearchUrl(LIBRARY_SEARCH_API_BASE, params));
        if (!response.ok) throw new Error(`archive responded ${response.status}`);
        const payload = (await response.json()) as LibrarySearchResponse;
        if (token !== searchToken) return;
        renderResults(params, payload.records ?? []);
      } catch (error) {
        if (token !== searchToken) return;
        renderError(error);
      }
    })();
  }

  function renderResults(params: LibrarySearchParams, records: LibraryWorkRecord[]): void {
    results.replaceChildren();
    const heading = document.createElement('p');
    heading.className = 'library-count';
    const described = [params.keywords.trim(), params.author.trim(), params.year !== null ? `${params.year} 年` : '']
      .filter(Boolean).join(' · ');
    if (records.length) {
      heading.textContent = `${described ? `「${described}」` : '全部馆藏'}找到 ${fmtCount(records.length)} 件作品`;
      results.appendChild(heading);
    } else {
      heading.textContent = described ? `没有找到与「${described}」相关的馆藏` : '馆藏暂时没有可展示的作品';
      results.appendChild(heading);
      const empty = document.createElement('p');
      empty.className = 'library-hint';
      empty.textContent = '换个关键词试试——支持标题、作者、关键词与学科检索。';
      results.appendChild(empty);
      return;
    }
    for (const record of records) results.appendChild(renderCard(record));
  }

  function renderCard(record: LibraryWorkRecord): HTMLElement {
    const urls = libraryWorkUrls(LIBRARY_SEARCH_API_BASE, record.id);
    const article = document.createElement('article');
    article.className = 'library-work';

    const meta = document.createElement('p');
    meta.className = 'library-work-meta';
    meta.textContent = libraryWorkMetaLine(record);
    article.appendChild(meta);

    const title = document.createElement('a');
    title.className = 'library-work-title';
    title.href = urls.archive;
    title.target = '_blank';
    title.rel = 'noopener';
    title.textContent = String(record.name || '未命名作品');
    article.appendChild(title);

    const summary = String(record.summary || '').trim();
    if (summary) {
      const paragraph = document.createElement('p');
      paragraph.className = 'library-work-summary';
      paragraph.textContent = summary;
      article.appendChild(paragraph);
    }

    const tags = libraryWorkTags(record);
    if (tags.length) {
      const tagRow = document.createElement('div');
      tagRow.className = 'library-work-tags';
      for (const tag of tags) {
        const chip = document.createElement('button');
        chip.type = 'button';
        chip.className = 'library-tag';
        chip.textContent = tag;
        chip.title = `检索「${tag}」`;
        chip.addEventListener('click', () => {
          keywordsInput.value = tag;
          authorInput.value = '';
          yearSelect.value = '';
          search({ keywords: tag, author: '', year: null });
          results.scrollTop = 0;
        });
        tagRow.appendChild(chip);
      }
      article.appendChild(tagRow);
    }

    const links = document.createElement('div');
    links.className = 'library-work-links';
    for (const [label, href, hint] of [
      ['以实验打开', urls.experiment, '在物理实验室中打开'],
      ['以讨论打开', urls.discussion, '在物理实验室讨论区打开'],
    ] as const) {
      const link = document.createElement('a');
      link.className = 'library-open-link';
      link.href = href;
      link.target = '_blank';
      link.rel = 'noopener';
      link.title = hint;
      link.textContent = label;
      links.appendChild(link);
    }
    article.appendChild(links);
    return article;
  }

  function renderError(error: unknown): void {
    results.replaceChildren();
    const box = document.createElement('p');
    box.className = 'library-error';
    box.textContent = `档案馆暂时联系不上（${error instanceof Error ? error.message : String(error)}）。`;
    results.appendChild(box);
    const retry = document.createElement('button');
    retry.type = 'button';
    retry.className = 'library-retry';
    retry.textContent = '重试';
    retry.addEventListener('click', () => {
      if (lastSearch) search(lastSearch);
    });
    results.appendChild(retry);
  }

  function loadArchiveMeta(): void {
    void (async () => {
      try {
        const response = await fetch(libraryArchiveMetaUrl(LIBRARY_SEARCH_API_BASE));
        if (!response.ok) return;
        const payload = (await response.json()) as { totalRecords?: number };
        const total = Number(payload.totalRecords);
        if (Number.isFinite(total) && total > 0) {
          metaLine.textContent = `物实社区作品档案 · 馆藏 ${fmtCount(total)} 件`;
        }
      } catch {
        // Keep the static copy when the archive is unreachable.
      }
    })();
  }

  function loadHotTerms(): void {
    void (async () => {
      try {
        const response = await fetch(libraryHotTermsUrl(LIBRARY_SEARCH_API_BASE));
        if (!response.ok) return;
        const payload = (await response.json()) as { terms?: { term: string }[] };
        const terms = (payload.terms ?? []).map((item) => String(item.term || '').trim()).filter(Boolean).slice(0, HOT_TERMS_LIMIT);
        if (!terms.length) return;
        hotTermsRow.replaceChildren();
        const label = document.createElement('span');
        label.className = 'library-chips-label';
        label.textContent = '大家都在搜';
        hotTermsRow.appendChild(label);
        for (const term of terms) {
          const chip = document.createElement('button');
          chip.type = 'button';
          chip.className = 'library-chip';
          chip.textContent = term;
          chip.addEventListener('click', () => {
            keywordsInput.value = term;
            search({ keywords: term, author: authorInput.value, year: currentParams().year });
            results.scrollTop = 0;
          });
          hotTermsRow.appendChild(chip);
        }
        hotTermsRow.hidden = false;
      } catch {
        // Hot terms are a bonus; stay hidden when unreachable.
      }
    })();
  }

  function resetFilters(): void {
    keywordsInput.value = '';
    authorInput.value = '';
    yearSelect.value = '';
  }

  const resetButton = document.getElementById('libraryReset');
  resetButton?.addEventListener('click', resetFilters, { signal });

  form.addEventListener('submit', (event) => {
    event.preventDefault();
    search(currentParams());
    results.scrollTop = 0;
  }, { signal });

  function open(): void {
    panel.classList.add('open');
    if (!opened) {
      opened = true;
      loadArchiveMeta();
      loadHotTerms();
    }
    keywordsInput.focus();
  }

  function close(): void {
    panel.classList.remove('open');
  }

  return {
    open,
    close,
    isOpen: () => panel.classList.contains('open'),
  };
}
