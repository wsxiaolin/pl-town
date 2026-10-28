// 年份镇纪念名录（设计 §7.1 修订，取代原「作品集中检索目录」）。
//
// 定位：档案馆与千作总目塔不再承担「全量作品检索 / 原文详情」——那些社区数据
// 不属于年份群岛。名录只收录各镇立起的纪念设施：设施名、设施族、纪念导语。
// 入口：镇纪念名录（yt-arch-*）/ 千作总目塔（yt-tower）走铭牌对话的选项层
// （BuildingContentLike.dialogTree）→ onDialogueAction 发 `open-catalog:{id}`
// → MiniCityApp 组合根路由到本控制器 open(buildingId)。
// 数据：gen-index 的 106 条纪念设施索引（静态分片，零实时 API）。
// 单 WebGL 上下文红线：纯 DOM 抽屉，不新增 canvas；样式见 modules/year-town-panel.css。
import { YEAR_TOWN_BUILDING_EXTRAS } from '../../city/data/year-towns/gen-buildings';
import { YEAR_TOWN_MEMORIAL_INDEX } from '../../city/data/year-towns/gen-index';
import { YEAR_TOWN_LANDMARK_NOTES } from '../../city/data/year-towns/yearTownMemorials';
import { YEAR_TOWNS, yearTownById } from '../../city/data/year-towns/towns';
import type { MemorialIndexEntry } from '../../city/data/year-towns/_types';
import type { BuildingContentLike } from '../../city/buildingContent';
import type { YearTownPanelController } from './yearTownPanelController';
import { FAMILY_LABELS } from './yearTownPanelController';

/** 目录对话选项发出的动作前缀（cityDialogController 选项层 → 组合根路由）。 */
export const CATALOG_ACTION_PREFIX = 'open-catalog:';

/** 名录分页步长。 */
export const CATALOG_PAGE_SIZE = 20;

/** `open-catalog:{buildingId}` → buildingId；其余动作返回 null。 */
export function parseCatalogAction(action: string): string | null {
  return action.startsWith(CATALOG_ACTION_PREFIX) ? action.slice(CATALOG_ACTION_PREFIX.length) : null;
}

const fmt = (v: number) => v.toLocaleString('zh-Hans-CN');

/** 名录检索（设施名 / 导语 / 设施族中文名，不分大小写；年份空=不限）。纯函数。 */
export function filterMemorials(
  entries: readonly MemorialIndexEntry[],
  query: string,
  year: number | null,
): readonly MemorialIndexEntry[] {
  const keyword = query.trim().toLowerCase();
  return entries.filter((entry) => {
    if (year !== null && entry.year !== year) return false;
    if (!keyword) return true;
    const family = FAMILY_LABELS[entry.family] ?? entry.family;
    return entry.facility.toLowerCase().includes(keyword)
      || entry.note.toLowerCase().includes(keyword)
      || family.toLowerCase().includes(keyword);
  });
}

/** 镇纪念名录取视图（该年全部设施，按镇内名次排架）。 */
export function archiveYearMemorials(entries: readonly MemorialIndexEntry[], year: number): readonly MemorialIndexEntry[] {
  return filterMemorials(entries, '', year).slice().sort((a, b) => a.townRank - b.townRank);
}

/** 设施 → 建筑 id（106 座设施建筑）。 */
const BUILDING_BY_MEMORIAL_KEY = new Map<string, string>(
  Object.entries(YEAR_TOWN_BUILDING_EXTRAS).flatMap(([buildingId, extras]) =>
    extras.memorialKey ? [[extras.memorialKey, buildingId] as [string, string]] : [],
  ),
);

export function yearTownMemorialBuildingId(memorialKey: string): string | undefined {
  return BUILDING_BY_MEMORIAL_KEY.get(memorialKey);
}

/**
 * 纪念馆/总目塔的对话入口内容（b1 buildingContent 分流点的覆盖层：组合根以
 * {...YEAR_TOWN_BUILDING_CONTENT, ...YEAR_TOWN_CATALOG_CONTENT} 合流，本表优先）。
 * 选项层动作 `open-catalog:{buildingId}` 由组合根路由到本名录抽屉。
 */
export function yearTownCatalogEntryContent(id: string): BuildingContentLike | undefined {
  const extras = YEAR_TOWN_BUILDING_EXTRAS[id];
  if (!extras || (extras.kind !== 'archive' && extras.kind !== 'tower')) return undefined;
  const town = yearTownById(extras.townId);
  const note = YEAR_TOWN_LANDMARK_NOTES[id];
  if (!town || !note) return undefined;
  const isTower = extras.kind === 'tower';
  const name = isTower ? '千作总目塔' : `${town.name}纪念名录`;
  return {
    name,
    slogan: `${town.label} · ${town.tagline}`,
    dialog: [note],
    dialogTree: [{
      speaker: name,
      text: note,
      options: [
        { text: isTower ? '翻阅千作总目' : '翻阅纪念名录', next: null, action: `${CATALOG_ACTION_PREFIX}${id}` },
        { text: '告辞', next: null },
      ],
    }],
  };
}

