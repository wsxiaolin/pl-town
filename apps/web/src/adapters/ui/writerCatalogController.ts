import { WRITER_CATALOG, type WriterCatalogAuthor } from '../../city/data/writerCatalog';

export interface WriterCatalogControllerOptions {
  document: Document;
}

export interface WriterCatalogController {
  open(): void;
  close(): void;
  isOpen(): boolean;
}

function getElement<T extends HTMLElement>(document: Document, id: string): T {
  const element = document.getElementById(id);
  if (!element) throw new Error(`Missing city dialog element #${id}`);
  return element as T;
}

function renderAuthor(document: Document, author: WriterCatalogAuthor): HTMLElement {
  const article = document.createElement('article');
  article.className = 'writer-author';
  const heading = document.createElement('h3');
  heading.textContent = author.name;
  const signature = document.createElement('p');
  signature.className = 'writer-signature';
  signature.textContent = `「${author.signature}」`;
  const description = document.createElement('p');
  description.className = 'writer-desc';
  description.textContent = author.description;
  const works = document.createElement('span');
  works.className = 'writer-works';
  works.textContent = author.works;
  article.append(heading, signature, description, works);
  return article;
}

export function createWriterCatalogController(options: WriterCatalogControllerOptions): WriterCatalogController {
  const { document } = options;
  let opened = false;

  const controller: WriterCatalogController = {
    open() {
      if (opened) return;
      opened = true;
      getElement<HTMLHeadingElement>(document, 'writerCatalogTitle').textContent = WRITER_CATALOG.title;
      getElement<HTMLParagraphElement>(document, 'writerCatalogNote').textContent =
        `${WRITER_CATALOG.version} · ${WRITER_CATALOG.intro}`;
      const list = getElement<HTMLDivElement>(document, 'writerCatalogList');
      list.replaceChildren(...WRITER_CATALOG.authors.map((author) => renderAuthor(document, author)));
      getElement<HTMLDivElement>(document, 'writerCatalogPanel').classList.add('open');
    },
    close() {
      if (!opened) return;
      opened = false;
      getElement<HTMLDivElement>(document, 'writerCatalogPanel').classList.remove('open');
    },
    isOpen: () => opened,
  };

  return controller;
}
