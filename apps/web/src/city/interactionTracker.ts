import type * as THREE from 'three';
import { SIDE_QUESTS } from '../gameplay/content/quests/sideQuests';
import type { QuestChange, QuestEvent, QuestTransition } from '../gameplay/quests/types';
import type { LegacyStats } from './progression/legacyStats';
import { showUnlockToast } from './toast';

export type InteractionTrackerOptions = {
  getStats: () => LegacyStats;
  saveStats: (stats: LegacyStats) => void;
  checkAchievements: () => void;
  updateWelcome: () => void;
  getProgressionController: () => { checkUnlocks: (stats: LegacyStats) => void } | null;
  getQuestRuntime: () => { dispatch: (event: QuestEvent) => QuestTransition };
  getEchoStoryController: () => { updateGuide: (camera: THREE.Camera) => void } | null;
  getCamera: () => THREE.Camera;
  getQuestEventSequence: () => number;
  incrementQuestEventSequence: () => void;
  getCursorChar: () => { visible?: boolean } | null;
};

export function createInteractionTracker(options: InteractionTrackerOptions) {
  function trackInteraction(buildingId: string) {
    const s = options.getStats();
    s.interactions++;
    if (buildingId && !s.buildingsVisited.includes(buildingId)) s.buildingsVisited.push(buildingId);
    options.saveStats(s);
    options.updateWelcome();
    options.getProgressionController()?.checkUnlocks(s);
    options.checkAchievements();
    const transition = options.getQuestRuntime().dispatch({
      id: `building:${buildingId}:${Date.now()}:${options.getQuestEventSequence()}`,
      type: 'building.visited',
      buildingId,
      at: Date.now(),
    });
    options.incrementQuestEventSequence();
    options.getEchoStoryController()?.updateGuide(options.getCamera());
    const ready = transition.changes.find((change: QuestChange) => change.type === 'quest.ready');
    if (ready) {
      const quest = SIDE_QUESTS.find(item => item.id === ready.questId);
      if (quest) showUnlockToast(`任务可交付 · ${quest.title}`);
    }
  }

  function recordNpcInteraction(npcId: string) {
    const stats = options.getStats();
    stats.npcsTalked = (stats.npcsTalked || 0) + 1;
    if (!stats.npcsMet) stats.npcsMet = [];
    if (!stats.npcsMet.includes(npcId)) stats.npcsMet.push(npcId);
    options.saveStats(stats);
    options.checkAchievements();
    const at = Date.now();
    options.getQuestRuntime().dispatch({
      id: `npc:${npcId}:${at}:${options.getQuestEventSequence()}`,
      type: 'npc.interacted',
      npcId,
      at,
    });
    options.incrementQuestEventSequence();
  }

  function flushDistance(amount: number) {
    if (!options.getCursorChar() || amount <= 0) return;
    const s = options.getStats();
    s.distance = (s.distance || 0) + amount;
    options.saveStats(s);
    options.checkAchievements();
  }

  return { trackInteraction, recordNpcInteraction, flushDistance };
}
