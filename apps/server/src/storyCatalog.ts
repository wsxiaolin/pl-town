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

// Savepoint-only node list for the Magi side story.
// Keep this in sync with magiStory.ts (definitionVersion 1).
const MAGI_NODES: StoryNodeSummary[] = [
  { id: 'magi.start', title: '德拉' },
  { id: 'magi.della-hair', title: '德拉' },
  { id: 'magi.wig-shop-arrival', title: '假发店' },
  { id: 'magi.wig-deal-good', title: '假发店' },
  { id: 'magi.wig-deal-fair', title: '假发店' },
  { id: 'magi.chain-shop-arrival', title: '金月店' },
  { id: 'magi.chain-buy', title: '德拉' },
  { id: 'magi.della-waiting', title: '街道' },
  { id: 'magi.jim-meet', title: '吉姆' },
  { id: 'magi.jim-comb-choose', title: '杂货铺' },
  { id: 'magi.jim-comb-bought', title: '吉姆' },
  { id: 'magi.eve-arrive', title: '客栈' },
  { id: 'magi.ending-witness', title: '麦琪的礼物' },
  { id: 'magi.ending-quiet', title: '麦琪的礼物' },
];

// Compressed edge mirror of apps/web MAGI_STORY. Transient beats between
// savepoints are collapsed into direct savepoint-to-savepoint edges.
// Keep this in sync with magiStory.ts (definitionVersion 1).
const MAGI_EDGES: StoryEdgeSummary[] = [
  { from: 'magi.start', to: 'magi.della-hair', kind: 'choice', label: '你在数什么？' },
  { from: 'magi.start', to: 'magi.della-hair', kind: 'choice', label: '你打算怎么办？' },
  { from: 'magi.della-hair', to: 'magi.wig-shop-arrival', kind: 'choice', label: '我陪你走一趟' },
  { from: 'magi.della-hair', to: 'magi.wig-shop-arrival', kind: 'choice', label: '吉姆不会希望你卖掉头发的' },
  { from: 'magi.wig-shop-arrival', to: 'magi.wig-deal-good', kind: 'choice', label: '这头发至少值四十' },
  { from: 'magi.wig-shop-arrival', to: 'magi.wig-deal-fair', kind: 'choice', label: '二十太少了' },
  { from: 'magi.wig-shop-arrival', to: 'magi.wig-deal-fair', kind: 'choice', label: '（站在旁边）' },
  { from: 'magi.wig-deal-good', to: 'magi.chain-shop-arrival', kind: 'choice', label: '前往金月店' },
  { from: 'magi.wig-deal-fair', to: 'magi.chain-shop-arrival', kind: 'choice', label: '前往金月店' },
  { from: 'magi.chain-shop-arrival', to: 'magi.chain-buy', kind: 'choice', label: '推荐白金表链' },
  { from: 'magi.chain-shop-arrival', to: 'magi.chain-buy', kind: 'choice', label: '镀金那条' },
  { from: 'magi.chain-shop-arrival', to: 'magi.chain-buy', kind: 'choice', label: '你自己觉得呢？' },
  { from: 'magi.chain-buy', to: 'magi.della-waiting', kind: 'choice', label: '替德拉保密' },
  { from: 'magi.chain-buy', to: 'magi.della-waiting', kind: 'choice', label: '吉姆迟早会知道的' },
  { from: 'magi.della-waiting', to: 'magi.jim-meet', kind: 'choice', label: '搭话' },
  { from: 'magi.jim-meet', to: 'magi.jim-comb-choose', kind: 'choice', label: '在看梳子？' },
  { from: 'magi.jim-meet', to: 'magi.jim-comb-choose', kind: 'choice', label: '金表？' },
  { from: 'magi.jim-comb-choose', to: 'magi.jim-comb-bought', kind: 'choice', label: '玳瑁那组' },
  { from: 'magi.jim-comb-choose', to: 'magi.jim-comb-bought', kind: 'choice', label: '木梳也行' },
  { from: 'magi.jim-comb-bought', to: 'magi.eve-arrive', kind: 'choice', label: '替吉姆保密' },
  { from: 'magi.jim-comb-bought', to: 'magi.eve-arrive', kind: 'choice', label: '也许该让德拉知道' },
  { from: 'magi.eve-arrive', to: 'magi.ending-witness', kind: 'choice', label: '推门进去' },
  { from: 'magi.eve-arrive', to: 'magi.ending-quiet', kind: 'choice', label: '安静离开' },
  { from: 'della', to: 'magi.start', kind: 'actor', label: 'talk-della' },
  { from: 'della', to: 'magi.della-waiting', kind: 'actor', label: 'talk-della-waiting' },
  { from: 'della', to: 'magi.eve-arrive', kind: 'actor', label: 'talk-della-eve' },
  { from: 'jim', to: 'magi.jim-meet', kind: 'actor', label: 'talk-jim' },
  { from: 'mall_west', to: 'magi.wig-shop-arrival', kind: 'building', label: 'enter-wig-shop' },
  { from: 'mall_south', to: 'magi.chain-shop-arrival', kind: 'building', label: 'enter-chain-shop' },
  { from: 'guesthouse', to: 'magi.eve-arrive', kind: 'building', label: 'enter-guesthouse-eve' },
];

