import type { StoryDefinition } from "../../stories/types";
import mountainPromiseImage from "../../../assets/cg/echo/mountain-promise.png";
import observatorySongImage from "../../../assets/cg/echo/observatory-song.png";
import sharedMealImage from "../../../assets/cg/echo/shared-meal.png";
import starlitCabinImage from "../../../assets/cg/echo/starlit-cabin.png";

export const ECHO_STORY: StoryDefinition = {
  schemaVersion: 1,
  definitionVersion: 9,
  id: "main.echo.act-one",
  title: "回声",
  startNode: "meeting",
  entryActorId: "linche",
  legacyNodeAliases: {
    "visit-two-active": "visit-six-active",
    "visit-two": "visit-six-active",
    "visit-two-memory": "visit-six-active",
    "visit-three-active": "visit-six-active",
    "visit-three": "visit-six-active",
    "visit-three-memory": "visit-six-active",
    "visit-four-active": "visit-six-active",
    "visit-four": "visit-six-active",
    "visit-five-active": "visit-six-active",
    "visit-five": "visit-six-active",
    "visit-five-memory": "visit-six-active",
    "music-request": "music-delivery",
    "music-active": "music-delivery",
    "photo-request": "cracks-start",
    "photo-active": "cracks-start",
    "photo-owner-intro": "cracks-start",
    "photo-preview": "cracks-start",
    "photo-owner-reveal": "cracks-start",
    "photo-printed": "cracks-start",
    "photo-return": "cracks-start",
    "photo-wall": "cracks-start",
    "photo-finale": "cracks-start",
  },
  interactions: [
    { actorId: "linche", nodeId: "cabin-active", choiceId: "invite-cabin" },
    {
      actorId: "linche",
      nodeId: "confrontation-active",
      choiceId: "begin-confrontation",
    },
    {
      actorId: "linche",
      nodeId: "visit-one-active",
      choiceId: "start-visit-one",
    },
    {
      actorId: "linche",
      nodeId: "visit-six-active",
      choiceId: "start-visit-six",
    },
    {
      actorId: "archive_elder",
      nodeId: "archive-elder-active",
      choiceId: "ask-archive-elder",
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
      choiceId: "continue-stone-question",
    },
    {
      interestPointId: "echo-stone-pile",
      nodeId: "stone-question",
      choiceId: "ask-stones",
    },
    {
      interestPointId: "echo-stone-pile",
      nodeId: "stone-count",
      choiceId: "finish-stone-investigation",
    },
    {
      interestPointId: "echo-table",
      nodeId: "cracks-start",
      choiceId: "inspect-table",
    },
    {
      interestPointId: "echo-stone-pile",
      nodeId: "investigation-hub",
      choiceId: "inspect-stones",
    },
    {
      interestPointId: "echo-table",
      nodeId: "investigation-hub",
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
      choiceId: "continue-diary-132",
    },
    {
      interestPointId: "echo-diary",
      nodeId: "diary-page-132",
      choiceId: "continue-diary-198",
    },
    {
      interestPointId: "echo-diary",
      nodeId: "diary-page-198",
      choiceId: "continue-diary-245",
    },
    {
      interestPointId: "echo-diary",
      nodeId: "diary-page-245",
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
      guide: { title: "回声 · 相遇", objective: "与气象观测站的林澈交谈" },
      text: "……好久没见到人了。\n\n你是来登山的吗？这条路很少有人走。",
      choices: [
        { id: "ask-alone", label: "你一个人住在这里？", next: "not-alone" },
      ],
    },
    "not-alone": {
      id: "not-alone",
      title: "林澈",
      role: "气象观测站守望人",
      guide: { title: "回声 · 相遇", objective: "听林澈讲述山上的生活" },
      text: "嗯，一个人。\n\n不过……也不算完全一个人。",
      choices: [
        { id: "auto-mountain-memory", label: "", next: "mountain-memory", hidden: true, autoAdvance: true },
      ],
    },
    "mountain-memory": {
      id: "mountain-memory",
      title: "回忆",
      presentation: "cg",
      image: mountainPromiseImage,
      guide: { title: "回声 · 未竟之约", objective: "倾听林澈的回忆" },
      text: "她说过，最想来这座山。\n想在山顶看一次日出。\n想在这里，度过春夏秋冬。\n\n但她没能来。",
      choices: [{ id: "auto-recording", label: "", next: "recording", hidden: true, autoAdvance: true }],
    },
    recording: {
      id: "recording",
      title: "林澈",
      role: "气象观测站守望人",
      guide: { title: "回声 · 未竟之约", objective: "了解林澈记录四季的原因" },
      text: "所以我替她来了。\n\n我每天记录这里的一切——天气、风、云的形状、山下的灯火。\n\n用录音笔讲给她听。这样的话……她就能知道这里是什么样子了。",
      choices: [{ id: "ask-name", label: "她叫什么名字？", next: "secret" }],
    },
    secret: {
      id: "secret",
      title: "林澈",
      role: "气象观测站守望人",
      guide: { title: "回声 · 星夜", objective: "继续听林澈讲述她的故事" },
      text: "嗯……这是我们之间的秘密。\n\n但她很喜欢这里。她说过，如果能在这里生活，一定每天都会很开心。",
      choices: [
        { id: "auto-starlight-memory", label: "", next: "starlight-memory", hidden: true, autoAdvance: true },
      ],
    },
    "starlight-memory": {
      id: "starlight-memory",
      title: "回忆",
      presentation: "cg",
      image: starlitCabinImage,
      guide: { title: "回声 · 星夜", objective: "倾听星空下的回忆" },
      text: "她喜欢在窗边看星星。\n她说星星会听她说话。\n\n所以我每晚都会对着星空，\n把今天发生的事讲一遍。",
      choices: [
        { id: "auto-four-seasons", label: "", next: "four-seasons", hidden: true, autoAdvance: true },
      ],
    },
    "four-seasons": {
      id: "four-seasons",
      title: "林澈",
      role: "气象观测站守望人",
      guide: { title: "回声 · 四季", objective: "询问林澈对她的思念" },
      text: "今天是第237天。\n\n我会一直在这里，直到把四季都记录完。\n\n这样她就能看到春天的花、夏天的雨、秋天的叶子、冬天的雪。",
      choices: [{ id: "say-miss", label: "你一定很想她。", next: "request" }],
    },
    request: {
      id: "request",
      title: "林澈",
      role: "气象观测站守望人",
      guide: { title: "回声 · 四季", objective: "回应林澈的请求" },
      text: "嗯。每一天都想。\n\n但只要做这些事，就觉得……她还在身边。\n\n如果你下次还会来的话……能帮我一个忙吗？她最喜欢的食物，我想做给她。",
      choices: [
        {
          id: "accept-wish",
          label: "我会帮你。",
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
        title: "她的遗愿 · 其一",
        objective: "购买牛肉、萝卜和音乐盒，再回到气象观测站",
      },
      text: "谢谢。\n\n虽然她吃不到，但……至少我可以尝尝，然后告诉她是什么味道。\n\n她还喜欢听一首轻柔的歌。我们把这些东西一起准备好，好吗？",
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
      guide: { title: "她的遗愿 · 其一和其二", objective: "陪林澈完成这顿饭，再听一会儿音乐" },
      text: "你把食材和音乐盒都带来了！谢谢。\n\n她说过，最喜欢这道菜。小时候她妈妈常做给她吃，那是世界上最温暖的味道。",
      choices: [{ id: "continue-meal", label: "继续", next: "shared-meal" }],
    },
    "shared-meal": {
      id: "shared-meal",
      title: "回忆",
      presentation: "cg",
      image: sharedMealImage,
      guide: { title: "她的遗愿 · 其一", objective: "品尝林澈做好的食物" },
      text: "做好了。\n虽然不知道做得对不对，但闻起来……应该是这个味道。\n你尝尝看？\n嗯……你说好吃就好。\n我也觉得很好吃。\n下次……我再做给你。",
      choices: [
        { id: "continue-food-thanks", label: "继续", next: "food-thanks" },
      ],
    },
    "food-thanks": {
      id: "food-thanks",
      title: "林澈",
      role: "气象观测站守望人",
      guide: { title: "她的遗愿 · 其一", objective: "回应林澈" },
      text: "谢谢你陪我做这件事。\n\n感觉……她真的在这里一样。\n\n和她说话的时候，我总觉得她会回应我。虽然听不见，但我知道她在听。",
      choices: [
        {
          id: "play-music",
          label: "打开音乐盒",
          next: "music-delivery",
        },
      ],
    },
    "music-delivery": {
      id: "music-delivery",
      title: "林澈",
      role: "气象观测站守望人",
      guide: { title: "她的遗愿 · 其二", objective: "和林澈一起听音乐盒" },
      text: "是这个！\n\n……应该是这个吧。\n\n她说过喜欢这个旋律。嗯，一定是的。",
      choices: [
        { id: "continue-song", label: "继续", next: "observatory-song" },
      ],
    },
    "observatory-song": {
      id: "observatory-song",
      title: "回忆",
      presentation: "cg",
      image: observatorySongImage,
      guide: { title: "她的遗愿 · 其二", objective: "听完星空下的旋律" },
      text: "她说过，星空下听音乐，就像整个世界都安静下来，只剩下自己和最重要的人。\n你听到了吗？\n我知道你在听。\n我会每天都放给你听的。\n这样你就不会孤单了。",
      choices: [
        { id: "continue-act-two-end", label: "继续", next: "act-two-complete" },
      ],
    },
    "act-two-complete": {
      id: "act-two-complete",
      title: "林澈",
      role: "气象观测站守望人",
      guide: { title: "她的遗愿 · 其三", objective: "继续和林澈交谈" },
      text: "谢谢你。\n\n有你帮忙，我能为她做的事又多了一件。\n\n她一定……很开心吧。",
      choices: [
        {
          id: "ask-how-they-met",
          label: "你们是怎么认识的？",
          next: "bookstore-memory",
        },
      ],
    },
    "bookstore-memory": {
      id: "bookstore-memory",
      title: "林澈",
      role: "气象观测站守望人",
      guide: { title: "她的遗愿 · 其三", objective: "听林澈讲述他们的相遇" },
      text: "在书店。\n\n那天下着小雨，她站在文学区看书。\n\n我不小心碰掉了她手里的书，然后……就认识了。\n\n她笑起来很好看。像……像阳光穿过雨后的云。",
      choices: [
        {
          id: "auto-start-investigation",
          label: "",
          next: "cracks-start",
          hidden: true,
          autoAdvance: true,
          effects: [
            { type: "flag.set", flagId: "echo.stonesInvestigated", value: false },
            { type: "flag.set", flagId: "echo.foodInvestigated", value: false },
          ],
        },
      ],
    },
    "cracks-start": {
      id: "cracks-start",
      title: "林澈",
      role: "气象观测站守望人",
      guide: { title: "回声 · 裂痕", objective: "调查观测站内外的异常" },
      text: "林澈看着照片，不再言语。\n\n再在屋内屋外随便转转吧。",
      choices: [
        {
          id: "inspect-stones",
          label: "调查石堆",
          next: "stone-hint",
          hidden: true,
        },
        {
          id: "inspect-table",
          label: "调查桌子",
          next: "table-hint",
          hidden: true,
        },
      ],
    },
    "stone-hint": {
      id: "stone-hint",
      title: "整齐的石堆",
      role: "调查线索",
      guide: { title: "回声 · 裂痕", objective: "数清屋外的石堆" },
      text: "一排整齐的石堆，每一个代表一天。\n\n数量：512 个。",
      choices: [
        {
          id: "continue-stone-question",
          label: "返回询问林澈",
          next: "stone-question",
        },
      ],
    },
    "stone-question": {
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
      id: "stone-excuse",
      title: "林澈",
      role: "气象观测站守望人",
      guide: { title: "回声 · 裂痕", objective: "听林澈解释" },
      text: "……\n\n是吗？\n\n可能……是我数错了。\n\n有时候我会忘记今天垒过没有，所以……可能垒了两次。\n\n也有可能……我记错天数了。\n\n反正……也没人在意这些。",
      choices: [
        {
          id: "finish-stone-investigation",
          label: "沉默",
          next: "investigation-hub",
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
    "table-hint": {
      id: "table-hint",
      title: "木屋里的桌子",
      role: "调查线索",
      guide: { title: "回声 · 裂痕", objective: "再次询问她喜欢的食物" },
      text: "桌上还留着上次用过的餐具。\n\n也许可以再问问林澈，她最喜欢什么。",
      choices: [
        {
          id: "continue-food-conflict",
          label: "询问林澈",
          next: "food-conflict",
        },
      ],
    },
    "food-conflict": {
      id: "food-conflict",
      title: "林澈",
      role: "气象观测站守望人",
      guide: { title: "回声 · 裂痕", objective: "确认她喜欢的食物" },
      text: "我想再做一次她最喜欢的菜。\n\n她最喜欢清淡的……鱼汤吧。",
      choices: [
        {
          id: "correct-food-memory",
          label: "你上次说她喜欢牛肉炖萝卜？",
          next: "food-excuse",
        },
      ],
    },
    "food-excuse": {
      id: "food-excuse",
      title: "林澈",
      role: "气象观测站守望人",
      guide: { title: "回声 · 裂痕", objective: "追问林澈的记忆" },
      text: "啊……对，是那个。\n\n我有时候会记混。\n\n毕竟已经……这么久了。久到……有些事情想不起来了。",
      choices: [
        {
          id: "ask-what-she-likes",
          label: "她到底喜欢什么？",
          next: "food-uncertainty",
        },
      ],
    },
    "food-uncertainty": {
      id: "food-uncertainty",
      title: "林澈",
      role: "气象观测站守望人",
      guide: { title: "回声 · 裂痕", objective: "听完林澈的回答" },
      text: "她喜欢……\n\n她喜欢很多东西。\n\n温暖的食物、轻柔的音乐、星空、这座山……\n\n她喜欢的东西太多了，所以我记不住也很正常，对吧？\n\n对吧？",
      choices: [
        {
          id: "finish-food-investigation",
          label: "没有回答",
          next: "investigation-hub",
          effects: [
            { type: "flag.set", flagId: "echo.foodInvestigated", value: true },
          ],
        },
      ],
    },
    "investigation-hub": {
      id: "investigation-hub",
      title: "林澈",
      role: "气象观测站守望人",
      guide: { title: "回声 · 裂痕", objective: "继续调查观测站内外的异常" },
      text: "林澈看着照片，不再言语。\n\n再在屋内屋外随便转转吧。",
      choices: [
        {
          id: "inspect-stones",
          label: "调查石堆",
          next: "stone-hint",
          hidden: true,
          availableWhen: [
            {
              type: "flag.equals",
              flagId: "echo.stonesInvestigated",
              value: false,
            },
          ],
        },
        {
          id: "inspect-table",
          label: "调查桌子",
          next: "table-hint",
          hidden: true,
          availableWhen: [
            {
              type: "flag.equals",
              flagId: "echo.foodInvestigated",
              value: false,
            },
          ],
        },
        {
          id: "complete-cracks",
          label: "整理发现的矛盾",
          next: "third-act-complete",
          availableWhen: [
            {
              type: "flag.equals",
              flagId: "echo.stonesInvestigated",
              value: true,
            },
            {
              type: "flag.equals",
              flagId: "echo.foodInvestigated",
              value: true,
            },
          ],
          effects: [
            { type: "event.publish", eventType: "echo.act-three.completed" },
          ],
        },
        {
          id: "skip-cracks",
          label: "暂时跳过，继续主线",
          next: "third-act-complete",
          effects: [
            { type: "event.publish", eventType: "echo.act-three.skipped" },
          ],
        },
      ],
    },
    "third-act-complete": {
      id: "third-act-complete",
      title: "内心独白",
      role: "调查记录",
      guide: { title: "回声 · 调查", objective: "决定是否继续调查林澈" },
      text: "石堆的数量、她喜欢的食物……林澈的记忆里出现了无法忽视的矛盾。",
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
      id: "archive-active",
      title: "回声 · 调查",
      role: "第四幕",
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
      id: "archive-record",
      title: "居民档案",
      role: "小城档案馆",
      presentation: "document",
      activeActorIds: ["archive_elder"],
      guide: { title: "回声 · 调查", objective: "阅读林澈的居民档案" },
      text: "姓名：林澈\n性别：男\n出生日期：1996年3月14日\n现住址：郊区气象观测站\n\n性格内向，不善交际。\n小学至高中期间长期独自一人。\n大学毕业后搬至郊区。\n无固定工作。",
      choices: [
        {
          id: "continue-to-elder",
          label: "去门口询问老人",
          next: "archive-elder-active",
        },
      ],
    },
    "archive-elder-active": {
      id: "archive-elder-active",
      title: "档案馆门口",
      role: "调查线索",
      activeActorIds: ["archive_elder"],
      guide: { title: "回声 · 调查", objective: "询问档案馆门口的老人" },
      text: "一位老人站在档案馆门口，似乎认识林澈。",
      choices: [
        {
          id: "ask-archive-elder",
          label: "询问林澈的过去",
          next: "archive-elder-story",
        },
      ],
    },
    "archive-elder-story": {
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
      title: "内心独白",
      role: "调查记录",
      terminal: true,
      guide: { title: "回声 · 调查", objective: "第四幕已完成" },
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
      id: "diary-page-89",
      title: "日记 · 第89页",
      role: "木屋里的日记",
      presentation: "document",
      text: "今天做了她最喜欢的菜。\n\n她说好吃。\n\n我也觉得很好吃。",
      choices: [
        { id: "continue-diary-132", label: "继续翻阅", next: "diary-page-132" },
      ],
    },
    "diary-page-132": {
      id: "diary-page-132",
      title: "日记 · 第132页",
      role: "木屋里的日记",
      presentation: "document",
      text: "今天又想起那个故事，关于在书店遇见的情节。\n\n应该是秋天……还是夏天？\n\n算了，不重要。\n\n重要的是，我们确实见过面。\n\n对吧？",
      choices: [
        { id: "continue-diary-198", label: "继续翻阅", next: "diary-page-198" },
      ],
    },
    "diary-page-198": {
      id: "diary-page-198",
      title: "日记 · 第198页",
      role: "木屋里的日记",
      presentation: "document",
      text: "她喜欢蓝色。\n\n不对，是绿色。\n\n还是……粉色？\n\n我记不清了。\n\n下次录音要记得统一。不能前后矛盾。\n\n那样的话，她就不真实了。",
      choices: [
        { id: "continue-diary-245", label: "继续翻阅", next: "diary-page-245" },
      ],
    },
    "diary-page-245": {
      id: "diary-page-245",
      title: "日记 · 第245页",
      role: "木屋里的日记",
      presentation: "document",
      text: "今天有点累。\n\n不知道还要编多久。\n\n但不编的话，我又该做什么呢？",
      choices: [
        { id: "continue-diary-67", label: "继续翻阅", next: "diary-page-67" },
      ],
    },
    "diary-page-67": {
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
      id: "fifth-act-complete",
      title: "真相",
      role: "内心独白",
      presentation: "cg",
      guide: { title: "回声 · 真相", objective: "准备与林澈对质" },
      text: "......",
      choices: [
        {
          id: "continue-fifth-blackout",
          label: "继续",
          next: "fifth-act-blackout",
          hidden: true,
        },
      ],
    },
    "fifth-act-blackout": {
      id: "fifth-act-blackout",
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
      id: "confrontation-active",
      title: "回声 · 对质",
      role: "第六幕",
      guide: { title: "回声 · 对质", objective: "离开木屋，与林澈谈谈" },
      text: "林澈就在屋外。该把你看到的一切告诉他了。",
      choices: [
        {
          id: "begin-confrontation",
          label: "与林澈对质",
          next: "confrontation",
          hidden: true,
        },
      ],
    },
    confrontation: {
      id: "confrontation",
      title: "林澈",
      role: "气象观测站守望人",
      guide: { title: "回声 · 对质", objective: "决定如何回应林澈" },
      text: "你……都看到了吧。\n\n日记、照片。\n\n我知道你要说什么。",
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
      text: "没有人记得他来过。",
    },
    "loop-response": {
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
      id: "loop-confusion",
      title: "林澈",
      role: "逐渐混乱的故事",
      text: "我是为了她才来的……",
      choices: [
        { id: "confirm-loop", label: "是的，是为了她。", next: "loop-ending" },
        { id: "silent-loop", label: "……", next: "loop-ending" },
      ],
    },
    "loop-ending": {
      id: "loop-ending",
      title: "回声 · 循环",
      role: "中立结局",
      presentation: "cg",
      terminal: true,
      guide: { title: "回声 · 循环", objective: "剧情已结束" },
      text: "他还在那里。\n\n只要继续讲下去，只要继续相信，她就还在。",
      choices: [
        {
          id: "continue-loop-blackout",
          label: "继续",
          next: "loop-blackout",
          hidden: true,
        },
      ],
    },
    "loop-blackout": {
      id: "loop-blackout",
      title: "回声 · 循环",
      role: "中立结局",
      presentation: "blackout",
      terminal: true,
      text: "他陷在自己的故事里，\n\n再也出不来了。",
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
      role: "任务完成",
      terminal: true,
      text: "只要一直相信，她就永远在。",
    },
    "truth-question": {
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
      text: "最可怕的不是孤独本身。\n\n是你清楚地知道自己在孤独，却什么也做不了。\n\n从小到大，我就像个透明人。走在街上没人会看我，坐在教室里没人会和我说话。\n\n后来我搬到这里，想着在一个没有人的地方，至少不会显得格格不入。\n\n但一个人比被无视更可怕。这里只有无尽的安静。\n\n所以我开始自言自语，后来试着编了一个关于“她”的故事。\n\n她很温柔，会听我说话，会在意我。她想来这座山，想和我一起看四季。\n\n讲着讲着，她变得越来越真实。明明都是我编的，但我真的记得。\n\n然后你来了。一个真的人来了。\n\n我太高兴了，所以继续把那个故事讲给你听。\n\n如果你也相信，那她就是真的了。对吧？",
      choices: [
        {
          id: "continue-truth-return",
          label: "回到现实",
          next: "truth-return",
        },
      ],
    },
    "truth-return": {
      id: "truth-return",
      title: "林澈",
      role: "真相",
      text: "现在……我又记起来了。\n\n她不存在。\n\n从一开始就不存在。\n\n只有我。一直只有我。",
      choices: [
        { id: "ask-why", label: "为什么要这么做？", next: "truth-why" },
        { id: "suggest-town", label: "你可以回小城去。", next: "truth-town" },
        { id: "offer-visits", label: "我可以来看你。", next: "support-offer" },
      ],
    },
    "truth-why": {
      id: "truth-why",
      title: "林澈",
      role: "坦白",
      text: "如果不给自己编个理由，我连明天为什么要睁开眼都不知道。\n\n如果是为了她，为了实现她的遗愿，为了把四季讲给她听，我就有理由继续。\n\n哪怕这个理由是假的，至少在故事里，我不是一个人。",
      choices: [
        {
          id: "continue-support-from-why",
          label: "我可以来看你。",
          next: "support-offer",
        },
      ],
    },
    "truth-town": {
      id: "truth-town",
      title: "林澈",
      role: "坦白",
      text: "回去做什么？在小城里，我也是一个人。\n\n至少在这里，我可以编一个有人陪伴的世界。\n\n假的温暖，也比真的寒冷好一点吧。",
      choices: [
        {
          id: "continue-support-from-town",
          label: "那我可以来看你。",
          next: "support-offer",
        },
      ],
    },
    "support-offer": {
      id: "support-offer",
      title: "林澈",
      role: "真实的邀请",
      text: "……什么？\n\n你说什么？",
      choices: [
        {
          id: "promise-visits",
          label: "我会来看你的。",
          next: "support-reaction",
        },
        {
          id: "stop-inventing",
          label: "你不用再编故事了。",
          next: "support-reaction",
        },
      ],
    },
    "support-reaction": {
      id: "support-reaction",
      title: "林澈",
      role: "真实的邀请",
      text: "真的吗？\n\n就算知道我一直在自言自语，知道我编了一个不存在的人……\n\n你还愿意来吗？",
      choices: [
        { id: "assure-return", label: "我会的。", next: "truth-ending" },
        { id: "not-crazy", label: "你不是疯子。", next: "truth-ending" },
        { id: "only-lonely", label: "你只是孤独。", next: "truth-ending" },
      ],
    },
    "truth-ending": {
      id: "truth-ending",
      title: "回声 · 真相",
      role: "真结局",
      presentation: "cg",
      text: "第一次，这个位置站着一个真实的人。\n\n不是我编出来的，不是我幻想的。\n\n林澈的声音开始颤抖。\n\n这么多年，这是第一次有人愿意留下来。\n\n那我就不用再编故事了吧？\n\n因为……你是真的。\n\n谢谢你来到这里。谢谢你听我说话。",
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
      role: "后日谈",
      guide: { title: "回声 · 陪伴", objective: "以后再来看看林澈" },
      text: "真实的陪伴已经留下了第一道回声。",
      choices: [
        {
          id: "continue-begin-epilogue",
          label: "继续",
          next: "visit-one-active",
          hidden: true,
          effects: [
            { type: "event.publish", eventType: "echo.epilogue.unlocked" },
          ],
        },
      ],
    },
    "visit-one-active": {
      id: "visit-one-active",
      title: "后日谈 · 陪伴",
      role: "第一次回访",
      interactionOnly: true,
      guide: { title: "后日谈 · 陪伴", objective: "再次前往观测站看望林澈" },
      text: "林澈站在屋外，像是在等待。",
      choices: [
        {
          id: "start-visit-one",
          label: "与林澈交谈",
          next: "visit-one",
          hidden: true,
        },
      ],
    },
    "visit-one": {
      id: "visit-one",
      title: "林澈",
      role: "第一次回访",
      text: "你……真的来了。\n\n我还以为……算了。\n\n你来了就好。\n\n我拆掉了一些墙上的照片。墙空了，就能挂一些真的照片了。对吧？",
      choices: [
        {
          id: "continue-visit-one",
          label: "陪他站一会儿",
          next: "visit-one-memory",
        },
      ],
    },
    "visit-one-memory": {
      id: "visit-one-memory",
      title: "黄昏的观测站",
      role: "真实的回访",
      presentation: "cg",
      text: "这几天，我一直在想。\n\n想你是不是真的会来，还是那也是我编的。\n\n但你来了。\n\n你真的来了。",
      choices: [
        {
          id: "continue-visit-six-active",
          label: "结束这次回访",
          next: "visit-six-active",
          effects: [
            {
              type: "event.publish",
              eventType: "echo.epilogue.visit-one.completed",
            },
          ],
        },
      ],
    },
    "visit-six-active": {
      id: "visit-six-active",
      title: "后日谈 · 陪伴",
      role: "最终回访",
      interactionOnly: true,
      guide: { title: "回声 · 终章", objective: "与林澈一起去看日出" },
      text: "林澈已经在观测站旁等你。",
      choices: [
        {
          id: "start-visit-six",
          label: "赴约",
          next: "visit-six-sunrise",
          hidden: true,
        },
      ],
    },
    "visit-six-sunrise": {
      id: "visit-six-sunrise",
      title: "山顶日出",
      role: "最终回访",
      presentation: "cg",
      text: "你看。日出。\n\n以前我也来看过，但那时候，我是对着空气说“你看”。\n\n但这次，你真的在这里。\n\n谢谢你来到这里，听我讲那些疯狂的故事，看穿我的谎言，然后还愿意留下来。\n\n你是第一个，也是唯一一个，让我觉得真实比故事更好的人。\n\n或许我还是会孤独，或许我还是会一个人待在这里很久。\n\n但至少现在，我知道了。\n\n有一个真实的人记得我。\n\n这就足够了。",
      choices: [
        {
          id: "continue-final-thanks",
          label: "看完日出",
          next: "visit-six-thanks",
        },
      ],
    },
    "visit-six-thanks": {
      id: "visit-six-thanks",
      title: "林澈",
      role: "终章",
      text: "谢谢你。\n\n真的。\n\n谢谢。",
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
      role: "THE END",
      presentation: "blackout",
      terminal: true,
      text: "在那之后，你偶尔还会去看他。\n\n他还是住在那里，还是会一个人待很久。\n\n但他不再对着空气说话了。\n\n他会等你来，然后把这段时间发生的真实事情讲给你听。\n\n或许孤独从未真正消失。\n\n但至少，它有了回声。",
    },
  },
};
