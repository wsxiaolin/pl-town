import type {
  NpcQuestAction,
  QuestCondition,
  QuestDefinition,
  QuestEvent,
  QuestJournal,
  QuestObjectiveDefinition,
  QuestProgress,
  QuestProgressView,
  QuestTransition,
} from './types';

const MAX_RECENT_EVENT_IDS = 100;

export function createEmptyQuestJournal(): QuestJournal {
  return { schemaVersion: 1, quests: {}, recentEventIds: [] };
}

function copyJournal(journal: QuestJournal): QuestJournal {
  return {
    schemaVersion: 1,
    quests: Object.fromEntries(Object.entries(journal.quests).map(([id, progress]) => [id, {
      ...progress,
      objectiveProgress: { ...progress.objectiveProgress },
    }])),
    recentEventIds: [...journal.recentEventIds],
  };
}

function conditionMatches(condition: QuestCondition, journal: QuestJournal, view: QuestProgressView): boolean {
  switch (condition.type) {
    case 'quest.completed': return journal.quests[condition.questId]?.status === 'completed';
    case 'flag.equals': return view.flags[condition.flagId] === condition.value;
    case 'inventory.count': return (view.inventory[condition.itemId] ?? 0) >= condition.atLeast;
    case 'achievement.unlocked': return view.achievements.has(condition.achievementId);
    case 'building.unlocked': return view.unlockedBuildings.has(condition.buildingId);
    case 'district.unlocked': return view.unlockedDistricts.has(condition.districtId);
  }
}

export function getNpcQuestAction(
  definitions: readonly QuestDefinition[],
  journal: QuestJournal,
  npcId: string,
  view: QuestProgressView,
): NpcQuestAction | null {
  for (const quest of definitions) {
    const progress = journal.quests[quest.id];
    if (quest.receiverNpcId === npcId && progress?.status === 'ready') return { kind: 'complete', quest };
  }

  for (const quest of definitions) {
    if (quest.giverNpcId !== npcId || journal.quests[quest.id]) continue;
    if ((quest.prerequisites ?? []).every((condition) => conditionMatches(condition, journal, view))) {
      return { kind: 'offer', quest };
    }
  }
  return null;
}

export function acceptQuest(definition: QuestDefinition, journal: QuestJournal, at: number): QuestTransition {
  if (journal.quests[definition.id]) return { journal, changes: [], effects: [] };
  const next = copyJournal(journal);
  next.quests[definition.id] = {
    questId: definition.id,
    definitionVersion: definition.definitionVersion,
    status: 'active',
    stageIndex: 0,
    objectiveProgress: {},
    acceptedAt: at,
    updatedAt: at,
  };
  return { journal: next, changes: [{ type: 'quest.accepted', questId: definition.id }], effects: [] };
}

export function completeQuest(definition: QuestDefinition, journal: QuestJournal, at: number): QuestTransition {
  const current = journal.quests[definition.id];
  if (current?.status !== 'ready') return { journal, changes: [], effects: [] };
  const next = copyJournal(journal);
  next.quests[definition.id] = { ...next.quests[definition.id]!, status: 'completed', updatedAt: at, completedAt: at };
  return {
    journal: next,
    changes: [{ type: 'quest.completed', questId: definition.id }],
    effects: definition.rewards ?? [],
  };
}

function eventAmount(event: QuestEvent): number {
  return event.type === 'item.acquired' ? event.quantity : 1;
}

function objectiveMatches(objective: QuestObjectiveDefinition, event: QuestEvent): boolean {
  const target = objective.target;
  if (target.type !== event.type) return false;
  switch (target.type) {
    case 'npc.interacted': return event.type === target.type && event.npcId === target.npcId;
    case 'dialogue.option-selected':
      return event.type === target.type
        && event.npcId === target.npcId
        && event.dialogueId === target.dialogueId
        && event.optionId === target.optionId;
    case 'building.visited': return event.type === target.type && event.buildingId === target.buildingId;
    case 'location.entered': return event.type === target.type && event.locationId === target.locationId;
    case 'item.acquired': return event.type === target.type && event.itemId === target.itemId;
    case 'puzzle.solved': return event.type === target.type && event.puzzleId === target.puzzleId;
  }
}

export function reduceQuestEvent(
  definitions: readonly QuestDefinition[],
  journal: QuestJournal,
  event: QuestEvent,
): QuestTransition {
  if (journal.recentEventIds.includes(event.id)) return { journal, changes: [], effects: [] };
  const next = copyJournal(journal);
  next.recentEventIds.push(event.id);
  next.recentEventIds = next.recentEventIds.slice(-MAX_RECENT_EVENT_IDS);
  const changes: QuestTransition['changes'] = [];

  for (const definition of definitions) {
    const progress = next.quests[definition.id];
    if (!progress || progress.status !== 'active') continue;
    const stage = definition.stages[progress.stageIndex];
    if (!stage) continue;

    for (const objective of stage.objectives) {
      if (!objectiveMatches(objective, event)) continue;
      const previous = progress.objectiveProgress[objective.id] ?? 0;
      const amount = Math.min(objective.required, previous + eventAmount(event));
      if (amount === previous) continue;
      progress.objectiveProgress[objective.id] = amount;
      progress.updatedAt = event.at;
      changes.push({ type: 'objective.advanced', questId: definition.id, objectiveId: objective.id, amount });
    }

    const stageComplete = stage.objectives.every(
      (objective) => (progress.objectiveProgress[objective.id] ?? 0) >= objective.required,
    );
    if (!stageComplete) continue;
    if (progress.stageIndex < definition.stages.length - 1) {
      progress.stageIndex += 1;
      progress.objectiveProgress = {};
      changes.push({ type: 'stage.advanced', questId: definition.id });
    } else {
      progress.status = 'ready';
      changes.push({ type: 'quest.ready', questId: definition.id });
    }
  }

  return { journal: next, changes, effects: [] };
}

