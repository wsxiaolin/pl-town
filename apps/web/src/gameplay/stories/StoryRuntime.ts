import type { StoryChoice, StoryDefinition, StoryRepository, StoryState, StoryTransition } from './types';

export function createInitialStoryState(definition: StoryDefinition, now = Date.now()): StoryState {
  return {
    storyId: definition.id,
    definitionVersion: definition.definitionVersion,
    nodeId: definition.startNode,
    flags: {},
    visitCount: 0,
    updatedAt: now,
  };
}

export class StoryRuntime {
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

  choices(): readonly StoryChoice[] {
    return this.node().choices ?? [];
  }

  choose(choiceId: string, now = Date.now()): StoryTransition | null {
    const state = this.state();
    const node = this.definition.nodes[state.nodeId];
    const choice = node?.choices?.find((item) => item.id === choiceId);
    if (!node || !choice || !this.definition.nodes[choice.next]) return null;
    const flags = { ...state.flags, ...(choice.set ?? {}) };
    const next = this.repository.update(this.definition.id, {
      nodeId: choice.next,
      flags,
      ending: choice.ending,
      visit: choice.visit,
    }) ?? {
      ...state,
      nodeId: choice.next,
      flags,
      ending: choice.ending ?? state.ending,
      visitCount: state.visitCount + (choice.visit ? 1 : 0),
      updatedAt: now,
    };
    return { state: next, node: this.definition.nodes[next.nodeId]!, choice };
  }
}

