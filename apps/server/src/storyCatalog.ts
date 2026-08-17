// Server-side mirror of the client story definitions used by the admin console.
// The canonical story content lives in apps/web (echoStory.ts); this catalog
// encodes the task/story identifiers and their node IDs + titles so the admin
// backend can render per-resident story progress without importing client assets.

export type StoryNodeSummary = { id: string; title: string };
export type StoryEdgeSummary = { from: string; to: string; kind: 'choice' | 'world' | 'building' | 'actor'; label: string };
export type StorySummary = { id: string; title: string; definitionVersion: number; startNode: string; nodes: StoryNodeSummary[]; edges: StoryEdgeSummary[] };

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

// Edge mirror of apps/web ECHO_STORY. Choice edges follow each node's
// choices[].next; trigger edges come from interactions / buildingInteractions /
// worldInteractions and use the actor / building / interest-point id as their
// `from` source. Keep this in sync with echoStory.ts (definitionVersion 12).
const ECHO_EDGES: StoryEdgeSummary[] = [
  { from: 'meeting', to: 'not-alone', kind: 'choice', label: '你一个人住在这里？' },
  { from: 'not-alone', to: 'mountain-memory', kind: 'choice', label: '' },
  { from: 'mountain-memory', to: 'starlight-memory', kind: 'choice', label: '' },
  { from: 'starlight-memory', to: 'four-seasons', kind: 'choice', label: '' },
  { from: 'four-seasons', to: 'request', kind: 'choice', label: '你一定很想她。' },
  { from: 'request', to: 'act-one-complete', kind: 'choice', label: '行吧' },
  { from: 'act-one-complete', to: 'food-delivery', kind: 'choice', label: '交付食材和音乐盒' },
  { from: 'food-delivery', to: 'shared-meal', kind: 'choice', label: '继续' },
  { from: 'shared-meal', to: 'food-thanks', kind: 'choice', label: '继续' },
  { from: 'food-thanks', to: 'wish-complete', kind: 'choice', label: '打开音乐盒' },
  { from: 'wish-complete', to: 'bookstore-memory', kind: 'choice', label: '她为什么来不了了？你们是怎么认识的？' },
  { from: 'bookstore-memory', to: 'cracks-start', kind: 'choice', label: '' },
  { from: 'cracks-start', to: 'stone-hint', kind: 'choice', label: '看看石堆' },
  { from: 'cracks-start', to: 'third-act-complete', kind: 'choice', label: '差不多离开了' },
  { from: 'stone-hint', to: 'stone-question', kind: 'choice', label: '返回询问林澈' },
  { from: 'stone-question', to: 'stone-count', kind: 'choice', label: '这些石头是你垒的吗？' },
  { from: 'stone-count', to: 'stone-excuse', kind: 'choice', label: '但石头有512个……' },
  { from: 'stone-excuse', to: 'third-act-complete', kind: 'choice', label: '沉默' },
  { from: 'third-act-complete', to: 'archive-active', kind: 'choice', label: '前往小城档案馆' },
  { from: 'archive-active', to: 'archive-record', kind: 'choice', label: '查看居民档案' },
  { from: 'archive-record', to: 'archive-elder-story', kind: 'choice', label: '问问路人' },
  { from: 'archive-elder-story', to: 'fourth-act-complete', kind: 'choice', label: '谢谢您。' },
  { from: 'fourth-act-complete', to: 'cabin-active', kind: 'choice', label: '再去找找他' },
  { from: 'cabin-active', to: 'cabin-invitation', kind: 'choice', label: '与林澈交谈' },
  { from: 'cabin-invitation', to: 'fifth-hub', kind: 'choice', label: '跟他进去' },
  { from: 'fifth-hub', to: 'photo-wall-investigation', kind: 'choice', label: '查看照片墙' },
  { from: 'fifth-hub', to: 'diary-investigation', kind: 'choice', label: '查看日记' },
  { from: 'fifth-hub', to: 'fifth-act-complete', kind: 'choice', label: '离开木屋' },
  { from: 'fifth-hub', to: 'cabin-active', kind: 'choice', label: '从门离开' },
  { from: 'photo-wall-investigation', to: 'fifth-hub', kind: 'choice', label: '她去哪了......' },
  { from: 'diary-investigation', to: 'diary-page-89', kind: 'choice', label: '继续翻阅' },
  { from: 'diary-page-89', to: 'diary-page-67', kind: 'choice', label: '继续翻阅' },
  { from: 'diary-page-67', to: 'diary-page-30', kind: 'choice', label: '继续翻阅' },
  { from: 'diary-page-30', to: 'diary-page-1', kind: 'choice', label: '继续翻阅' },
  { from: 'diary-page-1', to: 'fifth-hub', kind: 'choice', label: '合上日记' },
  { from: 'fifth-act-complete', to: 'confrontation-active', kind: 'choice', label: '出去找林澈' },
  { from: 'confrontation-active', to: 'confrontation', kind: 'choice', label: '林澈...？' },
  { from: 'confrontation', to: 'truth-question', kind: 'choice', label: '她不存在，对吧？' },
  { from: 'confrontation', to: 'loop-response', kind: 'choice', label: '你一定很想她。' },
  { from: 'confrontation', to: 'abandon-confirm', kind: 'choice', label: '(什么都不说，离开)。' },
  { from: 'abandon-confirm', to: 'forgotten-ending', kind: 'choice', label: '离开' },
  { from: 'abandon-confirm', to: 'confrontation', kind: 'choice', label: '等等' },
  { from: 'forgotten-ending', to: 'forgotten-blackout', kind: 'choice', label: '继续' },
  { from: 'forgotten-blackout', to: 'forgotten-complete', kind: 'choice', label: '结束' },
  { from: 'loop-response', to: 'loop-confusion', kind: 'choice', label: '继续听下去' },
  { from: 'loop-confusion', to: 'loop-blackout', kind: 'choice', label: '是的，是为了她。' },
  { from: 'loop-confusion', to: 'loop-blackout', kind: 'choice', label: '……' },
  { from: 'loop-blackout', to: 'loop-complete', kind: 'choice', label: '结束' },
  { from: 'truth-question', to: 'truth-admission', kind: 'choice', label: '从照片开始怀疑。' },
  { from: 'truth-question', to: 'truth-admission', kind: 'choice', label: '你的描述一直在变。' },
  { from: 'truth-question', to: 'truth-admission', kind: 'choice', label: '档案里没有她的记录。' },
  { from: 'truth-question', to: 'truth-admission', kind: 'choice', label: '石堆的数量不对。' },
  { from: 'truth-admission', to: 'truth-memory', kind: 'choice', label: '听他说下去' },
  { from: 'truth-memory', to: 'truth-why', kind: 'choice', label: '为什么要这么做？' },
  { from: 'truth-memory', to: 'truth-town', kind: 'choice', label: '你可以回小城去。' },
  { from: 'truth-memory', to: 'support-offer', kind: 'choice', label: '我可以来看你。' },
  { from: 'truth-why', to: 'support-offer', kind: 'choice', label: '我可以来看你。' },
  { from: 'truth-town', to: 'support-offer', kind: 'choice', label: '那我可以来看你。' },
  { from: 'support-offer', to: 'truth-ending', kind: 'choice', label: '我会来看你的。' },
  { from: 'support-offer', to: 'truth-ending', kind: 'choice', label: '你不用再编故事了。' },
  { from: 'truth-ending', to: 'truth-complete', kind: 'choice', label: '继续' },
  { from: 'truth-complete', to: 'visit-one-memory', kind: 'choice', label: '继续' },
  { from: 'visit-one-memory', to: 'visit-thanks', kind: 'choice', label: '结束这次回访' },
  { from: 'visit-thanks', to: 'epilogue-complete', kind: 'choice', label: '结束' },
  { from: 'linche', to: 'cabin-active', kind: 'actor', label: 'invite-cabin' },
  { from: 'linche', to: 'confrontation-active', kind: 'actor', label: 'begin-confrontation' },
  { from: 'archive', to: 'archive-active', kind: 'building', label: 'read-resident-record' },
  { from: 'echo-stone-pile', to: 'cracks-start', kind: 'world', label: 'inspect-stones' },
  { from: 'echo-stone-pile', to: 'stone-hint', kind: 'world', label: 'stone-question' },
  { from: 'echo-stone-pile', to: 'stone-question', kind: 'world', label: 'ask-stones' },
  { from: 'echo-table', to: 'cracks-start', kind: 'world', label: 'inspect-table' },
  { from: 'echo-diary', to: 'fifth-hub', kind: 'world', label: 'inspect-diary' },
  { from: 'echo-diary', to: 'diary-investigation', kind: 'world', label: 'continue-diary-89' },
  { from: 'echo-diary', to: 'diary-page-89', kind: 'world', label: 'continue-diary-67' },
  { from: 'echo-diary', to: 'diary-page-67', kind: 'world', label: 'continue-diary-30' },
  { from: 'echo-diary', to: 'diary-page-30', kind: 'world', label: 'continue-diary-1' },
  { from: 'echo-diary', to: 'diary-page-1', kind: 'world', label: 'finish-diary' },
  { from: 'echo-photo-wall', to: 'fifth-hub', kind: 'world', label: 'inspect-photo-wall' },
  { from: 'echo-photo-wall', to: 'photo-wall-investigation', kind: 'world', label: 'continue-photo-wall-clue' },
  { from: 'echo-cabin-door', to: 'fifth-hub', kind: 'world', label: 'exit-cabin' },
];

export const STORY_CATALOG: readonly StorySummary[] = Object.freeze([
  { id: 'main.echo.act-one', title: '回声', definitionVersion: 12, startNode: 'meeting', nodes: ECHO_NODES, edges: ECHO_EDGES },
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
