import type { StoryConditionContext, StoryDefinition, StoryEvent } from '../../gameplay/stories/types';
import { LocalStorageStoryRepository } from '../../adapters/storage/stories/LocalStorageStoryRepository';
import { createStoryDialogFlow } from '../../adapters/ui/stories/storyDialogFlow';
import type { CityDialogController } from '../../adapters/ui/cityDialogController';
import { REDDOT_STORY } from '../../gameplay/content/stories/reddot/reddotStory';
import { SINGLESTEP_STORY } from '../../gameplay/content/stories/singlestep/singlestepStory';
import { PROOFREAD_STORY } from '../../gameplay/content/stories/proofread/proofreadStory';
import { RECRUIT_STORY } from '../../gameplay/content/stories/recruit/recruitStory';
import { DUC_STORY } from '../../gameplay/content/stories/duc/ducStory';
import { YOUXUEPAI_STORY } from '../../gameplay/content/stories/youxuepai/youxuepaiStory';
import { DIAN_STORY } from '../../gameplay/content/stories/dian/dianStory';
import { ORCA_STORY } from '../../gameplay/content/stories/orca/orcaStory';
import { LETTER_STORY } from '../../gameplay/content/stories/letter/letterStory';
import { HUMAN_STORY } from '../../gameplay/content/stories/human/humanStory';
import { BEAUTY_STORY } from '../../gameplay/content/stories/beauty/beautyStory';
import { ZILAN_STORY } from '../../gameplay/content/stories/zilan/zilanStory';
import { BIRCH_STORY } from '../../gameplay/content/stories/birch/birchStory';
import { DEMOCRACY_STORY } from '../../gameplay/content/stories/democracy/democracyStory';
import { CITYIN_STORY } from '../../gameplay/content/stories/cityin/cityinStory';
import { FUKUSHIMA_STORY } from '../../gameplay/content/stories/fukushima/fukushimaStory';
import { WANDERING_STORY } from '../../gameplay/content/stories/wandering/wanderingStory';
import { TOUR_STORY } from '../../gameplay/content/stories/tour/tourStory';
import { YOUTH_STORY } from '../../gameplay/content/stories/youth/youthStory';
import { LIBERATION_STORY } from '../../gameplay/content/stories/liberation/liberationStory';
import { WEEKLY_STORY } from '../../gameplay/content/stories/weekly/weeklyStory';
import { HUIGUI_STORY } from '../../gameplay/content/stories/huigui/huiguiStory';
import { REVERBERATE_STORY } from '../../gameplay/content/stories/reverberate/reverberateStory';
import { ASKWAY_STORY } from '../../gameplay/content/stories/askway/askwayStory';

export type SideStoryControllerOptions = {
  awardAchievement?: (achievementId: string, name: string) => void;
  showToast?: (message: string) => void;
  getQuestContext?: () => StoryConditionContext;
  onActiveActorsChanged?: (actorIds: readonly string[]) => void;
};

/**
 * 通用支线剧情控制器：内容由 StoryDefinition 声明，成就统一走
 * `story.achievement` 事件（payload: { id, name }）。新增剧情只需
 * 在下方派生一个工厂函数，无需复制交互流程代码。
 */
export function createSideStoryController(definition: StoryDefinition, options: SideStoryControllerOptions) {
  const repository = new LocalStorageStoryRepository(definition);
  const flow = createStoryDialogFlow(definition, repository, {
    getContext: options.getQuestContext,
    onEvent: (event: StoryEvent) => {
      if (event.type !== 'story.achievement') return;
      const id = event.payload?.id;
      const name = event.payload?.name;
      if (typeof id === 'string' && typeof name === 'string') options.awardAchievement?.(id, name);
    },
    onActiveActorsChanged: (actorIds: readonly string[]) => {
      options.onActiveActorsChanged?.(actorIds);
    },
  });

  function interactBuilding(buildingId: string, dialogs: CityDialogController): boolean {
    return flow.interactBuilding(buildingId, dialogs);
  }

  function interactNpc(npcId: string, dialogs: CityDialogController): boolean {
    return flow.interact(npcId, dialogs);
  }

  function announceGuide(): void {
    flow.announceGuide();
  }

  function syncActiveActors(): void {
    flow.syncActiveActors();
  }

  function state() {
    return flow.state();
  }

  function dispose(): void {
    // LocalStorageStoryRepository 自动持久化，无需额外清理
  }

  return {
    story: flow,
    interactBuilding,
    interactNpc,
    announceGuide,
    syncActiveActors,
    state,
    phase: () => flow.phase(),
    ownsEntry: flow.ownsEntry,
    dispose,
  };
}

