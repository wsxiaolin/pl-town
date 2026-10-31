import type { StoryDefinition } from "../../../stories/types";

/**
 * 支线剧情 S001 · 聊天室世代史：会沉的城，不散的人
 *
 * 玩家在老城区坡地遇见一座半埋的第一聊天室遗迹。
 * 考古向导 laxy 瓦 引导玩家逐层发掘五个发掘点，抵达地基石上的开国原话，
 * 然后在涂鸦墙留下自己的一句，最后听碑旁静立的墓碑先生说一句只有靠近才听得见的话。
 *
 * 玩家没有改变任何历史——只是把"记得它"做成了动词。
 *
 * 台词纪律（故事文档 2026-10-22 修订①，逐字照录，不得增改）：
 *  - 全案台词零人称代词（laxy 瓦 以名字直呼）
 *  - 26532/18833/20699/19304/5332 为五楼实测值；涂鸦墙计数只用一代值 26532
 *  - 门牌原文「鸽叽与黑纸勿进」只陈列不解释
 *
 * @see docs/story-authoring.md
 * @see projects/pl-town-stories/stories/S001-聊天室世代史.md
 */

/** 全局考古变体表（8 项，S001 持有；S005 提案墙共用）。前 5 项为 S001 评论区实证，后 3 项为 S005 提案墙实证。 */
export const CHATRUINS_VARIANT_TABLE: readonly string[] = Object.freeze([
  "考古", "烤咕", "考咕", "靠顾", "烤谷",
  "老古", "孝古", "烤菇",
]);

/** 涂鸦墙初始计数（一代实测值；仅此值，不混用他代数值）。 */
export const CHATRUINS_GRAFFITI_BASE_COUNT = 26532;
/** 提交成功后的玩家本地视角计数。 */
export const CHATRUINS_GRAFFITI_MY_COUNT = 26533;
/** 涂鸦输入限长。 */
export const CHATRUINS_GRAFFITI_MAX_LENGTH = 12;
/** 空输入拒绝提示（逐字照录）。 */
export const CHATRUINS_EMPTY_INPUT_HINT = "留点什么吧，空着算什么考古。";

/** S009 鸽咖完成标记（跨案咬合：闲聊池第 4 条解锁条件）。S009 未实装时对侧自然休眠。 */
export const S009_COMPLETED_ACHIEVEMENT = "s009_dove_cafe";

/** laxy 瓦 开场白 A（S0 态强制播，全文写死）。 */
export const CHATRUINS_OPENING_A =
  "你好！欢迎来到物理实验室小城！这是一个很有意思的地方——呃，虽然你脚下这间屋子，是全城留言最多、也最安静的地方。两万六千五百三十二条。我是 laxy 瓦，负责在这里欢迎每一个路过的人。要不要……跟我考古一下？";

/** 重复开场白 B（S1 态短版）。 */
export const CHATRUINS_OPENING_B =
  "来了？往下挖吧，层是按顺序亮的。挖不明白就回来问我，我这儿常年有人。";

/** 引导台词 C（S2 态）。 */
export const CHATRUINS_GUIDE_C =
  "五层都见底了，就差你了。墙在那边——留一句，要原创的哦。";

/** 墓碑先生隐藏台词（触发即任务完成节点；node 正文，blackout 呈现）。 */
export const CHATRUINS_TOMBSTONE_REVEAL =
  "（他看着地基石的方向，很久。）\n\n「孩子们……都长大啦。」\n\n（然后恢复沉默。）";

/** 结局余韵（blackout 终局节点）。 */
export const CHATRUINS_ENDING_TEXT =
  "你把那句话留在了 26533 层。\n\n离开遗迹的时候，laxy 瓦还在门口。墓碑先生还站在碑旁。\n\n「这座城里曾有一间不断被淹没、又不断被重建的聊天室。而后来的人把记得它，叫作考古。」";