export const YEAR_TOWN_CATALOG_CONTENT: Readonly<Record<string, BuildingContentLike>> = Object.fromEntries(
  Object.keys(YEAR_TOWN_BUILDING_EXTRAS).flatMap((id) => {
    const content = yearTownCatalogEntryContent(id);
    return content ? [[id, content] as [string, BuildingContentLike]] : [];
  }),
);

export interface YearTownCatalogControllerOptions {
  document: Document;
  signal?: AbortSignal;
  /** 纪念设施面板（openMemorial；isOpen 用于 Esc 只关最上层）。 */
  panel: Pick<YearTownPanelController, 'openMemorial' | 'isOpen'>;
  /** 定位/飞往（组合根注入 mapController 既有传送）。 */
  locate: (entry: MemorialIndexEntry) => boolean;
}

export interface YearTownCatalogController {
  open(buildingId: string): void;
  close(): void;
  isOpen(): boolean;
}

type CatalogMode = 'archive' | 'tower';

interface CatalogRefs {
  panel: HTMLElement;
  close: HTMLButtonElement;
  kicker: HTMLElement;
  title: HTMLHeadingElement;
  meta: HTMLElement;
  search: HTMLInputElement;
  year: HTMLSelectElement;
  list: HTMLOListElement;
  status: HTMLElement;
  pager: HTMLElement;
  prev: HTMLButtonElement;
  next: HTMLButtonElement;
  page: HTMLElement;
}

function buildCatalogSkeleton(document: Document): CatalogRefs {
  const panel = document.createElement('aside');
  panel.className = 'ytc-panel';
  panel.setAttribute('role', 'dialog');
  panel.setAttribute('aria-modal', 'false');
  panel.setAttribute('aria-label', '年份群岛纪念名录');

  const head = document.createElement('header');
  head.className = 'ytc-head';
  const headText = document.createElement('div');
  headText.className = 'ytc-head-text';
  const kicker = document.createElement('span');
  kicker.className = 'ytc-kicker';
  const title = document.createElement('h2');
  const meta = document.createElement('p');
  meta.className = 'ytc-meta';
  const close = document.createElement('button');
  close.type = 'button';
  close.className = 'ytc-close';
  close.setAttribute('aria-label', '收起名录');
  close.textContent = '×';
  headText.append(kicker, title, meta);
  head.append(headText, close);

  const tools = document.createElement('div');
  tools.className = 'ytc-tools';
  const search = document.createElement('input');
  search.type = 'search';
  search.className = 'ytc-search';
  search.placeholder = '检索设施名 / 纪念说明…';
  search.setAttribute('aria-label', '检索纪念名录');
  const year = document.createElement('select');
  year.className = 'ytc-year';
  year.setAttribute('aria-label', '按年份筛选');
  const allOption = document.createElement('option');
  allOption.value = '';
  allOption.textContent = '全部年份';
  year.append(allOption, ...YEAR_TOWNS.map((town) => {
    const option = document.createElement('option');
    option.value = String(town.year);
    option.textContent = `${town.year} · ${town.name}`;
    return option;
  }));
  tools.append(search, year);

  const scroll = document.createElement('div');
  scroll.className = 'ytc-scroll';
  scroll.tabIndex = 0;
  const status = document.createElement('p');
  status.className = 'ytc-status';
  status.hidden = true;
  const list = document.createElement('ol');
  list.className = 'ytc-list';
  scroll.append(status, list);

  const pager = document.createElement('nav');
  pager.className = 'ytc-pager';
  pager.setAttribute('aria-label', '名录分页');
  const prev = document.createElement('button');
  prev.type = 'button';
  prev.className = 'ytc-page-btn';
  prev.textContent = '上一页';
  const page = document.createElement('span');
  page.className = 'ytc-page-info';
  const next = document.createElement('button');
  next.type = 'button';
  next.className = 'ytc-page-btn';
  next.textContent = '下一页';
  pager.append(prev, page, next);
  pager.hidden = true;

  panel.append(head, tools, scroll, pager);
  document.body.appendChild(panel);
  return { panel, close, kicker, title, meta, search, year, list, status, pager, prev, next, page };
}

function renderRow(
  document: Document,
  entry: MemorialIndexEntry,
  mode: CatalogMode,
  onOpen: () => void,
  onLocate: () => void,
): HTMLLIElement {
  const item = document.createElement('li');
  item.className = 'ytc-item';
  const row = document.createElement('button');
  row.type = 'button';
  row.className = 'ytc-row';
  const rank = document.createElement('span');
  rank.className = 'ytc-rank';
  rank.textContent = mode === 'archive' ? `镇内 ${entry.townRank}` : `${entry.year}`;
  const main = document.createElement('span');
  main.className = 'ytc-main';
  const subject = document.createElement('span');
  subject.className = 'ytc-subject';
  subject.textContent = entry.facility;
  const line = document.createElement('span');
  line.className = 'ytc-row-meta';
  const family = FAMILY_LABELS[entry.family] ?? entry.family;
  line.textContent = mode === 'tower' ? `${family} · ${entry.note}` : family;
  main.append(subject, line);
  row.append(rank, main);
  row.addEventListener('click', onOpen);
  const locate = document.createElement('button');
  locate.type = 'button';
  locate.className = 'ytc-locate';
  locate.textContent = '飞往';
  locate.title = '飞往该纪念设施';
  locate.addEventListener('click', onLocate);
  item.append(row, locate);
  return item;
}

