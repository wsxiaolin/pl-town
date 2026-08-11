export type StoryId = string;

export type StoryFlagValue = boolean | number | string;

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
}