/** 逐层插话（S1 态，每层挖完自动播放，全文写死）。 */
export const CHATRUINS_LAYER_NOTES: readonly string[] = Object.freeze([
  "楼长被一种叫『课业』的天敌追上了。看层和层之间那行小字——不用记，往下挖就是了。",
  "『不是没有热度，是没有话题』。三代，学会新词了。挖。",
  "『人呢人呢人呢』——开厅第一天，空屋子，楼长一个人喊。你听，是不是还有回音。继续。",
  "『应该会出意外』。这层和上面那层，隔得久了点。十五天。……差的那一天，就是散场的开始。最后了，底下那块，是开国。",
  "……这就是最底下了。『如题，没错，畅快的聊吧！』两万六千五百三十二条，压在这一句上头。行了——轮到你了。墙在那边，随便写，要原创的哦。",
]);

/** 五个发掘点的遗物原文与旁白（UI 浮层，非 NPC；照录）。 */
export const CHATRUINS_DIG_LAYERS: readonly { relic: string; narration: string; scale: string }[] = Object.freeze([
  { relic: "暂退了，各位，周末上", narration: "四代告示。楼长被一种叫\"课业\"的天敌追上了。", scale: "14 天" },
  { relic: "不是没有热度，是没有话题！", narration: "三代公告。这一代楼长学会了新词：话题。", scale: "14 天" },
  { relic: "人呢人呢人呢", narration: "二代开厅第一天，楼长站在空荡荡的大厅里喊人。", scale: "14 天" },
  { relic: "不出意外的话，应该会出意外", narration: "五代刻字。这一代只开了一天。签名只剩两个字：刑啊。", scale: "15 天" },
  {
    relic: "如题，没错，畅快的聊吧！",
    narration: "考古的尽头是一句开场白。它上面压着两万六千五百三十二层涂鸦，每一层都是一个人来过的证据。",
    scale: "",
  },
]);

/** laxy 瓦 涂鸦反应（三型，全文写死）。 */
export const CHATRUINS_WALL_REACTIONS = {
  archaeology: "经典款！安全牌！",
  variant: "有内味了！但已经是第两千个人这么写了。",
  free: "……好，很有精神！从现在起，你也是考古史的一部分了。",
} as const;

/** laxy 瓦 S3 闲聊池（3 条循环；第 4 条需 s009_completed）。 */
export const CHATRUINS_CHAT_POOL: readonly string[] = Object.freeze([
  "考古这个词，谁发明的已经考不出来了。所以我说它是『人民的发明』。",
  "我在这儿发迎新词好几年了。来的每一个人我都欢迎过，虽然他们大多没注意到我。",
  "那笔两支持的债？威龙是龙前几天又来问过一次。楼主还是没出现。挺好，还活着就能一直问。",
]);

/** 闲聊池第 4 条（需 S009 鸽咖完成）。 */
export const CHATRUINS_CHAT_POOL_S009 =
  "城里现在有家鸽咖。门口那句『继猫咖后』，跟我这块门牌是一个岁数的语法。……对了，迎新词我有好几个版本呢，你收到的是哪版？";

/** 8-19 开国日替换闲聊（替换第 2 条）。 */
export const CHATRUINS_CHAT_FOUNDING_DAY =
  "今天这个日子，碑旁边那位比我记得清楚。你去站一会儿就知道，有一年 8 月 19 日的傍晚，有人只说了一句话，就开了一座城。";

