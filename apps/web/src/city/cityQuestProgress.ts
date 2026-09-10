import type { QuestProgressView } from '../gameplay/quests/types';
import { EMPTY_QUEST_PROGRESS_VIEW } from '../gameplay/quests/QuestRuntime';

export const EMPTY_QUEST_PROGRESS: QuestProgressView = EMPTY_QUEST_PROGRESS_VIEW;

export function readQuestProgressView(
  housing: { progression: { getQuestProgressView: () => QuestProgressView } } | null | undefined,
): QuestProgressView {
  return housing?.progression.getQuestProgressView() ?? EMPTY_QUEST_PROGRESS;
}
