import type { StoryDefinition } from "../../../stories/types";

/**
 * 支线剧情：她真好看
 *
 * 照相馆门口立着一只同题信箱，窗里叠着四封同名信。
 * 玩家按顺序读信，在长椅上听人把三十三个「我爱你」数完，
 * 正午看饭店店长投下三个字，最后决定要不要写第五封。
 *
 * 节点命名规范：beauty.<act>.<beat>
 * 旗标命名规范：beauty.<subject>.<key>
 */
export const BEAUTY_STORY: StoryDefinition = {
  schemaVersion: 1,
  definitionVersion: 1,
  id: "side.beauty.look",
  title: "她真好看",
  startNode: "beauty.start",
  entryActorId: "beauty_photographer",

  interactions: [
    { actorId: "beauty_photographer", nodeId: "beauty.start", choiceId: "read-first" },
  ],

  buildingInteractions: [
    { buildingId: "photostudio", nodeId: "beauty.start", choiceId: "read-first" },
  ],

  nodes: {
    /* ───────────────────── 序章：照相馆门口 ───────────────────── */

    "beauty.start": {
      id: "beauty.start", title: "程见", role: "序章", savepoint: true,
      guide: { title: "她真好看", objective: "在照相馆门口读第一封信" },
      activeActorIds: ["beauty_photographer"],
      text:
        "照相馆门口的玻璃橱窗擦得很亮。橱窗里摆着一排黑白照片，都是人的侧脸、背影，或者低头看东西的样子。\n\n" +
        "橱窗旁边立着一只奶油白的铸铁信箱。正面开着一扇小圆窗，里面叠着四张折起的信纸，标题朝外，四张上写着同一个名字：她真好看。\n\n" +
        "一个穿深色工作围裙的人正在换橱窗里的相框。她看见你停下，手里的相框没放下。\n\n" +
        "「看信，还是看照片？」",
      choices: [
        {
          id: "read-first", label: "「读第一封信。」", next: "beauty.letter-1",
          set: {
            "beauty.letters.read-all": false, "beauty.letter1.reread": false,
            "beauty.letter1.reread2": false, "beauty.paper.taken": false,
            "beauty.wrote": false, "beauty.not-wrote": false, "beauty.deferred": false,
            "beauty.noon.witnessed": false, "beauty.bench.counted": false,
            "beauty.cup.marked": false, "beauty.left": false,
          },
        },
        { id: "read-plaque", label: "「先看看铭牌。」", next: "beauty.plaque" },
        { id: "look-photos", label: "「这些照片是谁拍的？」", next: "beauty.photos" },
        { id: "walk-away", label: "（暂时走开）", next: "beauty.ending-leave" },
      ],
    },

    "beauty.plaque": {
      id: "beauty.plaque", title: "铭牌", role: "序章", savepoint: false,
      activeActorIds: ["beauty_photographer"],
      text:
        "铭牌不大，铜色的字被摸得发亮。\n\n" +
        "同名不同人。信会自己找到下一任。\n\n" +
        "侧面的小字更浅：第一封信投于去年夏天。\n\n" +
        "程见在你身后说：「四封，都是别人投的。我只负责让它们别淋雨。」",
      choices: [
        { id: "read-first", label: "「读第一封信。」", next: "beauty.letter-1" },
        { id: "look-photos", label: "「这些照片是谁拍的？」", next: "beauty.photos" },
        { id: "walk-away", label: "（暂时走开）", next: "beauty.ending-leave" },
      ],
    },

    "beauty.photos": {
      id: "beauty.photos", title: "程见", role: "序章", savepoint: false,
      activeActorIds: ["beauty_photographer"],
      text:
        "「我拍的。」程见把相框摆正。「都是来照相馆的人。有人要证件照，有人只想留一张自己现在的样子。」\n\n" +
        "橱窗里的照片没有一张正对镜头。有人在系鞋带，有人在看窗外的雨，有人低头笑。\n\n" +
        "「我拍的是人看东西的样子。」她说。「你觉得，这算看他们，还是算看他们看见的东西？」",
      choices: [
        { id: "ask-look", label: "「那什么叫好看？」", next: "beauty.photos-look" },
        { id: "ask-praise", label: "「夸人好看，有分寸吗？」", next: "beauty.photos-praise" },
        { id: "to-start", label: "「我先去看信。」", next: "beauty.start" },
      ],
    },

    "beauty.photos-look": {
      id: "beauty.photos-look", title: "程见", role: "序章", savepoint: false,
      activeActorIds: ["beauty_photographer"],
      text:
        "「好看是关系，不是分数。」程见用指节敲了敲玻璃。「同一个人，在等车的时候好看，在被人盯着看的时候就不一定好看了。」\n\n" +
        "她指了指最里面那张：照片里的人正低头看一张信纸，只露出半张脸。\n\n" +
        "「她知道自己站在橱窗里。我也知道她站在橱窗里。被看和看自己，是两件事。」",
      choices: [
        { id: "ask-praise", label: "「那夸人好看，算不算冒犯？」", next: "beauty.photos-praise" },
        { id: "back", label: "（再看一会儿照片）", next: "beauty.photos" },
      ],
    },

    "beauty.photos-praise": {
      id: "beauty.photos-praise", title: "程见", role: "序章", savepoint: false,
      activeActorIds: ["beauty_photographer"],
      text:
        "「夸可以。」程见说。「别替她决定她好看给谁看，也别把一句夸奖说成一张评分表。」\n\n" +
        "她把最后一张照片挂好，退后半步看了看。「我这儿有一条规矩：先问能不能拍，再问能不能夸。两次都点头，照片才留下。」\n\n" +
        "「信也一样。写的人点头了，读的人才有得读。」",
      choices: [
        { id: "read-first", label: "「我去读第一封信。」", next: "beauty.letter-1" },
        { id: "back", label: "（回到橱窗前）", next: "beauty.photos" },
      ],
    },

    /* ───────────────────── 第一封：去年夏天 ───────────────────── */

    "beauty.letter-1": {
      id: "beauty.letter-1", title: "第一封 · 去年夏天", role: "信纸",
      presentation: "document", savepoint: true,
      guide: { title: "她真好看", objective: "按顺序读完四封信" },
      text:
        "第一次玩这种游戏。以前对它的认识，只停留在背景音乐好听。\n\n" +
        "（我没有对着屏幕傻笑。）\n\n" +
        "休息的时候刷到一句话，我也有类似的感受，脑海里不住地感叹：校园生活好精彩。她真可爱（重点？）。\n\n" +
        "（我没有对着屏幕傻笑！）\n\n" +
        "回到现实，难免有一些落差。合上屏幕的那一刻，虚拟的一切只能留下数据，顺便带走了所谓「宝贵的时间」。\n\n" +
        "（我没有对着屏幕傻笑！！）\n\n" +
        "不过总有一些留了下来。沉浸的欢欣，过程中的治愈，让我在这打字的复杂而强烈的情绪，总能扫去一些烦恼，留下更美回忆……终不是浪费时间。\n\n" +
        "（我没有对着屏幕傻笑！！！）\n\n" +
        "有些快乐，看似稍纵即逝，不过他治愈着的是人。不要总是后悔没能作出最正确的选择。\n\n" +
        "（我真的没有对着屏幕傻笑！！！！）\n\n" +
        "——落款处有两个名字叠着。上面一个清晰，是「小满」；压在下面的旧墨迹洇开了，只能读出「故事里……人」。",
      choices: [
        { id: "read-again", label: "（再读一遍）", next: "beauty.letter-1-reread", set: { "beauty.letter1.reread": true } },
        { id: "look-signature", label: "（凑近看落款）", next: "beauty.letter-1-signature" },
        { id: "next-letter", label: "「翻到第二封。」", next: "beauty.letter-2" },
      ],
    },

    "beauty.letter-1-reread": {
      id: "beauty.letter-1-reread", title: "第一封 · 第二遍", role: "信纸",
      presentation: "document", savepoint: false,
      text:
        "你又从头读了一遍。\n\n" +
        "这一次，最后那行括号多了一句。\n\n" +
        "（我没有对着屏幕傻笑！！！！）\n" +
        "（……真的没有。）\n\n" +
        "字迹和前面的不太一样，像是后来补上去的。",
      choices: [
        { id: "read-third", label: "（再读第三遍）", next: "beauty.letter-1-third" },
        { id: "next-letter", label: "「翻到第二封。」", next: "beauty.letter-2" },
        { id: "to-menu", label: "（把信放回去）", next: "beauty.letters-menu" },
      ],
    },

    "beauty.letter-1-third": {
      id: "beauty.letter-1-third", title: "第一封 · 第三遍", role: "信纸",
      presentation: "document", savepoint: false,
      achievement: { id: "beauty_brackets", name: "括号病" },
      text:
        "第三遍。\n\n" +
        "信纸末尾又长出一行括号，仿佛它一直在等一个愿意再读的人。\n\n" +
        "（括号是会传染的。你没有傻笑，但你在数。）\n\n" +
        "程见在橱窗外看了你一眼，没有催。",
      choices: [
        {
          id: "read-third", label: "（把信折好）", next: "beauty.letter-2",
          set: { "beauty.letter1.reread2": true },
          effects: [
            { type: "event.publish", eventType: "story.achievement", payload: { id: "beauty_brackets", name: "括号病" } },
          ],
        },
        { id: "to-menu", label: "（回到信箱前）", next: "beauty.letters-menu" },
      ],
    },

    "beauty.letter-1-signature": { id: "beauty.letter-1-signature", title: "落款", role: "信纸", presentation: "document", savepoint: false,
      text:
        "落款处的两张纸粘在一起，边缘起了毛。\n\n" +
        "上面的「小满」笔画很新。下面那层旧墨迹被水浸过，只剩几个残笔：故事里……人。\n\n" +
        "程见说：「我没问过。信是别人投的，落款也是别人留的。我只管别让它们被雨打湿。」",
      choices: [
        { id: "look-closer", label: "（把信纸举到灯下）", next: "beauty.letter-1-ink" },
        { id: "back", label: "（把信翻回去）", next: "beauty.letter-1" },
      ],
    },

    "beauty.letter-1-ink": { id: "beauty.letter-1-ink", title: "两层墨迹", role: "信纸", presentation: "document", savepoint: false,
      text:
        "你把信纸举到灯下。两层墨迹短暂地分开了一瞬，又慢慢晕回去。\n\n" +
        "小满。\n" +
        "故事里……人。\n\n" +
        "没有谁先谁后，也没有谁能替它们认领。程见把台灯挪远了一点。\n\n" +
        "「有些落款不是用来查清楚的。」她说。「是用来让人多看一眼的。」",
      choices: [
        { id: "back", label: "（把信翻回去）", next: "beauty.letter-1" },
        { id: "next-letter", label: "「翻到第二封。」", next: "beauty.letter-2" },
      ],
    },

    /* ───────────────────── 第二封：去年秋天 ───────────────────── */

    "beauty.letter-2": {
      id: "beauty.letter-2", title: "第二封 · 去年秋天", role: "信纸",
      presentation: "document", savepoint: true,
      text:
        "（标题致敬某故事的《她真好看》awa）\n\n" +
        "（写得还不错……要不申个精？反正也不是先例了……）（欢迎支持）（重复率、AIGC 均为 0%）\n\n" +
        "出于平替的目的，从应用商店搞下来一个叫《狐姬零》的。说实话，最开始并没有抱多大期待。但事实证明我错了。除了有点短以外，真的是一部非常非常好的作品。感触颇深，难以排解，遂撰文以寄。\n\n" +
        "干净的灵魂，朴素的感情。剧情塑造了一对浑然天成的、最为纯粹的伴侣……仅仅只是欣赏这样两颗干净的灵魂绕着同一个质心旋转，安静地沉湎于绵长而细腻的幸福中，也不失为一部好的作品。\n\n" +
        "鲁迅《彷徨》里，别的作品我都没什么印象了，偏偏那《伤逝》，是最让我难以忘怀的。大概是因为爱情，是跨越时代的，是可以朴素的。\n\n" +
        "（信纸背面另有三段，讲一个向大风车蹒跚斡旋的骑士、一个注定百年孤独的家族、和人定胜天的浪漫——字迹到这里戛然而止，钢笔水用完了。）\n\n" +
        "——落款处的名字被雨水洇过，依稀是「何舟」。信纸背面贴着一张后来的补条，是别人的笔迹：「作者如今在很远的地方，当一名联络员。」信角盖着一枚小小的「精选」戳，戳边一行极小的字：编印。",
      choices: [
        { id: "read-stain", label: "（看那张补条）", next: "beauty.letter-2-stain" },
        { id: "read-stamp", label: "（看那枚「精选」戳）", next: "beauty.letter-2-stamp" },
        { id: "next-letter", label: "「翻到第三封。」", next: "beauty.letter-3" },
        { id: "to-bench", label: "（去长椅那边坐一会儿）", next: "beauty.bench-intro" },
      ],
    },

    "beauty.letter-2-stain": { id: "beauty.letter-2-stain", title: "补条", role: "信纸", presentation: "document", savepoint: false,
      text:
        "补条贴得很正，像后来的人特意把翘起的角按平了。\n\n" +
        "「作者如今在很远的地方，当一名联络员。」\n\n" +
        "没有地址，没有日期。雨水把「何舟」两个字洇成一团，只有最后一笔还立着。\n\n" +
        "程见说：「这封是我收的。那天雨大，他把信塞进投递口就跑了，伞都没撑。」",
      choices: [
        { id: "back", label: "（把信翻回去）", next: "beauty.letter-2" },
        { id: "next-letter", label: "「翻到第三封。」", next: "beauty.letter-3" },
      ],
    },

    "beauty.letter-2-stamp": { id: "beauty.letter-2-stamp", title: "精选", role: "信纸", presentation: "document", savepoint: false,
      text:
        "「精选」戳只有指甲盖大，红色已经发暗。戳边那行小字更小：编印。\n\n" +
        "「不是作者盖的。」程见说。「是读的人盖的。盖完也没留话。」\n\n" +
        "她顿了顿。「有时候，一个戳就够了。说明有人认真看完了。」",
      choices: [
        { id: "back", label: "（把信翻回去）", next: "beauty.letter-2" },
        { id: "next-letter", label: "「翻到第三封。」", next: "beauty.letter-3" },
      ],
    },

    /* ───────────────────── 第三封：去年秋末 ───────────────────── */

    "beauty.letter-3": {
      id: "beauty.letter-3", title: "第三封 · 去年秋末", role: "信纸",
      presentation: "document", savepoint: true,
      text:
        "「一切的一切都是物实造成的」\n\n" +
        "同名的两个作品，已经展现了不同的体裁和风格。\n\n" +
        "我相信自己能够写出一篇文学批评，也可以对自己进行分析，然而这是否漏掉了一些什么？\n\n" +
        "漏掉了情感！——一直以来。\n\n" +
        "（这封信的纸很薄。翻页的时候，能听见纸边擦过指尖的声音。）",
      choices: [
        { id: "press-page", label: "（按住下一页，慢慢翻开）", next: "beauty.letter-3-press" },
        { id: "skip", label: "（先翻到第四封）", next: "beauty.letter-4-1" },
        { id: "to-bench", label: "（去长椅那边坐一会儿）", next: "beauty.bench-intro" },
      ],
    },

    "beauty.letter-3-press": { id: "beauty.letter-3-press", title: "第三封 · 中段", role: "信纸", presentation: "document", savepoint: false,
      text:
        "你按住下一页，停了停。\n\n" +
        "纸面上写着：\n\n" +
        "我无法忍受按下回车键。每按一下，就感觉自己被别人捅了一刀。到最后，我按回车键越来越用力，感觉键盘都要被我拍散架了。\n\n" +
        "最后，她起身，非常虚弱地、用尽浑身力气向前走。还差三步的时候，她突然说：「我的终点就在前方了。」",
      choices: [
        { id: "next-page", label: "（继续往下读）", next: "beauty.letter-3-end" },
      ],
    },

    "beauty.letter-3-end": { id: "beauty.letter-3-end", title: "第三封 · 末页", role: "信纸", presentation: "document", savepoint: false,
      text:
        "孤独的记忆，一直传递，传递，传下去——直到有一天，夏天的堤坝上，两个不知道自己是谁的小孩并肩站着，孤独已经消失了。\n\n" +
        "信纸最下面只有一句，写得很轻：\n\n" +
        "经验应在理性之前，否则经验永世残缺。\n\n" +
        "——落款：沈实",
      choices: [
        { id: "next-letter", label: "「翻到第四封。」", next: "beauty.letter-4-1" },
        { id: "to-bench", label: "（去长椅那边坐一会儿）", next: "beauty.bench-intro" },
        { id: "to-menu", label: "（回到信箱前）", next: "beauty.letters-menu" },
      ],
    },

    /* ───────────────────── 第四封：今年深秋 ───────────────────── */

    "beauty.letter-4-1": {
      id: "beauty.letter-4-1", title: "第四封 · 一", role: "信纸",
      presentation: "document", savepoint: false,
      text:
        "第四封 · 今年深秋（四联信）\n\n" +
        "（一）\n\n" +
        "寒冷的极夜，浩瀚的冻原，沉默的星空，与在共产主义峰的最高点呼唤的、至纯粹的爱。",
      choices: [
        { id: "next-leaf", label: "（翻到第二张）", next: "beauty.letter-4-2" },
      ],
    },

    "beauty.letter-4-2": {
      id: "beauty.letter-4-2", title: "第四封 · 二", role: "信纸",
      presentation: "document", savepoint: false,
      text:
        "（二）\n\n" +
        "一座被围墙、铁丝网、瞭望塔和检查站围起来的城。作为交换，城里的货架永远是满的，看起来就像普通美好的城市。物理的边界，成了特权的边界。可最严密的边界，也无法阻止一个人向外部世界发出爱的呼唤。\n\n" +
        "长椅那边传来一声很轻的嘀咕：「居然是 zato 呢。」",
      choices: [
        { id: "next-leaf", label: "（翻到第三张）", next: "beauty.letter-4-3" },
      ],
    },

    "beauty.letter-4-3": {
      id: "beauty.letter-4-3", title: "第四封 · 三", role: "信纸",
      presentation: "document", savepoint: false,
      text:
        "（三）\n\n" +
        "她向宇宙发射电波，信念一天比一天坚定，甚至不在意宇宙是否会接收，又会怎样回应。无限的宇宙必须创造出一个「+1」——一个能看见它的观察者。她最终爬上信号塔的顶端。记忆早已消逝，身份分崩离析，却依然记得要说那句话。",
      choices: [
        { id: "next-leaf", label: "（翻到第四张）", next: "beauty.letter-4-4" },
      ],
    },

    "beauty.letter-4-4": {
      id: "beauty.letter-4-4", title: "第四封 · 四", role: "信纸",
      presentation: "document", savepoint: false,
      text:
        "（四）\n\n" +
        "我爱你。我爱你。我爱你。我爱你。我爱你。我爱你。我爱你。我爱你。我爱你。我爱你。\n\n" +
        "我爱你。我爱你。我爱你。我爱你。我爱你。我爱你。我爱你。我爱你。我爱你。我爱你。我\n\n" +
        "（终于写完了。还有——）\n\n" +
        "——落款：连舟。信纸边角用另一种颜色的笔补了一行外文，字迹被晨露洇开：Мокрый снег。",
      choices: [
        {
          id: "finish-letters", label: "（把四张信纸按原样折好）", next: "beauty.letter-4-done",
          set: { "beauty.letters.read-all": true },
          effects: [
            { type: "event.publish", eventType: "story.achievement", payload: { id: "beauty_read_all", name: "她真好看" } },
          ],
        },
      ],
    },

    "beauty.letter-4-done": {
      id: "beauty.letter-4-done", title: "四封读完", role: "信箱", savepoint: true,
      guide: { title: "她真好看", objective: "决定要不要写下第五封" },
      achievement: { id: "beauty_read_all", name: "她真好看" },
      text:
        "四封信，四个落款，四个完全不相干的故事。可它们都叫同一个名字。\n\n" +
        "信箱里传来一声很轻的「咔」。投递口弹开，缓缓吐出一张空白信纸。\n\n" +
        "标题栏已经印好了三个字：她真好看。",
      choices: [
        { id: "take-paper", label: "（接过空白信纸）", next: "beauty.blank-paper", set: { "beauty.paper.taken": true } },
        { id: "to-bench", label: "（先去长椅那边）", next: "beauty.bench-intro" },
        { id: "watch-noon", label: "（看看正午的街口）", next: "beauty.noon" },
        { id: "to-menu", label: "（再把信看一遍）", next: "beauty.letters-menu" },
      ],
    },

    "beauty.letters-menu": {
      id: "beauty.letters-menu", title: "同题信箱", role: "信箱", savepoint: true,
      activeActorIds: ["beauty_photographer"],
      text:
        "你退后一步。玻璃窗里的四封信还在原来的位置，像四个人各自站在自己的时间里。\n\n" +
        "程见把抹布搭在肩上。「慢慢看。信箱不催人。」",
      choices: [
        { id: "read-1", label: "读第一封", next: "beauty.letter-1" },
        { id: "read-2", label: "读第二封", next: "beauty.letter-2" },
        { id: "read-3", label: "读第三封", next: "beauty.letter-3" },
        { id: "read-4", label: "读第四封", next: "beauty.letter-4-1" },
        {
          id: "take-paper", label: "取空白信纸", next: "beauty.blank-paper",
          availableWhen: [{ type: "flag.equals", flagId: "beauty.letters.read-all", value: true }],
          set: { "beauty.paper.taken": true },
        },
        {
          id: "watch-noon", label: "看看正午的街口", next: "beauty.noon",
          availableWhen: [{ type: "flag.equals", flagId: "beauty.letters.read-all", value: true }],
        },
        { id: "walk-away", label: "（离开照相馆）", next: "beauty.ending-leave" },
      ],
    },

    /* ───────────────────── 终幕：空白信纸 ───────────────────── */

    "beauty.blank-paper": {
      id: "beauty.blank-paper", title: "空白信纸", role: "终幕", savepoint: true,
      guide: { title: "她真好看", objective: "写下第五封，或把信纸放回去" },
      activeActorIds: ["beauty_photographer"],
      text:
        "空白信纸从投递口探出一角，纸边压着一道旧折痕。\n\n" +
        "程见没有看你。「写不写都行。它已经在这儿等了很久，不差这一会儿。」\n\n" +
        "信纸左上角印着标题，右下角留着一小块空白，像是给落款留的。",
      choices: [
        { id: "write", label: "「写点什么。」", next: "beauty.write-choose" },
        {
          id: "not-write", label: "「不写，把信纸放回去。」", next: "beauty.ending-not-write",
          set: { "beauty.not-wrote": true },
          effects: [
            { type: "event.publish", eventType: "story.achievement", payload: { id: "beauty_not_write", name: "她真好看（不写）" } },
          ],
        },
        { id: "later", label: "「明天再说。」", next: "beauty.ending-later", set: { "beauty.deferred": true } },
      ],
    },

    "beauty.write-choose": {
      id: "beauty.write-choose", title: "第五封", role: "终幕", savepoint: false,
      activeActorIds: ["beauty_photographer"],
      text:
        "你把信纸铺在信箱顶上。笔尖悬着，迟迟没有落下。\n\n" +
        "最后，你写下——",
      choices: [
        {
          id: "write-look", label: "「她真好看。」", next: "beauty.write-submit",
          set: { "beauty.inscription": "她真好看" },
          effects: [{ type: "event.publish", eventType: "story.achievement", payload: { id: "beauty_fifth", name: "第五任" } }],
        },
        {
          id: "write-read", label: "「我也读完了。」", next: "beauty.write-submit",
          set: { "beauty.inscription": "我也读完了" },
          effects: [{ type: "event.publish", eventType: "story.achievement", payload: { id: "beauty_fifth", name: "第五任" } }],
        },
        {
          id: "write-bracket", label: "（画了一个空括号）", next: "beauty.write-submit",
          set: { "beauty.inscription": "（ ）" },
          effects: [{ type: "event.publish", eventType: "story.achievement", payload: { id: "beauty_fifth", name: "第五任" } }],
        },
        { id: "put-down", label: "（把笔放下）", next: "beauty.blank-paper" },
      ],
    },

    "beauty.write-submit": {
      id: "beauty.write-submit", title: "第五封", role: "终幕", savepoint: false,
      achievement: { id: "beauty_fifth", name: "第五任" },
      text:
        "你把信纸折好，投进窄缝。\n\n" +
        "嗒。\n\n" +
        "声音很轻，和别处的邮筒没什么两样。玻璃窗里，你的信贴着四封旧信，成了第五封。\n\n" +
        "程见在身后说：「它会在这儿。不会丢。」",
      choices: [
        { id: "wait-seven", label: "（过七天再来看看）", next: "beauty.cup-mark", set: { "beauty.wrote": true } },
        { id: "leave-now", label: "（转身离开）", next: "beauty.ending-write", set: { "beauty.wrote": true } },
      ],
    },

    "beauty.cup-mark": { id: "beauty.cup-mark", title: "第五封 · 七天后", role: "回访", presentation: "blackout", terminal: true, guide: null, savepoint: false,
      text:
        "七天后，你又路过照相馆。\n\n" +
        "玻璃窗里，你的信还在。左下角多了一个浅浅的圆形杯印，杯底的水痕已经干了。\n\n" +
        "程见正在擦橱窗。她顺着你的目光看了一眼，说：「有人把一杯东西放在你的信上，读完了，又拿走了。」\n\n" +
        "她没有说是谁。你也没有问。",
    },

    "beauty.ending-write": {
      id: "beauty.ending-write", title: "她真好看", role: "结局 · 写了",
      presentation: "blackout", terminal: true, guide: null,
      text:
        "你没有等那七天。\n\n" +
        "走出几步，你回头看了一眼。信箱在橱窗旁边站着，奶油白的漆皮在下午的光里有点发暖。\n\n" +
        "四封旧信，一封新的。标题都一样。\n\n" +
        "信会自己找到下一任。",
    },

    "beauty.ending-not-write": {
      id: "beauty.ending-not-write", title: "她真好看", role: "结局 · 没写",
      presentation: "blackout", terminal: true, guide: null,
      achievement: { id: "beauty_not_write", name: "她真好看（不写）" },
      text:
        "你把空白信纸推回投递口。\n\n" +
        "信纸滑进去，没有声音。\n\n" +
        "（信箱没有挽留你。）\n\n" +
        "程见把最后一张照片摆正。「不写也算一种回信。」她说。「至少你读到了这里。」",
    },

    "beauty.ending-later": {
      id: "beauty.ending-later", title: "她真好看", role: "结局 · 改日",
      presentation: "blackout", terminal: true, guide: null,
      text:
        "你把信纸留在原处，转身走进街口的人流。\n\n" +
        "明天、后天，或者某个下雨的下午，它还会在那里。\n\n" +
        "程见没有叫住你。橱窗里的照片安静地挂着，每一张都在看别的地方。",
    },

    "beauty.ending-leave": {
      id: "beauty.ending-leave", title: "她真好看", role: "结局 · 路过",
      presentation: "blackout", terminal: true, guide: null,
      text:
        "你朝街口走去。\n\n" +
        "身后没有脚步声，也没有人喊你。只有照相馆门上的小铃轻轻响了一下，像谁替你说了句再见。\n\n" +
        "那四封信还留在玻璃窗里。总有一天，会有人停下来。",
    },

    /* ───────────────────── 长椅：三十三个我爱你 ───────────────────── */

    "beauty.bench-intro": {
      id: "beauty.bench-intro", title: "游芒", role: "长椅", savepoint: true,
      activeActorIds: ["beauty_youmang"],
      text:
        "长椅上坐着一个人，手里捧着一杯已经不太热的茶。她的嘴唇微微动着，像在数什么。\n\n" +
        "你走近时，她正好数乱。\n\n" +
        "「（第十五个……不对，刚才数到几了？）……重新来。」",
      choices: [
        { id: "ask-count", label: "「你在数什么？」", next: "beauty.bench-count" },
        { id: "ask-read", label: "「这四封信你都读过吗？」", next: "beauty.bench-read" },
        { id: "sit-quiet", label: "（在长椅另一端安静坐下）", next: "beauty.bench-sit" },
      ],
    },

    "beauty.bench-count": {
      id: "beauty.bench-count", title: "游芒", role: "长椅", savepoint: false,
      activeActorIds: ["beauty_youmang"],
      text:
        "「写四封信的那位，留了二十个『我爱你』在信尾。有人在他的信底下回了三十三个。」她喝了口茶。「我在替写信的人数一遍。数到一半总被打断。你算是第……不说了，会显得我很记仇。」",
      choices: [
        { id: "back", label: "「那你继续数。」", next: "beauty.bench-menu" },
      ],
    },

    "beauty.bench-read": {
      id: "beauty.bench-read", title: "游芒", role: "长椅", savepoint: false,
      activeActorIds: ["beauty_youmang"],
      text:
        "「第二封读得最仔细。作者当年把整个组织都写进过一封信里。」她顿了顿。「文笔很好。人走了，去当联络员了。信箱不管这些——信留在这儿，就算数。」",
      choices: [
        { id: "back", label: "（在长椅上坐一会儿）", next: "beauty.bench-menu" },
      ],
    },

    "beauty.bench-sit": {
      id: "beauty.bench-sit", title: "游芒", role: "长椅", savepoint: false,
      activeActorIds: ["beauty_youmang"],
      text:
        "你在长椅另一端坐下。她没有看你，只是把茶杯放在膝盖上，继续数。\n\n" +
        "界面上开始逐行浮出她的声音。\n\n" +
        "「我爱你。」\n「我爱你。」\n「我爱你。」\n「我爱你。」\n「我爱你。」\n「我爱你。」\n「我爱你。」\n「我爱你。」\n" +
        "「我爱你。」\n「我爱你。」\n「我爱你。」\n「我爱你。」\n「我爱你。」\n「我爱你。」\n「我爱你。」\n「我爱你。」\n\n" +
        "数到第十七行，她停了一下。\n\n" +
        "「（刚才数到几了？）」\n\n" +
        "然后她从头开始数，字幕却没有清零。两串数字叠在一起，越数越慢。\n\n" +
        "「我爱你。」\n「我爱你。」\n「我爱你。」\n「我爱你。」\n「我爱你。」\n「我爱你。」\n「我爱你。」\n「我爱你。」\n" +
        "「我爱你。」\n「我爱你。」\n「我爱你。」\n「我爱你。」\n「我爱你。」\n「我爱你。」\n「我爱你。」\n「我爱你。」\n" +
        "「我爱你。」\n\n" +
        "第三十三个「我爱你」落下时，街上正好有一阵风。",
      choices: [
        {
          id: "listen", label: "（安静听完）", next: "beauty.bench-count-done",
          set: { "beauty.bench.counted": true },
          effects: [
            { type: "event.publish", eventType: "story.achievement", payload: { id: "beauty_thirtythree", name: "我爱你，我爱你" } },
          ],
        },
      ],
    },

    "beauty.bench-count-done": {
      id: "beauty.bench-count-done", title: "游芒", role: "长椅", savepoint: false,
      activeActorIds: ["beauty_youmang"],
      achievement: { id: "beauty_thirtythree", name: "我爱你，我爱你" },
      text:
        "最后一个字落下，她安静了一会儿。\n\n" +
        "「（三十三个。一个不少。）」\n\n" +
        "她转过头看你。「你听完了。很少人听人把话说完。」\n\n" +
        "她把空茶杯收进袋子里，站起来，又坐回去，像是临时改了主意。",
      choices: [
        { id: "back", label: "「你还要再数一遍吗？」", next: "beauty.bench-menu" },
      ],
    },

    "beauty.bench-menu": {
      id: "beauty.bench-menu", title: "游芒", role: "长椅", savepoint: false,
      activeActorIds: ["beauty_youmang"],
      text:
        "风把长椅旁边的树叶吹得响了一下。游芒把茶杯放在两人中间，像放下一件不急的事。",
      choices: [
        { id: "ask-signature", label: "「第一封信的落款，到底是谁？」", next: "beauty.bench-signature" },
        { id: "ask-postbox", label: "「为什么要在一个信箱里读信？」", next: "beauty.bench-postbox" },
        { id: "to-corner", label: "（回到信箱前）", next: "beauty.corner" },
      ],
    },

    "beauty.bench-signature": {
      id: "beauty.bench-signature", title: "游芒", role: "长椅", savepoint: false,
      activeActorIds: ["beauty_youmang"],
      text:
        "游芒没有马上回答。她把杯盖打开，又盖上。\n\n" +
        "「问过两个人。一个说是维护工，那台查询 Bot 的主人。一个说——是故事里的人。」\n\n" +
        "「我自己去看过，墨迹是叠的。两个字压着三个字，谁先谁后说不清。」",
      choices: [
        { id: "ask-more", label: "「那到底算谁的？」", next: "beauty.bench-signature-more" },
        { id: "back", label: "（不再追问）", next: "beauty.bench-menu" },
      ],
    },

    "beauty.bench-signature-more": { id: "beauty.bench-signature-more", title: "游芒", role: "长椅", savepoint: false,
      activeActorIds: ["beauty_youmang"],
      text:
        "「西山档案局遇到这种案子，编号后面打三个问号。」她用手指在膝盖上画了三下。「？？？的意思是：谁认领，就是谁的。」\n\n" +
        "她抬眼看你。「你要是想认领，也可以。档案局不管这个。」",
      choices: [
        { id: "back", label: "（把这个问题留在长椅上）", next: "beauty.bench-menu" },
      ],
    },

    "beauty.bench-postbox": {
      id: "beauty.bench-postbox", title: "游芒", role: "长椅", savepoint: false,
      activeActorIds: ["beauty_youmang"],
      text:
        "「你见过那个鱼形邮筒吗？祠堂那边。投进去，『嗒』，永远没有回执。」\n\n" +
        "她指了指面前的信箱。「这只不一样。你看玻璃窗里，四封，同一个名字。第一封投下去的时候，谁也不知道会有第二封。」\n\n" +
        "「十五个月，回信自己来了。这城里的邮政系统很慢，但不丢件。」",
      choices: [
        { id: "back", label: "（再看一眼玻璃窗）", next: "beauty.bench-menu" },
      ],
    },

    /* ───────────────────── 正午：三个字的信 ───────────────────── */

    "beauty.noon": {
      id: "beauty.noon", title: "正午", role: "街角", savepoint: true,
      activeActorIds: ["beauty_lai"],
      text:
        "正午十二点，街上的影子缩到脚边。\n\n" +
        "阿濑从物实饭店的方向走来，围裙还没解，口袋里的勺子随着步子轻响。她在信箱前站定，先看了一会儿玻璃窗，然后一封一封读下去。\n\n" +
        "读到最后，她把信纸按原样折好，从口袋里摸出一支笔。",
      choices: [
        { id: "watch-all", label: "（看完整个下午的这一小段）", next: "beauty.noon-write" },
        { id: "leave", label: "（先去别处）", next: "beauty.corner" },
      ],
    },

    "beauty.noon-write": {
      id: "beauty.noon-write", title: "阿濑", role: "街角", savepoint: false,
      activeActorIds: ["beauty_lai"],
      text:
        "她写字很快。笔尖压着纸，肩膀微微前倾，像在灶前尝一口汤。\n\n" +
        "写完，她把纸条折成很小的一个方块，投进窄缝。\n\n" +
        "嗒。\n\n" +
        "声音落下去，她站着没动，像在等锅里的水重新沸起来。",
      choices: [
        {
          id: "look-window", label: "（走近看玻璃窗）", next: "beauty.noon-window",
          set: { "beauty.noon.witnessed": true },
          effects: [
            { type: "event.publish", eventType: "story.achievement", payload: { id: "beauty_three_words", name: "三个字的信" } },
          ],
        },
        { id: "leave", label: "（不打扰她）", next: "beauty.noon-leave" },
      ],
    },

    "beauty.noon-window": {
      id: "beauty.noon-window", title: "玻璃窗", role: "街角", savepoint: false,
      activeActorIds: ["beauty_lai"],
      achievement: { id: "beauty_three_words", name: "三个字的信" },
      text:
        "玻璃窗里多了一张新的小纸条，压在最上面那封信的旁边。\n\n" +
        "上面只有三个字。\n\n" +
        "她真好看。\n\n" +
        "阿濑已经转身往回走。走出五步，她回头看了你一眼。",
      choices: [
        { id: "follow", label: "（跟上去）", next: "beauty.noon-leave" },
        { id: "back", label: "（不打扰她）", next: "beauty.corner" },
      ],
    },

    "beauty.noon-leave": {
      id: "beauty.noon-leave", title: "阿濑", role: "街角", savepoint: false,
      activeActorIds: ["beauty_lai"],
      text:
        "「汤要炖过了。」阿濑说。\n\n" +
        "她把手在围裙上擦了一下，继续往饭店走。走到街角，又补了一句，声音轻得像说给自己听：\n\n" +
        "「（看完了？）……汤要炖过了。」",
      choices: [
        { id: "back", label: "（回到照相馆门口）", next: "beauty.corner" },
      ],
    },

    "beauty.corner": {
      id: "beauty.corner", title: "照相馆门口", role: "街角", savepoint: true,
      activeActorIds: ["beauty_photographer"],
      guide: { title: "她真好看", objective: "读信、等人，或写下自己的第五封" },
      text:
        "你回到照相馆门前。信箱还在，橱窗里的照片也还在。\n\n" +
        "程见把「营业中」的牌子翻了个面。「要走了？」",
      choices: [
        { id: "to-bench", label: "（去长椅那边）", next: "beauty.bench-intro" },
        { id: "watch-noon", label: "（看看正午的街口）", next: "beauty.noon" },
        {
          id: "take-paper", label: "（取空白信纸）", next: "beauty.blank-paper",
          availableWhen: [{ type: "flag.equals", flagId: "beauty.letters.read-all", value: true }],
          set: { "beauty.paper.taken": true },
        },
        { id: "to-menu", label: "（再看一遍信）", next: "beauty.letters-menu" },
        { id: "walk-away", label: "（离开照相馆）", next: "beauty.ending-leave" },
      ],
    },
  },
};
