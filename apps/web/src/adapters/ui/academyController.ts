import { ACADEMY_WORKS, type AcademyWork } from '../../city/data/academyWorks';

export type AcademyController = { open: () => void; close: () => void; closeReader: () => void };

export function createAcademyController(document: Document): AcademyController {
  const panel = document.getElementById('academyPanel') as HTMLDivElement;
  const reader = document.getElementById('academyReader') as HTMLDivElement;
  const title = document.getElementById('academyTitle') as HTMLHeadingElement;
  const subtitle = document.getElementById('academySubtitle') as HTMLParagraphElement;
  const list = document.getElementById('academyWorks') as HTMLDivElement;
  const readerTitle = document.getElementById('academyReaderTitle') as HTMLHeadingElement;
  const readerByline = document.getElementById('academyReaderByline') as HTMLParagraphElement;
  const readerBody = document.getElementById('academyReaderBody') as HTMLDivElement;

  function openReader(work: AcademyWork) {
    readerTitle.textContent = work.title;
    readerByline.textContent = `${work.author} · ${work.category}`;
    readerBody.replaceChildren(...work.content.map((text) => {
      const paragraph = document.createElement('p');
      paragraph.textContent = text;
      return paragraph;
    }));
    reader.classList.add('open');
  }

  function open() {
    title.textContent = ACADEMY_WORKS.title;
    subtitle.textContent = ACADEMY_WORKS.subtitle;
    list.replaceChildren(...ACADEMY_WORKS.works.map((work) => {
      const item = document.createElement('button');
      item.className = 'academy-work';
      item.type = 'button';
      item.innerHTML = `<span class="academy-work-meta"></span><strong></strong><span class="academy-work-excerpt"></span>`;
      (item.children[0] as HTMLElement).textContent = `${work.category} · ${work.author}`;
      (item.children[1] as HTMLElement).textContent = work.title;
      (item.children[2] as HTMLElement).textContent = work.excerpt;
      item.addEventListener('click', () => openReader(work));
      return item;
    }));
    panel.classList.add('open');
  }

  function closeReader() { reader.classList.remove('open'); }
  function close() { closeReader(); panel.classList.remove('open'); }

  return { open, close, closeReader };
}
