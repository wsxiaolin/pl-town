export type QuestId = string;
export type QuestKind = 'main' | 'side';
export type QuestStatus = 'active' | 'ready' | 'completed' | 'failed' | 'abandoned';

export type QuestCondition =
  | { type: 'quest.completed'; questId: QuestId }
  | { type: 'flag.equals'; flagId: string; value: boolean | number | string }
  | { type: 'inventory.count'; itemId: string; atLeast: number }
  | { type: 'achievement.unlocked'; achievementId: string }
  | { type: 'building.unlocked'; buildingId: string }
  | { type: 'district.unlocked'; districtId: string };

export type QuestEffect =
  | { type: 'flag.set'; flagId: string; value: boolean | number | string }
  | { type: 'inventory.add'; itemId: string; quantity: number }
  | { type: 'inventory.remove'; itemId: string; quantity: number }
  | { type: 'achievement.unlock'; achievementId: string }
  | { type: 'building.unlock'; buildingId: string }
  | { type: 'district.unlock'; districtId: string };

export type QuestEvent =
  | { id: string; type: 'npc.interacted'; npcId: string; at: number }
  | { id: string; type: 'dialogue.option-selected'; npcId: string; dialogueId: string; optionId: string; at: number }
  | { id: string; type: 'building.visited'; buildingId: string; at: number }
  | { id: string; type: 'location.entered'; locationId: string; at: number }
  | { id: string; type: 'item.acquired'; itemId: string; quantity: number; at: number }
  | { id: string; type: 'puzzle.solved'; puzzleId: string; at: number };

export type QuestObjectiveTarget =
  | { type: 'npc.interacted'; npcId: string }
  | { type: 'dialogue.option-selected'; npcId: string; dialogueId: string; optionId: string }
  | { type: 'building.visited'; buildingId: string }
  | { type: 'location.entered'; locationId: string }
  | { type: 'item.acquired'; itemId: string }
  | { type: 'puzzle.solved'; puzzleId: string };

export interface QuestObjectiveDefinition {
  id: string;
  description: string;
  target: QuestObjectiveTarget;
  required: number;
}

export interface QuestStageDefinition {
  id: string;
  title: string;
  description: string;
  objectives: readonly QuestObjectiveDefinition[];
}

export interface QuestDialogueCopy {
  optionLabel: string;
  text: string;
  confirmLabel: string;
  confirmedText: string;
}

export interface QuestDefinition {
  schemaVersion: 1;
  definitionVersion: number;
  id: QuestId;
  kind: QuestKind;
  title: string;
  summary: string;
  giverNpcId: string;
  receiverNpcId: string;
  prerequisites?: readonly QuestCondition[];
  offer: QuestDialogueCopy;
  completion: QuestDialogueCopy;
  stages: readonly QuestStageDefinition[];
  rewards?: readonly QuestEffect[];
  repeatable: false;
}

export interface QuestProgress {
  questId: QuestId;
  definitionVersion: number;
  status: QuestStatus;
  stageIndex: number;
  objectiveProgress: Record<string, number>;
  acceptedAt: number;
  updatedAt: number;
  completedAt?: number;
}

export interface QuestJournal {
  schemaVersion: 1;
  quests: Record<QuestId, QuestProgress>;
  recentEventIds: string[];
}

export interface QuestProgressView {
  flags: Readonly<Record<string, boolean | number | string | undefined>>;
  inventory: Readonly<Record<string, number | undefined>>;
  achievements: ReadonlySet<string>;
  unlockedBuildings: ReadonlySet<string>;
  unlockedDistricts: ReadonlySet<string>;
}

export interface QuestChange {
  type: 'quest.accepted' | 'objective.advanced' | 'stage.advanced' | 'quest.ready' | 'quest.completed';
  questId: QuestId;
  objectiveId?: string;
  amount?: number;
}

export interface QuestTransition {
  journal: QuestJournal;
  changes: QuestChange[];
  effects: readonly QuestEffect[];
}

export interface NpcQuestAction {
  kind: 'offer' | 'complete';
  quest: QuestDefinition;
}

export interface QuestJournalRepository {
  load(): QuestJournal;
  save(journal: QuestJournal): void;
}

