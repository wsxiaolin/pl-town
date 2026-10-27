// 年份镇集中检索目录（T6R-b3，GOAL#5：1000 条作品全部可被浏览）。
// 入口：镇档案馆（yt-arch-*）/ 千作总目塔（yt-tower）走铭牌对话的选项层
// （BuildingContentLike.dialogTree，与酒馆/神社同款既有 DOM 范式）→
// onDialogueAction 发 `open-catalog:{buildingId}` → MiniCityApp 组合根路由到本
// 控制器 open(buildingId)。
// 数据路由：gen-index 懒加载 1000 条 P 级铭牌（import() 字面量由 Vite 静态分片，
// 与 b2 的 D 级模块同管道，零实时 API）。档案馆=按年过滤 + 镇内名次排架；总目塔
// =全量 50/页分页 + 题名/作者/年份检索。条目点击复用 b2 详情抽屉的 openWork
// （全部 1000 条可读正文/评论精选，含无建筑的 894 条）；「飞往」复用 mapController
// 的既有传送 API（作品建筑优先，其余落所在镇），不新造交互范式。
// 单 WebGL 上下文红线：纯 DOM 抽屉，不新增 canvas；样式见 modules/year-town-panel.css。
import { YEAR_TOWN_BUILDING_EXTRAS, YEAR_TOWN_LANDMARK_BLURBS } from '../../city/data/year-towns/gen-buildings';
import { YEAR_TOWNS, yearTownById } from '../../city/data/year-towns/towns';
import type { YearWorkNameplate } from '../../city/data/year-towns/_types';
import type { BuildingContentLike } from './cityDialogController';
import type { YearTownPanelController } from './yearTownPanelController';

/** 目录对话选项发出的动作前缀（cityDialogController 选项层 → 组合根路由）。 */
export const CATALOG_ACTION_PREFIX = 'open-catalog:';

/** 总目/馆藏分页步长（千作总目 50/页；镇馆藏超步长同样分页）。 */
export const CATALOG_PAGE_SIZE = 50;

/** `open-catalog:{buildingId}` → buildingId；其余动作返回 null。 */
export function parseCatalogAction(action: string): string | null {
  return action.startsWith(CATALOG_ACTION_PREFIX) ? action.slice(CATALOG_ACTION_PREFIX.length) : null;
}

/** 数字千分位（热度/条数展示用）。 */
const fmt = (v: number) => v.toLocaleString('zh-Hans-CN');

/** 检索过滤（题名/作者不分大小写；年份空=不限）。纯函数。 */
export function filterCatalogWorks(
  works: readonly YearWorkNameplate[],
  query: string,
  year: number | null,
): readonly YearWorkNameplate[] {
  const keyword = query.trim().toLowerCase();
  return works.filter((work) => {
    if (year !== null && work.year !== year) return false;
    if (!keyword) return true;
    return work.subject.toLowerCase().includes(keyword) || work.author.toLowerCase().includes(keyword);
  });
}

/** 镇馆藏视图（该年全量，按镇内名次=热度排架；不依赖生成期顺序）。 */
export function archiveYearWorks(works: readonly YearWorkNameplate[], year: number): readonly YearWorkNameplate[] {
  return filterCatalogWorks(works, '', year).slice().sort((a, b) => a.townRank - b.townRank);
}

/** 作品 → 地标建筑 id 反查（106 座作品建筑；其余 894 条「飞往」落所在镇）。 */
const WORK_BUILDING_BY_WORK_ID = new Map<string, string>(
  Object.entries(YEAR_TOWN_BUILDING_EXTRAS).flatMap(([buildingId, extras]) =>
    extras.kind === 'work' && extras.workId ? [[extras.workId, buildingId] as [string, string]] : [],
  ),
);

export function yearTownWorkBuildingId(workId: string): string | undefined {
  return WORK_BUILDING_BY_WORK_ID.get(workId);
}

/**
 * 档案馆/总目塔的对话入口内容（b1 buildingContent 分流点的覆盖层：组合根以
 * {...YEAR_TOWN_BUILDING_CONTENT, ...YEAR_TOWN_CATALOG_CONTENT} 合流，本表优先）。
 * 选项层动作 `open-catalog:{buildingId}` 由组合根路由到本目录抽屉。
 */
