import type { NewspaperBlock, NewspaperPage } from '../../city/data/newspapers/newspapers-types';

// 报纸排版引擎：把扁平的 block 列表解析成“版面 → 板块 → 栏目 → 条目”的语义模型。
// 这里是纯函数，不接触 DOM，方便单测与替换渲染层。

export interface LayoutItem {
  kind: 'link' | 'text';
  text: string;
  href?: string;
  hrefType?: 'discussion' | 'experiment';
  /** 紧随条目出现的“作者：@xxx”署名 */
  byline?: string;
}

export interface LayoutGroup {
  label: string;
  items: LayoutItem[];
}

export interface LayoutStory {
  title: string;
  /** 括号说明文字，渲染成栏目小导读 */
  deck: string[];
  /** 正文里的装饰性横排小标题（“……尾声……” 之类） */
  bands: string[];
  /** 有内容的分类栏目 */
  groups: LayoutGroup[];
  /** 不属于任何分类的散条目 */
  loose: LayoutItem[];
  /** 长文段落（社论、社区新闻等） */
  paragraphs: string[];
  /** 本周没有收录内容的分类，折叠成一行索引 */
  emptyLabels: string[];
  /** 版面权重，用于挑选头条 */
  weight: number;
}

export interface PageLayout {
  motto: string | null;
  separator: string | null;
  frontItems: LayoutItem[];
  /** 无名板块里的长段落（通讯社特稿等整版散文） */
  frontParagraphs: string[];
  stories: LayoutStory[];
}

interface RawSection {
  title: string;
  blocks: NewspaperBlock[];
}

