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

export interface StoryGuide {
  title: string;
  objective: string;
  visibleWhen?: readonly StoryCondition[];
}

export interface StoryConditionContext {
  inventory?: Readonly<Record<string, number | undefined>>;
  achievements?: ReadonlySet<string>;
  gameDay?: number;
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
  | { type: 'building.state.set'; buildingId: string; state: StoryBuildingState }
  | { type: 'inventory.remove'; itemId: string; quantity: number };

export interface StoryState {
  storyId: StoryId;
  definitionVersion: number;
  nodeId: string;
  flags: Readonly<Record<string, StoryFlagValue>>;
  ending?: string;
  visitCount: number;
  nodeEnteredGameDay?: number;
  activeGuide?: StoryGuide;
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
  hidden?: boolean;
  /** Linear transition with no player choice or visible option. */
  autoAdvance?: boolean;
}

export interface StoryNode {
  id: string;
  title?: string | null;
  role?: string | null;
  text: string;
  tone?: 'default' | 'green';
  presentation?: 'dialogue' | 'cg' | 'document' | 'blackout';
  image?: string;
  choices?: readonly StoryChoice[];
  achievement?: { id: string; name: string };
  terminal?: boolean;
  /** Interaction gate that closes the current dialogue when entered. */
  interactionOnly?: boolean;
  /**
   * Whether reaching this node persists as a resumption (save) point. Defaults
   * to `true`. Mark linear/transitionary beats `false` so progress only saves
   * at meaningful checkpoints; the live node still displays normally in-game,
   * and on reload the player resumes at the last savepoint node.
   */
  savepoint?: boolean;
  /** Number of game-day changes required before this node can be interacted with. */
  unlockAfterGameDays?: number;
  /** Omit to inherit, provide a value to replace, or use null to clear. */
  guide?: StoryGuide | null;
  activeActorIds?: readonly string[];
}

export interface StoryDefinition {
  schemaVersion: 1;
  definitionVersion: number;
  id: StoryId;
  title: string;
  startNode: string;
  entryActorId?: string;
  interactions?: readonly { actorId: string; nodeId: string; choiceId: string }[];
  buildingInteractions?: readonly { buildingId: string; nodeId: string; choiceId: string }[];
  worldInteractions?: readonly { interestPointId: string; nodeId: string; choiceId: string }[];
  triggerWhen?: readonly StoryCondition[];
  nodes: Readonly<Record<string, StoryNode>>;
  /** Verbatim client-side source for editorial audits; never sent to the server. */
  sourceText?: string;
}

export interface StoryRepository {
  get(storyId: StoryId): StoryState | null;
  update(storyId: StoryId, patch: { nodeId: string; flags?: Readonly<Record<string, StoryFlagValue>>; ending?: string; visit?: boolean; nodeEnteredGameDay?: number; activeGuide?: StoryGuide | null }): StoryState | null;
}

export interface StoryTransition {
  state: StoryState;
  node: StoryNode;
  choice: StoryChoice;
  events: readonly StoryEvent[];
  effects: readonly StoryEffect[];
  /** The savepoint nodeId to persist for resumption. Differs from state.nodeId when the live node is a transient beat. */
  resumptionNodeId: string;
}

export type StoryRuntimeEvent =
  | { type: 'story.choice'; transition: StoryTransition }
  | { type: 'story.event'; event: StoryEvent; state: StoryState };
