import { StoryRuntime, createInitialStoryState, getStoryBuildingState, getStoryEventCount } from '../../src/gameplay/stories/StoryRuntime';
import type { StoryDefinition, StoryState } from '../../src/gameplay/stories/types';

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

const definition: StoryDefinition = {
  schemaVersion: 1,
  definitionVersion: 1,
  id: 'main.blackout',
  title: 'Blackout',
  startNode: 'waiting',
  triggerWhen: [{ type: 'event.occurred', eventType: 'grid.power-restored' }],
  nodes: {
    waiting: {
      id: 'waiting', title: 'Waiting', text: 'The district is dark.',
      choices: [{
        id: 'reroute', label: 'Reroute power', next: 'restored',
        availableWhen: [{ type: 'inventory.count', itemId: 'fuse', atLeast: 1 }],
        effects: [
          { type: 'event.publish', eventType: 'grid.power-restored', payload: { district: 'north' } },
          { type: 'building.state.set', buildingId: 'observatory', state: 'restored' },
        ],
      }],
    },
    restored: { id: 'restored', title: 'Restored', text: 'The lights return.', terminal: true },
  },
};

let stored: StoryState | null = createInitialStoryState(definition, 1);
const runtime = new StoryRuntime(definition, {
  get: () => stored,
  update: (_storyId, patch) => {
    stored = {
      ...stored!,
      ...patch,
      flags: patch.flags ?? stored!.flags,
      visitCount: stored!.visitCount + (patch.visit ? 1 : 0),
      activeGuide:
        patch.activeGuide === null
          ? undefined
          : patch.activeGuide ?? stored!.activeGuide,
      updatedAt: 2,
    };
    return stored;
  },
});

assert(!runtime.canTrigger(), 'story should stay locked until its trigger event occurs');
assert(runtime.choices().length === 0, 'choice conditions should hide unavailable options');

const observed: string[] = [];
runtime.subscribe((event) => observed.push(event.type));
const transition = runtime.choose('reroute', 10, { inventory: { fuse: 1 } });
assert(transition, 'eligible choice should advance the story');
assert(transition.events[0]?.type === 'grid.power-restored', 'choice should publish its declared event');
assert(getStoryEventCount(transition.state, 'grid.power-restored') === 1, 'published event count should be persisted');
assert(getStoryBuildingState(transition.state, 'observatory') === 'restored', 'building state effect should be persisted');
assert(runtime.canTrigger(), 'published event should satisfy story trigger conditions');
assert(observed[0] === 'story.choice', 'subscribers should receive choice transitions');

runtime.publish('grid.power-restored', { district: 'south' }, 11);
assert(getStoryEventCount(stored!, 'grid.power-restored') === 2, 'external events should be publishable and persisted');
assert(observed[1] === 'story.event', 'subscribers should receive externally published events');

const delayedDefinition: StoryDefinition = {
  schemaVersion: 1,
  definitionVersion: 1,
  id: 'main.daily-visits',
  title: 'Daily visits',
  startNode: 'visit',
  nodes: {
    visit: {
      id: 'visit', title: 'Visit', text: 'First visit.', guide: { title: 'Daily visit', objective: 'Visit today' },
      choices: [{ id: 'finish', label: 'Finish', next: 'waiting' }],
    },
    waiting: {
      id: 'waiting', title: 'Waiting', text: 'Come back tomorrow.', interactionOnly: true, unlockAfterGameDays: 1,
      choices: [{ id: 'return', label: 'Return', next: 'complete' }],
    },
    complete: { id: 'complete', title: 'Complete', text: 'Welcome back.', terminal: true, guide: null },
  },
};

let delayedState: StoryState | null = createInitialStoryState(delayedDefinition, 1);
const delayedRuntime = new StoryRuntime(delayedDefinition, {
  get: () => delayedState,
  update: (_storyId, patch) => {
    delayedState = {
      ...delayedState!, ...patch,
      flags: patch.flags ?? delayedState!.flags,
      visitCount: delayedState!.visitCount + (patch.visit ? 1 : 0),
      activeGuide: patch.activeGuide === null ? undefined : patch.activeGuide ?? delayedState!.activeGuide,
      updatedAt: 2,
    };
    return delayedState;
  },
});

assert(delayedRuntime.choose('finish', 2, { gameDay: 12 }), 'finishing a visit should enter its waiting node');
assert(delayedRuntime.state().activeGuide?.title === 'Daily visit', 'a node without guide copy should inherit the previous guide');
assert(!delayedRuntime.isNodeAvailable({ gameDay: 12 }), 'the next visit should stay locked on the same game day');
assert(delayedRuntime.choices({ gameDay: 12 }).length === 0, 'waiting-node choices should be hidden until another game day');
assert(delayedRuntime.isNodeAvailable({ gameDay: 13 }), 'the next visit should unlock after the game day changes');
assert(delayedRuntime.choose('return', 3, { gameDay: 13 }), 'the unlocked visit should advance normally');
assert(delayedRuntime.state().activeGuide === undefined, 'guide: null should explicitly clear the inherited guide');