export function createReddotStoryController(options: SideStoryControllerOptions) {
  return createSideStoryController(REDDOT_STORY, options);
}

export function createSinglestepStoryController(options: SideStoryControllerOptions) {
  return createSideStoryController(SINGLESTEP_STORY, options);
}

export function createProofreadStoryController(options: SideStoryControllerOptions) {
  return createSideStoryController(PROOFREAD_STORY, options);
}

export function createRecruitStoryController(options: SideStoryControllerOptions) {
  return createSideStoryController(RECRUIT_STORY, options);
}

export function createDucStoryController(options: SideStoryControllerOptions) {
  return createSideStoryController(DUC_STORY, options);
}

export function createYouxuepaiStoryController(options: SideStoryControllerOptions) {
  return createSideStoryController(YOUXUEPAI_STORY, options);
}

export function createDianStoryController(options: SideStoryControllerOptions) {
  return createSideStoryController(DIAN_STORY, options);
}

export function createOrcaStoryController(options: SideStoryControllerOptions) {
  return createSideStoryController(ORCA_STORY, options);
}

export function createLetterStoryController(options: SideStoryControllerOptions) {
  return createSideStoryController(LETTER_STORY, options);
}

export function createHumanStoryController(options: SideStoryControllerOptions) {
  return createSideStoryController(HUMAN_STORY, options);
}

export function createBeautyStoryController(options: SideStoryControllerOptions) {
  return createSideStoryController(BEAUTY_STORY, options);
}

export function createZilanStoryController(options: SideStoryControllerOptions) {
  return createSideStoryController(ZILAN_STORY, options);
}

export function createBirchStoryController(options: SideStoryControllerOptions) {
  return createSideStoryController(BIRCH_STORY, options);
}

export function createDemocracyStoryController(options: SideStoryControllerOptions) {
  return createSideStoryController(DEMOCRACY_STORY, options);
}

export function createCityinStoryController(options: SideStoryControllerOptions) {
  return createSideStoryController(CITYIN_STORY, options);
}

export function createFukushimaStoryController(options: SideStoryControllerOptions) {
  return createSideStoryController(FUKUSHIMA_STORY, options);
}

export function createWanderingStoryController(options: SideStoryControllerOptions) {
  return createSideStoryController(WANDERING_STORY, options);
}

export function createTourStoryController(options: SideStoryControllerOptions) {
  return createSideStoryController(TOUR_STORY, options);
}

export function createYouthStoryController(options: SideStoryControllerOptions) {
  return createSideStoryController(YOUTH_STORY, options);
}

export function createLiberationStoryController(options: SideStoryControllerOptions) {
  return createSideStoryController(LIBERATION_STORY, options);
}

export function createWeeklyStoryController(options: SideStoryControllerOptions) {
  return createSideStoryController(WEEKLY_STORY, options);
}

export function createHuiguiStoryController(options: SideStoryControllerOptions) {
  return createSideStoryController(HUIGUI_STORY, options);
}

export function createReverberateStoryController(options: SideStoryControllerOptions) {
  return createSideStoryController(REVERBERATE_STORY, options);
}

export function createAskwayStoryController(options: SideStoryControllerOptions) {
  return createSideStoryController(ASKWAY_STORY, options);
}