// Savepoint-only node list for the Overcoat side story.
// Keep this in sync with overcoatStory.ts (definitionVersion 1).
const OVERCOAT_NODES: StoryNodeSummary[] = [
  { id: 'meeting', title: '阿卡基' },
  { id: 'tailor-door', title: '裁缝门口' },
  { id: 'coat-worn', title: '阿卡基' },
  { id: 'first-greeting', title: '街上' },
  { id: 'aftermath', title: '雪地' },
  { id: 'investigation-hub', title: '调查' },
  { id: 'ask-tang', title: '唐师傅' },
  { id: 'ask-you', title: '游先生' },
  { id: 'ask-laoqin', title: '老秦' },
  { id: 'ask-linxu', title: '林叙' },
  { id: 'ask-li', title: '李叔' },
  { id: 'evidence-hub', title: '线索' },
  { id: 'ending-recover-complete', title: '今晚别走那条街 · 找回' },
  { id: 'ending-witness-complete', title: '今晚别走那条街 · 作证' },
  { id: 'ending-ghost-complete', title: '今晚别走那条街 · 传闻' },
];

const OVERCOAT_EDGES: StoryEdgeSummary[] = [
  { from: 'meeting', to: 'tailor-door', kind: 'choice', label: '什么外套？/ 我陪你去找他' },
  { from: 'tailor-door', to: 'coat-worn', kind: 'choice', label: '选纽扣 / 快试试' },
  { from: 'coat-worn', to: 'first-greeting', kind: 'choice', label: '很好看 / 走吧' },
  { from: 'first-greeting', to: 'aftermath', kind: 'choice', label: '恭喜你 / 送你回去' },
  { from: 'aftermath', to: 'investigation-hub', kind: 'choice', label: '我帮你找 / 去报警' },
  { from: 'investigation-hub', to: 'ask-tang', kind: 'choice', label: '去找唐师傅' },
  { from: 'investigation-hub', to: 'ask-you', kind: 'choice', label: '去找游先生' },
  { from: 'investigation-hub', to: 'ask-laoqin', kind: 'choice', label: '去找老秦' },
  { from: 'investigation-hub', to: 'ask-linxu', kind: 'choice', label: '去找林叙' },
  { from: 'investigation-hub', to: 'ask-li', kind: 'choice', label: '去找李叔' },
  { from: 'investigation-hub', to: 'evidence-hub', kind: 'choice', label: '汇总线索' },
  { from: 'ask-tang', to: 'investigation-hub', kind: 'choice', label: '继续调查' },
  { from: 'ask-you', to: 'investigation-hub', kind: 'choice', label: '继续调查' },
  { from: 'ask-laoqin', to: 'investigation-hub', kind: 'choice', label: '继续调查' },
  { from: 'ask-linxu', to: 'investigation-hub', kind: 'choice', label: '继续调查' },
  { from: 'ask-li', to: 'investigation-hub', kind: 'choice', label: '继续调查' },
  { from: 'evidence-hub', to: 'ending-recover-complete', kind: 'choice', label: '去河边找回外套' },
  { from: 'evidence-hub', to: 'ending-witness-complete', kind: 'choice', label: '联名作证' },
  { from: 'evidence-hub', to: 'ending-ghost-complete', kind: 'choice', label: '今晚再去那条街' },
  { from: 'akaki', to: 'evidence-hub', kind: 'actor', label: 'review-evidence' },
];

