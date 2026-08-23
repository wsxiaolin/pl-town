import { StoryRuntime } from '../../gameplay/stories/StoryRuntime';
import {
  ICE_KING_REWARDS,
  type IceKingRewardId,
  type IceSanctumEnding,
  type IceSanctumReturnWeather,
} from '../../gameplay/content/stories/iceKing/iceKingContent';
import {
  ICE_SANCTUM_CHOICES,
  ICE_SANCTUM_NODES,
  ICE_SANCTUM_STORY,
  ICE_SANCTUM_TIMINGS_MS,
} from '../../gameplay/content/stories/iceKing/iceSanctumStory';
import { createInteriorNavigation, type InteriorNavigation } from '../navigation/interiorNavigation';
import type {
  IceSanctumCursor,
  IceSanctumDialogPort,
  IceSanctumPresentationPort,
  IceSanctumProgressStore,
  IceSanctumScenePort,
  IceSanctumStoryRepository,
} from './iceSanctumPorts';

export type IceSanctumControllerOptions = {
  scene: IceSanctumScenePort;
  presentation: IceSanctumPresentationPort;
  progress: IceSanctumProgressStore;
  getCursor: () => IceSanctumCursor | null;
  dialogs: () => IceSanctumDialogPort | null;
  nextRewardClaimSequence: (rewardId: IceKingRewardId) => number | null;
  claimReward: (rewardId: IceKingRewardId, claimSequence: number) => Promise<boolean>;
  onEnter: () => void;
  onEnterUnavailable: () => void;
  onProgressFailure: () => void;
  onRewardFailure: () => void;
  onReturn: (weather: IceSanctumReturnWeather) => void;
};

const DIALOG_PRESENTATION = Object.freeze({
  typewriter: true as const,
  optionStaggerMs: 180,
  selectionDelayMs: 1_000,
});

