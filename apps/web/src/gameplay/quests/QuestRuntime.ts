import { acceptQuest, completeQuest, getNpcQuestAction, reduceQuestEvent } from './questEngine';
import { validateQuestCatalog } from './validateQuestCatalog';
import type {
  NpcQuestAction,
  QuestDefinition,
  QuestEvent,
  QuestJournalRepository,
  QuestProgressView,
  QuestTransition,
} from './types';

export class QuestRuntime {
  constructor(
    private readonly definitions: readonly QuestDefinition[],
    private readonly repository: QuestJournalRepository,
  ) {
    validateQuestCatalog(definitions);
  }

  getNpcAction(npcId: string, view: QuestProgressView): NpcQuestAction | null {
    return getNpcQuestAction(this.definitions, this.repository.load(), npcId, view);
  }

  performNpcAction(action: NpcQuestAction, at: number): QuestTransition {
    const transition = action.kind === 'offer'
      ? acceptQuest(action.quest, this.repository.load(), at)
      : completeQuest(action.quest, this.repository.load(), at);
    if (transition.changes.length > 0) this.repository.save(transition.journal);
    return transition;
  }

  dispatch(event: QuestEvent): QuestTransition {
    const current = this.repository.load();
    const transition = reduceQuestEvent(this.definitions, current, event);
    if (transition.journal !== current) this.repository.save(transition.journal);
    return transition;
  }
}

export const EMPTY_QUEST_PROGRESS_VIEW: QuestProgressView = {
  flags: {},
  inventory: {},
  achievements: new Set(),
  unlockedBuildings: new Set(),
  unlockedDistricts: new Set(),
};
