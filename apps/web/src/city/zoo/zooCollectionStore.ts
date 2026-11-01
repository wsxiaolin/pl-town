// S014 动物园怪谈：本地收集状态（民间解法卡 / 申请表 / 童心手环 / 守则）。
//
// 这些内容不进服务端背包：卡片与申请表只是图鉴条目，手环是外观性旗标，
// 守则第七条是玩家自由文本。全部存在 localStorage 的单一键下；读写失败
// 或 JSON 损坏时回退到安全的空状态，绝不清除其它键。
//
// 数组与文本都有硬上限（8 卡 / 5 表 / 24 字），重复添加幂等。
export const ZOO_COLLECTION_STORAGE_KEY = 'zoo.collection.v1';
export const ZOO_CARD_IDS = [
  'zoo_card_thought_stamp',
  'zoo_card_gatling',
  'zoo_card_yield_negotiation',
  'zoo_card_two_way_foil',
  'zoo_card_rocket_artillery',
  'zoo_card_j20',
  'zoo_card_mech_charge',
  'zoo_card_universal_map',
] as const;

export const ZOO_FORM_IDS = [
  'zoo_form_alliance',
  'zoo_form_encyclopedia',
  'zoo_form_law_society',
  'zoo_form_beast_bus',
  'zoo_form_waterfowl_lamp',
] as const;
export const ZOO_MAX_CARDS = ZOO_CARD_IDS.length;
export const ZOO_MAX_FORMS = ZOO_FORM_IDS.length;
export const ZOO_RULE_MAX_LENGTH = 24;
export const ZOO_RULE_VERSION = 7;
export const ZOO_RULE_VERSION_WRITTEN = 8;

export type ZooRuleDirection = 'keep' | 'joy' | 'pass';

/** 空输入时按结局方向落笔的默认第七条（UI 写入 store 前使用）。 */
export const ZOO_RULE_DEFAULTS: Readonly<Record<ZooRuleDirection, string>> = Object.freeze({
  keep: '第七条：看不懂的时候，先问售票亭。',
  joy: '第七条：今天玩得开心吗？',
  pass: '第七条：〔此条由下一位游客续写。〕',
});

export interface ZooCollectionState {
  cards: string[];
  forms: string[];
  bracelet: boolean;
  thesisHeard: boolean;
  ruleLine: string;
  ruleVersion: number;
}

export interface ZooCollectionStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

export interface ZooCollectionStoreOptions {
  /** 缺省 window.localStorage；传 null 表示只用内存。 */
  storage?: ZooCollectionStorage | null;
  /** 收齐第八张卡时回调一次（用于发 zoo_physics_solution）。 */
  onAllCardsCollected?: (state: ZooCollectionState) => void;
}

export interface ZooCollectionStore {
  get(): ZooCollectionState;
  addCard(id: string): boolean;
  addForm(id: string): boolean;
  setBracelet(value?: boolean): void;
  markThesisHeard(): void;
  setRule(line: string, version?: number): void;
  allCardsCollected(): boolean;
  reset(): void;
}

const CARD_ID_SET: ReadonlySet<string> = new Set(ZOO_CARD_IDS);
const FORM_ID_SET: ReadonlySet<string> = new Set(ZOO_FORM_IDS);
export function emptyZooCollection(): ZooCollectionState {
  return { cards: [], forms: [], bracelet: false, thesisHeard: false, ruleLine: '', ruleVersion: ZOO_RULE_VERSION };
}

/** 按字符（码点）截断，避免把代理对切成半个字符。 */
function truncate(value: string, max: number): string {
  const chars = Array.from(value);
  return chars.length <= max ? value : chars.slice(0, max).join('');
}

function uniqueKnown(value: unknown, known: ReadonlySet<string>, max: number): string[] {
  if (!Array.isArray(value)) return [];
  const result: string[] = [];
  for (const item of value) {
    if (typeof item === 'string' && known.has(item) && !result.includes(item)) result.push(item);
    if (result.length >= max) break;
  }
  return result;
}

