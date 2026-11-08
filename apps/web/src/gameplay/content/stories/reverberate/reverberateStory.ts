import type { StoryDefinition } from "../../../stories/types";

/**
 * 支线剧情：《回音壁》
 *
 * 老城北坡巷底，一面弧形砖墙和一间无人值守的亭。
 * 玩家可以读折信、数计数器、读纸条、留一句话、去照相亭拍照，
 * 并在多次回访后遇见那张九个字的纸条。
 *
 * 墙声是机制拟声，不是任何真实人物。
 * 节点命名：短 ASCII id；旗标命名：reverberate.<subject>.<key>。
 */

export const REVERBERATE_STORY: StoryDefinition = {
  schemaVersion: 1,
  definitionVersion: 1,
  id: "side.reverberate.wall",
  title: "回音壁",
  startNode: "arrival",
  entryActorId: "reverberate_keeper",

  interactions: [
    { actorId: "reverberate_keeper", nodeId: "arrival", choiceId: "approach-wall" },
  ],

  buildingInteractions: [
    { buildingId: "reverberate_wall", nodeId: "arrival", choiceId: "approach-wall" },
  ],

  nodes: {
    // ── 第一幕：到墙 ────────────────────────────────────────────────

    arrival: {
      id: "arrival",
      title: "回音壁",
      role: "序章 · 亭灯",
      savepoint: true,
      guide: { title: "回音壁", objective: "走到墙前，听听它的回音" },
      activeActorIds: ["reverberate_keeper"],
      text: "老城北坡，巷子到了底。一段弧形的砖墙环出小小一片安静，墙前一盏亭灯——你走近，它亮了，像等到了什么。\n\n墙（很远、很轻，像很多人隔着砖同时开口）：\n「有人来了。」\n「……灯还记得。」\n\n灯又亮了一格。亭柱上挂着两只铜计数器：左边那只小些，落着灰——113；右边那只大的，还在轻轻走——5883。",
      choices: [
        { id: "approach-wall", label: "走近那面墙。", next: "wall-greets" },
        { id: "stand-quiet", label: "先在巷口站一会儿。", next: "wall-greets", set: { "reverberate.approach": "quiet" } },
      ],
    },

    "wall-greets": {
      id: "wall-greets",
      title: "回音壁",
      role: "无人值守的回声",
      savepoint: false,
      activeActorIds: ["reverberate_keeper"],
      text: "你走到墙前。砖缝里有细小的声音，像很多句话挤在一起，又像只有一句被拉得很长。\n\n「有人来了。」\n「……灯还记得。」\n\n声音没有方向。你分不清它从墙里来，还是从你身后的巷子来。",
      choices: [
        { id: "ask-what-wall", label: "你是谁？", next: "wall-identity" },
        { id: "listen-only", label: "什么也不问，先听。", next: "whose-voice" },
        { id: "read-letter", label: "先看看墙心那封信。", next: "letter-hub" },
      ],
    },

    "wall-identity": {
      id: "wall-identity",
      title: "回音壁",
      savepoint: false,
      text: "「墙没有名字。」那个声音说。「硬要说的话——是很多在这里说过话的人。」\n\n停了一下。\n\n「我们不认识写信的人。我们只是比他先到，又比他晚走。」",
      choices: [
        { id: "ask-whose-voice", label: "那现在说话的是谁？", next: "whose-voice" },
        { id: "go-letter", label: "去看那封信。", next: "letter-hub" },
      ],
    },

    "whose-voice": {
      id: "whose-voice",
      title: "回音壁",
      savepoint: false,
      text: "「谁也不是。」\n「很多人隔着砖同时开口，听起来就像一个人。」\n\n风穿过砖缝，声音散了一层。\n\n「你要找的那个人不会出现。他只是不定期回来看看。」",
      choices: [
        { id: "go-letter-2", label: "去看那封信。", next: "letter-hub" },
        { id: "ask-counters", label: "那两只计数器是什么？", next: "counters" },
      ],
    },

    // ── 第二幕：读信 ────────────────────────────────────────────────

    "letter-hub": {
      id: "letter-hub",
      title: "信龛",
      role: "第一幕 · 折信",
      savepoint: true,
      guide: { title: "回音壁", objective: "读读信封上能读的字" },
      text: "信钉在墙心的信龛里，外面一层信封。信封没有拆开，折痕很深，像被人反复摸过。\n\n可读的部分都在外侧。中段折在里面，字迹只剩一点影子。",
      choices: [
        { id: "read-invitation", label: "读首行。", next: "invitation" },
        { id: "read-oath", label: "读落款。", next: "oath" },
        { id: "try-unfold", label: "试着展开折痕。", next: "fold-try" },
        { id: "examine-notch", label: "看信龛侧面的刻痕。", next: "notch" },
        { id: "count-counters", label: "看亭柱上的两只计数器。", next: "counters" },
        { id: "look-plaques", label: "抬头看墙顶的四块铭牌。", next: "plaques-hub" },
        { id: "look-notes", label: "看砖缝里的纸条。", next: "note-hub" },
        { id: "go-reply", label: "去亭里取一张纸条。", next: "reply-hub" },
        { id: "go-booth", label: "去巷口的照相亭看看。", next: "photo-hub" },
        {
          id: "read-whole-envelope",
          label: "把能读的字再读一遍。",
          next: "letter-full",
          availableWhen: [
            { type: "flag.equals", flagId: "reverberate.read.invitation", value: true },
            { type: "flag.equals", flagId: "reverberate.read.oath", value: true },
          ],
        },
      ],
    },

    invitation: {
      id: "invitation",
      title: "信封上缘",
      savepoint: false,
      text: "信封上缘，一行小字：\n\n「来物实也有一段时间了，和你们说一个关于我的故事吧。」\n\n信封中央，抬头两个蓝字大字：\n\n「关于我」\n\n蓝字旁边三个小字，刻得比别的字深一号：\n\n「（别屏蔽）」",
      choices: [
        { id: "back-1", label: "回到信前。", next: "letter-hub", set: { "reverberate.read.invitation": true } },
      ],
    },

    oath: {
      id: "oath",
      title: "信封下缘",
      savepoint: false,
      text: "信封下缘，落款四行：\n\n「我一定会好好的活下去的」\n「加油！」\n「我迟早会扇烂他们的脸的！！！」\n「——2023.09.24.2:14」\n\n日期比发信时间早三分钟。他先在纸上写完，签了时间，再誊进城里。",
      choices: [
        { id: "back-2", label: "回到信前。", next: "letter-hub", set: { "reverberate.read.oath": true } },
      ],
    },

    "letter-full": {
      id: "letter-full",
      title: "信封",
      savepoint: false,
      text: "你把信封外侧能读的字都读了一遍。\n\n抬头、首行、落款、日期。中间那段仍然折在里面。\n\n墙：「能递给陌生人的，只有抬头和落款。」",
      choices: [
        { id: "back-3", label: "回到信前。", next: "letter-hub" },
      ],
    },

    "fold-try": {
      id: "fold-try",
      title: "折痕",
      savepoint: false,
      text: "你伸手去掀折痕。纸很薄，却像被什么压住了。\n\n放大镜也好，成就也好，都打不开。\n\n墙：「折痕里的字，留给写信的人。」",
      choices: [
        {
          id: "back-4",
          label: "收回手。",
          next: "letter-hub",
          effects: [
            { type: "event.publish", eventType: "story.achievement", payload: { id: "reverberate_fold", name: "折痕里的字" } },
          ],
        },
      ],
    },

    notch: {
      id: "notch",
      title: "三分钟",
      savepoint: false,
      text: "信龛侧面有一道极小的刻痕：02:17 → 02:20。\n\n放大器下，能看见三分钟里被取下又钉回去的一点木屑。改了哪里——折痕不说。\n\n墙：「三分钟。连墙都不说。」",
      choices: [
        { id: "back-5", label: "回到信前。", next: "letter-hub" },
      ],
    },

    counters: {
      id: "counters",
      title: "两只计数器",
      savepoint: true,
      text: "左边那只小些，落着灰：113。\n右边那只大的，还在轻轻走：5883。\n\n一百一十三颗星。五千八百八十三条回话。\n\n墙：「挂星的人先来。后来大家发现，写信的人要的不是星星。」",
      choices: [
        {
          id: "ask-ratio",
          label: "问：那要的是什么？",
          next: "counter-core",
          availableWhen: [{ type: "flag.equals", flagId: "reverberate.notes.all", value: true }],
        },
        { id: "look-vote", label: "看亭柱上的投票板。", next: "vote-board" },
        { id: "back-6", label: "回到信前。", next: "letter-hub" },
      ],
    },

    "counter-core": {
      id: "counter-core",
      title: "两个计数器",
      role: "情感核 · 回话",
      savepoint: true,
      guide: { title: "回音壁", objective: "在亭里留下一句话" },
      text: "「这封信钉上来那天，城里人先想着给它挂星。」\n\n（左边那只小的铜计数器，落着灰。一百一十三。）\n\n「挂了一百一十三颗，就不挂了。」\n「后来大家发现——写信的人要的不是星星。」\n「是回话。」\n\n（右边那只大的翻过一格。五千八百八十三。）\n\n「从那天起，这面墙不设点赞。」\n「想留下的人，请说话。」\n\n（风穿过砖缝，纸条哗啦响了一声，像很多人同时点了头。）",
      choices: [
        { id: "go-reply-2", label: "去亭里取一张纸条。", next: "reply-hub" },
        { id: "back-7", label: "回到信前。", next: "letter-hub" },
      ],
    },

    "vote-board": {
      id: "vote-board",
      title: "投票板",
      savepoint: false,
      text: "亭柱上还有一块小木牌：\n\n一、每周记事\n二、一句表白\n三、千字文章\n四、一百金币\n五、云听歌\n\n——截止 10 月 5 号 24 点。祝大家安好。\n\n你拨了一下木牌。什么也没有发生。\n\n墙：「投票早就截止了。」\n「板子留着——是那天的谢礼。」",
      choices: [
        { id: "back-8", label: "回到信前。", next: "letter-hub" },
      ],
    },

    // ── 第三幕：四块铭牌 ────────────────────────────────────────────

    "plaques-hub": {
      id: "plaques-hub",
      title: "墙顶",
      role: "支线 · 四块铭牌",
      savepoint: true,
      guide: { title: "回音壁", objective: "依次读完墙顶的四块铭牌" },
      text: "墙顶四块砖，各刻一行字与一个日期。字是不同时候刻的，深浅不一。\n\n风把砖面吹得很干净。",
      choices: [
        { id: "read-plaque-1", label: "读第一块砖。", next: "plaque-one" },
        { id: "read-plaque-2", label: "读第二块砖。", next: "plaque-two" },
        { id: "read-plaque-3", label: "读第三块砖。", next: "plaque-three" },
        { id: "read-plaque-4", label: "读第四块砖。", next: "plaque-four" },
        {
          id: "plaques-done",
          label: "四块都读完了。",
          next: "plaque-four-read",
          availableWhen: [
            { type: "flag.equals", flagId: "reverberate.plaque.one", value: true },
            { type: "flag.equals", flagId: "reverberate.plaque.two", value: true },
            { type: "flag.equals", flagId: "reverberate.plaque.three", value: true },
            { type: "flag.equals", flagId: "reverberate.plaque.four", value: true },
          ],
        },
        { id: "back-9", label: "回到信前。", next: "letter-hub" },
      ],
    },

    "plaque-one": {
      id: "plaque-one",
      title: "第一块铭牌",
      savepoint: false,
      text: "第一块砖：\n\n「もう一歩近づくと警察に通報した！」\n——2023.09\n\n刻得很用力，像刻的时候在发抖。",
      choices: [
        { id: "back-10", label: "看下一块。", next: "plaques-hub", set: { "reverberate.plaque.one": true } },
      ],
    },

    "plaque-two": {
      id: "plaque-two",
      title: "第二块铭牌",
      savepoint: false,
      text: "第二块砖：\n\n「精神病也换不来他们的一丝同情」\n——2023.09.28\n\n信后第四天。",
      choices: [
        { id: "back-11", label: "看下一块。", next: "plaques-hub", set: { "reverberate.plaque.two": true } },
      ],
    },

    "plaque-three": {
      id: "plaque-three",
      title: "第三块铭牌",
      savepoint: false,
      text: "第三块砖：\n\n「鸢栀的小花花，生病了，喜欢胡桃」\n——2023.10.06\n\n照相亭开张那天。",
      choices: [
        { id: "back-12", label: "看下一块。", next: "plaques-hub", set: { "reverberate.plaque.three": true } },
      ],
    },

    "plaque-four": {
      id: "plaque-four",
      title: "第四块铭牌",
      savepoint: false,
      text: "第四块砖：\n\n「永远是鸢栀的小花花，不定期回来看看」\n——现在\n\n字比前面三块都稳。",
      choices: [
        { id: "back-13", label: "退后一步。", next: "plaques-hub", set: { "reverberate.plaque.four": true } },
      ],
    },

    "plaque-four-read": {
      id: "plaque-four-read",
      title: "四块铭牌",
      savepoint: true,
      text: "你依次读完四块砖。\n\n墙：「砖上的字是他自己刻的。我们只是没舍得抹。」\n\n灯，不知不觉已经全亮了。\n\n第四块砖下面，浮出一行极小的字：他真的会回来。",
      choices: [
        {
          id: "back-14",
          label: "回到信前。",
          next: "letter-hub",
          effects: [
            { type: "event.publish", eventType: "story.achievement", payload: { id: "reverberate_light", name: "越来越有光" } },
          ],
        },
      ],
    },

    // ── 第四幕：纸条墙 ──────────────────────────────────────────────

    "note-hub": {
      id: "note-hub",
      title: "纸条墙",
      role: "第二幕 · 砖缝",
      savepoint: true,
      guide: { title: "回音壁", objective: "读一读砖缝里的纸条" },
      text: "砖缝里塞着纸条。最外面十六张还能读，更早的已经和砖长在一起。\n\n墙：「顺序不能错。」",
      choices: [
        { id: "read-all-notes", label: "按时间从旧到新读一遍。", next: "note-wall" },
        { id: "read-bloods", label: "先看相邻的三张。", next: "note-bloods" },
        { id: "read-mist", label: "看那张带蓝字的纸条。", next: "note-mist" },
        { id: "read-cat", label: "看最上面那张新纸条。", next: "note-cat" },
        {
          id: "notes-to-counters",
          label: "回到两个计数器前。",
          next: "counter-core",
          availableWhen: [{ type: "flag.equals", flagId: "reverberate.notes.all", value: true }],
        },
        { id: "back-15", label: "回到信前。", next: "letter-hub" },
      ],
    },

    "note-wall": {
      id: "note-wall",
      title: "十六张纸条",
      savepoint: false,
      text: "2024-02-09　理科生小凌：「加油」\n\n2024-03-10　血曦留下三张（先记着，等下细看）。\n\n2024-06-13　崩批不咩站神：「加油」\n2024-06-13　崩批不咩站神：「愿你在这残缺的世界中找到属于自己的完整」\n\n2024-06-23　已被封禁 (已被封禁).：\n「凭什么学日语就是汉奸？那么八国联军侵华的时候有英国吧，现在大家都学英语，那都是汉奸喽？俄国（苏联）跟我们有过冷战，那学俄语的也是汉奸（以前相当于现在的英语）？让他们自己看看，不会一门外语，稍微碰到一个外国人怎么交流（中文其实是世界上最难学的语言之一，还有日语和俄语也是，日语二级真的很不容易）」\n\n2024-07-12　空仞：「我从这里看到了熟系的影子……」〔蓝字：《在名为家庭的海里窒息》〕\n2024-07-12　空仞：「回复@雾之桥：（空）」\n2024-07-30　焱炏：「回复@空仞： 啧，你怎么从哪都能看到我的影子？」\n\n2024-08-17　小花花的二号机：「喵」\n2024-10-14　黄金时刻｜注梦：「来て」\n\n2025-03-19　没有办法改变：「666磕到花花了」\n2025-08-03　小花花的二号机：「和自己的過去再見吧，我已經步入新的生活了」\n2025-09-17　瑟涩我要铯铯：「扫！」\n2026-10-18　一只神秘屑屑小猫口牙：「烤咕」\n\n十六张，从 2024 年读到 2026 年。墙还在收新的。",
      choices: [
        { id: "back-16", label: "回到纸条墙前。", next: "note-hub", set: { "reverberate.notes.all": true } },
        { id: "back-16b", label: "去看看两只计数器。", next: "counter-core", set: { "reverberate.notes.all": true } },
      ],
    },

    "note-bloods": {
      id: "note-bloods",
      title: "血曦三连",
      savepoint: false,
      text: "相邻三缝，按时间连读：\n\n21:57:35　血曦：「加油，活着，回来。」\n\n21:59:16　血曦：「扇烂他们的脸啊！……」\n\n21:59:30　血曦：「……」\n\n中间隔着一分四十一秒，又隔了十四秒。第三张纸条上只有两个点——那是把一整封信读完的声音。\n\n那时写信的人已经沉寂半年。三张纸条，是说给一个不在场的人听的。",
      choices: [
        { id: "back-17", label: "回到纸条墙前。", next: "note-hub" },
      ],
    },

    "note-mist": {
      id: "note-mist",
      title: "蓝字纸条",
      savepoint: false,
      text: "空仞的纸条上有一枚蓝字：《在名为家庭的海里窒息》。\n\n蓝字旁边浮出一扇雾门，门牌写着「此墙待写」。门推不开，也不该推开。\n\n邻缝里，焱炏回了一句：「啧，你怎么从哪都能看到我的影子？」",
      choices: [
        { id: "back-18", label: "把纸条按回砖缝。", next: "note-hub" },
      ],
    },

    "note-cat": {
      id: "note-cat",
      title: "小猫",
      savepoint: false,
      text: "一只屑屑的小猫从墙根走过，在纸条墙前停了半秒。\n\n「烤咕。」\n\n它没有停步。",
      choices: [
        { id: "back-19", label: "回到纸条墙前。", next: "note-hub" },
      ],
    },

    // ── 第五幕：回话 ────────────────────────────────────────────────

    "reply-hub": {
      id: "reply-hub",
      title: "亭",
      role: "核心 · 回话",
      savepoint: true,
      guide: { title: "回音壁", objective: "取一张纸条，写下想说的话" },
      text: "亭柱上钉着一块小木牌：\n\n「本亭不设点赞。」\n「想留下的人，请说话。」\n\n亭内有一叠裁好的纸条，一支铅笔。最上面一张的边角写着建议词：加油。（只有第一次来的人会看见。）",
      choices: [
        { id: "write-jiaoyou", label: "写下「加油」。", next: "reply-jiaoyou" },
        { id: "write-own", label: "写下自己的话。", next: "reply-own" },
        { id: "put-back", label: "把纸条放回去。", next: "reply-decline" },
        { id: "back-20", label: "回到信前。", next: "letter-hub" },
      ],
    },

    "reply-jiaoyou": {
      id: "reply-jiaoyou",
      title: "纸条",
      savepoint: false,
      text: "你在纸条上写下「加油」，塞进砖缝。\n\n一拍安静。",
      choices: [
        {
          id: "wait-echo-1",
          label: "等一等。",
          next: "echo-arrives",
          set: { "reverberate.has.replied": true, "reverberate.reply.content": "jiaoyou" },
          effects: [
            { type: "event.publish", eventType: "story.achievement", payload: { id: "reverberate_reply", name: "回话的人" } },
            { type: "event.publish", eventType: "story.achievement", payload: { id: "reverberate_prayer", name: "本城最常见的祈祷" } },
          ],
        },
      ],
    },

    "reply-own": {
      id: "reply-own",
      title: "纸条",
      savepoint: false,
      text: "你在纸条上写下自己的话，塞进砖缝。字不多，但每一笔都落得很慢。\n\n一拍安静。",
      choices: [
        {
          id: "wait-echo-2",
          label: "等一等。",
          next: "echo-arrives",
          set: { "reverberate.has.replied": true, "reverberate.reply.content": "own" },
          effects: [
            { type: "event.publish", eventType: "story.achievement", payload: { id: "reverberate_reply", name: "回话的人" } },
          ],
        },
      ],
    },

    "reply-decline": {
      id: "reply-decline",
      title: "亭",
      savepoint: false,
      text: "你把纸条放回原处。\n\n墙没有催你。\n\n「不急。」",
      choices: [
        { id: "change-mind", label: "还是写一张。", next: "reply-hub" },
        { id: "leave-quietly", label: "离开亭子。", next: "ending-lamp" },
      ],
    },

    "echo-arrives": {
      id: "echo-arrives",
      title: "回声",
      role: "回音 · 一拍之后",
      savepoint: true,
      text: "对面墙根传来一声很轻的响动。\n\n你的纸条边上，多出一行几乎看不见的小字，没有署名。\n\n墙：「收到了。」\n\n（停顿。）\n\n「会有人看到的。不急。」\n\n亭灯亮了一格。右边那只铜计数器，翻过一格。",
      choices: [
        { id: "listen-echo", label: "听听墙的回声。", next: "echo-pool" },
        { id: "ask-delay", label: "问它：为什么回得这么慢？", next: "echo-delay" },
        { id: "ask-who", label: "问它：这些话是说给谁听的？", next: "who-listens" },
        { id: "leave-after-echo", label: "安静地离开。", next: "after-reply" },
      ],
    },

    "echo-pool": {
      id: "echo-pool",
      title: "回声池",
      savepoint: false,
      text: "墙的声音换了一层，像很多句等在那里，随机落下其中一句：\n\n「嗯。」\n\n「在听。」\n\n「写下来了，就作数。」\n\n「这么晚写的话，折痕替你收好。」\n\n「加油。」",
      choices: [
        { id: "echo-to-delay", label: "问它：为什么回得这么慢？", next: "echo-delay" },
        { id: "echo-to-who", label: "问它：这些话是说给谁听的？", next: "who-listens" },
        { id: "echo-to-after", label: "安静地离开。", next: "after-reply" },
      ],
    },

    "echo-delay": {
      id: "echo-delay",
      title: "回声的延迟",
      savepoint: false,
      text: "「回声本来就要走一段路。」\n\n「砖会挡住一部分，风会带走一部分。剩下那些，要等对面有人路过，才听得见。」\n\n停了一下。\n\n「有的回声三年后才到。有的到了，写信的人已经不在墙这边了。」\n\n「但到了就是到了。」",
      choices: [
        { id: "delay-to-content", label: "问它：回音里留下的到底是什么？", next: "echo-content" },
        { id: "delay-to-who", label: "问它：这些话是说给谁听的？", next: "who-listens" },
        { id: "delay-to-after", label: "安静地离开。", next: "after-reply" },
      ],
    },

    "echo-content": {
      id: "echo-content",
      title: "回声的内容",
      savepoint: false,
      text: "「内容不重要。」\n\n「重要的是有人在这面墙前停下来，把一句话写完。」\n\n「纸条上写什么，墙都会记住。记住的不是字，是那个人在什么时候来过。」",
      choices: [
        { id: "content-to-who", label: "问它：这些话是说给谁听的？", next: "who-listens" },
        { id: "content-to-after", label: "安静地离开。", next: "after-reply" },
      ],
    },

    "who-listens": {
      id: "who-listens",
      title: "说给谁听",
      savepoint: true,
      text: "「不是给墙听的。」\n\n「墙不会安慰人。墙只负责把话留在原地。」\n\n「说给下一个路过的人听。说给三年后才来的人听。也说给写这句话的自己听。」\n\n风穿过砖缝。\n\n「写下来，就作数。」",
      choices: [
        { id: "who-to-after", label: "回到墙前。", next: "after-reply" },
        { id: "who-to-leave", label: "离开巷子。", next: "ending-lamp" },
      ],
    },

    "after-reply": {
      id: "after-reply",
      title: "灯下",
      role: "第三幕 · 回来",
      savepoint: true,
      guide: { title: "回音壁", objective: "过几天再回巷子看看" },
      text: "你在墙前站到灯不再变亮。\n\n砖缝里还留着你的纸条。它旁边那行小字已经淡了，但没有消失。\n\n「下次来，灯还认得你。」",
      choices: [
        { id: "wait-return", label: "过几天再回来看看。", next: "return-note" },
        { id: "keep-replying", label: "决定以后常来，做一个回话的人。", next: "ending-reply" },
        { id: "leave-now", label: "现在就走。", next: "ending-lamp" },
      ],
    },

    "return-note": {
      id: "return-note",
      title: "回来看看",
      role: "结局前 · 九个字",
      savepoint: true,
      text: "某个白天再进巷，折信下面多了一张新纸条。\n\n没有署名，笔迹和信一样：\n\n「回來了，无感。。。」\n\n你读完，抬头看墙。灯座下的油是满的。有人夜里来添过。\n\n你不是唯一读过这张纸条的人。但你从来没遇到过写字条的人。",
      choices: [
        {
          id: "read-fourth-again",
          label: "再看一眼第四块砖。",
          next: "oil-full",
          set: { "reverberate.returned": true },
          effects: [
            { type: "event.publish", eventType: "story.achievement", payload: { id: "reverberate_return", name: "不定期" } },
          ],
        },
        {
          id: "leave-note",
          label: "把纸条留在原处，离开。",
          next: "ending-return",
          set: { "reverberate.returned": true },
          effects: [
            { type: "event.publish", eventType: "story.achievement", payload: { id: "reverberate_return", name: "不定期" } },
          ],
        },
      ],
    },

    "oil-full": {
      id: "oil-full",
      title: "第四块砖",
      savepoint: false,
      text: "第四块砖下面，那行极小的字变了。\n\n原来写着「他真的会回来。」\n\n现在写着：「他回来了。」\n\n灯座下的油还是满的。写字条的人已经走了。",
      choices: [
        { id: "leave-after-oil", label: "离开巷子。", next: "ending-return" },
      ],
    },

    // ── 结局 ────────────────────────────────────────────────────────

    "ending-return": {
      id: "ending-return",
      title: "回音壁",
      role: "结局 · 不定期",
      savepoint: true,
      presentation: "blackout",
      terminal: true,
      guide: null,
      text: "你没有遇到他。\n\n但你看见了那张纸条，看见了满的油，看见了第四块砖下面的字。\n\n墙很轻地说：\n\n「不定期，回来看看。」\n\n巷子尽头，灯一直亮着。",
    },

    "ending-lamp": {
      id: "ending-lamp",
      title: "回音壁",
      role: "结局 · 亭灯",
      savepoint: true,
      presentation: "blackout",
      terminal: true,
      guide: null,
      text: "你走出巷子。\n\n回头时，亭灯还亮着。它不为谁开，也不为谁灭。\n\n墙：「想说话的时候再来。」\n\n坡下的城市在响。坡上的灯没有催你。",
    },

    "ending-reply": {
      id: "ending-reply",
      title: "回音壁",
      role: "结局 · 回话的人",
      savepoint: true,
      presentation: "blackout",
      terminal: true,
      guide: null,
      text: "你决定做一个回话的人。\n\n不署名，不挂星，不期待对方立刻看见。只是每次路过，都留一句话。\n\n墙：「写下来了，就作数。」\n\n后来你听说，墙上的纸条又多了几张。没有人知道是谁写的。你也只是其中一张。",
    },

    // ── 姊妹章：照相亭 ──────────────────────────────────────────────

    "photo-hub": {
      id: "photo-hub",
      title: "照相亭",
      role: "姊妹章 · 看见我",
      savepoint: true,
      guide: { title: "回音壁", objective: "在巷口拍一张没有美颜的照片" },
      text: "巷口与墙相对，立着一座小亭。门口排着几个剪影，看不清脸。\n\n亭内一台讯飞牌学习机改的照相机。机顶招牌一行加密字：\n\n精∂神^状√态±良↔好∈\n\n两块铭牌：\n\n「这个讯飞牌学习机连个美颜都没有！！！」\n「第二快门，致敬小灭。」\n\n墙：「十二天。从听见我，到看见我。」",
      choices: [
        { id: "queue-up", label: "排队。", next: "silhouette" },
        { id: "shoot-now", label: "直接拍一张。", next: "photo-shot" },
        { id: "back-21", label: "回墙那边。", next: "letter-hub" },
      ],
    },

    silhouette: {
      id: "silhouette",
      title: "排队剪影",
      savepoint: false,
      text: "排队时，前面的两个剪影小声说话。\n\n剪影 A：「无美颜？」\n剪影 B：「无美颜。」\n剪影 A：「……那再排会儿。我还没准备好。」\n\n队往前挪了一点。",
      choices: [
        { id: "take-turn", label: "轮到你，按下快门。", next: "photo-shot" },
        { id: "skip-photo", label: "先不拍，回墙那边。", next: "letter-hub" },
      ],
    },

    "photo-shot": {
      id: "photo-shot",
      title: "第二快门",
      savepoint: false,
      text: "快门响了。照片出来得很快，没有滤镜，没有修色。\n\n晾绳上挂着九百六十三张旧照片，全部背面朝外。只有你这一张是正面。\n\n（别人让你看见的样子，是他们的选择。）\n\n计数从 963 开始，翻到 964。",
      choices: [
        {
          id: "back-22",
          label: "回墙那边。",
          next: "letter-hub",
          effects: [
            { type: "event.publish", eventType: "story.achievement", payload: { id: "reverberate_photo", name: "原相机" } },
          ],
        },
        { id: "look-line", label: "再看一会儿晾绳。", next: "photo-hub" },
      ],
    },
  },
};