// Savepoint-only node list for 昨日之歌 side story.
// Keep this in sync with yesterdaySong.ts (definitionVersion 1).
const YESTERDAY_NODES: StoryNodeSummary[] = [
  { id: 'diary-discovery', title: '档案馆' },
  { id: 'diary-recognized', title: '日记' },
  { id: 'qiu-explains', title: '秋嫂' },
  { id: 'wednesday-wait', title: '报摊' },
  { id: 'painter-arrives', title: '画翁' },
  { id: 'ending-witness', title: '昨日之歌 · 见证' },
  { id: 'ending-silence', title: '昨日之歌 · 沉默' },
  { id: 'epilogue-cats', title: '尾声' },
  { id: 'epilogue-complete', title: '昨日之歌' },
];

// Compressed edge mirror of apps/web YESTERDAY_SONG.
// Keep this in sync with yesterdaySong.ts (definitionVersion 1).
const YESTERDAY_EDGES: StoryEdgeSummary[] = [
  { from: 'diary-discovery', to: 'diary-cover', kind: 'choice', label: '翻开日记' },
  { from: 'diary-recognized', to: 'qiu-intro', kind: 'choice', label: '去报摊找秋嫂' },
  { from: 'qiu-explains', to: 'wednesday-wait', kind: 'choice', label: '等到周三' },
  { from: 'wednesday-wait', to: 'painter-arrives', kind: 'choice', label: '在报摊等候' },
  { from: 'painter-arrives', to: 'painter-reads', kind: 'choice', label: '把日记推到他面前' },
  { from: 'painter-arrives', to: 'silent-observation', kind: 'choice', label: '什么都不做' },
  { from: 'ending-witness', to: 'epilogue-cats', kind: 'choice', label: '继续' },
  { from: 'ending-silence', to: 'epilogue-cats', kind: 'choice', label: '继续' },
  { from: 'epilogue-cats', to: 'epilogue-complete', kind: 'choice', label: '结束' },
  { from: 'archive', to: 'diary-discovery', kind: 'building', label: 'find-diary' },
  { from: 'newsstand', to: 'diary-recognized', kind: 'building', label: 'talk-to-qiu' },
  { from: 'newsstand', to: 'wednesday-wait', kind: 'building', label: 'wait-wednesday' },
  { from: 'qiu', to: 'qiu-intro', kind: 'actor', label: 'show-diary-to-qiu' },
  { from: 'huaweng', to: 'painter-arrives', kind: 'actor', label: 'approach-painter' },
];

export const STORY_CATALOG: readonly StorySummary[] = Object.freeze([
  { id: 'main.echo.act-one', title: '回声', definitionVersion: 13, startNode: 'meeting', nodes: ECHO_NODES, edges: ECHO_EDGES },
  { id: 'side.magi.gift', title: '麦琪的礼物', definitionVersion: 1, startNode: 'magi.start', nodes: MAGI_NODES, edges: MAGI_EDGES },
  { id: 'side.overcoat.tonight', title: '今晚别走那条街', definitionVersion: 1, startNode: 'meeting', nodes: OVERCOAT_NODES, edges: OVERCOAT_EDGES },
  { id: 'side.yesterday.spring-1997', title: '昨日之歌', definitionVersion: 1, startNode: 'diary-discovery', nodes: YESTERDAY_NODES, edges: YESTERDAY_EDGES },
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