export function createYearTownCatalogController(options: YearTownCatalogControllerOptions): YearTownCatalogController {
  const { document, signal } = options;
  const refs = buildCatalogSkeleton(document);

  let openState = false;
  let mode: CatalogMode = 'tower';
  let activeYear = 0;
  let query = '';
  let yearFilter: number | null = null;
  let pageIndex = 0;
  let filtered: readonly MemorialIndexEntry[] = [];
  const indexCache: readonly MemorialIndexEntry[] = YEAR_TOWN_MEMORIAL_INDEX;

  function applyFilter(): void {
    filtered = mode === 'archive'
      ? filterMemorials(archiveYearMemorials(indexCache, activeYear), query, null)
      : filterMemorials(indexCache, query, yearFilter);
    renderPage();
  }

  function renderPage(): void {
    const total = filtered.length;
    const pageCount = Math.max(1, Math.ceil(total / CATALOG_PAGE_SIZE));
    pageIndex = Math.min(pageIndex, pageCount - 1);
    if (total === 0) {
      refs.status.hidden = false;
      refs.status.textContent = '没有匹配的设施。';
      refs.list.replaceChildren();
      refs.pager.hidden = true;
      return;
    }
    const start = pageIndex * CATALOG_PAGE_SIZE;
    refs.status.hidden = true;
    refs.list.replaceChildren(...filtered.slice(start, start + CATALOG_PAGE_SIZE).map((entry) =>
      renderRow(document, entry, mode, () => options.panel.openMemorial(entry), () => {
        if (options.locate(entry)) controller.close();
      })));
    refs.pager.hidden = pageCount <= 1;
    refs.prev.disabled = pageIndex <= 0;
    refs.next.disabled = pageIndex >= pageCount - 1;
    refs.page.textContent = `第 ${pageIndex + 1} / ${pageCount} 页 · 共 ${fmt(total)} 座`;
  }

  const controller: YearTownCatalogController = {
    open(buildingId: string): void {
      const extras = YEAR_TOWN_BUILDING_EXTRAS[buildingId];
      if (!extras || (extras.kind !== 'archive' && extras.kind !== 'tower')) return;
      const town = yearTownById(extras.townId);
      mode = extras.kind;
      activeYear = extras.year;
      query = '';
      yearFilter = mode === 'archive' ? extras.year : null;
      pageIndex = 0;
      refs.search.value = '';
      refs.year.value = '';
      refs.year.hidden = mode === 'archive';
      if (town) refs.panel.style.setProperty('--ytc-accent', town.theme.iconColor);
      if (mode === 'archive') {
        refs.kicker.textContent = `${town?.label ?? extras.year} · 纪念名录`;
        refs.title.textContent = `${extras.year} 年立起的设施`;
        refs.meta.textContent = '按镇内名次排架 · 点击条目查看纪念说明';
      } else {
        refs.kicker.textContent = '逐年立册';
        refs.title.textContent = '千作总目';
        refs.meta.textContent = '2019–2026 · 按年份分架 · 点击条目查看纪念说明';
      }
      if (!openState) {
        openState = true;
        refs.panel.classList.add('open');
      }
      refs.close.focus();
      applyFilter();
    },
    close(): void {
      if (!openState) return;
      openState = false;
      refs.panel.classList.remove('open');
    },
    isOpen: () => openState,
  };

  refs.close.addEventListener('click', controller.close, { signal });
  refs.search.addEventListener('input', () => {
    query = refs.search.value;
    pageIndex = 0;
    applyFilter();
  }, { signal });
  refs.year.addEventListener('change', () => {
    yearFilter = refs.year.value === '' ? null : Number(refs.year.value);
    pageIndex = 0;
    applyFilter();
  }, { signal });
  refs.prev.addEventListener('click', () => {
    pageIndex = Math.max(0, pageIndex - 1);
    renderPage();
  }, { signal });
  refs.next.addEventListener('click', () => {
    pageIndex += 1;
    renderPage();
  }, { signal });
  document.addEventListener('keydown', (event) => {
    if (event.key !== 'Escape' || !openState || event.defaultPrevented) return;
    if (options.panel.isOpen()) return; // 纪念设施面板在上层，先让它吃掉 Esc
    event.preventDefault();
    controller.close();
  }, { capture: true, signal });

  return controller;
}
