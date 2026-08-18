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

const conditionalGuideDefinition: StoryDefinition = {
  schemaVersion: 1,
  definitionVersion: 1,
  id: 'guide.after-interaction',
  title: 'Conditional guide',
  startNode: 'meeting',
  nodes: {
    meeting: {
      id: 'meeting',
      text: 'Hello.',
      guide: {
        title: 'Continue the story',
        objective: 'Talk to Lin',
        visibleWhen: [{ type: 'event.occurred', eventType: 'story.actor.interacted.linche' }],
      },
    },
  },
};
let conditionalGuideState: StoryState | null = createInitialStoryState(conditionalGuideDefinition, 1);
const conditionalGuideRuntime = new StoryRuntime(conditionalGuideDefinition, {
  get: () => conditionalGuideState,
  update: (_storyId, patch) => {
    conditionalGuideState = {
      ...conditionalGuideState!,
      ...patch,
      activeGuide: patch.activeGuide === null ? undefined : patch.activeGuide ?? conditionalGuideState!.activeGuide,
      updatedAt: 2,
    };
    return conditionalGuideState;
  },
});
assert(!conditionalGuideRuntime.isGuideVisible(), 'guide should stay hidden before its visibility condition');
conditionalGuideRuntime.publish('story.actor.interacted.linche', undefined, 2);
assert(conditionalGuideRuntime.isGuideVisible(), 'guide should appear after its visibility condition');
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

// Checkpoint (savepoint) behavior: a node marked `savepoint: false` is a
// transient beat. The live node advances so the player sees it, but the
// persisted resumption node stays at the last savepoint and flags still
// persist so condition-gated progress survives a reload.
const checkpointDefinition: StoryDefinition = {
  schemaVersion: 1,
  definitionVersion: 1,
  id: 'main.checkpoint',
  title: 'Checkpoint',
  startNode: 'hub',
  nodes: {
    hub: { id: 'hub', text: 'Hub.', choices: [{ id: 'go', label: 'Go', next: 'transient', effects: [{ type: 'flag.set', flagId: 'hubSeen', value: true }] }] },
    transient: {
      id: 'transient', savepoint: false, text: 'Passing through.',
      choices: [{ id: 'mark', label: 'Mark', next: 'rest', effects: [{ type: 'flag.set', flagId: 'transientSeen', value: true }] }],
    },
    rest: { id: 'rest', terminal: true, text: 'Rest.' },
  },
};
let checkpointState: StoryState | null = createInitialStoryState(checkpointDefinition, 1);
let persistedNodeId: string = checkpointState!.nodeId;
const checkpointRuntime = new StoryRuntime(checkpointDefinition, {
  get: () => checkpointState,
  update: (_storyId, patch) => {
    persistedNodeId = (patch.nodeId ?? persistedNodeId) as string;
    checkpointState = {
      ...checkpointState!, ...patch,
      flags: patch.flags ?? checkpointState!.flags,
      activeGuide: patch.activeGuide === null ? undefined : patch.activeGuide ?? checkpointState!.activeGuide,
      updatedAt: 4,
    };
    return checkpointState;
  },
});
const equals = (a: string, b: string): boolean => a === b;
const goTransition = checkpointRuntime.choose('go', 4);
assert(goTransition, 'choosing into a transient beat should still advance the live node');
assert(goTransition!.resumptionNodeId === 'hub', 'a transient beat transition must expose the savepoint as resumptionNodeId');
assert(checkpointRuntime.state().nodeId === 'transient', 'the live node should reflect the transient beat');
assert(equals(persistedNodeId, 'hub'), 'a transient beat must not overwrite the persisted savepoint node');
assert(getStoryEventCount(checkpointState!, 'hubSeen') === 0, 'flags use flag.set, not event counts');
assert(checkpointState!.flags['hubSeen'] === true, 'flags set before entering a transient beat should persist');
const markTransition = checkpointRuntime.choose('mark', 5);
assert(markTransition, 'choosing out of a transient beat into a savepoint should persist');
assert(markTransition!.resumptionNodeId === 'rest', 'a savepoint transition must expose the savepoint as resumptionNodeId');
assert(equals(persistedNodeId, 'rest'), 'reaching a savepoint node should update the persisted resumption node');
assert(checkpointRuntime.state().nodeId === 'rest', 'the live node should follow the savepoint after it is reached');
assert(checkpointState!.flags['transientSeen'] === true, 'flags set on a transient beat should still persist');

// A chain of consecutive transient beats must keep the resumption node pinned
// to the last savepoint (not drift forward to an intermediate transient node).
const chainDefinition: StoryDefinition = {
  schemaVersion: 1,
  definitionVersion: 1,
  id: 'main.chain',
  title: 'Chain',
  startNode: 'anchor',
  nodes: {
    anchor: { id: 'anchor', text: 'Anchor.', choices: [{ id: 'a1', label: 'Go', next: 't1' }] },
    t1: { id: 't1', savepoint: false, text: 'T1.', choices: [{ id: 'a2', label: 'Go', next: 't2' }] },
    t2: { id: 't2', savepoint: false, text: 'T2.', choices: [{ id: 'a3', label: 'Go', next: 't3' }] },
    t3: { id: 't3', savepoint: false, text: 'T3.', choices: [{ id: 'a4', label: 'Go', next: 'final' }] },
    final: { id: 'final', terminal: true, text: 'Final.' },
  },
};
let chainState: StoryState | null = createInitialStoryState(chainDefinition, 1);
let chainPersisted: string = chainState!.nodeId;
const chainRuntime = new StoryRuntime(chainDefinition, {
  get: () => chainState,
  update: (_storyId, patch) => {
    chainPersisted = (patch.nodeId ?? chainPersisted) as string;
    chainState = {
      ...chainState!, ...patch,
      flags: patch.flags ?? chainState!.flags,
      activeGuide: patch.activeGuide === null ? undefined : patch.activeGuide ?? chainState!.activeGuide,
      updatedAt: 6,
    };
    return chainState;
  },
});
assert(chainRuntime.choose('a1', 6), 'entering a transient chain should advance');
assert(chainRuntime.choose('a2', 7), 'advancing within a transient chain should advance');
assert(chainRuntime.choose('a3', 8), 'advancing within a transient chain should advance');
assert(chainRuntime.state().nodeId === 't3', 'the live node should be the latest transient beat');
assert(equals(chainPersisted, 'anchor'), 'a transient chain must keep the resumption node pinned to the last savepoint');
assert(chainRuntime.choose('a4', 9), 'reaching the final savepoint should advance');
assert(equals(chainPersisted, 'final'), 'reaching a savepoint at the end of a transient chain should update the resumption node');
