// Server-side mirror of the client story definitions used by the admin console.
// The canonical story content lives in apps/web (echoStory.ts); this catalog
// encodes the task/story identifiers and their node IDs + titles so the admin
// backend can render per-resident story progress without importing client assets.

export type StoryNodeSummary = { id: string; title: string };
export type StorySummary = { id: string; title: string; definitionVersion: number; nodes: StoryNodeSummary[] };

const ECHO_NODES: StoryNodeSummary[] = [
  { id: 'meeting', title: '林澈' },
  { id: 'not-alone', title: '林澈' },
  { id: 'mountain-memory', title: '回忆' },
  { id: 'starlight-memory', title: '回忆' },
  { id: 'four-seasons', title: '林澈' },
  { id: 'request', title: '林澈' },
  { id: 'act-one-complete', title: '林澈' },
  { id: 'food-delivery', title: '林澈' },
  { id: 'shared-meal', title: '回忆' },
  { id: 'food-thanks', title: '林澈' },
  { id: 'wish-complete', title: '林澈' },
  { id: 'bookstore-memory', title: '林澈' },
  { id: 'cracks-start', title: '林澈' },
  { id: 'stone-hint', title: '林澈' },
  { id: 'stone-question', title: '林澈' },
  { id: 'stone-count', title: '林澈' },
  { id: 'stone-excuse', title: '林澈' },
  { id: 'third-act-complete', title: '林澈' },
  { id: 'archive-active', title: '林澈' },
  { id: 'archive-record', title: '档案记录' },
  { id: 'archive-elder-story', title: '林澈' },
  { id: 'fourth-act-complete', title: '林澈' },
  { id: 'cabin-active', title: '林澈' },
  { id: 'cabin-invitation', title: '林澈' },
  { id: 'fifth-hub', title: '林澈' },
  { id: 'photo-wall-investigation', title: '林澈' },
  { id: 'diary-investigation', title: '林澈' },
  { id: 'diary-page-89', title: '日记' },
  { id: 'diary-page-67', title: '日记' },
  { id: 'diary-page-30', title: '日记' },
  { id: 'diary-page-1', title: '日记' },
  { id: 'fifth-act-complete', title: '林澈' },
  { id: 'confrontation-active', title: '林澈' },
  { id: 'confrontation', title: '林澈' },
  { id: 'abandon-confirm', title: '林澈' },
  { id: 'forgotten-ending', title: '回声 · 遗忘' },
  { id: 'forgotten-blackout', title: '回声 · 遗忘' },
  { id: 'forgotten-complete', title: '回声 · 遗忘' },
  { id: 'loop-response', title: '林澈' },
  { id: 'loop-confusion', title: '林澈' },
  { id: 'loop-blackout', title: '回声 · 循环' },
  { id: 'loop-complete', title: '回声 · 循环' },
  { id: 'truth-question', title: '林澈' },
  { id: 'truth-admission', title: '林澈' },
  { id: 'truth-memory', title: '林澈的自白' },
  { id: 'truth-why', title: '林澈' },
  { id: 'truth-town', title: '林澈' },
  { id: 'support-offer', title: '林澈' },
  { id: 'truth-ending', title: '回声 · 真相' },
  { id: 'truth-complete', title: '回声 · 真相' },
  { id: 'visit-one-memory', title: '黄昏的观测站' },
  { id: 'visit-thanks', title: '林澈' },
  { id: 'epilogue-complete', title: '回声' },
];

export const STORY_CATALOG: readonly StorySummary[] = Object.freeze([
  { id: 'main.echo.act-one', title: '回声', definitionVersion: 11, nodes: ECHO_NODES },
]);

const STORY_BY_ID = new Map(STORY_CATALOG.map((story) => [story.id, story]));

export function getStorySummary(storyId: string): StorySummary {
  const known = STORY_BY_ID.get(storyId);
  if (known) return known;
  // Unknown (e.g. test) stories are still surfaced so admins can inspect them;
  // their node list is empty because the server does not own their definition.
  return { id: storyId, title: storyId, definitionVersion: 0, nodes: [] as StoryNodeSummary[] };
}

export function getStoryNodeTitle(storyId: string, nodeId: string): string {
  const story = STORY_BY_ID.get(storyId);
  if (!story) return nodeId;
  return story.nodes.find((node) => node.id === nodeId)?.title ?? nodeId;
}
