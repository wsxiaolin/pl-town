import {
  ZOO_CARD_COPY,
  ZOO_FORM_COPY,
  ZOO_INTERPRETATION_TITLE,
  ZOO_KEEPER_INTERPRETATION,
  ZOO_RULEBOOK_KEEPER_NOTE,
  ZOO_RULEBOOK_TITLE,
  ZOO_RULEBOOK_VERSION_LABEL,
  ZOO_RULEBOOK_VERSION_LABEL_NEXT,
  ZOO_RULES,
  ZOO_STAND_TABS,
} from '../../../gameplay/content/stories/zoo/zooContent';
import type { ZooCollectionState } from '../../../city/zoo/zooCollectionStore';

export interface ZooGuestBookPanelOptions {
  document?: Document;
  collection: ZooCollectionState;
  onClose?: () => void;
  onWriteRule?: () => void;
}

const TABS = ZOO_STAND_TABS;

export function openZooGuestBookPanel(options: ZooGuestBookPanelOptions): void {
  const doc = options.document ?? window.document;
  const overlay = doc.createElement('div');
  overlay.className = 'zoo-panel-overlay';

  const panel = doc.createElement('section');
  panel.className = 'zoo-panel zoo-guestbook';
  panel.setAttribute('role', 'dialog');
  panel.setAttribute('aria-label', ZOO_RULEBOOK_TITLE);
  overlay.appendChild(panel);

  const header = doc.createElement('header');
  header.className = 'zoo-panel-header';
  const title = doc.createElement('h2');
  title.className = 'zoo-panel-title';
  title.textContent = ZOO_RULEBOOK_TITLE;
  const version = doc.createElement('span');
  version.className = 'zoo-panel-version';
  version.textContent = options.collection.ruleVersion >= 8 ? ZOO_RULEBOOK_VERSION_LABEL_NEXT : ZOO_RULEBOOK_VERSION_LABEL;
  const close = doc.createElement('button');
  close.className = 'zoo-panel-close';
  close.type = 'button';
  close.textContent = '关闭';
  close.addEventListener('click', () => {
    overlay.remove();
    options.onClose?.();
  });
  header.append(title, version, close);
  panel.appendChild(header);

  if (options.collection.bracelet) {
    const bracelet = doc.createElement('p');
    bracelet.className = 'zoo-panel-bracelet';
    bracelet.textContent = '童心手环 · 已佩戴';
    panel.appendChild(bracelet);
  }

  const tabRow = doc.createElement('div');
  tabRow.className = 'zoo-panel-tabs';
  const tabButtons = TABS.map((label) => {
    const button = doc.createElement('button');
    button.type = 'button';
    button.className = 'zoo-panel-tab';
    button.textContent = label;
    tabRow.appendChild(button);
    return button;
  });
  panel.appendChild(tabRow);

  const body = doc.createElement('div');
  body.className = 'zoo-panel-body';
  panel.appendChild(body);

  const renderRules = (): void => {
    body.replaceChildren();
    const note = doc.createElement('p');
    note.className = 'zoo-panel-note';
    note.textContent = ZOO_RULEBOOK_KEEPER_NOTE;
    body.appendChild(note);
    const list = doc.createElement('ol');
    list.className = 'zoo-rule-list';
    ZOO_RULES.forEach((rule) => {
      const item = doc.createElement('li');
      item.textContent = rule;
      list.appendChild(item);
    });
    body.appendChild(list);
    if (options.collection.ruleLine) {
      const written = doc.createElement('p');
      written.className = 'zoo-rule-written';
      written.textContent = options.collection.ruleLine;
      body.appendChild(written);
    }
  };

  const renderInterpretation = (): void => {
    body.replaceChildren();
    const heading = doc.createElement('h3');
    heading.className = 'zoo-panel-subtitle';
    heading.textContent = ZOO_INTERPRETATION_TITLE;
    const copy = doc.createElement('blockquote');
    copy.className = 'zoo-interpretation';
    copy.textContent = ZOO_KEEPER_INTERPRETATION;
    body.append(heading, copy);
  };

  const renderCards = (): void => {
    body.replaceChildren();
    const heading = doc.createElement('h3');
    heading.className = 'zoo-panel-subtitle';
    heading.textContent = `民间解法图鉴 · 已收集 ${options.collection.cards.length} / ${ZOO_CARD_COPY.length}`;
    const list = doc.createElement('ul');
    list.className = 'zoo-gallery';
    const owned = new Set(options.collection.cards);
    ZOO_CARD_COPY.forEach((card) => {
      const item = doc.createElement('li');
      item.className = owned.has(card.id) ? 'zoo-card zoo-card-owned' : 'zoo-card';
      const name = doc.createElement('strong');
      name.textContent = owned.has(card.id) ? card.name : '未收录';
      const layer = doc.createElement('span');
      layer.className = 'zoo-card-layer';
      layer.textContent = card.layer;
      const text = doc.createElement('p');
      text.textContent = owned.has(card.id) ? card.text : '继续在展区里破戒，围观游客会递来新的解法。';
      item.append(name, layer, text);
      list.appendChild(item);
    });
    body.append(heading, list);
  };

  const renderForms = (): void => {
    body.replaceChildren();
    const heading = doc.createElement('h3');
    heading.className = 'zoo-panel-subtitle';
    heading.textContent = `申请表 · 已收集 ${options.collection.forms.length} / ${ZOO_FORM_COPY.length}`;
    const list = doc.createElement('ul');
    list.className = 'zoo-gallery zoo-form-gallery';
    const owned = new Set(options.collection.forms);
    ZOO_FORM_COPY.forEach((form) => {
      const item = doc.createElement('li');
      item.className = owned.has(form.id) ? 'zoo-card zoo-card-owned' : 'zoo-card';
      const name = doc.createElement('strong');
      name.textContent = owned.has(form.id) ? form.name : '未领取';
      const text = doc.createElement('p');
      text.textContent = owned.has(form.id) ? '签名栏还留着位置。' : '申请表会从园区的不同角落慢慢补齐。';
      item.append(name, text);
      list.appendChild(item);
    });
    body.append(heading, list);
  };

  const renderers = [renderRules, renderInterpretation, renderCards, renderForms];
  let activeTab = 0;
  const selectTab = (index: number): void => {
    activeTab = index;
    tabButtons.forEach((button, buttonIndex) => {
      button.classList.toggle('is-active', buttonIndex === index);
    });
    renderers[index]!();
    renderFooter();
  };

  let footer: HTMLElement | null = null;
  const renderFooter = (): void => {
    footer?.remove();
    footer = null;
    if (!options.onWriteRule || options.collection.ruleVersion >= 8 || activeTab !== 0) return;
    footer = doc.createElement('div');
    footer.className = 'zoo-panel-footer';
    const write = doc.createElement('button');
    write.type = 'button';
    write.className = 'zoo-panel-primary';
    write.textContent = '写第七条';
    write.addEventListener('click', () => {
      overlay.remove();
      options.onClose?.();
      options.onWriteRule?.();
    });
    footer.appendChild(write);
    panel.appendChild(footer);
  };

  tabButtons.forEach((button, index) => {
    button.addEventListener('click', () => selectTab(index));
  });

  overlay.addEventListener('click', (event) => {
    if (event.target === overlay) {
      overlay.remove();
      options.onClose?.();
    }
  });

  doc.body.appendChild(overlay);
  selectTab(0);
}
