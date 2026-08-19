import type { StoryDefinition } from "../../../stories/types";
import mountainPromiseImage from "../../../../assets/cg/echo/mountain-promise.png";
import observatorySongImage from "../../../../assets/cg/echo/observatory-song.png";
import sharedMealImage from "../../../../assets/cg/echo/shared-meal.png";
import starlitCabinImage from "../../../../assets/cg/echo/starlit-cabin.png";

export const ECHO_STORY: StoryDefinition = {
  schemaVersion: 1,
  definitionVersion: 13,
  id: "main.echo.act-one",
  title: "回声",
  startNode: "meeting",
  entryActorId: "linche",
  interactions: [
    { actorId: "linche", nodeId: "cabin-active", choiceId: "invite-cabin" },
    {
      actorId: "linche",
      nodeId: "confrontation-active",
      choiceId: "begin-confrontation",
    },
  ],
  buildingInteractions: [
    {
      buildingId: "archive",
      nodeId: "archive-active",
      choiceId: "read-resident-record",
    },
  ],
  worldInteractions: [
    {
      interestPointId: "echo-stone-pile",
      nodeId: "cracks-start",
      choiceId: "inspect-stones",
    },
    {
      interestPointId: "echo-stone-pile",
      nodeId: "stone-hint",
      choiceId: "stone-question",
    },
    {
      interestPointId: "echo-stone-pile",
      nodeId: "stone-question",
      choiceId: "ask-stones",
    },
    {
      interestPointId: "echo-table",
      nodeId: "cracks-start",
      choiceId: "inspect-table",
    },
    {
      interestPointId: "echo-diary",
      nodeId: "fifth-hub",
      choiceId: "inspect-diary",
    },
    {
      interestPointId: "echo-diary",
      nodeId: "diary-investigation",
      choiceId: "continue-diary-89",
    },
    {
      interestPointId: "echo-diary",
      nodeId: "diary-page-89",
      choiceId: "continue-diary-67",
    },
    {
      interestPointId: "echo-diary",
      nodeId: "diary-page-67",
      choiceId: "continue-diary-30",
    },
    {
      interestPointId: "echo-diary",
      nodeId: "diary-page-30",
      choiceId: "continue-diary-1",
    },
    {
      interestPointId: "echo-diary",
      nodeId: "diary-page-1",
      choiceId: "finish-diary",
    },
    {
      interestPointId: "echo-photo-wall",
      nodeId: "fifth-hub",
      choiceId: "inspect-photo-wall",
    },
    {
      interestPointId: "echo-photo-wall",
      nodeId: "photo-wall-investigation",
      choiceId: "continue-photo-wall-clue",
    },
    {
      interestPointId: "echo-cabin-door",
      nodeId: "fifth-hub",
      choiceId: "exit-cabin",
    },
  ],
  nodes: {
    meeting: {
      id: "meeting",
      title: "林澈",
      role: "气象观测站守望人",
      guide: {
        title: "回声 · 相遇",
        objective: "与气象观测站的林澈交谈",
        visibleWhen: [{ type: "event.occurred", eventType: "story.actor.interacted.linche" }],
      },
      text: "……好久没见到人了。\n\n你是来登山的吗？这条路很少有人走。",
      choices: [
        { id: "ask-alone", label: "你一个人住在这里？", next: "not-alone" },
      ],
    },
    "not-alone": {
      savepoint: false,
      id: "not-alone",
      title: "林澈",
      role: "气象观测站守望人",
      text: "嗯，一个人。\n\n不过……也不算完全一个人。",
      choices: [
        {
          id: "auto-mountain-memory",
          label: "",
          next: "mountain-memory",
          hidden: true,
          autoAdvance: true,
        },
      ],
    },
    "mountain-memory": {
      savepoint: false,
      id: "mountain-memory",
      title: "回忆",
      presentation: "cg",
      image: mountainPromiseImage,
      text: "她说过，最想来这座山,想在山顶看一次日出。\n\n但她没能来。所以我替她来了。\n\n我每天记录这里的一切——天气、风、云的形状、山下的灯火。\n\n用录音笔讲给她听。这样的话……她就能知道这里是什么样子了。",
      choices: [
        {
          id: "auto-recording",
          label: "",
          next: "starlight-memory",
          hidden: true,
          autoAdvance: true,
        },
      ],
    },
    "starlight-memory": {
      savepoint: false,
      id: "starlight-memory",
      title: "回忆",
      presentation: "cg",
      image: starlitCabinImage,
      text: "她喜欢在窗边看星星。\n她说星星会听她说话。\n\n所以我每晚都会对着星空，\n把今天发生的事讲一遍。",
      choices: [
        {
          id: "auto-four-seasons",
          label: "",
          next: "four-seasons",
          hidden: true,
          autoAdvance: true,
        },
      ],
    },
    "four-seasons": {
      savepoint: false,
      id: "four-seasons",
      title: "林澈",
      role: "气象观测站守望人",
      text: "今天是第237天。\n\n我会一直在这里，直到把四季都记录完。\n\n这样她就能看到春天的花、夏天的雨、秋天的叶子、冬天的雪。",
      choices: [{ id: "say-miss", label: "你一定很想她。", next: "request" }],
    },
    request: {
      id: "request",
      title: "林澈",
      role: "气象观测站守望人",
      guide: { title: "回声 · 四季", objective: "回应林澈的请求" },
      text: "嗯。每一天都想。\n\n但只要做这些事，就觉得……她还在身边。\n\n如果你下次还会来的话……能带点牛肉和萝卜吗？ \n\n 哦对了，能带个音乐盒就更好了。",
      choices: [
        {
          id: "accept-wish",
          label: "行吧",
          next: "act-one-complete",
          effects: [
            { type: "event.publish", eventType: "echo.act-one.completed" },
          ],
        },
      ],
    },
    "act-one-complete": {
      id: "act-one-complete",
      title: "林澈",
      role: "气象观测站守望人",
      guide: {
        title: "她的遗愿",
        objective: "购买牛肉、萝卜和音乐盒，再回到气象观测站",
      },
      text: "谢谢。",
      choices: [
        {
          id: "deliver-wish-items",
          label: "交付食材和音乐盒",
          next: "food-delivery",
          availableWhen: [
            { type: "inventory.count", itemId: "beef", atLeast: 1 },
            { type: "inventory.count", itemId: "radish", atLeast: 1 },
            { type: "inventory.count", itemId: "music_box", atLeast: 1 },
          ],
          effects: [
            { type: "inventory.remove", itemId: "beef", quantity: 1 },
            { type: "inventory.remove", itemId: "radish", quantity: 1 },
            { type: "inventory.remove", itemId: "music_box", quantity: 1 },
            { type: "event.publish", eventType: "echo.wish.food.completed" },
            { type: "event.publish", eventType: "echo.wish.music.completed" },
          ],
        },
      ],
    },
    "food-delivery": {
      id: "food-delivery",
      title: "林澈",
      role: "气象观测站守望人",
      text: "她说过，最喜欢这道菜。小时候她妈妈常做给她吃，那是世界上最温暖的味道。",
      choices: [{ id: "continue-meal", label: "继续", next: "shared-meal" }],
    },
    "shared-meal": {
      savepoint: false,
      id: "shared-meal",
      title: "回忆",
      presentation: "cg",
      image: sharedMealImage,
      text: "做好了。\n虽然不知道做得对不对，但闻起来……应该是这个味道。\n你尝尝看？\n嗯……你说好吃就好。\n我也觉得很好吃。\n下次……我再做给你。",
      choices: [
        { id: "continue-food-thanks", label: "继续", next: "food-thanks" },
      ],
    },
    "food-thanks": {
      savepoint: false,
      id: "food-thanks",
      title: "林澈",
      role: "气象观测站守望人",
      text: "感觉……她真的在这里一样。",
      choices: [
        {
          id: "play-music",
          label: "打开音乐盒",
          next: "wish-complete",
        },
      ],
    },
    "wish-complete": {
      savepoint: false,
      id: "wish-complete",
      title: "林澈",
      role: "气象观测站守望人",
      text: "谢谢你。\n\n有你帮忙，我能为她做的事又多了一件。\n\n她一定……很开心吧。",
      choices: [
        {
          id: "ask-how-they-met",
          label: "她为什么来不了了？你们是怎么认识的？",
          next: "bookstore-memory",
        },
      ],
    },
    "bookstore-memory": {
      savepoint: false,
      id: "bookstore-memory",
      title: "林澈",
      role: "气象观测站守望人",
      guide: { title: "她的遗愿", objective: "听林澈讲述他们的相遇" },
      text: "在书店。\n\n那天下着小雨，她站在文学区看书。\n\n我不小心碰掉了她手里的书，然后……就认识了。\n\n她笑起来很好看。像……像阳光穿过雨后的云。",
      choices: [
        {
          id: "auto-start-investigation",
          label: "",
          next: "cracks-start",
          hidden: true,
          autoAdvance: true,
          effects: [
            {
              type: "flag.set",
              flagId: "echo.stonesInvestigated",
              value: false,
            },
            { type: "flag.set", flagId: "echo.foodInvestigated", value: false },
          ],
        },
      ],
    },
    "cracks-start": {
      id: "cracks-start",
      title: "林澈",
      role: "气象观测站守望人",
      text: "（林澈看着照片，不再言语。\n\n再在屋内屋外随便转转吧。）",
      choices: [
        {
          id: "inspect-stones",
          label: "看看石堆",
          next: "stone-hint",
          hidden: true,
        },
        {
          id: "inspect-table",
          label: "差不多离开了",
          next: "third-act-complete",
          hidden: true,
        },
      ],
    },
    "stone-hint": {
      savepoint: false,
      id: "stone-hint",
      text: "散乱的石堆，每一个代表一天，估计有几百个",
      choices: [
        {
          id: "stone-question",
          label: "返回询问林澈",
          next: "stone-question",
        },
      ],
    },
    "stone-question": {
      savepoint: false,
      id: "stone-question",
      title: "林澈",
      role: "气象观测站守望人",
      guide: { title: "回声 · 裂痕", objective: "询问石堆的数量" },
      text: "怎么了？",
      choices: [
        {
          id: "ask-stones",
          label: "这些石头是你垒的吗？",
          next: "stone-count",
        },
      ],
    },
    "stone-count": {
      savepoint: false,
      id: "stone-count",
      title: "林澈",
      role: "气象观测站守望人",
      guide: { title: "回声 · 裂痕", objective: "指出天数矛盾" },
      text: "嗯，每天垒一个，用来计日。\n\n今天是第237天。",
      choices: [
        {
          id: "challenge-count",
          label: "但石头有512个……",
          next: "stone-excuse",
        },
      ],
    },
    "stone-excuse": {
      savepoint: false,
      id: "stone-excuse",
      title: "林澈",
      role: "气象观测站守望人",
      guide: { title: "回声 · 裂痕", objective: "听林澈解释" },
      text: "……\n\n是吗？\n\n可能……是我数错了。\n\n有时候我会忘记今天垒过没有，所以……可能垒了两次。\n\n也有可能……我记错天数了。\n\n反正……也没人在意这些。",
      choices: [
        {
          id: "finish-stone-investigation",
          label: "沉默",
          next: "third-act-complete",
          effects: [
            {
              type: "flag.set",
              flagId: "echo.stonesInvestigated",
              value: true,
            },
          ],
        },
      ],
    },

    "third-act-complete": {
      id: "third-act-complete",
      guide: { title: "回声 · 调查", objective: "到底发生了什么？" },
      text: "真是个怪人",
      choices: [
        {
          id: "start-archive-investigation",
          label: "前往小城档案馆",
          next: "archive-active",
          effects: [
            { type: "event.publish", eventType: "echo.act-four.accepted" },
          ],
        },
      ],
    },
    "archive-active": {
      savepoint: false,
      id: "archive-active",
      activeActorIds: ["archive_elder"],
      guide: {
        title: "回声 · 调查",
        objective: "前往小城档案馆查找林澈的居民档案",
      },
      text: "也许档案馆里保存着林澈过去的记录。",
      choices: [
        {
          id: "read-resident-record",
          label: "查看居民档案",
          next: "archive-record",
          hidden: true,
        },
      ],
    },
    "archive-record": {
      savepoint: false,
      id: "archive-record",
      title: "居民档案",
      role: "小城档案馆",
      presentation: "document",
      activeActorIds: ["archive_elder"],
      text: "姓名：林澈\n性别：男\n出生日期：1996年3月14日\n现住址：郊区气象观测站\n\n性格内向，不善交际。\n小学至高中期间长期独自一人。\n大学毕业后搬至郊区。\n无固定工作。",
      choices: [
        {
        id: "archive-elder-story",
          label: "问问路人",
          next: "archive-elder-story",
        },
      ],
    },
    "archive-elder-story": {
      savepoint: false,
      id: "archive-elder-story",
      title: "档案馆老人",
      role: "旧城居民",
      activeActorIds: ["archive_elder"],
      guide: { title: "回声 · 调查", objective: "听老人讲述林澈的过去" },
      text: "林澈啊……那孩子从小就一个人。\n\n后来搬到山上去了，就更少见到他了。",
      choices: [
        {
          id: "complete-archive-investigation",
          label: "谢谢您。",
          next: "fourth-act-complete",
          effects: [
            { type: "event.publish", eventType: "echo.act-four.completed" },
          ],
        },
      ],
    },
    "fourth-act-complete": {
      id: "fourth-act-complete",
      terminal: true,
      choices: [
        {
          id: "start-fifth-act",
          label: "再去找找他",
          next: "cabin-active",
          effects: [
            {
              type: "flag.set",
              flagId: "echo.photoWallInvestigated",
              value: false,
            },
            {
              type: "flag.set",
              flagId: "echo.diaryInvestigated",
              value: false,
            },
            { type: "event.publish", eventType: "echo.act-five.accepted" },
          ],
        },
      ],
      text: "林澈一直独自一人呢\n\n也许……他一直在等她回来。",
    },
    "cabin-active": {
      id: "cabin-active",
      title: "再去找找他",
      role: "第五幕",
      guide: { title: "再去找找他", objective: "回到观测站与林澈交谈" },
      text: "林澈站在木屋门前，似乎正在等你。",
      choices: [
        {
          id: "invite-cabin",
          label: "与林澈交谈",
          next: "cabin-invitation",
          hidden: true,
        },
      ],
    },
    "cabin-invitation": {
      savepoint: false,
      id: "cabin-invitation",
      title: "林澈",
      role: "气象观测站守望人",
      guide: { title: "再去找找他", objective: "跟随林澈进入木屋" },
      text: "你又来了。外面风大，进屋坐一会儿吧。屋里有些乱，希望你别介意。",
      choices: [
        {
          id: "enter-cabin",
          label: "跟他进去",
          next: "fifth-hub",
          effects: [{ type: "event.publish", eventType: "echo.cabin.entered" }],
        },
      ],
    },
    "fifth-hub": {
      id: "fifth-hub",
      title: "木屋",
      role: "室内调查",
      guide: { title: "回声 · 真相", objective: "转转吧？" },
      text: "木屋里很安静。照片墙占据了整面墙，桌上放着一本翻旧的日记。",
      choices: [
        {
          id: "inspect-photo-wall",
          label: "查看照片墙",
          next: "photo-wall-investigation",
          hidden: true,
          availableWhen: [
            {
              type: "flag.equals",
              flagId: "echo.photoWallInvestigated",
              value: false,
            },
          ],
        },
        {
          id: "inspect-diary",
          label: "查看日记",
          next: "diary-investigation",
          hidden: true,
          availableWhen: [
            {
              type: "flag.equals",
              flagId: "echo.diaryInvestigated",
              value: false,
            },
          ],
        },
        {
          id: "leave-cabin",
          label: "离开木屋",
          next: "fifth-act-complete",
          availableWhen: [
            {
              type: "flag.equals",
              flagId: "echo.photoWallInvestigated",
              value: true,
            },
            {
              type: "flag.equals",
              flagId: "echo.diaryInvestigated",
              value: true,
            },
          ],
        },
        {
          id: "exit-cabin",
          label: "从门离开",
          next: "cabin-active",
          hidden: true,
          effects: [{ type: "event.publish", eventType: "echo.cabin.exited" }],
        },
      ],
    },
    "photo-wall-investigation": {
      savepoint: false,
      id: "photo-wall-investigation",
      title: "照片墙",
      role: "调查线索",
      presentation: "cg",
      guide: { title: "回声 · 真相", objective: "查看木屋里的照片墙" },
      text: "几十张照片密密麻麻贴在墙上。\n\n照片里永远只有林澈一个人。\n\n",
      choices: [
        {
          id: "continue-photo-wall-clue",
          label: "她去哪了......",
          next: "fifth-hub",
          effects: [
            {
              type: "flag.set",
              flagId: "echo.photoWallInvestigated",
              value: true,
            },
          ],
        },
      ],
    },
    "diary-investigation": {
      savepoint: false,
      id: "diary-investigation",
      title: "日记 · 第50页",
      role: "木屋里的日记",
      presentation: "document",
      guide: { title: "回声 · 真相", objective: "继续翻阅桌上的日记" },
      text: "今天天气很好。\n\n她说过想看雪。\n\n所以我在等冬天。\n\n冬天来了，她就能看到了。",
      choices: [
        { id: "continue-diary-89", label: "继续翻阅", next: "diary-page-89" },
      ],
    },
    "diary-page-89": {
      savepoint: false,
      id: "diary-page-89",
      title: "日记 · 第89页",
      role: "木屋里的日记",
      presentation: "document",
      text: "今天做了她最喜欢的菜。\n\n她说好吃。\n\n我也觉得很好吃。",
      choices: [
        { id: "continue-diary-67", label: "继续翻阅", next: "diary-page-67" },
      ],
    },
    "diary-page-67": {
      savepoint: false,
      id: "diary-page-67",
      title: "日记 · 第67页",
      role: "木屋里的日记",
      presentation: "document",
      text: "讲得多了，就像真的发生过一样。\n\n这样也好。\n\n至少……不那么空。",
      choices: [
        { id: "continue-diary-30", label: "继续翻阅", next: "diary-page-30" },
      ],
    },
    "diary-page-30": {
      savepoint: false,
      id: "diary-page-30",
      title: "日记 · 第30页",
      role: "木屋里的日记",
      presentation: "document",
      text: "她很温柔，喜欢看星星，喜欢这座山。\n\n她说想和我一起来这里。",
      choices: [
        { id: "continue-diary-1", label: "继续翻阅", next: "diary-page-1" },
      ],
    },
    "diary-page-1": {
      savepoint: false,
      id: "diary-page-1",
      title: "日记 · 第1页",
      role: "木屋里的日记",
      presentation: "document",
      text: "第一天。\n\n这里很安静。",
      choices: [
        {
          id: "finish-diary",
          label: "合上日记",
          next: "fifth-hub",
          effects: [
            { type: "flag.set", flagId: "echo.diaryInvestigated", value: true },
          ],
        },
      ],
    },

    "fifth-act-complete": {
      savepoint: false,
      id: "fifth-act-complete",
      title: "真相",
      role: "内心独白",
      presentation: "blackout",
      text: "……",
      choices: [
        {
          id: "continue-sixth-act",
          label: "出去找林澈",
          next: "confrontation-active",
          hidden: true,
          effects: [
            { type: "event.publish", eventType: "echo.cabin.exited" },
            { type: "event.publish", eventType: "echo.act-five.completed" },
          ],
        },
      ],
    },
    "confrontation-active": {
      savepoint: false,
      id: "confrontation-active",
      text: "林澈就在屋外。该把你看到的一切告诉他了。",
      choices: [
        {
          id: "begin-confrontation",
          label: "林澈...？",
          next: "confrontation",
          hidden: true,
        },
      ],
    },
    confrontation: {
      id: "confrontation",
      title: "林澈",
      role: "气象观测站守望人",
      text: "嗯？",
      choices: [
        {
          id: "reveal-truth",
          label: "她不存在，对吧？",
          next: "truth-question",
        },
        {
          id: "protect-fantasy",
          label: "你一定很想她。",
          next: "loop-response",
        },
        {
          id: "leave-silent",
          label: "(什么都不说，离开)。",
          next: "abandon-confirm",
        },
      ],
    },
    "abandon-confirm": {
      savepoint: false,
      id: "abandon-confirm",
      title: "林澈",
      role: "最后的确认",
      text: "……谢谢你之前帮我的忙。",
      choices: [
        {
          id: "confirm-abandon",
          label: "离开",
          next: "forgotten-ending",
          ending: "forgotten",
          effects: [
            { type: "event.publish", eventType: "echo.ending.forgotten" },
          ],
        },
        {
          id: "reconsider-confrontation",
          label: "等等",
          next: "confrontation",
        },
      ],
    },
    "forgotten-ending": {
      id: "forgotten-ending",
      title: "回声 · 遗忘",
      role: "坏结局",
      presentation: "cg",
      terminal: true,
      guide: { title: "回声 · 遗忘", objective: "剧情已结束" },
      text: "第二天，报摊旁的人说，气象站里的那个人已经搬走了。\n\n你重新来到观测站。石堆被风吹乱，桌上的碗筷落了灰，音乐盒停在窗边。\n\n纸条上写着：谢谢你之前的帮助。我决定离开这里了。只要一直讲，她就一直在。对吧？",
      choices: [
        {
          id: "continue-forgotten-blackout",
          label: "继续",
          next: "forgotten-blackout",
          hidden: true,
        },
      ],
    },
    "forgotten-blackout": {
      savepoint: false,
      id: "forgotten-blackout",
      title: "回声 · 遗忘",
      role: "坏结局",
      presentation: "blackout",
      terminal: true,
      text: "你再也没有见过他。\n\n没有人知道他去了哪里。\n\n就像……他从未存在过一样。",
      choices: [
        {
          id: "continue-forgotten-end",
          label: "结束",
          next: "forgotten-complete",
          hidden: true,
          effects: [
            { type: "event.publish", eventType: "echo.achievement.unnoticed" },
          ],
        },
      ],
    },
    "forgotten-complete": {
      id: "forgotten-complete",
      title: "回声 · 遗忘",
      role: "任务完成",
      terminal: true,
      guide: null,
      text: "没有人记得他来过。",
    },
    "loop-response": {
      savepoint: false,
      id: "loop-response",
      title: "林澈",
      role: "气象观测站守望人",
      text: "……嗯。每一天都想。\n\n所以我要继续待在这里，继续记录，继续讲给她听。\n\n谢谢你理解。她一定也很感谢你。",
      choices: [
        {
          id: "continue-loop-confusion",
          label: "继续听下去",
          next: "loop-confusion",
        },
      ],
    },
    "loop-confusion": {
      savepoint: false,
      id: "loop-confusion",
      title: "林澈",
      role: "逐渐混乱的故事",
      text: "我是为了她才来的……",
      choices: [
        { id: "confirm-loop", label: "是的，是为了她。", next: "loop-blackout" },
        { id: "silent-loop", label: "……", next: "loop-blackout" },
      ],
    },
    "loop-blackout": {
      id: "loop-blackout",
      title: "回声 · 循环",
      role: "真结局",
      presentation: "blackout",
      terminal: true,
      text: "你们从前出去到旷野，是要看什么呢？\n\n要看风吹动的芦苇吗？ \n\n ----《马太福音》",
      choices: [
        {
          id: "continue-loop-end",
          label: "结束",
          next: "loop-complete",
          ending: "loop",
          hidden: true,
          effects: [
            { type: "event.publish", eventType: "echo.ending.loop" },
            {
              type: "event.publish",
              eventType: "echo.achievement.eternal-lie",
            },
          ],
        },
      ],
    },
    "loop-complete": {
      id: "loop-complete",
      title: "回声 · 循环",
      role: "真结局",
      terminal: true,
      guide: null,
      text: "下一次，要编一个什么故事呢？",
    },
    "truth-question": {
      savepoint: false,
      id: "truth-question",
      title: "林澈",
      role: "真相",
      text: "……你什么时候发现的？",
      choices: [
        {
          id: "truth-from-photos",
          label: "从照片开始怀疑。",
          next: "truth-admission",
        },
        {
          id: "truth-from-description",
          label: "你的描述一直在变。",
          next: "truth-admission",
        },
        {
          id: "truth-from-records",
          label: "档案里没有她的记录。",
          next: "truth-admission",
        },
        {
          id: "truth-from-stones",
          label: "石堆的数量不对。",
          next: "truth-admission",
        },
      ],
    },
    "truth-admission": {
      savepoint: false,
      id: "truth-admission",
      title: "林澈",
      role: "真相",
      text: "是吗……我以为我演得还不错。\n\n或者说，我以为我已经相信了。",
      choices: [
        {
          id: "continue-truth-memory",
          label: "听他说下去",
          next: "truth-memory",
        },
      ],
    },
    "truth-memory": {
      id: "truth-memory",
      title: "林澈的自白",
      role: "真相",
      presentation: "cg",
      text: "她很温柔，会听我说话，会在意我。她想来这座山，想和我一起看四季。",
      choices: [
        { id: "ask-why", label: "为什么要这么做？", next: "truth-why" },
        { id: "suggest-town", label: "你可以回小城去。", next: "truth-town" },
        { id: "offer-visits", label: "我可以来看你。", next: "support-offer" },
      ],
    },

    "truth-why": {
      savepoint: false,
      id: "truth-why",
      title: "林澈",
      role: "坦白",
      text: "如果不给自己编个理由，我连明天为什么要睁开眼都不知道。\n\n哪怕这个理由是假的，至少在故事里，我不是一个人。",
      choices: [
        {
          id: "continue-support-from-why",
          label: "我可以来看你。",
          next: "support-offer",
        },
      ],
    },
    "truth-town": {
      savepoint: false,
      id: "truth-town",
      title: "林澈",
      role: "坦白",
      text: "回去做什么？在小城里，我也是一个人。\n\n至少在这里，我可以编一个有人陪伴的世界。",
      choices: [
        {
          id: "continue-support-from-town",
          label: "那我可以来看你。",
          next: "support-offer",
        },
      ],
    },
    "support-offer": {
      savepoint: false,
      id: "support-offer",
      title: "林澈",
      role: "真实的邀请",
      text: "……什么？",
      choices: [
        {
          id: "promise-visits",
          label: "我会来看你的。",
          next: "truth-ending",
        },
        {
          id: "stop-inventing",
          label: "你不用再编故事了。",
          next: "truth-ending",
        },
      ],
    },
    "truth-ending": {
      id: "truth-ending",
      title: "回声 · 真相",
      role: "好结局",
      presentation: "cg",
      text: "谢谢你来到这里。谢谢你听我说话。",
      choices: [
        {
          id: "continue-truth-complete",
          label: "继续",
          next: "truth-complete",
          ending: "truth",
          effects: [
            { type: "event.publish", eventType: "echo.ending.truth" },
            { type: "event.publish", eventType: "echo.achievement.real-echo" },
          ],
        },
      ],
    },
    "truth-complete": {
      id: "truth-complete",
      title: "回声 · 真相",
      role: "好结局",
      guide: { title: "回声 · 陪伴", objective: "以后再来看看林澈" },
      text: "你来了就好。\n\n我拆掉了一些墙上的照片。墙空了，就能挂一些真的照片了。对吧？",
      choices: [
        {
          id: "continue-begin-epilogue",
          label: "继续",
          next: "visit-one-memory",
          hidden: true,
          effects: [
            { type: "event.publish", eventType: "echo.epilogue.unlocked" },
          ],
        },
      ],
    },
    "visit-one-memory": {
      savepoint: false,
      id: "visit-one-memory",
      title: "黄昏的观测站",
      role: "真实的回访",
      presentation: "cg",
      text: "这几天，我一直在想。\n\n想你是不是真的会来，还是那也是我编的。",
      choices: [
        {
          id: "continue-visit-thanks",
          label: "结束这次回访",
          next: "visit-thanks",
          effects: [
            {
              type: "event.publish",
              eventType: "echo.epilogue.visit-one.completed",
            },
          ],
        },
      ],
    },
    "visit-thanks": {
      savepoint: false,
      id: "visit-thanks",
      title: "林澈",
      role: "终章",
      text: "谢谢你。\n\n真的，谢谢。",
      choices: [
        {
          id: "continue-epilogue-complete",
          label: "结束",
          next: "epilogue-complete",
          effects: [
            { type: "event.publish", eventType: "echo.epilogue.completed" },
            { type: "event.publish", eventType: "echo.achievement.true-dawn" },
          ],
        },
      ],
    },
    "epilogue-complete": {
      id: "epilogue-complete",
      title: "回声",
      role: "好结局",
      presentation: "blackout",
      terminal: true,
      guide: null,
      text: "在那之后，你偶尔还会去看他。\n\n或许孤独从未真正消失。\n\n但至少，它有了回声。",
    },
  },
};
