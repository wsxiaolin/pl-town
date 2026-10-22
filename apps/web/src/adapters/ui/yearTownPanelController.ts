// 年份镇作品详情抽屉（T6R-b2，设计 §7.2 D5 详情级 / D6 全文级）。
// 链路：铭牌弹窗「阅读正文」按钮（cityDialogController）→ onDialogueAction 发出
// `read-body:{buildingId}` → MiniCityApp 组合根路由到本控制器 open(buildingId)。
// T6R-b3 增补 openWork(work)：档案馆/总目塔目录条目（含无建筑的 894 条）经
// yearTownCatalogController 直接按 P 级铭牌开卷，数据路由同源。
// 数据路由：buildingId → gen-buildings 的 extras（year/workId）→ TOWN_LOADERS
// 按年懒加载 D 级模块（正文 + 评论精选 ≤20）；正文超长再懒加载 BODY_PACK_LOADERS
// 的 gen-b{y}，全部评论懒加载 COMMENT_PACK_LOADERS 的 gen-c{y}-{i}（50/批分页
// 哨兵）——全部 import() 字面量由 Vite 静态分片（设计 §8.2），零实时 API。
// 单 WebGL 上下文红线：纯 DOM 抽屉，不新增 canvas；样式见 modules/year-town-panel.css。
import { YEAR_TOWN_BUILDING_EXTRAS, YEAR_TOWN_NAMEPLATES } from '../../city/data/year-towns/gen-buildings';
import { BODY_PACK_LOADERS, COMMENT_PACK_LOADERS, TOWN_LOADERS } from '../../city/data/year-towns/gen-loaders';
import { YEAR_TOWNS } from '../../city/data/year-towns/towns';
import type { YearComment, YearTownCommentPackModule, YearWorkDetail, YearWorkNameplate } from '../../city/data/year-towns/_types';

/** 铭牌弹窗「阅读正文」按钮发出的动作前缀（cityDialogController 生成，组合根路由）。 */
export const READ_BODY_ACTION_PREFIX = 'read-body:';

/** 评论精选默认展示条数（可展开到 D 级上限 20）。 */
export const SELECTED_COMMENT_PREVIEW = 5;

/** 全部评论的每批渲染条数（分页哨兵步长）。 */
export const COMMENT_PAGE_SIZE = 50;

/** `read-body:{buildingId}` → buildingId；其余动作返回 null。 */
export function parseReadBodyAction(action: string): string | null {
  return action.startsWith(READ_BODY_ACTION_PREFIX) ? action.slice(READ_BODY_ACTION_PREFIX.length) : null;
}

/** 在镇 D 级模块的作品列表中按作品 ID 取详情。 */
export function findWorkDetail(works: readonly YearWorkDetail[], workId: string): YearWorkDetail | undefined {
  return works.find((work) => work.id === workId);
}

/** 在评论包中按作品 ID 取全部评论（采集上限 200 条，巨楼 truncated 已在生成期标记）。 */
export function findPackComments(pack: YearTownCommentPackModule, workId: string): readonly YearComment[] | undefined {
  return pack.works.find((work) => work.id === workId)?.comments;
}

