import { StoryRuntime } from '../../gameplay/stories/StoryRuntime';
import type { StoryConditionContext, StoryDefinition, StoryEffect, StoryEvent, StoryRepository } from '../../gameplay/stories/types';
import type { CityDialogController } from './cityDialogController';

export function createStoryDialogFlow(
  definition: StoryDefinition,
  repository: StoryRepository,
  options: {
    getContext?: () => StoryConditionContext;
    onEvent?: (event: StoryEvent) => void;
    onEffects?: (effects: readonly StoryEffect[]) => void;
    onWorldInteractionsChanged?: (interestPointIds: readonly string[]) => void;
    onActiveActorsChanged?: (actorIds: readonly string[]) => void;
  } = {},
) {
  const runtime = new StoryRuntime(definition, repository);
  let announcedGuideState = '';
  let autoAdvanceTimer: ReturnType<typeof setTimeout> | undefined;
  runtime.subscribe((event) => {
    if (event.type === 'story.event') options.onEvent?.(event.event);
    else event.transition.events.forEach((published) => options.onEvent?.(published));
  });

  const announceGuide = (): void => {
    const node = runtime.node();
    const guide = runtime.state().activeGuide;
    const available = runtime.isNodeAvailable(options.getContext?.());
    const guideState = `${node.id}:${available ? 'available' : 'waiting'}`;
    if (announcedGuideState === guideState) return;
    announcedGuideState = guideState;
    if (!guide || !available) {
      runtime.publish('story.guide.cleared', { nodeId: node.id });
      return;
    }
    runtime.publish('story.guide.updated', { title: guide.title, objective: guide.objective, nodeId: node.id });
  };

  const syncWorldInteractions = (): void => {
    const nodeId = runtime.state().nodeId;
    options.onWorldInteractionsChanged?.(definition.worldInteractions?.filter((item) => item.nodeId === nodeId).map((item) => item.interestPointId) ?? []);
  };

  const syncActiveActors = (): void => options.onActiveActorsChanged?.(runtime.node().activeActorIds ?? []);

  const sentences = (text: string): string[] => {
    const matches = text.match(/[^。！？\n]+(?:[。！？]+|$)/g)?.map((line) => line.trim()).filter(Boolean);
    return matches?.length ? matches : [text];
  };

  const open = (dialogs: CityDialogController, sentenceIndex = 0): void => {
    if (autoAdvanceTimer) clearTimeout(autoAdvanceTimer);
    const node = runtime.node();
    announceGuide();
    syncWorldInteractions();
    syncActiveActors();
    const lines = sentences(node.text);
    const index = Math.min(sentenceIndex, lines.length - 1);
    const isLastSentence = index === lines.length - 1;
    const choices = runtime.choices(options.getContext?.());
    const continueChoice = choices.find((choice) => choice.autoAdvance || choice.id.startsWith('continue-'));
    const advance = (): void => {
      if (!isLastSentence) open(dialogs, index + 1);
      else if (continueChoice) choose(dialogs, continueChoice.id);
      else if (node.terminal) dialogs.closeNpc();
    };
    const canAdvance = !isLastSentence || Boolean(continueChoice) || Boolean(node.terminal);
    dialogs.openStory({
      title: node.title,
      role: node.role,
      text: lines[index] ?? '',
      variant: node.presentation === 'blackout' ? 'blackout' : node.presentation === 'cg' ? 'cg' : 'story',
      image: node.image,
      onAdvance: canAdvance ? advance : undefined,
      options: isLastSentence ? choices
        .filter((choice) => choice !== continueChoice && !choice.hidden)
        .map((choice) => ({ text: choice.label, onPick: () => { choose(dialogs, choice.id); } })) : [],
      onClose: () => {
        if (autoAdvanceTimer) clearTimeout(autoAdvanceTimer);
        if ((node.presentation === 'cg' || node.presentation === 'blackout') && continueChoice) setTimeout(() => { choose(dialogs, continueChoice.id); }, 0);
      },
    });
    if ((node.presentation === 'cg' || node.presentation === 'blackout') && canAdvance) {
      const delay = Math.min(5200, Math.max(2200, 1200 + (lines[index]?.length ?? 0) * 100));
      autoAdvanceTimer = setTimeout(advance, delay);
    }
  };

  const choose = (dialogs: CityDialogController, choiceId: string): boolean => {
    const transition = runtime.choose(choiceId, Date.now(), options.getContext?.());
    if (!transition) return false;
    options.onEffects?.(transition.effects);
    if (transition.node.interactionOnly) {
      announceGuide();
      syncWorldInteractions();
      syncActiveActors();
      dialogs.closeNpc();
      return true;
    }
    open(dialogs);
    return true;
  };

  const interact = (actorId: string, dialogs: CityDialogController): boolean => {
    const context = options.getContext?.();
    const interaction = definition.interactions?.find((item) => item.actorId === actorId && item.nodeId === runtime.state().nodeId);
    if (interaction) return choose(dialogs, interaction.choiceId);
    if (definition.entryActorId !== actorId) return false;
    const nodeChoices = runtime.node().choices ?? [];
    if (nodeChoices.length > 0 && runtime.choices(context).length === 0) return false;
    open(dialogs);
    return true;
  };

  const interactInterestPoint = (interestPointId: string, dialogs: CityDialogController): boolean => {
    const interaction = definition.worldInteractions?.find((item) => item.interestPointId === interestPointId && item.nodeId === runtime.state().nodeId);
    if (!interaction) return false;
    return choose(dialogs, interaction.choiceId);
  };

  const interactBuilding = (buildingId: string, dialogs: CityDialogController): boolean => {
    const interaction = definition.buildingInteractions?.find((item) => item.buildingId === buildingId && item.nodeId === runtime.state().nodeId);
    if (!interaction) return false;
    return choose(dialogs, interaction.choiceId);
  };

  return { open, choose, interact, interactBuilding, interactInterestPoint, state: () => runtime.state(), announceGuide, syncWorldInteractions, syncActiveActors };
}