const NOTE_RE = /^[（(]/;
const BYLINE_LABEL_RE = /^(?:作者|编辑|责编)\s*[:：]\s*/;
const BYLINE_SLASH_RE = /^文\s*[/／]\s*/;
const HANDLE_RE = /^@[^\s@]+$/;

// 空板块的常见写法，出现时直接丢弃，避免“无 / 暂无”之类占一整个版面。
const EMPTY_TEXT_RE = [
  /^无$/,
  /^暂无$/,
  /^本周暂无/,
  /^（?暂无/,
  /不予收录/,
  /没有.*冲精.*作品/,
  /目前没有发现/,
  /没有支持未满/,
  /好吧，忘记写了/,
];

function isNote(text: string): boolean {
  return NOTE_RE.test(text);
}

function isByline(text: string): boolean {
  return text.length <= 24 && (BYLINE_LABEL_RE.test(text) || BYLINE_SLASH_RE.test(text));
}

function isHandleByline(text: string): boolean {
  return HANDLE_RE.test(text);
}

function bylineName(text: string): string {
  const stripped = text.replace(BYLINE_LABEL_RE, '').replace(BYLINE_SLASH_RE, '').trim();
  return stripped.length > 0 ? stripped : text.trim();
}

function isEmptyPlaceholder(text: string): boolean {
  return EMPTY_TEXT_RE.some((re) => re.test(text));
}

// 早期刊物把学科分类写成普通 text（而非 label），例如“物理”“生命科学”。
// 这类短词随后紧跟链接或另一短分类，据此还原成分组标题。
const CATEGORY_PUNCT_RE = /[。！？，、；：""''（）()【】\[\]／/·]/;

function isStructuralShort(text: string): boolean {
  return (
    text.length >= 2 &&
    text.length <= 7 &&
    !CATEGORY_PUNCT_RE.test(text) &&
    !/^\d+$/.test(text) &&
    !isByline(text) &&
    !isNote(text) &&
    !isEmptyPlaceholder(text)
  );
}

function nextMeaningfulBlock(blocks: readonly NewspaperBlock[], from: number): NewspaperBlock | undefined {
  for (let index = from; index < blocks.length; index += 1) {
    const block = blocks[index];
    if (!block) continue;
    const text = block.text.trim();
    if (block.kind === 'text' && (text.length === 0 || isByline(text) || isNote(text) || isEmptyPlaceholder(text))) {
      continue;
    }
    return block;
  }
  return undefined;
}

function isCategoryHeading(blocks: readonly NewspaperBlock[], index: number, text: string): boolean {
  if (!isStructuralShort(text)) return false;
  const next = nextMeaningfulBlock(blocks, index + 1);
  if (!next) return true;
  return next.kind === 'link' || (next.kind === 'text' && isStructuralShort(next.text.trim()));
}

function normalizeSeparator(text: string): string {
  const unified = text.replace(/[—–\-=]/g, '—').replace(/—+/g, '—').trim();
  const inner = unified.replace(/^—+/, '').replace(/—+$/, '').trim();
  return inner.length > 0 ? inner : unified.replace(/^—+$/, '').trim();
}

// 有些版面把“————尾声————”这类装饰性分隔写成普通 text，识别出来当作小标题。
function asBand(text: string): string | null {
  const stripped = text.replace(/[—–\-=·]/g, '');
  const dashes = text.length - stripped.length;
  if (dashes < 4 || dashes / Math.max(1, text.length) < 0.5) return null;
  const inner = stripped.trim();
  return inner.length > 0 ? inner : null;
}

/** 按 section block 把整版切成若干“板块”，头版前的引导内容 title 为空串。 */
function splitIntoSections(blocks: readonly NewspaperBlock[]): RawSection[] {
  const sections: RawSection[] = [];
  let current: RawSection = { title: '', blocks: [] };
  for (const block of blocks) {
    if (block.kind === 'section') {
      if (current.blocks.length > 0) sections.push(current);
      current = { title: block.text.trim(), blocks: [block] };
    } else {
      current.blocks.push(block);
    }
  }
  if (current.blocks.length > 0) sections.push(current);
  return sections;
}

function toItem(block: NewspaperBlock): LayoutItem {
  const item: LayoutItem = { kind: block.kind === 'link' ? 'link' : 'text', text: block.text.trim() };
  if (block.href) item.href = block.href;
  if (block.hrefType) item.hrefType = block.hrefType;
  return item;
}

function dedupe(labels: readonly string[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const label of labels) {
    if (label.length === 0 || seen.has(label)) continue;
    seen.add(label);
    result.push(label);
  }
  return result;
}

/** 判断一个板块是否以长文为主（社论、社区新闻、通讯社特稿）。 */
function isProseSection(blocks: readonly NewspaperBlock[]): boolean {
  let hasLabels = false;
  const texts: string[] = [];
  for (const block of blocks) {
    if (block.kind === 'label') hasLabels = true;
    else if (block.kind === 'text') texts.push(block.text.trim());
  }
  if (hasLabels || texts.length < 3) return false;
  const total = texts.reduce((sum, text) => sum + text.length, 0);
  const average = total / texts.length;
  const longest = texts.reduce((max, text) => Math.max(max, text.length), 0);
  return average >= 28 || longest >= 80;
}

function buildStory(title: string, blocks: readonly NewspaperBlock[]): LayoutStory {
  const deck: string[] = [];
  const bands: string[] = [];
  const groups: LayoutGroup[] = [];
  const loose: LayoutItem[] = [];
  const paragraphs: string[] = [];
  const proseMode = isProseSection(blocks);

  let current: LayoutGroup | null = null;
  const lastItem = (): LayoutItem | undefined =>
    current ? current.items[current.items.length - 1] : loose[loose.length - 1];
  const push = (item: LayoutItem): void => {
    if (current) current.items.push(item);
    else loose.push(item);
  };

  for (let index = 0; index < blocks.length; index += 1) {
    const block = blocks[index];
    if (!block) continue;
    switch (block.kind) {
      case 'section':
      case 'motto':
      case 'separator':
        continue;
      case 'label': {
        current = { label: block.text.trim(), items: [] };
        groups.push(current);
        continue;
      }
      case 'link': {
        push(toItem(block));
        continue;
      }
      case 'editor': {
        const text = block.text.trim();
        if (text.length > 0) deck.push(text);
        continue;
      }
      default: {
        const text = block.text.trim();
        if (text.length === 0 || isEmptyPlaceholder(text)) continue;
        if (isByline(text) || isHandleByline(text)) {
          const target = lastItem();
          if (target && !target.byline) target.byline = bylineName(text);
          else push(toItem(block));
          continue;
        }
        if (isNote(text)) {
          deck.push(text);
          continue;
        }
        const band = asBand(text);
        if (band !== null) {
          bands.push(band);
          current = null;
          continue;
        }
        if (isCategoryHeading(blocks, index, text) && !proseMode) {
          current = { label: text, items: [] };
          groups.push(current);
          continue;
        }
        if (proseMode) paragraphs.push(text);
        else push(toItem(block));
      }
    }
  }

  const filledGroups = groups.filter((group) => group.items.length > 0);
  const emptyLabels = dedupe(groups.filter((group) => group.items.length === 0).map((group) => group.label));

  const itemCount = filledGroups.reduce((sum, group) => sum + group.items.length, 0) + loose.length;
  const proseWeight = paragraphs.reduce((sum, text) => sum + Math.max(1, text.length / 40), 0);

  return {
    title,
    deck,
    bands,
    groups: filledGroups,
    loose,
    paragraphs,
    emptyLabels,
    weight: itemCount + proseWeight + bands.length * 2,
  };
}

export function storyHasContent(story: LayoutStory): boolean {
  return (
    story.groups.length > 0 ||
    story.loose.length > 0 ||
    story.paragraphs.length > 0 ||
    story.bands.length > 0
  );
}

/** 把一版报纸解析成可直接渲染的版面模型。 */
export function buildPageLayout(page: NewspaperPage): PageLayout {
  const layout: PageLayout = { motto: null, separator: null, frontItems: [], frontParagraphs: [], stories: [] };

  for (const section of splitIntoSections(page.blocks)) {
    if (section.title === '') {
      const texts: string[] = [];
      const links: LayoutItem[] = [];
      for (const block of section.blocks) {
        if (block.kind === 'motto' && layout.motto === null) {
          layout.motto = block.text.trim();
        } else if (block.kind === 'separator' && layout.separator === null) {
          const separator = normalizeSeparator(block.text);
          if (separator.length > 0) layout.separator = separator;
        } else if (block.kind === 'link') {
          links.push(toItem(block));
        } else if (block.kind === 'text') {
          const text = block.text.trim();
          if (text.length > 0 && !isNote(text) && !isByline(text) && !isEmptyPlaceholder(text)) {
            texts.push(text);
          }
        }
      }
      // 无 section 的整版特稿：段落足够长时按正文散文排版，否则作为条目列表。
      const prefaceIsProse =
        texts.length >= 2 && texts.reduce((sum, text) => sum + text.length, 0) / texts.length >= 18;
      if (prefaceIsProse) layout.frontParagraphs.push(...texts);
      else for (const text of texts) layout.frontItems.push({ kind: 'text', text });
      layout.frontItems.push(...links);
      continue;
    }
    const story = buildStory(section.title, section.blocks);
    if (storyHasContent(story)) layout.stories.push(story);
  }

  return layout;
}
