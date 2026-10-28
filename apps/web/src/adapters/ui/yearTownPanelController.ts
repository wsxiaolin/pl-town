// 年份镇纪念设施面板（设计 §7.1 修订，取代原「作品详情抽屉」）。
//
// 定位：年份群岛呈现的是城市设施，而不是社区数据库。面板只读三样东西——
// 设施名、纪念导语、可选便签交互；作品原文、评论、热度、浏览量均不存在于
// 年份群岛，因此面板不提供正文分页、评论区或统计数字。
//
// 链路：建筑铭牌弹窗「走近看看」→ onDialogueAction 发出 `read-body:{id}` →
// MiniCityApp 组合根路由到本控制器 open(buildingId)；纪念名录条目经
// yearTownCatalogController 直接按条目开卷。
// 单 WebGL 上下文红线：纯 DOM 抽屉，不新增 canvas；样式见 modules/year-town-panel.css。
import { YEAR_TOWN_BUILDING_CONFIGS, YEAR_TOWN_BUILDING_EXTRAS } from '../../city/data/year-towns/gen-buildings';
import { YEAR_TOWN_MEMORIAL_INDEX } from '../../city/data/year-towns/gen-index';
import { YEAR_TOWN_MEMORIAL_BY_KEY, YEAR_TOWN_LANDMARK_NOTES } from '../../city/data/year-towns/yearTownMemorials';
import { YEAR_TOWNS } from '../../city/data/year-towns/towns';
import type { MemorialIndexEntry, YearTownMemorial } from '../../city/data/year-towns/_types';

/** 铭牌弹窗「走近看看」按钮发出的动作前缀（cityDialogController 生成，组合根路由）。 */
export const READ_BODY_ACTION_PREFIX = 'read-body:';

/** `read-body:{buildingId}` → buildingId；其余动作返回 null。 */
export function parseReadBodyAction(action: string): string | null {
  return action.startsWith(READ_BODY_ACTION_PREFIX) ? action.slice(READ_BODY_ACTION_PREFIX.length) : null;
}

/** 设施族的中文名（面板 chip 展示）。 */
export const FAMILY_LABELS: Readonly<Record<string, string>> = {
  law: '律法与制度',
  gathering: '集会与闲谈',
  academy: '教程与学理',
  observatory: '观星与物理',
  narrative: '叙事与虚构',
  lab: '声光与实验',
  tavern: '餐饮与招待',
  market: '商业与交换',
  memorial: '告别与追念',
  dwelling: '起居与日常',
  press: '报业与纪录',
  guild: '社群与组织',
};

/** 便签交互的展示文案（小动作的名字与完成后的反馈）。 */
const NOTE_LABELS: Readonly<Record<string, { action: string; done: string }>> = {
  stamp: { action: '在此盖一枚纪念章', done: '纪念章已盖下。' },
  lamp: { action: '点亮一盏灯', done: '灯亮了，会亮到天亮。' },
  leaving: { action: '留一句话', done: '话留在这里了。' },
  capsule: { action: '封存此刻', done: '已封存。下次开启时再来看。' },
};
const YEAR_TOWN_LABEL_BY_ID = new Map(YEAR_TOWN_BUILDING_CONFIGS.map((config) => [config.id, config.label]));

/** 取便签交互文案（无交互返回 undefined）。 */
export function noteLabelOf(noteKind: string | undefined) {
  return noteKind ? NOTE_LABELS[noteKind] : undefined;
}

/** 按建筑 id 取纪念设施（非作品建筑返回 undefined）。 */
export function memorialOfBuilding(buildingId: string): YearTownMemorial | undefined {
  const extras = YEAR_TOWN_BUILDING_EXTRAS[buildingId];
  return extras?.memorialKey ? YEAR_TOWN_MEMORIAL_BY_KEY[extras.memorialKey] : undefined;
}

