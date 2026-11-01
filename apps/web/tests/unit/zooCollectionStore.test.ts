import assert from 'node:assert/strict';
import test from 'node:test';
import {
  ZOO_CARD_IDS,
  ZOO_COLLECTION_STORAGE_KEY,
  ZOO_FORM_IDS,
  ZOO_RULE_DEFAULTS,
  ZOO_RULE_MAX_LENGTH,
  ZOO_RULE_VERSION,
  ZOO_RULE_VERSION_WRITTEN,
  createZooCollectionStore,
  normalizeZooCollection,
  resolveZooRuleLine,
  type ZooCollectionStorage,
} from '../../src/city/zoo/zooCollectionStore';

function memoryStorage(initial: Record<string, string> = {}): ZooCollectionStorage & { data: Map<string, string> } {
  const data = new Map(Object.entries(initial));
  return {
    data,
    getItem: (key) => data.get(key) ?? null,
    setItem: (key, value) => { data.set(key, value); },
  };
}

test('adding the same card twice is idempotent', () => {
  const store = createZooCollectionStore({ storage: memoryStorage() });
  assert.equal(store.addCard(ZOO_CARD_IDS[0]), true);
  assert.equal(store.addCard(ZOO_CARD_IDS[0]), false);
  assert.deepEqual(store.get().cards, [ZOO_CARD_IDS[0]]);
});

test('the eighth card triggers the completion callback exactly once', () => {
  let calls = 0;
  const store = createZooCollectionStore({
    storage: memoryStorage(),
    onAllCardsCollected: () => { calls += 1; },
  });
  for (const id of ZOO_CARD_IDS) assert.equal(store.addCard(id), true);
  assert.equal(calls, 1);
  assert.equal(store.allCardsCollected(), true);
  assert.equal(store.addCard(ZOO_CARD_IDS[0]), false);
  assert.equal(calls, 1);
});

test('five forms are distinct and duplicates are ignored', () => {
  const store = createZooCollectionStore({ storage: memoryStorage() });
  for (const id of ZOO_FORM_IDS) assert.equal(store.addForm(id), true);
  assert.equal(store.addForm(ZOO_FORM_IDS[0]), false);
  assert.equal(store.get().forms.length, 5);
});

test('unknown ids are rejected instead of growing the collection', () => {
  const store = createZooCollectionStore({ storage: memoryStorage() });
  assert.equal(store.addCard('zoo_card_unknown'), false);
  assert.equal(store.addForm('zoo_form_unknown'), false);
  assert.deepEqual(store.get().cards, []);
  assert.deepEqual(store.get().forms, []);
});

test('bracelet persists across store instances on the same storage', () => {
  const storage = memoryStorage();
  createZooCollectionStore({ storage }).setBracelet();
  const reopened = createZooCollectionStore({ storage });
  assert.equal(reopened.get().bracelet, true);
});

test('rule version moves 7 to 8 and free text is bounded', () => {
  const store = createZooCollectionStore({ storage: memoryStorage() });
  assert.equal(store.get().ruleVersion, ZOO_RULE_VERSION);
  store.setRule('一'.repeat(40), ZOO_RULE_VERSION_WRITTEN);
  assert.equal(store.get().ruleVersion, ZOO_RULE_VERSION_WRITTEN);
  assert.equal(Array.from(store.get().ruleLine).length, ZOO_RULE_MAX_LENGTH);
});

test('empty rule input falls back to the direction default', () => {
  assert.equal(resolveZooRuleLine('keep', ''), ZOO_RULE_DEFAULTS.keep);
  assert.equal(resolveZooRuleLine('joy', '   '), ZOO_RULE_DEFAULTS.joy);
  assert.equal(resolveZooRuleLine('pass', ''), ZOO_RULE_DEFAULTS.pass);
});

test('corrupt JSON returns the safe empty state and later writes recover', () => {
  const storage = memoryStorage({ [ZOO_COLLECTION_STORAGE_KEY]: '{not-json' });
  const store = createZooCollectionStore({ storage });
  assert.deepEqual(store.get(), {
    cards: [],
    forms: [],
    bracelet: false,
    thesisHeard: false,
    ruleLine: '',
    ruleVersion: ZOO_RULE_VERSION,
  });
  assert.equal(store.addCard(ZOO_CARD_IDS[0]), true);
  const reopened = createZooCollectionStore({ storage });
  assert.deepEqual(reopened.get().cards, [ZOO_CARD_IDS[0]]);
});

test('normalization bounds card, form, and rule sizes', () => {
  const normalized = normalizeZooCollection({
    cards: [...ZOO_CARD_IDS, ...ZOO_CARD_IDS, 'zoo_card_unknown'],
    forms: [...ZOO_FORM_IDS, 'zoo_form_unknown'],
    ruleLine: '字'.repeat(60),
    ruleVersion: 99,
  });
  assert.equal(normalized.cards.length, ZOO_CARD_IDS.length);
  assert.equal(normalized.forms.length, ZOO_FORM_IDS.length);
  assert.equal(Array.from(normalized.ruleLine).length, ZOO_RULE_MAX_LENGTH);
  assert.equal(normalized.ruleVersion, ZOO_RULE_VERSION);
});
