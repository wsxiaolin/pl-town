import type { StoryDefinition } from "../../../stories/types";

/**
 * 支线剧情：《今晚别走那条街》
 *
 * 改编自果戈里短篇小说《外套》（公版作品）。
 * 三段式结构：取外套 → 失窃 → 沿街调查。
 * 三个结局：找回外套 / 联名作证 / 桥上见鬼。
 *
 * 所有事件发生在街道、桥边、门口和路灯下，不进入室内。
 * 依赖现有 NPC：唐师傅(tang)、游先生(you)、老秦(laoqin)、
 * 林叙(linxu)、李叔(li)、阿紫(azi)。
 * 新增 NPC：阿卡基(akaki)，storyOnly。
 */
export const OVERCOAT_STORY: StoryDefinition = {
  schemaVersion: 1,
  definitionVersion: 1,
  id: "side.overcoat.tonight",
  title: "今晚别走那条街",
  startNode: "meeting",
  entryActorId: "akaki",
  interactions: [
    { actorId: "akaki", nodeId: "evidence-hub", choiceId: "review-evidence" },
  ],
  nodes: {
    // ── 第一幕：新外套 ──────────────────────────────────────────────

    meeting: {
      id: "meeting",
      title: "阿卡基",
      role: "支线 · 第一幕",
      savepoint: true,
      guide: { title: "今晚别走那条街", objective: "在街头找到阿卡基" },
      activeActorIds: ["akaki"],
      text:
        "路灯下站着一个瘦削的男人，他不停地用手指摸着领口，像在确认什么还不属于自己的东西。\n\n" +
        "「你……你好。请问，你看见唐师傅了吗？他说今天把外套做好，可我在这里等了很久……」\n\n" +
        "他瞥了一眼茶馆的方向，又迅速收回目光。\n\n" +
        "「对不起。我不该麻烦你。只是这件外套……我等了很久。」",
      choices: [
        {
          id: "ask-coat",
          label: "什么外套？",
          next: "walk-to-tang",
          set: { "overcoat.trust": false },
        },
        {
          id: "offer-help",
          label: "别急，我陪你去找他。",
          next: "walk-to-tang",
          set: { "overcoat.trust": true },
        },
      ],
    },

    "walk-to-tang": {
      id: "walk-to-tang",
      title: "阿卡基",
      savepoint: false,
      activeActorIds: ["akaki"],
      text:
        "阿卡基走路很小心，似乎在避开地上的每一块石板缝隙。他的步子又小又快，像怕踩到什么不该踩的东西。\n\n" +
        "「唐师傅的茶馆就在前面。他……是个好人，答应让我分期付清。」\n\n" +
        "经过橱窗时，他看了一眼，但很快把目光收了回去。",
      choices: [
        {
          id: "why-care",
          label: "你为什么这么在意这件外套？",
          next: "tailor-door",
          set: { "overcoat.asked.why": true },
        },
        {
          id: "just-walk",
          label: "走吧。",
          next: "tailor-door",
          autoAdvance: true,
        },
      ],
    },

    "tailor-door": {
      id: "tailor-door",
      title: "裁缝门口",
      role: "支线 · 第一幕",
      savepoint: true,
      guide: { title: "今晚别走那条街", objective: "陪阿卡基在茶馆门口取外套" },
      activeActorIds: ["akaki"],
      text:
        "唐师傅站在茶馆门口，手里拿着一件深灰色外套。看见你们过来，他把外套举起来。\n\n" +
        "「做好了。你试试。」\n\n" +
        "阿卡基伸手摸了摸袖口，手指在布料上停了很久。\n\n" +
        "「……比我想的要厚。」",
      choices: [
        {
          id: "brass-button",
          label: "纽扣选黄铜的还是骨质的？",
          next: "button-pick",
          set: { "overcoat.button": "brass" },
        },
        {
          id: "fabric-comment",
          label: "布料挺结实的。",
          next: "button-pick",
          set: { "overcoat.button": "bone" },
        },
        {
          id: "try-on",
          label: "快试试吧。",
          next: "button-pick",
        },
      ],
    },

    "button-pick": {
      id: "button-pick",
      title: "裁缝门口",
      savepoint: false,
      activeActorIds: ["akaki"],
      text:
        "阿卡基犹豫了很久。他的手指摸了摸两颗纽扣，最后选了便宜的那一颗。\n\n" +
        "「骨质的……够了。黄铜太亮了，会被人看见。」\n\n" +
        "唐师傅没说什么，把外套递给他。",
      choices: [
        {
          id: "continue-fitting",
          label: "继续",
          next: "coat-worn",
          autoAdvance: true,
        },
      ],
    },

    "coat-worn": {
      id: "coat-worn",
      title: "阿卡基",
      savepoint: true,
      activeActorIds: ["akaki"],
      text:
        "阿卡基穿上外套，在路灯下慢慢转身。他低头看了看袖口，又看了看衣摆。\n\n" +
        "「……合身。」\n\n" +
        "他没有笑，但眼睛里有一种从未见过的光。那是一种小心翼翼的骄傲，像第一次拥有一件真正属于自己的东西。",
      choices: [
        {
          id: "compliment",
          label: "很好看。",
          next: "evening-return",
        },
        {
          id: "hurry-back",
          label: "走吧，天快黑了。",
          next: "evening-return",
        },
      ],
    },

    "evening-return": {
      id: "evening-return",
      title: "街上",
      savepoint: false,
      activeActorIds: ["akaki"],
      text:
        "回去的路上，阿卡基的话多了起来。\n\n" +
        "「我平时不喝茶……不点蜡烛。走路时刻意避开泥水。一件外套，要省很久。」\n\n" +
        "经过橱窗时，他看了一眼，但这次没有马上把目光收回去。他多看了一秒。\n\n" +
        "「有了这件外套，冬天就不一样了。」",
      choices: [
        {
          id: "continue-greeting",
          label: "继续",
          next: "first-greeting",
          autoAdvance: true,
        },
      ],
    },

    "first-greeting": {
      id: "first-greeting",
      title: "街上",
      savepoint: true,
      guide: { title: "今晚别走那条街", objective: "送阿卡基回家" },
      activeActorIds: ["akaki"],
      text:
        "一个路人经过，忽然停下来。\n\n" +
        "「诶，阿卡基？你换了新外套？」\n\n" +
        "阿卡基愣了一下，显然不知道该怎么回应。他的嘴张了张，最后只说出一个字。\n\n" +
        "「……嗯。」\n\n" +
        "路人笑了笑，走了。\n\n" +
        "阿卡基看着他的背影，轻声说：「他第一次叫我。」",
      choices: [
        {
          id: "congrats",
          label: "恭喜你。",
          next: "robbery-cg",
        },
        {
          id: "walk-home",
          label: "天晚了，我送你回去。",
          next: "robbery-cg",
        },
      ],
    },

    // ── 第二幕：失窃的街道 ──────────────────────────────────────────

    "robbery-cg": {
      id: "robbery-cg",
      title: "失窃",
      role: "支线 · 第二幕",
      savepoint: false,
      presentation: "cg",
      activeActorIds: ["akaki"],
      text:
        "两个影子从暗处走出来。\n\n" +
        "阿卡基被推倒在地。\n\n" +
        "外套被扯走。\n\n" +
        "你追过街角，穿过运货车，但到了路口，盗贼已经消失。\n\n" +
        "只剩路灯在雪地上投下一圈昏黄的光。",
      choices: [
        {
          id: "continue-aftermath",
          label: "继续",
          next: "aftermath",
          autoAdvance: true,
        },
      ],
    },

    aftermath: {
      id: "aftermath",
      title: "雪地",
      savepoint: true,
      guide: { title: "今晚别走那条街", objective: "帮阿卡基找回外套" },
      activeActorIds: ["akaki"],
      text:
        "阿卡基跪在地上，在雪里寻找衣服上的线头。\n\n" +
        "「……没有了。」\n\n" +
        "他抬起头，脸上没有眼泪，只有一种被掏空的神情。\n\n" +
        "「你能帮我吗？我不认识有权势的人。警察说要等明天，守夜人说这不归他管……我只是想把外套找回来。」",
      choices: [
        {
          id: "promise-help",
          label: "我帮你找。",
          next: "investigation-hub",
          effects: [
            { type: "flag.set", flagId: "overcoat.asked.tang", value: false },
            { type: "flag.set", flagId: "overcoat.asked.you", value: false },
            { type: "flag.set", flagId: "overcoat.asked.laoqin", value: false },
            { type: "flag.set", flagId: "overcoat.asked.linxu", value: false },
            { type: "flag.set", flagId: "overcoat.asked.li", value: false },
          ],
        },
        {
          id: "suggest-police",
          label: "你应该去报警。",
          next: "investigation-hub",
          effects: [
            { type: "flag.set", flagId: "overcoat.asked.tang", value: false },
            { type: "flag.set", flagId: "overcoat.asked.you", value: false },
            { type: "flag.set", flagId: "overcoat.asked.laoqin", value: false },
            { type: "flag.set", flagId: "overcoat.asked.linxu", value: false },
            { type: "flag.set", flagId: "overcoat.asked.li", value: false },
          ],
        },
      ],
    },

    // ── 第三幕：所有人都知道，但没有人负责 ──────────────────────────

    "investigation-hub": {
      id: "investigation-hub",
      title: "调查",
      role: "支线 · 第三幕",
      savepoint: true,
      guide: { title: "今晚别走那条街", objective: "沿街询问目击者（至少三人）" },
      activeActorIds: ["akaki"],
      text:
        "街上有几个人可能看见了什么。\n\n" +
        "阿卡基站在路灯下等你回来。你可以先找谁？",
      choices: [
        {
          id: "go-tang",
          label: "去找唐师傅（茶馆掌柜）",
          next: "ask-tang",
          availableWhen: [
            { type: "flag.equals", flagId: "overcoat.asked.tang", value: false },
          ],
        },
        {
          id: "go-you",
          label: "去找游先生（夜行者）",
          next: "ask-you",
          availableWhen: [
            { type: "flag.equals", flagId: "overcoat.asked.you", value: false },
          ],
        },
        {
          id: "go-laoqin",
          label: "去找老秦（修路工）",
          next: "ask-laoqin",
          availableWhen: [
            { type: "flag.equals", flagId: "overcoat.asked.laoqin", value: false },
          ],
        },
        {
          id: "go-linxu",
          label: "去找林叙（图书馆管理员）",
          next: "ask-linxu",
          availableWhen: [
            { type: "flag.equals", flagId: "overcoat.asked.linxu", value: false },
          ],
        },
        {
          id: "go-li",
          label: "去找李叔（社区守望者）",
          next: "ask-li",
          availableWhen: [
            { type: "flag.equals", flagId: "overcoat.asked.li", value: false },
          ],
        },
        {
          id: "gather-evidence",
          label: "够了，去汇总线索。",
          next: "evidence-hub",
          availableWhen: [
            { type: "event.occurred", eventType: "overcoat.witness", atLeast: 3 },
          ],
        },
      ],
    },

    "ask-tang": {
      id: "ask-tang",
      title: "唐师傅",
      savepoint: true,
      activeActorIds: ["akaki"],
      text:
        "唐师傅站在茶馆门口，手里还拿着抹布。他看见你走过来，先看了一眼街两头，才开口。\n\n" +
        "「我看见了。两个人影，从那个巷子出来的。」\n\n" +
        "他压低声音：「但你要我作证？我开茶馆的，明天他们来找我怎么办？」\n\n" +
        "他沉默了一会儿，又说：「我能告诉你，他们往河边跑了。别的……我帮不了你。」",
      choices: [
        {
          id: "tang-thanks",
          label: "谢谢。我知道了。",
          next: "investigation-hub",
          set: { "overcoat.asked.tang": true },
          effects: [
            { type: "event.publish", eventType: "overcoat.witness" },
            { type: "flag.set", flagId: "overcoat.clue.river", value: true },
          ],
        },
        {
          id: "tang-press",
          label: "你明明看见了，为什么不愿说？",
          next: "ask-tang-refuse",
          set: { "overcoat.asked.tang": true },
          effects: [
            { type: "event.publish", eventType: "overcoat.witness" },
            { type: "flag.set", flagId: "overcoat.clue.river", value: true },
          ],
        },
      ],
    },

    "ask-tang-refuse": {
      id: "ask-tang-refuse",
      title: "唐师傅",
      savepoint: false,
      activeActorIds: ["akaki"],
      text:
        "唐师傅把抹布搭在肩上，看着你。\n\n" +
        "「我也要过日子。」\n\n" +
        "他没有再说话。",
      choices: [
        {
          id: "tang-back",
          label: "继续调查",
          next: "investigation-hub",
          autoAdvance: true,
        },
      ],
    },

    "ask-you": {
      id: "ask-you",
      title: "游先生",
      savepoint: true,
      activeActorIds: ["akaki"],
      text:
        "游先生靠在桥栏上，像往常一样看着夜色。他总是夜里在街上走，比谁都看得多。\n\n" +
        "「昨晚？我看见两个人跑过桥。穿得挺急，手里抱着什么东西。」\n\n" +
        "他想了想：「我记得那个包的颜色。深灰色的，像一件衣服。」\n\n" +
        "「但脸我没看清。他们跑太快。」",
      choices: [
        {
          id: "you-thanks",
          label: "深灰色……那确实是阿卡基的外套。",
          next: "investigation-hub",
          set: { "overcoat.asked.you": true },
          effects: [
            { type: "event.publish", eventType: "overcoat.witness" },
            { type: "flag.set", flagId: "overcoat.clue.color", value: true },
          ],
        },
        {
          id: "you-ask-face",
          label: "他们往哪个方向跑了？",
          next: "ask-you-detail",
          set: { "overcoat.asked.you": true },
          effects: [
            { type: "event.publish", eventType: "overcoat.witness" },
            { type: "flag.set", flagId: "overcoat.clue.color", value: true },
          ],
        },
      ],
    },

    "ask-you-detail": {
      id: "ask-you-detail",
      title: "游先生",
      savepoint: false,
      activeActorIds: ["akaki"],
      text:
        "游先生指了指河对岸。\n\n" +
        "「往那边。过了桥右拐，就消失在巷子里了。」\n\n" +
        "他顿了一下：「那条巷子尽头有个二手衣商。你要是去找，白天去，晚上那条街不安全。」",
      choices: [
        {
          id: "you-back",
          label: "继续调查",
          next: "investigation-hub",
          autoAdvance: true,
        },
      ],
    },

    "ask-laoqin": {
      id: "ask-laoqin",
      title: "老秦",
      savepoint: true,
      activeActorIds: ["akaki"],
      text:
        "老秦蹲在路边修一块松动的石板。他看见你过来，放下手里的工具。\n\n" +
        "「你说昨晚的事？我早上扫地的时候捡到一样东西。」\n\n" +
        "他从口袋里掏出一枚骨质纽扣，放在你手心里。\n\n" +
        "「就在桥这头捡的。看着是从什么衣服上扯下来的。」",
      choices: [
        {
          id: "laoqin-thanks",
          label: "这确实是阿卡基外套上的纽扣。",
          next: "investigation-hub",
          set: { "overcoat.asked.laoqin": true },
          effects: [
            { type: "event.publish", eventType: "overcoat.witness" },
            { type: "flag.set", flagId: "overcoat.clue.button", value: true },
          ],
        },
        {
          id: "laoqin-ask-more",
          label: "你当时还看见了什么？",
          next: "ask-laoqin-detail",
          set: { "overcoat.asked.laoqin": true },
          effects: [
            { type: "event.publish", eventType: "overcoat.witness" },
            { type: "flag.set", flagId: "overcoat.clue.button", value: true },
          ],
        },
      ],
    },

    "ask-laoqin-detail": {
      id: "ask-laoqin-detail",
      title: "老秦",
      savepoint: false,
      activeActorIds: ["akaki"],
      text:
        "老秦想了想。\n\n" +
        "「地上有脚印。两个人往桥那边跑的，步子很大。还有一个人……跪在地上，像在找什么。」\n\n" +
        "他看了你一眼：「那就是你说的阿卡基吧？天没亮就有人在雪地里找东西，不容易。」",
      choices: [
        {
          id: "laoqin-back",
          label: "继续调查",
          next: "investigation-hub",
          autoAdvance: true,
        },
      ],
    },

    "ask-linxu": {
      id: "ask-linxu",
      title: "林叙",
      savepoint: true,
      activeActorIds: ["akaki"],
      text:
        "林叙站在图书馆门口，手里抱着一摞登记簿。她听完你的描述，皱了皱眉。\n\n" +
        "「你说的那件外套……我今天确实看到了一件新的。」\n\n" +
        "她翻开一本登记簿：「有人下午来登记借书，穿着一件深灰色外套。袖口的纽扣是骨质的，但布料明显被重新缝过。」\n\n" +
        "「我不确定是不是同一件，但那个人……我从没见过他穿新衣服。」",
      choices: [
        {
          id: "linxu-thanks",
          label: "能告诉我那个人是谁吗？",
          next: "ask-linxu-detail",
          set: { "overcoat.asked.linxu": true },
          effects: [
            { type: "event.publish", eventType: "overcoat.witness" },
            { type: "flag.set", flagId: "overcoat.clue.suspect", value: true },
          ],
        },
        {
          id: "linxu-just-thanks",
          label: "谢谢，这就够了。",
          next: "investigation-hub",
          set: { "overcoat.asked.linxu": true },
          effects: [
            { type: "event.publish", eventType: "overcoat.witness" },
            { type: "flag.set", flagId: "overcoat.clue.suspect", value: true },
          ],
        },
      ],
    },

    "ask-linxu-detail": {
      id: "ask-linxu-detail",
      title: "林叙",
      savepoint: false,
      activeActorIds: ["akaki"],
      text:
        "林叙犹豫了一下，然后在登记簿上写了什么，撕下来递给你。\n\n" +
        "「他住在河对岸的巷子尽头。我不能告诉你更多，但你要是去找他……小心。」\n\n" +
        "「那条巷子晚上不安全。」",
      choices: [
        {
          id: "linxu-back",
          label: "继续调查",
          next: "investigation-hub",
          autoAdvance: true,
        },
      ],
    },

    "ask-li": {
      id: "ask-li",
      title: "李叔",
      savepoint: true,
      activeActorIds: ["akaki"],
      text:
        "李叔坐在岗亭里，面前摊着一本巡逻登记表。他看见你过来，先合上了本子。\n\n" +
        "「昨晚？没什么事。我写的是『无异常』。」\n\n" +
        "他顿了一下，看着你的表情，叹了口气。\n\n" +
        "「……好吧。我确实听见了喊声。大概在二更天，靠桥那边。但我一个人，不能随便离开岗位。」\n\n" +
        "「就算我去看了，又能怎么样呢？我又不是警察。」",
      choices: [
        {
          id: "li-accept",
          label: "那你能把登记表改过来吗？",
          next: "ask-li-detail",
          set: { "overcoat.asked.li": true },
          effects: [
            { type: "event.publish", eventType: "overcoat.witness" },
            { type: "flag.set", flagId: "overcoat.clue.log", value: true },
          ],
        },
        {
          id: "li-understand",
          label: "我知道了。你也不容易。",
          next: "investigation-hub",
          set: { "overcoat.asked.li": true },
          effects: [
            { type: "event.publish", eventType: "overcoat.witness" },
            { type: "flag.set", flagId: "overcoat.clue.log", value: false },
          ],
        },
      ],
    },

    "ask-li-detail": {
      id: "ask-li-detail",
      title: "李叔",
      savepoint: false,
      activeActorIds: ["akaki"],
      text:
        "李叔沉默了很久。\n\n" +
        "他打开登记表，在「无异常」三个字上划了一道线，在旁边写上：「二更天，桥方向有喊声，疑似抢劫。」\n\n" +
        "「改好了。但你要知道，这种改法我也要担责任的。」\n\n" +
        "他把本子推到一边，没有看你。",
      choices: [
        {
          id: "li-back",
          label: "继续调查",
          next: "investigation-hub",
          autoAdvance: true,
        },
      ],
    },

    // ── 汇总与结局选择 ──────────────────────────────────────────────

    "evidence-hub": {
      id: "evidence-hub",
      title: "线索",
      role: "支线 · 抉择",
      savepoint: true,
      guide: { title: "今晚别走那条街", objective: "决定如何结束这条支线" },
      activeActorIds: ["akaki"],
      text:
        "你回到路灯下，把所有线索告诉阿卡基。\n\n" +
        "他听完了，没有说话。过了很久，他才开口：\n\n" +
        "「你打算怎么办？」",
      choices: [
        {
          id: "review-evidence",
          label: "（和阿卡基再聊聊）",
          next: "evidence-review",
          hidden: true,
        },
        {
          id: "path-recover",
          label: "去河边找那个二手衣商，把外套拿回来。",
          next: "ending-recover",
        },
        {
          id: "path-witness",
          label: "找几个人联名作证，让官员受理案件。",
          next: "ending-witness",
        },
        {
          id: "path-ghost",
          label: "今晚再去那条街看看。",
          next: "ending-ghost",
        },
      ],
    },

    "evidence-review": {
      id: "evidence-review",
      title: "阿卡基",
      savepoint: false,
      activeActorIds: ["akaki"],
      text:
        "阿卡基低着头，用手指无意识地摸着衣领——那里现在什么都没有。\n\n" +
        "「其实……那件外套不值多少钱。你帮我做了这么多，已经够了。」\n\n" +
        "他停了一下：「但我想让它回来。不是为了值多少钱，是因为……它是我唯一一次为自己准备的东西。」",
      choices: [
        {
          id: "back-to-choice",
          label: "继续",
          next: "evidence-hub",
          autoAdvance: true,
        },
      ],
    },

    // ── 结局一：找回外套 ────────────────────────────────────────────

    "ending-recover": {
      id: "ending-recover",
      title: "河边",
      savepoint: false,
      presentation: "cg",
      activeActorIds: ["akaki"],
      text:
        "你沿着河走到巷子尽头。一个二手衣商正把衣服挂在架子上。\n\n" +
        "阿卡基的外套就在那里——但已经变了。布料被剪开，重新缝过，袖口沾着泥，纽扣换了一颗。\n\n" +
        "衣商看见你们，先是一愣，然后摆手：「这是别人卖给我的，我不知道是偷的。」\n\n" +
        "阿卡基站在那里，看着那件外套，没有上前。",
      choices: [
        {
          id: "pay-merchant",
          label: "我付钱把它买回来。",
          next: "ending-recover-complete",
          effects: [
            { type: "flag.set", flagId: "overcoat.ending", value: "recover-paid" },
          ],
        },
        {
          id: "threaten-merchant",
          label: "这是赃物。你不还我就报警。",
          next: "ending-recover-complete",
          effects: [
            { type: "flag.set", flagId: "overcoat.ending", value: "recover-threatened" },
          ],
        },
        {
          id: "trade-merchant",
          label: "我可以用别的东西换。",
          next: "ending-recover-complete",
          effects: [
            { type: "flag.set", flagId: "overcoat.ending", value: "recover-traded" },
          ],
        },
      ],
    },

    "ending-recover-complete": {
      id: "ending-recover-complete",
      title: "今晚别走那条街",
      role: "结局 · 找回",
      savepoint: true,
      presentation: "blackout",
      terminal: true,
      guide: null,
      activeActorIds: ["akaki"],
      text:
        "阿卡基接过外套，把它穿上。\n\n" +
        "袖口沾着泥，布料被重新缝过，纽扣换了一颗。但它还是那件外套。\n\n" +
        "「至少它还认得我。」\n\n" +
        "第二天，阿卡基还是去上班了。他穿着那件被剪开又缝上的外套，走在街上。\n\n" +
        "没有人注意到他。但这一次，他自己知道。",
      achievement: { id: "overcoat.recover", name: "至少它还认得我" },
    },

    // ── 结局二：联名作证 ────────────────────────────────────────────

    "ending-witness": {
      id: "ending-witness",
      title: "街头",
      savepoint: false,
      activeActorIds: ["akaki"],
      text:
        "你带着阿卡基去找阿紫。她是记者，也许能帮忙。\n\n" +
        "阿紫听完，飞快地在笔记本上记着什么。\n\n" +
        "「要让官员受理，得有证人联名。光靠你一个人不够。」\n\n" +
        "她看着阿卡基：「你敢不敢去找他们？让他们当着你的面，再说一次那天晚上看见的事。」",
      choices: [
        {
          id: "gather-witnesses",
          label: "走，我们去找他们。",
          next: "ending-witness-complete",
          effects: [
            { type: "flag.set", flagId: "overcoat.ending", value: "witness" },
          ],
        },
      ],
    },

    "ending-witness-complete": {
      id: "ending-witness-complete",
      title: "今晚别走那条街",
      role: "结局 · 作证",
      savepoint: true,
      presentation: "blackout",
      terminal: true,
      guide: null,
      activeActorIds: ["akaki"],
      text:
        "你陪阿卡基在街上走了整整一天。有些人不愿意开口，有些人犹豫了很久，但最终，有几个人愿意在纸上签了自己的名字。\n\n" +
        "官员终于受理了案件。他没有道歉，也没有赔偿。他只给了阿卡基一张盖章的证明。\n\n" +
        "第二天，城市公告板上多了一张新通知：\n\n" +
        "「夜间街道请注意保管个人衣物。」\n\n" +
        "城市回应了，却只回应到这种程度。\n\n" +
        "阿卡基拿着那张证明，看了很久，然后把它叠好放进衣兜里——虽然衣兜里已经没有外套了。",
      achievement: { id: "overcoat.witness", name: "城市回应了" },
    },

    // ── 结局三：桥上见鬼 ────────────────────────────────────────────

    "ending-ghost": {
      id: "ending-ghost",
      title: "桥上",
      savepoint: false,
      presentation: "cg",
      activeActorIds: ["akaki"],
      text:
        "夜里，你一个人回到那条街。\n\n" +
        "街上空无一人。路灯在雪地上投下昏黄的光。\n\n" +
        "你走到桥中央，忽然看见远处有一个人影。\n\n" +
        "那个人影穿着一件深灰色外套，站在雪里，一动不动。\n\n" +
        "身形很像阿卡基。但阿卡基现在在家里。\n\n" +
        "你走近几步。风吹过来，人影没有动。",
      choices: [
        {
          id: "chase-ghost",
          label: "追上去。",
          next: "ending-ghost-complete",
          effects: [
            { type: "flag.set", flagId: "overcoat.ending", value: "ghost-chased" },
          ],
        },
        {
          id: "stop-ghost",
          label: "停下来。",
          next: "ending-ghost-complete",
          effects: [
            { type: "flag.set", flagId: "overcoat.ending", value: "ghost-stopped" },
          ],
        },
      ],
    },

    "ending-ghost-complete": {
      id: "ending-ghost-complete",
      title: "今晚别走那条街",
      role: "结局 · 传闻",
      savepoint: true,
      presentation: "blackout",
      terminal: true,
      guide: null,
      text:
        "你追了上去。人影消失了，地上只留下一枚骨质纽扣——和老秦捡到的那枚一模一样。\n\n" +
        "第二天，你听说那个傲慢的上司昨晚被抢走了外套。\n\n" +
        "被抢的人说：对方没有说话，只在路灯下出现，身形像一个穿着旧制服的人。\n\n" +
        "抢走的不是贵重物品，而是每个人最珍惜的那件外套。\n\n" +
        "没有人知道夜里的抢劫者是不是鬼。\n\n" +
        "只知道城市里那些被忽略的人，开始用同一种方式留下痕迹。",
      achievement: { id: "overcoat.ghost", name: "今晚别走那条街" },
    },
  },

  sourceText:
    "改编自果戈里《外套》（Шинель），公版作品。\n" +
    "原作讲述低级文书阿卡基为一件新外套省吃俭用，" +
    "却在回家途中被抢，向所有人求助却被推来推去，最终病逝。\n" +
    "本支线将故事搬到 pl-town 街道，保留「被城市忽略的人」这一核心主题，" +
    "增加三结局结构和调查玩法，所有场景发生在街道，不需进入室内。",
};