/** 建筑/条目 → 面板展示所需的统一形状。 */
interface MemoralView {
  key: string;
  facility: string;
  note: string;
  family: string;
  year: number;
  townLabel: string;
  noteKind?: string;
}

const viewOfMemorial = (m: YearTownMemorial, year: number): MemoralView => ({
  key: m.key,
  facility: m.facility,
  note: m.note,
  family: m.family,
  year,
  townLabel: YEAR_TOWNS.find((t) => t.year === year)?.label ?? '',
  noteKind: m.noteKind,
});

const viewOfIndexEntry = (entry: MemorialIndexEntry): MemoralView => ({
  key: entry.key,
  facility: entry.facility,
  note: entry.note,
  family: entry.family,
  year: entry.year,
  townLabel: YEAR_TOWNS.find((t) => t.year === entry.year)?.label ?? '',
  noteKind: YEAR_TOWN_MEMORIAL_BY_KEY[entry.key]?.noteKind,
});

/** 建筑 id → 面板视图（含纪念名录/总目塔/界碑的地标导语）。 */
export function memorialViewOfBuilding(buildingId: string): MemoralView | undefined {
  const extras = YEAR_TOWN_BUILDING_EXTRAS[buildingId];
  if (!extras) return undefined;
  const memorial = extras.memorialKey ? YEAR_TOWN_MEMORIAL_BY_KEY[extras.memorialKey] : undefined;
  if (memorial) return viewOfMemorial(memorial, extras.year);
  const note = YEAR_TOWN_LANDMARK_NOTES[buildingId];
  if (!note) return undefined;
  const town = YEAR_TOWNS.find((t) => t.id === extras.townId);
  return {
    key: buildingId,
    facility: YEAR_TOWN_LABEL_BY_ID.get(buildingId) ?? (town ? `${town.label}纪念名录` : '纪念名录'),
    note,
    family: 'press',
    year: extras.year,
    townLabel: town?.label ?? '',
  };
}

export interface YearTownPanelControllerOptions {
  document: Document;
  signal?: AbortSignal;
}

export interface YearTownPanelController {
  /** 建筑入口：按建筑 id 打开对应纪念设施。 */
  open(buildingId: string): void;
  /** 名录入口：按索引条目直接开卷。 */
  openMemorial(entry: MemorialIndexEntry): void;
  close(): void;
  isOpen(): boolean;
}

interface PanelRefs {
  panel: HTMLElement;
  close: HTMLButtonElement;
  kicker: HTMLElement;
  title: HTMLHeadingElement;
  meta: HTMLElement;
  chips: HTMLElement;
  scroll: HTMLElement;
  noteSection: HTMLElement;
  noteText: HTMLElement;
  noteButton: HTMLButtonElement;
  noteFeedback: HTMLElement;
}

function buildPanelSkeleton(document: Document): PanelRefs {
  const panel = document.createElement('aside');
  panel.className = 'ytp-panel';
  panel.id = 'yearTownPanel';
  panel.setAttribute('role', 'dialog');
  panel.setAttribute('aria-modal', 'false');
  panel.setAttribute('aria-labelledby', 'ytpTitle');

  const head = document.createElement('header');
  head.className = 'ytp-head';
  const headText = document.createElement('div');
  headText.className = 'ytp-head-text';
  const kicker = document.createElement('span');
  kicker.className = 'ytp-kicker';
  kicker.id = 'ytpKicker';
  const title = document.createElement('h2');
  title.id = 'ytpTitle';
  const meta = document.createElement('p');
  meta.className = 'ytp-meta';
  const chips = document.createElement('div');
  chips.className = 'ytp-chips';
  headText.append(kicker, title, meta, chips);
  const close = document.createElement('button');
  close.type = 'button';
  close.className = 'ytp-close';
  close.id = 'ytpClose';
  close.setAttribute('aria-label', '收起面板');
  close.textContent = '×';
  head.append(headText, close);

  const scroll = document.createElement('div');
  scroll.className = 'ytp-scroll';
  scroll.id = 'ytpScroll';
  scroll.tabIndex = 0;

  const noteSection = document.createElement('section');
  noteSection.className = 'ytp-section';
  const noteTitle = document.createElement('h3');
  noteTitle.className = 'ytp-section-title';
  noteTitle.textContent = '纪念说明';
  const noteText = document.createElement('p');
  noteText.className = 'ytp-body';
  const noteButton = document.createElement('button');
  noteButton.type = 'button';
  noteButton.className = 'ytp-more';
  noteButton.hidden = true;
  const noteFeedback = document.createElement('p');
  noteFeedback.className = 'ytp-note';
  noteFeedback.hidden = true;
  noteSection.append(noteTitle, noteText, noteButton, noteFeedback);

  scroll.append(noteSection);
  panel.append(head, scroll);
  document.body.appendChild(panel);

  return { panel, close, kicker, title, meta, chips, scroll, noteSection, noteText, noteButton, noteFeedback };
}

