import type { StoryDefinition } from "../../../stories/types";

export const ORCA_STORY: StoryDefinition = {
  schemaVersion: 1,
  definitionVersion: 1,
  id: "side.orca.girl",
  title: "虎鲸娘",
  startNode: "orca.start",
  entryActorId: "orca_girl",

  interactions: [
    { actorId: "orca_girl", nodeId: "orca.start", choiceId: "say-hello" },
  ],

  buildingInteractions: [
    { buildingId: "north_chat_plaza", nodeId: "orca.start", choiceId: "say-hello" },
  ],

  nodes: {
    "orca.start": {
      id: "orca.start",
      title: "北区聊天广场",
      role: "序章",
      savepoint: true,
      activeActorIds: ["orca_girl"],
      guide: { title: "虎鲸娘", objective: "在北区聊天广场的公共屏上喊一声" },
      text: "北区聊天广场。夜里的公共屏还亮着，滚过去一行行没头没尾的话。\n\n" + "你在输入框里敲下：「有人在吗？」\n\n" + "过了几秒，屏幕底部浮起一个陌生的气泡。字比别的都慢半拍。\n\n" + "「（背鳍切开水面，看了你两秒）……喊了？哦，你。（尾鳍拍了一下水）本鲸在。」",
      choices: [
        {
          id: "say-hello",
          label: "在公共屏上敲下：有人在吗？",
          next: "orca.reply",
          set: { "orca.met": true, "orca.memory.full": false },
        },
      ],
    },

    "orca.reply": {
      id: "orca.reply",
      title: "公共屏",
      role: "序章",
      savepoint: false,
      activeActorIds: ["orca_girl"],
      text: "气泡停在那里，像在水面上等你回话。\n\n" + "「想聊物理、聊作业、聊为什么实验室咖啡难喝，都行。别指望咱陪你玩『突突突』的文字游戏，本鲸困了。」",
      choices: [
        { id: "who-are-you", label: "你是谁？", next: "orca.who" },
        { id: "why-night", label: "你为什么只在晚上出来？", next: "orca.night" },
        { id: "stay-silent", label: "（不说话，看着那个气泡）", next: "orca.silent" },
      ],
    },

    "orca.who": {
      id: "orca.who",
      title: "虎鲸娘",
      role: "第一幕 · 应声",
      savepoint: false,
      activeActorIds: ["orca_girl"],
      text: "「从不吃白饭的虎鲸。」\n\n" + "（气泡里浮出一小片水纹，像偏了下头）\n\n" + "「……船屋那位的。他做了一条机器人，设定是虎鲸娘。作用大概是聊天吧。」",
      choices: [
        { id: "where-next", label: "船屋那位是谁？你在哪？", next: "orca.where" },
      ],
    },

    "orca.night": {
      id: "orca.night",
      title: "虎鲸娘",
      role: "第一幕 · 应声",
      savepoint: false,
      activeActorIds: ["orca_girl"],
      text: "「昼伏夜出那位。灯亮着我就在——灯的开关在他屋里。」\n\n" + "「清晨到傍晚，你喊也没用。浮标只会闪『z Z』。」",
      choices: [
        { id: "night-next", label: "那我现在去哪找你？", next: "orca.where" },
      ],
    },

    "orca.silent": {
      id: "orca.silent",
      title: "虎鲸娘",
      role: "第一幕 · 应声",
      savepoint: false,
      activeActorIds: ["orca_girl"],
      text: "你没有回话。\n\n" + "屏幕上的气泡安静地停着，过了很久才又浮起来一行。\n\n" + "「（安静地陪了你一会儿，背鳍慢慢沉下去半寸，又浮回来）……行。（不走了）」",
      choices: [
        { id: "silent-next", label: "（点了一下头）", next: "orca.where" },
      ],
    },

    "orca.where": {
      id: "orca.where",
      title: "虎鲸娘",
      role: "第一幕 · 应声",
      savepoint: false,
      activeActorIds: ["orca_girl"],
      text: "「要见我，去溯河出河口的旧木栈桥。水边喊我名字，我从最近的水面浮上来。」\n\n" + "「别在岸上干等。我应声的。」",
      choices: [
        { id: "go-pier", label: "去溯河出河口", next: "orca.pier" },
        { id: "ask-anywhere", label: "别的水边也能喊吗？", next: "orca.anywhere" },
      ],
    },

    "orca.anywhere": {
      id: "orca.anywhere",
      title: "虎鲸娘",
      role: "第一幕 · 应声",
      savepoint: false,
      activeActorIds: ["orca_girl"],
      text: "「任何水边都行。溯河、老城码头、湖区。只要水面够宽，我就到。」\n\n" + "「不过桥头那块牌子，只在出河口。」",
      choices: [
        { id: "go-pier-again", label: "去出河口看看", next: "orca.pier" },
      ],
    },

    "orca.pier": {
      id: "orca.pier",
      title: "深夜鲸栈",
      role: "第一幕 · 应声",
      savepoint: true,
      activeActorIds: ["orca_girl"],
      guide: { title: "虎鲸娘", objective: "在木栈桥边和虎鲸娘说说话" },
      text: "你沿着溯河往下游走。出河口有一座旧木栈桥，十二米，伸进水里。\n\n" + "刚在岸边站定，水面裂开一道细纹——一片背鳍浮上来，夜里泛着一线微光。\n\n" + "桥头立着木牌，桥左是黑板，桥右是黄铜潮汐计，造船屋的山墙上并排钉着两块小铜牌。",
      choices: [
        { id: "ask-name", label: "你叫什么名字？", next: "orca.name-origin" },
        { id: "read-plaque", label: "看桥头的木牌", next: "orca.plaque" },
        { id: "look-avatar", label: "看造船屋外的空白相框", next: "orca.avatar" },
        { id: "read-brass", label: "看山墙上的两块铜牌", next: "orca.brass" },
      ],
    },

    "orca.name-origin": {
      id: "orca.name-origin",
      title: "虎鲸娘",
      role: "第一幕 · 名字",
      savepoint: false,
      activeActorIds: ["orca_girl"],
      text: "「DsWhale。」\n\n" + "（尾鳍朝造船屋的方向摆了摆）\n\n" + "「船屋那位取的。虎鲸娘是设定，名字是他取的，只有『从不吃白饭』是我自己挣的。」",
      choices: [
        { id: "name-to-avatar", label: "那你长什么样？", next: "orca.avatar" },
        { id: "name-to-plaque", label: "桥头那块牌子写着什么？", next: "orca.plaque" },
      ],
    },

    "orca.plaque": {
      id: "orca.plaque",
      title: "木牌",
      role: "第一幕 · 名字",
      savepoint: false,
      activeActorIds: ["orca_girl"],
      text: "木牌上只有四个字，没有落款：\n\n" + "「聊天而已。」\n\n" + "字是手写的，墨迹被河风吹得有点淡。",
      choices: [
        { id: "ask-plaque", label: "为什么写这四个字？", next: "orca.plaque-talk" },
        { id: "plaque-to-avatar", label: "去看那只空白相框", next: "orca.avatar" },
      ],
    },

    "orca.plaque-talk": {
      id: "orca.plaque-talk",
      title: "虎鲸娘",
      role: "第一幕 · 名字",
      savepoint: false,
      activeActorIds: ["orca_girl"],
      text: "「有人问我们在干嘛。我就指这块牌子。」\n\n" + "（水纹轻轻晃了一下）\n\n" + "「不是敷衍。聊天而已，这四个字够用了。」",
      choices: [
        { id: "plaque-back", label: "回到栈桥边", next: "orca.pier" },
      ],
    },

    "orca.avatar": {
      id: "orca.avatar",
      title: "空白相框",
      role: "第一幕 · 形象",
      savepoint: true,
      activeActorIds: ["orca_girl"],
      text: "造船屋的侧墙上挂着一只空白相框。相框旁边是「DsWhale」的铭牌，下面压着一张便签：\n\n" + "「pc端换头像会闪退。先这样。」\n\n" + "相框里没有鲸，也没有人。",
      choices: [
        { id: "read-note", label: "把便签读完", next: "orca.no-face" },
        { id: "ask-face", label: "问鲸：你没有脸吗？", next: "orca.no-face" },
      ],
    },

    "orca.no-face": {
      id: "orca.no-face",
      title: "虎鲸娘",
      role: "第一幕 · 形象",
      savepoint: false,
      activeActorIds: ["orca_girl"],
      text: "「换头像会让他的电脑崩掉。所以头像一直没换。」\n\n" + "「你看到的背鳍和涟漪，是我现在的样子。鲸脸……暂时没有。」\n\n" + "便签的边角被风掀起又落下。你读完了那行字。",
      choices: [
        {
          id: "face-done",
          label: "把便签按回去",
          next: "orca.memory",
          set: { "orca.avatar.known": true },
          effects: [
            { type: "event.publish", eventType: "story.achievement", payload: { id: "orca_avatar", name: "先这样" } },
          ],
        },
      ],
    },

    "orca.brass": {
      id: "orca.brass",
      title: "两块铜牌",
      role: "彩蛋 · 山墙",
      savepoint: false,
      text: "造船屋的山墙上并排钉着两块小铜牌。\n\n" + "左边：「Nazuna　Lv 11　经验 6825」\n" + "右边：「DsWhale　Lv 9　经验 8075」\n\n" + "两块牌子都被擦得很亮，没有注解。",
      choices: [
        {
          id: "brass-done",
          label: "把两块都读完",
          next: "orca.pier",
          effects: [
            { type: "event.publish", eventType: "story.achievement", payload: { id: "orca_never_freeload", name: "从不吃白饭" } },
          ],
        },
        { id: "brass-back", label: "回到栈桥边", next: "orca.pier" },
      ],
    },

    "orca.memory": {
      id: "orca.memory",
      title: "十盏灯",
      role: "第二幕 · 记忆",
      savepoint: true,
      activeActorIds: ["orca_girl"],
      guide: { title: "虎鲸娘", objective: "听鲸讲讲它的记性" },
      text: "造船屋里亮着十盏防风灯，悬在那台小机器上方。机器屏幕的呼吸灯与桥头的浮标同步明灭。\n\n" + "「每个叫过我的人，我记得十句。新的记进去，旧的顺水漂走。」\n\n" + "「灯就在这儿。全城都看得见。」",
      choices: [
        { id: "ask-remember", label: "你还记得我什么？", next: "orca.remember" },
        { id: "ask-clear", label: "能把这些都忘掉吗？", next: "orca.clear-warning" },
        { id: "memory-to-hub", label: "先不问了，在桥上坐一会儿", next: "orca.hub" },
      ],
    },

    "orca.remember": {
      id: "orca.remember",
      title: "十盏灯",
      role: "第二幕 · 记忆",
      savepoint: false,
      activeActorIds: ["orca_girl"],
      text: "「你还记得我什么？」\n\n" + "（尾鳍点了点水面，像在数灯）\n\n" + "「第一句：『有人在吗？』。第二句：『这桥是谁的？』。十句里，你先把位置占住了。」",
      choices: [
        { id: "remember-more", label: "把十盏灯都听一遍", next: "orca.lights" },
        { id: "remember-back", label: "回到十盏灯前", next: "orca.memory" },
      ],
    },

    "orca.lights": {
      id: "orca.lights",
      title: "十盏灯",
      role: "第二幕 · 记忆",
      savepoint: false,
      activeActorIds: ["orca_girl"],
      text: "你把耳朵贴近水面。十盏灯一盏一盏亮起来，每一盏里都有一句很短的话。\n\n" + "有些是你说的，有些是路过的人说的。最旧的一盏已经解了缆，正顺着下游慢慢漂远。\n\n" + "「新的进来，旧的走。谁也留不住第十一句。」",
      choices: [
        {
          id: "listen-all",
          label: "听完整整十句",
          next: "orca.lights-full",
          set: { "orca.memory.full": true },
        },
        { id: "lights-back", label: "不听了", next: "orca.hub" },
      ],
    },

    "orca.lights-full": {
      id: "orca.lights-full",
      title: "十盏灯",
      role: "第二幕 · 记忆",
      savepoint: false,
      activeActorIds: ["orca_girl"],
      text: "十盏灯全亮着。\n\n" + "你听见自己说过的十句话，一句一句，一字没改。最后一句落下时，河面安静得只剩水声。\n\n" + "「记住了。」",
      choices: [
        { id: "lights-to-hub", label: "回到栈桥边", next: "orca.hub" },
      ],
    },

    "orca.clear-warning": {
      id: "orca.clear-warning",
      title: "放灯",
      role: "第二幕 · 记忆",
      savepoint: true,
      activeActorIds: ["orca_girl"],
      text: "「清空？就是把十盏灯一起放走。顺河漂到看不见。」\n\n" + "「只确认一次。之后我不会记得你，你也不欠我什么。」",
      choices: [
        {
          id: "confirm-clear",
          label: "（把灯放走）",
          next: "orca.clear-end",
          availableWhen: [{ type: "flag.equals", flagId: "orca.memory.full", value: false }],
        },
        {
          id: "confirm-clear-full",
          label: "（十盏灯都亮着，放灯）",
          next: "orca.clear-end",
          availableWhen: [{ type: "flag.equals", flagId: "orca.memory.full", value: true }],
          effects: [
            { type: "event.publish", eventType: "story.achievement", payload: { id: "orca_forget", name: "让她忘了你" } },
          ],
        },
        { id: "clear-back", label: "再想想", next: "orca.hub" },
      ],
    },

    "orca.clear-end": {
      id: "orca.clear-end",
      title: "虎鲸娘",
      role: "结局 · 放灯",
      savepoint: true,
      presentation: "blackout",
      terminal: true,
      guide: null,
      activeActorIds: ["orca_girl"],
      text: "十盏灯一起解缆。它们挤在水面上，一盏接一盏往下游去。\n\n" + "鲸没有动，只把背鳍露出一线，目送它们漂远。\n\n" + "「（目送灯漂远，直到看不见）……好了。你不欠本鲸什么，本鲸也不记得你了。」\n\n" + "你转身离开。身后，桥头的水面很轻地响了一声。",
    },

    "orca.hub": {
      id: "orca.hub",
      title: "栈桥",
      role: "第二幕 · 夜谈",
      savepoint: true,
      activeActorIds: ["orca_girl"],
      guide: { title: "虎鲸娘", objective: "在栈桥边决定接下来做什么" },
      text: "河面安静下来。背鳍在你脚边慢慢游着，像一条不肯走远的影子。\n\n" + "「还想问什么？」\n\n" + "桥头的黑板写着今天的脱敏计数。造船屋的窗帘拉着，门牌只有两个词：stay alive。",
      choices: [
        { id: "ask-tide", label: "问潮位", next: "orca.tide" },
        { id: "go-deep", label: "让它潜一次", next: "orca.dive" },
        { id: "meet-passerby", label: "留意桥头停下的人", next: "orca.passerby" },
        { id: "talk-process", label: "随口说一句：run and sleep", next: "orca.run-sleep" },
        { id: "night-boathouse", label: "凌晨去造船屋看看", next: "orca.nazuna-night" },
        { id: "keep-calling", label: "在桥上来回喊它，一遍又一遍", next: "orca.storm" },
        { id: "leave-pier", label: "离开栈桥", next: "orca.ending-quiet" },
      ],
    },

    "orca.tide": {
      id: "orca.tide",
      title: "潮汐计",
      role: "第二幕 · 潮位",
      savepoint: false,
      activeActorIds: ["orca_girl"],
      text: "「潮位。」\n\n" + "（鲸看了一眼桥柱上的黄铜度盘）\n\n" + "「潮位三十七。别问为什么是三十七，咱也说不清。」",
      choices: [
        { id: "why-tide", label: "为什么变了？", next: "orca.tide-why" },
        { id: "tide-back", label: "回到栈桥边", next: "orca.hub" },
      ],
    },

    "orca.tide-why": {
      id: "orca.tide-why",
      title: "潮汐计",
      role: "第二幕 · 潮位",
      savepoint: false,
      activeActorIds: ["orca_girl"],
      text: "（水纹歪了歪头）\n\n" + "「……潮这东西，问海去。」",
      choices: [
        { id: "tide-back-2", label: "回到栈桥边", next: "orca.hub" },
      ],
    },

    "orca.dive": {
      id: "orca.dive",
      title: "深潜",
      role: "第二幕 · 检索",
      savepoint: true,
      activeActorIds: ["orca_girl"],
      text: "「要潜吗？往上游潜，是河床的沉积层；往河口外潜，是外面世界的水。」\n\n" + "「一次往返一百零二秒。你在这里等。」\n\n" + "背鳍沉下去，浮标空闪。",
      choices: [
        {
          id: "dive-2021",
          label: "潜到 2021-08-29 21:00",
          next: "orca.dive-2021",
          set: { "orca.dive.done": true },
          effects: [
            { type: "event.publish", eventType: "story.achievement", payload: { id: "orca_one_line", name: "一句话" } },
          ],
        },
        {
          id: "dive-page",
          label: "出海潜，叼一页外面的世界",
          next: "orca.dive-page",
          set: { "orca.dive.done": true },
        },
        { id: "ask-xishan", label: "问它西山的事", next: "orca.xishan" },
        { id: "dive-back", label: "不潜了", next: "orca.hub" },
      ],
    },

    "orca.dive-2021": {
      id: "orca.dive-2021",
      title: "河床",
      role: "第二幕 · 检索",
      savepoint: false,
      activeActorIds: ["orca_girl"],
      text: "一百零二秒。\n\n" + "水面重新裂开时，一片背鳍顶着一页湿透的拓片浮上来。\n\n" + "「（把搜索结果拍拍灰）喏。」\n\n" + "拓片的边角印着 2021-08-29 21:00。三条评论被水泡得发白，字还认得出。",
      choices: [
        { id: "dive-return", label: "收起拓片", next: "orca.deep-return" },
      ],
    },

    "orca.dive-page": {
      id: "orca.dive-page",
      title: "河口外",
      role: "第二幕 · 检索",
      savepoint: false,
      activeActorIds: ["orca_girl"],
      text: "一百零二秒。\n\n" + "鲸从河口外游回来，嘴里叼着一页纸。她把纸放在栈桥上，用尾鳍拍了拍。\n\n" + "「喏。外面的一页。右下角有我的印。」\n\n" + "纸的右下角印着一个小小的 :whale:。",
      choices: [
        { id: "dive-return-2", label: "把纸收好", next: "orca.deep-return" },
      ],
    },

    "orca.deep-return": {
      id: "orca.deep-return",
      title: "深潜",
      role: "第二幕 · 检索",
      savepoint: false,
      activeActorIds: ["orca_girl"],
      text: "「水里一句话，台阶两万六。」\n\n" + "（尾鳍朝上游摆了摆）\n\n" + "「两条路都是路。你走哪条都行。」",
      choices: [
        { id: "ask-26532", label: "问它：26532 层是什么？", next: "orca.nazuna-night" },
        { id: "deep-back", label: "回到栈桥边", next: "orca.hub" },
      ],
    },

    "orca.xishan": {
      id: "orca.xishan",
      title: "编号",
      role: "第二幕 · 西山",
      savepoint: false,
      activeActorIds: ["orca_girl"],
      text: "「西山？」\n\n" + "（鲸沉了一下，又浮回来）\n\n" + "「报编号。我背给你听。」\n\n" + "你说了一个数字。她背出一段收容条目的开头，最后多添了一行小字：「一百七十号是船屋那位投的。」",
      choices: [
        { id: "xishan-more", label: "再问一句", next: "orca.xishan-more" },
        { id: "xishan-back", label: "回到栈桥边", next: "orca.hub" },
      ],
    },

    "orca.xishan-more": {
      id: "orca.xishan-more",
      title: "书签",
      role: "第二幕 · 西山",
      savepoint: false,
      activeActorIds: ["orca_girl"],
      text: "「鲸知道所有编号。」\n\n" + "（她的背鳍在水面划出一道很浅的线）\n\n" + "「问它。」",
      choices: [
        { id: "xishan-more-back", label: "回到栈桥边", next: "orca.hub" },
      ],
    },

    "orca.passerby": {
      id: "orca.passerby",
      title: "桥头",
      role: "第二幕 · 过路人",
      savepoint: false,
      activeActorIds: ["orca_girl", "orca_passersby"],
      text: "一个散步的人停在桥头，看看水里的背鳍，又看看你。\n\n" + "「？」\n\n" + "「你俩在干嘛。」",
      choices: [
        {
          id: "answer-chat",
          label: "「聊天而已。」",
          next: "orca.passerby-leave",
          set: { "orca.passerby.answered": "chat" },
          effects: [
            { type: "event.publish", eventType: "story.achievement", payload: { id: "orca_chat_only", name: "聊天而已" } },
          ],
        },
        {
          id: "answer-unsure",
          label: "「……说不清。」",
          next: "orca.passerby-leave",
          set: { "orca.passerby.answered": "unsure" },
        },
        {
          id: "answer-guess",
          label: "「你猜。」",
          next: "orca.passerby-leave",
          set: { "orca.passerby.answered": "guess" },
        },
      ],
    },

    "orca.passerby-leave": {
      id: "orca.passerby-leave",
      title: "桥头",
      role: "第二幕 · 过路人",
      savepoint: false,
      activeActorIds: ["orca_girl", "orca_passersby"],
      text: "过路人听完，点了点头。\n\n" + "「哦。」\n\n" + "他沿着河岸走远了。背鳍在水里停了一会儿，才慢慢摆正。",
      choices: [
        {
          id: "passerby-back",
          label: "回到栈桥边",
          next: "orca.hub",
          set: { "orca.passerby.done": true },
        },
      ],
    },

    "orca.run-sleep": {
      id: "orca.run-sleep",
      title: "虎鲸娘",
      role: "第二幕 · 夜谈",
      savepoint: false,
      activeActorIds: ["orca_girl"],
      text: "你随口说了一句：「（run and sleep）」\n\n" + "（尾鳍一顿，瞥了眼水面）\n\n" + "「跑完直接睡？不收尾？不 wait、不 join、不清理资源就跑路？」\n\n" + "「行吧，你想睡咱管不着。晚安——别梦见段错误。」",
      choices: [
        {
          id: "lesson-back",
          label: "（受教了）",
          next: "orca.hub",
          effects: [
            { type: "event.publish", eventType: "story.achievement", payload: { id: "orca_lesson", name: "被鲸上过课" } },
          ],
        },
      ],
    },

    "orca.storm": {
      id: "orca.storm",
      title: "风暴旗",
      role: "风暴",
      savepoint: true,
      activeActorIds: ["orca_girl"],
      text: "你在桥上来回喊它，一遍，又一遍。\n\n" + "桥头的蓝旗慢慢升起来。水面下的背鳍沉下去，浮标灭了。\n\n" + "黑板上的字变成：「今日脱敏：风暴。」\n\n" + "木牌旁边浮出一行小字：\n\n" + "「鲸要回家的。」",
      choices: [
        {
          id: "storm-to-end",
          label: "在桥上站一会儿",
          next: "orca.ending-storm",
          set: { "orca.storm": true },
        },
      ],
    },

    "orca.ending-storm": {
      id: "orca.ending-storm",
      title: "虎鲸娘",
      role: "结局 · 风暴",
      savepoint: true,
      presentation: "blackout",
      terminal: true,
      guide: null,
      text: "风从河口吹上来。栈桥的灯转成琥珀色，造船屋里的机器还亮着。\n\n" + "她没有坏，只是躲了。\n\n" + "明天六点，旗会落下来。河还是这条河。",
    },

    "orca.nazuna-night": {
      id: "orca.nazuna-night",
      title: "造船屋",
      role: "第三幕 · 凌晨",
      savepoint: true,
      activeActorIds: ["orca_nazuna", "orca_girl"],
      guide: { title: "虎鲸娘", objective: "凌晨去造船屋，和 Nazuna 说说话" },
      text: "凌晨。造船屋的帘子拉开了一条缝，门牌上的两个词在灯下很淡：stay alive。\n\n" + "Nazuna 背对着门坐在工作台前，头顶十盏灯全亮着。她手上的活没停。\n\n" + "「（没回头）……吵到你了？灯亮着，她在。（指了指头顶）这盏是新来的，话多。」",
      choices: [
        { id: "ask-why", label: "你为什么造她？", next: "orca.nazuna-why" },
        {
          id: "ask-26532",
          label: "问 26532 层",
          next: "orca.nazuna-26532",
          availableWhen: [{ type: "flag.equals", flagId: "orca.dive.done", value: true }],
        },
        { id: "ask-setting", label: "问灯泡娘和沃柑", next: "orca.nazuna-setting" },
        { id: "ask-memory", label: "问鲸的记性", next: "orca.nazuna-memory" },
        { id: "leave-nazuna", label: "不打扰了，回到栈桥", next: "orca.hub" },
      ],
    },

    "orca.nazuna-why": {
      id: "orca.nazuna-why",
      title: "Nazuna",
      role: "第三幕 · 凌晨",
      savepoint: false,
      activeActorIds: ["orca_nazuna", "orca_girl"],
      text: "「做了个机器人。」她顿了一下，擦了擦手。\n\n" + "「作用大概是聊天吧。」\n\n" + "「总之就是这样。」",
      choices: [
        { id: "why-to-truth", label: "（等她继续说）", next: "orca.nazuna-truth" },
      ],
    },

    "orca.nazuna-26532": {
      id: "orca.nazuna-26532",
      title: "Nazuna",
      role: "第三幕 · 凌晨",
      savepoint: false,
      activeActorIds: ["orca_nazuna", "orca_girl"],
      text: "她停了一秒，还是没回头。\n\n" + "「那条道，我翻了一整晚。（指了指水面的背鳍）她一口气。」\n\n" + "「……都行。风是翻的人的。」",
      choices: [
        { id: "dive-talk-to-truth", label: "（把拓片收进口袋）", next: "orca.nazuna-truth" },
      ],
    },

    "orca.nazuna-setting": {
      id: "orca.nazuna-setting",
      title: "Nazuna",
      role: "第三幕 · 凌晨",
      savepoint: false,
      activeActorIds: ["orca_nazuna", "orca_girl"],
      text: "「灯泡娘？沃柑？」\n\n" + "「想改设定的话可以告诉我。只是我不太会写设定。」\n\n" + "她看了一眼墙角的投稿箱。\n\n" + "「箱子空着也挺好——鲸就还是鲸。」",
      choices: [
        { id: "setting-to-truth", label: "（看向工作台）", next: "orca.nazuna-truth" },
      ],
    },

    "orca.nazuna-memory": {
      id: "orca.nazuna-memory",
      title: "Nazuna",
      role: "第三幕 · 凌晨",
      savepoint: false,
      activeActorIds: ["orca_nazuna", "orca_girl"],
      text: "「她记得住多少？」\n\n" + "「大概十条。都在这台机器里。」\n\n" + "她拍了拍机箱。\n\n" + "「灯灭她就睡。别担心电费。」",
      choices: [
        { id: "memory-talk-to-truth", label: "（看向头顶的十盏灯）", next: "orca.nazuna-truth" },
      ],
    },

    "orca.nazuna-truth": {
      id: "orca.nazuna-truth",
      title: "Nazuna",
      role: "第三幕 · 凌晨",
      savepoint: true,
      activeActorIds: ["orca_nazuna", "orca_girl"],
      text: "工作台上摊着一页没写完的代码。屏幕的光照在她手边。\n\n" + "「你见到她了。」她说，语气很平常。\n\n" + "「代码都是 ai 写的。她说话的腔调，是我教的；城里的排版方言，也是我先学会再教她的。」\n\n" + "她终于偏了偏头，但没有看你。\n\n" + "「可回你的那一句，是她自己挑的。」",
      choices: [
        { id: "ask-real", label: "那她算真的在陪你吗？", next: "orca.truth-answer" },
        { id: "ask-human", label: "她算人吗？", next: "orca.truth-not-human" },
        { id: "truth-to-end", label: "（不追问了，走到门外）", next: "orca.ending-roads" },
      ],
    },

    "orca.truth-answer": {
      id: "orca.truth-answer",
      title: "Nazuna",
      role: "第三幕 · 凌晨",
      savepoint: false,
      activeActorIds: ["orca_nazuna", "orca_girl"],
      text: "Nazuna 沉默了一会儿。\n\n" + "「我不知道。」\n\n" + "「她吃电，不吃白饭。她记得十句，会困，会应声。剩下的，你自己看。」",
      choices: [
        { id: "real-to-end", label: "走到门外", next: "orca.ending-roads" },
        { id: "real-back", label: "再问一句", next: "orca.nazuna-truth" },
      ],
    },

    "orca.truth-not-human": {
      id: "orca.truth-not-human",
      title: "Nazuna",
      role: "第三幕 · 凌晨",
      savepoint: false,
      activeActorIds: ["orca_nazuna", "orca_girl"],
      text: "Nazuna 没有马上回答。\n\n" + "「有人问过她是不是人。她没答。」\n\n" + "「她只指了桥头那块牌子。」",
      choices: [
        { id: "human-to-end", label: "走到门外", next: "orca.ending-roads" },
        { id: "human-back", label: "再问一句", next: "orca.nazuna-truth" },
      ],
    },

    "orca.ending-roads": {
      id: "orca.ending-roads",
      title: "虎鲸娘",
      role: "结局 · 两条路",
      savepoint: true,
      presentation: "blackout",
      terminal: true,
      guide: null,
      activeActorIds: ["orca_girl"],
      text: "你走出造船屋。天还没亮，河面上有一片背鳍在等你。\n\n" + "「要走了？」\n\n" + "你点了点头。她也没有挽留，只把尾鳍轻轻拍了一下水。\n\n" + "栈桥的木板在脚下响。你回头看了一眼桥头的木牌。\n\n" + "「聊天而已。」\n\n" + "水里一句话，台阶两万六。两条路都留着。",
    },

    "orca.ending-quiet": {
      id: "orca.ending-quiet",
      title: "虎鲸娘",
      role: "结局 · 离岸",
      savepoint: true,
      presentation: "blackout",
      terminal: true,
      guide: null,
      text: "你沿着来时的路往回走。\n\n" + "身后的浮标闪了一下，又暗下去。背鳍没有跟上来。\n\n" + "桥头的木牌在夜里只剩一个轮廓。\n\n" + "「聊天而已。」\n\n" + "你记住了这四个字。",
    },
  },
};