/** ISO 时间 → 展示日期（YYYY-MM-DD）；无效/缺失返回空串。 */
export function formatCommentTime(iso: string | undefined): string {
  if (!iso) return '';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  const month = `${date.getMonth() + 1}`.padStart(2, '0');
  const day = `${date.getDate()}`.padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day}`;
}

/** 全部评论分页数（哨兵触发次数上限）。 */
export function commentPages(total: number, size: number = COMMENT_PAGE_SIZE): number {
  return total <= 0 ? 0 : Math.ceil(total / size);
}

const fmt = (v: number) => v.toLocaleString('zh-Hans-CN');

export interface YearTownPanelControllerOptions {
  document: Document;
  signal?: AbortSignal;
}

export interface YearTownPanelController {
  open(buildingId: string): void;
  /** 目录抽屉（b3 档案馆/总目塔）通用入口：按铭牌对象直接开卷，支持全部 1000 条。 */
  openWork(work: YearWorkNameplate): void;
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
  status: HTMLElement;
  bodySection: HTMLElement;
  bodyNote: HTMLElement;
  bodyText: HTMLElement;
  bodyMore: HTMLButtonElement;
  commentsSection: HTMLElement;
  commentsTitle: HTMLElement;
  commentNote: HTMLElement;
  comments: HTMLElement;
  moreSelected: HTMLButtonElement;
  loadAll: HTMLButtonElement;
  sentinel: HTMLButtonElement;
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
  const status = document.createElement('p');
  status.className = 'ytp-status';
  status.id = 'ytpStatus';
  status.hidden = true;

  const bodySection = document.createElement('section');
  bodySection.className = 'ytp-section';
  const bodyTitle = document.createElement('h3');
  bodyTitle.className = 'ytp-section-title';
  bodyTitle.textContent = '正文';
  const bodyNote = document.createElement('p');
  bodyNote.className = 'ytp-body-note';
  bodyNote.hidden = true;
  const bodyText = document.createElement('div');
  bodyText.className = 'ytp-body';
  const bodyMore = document.createElement('button');
  bodyMore.type = 'button';
  bodyMore.className = 'ytp-more';
  bodyMore.hidden = true;
  bodySection.append(bodyTitle, bodyNote, bodyText, bodyMore);

  const commentsSection = document.createElement('section');
  commentsSection.className = 'ytp-section';
  const commentsTitle = document.createElement('h3');
  commentsTitle.className = 'ytp-section-title';
  commentsTitle.textContent = '评论精选';
  const commentNote = document.createElement('p');
  commentNote.className = 'ytp-note';
  commentNote.hidden = true;
  const comments = document.createElement('div');
  comments.className = 'ytp-comments';
  const moreSelected = document.createElement('button');
  moreSelected.type = 'button';
  moreSelected.className = 'ytp-more';
  moreSelected.hidden = true;
  const loadAll = document.createElement('button');
  loadAll.type = 'button';
  loadAll.className = 'ytp-more';
  loadAll.hidden = true;
  const sentinel = document.createElement('button');
  sentinel.type = 'button';
  sentinel.className = 'ytp-more ytp-sentinel';
  sentinel.hidden = true;
  commentsSection.append(commentsTitle, commentNote, comments, moreSelected, loadAll, sentinel);

  scroll.append(status, bodySection, commentsSection);
  panel.append(head, scroll);
  document.body.appendChild(panel);

  return {
    panel, close, kicker, title, meta, chips, scroll, status,
    bodySection, bodyNote, bodyText, bodyMore,
    commentsSection, commentsTitle, commentNote, comments, moreSelected, loadAll, sentinel,
  };
}

function renderComment(document: Document, comment: YearComment): HTMLElement {
  const article = document.createElement('article');
  article.className = 'ytp-comment';
  const head = document.createElement('header');
  head.className = 'ytp-comment-head';
  const name = document.createElement('span');
  name.className = 'ytp-comment-name';
  name.textContent = comment.nickname;
  head.appendChild(name);
  if (comment.verification) {
    const badge = document.createElement('i');
    badge.className = 'ytp-comment-badge';
    badge.textContent = comment.verification;
    head.appendChild(badge);
  }
  const time = document.createElement('time');
  time.className = 'ytp-comment-time';
  time.textContent = formatCommentTime(comment.time);
  if (comment.time) time.dateTime = comment.time;
  head.appendChild(time);
  const text = document.createElement('p');
  text.className = 'ytp-comment-text';
  text.textContent = comment.content;
  article.append(head, text);
  return article;
}

export function createYearTownPanelController(options: YearTownPanelControllerOptions): YearTownPanelController {
  const { document, signal } = options;
  const refs = buildPanelSkeleton(document);

  // 单实例状态：activeKey=当前抽屉作品键（建筑 id 或 work:{id}）；activeNameplate
  // 为渲染数据源（b3 起目录条目可无建筑）；loadToken 淘汰在途异步（重开/换作品）。
  let openState = false;
  let activeKey: string | null = null;
  let activeNameplate: YearWorkNameplate | null = null;
  let activeWorkId = '';
  let activeYear = 0;
  let detail: YearWorkDetail | null = null;
  let expandedSelected = false;
  let fullComments: readonly YearComment[] | null = null;
  let fullShown = 0;
  let loadToken = 0;

  const observer = typeof IntersectionObserver === 'function'
    ? new IntersectionObserver((entries) => {
        if (entries.some((entry) => entry.isIntersecting) && !refs.sentinel.hidden) advanceFullComments();
      }, { root: refs.scroll, rootMargin: '480px 0px' })
    : null;

  function resetContent(): void {
    detail = null;
    expandedSelected = false;
    fullComments = null;
    fullShown = 0;
    refs.status.hidden = false;
    refs.status.textContent = '正在翻开馆藏…';
    refs.bodySection.hidden = true;
    refs.commentsSection.hidden = true;
    refs.sentinel.hidden = true;
    observer?.unobserve(refs.sentinel);
  }

  /** 铭牌级头部渲染（P 级字段自洽，建筑与目录条目共用同一数据形状）。 */
  function presentWork(nameplate: YearWorkNameplate): boolean {
    const town = YEAR_TOWNS.find((item) => item.year === nameplate.year);
    if (!town) return false;
    activeWorkId = nameplate.id;
    activeYear = nameplate.year;
    refs.kicker.textContent = `${town.label} · 全站第 ${nameplate.rank} 名`;
    refs.title.textContent = nameplate.subject;
    refs.meta.textContent = `作者「${nameplate.author}」 · 热度 ${fmt(nameplate.popularity)} · 浏览 ${fmt(nameplate.visits)}`;
    refs.chips.replaceChildren(...nameplate.tags.map((tag) => {
      const chip = document.createElement('span');
      chip.className = 'ytp-chip';
      chip.textContent = tag;
      return chip;
    }));
    if (nameplate.hasModel) {
      const chip = document.createElement('span');
      chip.className = 'ytp-chip ytp-chip-model';
      chip.textContent = '内含实验模型';
      refs.chips.appendChild(chip);
    }
    refs.panel.style.setProperty('--ytp-accent', town.theme.iconColor);
    return true;
  }

  async function loadDetail(workId: string): Promise<void> {
    const token = ++loadToken;
    const loader = TOWN_LOADERS[activeYear];
    if (!loader) {
      refs.status.textContent = '这一册暂时不在架上，稍后再试。';
      return;
    }
    try {
      const module = await loader();
      if (token !== loadToken) return;
      const loaded = findWorkDetail(module.works, workId);
      if (!loaded) {
        refs.status.textContent = '馆藏记录暂时缺席，稍后再试。';
        return;
      }
      detail = loaded;
      refs.status.hidden = true;
      renderBody(loaded);
      renderComments(loaded);
    } catch (error) {
      if (token !== loadToken) return;
      console.error('yearTownPanel loadDetail failed:', error);
      refs.status.textContent = '这一页暂时翻不开，稍后再试。';
    }
  }

  function renderBody(work: YearWorkDetail): void {
    refs.bodySection.hidden = false;
    refs.bodyText.textContent = work.body;
    if (work.bodyExternal) {
      refs.bodyNote.hidden = false;
      refs.bodyNote.textContent = '正文较长，先展示节选。';
      refs.bodyMore.hidden = false;
      refs.bodyMore.disabled = false;
      refs.bodyMore.textContent = '展开全文';
    } else {
      refs.bodyNote.hidden = true;
      refs.bodyMore.hidden = true;
    }
  }

  function renderComments(work: YearWorkDetail): void {
    refs.commentsSection.hidden = false;
    refs.commentsTitle.textContent = '评论精选';
    const nameplate = activeNameplate;
    if (nameplate?.commentsTruncated) {
      refs.commentNote.hidden = false;
      refs.commentNote.textContent = `仅收录部分评论 · 共 ${fmt(nameplate.totalComments)} 条`;
    } else {
      refs.commentNote.hidden = true;
    }
    if (work.locked) {
      // 评论区已锁定（服务端 403，如 rank 344）：占位提示，无载入入口。
      const locked = document.createElement('p');
      locked.className = 'ytp-locked';
      locked.textContent = '评论区已锁定';
      refs.comments.replaceChildren(locked);
      refs.moreSelected.hidden = true;
      refs.loadAll.hidden = true;
      refs.sentinel.hidden = true;
      return;
    }
    expandedSelected = false;
    fullComments = null;
    fullShown = 0;
    renderSelectedComments(work.comments);
    refs.moreSelected.hidden = work.comments.length <= SELECTED_COMMENT_PREVIEW;
    refs.moreSelected.disabled = false;
    refs.moreSelected.textContent = `展开精选评论（其余 ${work.comments.length - SELECTED_COMMENT_PREVIEW} 条）`;
    refs.loadAll.hidden = !work.pack;
    refs.loadAll.disabled = false;
    refs.loadAll.textContent = work.pack
      ? `载入全部评论（${fmt(nameplate?.totalComments ?? work.comments.length)} 条）`
      : '';
    refs.sentinel.hidden = true;
  }

  function renderSelectedComments(selected: readonly YearComment[]): void {
    const shown = expandedSelected ? selected : selected.slice(0, SELECTED_COMMENT_PREVIEW);
    refs.comments.replaceChildren(...shown.map((comment) => renderComment(document, comment)));
  }

  async function loadBodyPack(): Promise<void> {
    const token = loadToken;
    if (!detail || !detail.bodyExternal) return;
    const loader = BODY_PACK_LOADERS[activeYear];
    if (!loader) return;
    refs.bodyMore.disabled = true;
    refs.bodyMore.textContent = '正在载入全文…';
    try {
      const pack = await loader();
      if (token !== loadToken) return;
      const full = pack.bodies[activeWorkId];
      if (full === undefined) {
        refs.bodyNote.textContent = '全文包暂时缺席，先读节选。';
        refs.bodyMore.hidden = true;
        return;
      }
      refs.bodyText.textContent = full;
      refs.bodyNote.hidden = true;
      refs.bodyMore.hidden = true;
    } catch {
      if (token !== loadToken) return;
      refs.bodyMore.disabled = false;
      refs.bodyMore.textContent = '展开全文（重试）';
    }
  }

  async function loadAllComments(): Promise<void> {
    const token = loadToken;
    const packKey = detail?.pack;
    if (!packKey) return;
    const loader = COMMENT_PACK_LOADERS[packKey];
    if (!loader) return;
    refs.loadAll.disabled = true;
    refs.loadAll.textContent = '正在载入…';
    try {
      const module = await loader();
      if (token !== loadToken) return;
      fullComments = findPackComments(module, activeWorkId) ?? [];
      fullShown = Math.min(COMMENT_PAGE_SIZE, fullComments.length);
      refs.commentsTitle.textContent = `全部评论（已载入 ${fmt(fullShown)} / ${fmt(fullComments.length)} 条）`;
      renderFullCommentList();
      refs.moreSelected.hidden = true;
      refs.loadAll.hidden = true;
      updateSentinel();
    } catch {
      if (token !== loadToken) return;
      refs.loadAll.disabled = false;
      refs.loadAll.textContent = '载入全部评论（重试）';
    }
  }

  function renderFullCommentList(): void {
    const comments = fullComments ?? [];
    refs.comments.replaceChildren(...comments.slice(0, fullShown).map((comment) => renderComment(document, comment)));
  }

  function advanceFullComments(): void {
    if (!fullComments || fullShown >= fullComments.length) {
      updateSentinel();
      return;
    }
    fullShown = Math.min(fullShown + COMMENT_PAGE_SIZE, fullComments.length);
    refs.commentsTitle.textContent = `全部评论（已载入 ${fmt(fullShown)} / ${fmt(fullComments.length)} 条）`;
    renderFullCommentList();
    updateSentinel();
  }

  function updateSentinel(): void {
    const total = fullComments?.length ?? 0;
    if (fullComments && fullShown < total) {
      refs.sentinel.hidden = false;
      refs.sentinel.disabled = false;
      refs.sentinel.textContent = `载入更多评论（剩余 ${fmt(total - fullShown)} 条）`;
      observer?.observe(refs.sentinel);
    } else {
      refs.sentinel.hidden = true;
      observer?.unobserve(refs.sentinel);
    }
  }

  const controller: YearTownPanelController = {
    open(buildingId: string): void {
      const nameplate = YEAR_TOWN_BUILDING_EXTRAS[buildingId]?.kind === 'work' ? YEAR_TOWN_NAMEPLATES[buildingId] : undefined;
      if (nameplate) openWorkEntry(nameplate, buildingId);
    },
    openWork(work: YearWorkNameplate): void {
      openWorkEntry(work, `work:${work.id}`);
    },
    close(): void {
      if (!openState) return;
      openState = false;
      refs.panel.classList.remove('open');
      observer?.unobserve(refs.sentinel);
    },
    isOpen: () => openState,
  };

  /** 建筑入口与目录入口的合流点：键不同即换卷（重开同卷且无详情时允许重试）。 */
  function openWorkEntry(nameplate: YearWorkNameplate, key: string): void {
    if (!presentWork(nameplate)) return;
    activeNameplate = nameplate;
    if (!openState) {
      openState = true;
      refs.panel.classList.add('open');
      refs.close.focus();
    }
    if (activeKey !== key || !detail) {
      activeKey = key;
      resetContent();
      void loadDetail(activeWorkId);
    }
  }

  refs.close.addEventListener('click', controller.close, { signal });
  refs.bodyMore.addEventListener('click', () => { void loadBodyPack(); }, { signal });
  refs.moreSelected.addEventListener('click', () => {
    if (!detail) return;
    expandedSelected = true;
    renderSelectedComments(detail.comments);
    refs.moreSelected.hidden = true;
  }, { signal });
  refs.loadAll.addEventListener('click', () => { void loadAllComments(); }, { signal });
  refs.sentinel.addEventListener('click', advanceFullComments, { signal });
  document.addEventListener('keydown', (event) => {
    if (event.key !== 'Escape' || !openState || event.defaultPrevented) return;
    event.preventDefault();
    controller.close();
  }, { capture: true, signal });

  return controller;
}
