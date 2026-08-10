import { createEmptyQuestJournal } from '../../gameplay/quests/questEngine';
import type { QuestJournal, QuestJournalRepository, QuestProgress } from '../../gameplay/quests/types';

export const QUEST_JOURNAL_STORAGE_KEY = 'minicityQuestJournal.v1';

function isQuestProgress(value: unknown): value is QuestProgress {
  if (!value || typeof value !== 'object') return false;
  const progress = value as Partial<QuestProgress>;
  return typeof progress.questId === 'string'
    && typeof progress.definitionVersion === 'number'
    && ['active', 'ready', 'completed', 'failed', 'abandoned'].includes(progress.status ?? '')
    && Number.isInteger(progress.stageIndex)
    && !!progress.objectiveProgress
    && typeof progress.objectiveProgress === 'object'
    && typeof progress.acceptedAt === 'number'
    && typeof progress.updatedAt === 'number';
}

function parseJournal(raw: string | null): QuestJournal {
  if (!raw) return createEmptyQuestJournal();
  try {
    const value = JSON.parse(raw) as Partial<QuestJournal>;
    if (value.schemaVersion !== 1 || !value.quests || typeof value.quests !== 'object') {
      return createEmptyQuestJournal();
    }
    const quests = Object.fromEntries(Object.entries(value.quests).filter(([, progress]) => isQuestProgress(progress)));
    const recentEventIds = Array.isArray(value.recentEventIds)
      ? value.recentEventIds.filter((id): id is string => typeof id === 'string').slice(-100)
      : [];
    return { schemaVersion: 1, quests, recentEventIds };
  } catch {
    return createEmptyQuestJournal();
  }
}

export class LocalStorageQuestJournalRepository implements QuestJournalRepository {
  constructor(private readonly storage: Pick<Storage, 'getItem' | 'setItem'> = window.localStorage) {}

  load(): QuestJournal {
    return parseJournal(this.storage.getItem(QUEST_JOURNAL_STORAGE_KEY));
  }

  save(journal: QuestJournal): void {
    this.storage.setItem(QUEST_JOURNAL_STORAGE_KEY, JSON.stringify(journal));
  }
}

