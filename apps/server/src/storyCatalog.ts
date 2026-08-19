// Server-side mirror of the client story definitions used by the admin console.
// The canonical story content lives in apps/web (echoStory.ts); this catalog
// encodes the task/story identifiers and their node IDs + titles so the admin
// backend can render per-resident story progress without importing client assets.

export type StoryNodeSummary = { id: string; title: string };
export type StoryEdgeSummary = { from: string; to: string; kind: 'choice' | 'world' | 'building' | 'actor'; label: string };
export type StorySummary = { id: string; title: string; definitionVersion: number; startNode: string; nodes: StoryNodeSummary[]; edges: StoryEdgeSummary[] };

// Savepoint-only node list. Transient beats (savepoint: false in echoStory.ts)
// are omitted so the admin catalog mirrors the actual persistence points.
// Keep this in sync with echoStory.ts (definitionVersion 13).
const ECHO_NODES: StoryNodeSummary[] = [
  { id: 'meeting', title: '林澈' },
  { id: 'request', title: '林澈' },
  { id: 'act-one-complete', title: '林澈' },
  { id: 'food-delivery', title: '林澈' },
  { id: 'cracks-start', title: '林澈' },
  { id: 'third-act-complete', title: '林澈' },
  { id: 'fourth-act-complete', title: '林澈' },
  { id: 'cabin-active', title: '林澈' },
  { id: 'fifth-hub', title: '林澈' },
  { id: 'confrontation', title: '林澈' },
  { id: 'forgotten-ending', title: '回声 · 遗忘' },
  { id: 'forgotten-complete', title: '回声 · 遗忘' },
  { id: 'loop-blackout', title: '回声 · 循环' },
  { id: 'loop-complete', title: '回声 · 循环' },
  { id: 'truth-memory', title: '林澈的自白' },
  { id: 'truth-ending', title: '回声 · 真相' },
  { id: 'truth-complete', title: '回声 · 真相' },
  { id: 'epilogue-complete', title: '回声' },
];

// Compressed edge mirror of apps/web ECHO_STORY. Transient beats between
// savepoints are collapsed into direct savepoint-to-savepoint edges.
// Interaction edges that triggered on transient nodes are mapped to the
// savepoint they ultimately reach. Keep this in sync with echoStory.ts
// (definitionVersion 13).
const ECHO_EDGES: StoryEdgeSummary[] = [
  { from: 'meeting', to: 'request', kind: 'choice', label: '你一个人住在这里？' },
  { from: 'request', to: 'act-one-complete', kind: 'choice', label: '行吧' },
  { from: 'act-one-complete', to: 'food-delivery', kind: 'choice', label: '交付食材和音乐盒' },
  { from: 'food-delivery', to: 'cracks-start', kind: 'choice', label: '继续' },
  { from: 'cracks-start', to: 'third-act-complete', kind: 'choice', label: '看看石堆' },
  { from: 'cracks-start', to: 'third-act-complete', kind: 'choice', label: '差不多离开了' },
  { from: 'third-act-complete', to: 'fourth-act-complete', kind: 'choice', label: '前往小城档案馆' },
  { from: 'fourth-act-complete', to: 'cabin-active', kind: 'choice', label: '再去找找他' },
  { from: 'cabin-active', to: 'fifth-hub', kind: 'choice', label: '与林澈交谈' },
  { from: 'fifth-hub', to: 'confrontation', kind: 'choice', label: '离开木屋' },
  { from: 'fifth-hub', to: 'cabin-active', kind: 'choice', label: '从门离开' },
  { from: 'confrontation', to: 'truth-memory', kind: 'choice', label: '她不存在，对吧？' },
  { from: 'confrontation', to: 'loop-blackout', kind: 'choice', label: '你一定很想她。' },
  { from: 'confrontation', to: 'forgotten-ending', kind: 'choice', label: '(什么都不说，离开)。' },
  { from: 'forgotten-ending', to: 'forgotten-complete', kind: 'choice', label: '继续' },
  { from: 'loop-blackout', to: 'loop-complete', kind: 'choice', label: '结束' },
  { from: 'truth-memory', to: 'truth-ending', kind: 'choice', label: '为什么要这么做？' },
  { from: 'truth-memory', to: 'truth-ending', kind: 'choice', label: '你可以回小城去。' },
  { from: 'truth-memory', to: 'truth-ending', kind: 'choice', label: '我可以来看你。' },
  { from: 'truth-ending', to: 'truth-complete', kind: 'choice', label: '继续' },
  { from: 'truth-complete', to: 'epilogue-complete', kind: 'choice', label: '继续' },
  { from: 'linche', to: 'cabin-active', kind: 'actor', label: 'invite-cabin' },
  { from: 'linche', to: 'confrontation', kind: 'actor', label: 'begin-confrontation' },
  { from: 'archive', to: 'fourth-act-complete', kind: 'building', label: 'read-resident-record' },
  { from: 'echo-stone-pile', to: 'cracks-start', kind: 'world', label: 'inspect-stones' },
  { from: 'echo-table', to: 'cracks-start', kind: 'world', label: 'inspect-table' },
  { from: 'echo-diary', to: 'fifth-hub', kind: 'world', label: 'inspect-diary' },
  { from: 'echo-photo-wall', to: 'fifth-hub', kind: 'world', label: 'inspect-photo-wall' },
  { from: 'echo-cabin-door', to: 'fifth-hub', kind: 'world', label: 'exit-cabin' },
];

export const STORY_CATALOG: readonly StorySummary[] = Object.freeze([
  { id: 'main.echo.act-one', title: '回声', definitionVersion: 13, startNode: 'meeting', nodes: ECHO_NODES, edges: ECHO_EDGES },
]);

const STORY_BY_ID = new Map(STORY_CATALOG.map((story) => [story.id, story]));

export function getStorySummary(storyId: string): StorySummary {
  const known = STORY_BY_ID.get(storyId);
  if (known) return known;
  // Unknown (e.g. test) stories are still surfaced so admins can inspect them;
  // their node list is empty because the server does not own their definition.
  return { id: storyId, title: storyId, definitionVersion: 0, startNode: '', nodes: [] as StoryNodeSummary[], edges: [] as StoryEdgeSummary[] };
}

export function getStoryNodeTitle(storyId: string, nodeId: string): string {
  const story = STORY_BY_ID.get(storyId);
  if (!story) return nodeId;
  return story.nodes.find((node) => node.id === nodeId)?.title ?? nodeId;
}

export function getStoryTopology(storyId: string): { summary: StorySummary } {
  return { summary: getStorySummary(storyId) };
}
