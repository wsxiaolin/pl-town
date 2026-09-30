// Library works search panel: opened by the town library building, queries the
// community projects archive (projects-ai-summary) and renders result cards.
import {
  LIBRARY_SEARCH_API_BASE,
  buildLibrarySearchUrl,
  libraryWorkArchiveUrl,
  libraryWorkMetaLine,
  libraryWorkTags,
  type LibrarySearchResponse,
  type LibrarySearchParams,
  type LibraryWorkRecord,
} from '../../city/data/libraryWorksSearch';

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

export function createLibrarySearchController(options: LibrarySearchControllerOptions): LibrarySearchController {
  const { document, signal } = options;
  const panel = getElement<HTMLDivElement>(document, 'librarySearchPanel');
  const form = getElement<HTMLFormElement>(document, 'librarySearchForm');
  const keywordsInput = getElement<HTMLInputElement>(document, 'libraryKeywords');
  const results = getElement<HTMLDivElement>(document, 'libraryResults');

  let lastSearch: LibrarySearchParams | null = null;
  let searchToken = 0;

  function currentParams(): LibrarySearchParams {
    return { keywords: keywordsInput.value };
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
    if (!records.length) {
      const empty = document.createElement('p');
      empty.className = 'library-hint';
      const described = params.keywords.trim();
      empty.textContent = described
        ? `没有找到与「${described}」相关的馆藏，换个关键词试试——支持标题、作者、关键词与学科检索。`
        : '馆藏暂时没有可展示的作品。';
      results.appendChild(empty);
      return;
    }
    for (const record of records) results.appendChild(renderCard(record));
  }

  function renderCard(record: LibraryWorkRecord): HTMLElement {
    const article = document.createElement('article');
    article.className = 'library-work';
    const meta = document.createElement('p');
    meta.className = 'library-work-meta';
    meta.textContent = libraryWorkMetaLine(record);
    article.appendChild(meta);
    const title = document.createElement('a');
    title.className = 'library-work-title';
    title.href = libraryWorkArchiveUrl(LIBRARY_SEARCH_API_BASE, record.id);
    title.target = '_blank';
    title.rel = 'noopener';
    title.textContent = record.name || '未命名作品';
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
        chip.addEventListener('click', () => {
          keywordsInput.value = tag;
          search({ keywords: tag });
          results.scrollTop = 0;
        });
        tagRow.appendChild(chip);
      }
      article.appendChild(tagRow);
    }
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

  form.addEventListener('submit', (event) => {
    event.preventDefault();
    search(currentParams());
    results.scrollTop = 0;
  }, { signal });

  function open(): void {
    panel.classList.add('open');
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