export const CHATRUINS_STORY: StoryDefinition = {
  schemaVersion: 1,
  definitionVersion: 1,
  id: "side.s001.sunken-city",
  title: "会沉的城",
  startNode: "lintel",
  // 门楣木牌 = 故事入口：点击遗迹建筑即"进入遗迹地块"（QuestRuntime entered 语义），
  // 木牌原文随建筑默认对话陈列，此处呈现开场定调 CG。
  buildingInteractions: [
    {
      buildingId: "chatruins",
      nodeId: "lintel",
      choiceId: "read-lintel",
    },
  ],
  worldInteractions: [
    ...CHATRUINS_DIG_LAYERS.map((_, index) => ({
      interestPointId: `chatruins-dig-${index + 1}`,
      nodeId: `dig-${index + 1}-wait`,
      choiceId: `dig-layer-${index + 1}`,
    })),
  ],
  nodes: {
    lintel: {
      id: "lintel",
      title: "第一聊天室遗迹",
      role: null,
      guide: {
        title: "会沉的城",
        objective: "读一读遗迹门楣上的木牌",
      },
      text: "半埋在坡地里的门楣。木牌上的字迹被风雨磨过很多遍，还认得出：\n\n「真·第一聊天室（鸽叽与黑纸勿进）」\n\n木牌背后没有门——只有一级一级往下沉的地层。入口处站着一个挥手的身影。",
      choices: [
        {
          id: "read-lintel",
          label: "（凑近看木牌）",
          next: "lintel-read",
        },
      ],
    },
    "lintel-read": {
      savepoint: true,
      id: "lintel-read",
      title: "第一聊天室遗迹",
      role: null,
      presentation: "document",
      text: "地层最上面一层刻着一行小字：「两周一代，比月亮还守时。」\n\n是谁刻的，已经考不出来了。挥手的身影还在等你。",
      choices: [
        {
          id: "continue-find-laxy",
          label: "",
          autoAdvance: true,
          next: "meet-laxy",
          effects: [
            { type: "event.publish", eventType: "s001.achievement.relic-key" },
          ],
        },
      ],
    },
    "meet-laxy": {
      savepoint: true,
      id: "meet-laxy",
      title: "laxy 瓦",
      role: "考古向导",
      guide: {
        title: "会沉的城",
        objective: "听 laxy 瓦说完开场白",
      },
      // S0 态强制播完不可跳过：唯一选项即（听 laxy 瓦说完）。
      text: CHATRUINS_OPENING_A,
      choices: [
        {
          id: "met-laxy",
          label: "（听 laxy 瓦说完）",
          next: "dig-1-wait",
        },
      ],
    },
    ...buildDigNodes(),
    "wall-open": {
      savepoint: true,
      id: "wall-open",
      title: "涂鸦墙",
      role: null,
      guide: {
        title: "会沉的城",
        objective: "在涂鸦墙留一句自己的字",
      },
      text: "涂鸦墙高亮了起来。26532 层字迹的最上面，空着一格——那是留给你的位置。",
      choices: [],
    },
    "wall-archaeology": {
      id: "wall-archaeology",
      title: "laxy 瓦",
      role: "考古向导",
      text: CHATRUINS_WALL_REACTIONS.archaeology,
      choices: [
        {
          id: "continue-settle",
          label: "",
          autoAdvance: true,
          next: "settle-wait",
          effects: [{ type: "event.publish", eventType: "s001.reward.iou" }],
        },
      ],
    },
    "wall-variant": {
      id: "wall-variant",
      title: "laxy 瓦",
      role: "考古向导",
      text: CHATRUINS_WALL_REACTIONS.variant,
      choices: [
        {
          id: "continue-settle",
          label: "",
          autoAdvance: true,
          next: "settle-wait",
          effects: [{ type: "event.publish", eventType: "s001.reward.iou" }],
        },
      ],
    },
    "wall-free": {
      id: "wall-free",
      title: "laxy 瓦",
      role: "考古向导",
      text: CHATRUINS_WALL_REACTIONS.free,
      choices: [
        {
          id: "continue-settle",
          label: "",
          autoAdvance: true,
          next: "settle-wait",
          effects: [{ type: "event.publish", eventType: "s001.reward.iou" }],
        },
      ],
    },
    "settle-wait": {
      savepoint: true,
      id: "settle-wait",
      title: "第一聊天室遗迹",
      role: null,
      guide: {
        title: "会沉的城",
        objective: "靠近碑旁静立的人",
      },
      text: "遗迹安静了下来。墓碑先生站在碑旁，看着地基石的方向。",
      choices: [
        {
          id: "tombstone-reveal",
          label: "",
          hidden: true,
          next: "tombstone-reveal",
        },
      ],
    },
    "tombstone-reveal": {
      savepoint: true,
      id: "tombstone-reveal",
      title: "墓碑先生",
      role: "碑旁静立的人",
      presentation: "blackout",
      text: CHATRUINS_TOMBSTONE_REVEAL,
      choices: [
        {
          id: "continue-ending",
          label: "",
          autoAdvance: true,
          next: "ending-settle",
        },
      ],
    },
    "ending-settle": {
      id: "ending-settle",
      title: "会沉的城",
      role: "完",
      presentation: "blackout",
      terminal: true,
      guide: null,
      text: CHATRUINS_ENDING_TEXT,
      choices: [
        {
          id: "continue-close",
          label: "",
          autoAdvance: true,
          next: "ending-settle",
          ending: "sunken-city",
          effects: [{ type: "event.publish", eventType: "s001.achievement.sunken-city" }],
        },
      ],
    },
  },
  sourceText: `S001 · 聊天室世代史：会沉的城，不散的人（故事文档 2026-10-22 修订①）。

真实的王朝史：2021-08-19 起 60 天五代更替，间隔 14/14/14/15 天。
一代 米米米米「如题，没错，畅快的聊吧！」26532 条 →
二代~五代 月满西楼（签名编年史：不敢发精选的屑西楼 → 消息99+ → 暂退，周末上 → 刑啊）。
王朝无敌人：打败聊天室的是"沉底"，每沉一间，就有人开一间新的。
2023-06-03 是橙子呀~ 晚会帖（两千年后的复辟与守灵，结束语化用为墓碑先生隐藏台词）。
2024-12-27 FURRY互关版｜注梦｜ "月满西楼定理"现场。

玩家做的事：读门楣 → 听 laxy 瓦开场白 → 逐层发掘五个发掘点（强制顺序）→
涂鸦墙留一句（3 预设+自由输入，计数 26532→26533 玩家本地视角）→
得「两支持欠条」→ 靠近墓碑先生 5m 听到隐藏台词 → 结算。
玩家没有改变任何历史——只是把"记得它"做成了动词。`,
};