export function createIceSanctumController(options: IceSanctumControllerOptions) {
  let navigation: InteriorNavigation | null = null;
  let repository: IceSanctumStoryRepository | null = null;
  let runtime: StoryRuntime | null = null;
  let active = false;
  let finishing = false;

  function buildNavigation(): void {
    navigation = createInteriorNavigation({ getInterior: () => options.scene.root, fallbackBounds: options.scene.walkBounds });
    navigation.refresh();
  }

  function enter(): boolean {
    const cursor = options.getCursor();
    if (!cursor) { options.onEnterUnavailable(); return false; }
    if (active || options.progress.hasCompleted()) return false;
    try {
      repository = options.progress.openSession();
      runtime = new StoryRuntime(ICE_SANCTUM_STORY, repository);
    } catch {
      options.onProgressFailure();
      return false;
    }
    if (!navigation) buildNavigation();
    active = true;
    finishing = false;
    options.onEnter();
    options.scene.activate(cursor);
    cursor.position.copy(navigation?.clampToWalkable(cursor.position) ?? cursor.position);
    options.dialogs()?.close();
    const pending = repository.pendingReward();
    options.presentation.enter(!pending);
    if (pending) void options.presentation.returnThroughBlackout(() => finishPendingReward(pending.ending, pending.claimSequence));
    return true;
  }

  function showCurrentNode(): void {
    if (!active || !runtime) return;
    const node = runtime.node();
    const choices = runtime.choices().filter((choice) => !choice.hidden);
    options.dialogs()?.openStory({
      title: node.title,
      role: node.role,
      text: node.text,
      variant: node.presentation === 'blackout' ? 'blackout' : 'story',
      options: choices.map((choice) => ({ text: choice.label, onPick: () => choose(choice.id) })),
      presentation: DIALOG_PRESENTATION,
    });
  }

  function choose(choiceId: string): void {
    if (!active || !runtime || finishing) return;
    if (runtime.node().id === ICE_SANCTUM_NODES.afterGift && choiceId === ICE_SANCTUM_CHOICES.receiveGift) {
      finishing = true;
      options.presentation.schedule(() => void prepareAndFinish('accept'), ICE_SANCTUM_TIMINGS_MS.finishAccept);
      return;
    }
    try {
      const transition = runtime.choose(choiceId);
      if (!transition) return;
      showCurrentNode();
      scheduleCurrentNode(transition.node.id);
    } catch {
      options.onProgressFailure();
    }
  }

  function scheduleCurrentNode(nodeId: string): void {
    if (nodeId === ICE_SANCTUM_NODES.rejectResponse) {
      finishing = true;
      options.presentation.schedule(() => void prepareAndFinish('reject'), ICE_SANCTUM_TIMINGS_MS.rejectReturn);
    }
    if (nodeId === ICE_SANCTUM_NODES.acceptResponse) {
      options.presentation.schedule(() => choose(ICE_SANCTUM_CHOICES.toBlackout), ICE_SANCTUM_TIMINGS_MS.acceptBlackout);
    }
    if (nodeId === ICE_SANCTUM_NODES.timeSkipBlackout) {
      options.presentation.schedule(() => choose(ICE_SANCTUM_CHOICES.toCaption), ICE_SANCTUM_TIMINGS_MS.acceptTimeSkip);
    }
    if (nodeId === ICE_SANCTUM_NODES.timeSkipCaption) {
      options.presentation.schedule(() => {
        options.presentation.fadeOutTimeSkipBlackout();
        choose(ICE_SANCTUM_CHOICES.resumeAudience);
      }, ICE_SANCTUM_TIMINGS_MS.acceptResume);
    }
  }

  async function prepareAndFinish(ending: IceSanctumEnding): Promise<void> {
    const reward = ICE_KING_REWARDS[ending];
    const claimSequence = options.nextRewardClaimSequence(reward.id);
    if (!repository || claimSequence === null) {
      finishExit(ending, false);
      return;
    }
    await options.presentation.returnThroughBlackout(async () => {
      try {
        repository?.prepareReward(ending, claimSequence);
        if (repository) runtime = new StoryRuntime(ICE_SANCTUM_STORY, repository);
      }
      catch {
        options.onProgressFailure();
        finishExit(ending, false, false);
        return;
      }
      await finishPendingReward(ending, claimSequence);
    });
  }

  async function finishPendingReward(ending: IceSanctumEnding, claimSequence: number): Promise<void> {
    const reward = ICE_KING_REWARDS[ending];
    const rewardConfirmed = await options.claimReward(reward.id, claimSequence).catch(() => false);
    let completed = false;
    if (rewardConfirmed && runtime) {
      try { completed = Boolean(runtime.choose(ICE_SANCTUM_CHOICES.completeReward)); }
      catch { options.onProgressFailure(); }
    }
    finishExit(ending, rewardConfirmed && completed);
  }

  function finishExit(ending: IceSanctumEnding, completed: boolean, notifyRewardFailure = true): void {
    options.dialogs()?.close();
    options.presentation.leave();
    active = false;
    finishing = false;
    options.scene.deactivate();
    const cursor = options.getCursor();
    if (cursor) cursor.position.copy(options.scene.exitPosition());
    options.onReturn(ICE_KING_REWARDS[ending].weather);
    if (!completed && notifyRewardFailure) options.onRewardFailure();
  }

  function interactNpc(): boolean {
    if (!active || finishing || options.presentation.isCinematic() || repository?.pendingReward()) return false;
    showCurrentNode();
    return true;
  }

  function dispose(): void {
    active = false;
    finishing = false;
    repository = null;
    runtime = null;
    options.presentation.dispose();
    options.scene.dispose();
  }

  return {
    root: options.scene.root,
    enter,
    selectChoice: choose,
    interactNpc,
    npcMesh: options.scene.npcMesh,
    npcHitMesh: options.scene.npcHitMesh,
    npcWorldPosition: options.scene.npcWorldPosition,
    interactionPosition: options.scene.interactionPosition,
    hasEntered: () => options.progress.hasCompleted(),
    isActive: () => active,
    isCinematic: options.presentation.isCinematic,
    isMovementLocked: options.presentation.isCinematic,
    isInteractionLocked: options.presentation.isCinematic,
    navigation: () => navigation,
    center: options.scene.center,
    dispose,
  };
}
