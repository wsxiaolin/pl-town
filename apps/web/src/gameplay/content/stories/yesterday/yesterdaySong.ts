import type { StoryDefinition } from "../../../stories/types";

/**
 * 支线剧情 · 昨日之歌
 *
 * 改编自冬目景《昨日之歌》的精神内核——
 * "未被说出口的东西，在后来的某一天被陌生人接住"。
 *
 * 玩家是城市的普通居民，在日常探索中发现一本 1997 年的日记，
 * 走过一段关于沉默、见证与时间回音的旅程。
 *
 * 玩家从头到尾没有改变任何人的命运——只是见证了时间的回音。
 *
 * @see docs/story-authoring.md
 */
export const YESTERDAY_SONG: StoryDefinition = {
  schemaVersion: 1,
  definitionVersion: 1,
  id: "side.yesterday.spring-1997",
  title: "昨日之歌",
  startNode: "diary-discovery",
  // 剧情通过建筑交互触发：访问档案馆时发现日记。
  // 后续在报摊与秋嫂、画翁交互。
  buildingInteractions: [
    {
      buildingId: "archive",
      nodeId: "diary-discovery",
      choiceId: "find-diary",
    },
    {
      buildingId: "newsstand",
      nodeId: "diary-recognized",
      choiceId: "talk-to-qiu",
    },
    {
      buildingId: "newsstand",
      nodeId: "wednesday-wait",
      choiceId: "wait-wednesday",
    },
  ],
  interactions: [
    // 与秋嫂交谈（报摊节点触发后）
    {
      actorId: "qiu",
      nodeId: "qiu-intro",
      choiceId: "show-diary-to-qiu",
    },
    // 与画翁交谈（周三到达后）
    {
      actorId: "huaweng",
      nodeId: "painter-arrives",
      choiceId: "approach-painter",
    },
  ],
  nodes: {
    // ─── Act 1: 日记 ──────────────────────────────────────────────
    "diary-discovery": {
      id: "diary-discovery",
      title: "档案馆",
      role: "旧城居民",
      guide: {
        title: "昨日之歌 · 日记",
        objective: "在档案馆翻找旧书时，你发现了一本泛黄的日记。",
      },
      text: "档案馆的旧书摊上，一本泛黄的日记静静躺在角落。\n\n封面上用钢笔写着「1997年·春」，纸页已经脆了，但字迹还很清晰。\n\n你翻开了第一页。",
      choices: [
        {
          id: "find-diary",
          label: "翻开日记",
          next: "diary-cover",
          effects: [
            { type: "flag.set", flagId: "yesterday.diary-found", value: true },
            { type: "event.publish", eventType: "yesterday.diary.found" },
          ],
        },
      ],
    },
    "diary-cover": {
      savepoint: false,
      id: "diary-cover",
      title: "日记",
      presentation: "document",
      text: "扉页上写着一行小字——\n\n「如果有一天有人捡到这本日记，请替我记住这些下午。」\n\n字迹是高中女生的，圆润而认真。",
      choices: [
        {
          id: "read-page-1",
          label: "往下翻",
          next: "diary-page-1",
          autoAdvance: true,
          hidden: true,
        },
      ],
    },
    "diary-page-1": {
      savepoint: false,
      id: "diary-page-1",
      title: "日记",
      presentation: "document",
      text: "「3月14日\n\n今天又看到他在天台画画。我假装路过三次。\n\n他好像在画远处的天际线，也好像在画什么我看不懂的东西。\n\n风吹起他的画纸时，他用手按住，那个动作很温柔。」",
      choices: [
        {
          id: "read-page-2",
          label: "继续翻",
          next: "diary-page-2",
          autoAdvance: true,
          hidden: true,
        },
      ],
    },
    "diary-page-2": {
      savepoint: false,
      id: "diary-page-2",
      title: "日记",
      presentation: "document",
      text: "「3月20日\n\n毕业典礼那天，我没敢把信给他。\n\n信叠了四次，又拆了四次。最后我把它夹在日记最后一页。\n\n也许他永远不会看到。但至少，它在这里。」",
      choices: [
        {
          id: "read-page-3",
          label: "继续翻",
          next: "diary-page-3",
          autoAdvance: true,
          hidden: true,
        },
      ],
    },
    "diary-page-3": {
      savepoint: false,
      id: "diary-page-3",
      title: "日记",
      presentation: "document",
      text: "「后来听说他去了东京学美术。我不知道该高兴还是难过。\n\n高兴的是他终于去了他想去的地方。难过的是，那之后我再也没有理由去天台了。」",
      choices: [
        {
          id: "read-photo",
          label: "翻到最后",
          next: "diary-photo",
          autoAdvance: true,
          hidden: true,
        },
      ],
    },
    "diary-photo": {
      savepoint: false,
      id: "diary-photo",
      title: "照片",
      presentation: "document",
      text: "日记最后一页夹着一张褪色的照片。\n\n天台栏杆边，一个男生背对镜头，画远处的小镇天际线。阳光把他的影子拉得很长。\n\n你盯着照片里的栏杆——那锈迹的弧度，你认出来了。\n\n就是你住的这栋楼的天台。",
      choices: [
        {
          id: "recognize-rooftop",
          label: "……这不就是我住的地方？",
          next: "diary-recognized",
        },
      ],
    },
    "diary-recognized": {
      id: "diary-recognized",
      title: "昨日之歌",
      role: "旧城居民",
      guide: {
        title: "昨日之歌 · 线索",
        objective: "去报摊找秋嫂聊聊，看看她认不认识照片里的人。",
      },
      text: "你合上日记，心跳有点快。\n\n你每天经过的那个天台——三十年前，有人在那里被认真地注视过。\n\n你把日记揣进口袋。报摊的秋嫂消息最灵通，也许她知道什么。",
      choices: [
        {
          id: "talk-to-qiu",
          label: "去报摊找秋嫂",
          next: "qiu-intro",
        },
      ],
    },

    // ─── Act 2: 报摊 ──────────────────────────────────────────────
    "qiu-intro": {
      id: "qiu-intro",
      title: "秋嫂",
      role: "报摊婆婆",
      guide: {
        title: "昨日之歌 · 秋嫂",
        objective: "把日记给秋嫂看看。",
      },
      text: "「哟，今天怎么有空来坐？」秋嫂把一份报纸拍整齐，抬眼看你。\n\n你在她对面坐下，把日记掏出来，翻到照片那页推过去。",
      choices: [
        {
          id: "show-diary-to-qiu",
          label: "「秋嫂，你认得这个人吗？」",
          next: "qiu-recognizes",
        },
      ],
    },
    "qiu-recognizes": {
      savepoint: false,
      id: "qiu-recognizes",
      title: "秋嫂",
      role: "报摊婆婆",
      text: "秋嫂拿起照片，眯着眼看了半天。然后她笑了——\n\n「哦，这男的我认识。」",
      choices: [
        {
          id: "qiu-explains",
          label: "继续听",
          next: "qiu-explains",
          autoAdvance: true,
          hidden: true,
        },
      ],
    },
    "qiu-explains": {
      id: "qiu-explains",
      title: "秋嫂",
      role: "报摊婆婆",
      guide: {
        title: "昨日之歌 · 周三",
        objective: "秋嫂说他每周三都来买烟。下一个周三，来报摊等着。",
      },
      text: "「他现在每周三下午还来我店里买烟呢。一买就是三十年，从年轻小伙子买成了白头发。」\n\n秋嫂把照片推回来。「你要是想见他，下个周三来坐着等就是了。」\n\n你点点头。日记在你口袋里，像一块温热的石头。",
      choices: [
        {
          id: "wait-wednesday",
          label: "好，我下周三来",
          next: "wednesday-wait",
          effects: [
            { type: "flag.set", flagId: "yesterday.qiu-recognized", value: true },
            { type: "event.publish", eventType: "yesterday.qiu.recognized" },
          ],
        },
      ],
    },

    // ─── Act 3: 周三 ──────────────────────────────────────────────
    "wednesday-wait": {
      id: "wednesday-wait",
      title: "昨日之歌",
      role: "旧城居民",
      // 需要过一天才进入（周三）
      unlockAfterGameDays: 1,
      guide: {
        title: "昨日之歌 · 等待",
        objective: "周三到了，去报摊等着。",
      },
      text: "周三到了。\n\n你一大早就去了报摊，坐在窗边那个位置。秋嫂给你倒了杯茶，什么也没问。",
      choices: [
        {
          id: "wait-wednesday",
          label: "坐下来等",
          next: "painter-arrives",
          effects: [
            { type: "flag.set", flagId: "yesterday.waiting-wednesday", value: true },
          ],
        },
      ],
    },
    "painter-arrives": {
      id: "painter-arrives",
      title: "画翁",
      role: "老画家",
      activeActorIds: ["huaweng"],
      guide: {
        title: "昨日之歌 · 相遇",
        objective: "一个头发花白的男人推门走进了报摊。",
      },
      text: "门帘一响，一个头发花白的男人走了进来。\n\n他穿着旧衬衫，袖口沾着干涸的颜料。走到柜台前，秋嫂头也没抬：「老规矩？」\n\n「老规矩。」他点了一根烟。\n\n你的手按在口袋里的日记上。",
      choices: [
        {
          id: "approach-painter",
          label: "走过去，把日记放在他面前",
          next: "painter-reads",
          effects: [
            { type: "flag.set", flagId: "yesterday.diary-shown", value: true },
            { type: "flag.set", flagId: "yesterday.painter-met", value: true },
            { type: "event.publish", eventType: "yesterday.painter.met" },
          ],
        },
        {
          id: "stay-silent",
          label: "什么都不做，看着他买完烟离开",
          next: "silent-observation",
          effects: [
            { type: "flag.set", flagId: "yesterday.painter-met", value: true },
            { type: "flag.set", flagId: "yesterday.silent-choice", value: true },
            { type: "event.publish", eventType: "yesterday.painter.met" },
          ],
        },
      ],
    },

    // ─── Act 4a: 递出日记 ─────────────────────────────────────────
    "painter-reads": {
      savepoint: false,
      id: "painter-reads",
      title: "画翁",
      role: "老画家",
      text: "你把日记放在柜台上。\n\n他看了一眼封面——「1997年·春」——手停在半空。\n\n然后他翻开了日记。一页一页地，很慢地翻过去。\n\n翻到最后一页，照片滑了出来。他盯着照片，看了很久。",
      choices: [
        {
          id: "painter-silence",
          label: "",
          next: "painter-silence",
          hidden: true,
          autoAdvance: true,
        },
      ],
    },
    "painter-silence": {
      savepoint: false,
      id: "painter-silence",
      title: "画翁",
      role: "老画家",
      text: "沉默了很久。\n\n整个报摊里只有挂钟的滴答声和秋嫂翻报纸的声音。\n\n窗外有风吹过，吹动了他的衬衫一角。",
      choices: [
        {
          id: "painter-speaks",
          label: "",
          next: "painter-speaks",
          hidden: true,
          autoAdvance: true,
        },
      ],
    },
    "painter-speaks": {
      savepoint: false,
      id: "painter-speaks",
      title: "画翁",
      role: "老画家",
      text: "他终于开口了。\n\n「谢谢。」\n\n「但我已经画了三十年，还是没画出那天下午的颜色。」\n\n他把日记还给你。不是因为他不在乎——而是他已经不需要那封信了。\n\n他需要的只是有人知道——1997年的春天，确实有人认真看过他画画。",
      choices: [
        {
          id: "painter-returns",
          label: "",
          next: "painter-returns",
          hidden: true,
          autoAdvance: true,
        },
      ],
    },
    "painter-returns": {
      savepoint: false,
      id: "painter-returns",
      title: "昨日之歌",
      role: "老画家",
      text: "他走出报摊。风吹起他衬衫的一角，阳光把他的影子拉得很长——和照片里那个少年的影子，重叠了一瞬。\n\n然后他骑上自行车，消失在街角。",
      choices: [
        {
          id: "wind-moment",
          label: "",
          next: "wind-moment",
          hidden: true,
          autoAdvance: true,
        },
      ],
    },
    "wind-moment": {
      savepoint: false,
      id: "wind-moment",
      title: "昨日之歌",
      presentation: "blackout",
      text: "你站在报摊门口，看着空荡荡的街。\n\n你突然觉得——他其实不需要那封信了。他需要的只是有人知道，1997年的春天，确实有人认真看过他画画。\n\n而现在，你知道了。\n\n你没有改变任何人的命运。你只是接住了那束三十年前的光。",
      choices: [
        {
          id: "ending-witness",
          label: "结束",
          next: "ending-witness",
          effects: [
            { type: "event.publish", eventType: "yesterday.ending.witness" },
            { type: "event.publish", eventType: "yesterday.achievement.witness" },
          ],
        },
      ],
    },
    "ending-witness": {
      id: "ending-witness",
      title: "昨日之歌",
      role: "见证",
      presentation: "blackout",
      guide: null,
      achievement: { id: "yesterday_witness", name: "见证者" },
      text: "日记回到了你手里。\n\n你把它放回档案馆的旧书摊，放在最显眼的位置。\n\n也许有一天，那个女生——或者她的女儿——会找到它。\n\n也许不会。\n\n但至少，你知道了。",
      choices: [
        {
          id: "continue-epilogue-witness",
          label: "继续",
          next: "epilogue-cats",
        },
      ],
    },

    // ─── Act 4b: 沉默 ─────────────────────────────────────────────
    "silent-observation": {
      savepoint: false,
      id: "silent-observation",
      title: "昨日之歌",
      role: "旧城居民",
      text: "你坐在窗边，看着他从口袋里掏出零钱，买了一包烟。\n\n他点了烟，在门口站了一会儿，望了望街对面。\n\n然后他骑上自行车，消失在街角。\n\n他不知道你口袋里有一本日记。他不知道有人曾在天台认真地看过他画画。他什么都不知道。",
      choices: [
        {
          id: "ending-silence",
          label: "结束",
          next: "ending-silence",
          effects: [
            { type: "event.publish", eventType: "yesterday.ending.silence" },
            { type: "event.publish", eventType: "yesterday.achievement.silence" },
          ],
        },
      ],
    },
    "ending-silence": {
      id: "ending-silence",
      title: "昨日之歌",
      role: "沉默",
      presentation: "blackout",
      guide: null,
      achievement: { id: "yesterday_silence", name: "沉默是金" },
      text: "你把日记带回了家，放在书架上。\n\n有些东西不需要被说出来。有些信不需要被递出去。\n\n你知道了，这就够了。\n\n「风会记住所有未说出口的话，然后把它们吹向另一个方向。」",
      choices: [
        {
          id: "continue-epilogue-silence",
          label: "继续",
          next: "epilogue-cats",
        },
      ],
    },

    // ─── 尾声：野猫 ────────────────────────────────────────────────
    "epilogue-cats": {
      id: "epilogue-cats",
      title: "昨日之歌",
      role: "尾声",
      guide: {
        title: "昨日之歌 · 尾声",
        objective: "在城里走走，让这件事过去。",
      },
      text: "后来的一天，你在城里闲逛，经过河边。\n\n一只野猫蹲在岸边，看了你一眼，又转过头去。\n\n它谁也不等。它只是住在这里，像这条河一样。\n\n你突然想——也许它是当年那只猫的曾孙女。三十年前，也许有个高中女生也曾在这条河边，一边逗猫，一边假装路过天台。\n\n猫不知道这些。它只知道此刻的阳光是暖的，你是路过的、不讨厌的人。\n\n这样就够了。",
      choices: [
        {
          id: "epilogue-complete",
          label: "结束",
          next: "epilogue-complete",
          effects: [
            { type: "event.publish", eventType: "yesterday.epilogue.completed" },
            { type: "event.publish", eventType: "yesterday.achievement.true-dawn" },
          ],
        },
      ],
    },
    "epilogue-complete": {
      id: "epilogue-complete",
      title: "昨日之歌",
      role: "完",
      presentation: "blackout",
      terminal: true,
      guide: null,
      achievement: { id: "yesterday_true_dawn", name: "昨日之歌" },
      text: "你站起身，拍了拍膝盖上的灰。\n\n太阳已经升起来了。\n\n「昨日是一首歌。你听见了，然后继续往前走。」",
    },
  },

  sourceText: `改编自冬目景《昨日之歌》的精神内核。

玩家是城市的居民。在城市日常中，于档案馆发现一本 1997 年的日记。
"今天又看到他在天台画画。我假装路过三次。"
"毕业典礼那天，我没敢把信给他。"
"后来听说他去了东京学美术。我不知道该高兴还是难过。"

最后一页夹着褪色照片：天台栏杆边，一个男生在画远处的小镇天际线。
你认出那个天台——就是城里的某栋楼。

跟报摊的秋嫂提了这事。秋嫂看了一眼照片，笑了："这男的我认识。他现在每周三下午还来我摊上买烟呢。"

周三到了。你在报摊旁，等一个头发花白的男人走来。
你可以走过去把日记放在他面前，也可以什么都不做。

如果你选择了放——
他翻到最后一页，沉默了很久。然后说："谢谢。但我已经画了三十年，还是没画出那天下午的颜色。"
他把日记还给你，走出报摊。风吹起他衬衫的一角。

这不是爱情故事，是关于"未被说出口的东西，在后来的某一天被陌生人接住"。
玩家从头到尾没有改变任何人的命运。只是见证了时间的回音。

而城里河边的那只野猫，可能是当年那只猫的曾孙女。它谁也不等，只是住在那里。`,
};