export function yearTownCatalogEntryContent(id: string): BuildingContentLike | undefined {
  const extras = YEAR_TOWN_BUILDING_EXTRAS[id];
  if (!extras || (extras.kind !== 'archive' && extras.kind !== 'tower')) return undefined;
  const town = yearTownById(extras.townId);
  const blurb = YEAR_TOWN_LANDMARK_BLURBS[id];
  if (!town || !blurb) return undefined;
  const isTower = extras.kind === 'tower';
  const name = isTower ? '千作总目塔' : `${town.name}档案馆`;
  return {
    name,
    slogan: `${town.label} · ${town.tagline}`,
    dialog: [blurb],
    dialogTree: [{
      speaker: name,
      text: blurb,
      options: [
        { text: isTower ? '检索千作总目' : '翻阅馆藏目录', next: null, action: `${CATALOG_ACTION_PREFIX}${id}` },
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
  /** b2 详情抽屉（openWork 支持全部 1000 条；isOpen 用于 Esc 只关最上层）。 */
  panel: Pick<YearTownPanelController, 'openWork' | 'isOpen'>;
  /** 定位/飞往（组合根注入 mapController 既有传送：作品建筑优先，否则所在镇）。 */
  locate: (work: YearWorkNameplate) => boolean;
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
  panel.setAttribute('aria-label', '年份镇馆藏目录');

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
  close.setAttribute('aria-label', '收起目录');
  close.textContent = '×';
  headText.append(kicker, title, meta);
  head.append(headText, close);

  const tools = document.createElement('div');
  tools.className = 'ytc-tools';
  const search = document.createElement('input');
  search.type = 'search';
  search.className = 'ytc-search';
  search.placeholder = '检索题名 / 作者…';
  search.setAttribute('aria-label', '检索馆藏');
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
  pager.setAttribute('aria-label', '目录分页');
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
  work: YearWorkNameplate,
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
  rank.textContent = mode === 'archive' ? `镇内 ${work.townRank}` : `全站 ${work.rank}`;
  const main = document.createElement('span');
  main.className = 'ytc-main';
  const subject = document.createElement('span');
  subject.className = 'ytc-subject';
  subject.textContent = work.subject;
  const line = document.createElement('span');
  line.className = 'ytc-row-meta';
  line.textContent = mode === 'tower'
    ? `${work.year} · ${work.author} · 热度 ${fmt(work.popularity)}`
    : `${work.author} · 热度 ${fmt(work.popularity)}`;
  main.append(subject, line);
  row.append(rank, main);
  row.addEventListener('click', onOpen);
  const locate = document.createElement('button');
  locate.type = 'button';
  locate.className = 'ytc-locate';
  locate.textContent = '飞往';
  locate.title = yearTownWorkBuildingId(work.id) ? '飞往该作品建筑' : '飞往所在镇';
  locate.addEventListener('click', onLocate);
  item.append(row, locate);
  return item;
}

export function createYearTownCatalogController(options: YearTownCatalogControllerOptions): YearTownCatalogController {
  const { document, signal } = options;
  const refs = buildCatalogSkeleton(document);

  // 单实例状态：mode/activeYear 定视图；query/yearFilter/pageIndex 由检索与分页
  // 驱动；indexCache 常驻 1000 条 P 级索引；loadToken 淘汰在途异步（换目录/换条件）。
  let openState = false;
  let mode: CatalogMode = 'tower';
  let activeYear = 0;
  let query = '';
  let yearFilter: number | null = null;
  let pageIndex = 0;
  let filtered: readonly YearWorkNameplate[] = [];
  let indexCache: readonly YearWorkNameplate[] | null = null;
  let loadToken = 0;

  function applyFilter(index: readonly YearWorkNameplate[]): void {
    filtered = mode === 'archive'
      ? filterCatalogWorks(archiveYearWorks(index, activeYear), query, null)
      : filterCatalogWorks(index, query, yearFilter);
    renderPage();
  }

  function renderPage(): void {
    const total = filtered.length;
    const pageCount = Math.max(1, Math.ceil(total / CATALOG_PAGE_SIZE));
    pageIndex = Math.min(pageIndex, pageCount - 1);
    if (total === 0) {
      refs.status.hidden = false;
      refs.status.textContent = '没有匹配的馆藏。';
      refs.list.replaceChildren();
      refs.pager.hidden = true;
      return;
    }
    const start = pageIndex * CATALOG_PAGE_SIZE;
    refs.status.hidden = true;
    refs.list.replaceChildren(...filtered.slice(start, start + CATALOG_PAGE_SIZE).map((work) =>
      renderRow(document, work, mode, () => options.panel.openWork(work), () => {
        if (options.locate(work)) controller.close();
      })));
    refs.pager.hidden = pageCount <= 1;
    refs.prev.disabled = pageIndex <= 0;
    refs.next.disabled = pageIndex >= pageCount - 1;
    refs.page.textContent = `第 ${pageIndex + 1} / ${pageCount} 页 · 共 ${fmt(total)} 条`;
  }

  async function render(): Promise<void> {
    const token = ++loadToken;
    if (!indexCache) {
      refs.status.hidden = false;
      refs.status.textContent = '正在翻开馆藏…';
      refs.list.replaceChildren();
      refs.pager.hidden = true;
      try {
        indexCache = (await import('../../city/data/year-towns/gen-index')).YEAR_TOWN_INDEX;
      } catch {
        if (token !== loadToken) return;
        refs.status.textContent = '目录暂时翻不开，稍后再试。';
        return;
      }
    }
    if (token !== loadToken || !indexCache) return;
    applyFilter(indexCache);
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
        refs.kicker.textContent = `${town?.label ?? extras.year} · 镇档案馆`;
        refs.title.textContent = `${extras.year} 年馆藏`;
        refs.meta.textContent = '按镇内热度排架 · 点击条目阅读正文与评论精选';
      } else {
        refs.kicker.textContent = '黑洞区历史热门 Top1000';
        refs.title.textContent = '千作总目';
        refs.meta.textContent = '2019–2026 全收录 · 按年份分架 · 点击条目阅读正文';
      }
      if (!openState) {
        openState = true;
        refs.panel.classList.add('open');
      }
      refs.close.focus();
      void render();
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
    if (indexCache) applyFilter(indexCache);
  }, { signal });
  refs.year.addEventListener('change', () => {
    yearFilter = refs.year.value === '' ? null : Number(refs.year.value);
    pageIndex = 0;
    if (indexCache) applyFilter(indexCache);
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
    if (options.panel.isOpen()) return; // b2 详情抽屉在上层，先让它吃掉 Esc
    event.preventDefault();
    controller.close();
  }, { capture: true, signal });

  return controller;
}