export function createYearTownPanelController(options: YearTownPanelControllerOptions): YearTownPanelController {
  const { document, signal } = options;
  const refs = buildPanelSkeleton(document);

  let openState = false;
  let activeKey: string | null = null;
  let activeView: MemoralView | null = null;

  function present(view: MemoralView): void {
    activeView = view;
    refs.kicker.textContent = `${view.townLabel} · ${view.year} 年`;
    refs.title.textContent = view.facility;
    refs.meta.textContent = '城市纪念设施';
    refs.chips.replaceChildren();
    const familyChip = document.createElement('span');
    familyChip.className = 'ytp-chip';
    familyChip.textContent = FAMILY_LABELS[view.family] ?? view.family;
    refs.chips.appendChild(familyChip);

    const town = YEAR_TOWNS.find((t) => t.year === view.year);
    if (town) refs.panel.style.setProperty('--ytp-accent', town.theme.iconColor);

    refs.noteText.textContent = view.note;
    const label = noteLabelOf(view.noteKind);
    if (label) {
      refs.noteButton.hidden = false;
      refs.noteButton.disabled = false;
      refs.noteButton.textContent = label.action;
      refs.noteFeedback.hidden = true;
      refs.noteFeedback.textContent = '';
    } else {
      refs.noteButton.hidden = true;
      refs.noteFeedback.hidden = true;
    }
  }

  function openView(view: MemoralView): void {
    if (!openState) {
      openState = true;
      refs.panel.classList.add('open');
    }
    if (activeKey !== view.key) {
      activeKey = view.key;
      present(view);
    }
    refs.close.focus();
  }

  const controller: YearTownPanelController = {
    open(buildingId: string): void {
      const view = memorialViewOfBuilding(buildingId);
      if (view) openView(view);
    },
    openMemorial(entry: MemorialIndexEntry): void {
      openView(viewOfIndexEntry(entry));
    },
    close(): void {
      if (!openState) return;
      openState = false;
      refs.panel.classList.remove('open');
    },
    isOpen: () => openState,
  };

  refs.close.addEventListener('click', controller.close, { signal });
  refs.noteButton.addEventListener('click', () => {
    const label = noteLabelOf(activeView?.noteKind);
    if (!label) return;
    refs.noteButton.disabled = true;
    refs.noteFeedback.hidden = false;
    refs.noteFeedback.textContent = label.done;
  }, { signal });
  document.addEventListener('keydown', (event) => {
    if (event.key !== 'Escape' || !openState || event.defaultPrevented) return;
    event.preventDefault();
    controller.close();
  }, { capture: true, signal });

  return controller;
}

/** 按年份取纪念名录条目（档案抽屉用）。 */
export function memorialIndexForYear(year: number): readonly MemorialIndexEntry[] {
  return YEAR_TOWN_MEMORIAL_INDEX.filter((entry) => entry.year === year);
}