/** 接受任意 JSON，返回有界且类型安全的状态。 */
export function normalizeZooCollection(value: unknown): ZooCollectionState {
  if (!value || typeof value !== 'object') return emptyZooCollection();
  const record = value as Partial<Record<keyof ZooCollectionState, unknown>>;
  return {
    cards: uniqueKnown(record.cards, CARD_ID_SET, ZOO_MAX_CARDS),
    forms: uniqueKnown(record.forms, FORM_ID_SET, ZOO_MAX_FORMS),
    bracelet: record.bracelet === true,
    thesisHeard: record.thesisHeard === true,
    ruleLine: typeof record.ruleLine === 'string' ? truncate(record.ruleLine, ZOO_RULE_MAX_LENGTH) : '',
    ruleVersion: record.ruleVersion === ZOO_RULE_VERSION_WRITTEN ? ZOO_RULE_VERSION_WRITTEN : ZOO_RULE_VERSION,
  };
}

export function resolveZooRuleLine(direction: ZooRuleDirection, input: string): string {
  const trimmed = input.trim();
  return truncate(trimmed || ZOO_RULE_DEFAULTS[direction], ZOO_RULE_MAX_LENGTH);
}

function defaultStorage(): ZooCollectionStorage | null {
  try {
    return typeof window !== 'undefined' ? window.localStorage : null;
  } catch {
    return null;
  }
}

export function createZooCollectionStore(options: ZooCollectionStoreOptions = {}): ZooCollectionStore {
  const storage = options.storage === undefined ? defaultStorage() : options.storage;

  function read(): ZooCollectionState {
    if (!storage) return emptyZooCollection();
    try {
      const raw = storage.getItem(ZOO_COLLECTION_STORAGE_KEY);
      return raw ? normalizeZooCollection(JSON.parse(raw)) : emptyZooCollection();
    } catch {
      return emptyZooCollection();
    }
  }

  let state = read();
  let allCardsNotified = state.cards.length >= ZOO_MAX_CARDS;

  function persist(): void {
    if (!storage) return;
    try {
      storage.setItem(ZOO_COLLECTION_STORAGE_KEY, JSON.stringify(state));
    } catch {
      // Storage can be unavailable in privacy modes; the session keeps working.
    }
  }

  function snapshot(): ZooCollectionState {
    return { ...state, cards: [...state.cards], forms: [...state.forms] };
  }

  function addCard(id: string): boolean {
    if (!CARD_ID_SET.has(id) || state.cards.includes(id) || state.cards.length >= ZOO_MAX_CARDS) return false;
    state = { ...state, cards: [...state.cards, id] };
    persist();
    if (state.cards.length >= ZOO_MAX_CARDS && !allCardsNotified) {
      allCardsNotified = true;
      options.onAllCardsCollected?.(snapshot());
    }
    return true;
  }

  function addForm(id: string): boolean {
    if (!FORM_ID_SET.has(id) || state.forms.includes(id) || state.forms.length >= ZOO_MAX_FORMS) return false;
    state = { ...state, forms: [...state.forms, id] };
    persist();
    return true;
  }

  return {
    get: snapshot,
    addCard,
    addForm,
    setBracelet(value = true): void {
      state = { ...state, bracelet: value };
      persist();
    },
    markThesisHeard(): void {
      state = { ...state, thesisHeard: true };
      persist();
    },
    setRule(line: string, version = ZOO_RULE_VERSION_WRITTEN): void {
      state = {
        ...state,
        ruleLine: truncate(line, ZOO_RULE_MAX_LENGTH),
        ruleVersion: version === ZOO_RULE_VERSION_WRITTEN ? ZOO_RULE_VERSION_WRITTEN : ZOO_RULE_VERSION,
      };
      persist();
    },
    allCardsCollected(): boolean {
      return state.cards.length >= ZOO_MAX_CARDS;
    },
    reset(): void {
      state = emptyZooCollection();
      allCardsNotified = false;
      persist();
    },
  };
}
