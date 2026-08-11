import { StoryRuntime } from '../../gameplay/stories/StoryRuntime';
import type { StoryDefinition, StoryRepository } from '../../gameplay/stories/types';
import type { CityDialogController } from './cityDialogController';

export function createStoryDialogFlow(definition: StoryDefinition, repository: StoryRepository) {
  const runtime = new StoryRuntime(definition, repository);

  const open = (dialogs: CityDialogController): void => {
    const node = runtime.node();
    const continueChoice = runtime.choices().find((choice) => choice.id.startsWith('continue-'));
    dialogs.openStory({
      title: node.title,
      role: node.role,
      text: node.text,
      variant: node.presentation === 'cg' ? 'cg' : 'story',
      onAdvance: continueChoice ? () => choose(dialogs, continueChoice.id) : undefined,
      options: runtime.choices()
        .filter((choice) => choice !== continueChoice)
        .map((choice) => ({ text: choice.label, onPick: () => choose(dialogs, choice.id) })),
    });
  };

  const choose = (dialogs: CityDialogController, choiceId: string): void => {
    if (runtime.choose(choiceId)) open(dialogs);
  };

  return { open, state: () => runtime.state() };
}