/** 生成五个发掘点的等待/遗物/插话节点（强制顺序 ①→②→③→④→⑤）。 */
function buildDigNodes(): Record<string, import("../../../stories/types").StoryNode> {
  const nodes: Record<string, import("../../../stories/types").StoryNode> = {};
  CHATRUINS_DIG_LAYERS.forEach((layer, index) => {
    const ordinal = "①②③④⑤"[index];
    const chineseIndex = "一二三四五"[index];
    const waitId = `dig-${index + 1}-wait`;
    const revealId = `dig-${index + 1}-reveal`;
    const noteId = `dig-${index + 1}-note`;
    const nextWaitId = index + 1 < CHATRUINS_DIG_LAYERS.length
      ? `dig-${index + 2}-wait`
      : "wall-open";
    const scaleLine = layer.scale ? `\n\n层与层之间的地面刻度带上写着：「${layer.scale}」。` : "";
    const archaeologistEffect = index === CHATRUINS_DIG_LAYERS.length - 1
      ? [{ type: "event.publish" as const, eventType: "s001.achievement.archaeologist" }]
      : [];

    nodes[waitId] = {
      savepoint: true,
      id: waitId,
      title: `发掘点${ordinal}`,
      role: null,
      guide: {
        title: "会沉的城",
        objective: `向下发掘 · 第${chineseIndex}层`,
      },
      text: "当前可挖的层在高亮脉动。灰显的层够不到——\"够不到\"就是最好的提示。",
      choices: [
        {
          id: `dig-layer-${index + 1}`,
          label: "（向下发掘）",
          next: revealId,
        },
      ],
    };
    nodes[revealId] = {
      savepoint: true,
      id: revealId,
      title: `发掘点${ordinal}`,
      role: null,
      presentation: "document",
      text: `「${layer.relic}」\n\n${layer.narration}${scaleLine}`,
      choices: [
        {
          id: `continue-${noteId}`,
          label: "",
          autoAdvance: true,
          next: noteId,
        },
      ],
    };
    nodes[noteId] = {
      savepoint: index === CHATRUINS_DIG_LAYERS.length - 1,
      id: noteId,
      title: "laxy 瓦",
      role: "考古向导",
      text: CHATRUINS_LAYER_NOTES[index]!,
      choices: [
        {
          id: `continue-${nextWaitId}`,
          label: "",
          autoAdvance: true,
          next: nextWaitId,
          effects: archaeologistEffect,
        },
      ],
    };
  });
  return nodes;
}
