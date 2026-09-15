import { ACTIVITY_ENTRIES, type ActivityBackgroundKey, type ActivityEntry } from '../../city/data/activities';

// 每个活动自行配置背景图；新增 backgroundKey 时在此登记资源。
const ACTIVITY_BACKGROUND_URLS: Record<ActivityBackgroundKey, string> = {
  'star-voyage': new URL('../../assets/activities/star-voyage.svg', import.meta.url).href,
  'aurora-festival': new URL('../../assets/activities/aurora-festival.svg', import.meta.url).href,
  'meteor-market': new URL('../../assets/activities/meteor-market.svg', import.meta.url).href,
};

export interface ActivityPanelControllerOptions {
  document: Document;
  signal?: AbortSignal;
}

export interface ActivityPanelController {
  open(): void;
  close(): void;
  toggle(): void;
  isOpen(): boolean;
  select(id: string): void;
}

function getElement<T extends HTMLElement>(document: Document, id: string): T {
  const element = document.getElementById(id);
  if (!element) throw new Error(`Missing activity panel element #${id}`);
  return element as T;
}

export function createActivityPanelController(options: ActivityPanelControllerOptions): ActivityPanelController {
  const { document } = options;
  const overlay = getElement<HTMLDivElement>(document, 'activityPanelOverlay');
  const toggleButton = getElement<HTMLButtonElement>(document, 'activityPanelToggle');
  const closeButton = getElement<HTMLButtonElement>(document, 'activityPanelClose');
  const list = getElement<HTMLDivElement>(document, 'activityPanelList');
  const heroBackground = getElement<HTMLDivElement>(document, 'activityPanelHeroBg');
  const badge = getElement<HTMLSpanElement>(document, 'activityPanelBadge');
  const kicker = getElement<HTMLSpanElement>(document, 'activityPanelKicker');
  const title = getElement<HTMLHeadingElement>(document, 'activityPanelTitle');
  const subtitle = getElement<HTMLParagraphElement>(document, 'activityPanelSubtitle');
  const description = getElement<HTMLParagraphElement>(document, 'activityPanelDescription');

  let opened = false;
  let activeId = ACTIVITY_ENTRIES[0]?.id ?? '';

  function backgroundUrl(entry: ActivityEntry): string {
    return ACTIVITY_BACKGROUND_URLS[entry.backgroundKey];
  }

  function select(id: string): void {
    const entry = ACTIVITY_ENTRIES.find((item) => item.id === id);
    if (!entry) return;
    activeId = id;
    list.querySelectorAll<HTMLButtonElement>('.activity-panel-item').forEach((item) => {
      const active = item.dataset.activityId === id;
      item.classList.toggle('active', active);
      item.setAttribute('aria-pressed', String(active));
    });
    heroBackground.style.backgroundImage = `url("${backgroundUrl(entry)}")`;
    badge.textContent = entry.badge ?? '';
    badge.hidden = !entry.badge;
    kicker.textContent = entry.kicker;
    title.textContent = entry.title;
    subtitle.textContent = entry.subtitle ?? '';
    subtitle.hidden = !entry.subtitle;
    description.textContent = entry.description;
  }

  function renderList(): void {
    list.replaceChildren();
    for (const entry of ACTIVITY_ENTRIES) {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'activity-panel-item';
      button.dataset.activityId = entry.id;
      button.setAttribute('aria-pressed', 'false');

      const thumb = document.createElement('span');
      thumb.className = 'activity-panel-thumb';
      thumb.style.backgroundImage = `url("${backgroundUrl(entry)}")`;

      const copy = document.createElement('span');
      copy.className = 'activity-panel-item-copy';
      const name = document.createElement('strong');
      name.textContent = entry.name;
      const meta = document.createElement('small');
      meta.textContent = entry.kicker;
      copy.append(name, meta);

      button.append(thumb, copy);
      if (entry.badge) {
        const flag = document.createElement('i');
        flag.className = 'activity-panel-item-badge';
        flag.textContent = entry.badge;
        button.append(flag);
      }
      button.addEventListener('click', () => select(entry.id), { signal: options.signal });
      list.append(button);
    }
    select(activeId);
  }

  function open(): void {
    if (opened) return;
    opened = true;
    overlay.classList.add('open');
    toggleButton.setAttribute('aria-expanded', 'true');
  }

  function close(): void {
    if (!opened) return;
    opened = false;
    overlay.classList.remove('open');
    toggleButton.setAttribute('aria-expanded', 'false');
  }

  toggleButton.addEventListener('click', () => (opened ? close() : open()), { signal: options.signal });
  closeButton.addEventListener('click', close, { signal: options.signal });
  overlay.addEventListener('click', (event) => {
    if (event.target === overlay) close();
  }, { signal: options.signal });
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && opened) close();
  }, { signal: options.signal });

  renderList();

  return { open, close, toggle: () => (opened ? close() : open()), isOpen: () => opened, select };
}
