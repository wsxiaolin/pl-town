import assert from 'node:assert/strict';
import test from 'node:test';
import { SIDE_QUESTS } from '../../src/gameplay/content/quests/sideQuests';
import { LocalStorageQuestJournalRepository, QUEST_JOURNAL_STORAGE_KEY } from '../../src/adapters/storage/LocalStorageQuestJournalRepository';
import { QuestRuntime, EMPTY_QUEST_PROGRESS_VIEW } from '../../src/gameplay/quests/QuestRuntime';
import { createEmptyQuestJournal } from '../../src/gameplay/quests/questEngine';
import type { QuestDefinition, QuestJournal, QuestJournalRepository } from '../../src/gameplay/quests/types';
import { validateQuestCatalog } from '../../src/gameplay/quests/validateQuestCatalog';

class MemoryRepository implements QuestJournalRepository {
  journal = createEmptyQuestJournal();

  load(): QuestJournal {
    return structuredClone(this.journal);
  }

  save(journal: QuestJournal): void {
    this.journal = structuredClone(journal);
  }
}

test('an NPC offers, advances, and completes a side quest', () => {
  const repository = new MemoryRepository();
  const runtime = new QuestRuntime(SIDE_QUESTS, repository);

  const offer = runtime.getNpcAction('azi', EMPTY_QUEST_PROGRESS_VIEW);
  assert.equal(offer?.kind, 'offer');
  assert.equal(offer?.quest.id, 'side.azi.night-lights');

  runtime.performNpcAction(offer!, 100);
  assert.equal(repository.journal.quests['side.azi.night-lights']?.status, 'active');
  assert.equal(runtime.getNpcAction('azi', EMPTY_QUEST_PROGRESS_VIEW), null);

  const transition = runtime.dispatch({
    id: 'visit-research-1',
    type: 'building.visited',
    buildingId: 'research',
    at: 200,
  });
  assert.deepEqual(transition.changes.map((change) => change.type), ['objective.advanced', 'quest.ready']);
  assert.equal(repository.journal.quests['side.azi.night-lights']?.status, 'ready');

  const completion = runtime.getNpcAction('azi', EMPTY_QUEST_PROGRESS_VIEW);
  assert.equal(completion?.kind, 'complete');
  runtime.performNpcAction(completion!, 300);
  assert.equal(repository.journal.quests['side.azi.night-lights']?.status, 'completed');
  assert.equal(runtime.getNpcAction('azi', EMPTY_QUEST_PROGRESS_VIEW), null);
});

test('events before acceptance and duplicate event ids cannot advance a quest', () => {
  const repository = new MemoryRepository();
  const runtime = new QuestRuntime(SIDE_QUESTS, repository);
  const event = { id: 'same-event', type: 'building.visited', buildingId: 'research', at: 100 } as const;

  runtime.dispatch(event);
  const offer = runtime.getNpcAction('azi', EMPTY_QUEST_PROGRESS_VIEW);
  runtime.performNpcAction(offer!, 200);
  runtime.dispatch(event);

  const progress = repository.journal.quests['side.azi.night-lights'];
  assert.equal(progress?.status, 'active');
  assert.deepEqual(progress?.objectiveProgress, {});
});

test('multiple stages advance in order', () => {
  const quest: QuestDefinition = {
    ...SIDE_QUESTS[0],
    id: 'side.test.multistage',
    stages: [
      {
        id: 'visit-one', title: 'One', description: 'One',
        objectives: [{ id: 'first', description: 'First', target: { type: 'building.visited', buildingId: 'library' }, required: 1 }],
      },
      {
        id: 'solve-one', title: 'Two', description: 'Two',
        objectives: [{ id: 'second', description: 'Second', target: { type: 'puzzle.solved', puzzleId: 'archive-lock' }, required: 1 }],
      },
    ],
  };
  const repository = new MemoryRepository();
  const runtime = new QuestRuntime([quest], repository);
  runtime.performNpcAction(runtime.getNpcAction('azi', EMPTY_QUEST_PROGRESS_VIEW)!, 1);
  runtime.dispatch({ id: 'one', type: 'building.visited', buildingId: 'library', at: 2 });
  assert.equal(repository.journal.quests[quest.id]?.stageIndex, 1);
  assert.equal(repository.journal.quests[quest.id]?.status, 'active');
  runtime.dispatch({ id: 'two', type: 'puzzle.solved', puzzleId: 'archive-lock', at: 3 });
  assert.equal(repository.journal.quests[quest.id]?.status, 'ready');
});

test('catalog validation rejects duplicate ids and executable content', () => {
  assert.throws(
    () => validateQuestCatalog([SIDE_QUESTS[0], SIDE_QUESTS[0]]),
    /duplicates side\.azi\.night-lights/,
  );
  const invalid = structuredClone(SIDE_QUESTS[0]) as QuestDefinition & { callback?: () => void };
  invalid.id = 'side.test.callback';
  invalid.callback = () => undefined;
  assert.throws(() => validateQuestCatalog([invalid]), /cannot contain functions/);
});

test('local storage adapter recovers from malformed data', () => {
  const values = new Map<string, string>([[QUEST_JOURNAL_STORAGE_KEY, '{bad json']]);
  const repository = new LocalStorageQuestJournalRepository({
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => { values.set(key, value); },
  });
  assert.deepEqual(repository.load(), createEmptyQuestJournal());
  repository.save(createEmptyQuestJournal());
  assert.deepEqual(JSON.parse(values.get(QUEST_JOURNAL_STORAGE_KEY)!), createEmptyQuestJournal());
});
