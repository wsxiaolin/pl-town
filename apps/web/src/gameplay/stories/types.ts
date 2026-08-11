export type StoryId = string;

export type StoryFlagValue = boolean | number | string;

export type StoryEventPayload = Readonly<Record<string, StoryFlagValue>>;

export interface StoryEvent {
  id: string;
  type: string;
  at: number;
  payload?: StoryEventPayload;
}

export type StoryBuildingState = 'default' | 'hidden' | 'disabled' | 'damaged' | 'restored';

export interface StoryConditionContext {
  inventory?: Readonly<Record<string, number | undefined>>;
  achievements?: ReadonlySet<string>;
}

export type StoryCondition =
  | { type: 'flag.equals'; flagId: string; value: StoryFlagValue }
  | { type: 'event.occurred'; eventType: string; atLeast?: number }
  | { type: 'building.state'; buildingId: string; state: StoryBuildingState }
  | { type: 'inventory.count'; itemId: string; atLeast: number }
  | { type: 'achievement.unlocked'; achievementId: string };

export type StoryEffect =
  | { type: 'flag.set'; flagId: string; value: StoryFlagValue }
  | { type: 'event.publish'; eventType: string; payload?: StoryEventPayload }
  | { type: 'building.state.set'; buildingId: string; state: StoryBuildingState };

export interface StoryState {
  storyId: StoryId;
  definitionVersion: number;
  nodeId: string;
  flags: Readonly<Record<string, StoryFlagValue>>;
  ending?: string;
  visitCount: number;
  updatedAt: number;
}

export interface StoryChoice {
  id: string;
  label: string;
  next: string;
  set?: Readonly<Record<string, StoryFlagValue>>;
  ending?: string;
  visit?: boolean;
  requiresItem?: string;
  availableWhen?: readonly StoryCondition[];
  effects?: readonly StoryEffect[];
}

export interface StoryNode {
  id: string;
  title: string;
  role?: string;
  text: string;
  tone?: 'default' | 'green';
  presentation?: 'dialogue' | 'cg' | 'document';
  choices?: readonly StoryChoice[];
  achievement?: { id: string; name: string };
  terminal?: boolean;
}

export interface StoryDefinition {
  schemaVersion: 1;
  definitionVersion: number;
  id: StoryId;
  title: string;
  startNode: string;
  triggerWhen?: readonly StoryCondition[];
  nodes: Readonly<Record<string, StoryNode>>;
  /** Verbatim client-side source for editorial audits; never sent to the server. */
  sourceText?: string;
}

export interface StoryRepository {
  get(storyId: StoryId): StoryState | null;
  update(storyId: StoryId, patch: { nodeId: string; flags?: Readonly<Record<string, StoryFlagValue>>; ending?: string; visit?: boolean }): StoryState | null;
}

export interface StoryTransition {
  state: StoryState;
  node: StoryNode;
  choice: StoryChoice;
  events: readonly StoryEvent[];
  effects: readonly StoryEffect[];
}

export type StoryRuntimeEvent =
  | { type: 'story.choice'; transition: StoryTransition }
  | { type: 'story.event'; event: StoryEvent; state: StoryState };
