import type {
  StoryBuildingState,
  StoryChoice,
  StoryCondition,
  StoryConditionContext,
  StoryDefinition,
  StoryEffect,
  StoryEvent,
  StoryEventPayload,
  StoryRepository,
  StoryRuntimeEvent,
  StoryState,
  StoryTransition,
} from './types';

const EVENT_FLAG_PREFIX = '$event:';
const BUILDING_FLAG_PREFIX = '$building:';

function eventFlag(eventType: string): string { return `${EVENT_FLAG_PREFIX}${eventType}`; }
function buildingFlag(buildingId: string): string { return `${BUILDING_FLAG_PREFIX}${buildingId}`; }

export function getStoryEventCount(state: StoryState, eventType: string): number {
  const value = state.flags[eventFlag(eventType)];
  return typeof value === 'number' && Number.isFinite(value) ? Math.max(0, value) : 0;
}

export function getStoryBuildingState(state: StoryState, buildingId: string): StoryBuildingState {
  const value = state.flags[buildingFlag(buildingId)];
  return value === 'hidden' || value === 'disabled' || value === 'damaged' || value === 'restored'
    ? value
    : 'default';
}

export function storyConditionMatches(
  condition: StoryCondition,
  state: StoryState,
  context: StoryConditionContext = {},
): boolean {
  switch (condition.type) {
    case 'flag.equals': return state.flags[condition.flagId] === condition.value;
    case 'event.occurred': return getStoryEventCount(state, condition.eventType) >= (condition.atLeast ?? 1);
    case 'building.state': return getStoryBuildingState(state, condition.buildingId) === condition.state;
    case 'inventory.count': return (context.inventory?.[condition.itemId] ?? 0) >= condition.atLeast;
    case 'achievement.unlocked': return context.achievements?.has(condition.achievementId) ?? false;
  }
}

function conditionsMatch(conditions: readonly StoryCondition[] | undefined, state: StoryState, context: StoryConditionContext): boolean {
  return (conditions ?? []).every((condition) => storyConditionMatches(condition, state, context));
}

function applyEffects(
  state: StoryState,
  effects: readonly StoryEffect[],
  at: number,
): { flags: Record<string, StoryState['flags'][string]>; events: StoryEvent[] } {
  const flags = { ...state.flags };
  const events: StoryEvent[] = [];
  effects.forEach((effect, index) => {
    if (effect.type === 'flag.set') flags[effect.flagId] = effect.value;
    if (effect.type === 'building.state.set') flags[buildingFlag(effect.buildingId)] = effect.state;
    if (effect.type === 'event.publish') {
      flags[eventFlag(effect.eventType)] = getStoryEventCount({ ...state, flags }, effect.eventType) + 1;
      events.push({ id: `${state.storyId}:${effect.eventType}:${at}:${index}`, type: effect.eventType, at, payload: effect.payload });
    }
  });
  return { flags, events };
}

export function createInitialStoryState(definition: StoryDefinition, now = Date.now()): StoryState {
  const startGuide = definition.nodes[definition.startNode]?.guide;
  return {
    storyId: definition.id,
    definitionVersion: definition.definitionVersion,
    nodeId: definition.startNode,
    flags: {},
    visitCount: 0,
    activeGuide: startGuide && typeof startGuide === 'object' ? startGuide : undefined,
    updatedAt: now,
  };
}

export class StoryRuntime {
  private readonly listeners = new Set<(event: StoryRuntimeEvent) => void>();

  constructor(
    private readonly definition: StoryDefinition,
    private readonly repository: StoryRepository,
  ) {}

  state(): StoryState {
    return this.repository.get(this.definition.id) ?? createInitialStoryState(this.definition);
  }

  node(): StoryDefinition['nodes'][string] {
    const node = this.definition.nodes[this.state().nodeId] ?? this.definition.nodes[this.definition.startNode];
    if (!node) throw new Error(`Story ${this.definition.id} has no start node`);
    return node;
  }

  canTrigger(context: StoryConditionContext = {}): boolean {
    return conditionsMatch(this.definition.triggerWhen, this.state(), context);
  }

  choices(context: StoryConditionContext = {}): readonly StoryChoice[] {
    const state = this.state();
    if (!this.isNodeAvailable(context)) return [];
    return (this.node().choices ?? []).filter((choice) => conditionsMatch(choice.availableWhen, state, context));
  }

  isNodeAvailable(context: StoryConditionContext = {}): boolean {
    const state = this.state();
    const delay = this.node().unlockAfterGameDays ?? 0;
    if (delay <= 0) return true;
    if (context.gameDay === undefined || state.nodeEnteredGameDay === undefined) return false;
    return context.gameDay >= state.nodeEnteredGameDay + delay;
  }

  isGuideVisible(context: StoryConditionContext = {}): boolean {
    const guide = this.state().activeGuide;
    return Boolean(guide) && conditionsMatch(guide?.visibleWhen, this.state(), context);
  }

  choose(choiceId: string, now = Date.now(), context: StoryConditionContext = {}): StoryTransition | null {
    const state = this.state();
    const node = this.definition.nodes[state.nodeId];
    const choice = node?.choices?.find((item) => item.id === choiceId);
    if (!node || !choice || !this.definition.nodes[choice.next] || !this.isNodeAvailable(context) || !conditionsMatch(choice.availableWhen, state, context)) return null;
    const legacyEffects: StoryEffect[] = Object.entries(choice.set ?? {}).map(([flagId, value]) => ({ type: 'flag.set', flagId, value }));
    const effects = [...legacyEffects, ...(choice.effects ?? [])];
    const applied = applyEffects(state, effects, now);
    const flags = applied.flags;
    const declaredGuide = this.definition.nodes[choice.next]!.guide;
    const activeGuide = declaredGuide === null ? null : declaredGuide ?? state.activeGuide;
    const next = this.repository.update(this.definition.id, {
      nodeId: choice.next,
      flags,
      ending: choice.ending,
      visit: choice.visit,
      nodeEnteredGameDay: context.gameDay,
      activeGuide,
    }) ?? {
      ...state,
      nodeId: choice.next,
      flags,
      ending: choice.ending ?? state.ending,
      visitCount: state.visitCount + (choice.visit ? 1 : 0),
      nodeEnteredGameDay: context.gameDay,
      activeGuide: activeGuide ?? undefined,
      updatedAt: now,
    };
    const transition = { state: next, node: this.definition.nodes[next.nodeId]!, choice, events: applied.events, effects };
    this.emit({ type: 'story.choice', transition });
    return transition;
  }

  publish(eventType: string, payload?: StoryEventPayload, now = Date.now()): StoryEvent {
    const state = this.state();
    const applied = applyEffects(state, [{ type: 'event.publish', eventType, payload }], now);
    const next = this.repository.update(this.definition.id, { nodeId: state.nodeId, flags: applied.flags }) ?? {
      ...state,
      flags: applied.flags,
      updatedAt: now,
    };
    const event = applied.events[0]!;
    this.emit({ type: 'story.event', event, state: next });
    return event;
  }

  subscribe(listener: (event: StoryRuntimeEvent) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private emit(event: StoryRuntimeEvent): void {
    this.listeners.forEach((listener) => listener(event));
  }
}
