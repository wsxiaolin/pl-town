import type { StoryDefinition } from "../../../stories/types";
/**
 * 支线剧情：《物实之辉周刊》
 *
 * 一座小城的周报，每个周日出刊。玩家从报亭买下第一份报纸，
 * 进入编辑部、参加选题会、跟一次采访与排版，最后陪报社熬过截稿夜。
 *
 * 四个结尾：出街 / 空桌回访 / 夏日信箱 / 特刊之夜。
 * 新增 NPC：热月(weekly_editor)、绵州薛定谔(weekly_schrodinger)、
 * 物理达人(weekly_master)、送报鸽(weekly_pigeon)。
 */
export const WEEKLY_STORY: StoryDefinition = {
  schemaVersion: 1,
  definitionVersion: 1,
  id: "side.weekly.glow",
  title: "物实之辉周刊",
  startNode: "newsstand",
  entryActorId: "weekly_editor",
  interactions: [
    { actorId: "weekly_editor", nodeId: "newsstand", choiceId: "buy-paper" },
  ],
  buildingInteractions: [
    { buildingId: "weekly_news", nodeId: "newsstand", choiceId: "buy-paper" },
  ],
  nodes: {

    /* ───────────────────── 序章：报亭 ───────────────────── */
    newsstand: {
      id: "newsstand",
      title: "报亭",
      role: "序章",
      savepoint: true,
      activeActorIds: ["weekly_editor"],
      guide: { title: "物实之辉周刊", objective: "在报社门口的报亭买一份本周的报纸" },
      text:
        "报社临街的报亭擦得很亮，窗口用图钉挂着一沓报纸样张。最上面一张还带着油墨的温度。\n\n" +
        "一个系着围裙的女人正踮脚换样张，指尖沾着洗不掉的黑色。她回头看了你一眼。\n\n" +
        "「买报的？今天的刚送出来。」\n\n" +
        "她敲了敲窗玻璃。玻璃后面是一台老式计数器，数字停在一串很久以前的访问量上。",
      choices: [
        {
          id: "buy-paper",
          label: "买一份本周的《物实之辉周刊》。",
          next: "first-read",
          effects: [
            {
              type: "event.publish",
              eventType: "story.achievement",
              payload: { id: "weekly_new_subscriber", name: "新订户" },
            },
          ],
        },
        {
          id: "just-headlines",
          label: "先看看样张上的标题。",
          next: "old-sample",
        },
      ],
    },
    "first-read": {
      id: "first-read",
      title: "报亭",
      savepoint: false,
      activeActorIds: ["weekly_editor"],
      text:
        "《物实之辉周刊》\n\n" +
        "「夜空中的明星划过天穹，留下数迹星辉，汇成了破晓」\n\n" +
        "——本周看点——\n\n" +
        "精知优选、兰台新议、冲精防淹、实验区的问候……每个栏目下面都列着本周城里真实发生过的事。哪栋建筑换了灯，哪条巷子修了路，谁在实验区交出了新作品。\n\n" +
        "报纸末尾有一行手写的尾声。字很小，最后一句是：「平凡的一周。祝小城欣欣向荣。」",
      choices: [
        { id: "read-feature", label: "把报纸读到最后。", next: "newsroom-door" },
        { id: "read-ending", label: "先看结尾的编辑手记。", next: "newsroom-door" },
      ],
    },
    "old-sample": {
      id: "old-sample",
      title: "报亭",
      savepoint: false,
      activeActorIds: ["weekly_editor"],
      text:
        "报亭窗口的钉子上挂着一沓旧报样张。最旧的一张边角发黄，报头是另一种字体：「星辉周刊」。\n\n" +
        "两张样张的题眼一字不差。只是刊名换了，出刊的日子没换。\n\n" +
        "女人把旧样张扶正。\n\n" +
        "「改名那年，报社从民间组织改组成通讯社。刊号没断，编辑也没散。」\n\n" +
        "她拍了拍样张上的灰。「报纸没有死，它在换心脏。」",
      choices: [
        { id: "just-go", label: "把标题记在心里，推门进报社。", next: "newsroom-door" },
      ],
    },

    /* ───────────────────── 第一幕：编辑部 ───────────────────── */
    "newsroom-door": {
      id: "newsroom-door",
      title: "编辑部",
      role: "第一幕 · 编辑部",
      savepoint: true,
      activeActorIds: ["weekly_editor"],
      guide: { title: "物实之辉周刊", objective: "在编辑部里和热月说话" },
      text:
        "推门是油墨味。\n\n" +
        "她已经回到案前，伏着身，指尖是黑的。\n\n" +
        "「买报的？报亭在外面。」\n\n" +
        "「不过既然进来了——」她抬起头，「你是想看报纸怎么印，还是来投稿？」",
      choices: [
        { id: "ask-print", label: "我想看看报纸是怎么印出来的。", next: "press-talk" },
        { id: "submit-letter", label: "我来投稿。", next: "letter-desk" },
        { id: "look-around", label: "随便逛逛。", next: "type-tray" },
      ],
    },
    "press-talk": {
      id: "press-talk",
      title: "热月",
      savepoint: false,
      activeActorIds: ["weekly_editor"],
      text:
        "「你来的不巧，印刷机周日晚上才开。不过——」\n\n" +
        "她从案头抽出一叠校样。\n\n" +
        "「今天的版还没下印。你看，这栏叫精知优选，本周城里值得看的东西都在这儿；这栏叫冲精防淹，是给还没被看见的好东西占的座。」\n\n" +
        "「报纸这东西，说到底是替忙人省时间，替好东西说句话。」\n\n" +
        "「替好东西说句话？」你问。\n\n" +
        "「城里每天发生那么多事，好东西淹了太可惜。我们就是干防洪的。」她顿了顿，像是觉得这个说法有点好笑。「防淹。我们自己起的名。」",
      choices: [
        { id: "ask-topic", label: "「那今天选什么题？」", next: "topic-meeting" },
      ],
    },
    "type-tray": {
      id: "type-tray",
      title: "字盘",
      savepoint: false,
      activeActorIds: ["weekly_editor"],
      text:
        "「别碰字盘就行。那副字模少了一枚『锶』，全社就靠剩下的排班呢。」\n\n" +
        "她继续低头排版。\n\n" +
        "你绕着墙边看了一圈。字盘一格一格排得整齐，只有一处空着，空位里塞着一张对折的纸条。",
      choices: [
        { id: "read-note", label: "抽出字模空位里的纸条。", next: "type-note" },
        { id: "leave-tray", label: "不碰字盘，去里间。", next: "topic-meeting" },
      ],
    },
    "type-note": {
      id: "type-note",
      title: "字盘",
      savepoint: false,
      text:
        "纸条上是另一种字迹，写得很快：\n\n" +
        "「这枚字模搬去了新字盘，出门右转，找他的小号。」\n\n" +
        "你把纸条放回去，空位还是空着。",
      choices: [
        { id: "to-meeting", label: "去里间。", next: "topic-meeting" },
      ],
    },
    "letter-desk": {
      id: "letter-desk",
      title: "投稿箱",
      savepoint: true,
      activeActorIds: ["weekly_editor"],
      guide: { title: "物实之辉周刊", objective: "决定给报社投什么稿" },
      text:
        "「读者来信？」\n\n" +
        "她推来一张稿纸。\n\n" +
        "「写吧。署名随意，但每周每人限一封——版面就一栏，我不想让它变成两个人的聊天室。」\n\n" +
        "稿纸分成三栏：读者来信、新闻线索、给冲精防淹栏的推荐。",
      choices: [
        {
          id: "reader-letter",
          label: "写一封读者来信。",
          next: "letter-written",
          set: { "weekly.letter": "reader" },
        },
        {
          id: "news-tip",
          label: "投一条新闻线索。",
          next: "letter-written",
          set: { "weekly.letter": "tip" },
        },
        {
          id: "recommend",
          label: "推荐一件还没被看见的作品。",
          next: "letter-written",
          set: { "weekly.letter": "recommend" },
          effects: [
            {
              type: "event.publish",
              eventType: "story.achievement",
              payload: { id: "weekly_flood_guard", name: "防淹队员" },
            },
          ],
        },
      ],
    },
    "letter-written": {
      id: "letter-written",
      title: "投稿箱",
      savepoint: false,
      activeActorIds: ["weekly_editor"],
      text:
        "稿纸收进桌角的木匣。\n\n" +
        "「下周取报时，记得翻信箱。」\n\n" +
        "她把木匣盖好，又补了一句：「见报有稿酬。按篇数计，按质量评——本社三周年起实行的。」",
      choices: [
        { id: "to-meeting", label: "去里间的选题会。", next: "topic-meeting" },
      ],
    },

    /* ───────────────────── 第二幕：选题会 ───────────────────── */
    "topic-meeting": {
      id: "topic-meeting",
      title: "选题会",
      role: "第二幕 · 选题会",
      savepoint: true,
      activeActorIds: ["weekly_editor", "weekly_schrodinger"],
      guide: { title: "物实之辉周刊", objective: "参加编辑部的选题会" },
      text:
        "里间一张长桌，桌上摊着空白版面和一本翻旧的集报册。\n\n" +
        "一个戴眼镜的编辑正一页页数日期。\n\n" +
        "「可曾有人记得，本报创刊那天也是个周日？」\n\n" +
        "热月头也不抬：「记得。第 40 期的印刷机还卡过一次纸。」\n\n" +
        "「都记在册子上了。」戴眼镜的编辑合上册子，看向你，「新来的？那今天这版，你提个题。」",
      choices: [
        { id: "propose-lab", label: "提一个实验区的新作。", next: "topic-lab" },
        { id: "propose-alley", label: "说说老巷里的事。", next: "topic-alley" },
        { id: "propose-wall", label: "提议写荣誉墙。", next: "topic-wall" },
      ],
    },
    "topic-lab": {
      id: "topic-lab",
      title: "选题会",
      savepoint: false,
      activeActorIds: ["weekly_editor", "weekly_schrodinger"],
      text:
        "「实验区这周上了三件新作品。」你刚说完，戴眼镜的编辑就报出了日期和期号。\n\n" +
        "热月在版面上画了一个框。「放精知优选。按学科归类，每类至多两条。」\n\n" +
        "「稿子谁写？」\n\n" +
        "「我去。」你听见自己说。",
      choices: [
        { id: "to-interview-lab", label: "去实验区采访。", next: "interview-lab" },
      ],
    },
    "topic-alley": {
      id: "topic-alley",
      title: "选题会",
      savepoint: false,
      activeActorIds: ["weekly_editor", "weekly_schrodinger"],
      text:
        "热月听完，想了一会儿。\n\n" +
        "「新闻不必都大。灯修好了，路通了，猫又胖了——平凡的一周也有可写的。」\n\n" +
        "戴眼镜的编辑在册子边上记了一笔：「上周报里问过一句，这周正好有人回答。你去听听。」",
      choices: [
        { id: "to-interview-alley", label: "去老巷采访。", next: "interview-alley" },
      ],
    },
    "topic-wall": {
      id: "topic-wall",
      title: "选题会",
      savepoint: false,
      activeActorIds: ["weekly_editor", "weekly_schrodinger"],
      text:
        "「荣誉墙？」戴眼镜的编辑抬起头。\n\n" +
        "热月把笔放下。「铜牌不会说话，但有人每周擦它。」\n\n" +
        "「那就写擦牌子的人。」她说，「别写名字，写那块牌子为什么一直亮着。」",
      choices: [
        { id: "to-interview-wall", label: "去荣誉墙看看。", next: "interview-wall" },
      ],
    },

    /* ───────────────────── 第三幕：采访与排版 ───────────────────── */
    "interview-lab": {
      id: "interview-lab",
      title: "实验区",
      role: "第三幕 · 采访与排版",
      savepoint: true,
      activeActorIds: ["weekly_master"],
      guide: { title: "物实之辉周刊", objective: "在实验区完成一次采访" },
      text:
        "实验区的桌上摊着半成品，一个穿工作服的男人正把零件一件件收进盒子。\n\n" +
        "「采访？来得正好。」他拉过一把椅子，「年底不远了，年度大事件的稿子该约起来了！」\n\n" +
        "他说着，从抽屉里摸出一叠报名表，像是早就等着有人来问。\n\n" +
        "「今年谁家的实验最出挑，欢迎来信报个名——编辑部茶水管够，稿费从下季度起真的有了。」\n\n" +
        "他把报名表推到你面前，又想起什么。「对了，今年年终的年度大事件该编了。你回去跟热月说一声，别又拖到最后一期。」",
      choices: [
        { id: "to-layout", label: "把报名表收好，回报社排版。", next: "layout-desk" },
      ],
    },
    "interview-alley": {
      id: "interview-alley",
      title: "老巷",
      role: "第三幕 · 采访与排版",
      savepoint: true,
      activeActorIds: ["weekly_schrodinger"],
      guide: { title: "物实之辉周刊", objective: "在老巷里听完这周的回答" },
      text:
        "老巷很窄，墙根晒着刚洗的菜篮。戴眼镜的编辑走在你前面，不时停下来记一笔。\n\n" +
        "「上周报里的尾声问了一句：这周有没有哪件小事值得记住？」\n\n" +
        "他合上本子。「这几天，总有人在回答。」",
      choices: [
        {
          id: "hear-echo",
          label: "听巷口的人怎么回答上周的问题。",
          next: "echo-answer",
          effects: [
            {
              type: "event.publish",
              eventType: "story.achievement",
              payload: { id: "weekly_echo", name: "回声" },
            },
          ],
        },
        { id: "to-layout", label: "够了，回报社排版。", next: "layout-desk" },
      ],
    },
    "echo-answer": {
      id: "echo-answer",
      title: "老巷",
      savepoint: false,
      activeActorIds: ["weekly_schrodinger"],
      text:
        "巷口修鞋的老人头也不抬。\n\n" +
        "「报上问，这周有没有哪件小事值得记住。有啊。昨天有人把巷口的灯修好了。」\n\n" +
        "他敲了敲鞋底。「灯亮了，晚上收摊就不摸黑了。这算不算？」\n\n" +
        "戴眼镜的编辑把这句话原样记下，笔尖在纸上顿了顿。\n\n" +
        "「报纸问，小城答。这栏就算齐了。」",
      choices: [
        { id: "to-layout", label: "回报社排版。", next: "layout-desk" },
      ],
    },
    "interview-wall": {
      id: "interview-wall",
      title: "荣誉墙",
      role: "第三幕 · 采访与排版",
      savepoint: true,
      activeActorIds: ["weekly_editor"],
      guide: { title: "物实之辉周刊", objective: "读完荣誉墙上的那行小字" },
      text:
        "编辑部右手墙挂着七块小铜牌，每块一个名字。\n\n" +
        "铜牌下方一行小字：「主导 6 次以上编撰工作者，可被赋予荣誉称号。标准会提升，但已成之名不受影响。」\n\n" +
        "最靠门的一块擦得最亮，亮到能照出人影。",
      choices: [
        { id: "ask-founder", label: "「为什么第一块铜牌擦得最亮？」", next: "founder-words" },
        { id: "ask-summer", label: "「他去哪儿了？」", next: "summer-hint" },
        { id: "to-layout", label: "记下墙上那句话，去排版。", next: "layout-desk" },
      ],
    },
    "founder-words": {
      id: "founder-words",
      title: "热月",
      savepoint: false,
      activeActorIds: ["weekly_editor"],
      text:
        "「他每周托人擦的。人不在城里，牌子不能蒙灰。」\n\n" +
        "「你信他会回来吗？」\n\n" +
        "热月把指尖的油墨在稿纸上蹭出一道灰。\n\n" +
        "「报纸出到大后天，他看到刊号就会回来的。办报的人戒不掉这个。」",
      choices: [
        { id: "to-layout", label: "去排版台。", next: "layout-desk" },
      ],
    },
    "summer-hint": {
      id: "summer-hint",
      title: "热月",
      savepoint: false,
      activeActorIds: ["weekly_editor"],
      text:
        "「去了个很远的地方，管一剧团的事。」\n\n" +
        "她低头收拾稿纸，声音很平。\n\n" +
        "「二编里写了，明年暑假回来。」\n\n" +
        "窗户开着，风把最上面一张校样吹得翻了个角。",
      choices: [
        { id: "to-layout", label: "去排版台。", next: "layout-desk" },
      ],
    },
    "layout-desk": {
      id: "layout-desk",
      title: "排版台",
      role: "第三幕 · 采访与排版",
      savepoint: true,
      activeActorIds: ["weekly_editor"],
      guide: { title: "物实之辉周刊", objective: "决定这一期头版的版式" },
      text:
        "排版台上铺着整张校样。热月把铅条一根根压进版槽，动作很稳。\n\n" +
        "「头版只有一栏宽的地方。」她把两支不同粗细的标题条推到你面前，「你选哪种排法？」\n\n" +
        "窗外有人在喊收摊。屋里只有铅字相碰的轻响。",
      choices: [
        {
          id: "bold-headline",
          label: "把标题排得醒目些。",
          next: "proofread",
          set: { "weekly.layout": "bold" },
        },
        {
          id: "quiet-headline",
          label: "把标题收小，把版面留给正文。",
          next: "proofread",
          set: { "weekly.layout": "quiet" },
        },
      ],
    },
    "proofread": {
      id: "proofread",
      title: "校样",
      savepoint: false,
      activeActorIds: ["weekly_editor"],
      text:
        "校样摊在灯下。你逐行看过去，最后停在页脚——刊号那一格空着。\n\n" +
        "热月去里间倒水了。红笔就搁在版边。\n\n" +
        "这期是第几期？你记得她说过，也记得自己可能记错了。",
      choices: [
        {
          id: "catch-error",
          label: "拿起红笔，把刊号补上。",
          next: "proof-catch",
          set: { "weekly.proofread": true },
        },
        {
          id: "ignore-error",
          label: "不动，等她回来自己看。",
          next: "proof-pass",
          set: { "weekly.proofread": false },
        },
      ],
    },
    "proof-catch": {
      id: "proof-catch",
      title: "校样",
      savepoint: false,
      activeActorIds: ["weekly_editor"],
      text:
        "红笔落下，数字补进空格。\n\n" +
        "热月端着水回来，目光在页脚停了一下。\n\n" +
        "「刊号别排错。」她说。然后很小声地补了一句，「谢谢。」\n\n" +
        "她把水杯放在你手边，又低头去看下一张校样。",
      choices: [
        { id: "to-deadline", label: "等周日晚上的印刷机。", next: "deadline-night" },
      ],
    },
    "proof-pass": {
      id: "proof-pass",
      title: "校样",
      savepoint: false,
      activeActorIds: ["weekly_editor"],
      text:
        "热月回来，目光在页脚停了一下。\n\n" +
        "她没说什么，从笔筒里抽出红笔，自己把刊号补上。\n\n" +
        "「下次看到，直接改。」她把笔放回原处，「报纸不怕改，怕的是没人看。」",
      choices: [
        { id: "to-deadline", label: "等周日晚上的印刷机。", next: "deadline-night" },
      ],
    },

    /* ───────────────────── 第四幕：截稿之夜 ───────────────────── */
    "deadline-night": {
      id: "deadline-night",
      title: "截稿之夜",
      role: "第四幕 · 截稿之夜",
      savepoint: true,
      activeActorIds: ["weekly_editor"],
      guide: { title: "物实之辉周刊", objective: "陪报社熬过这个截稿夜" },
      text:
        "周日晚上八点，印刷机准时响起来。\n\n" +
        "外面下着雨，编辑部里只开了一盏灯。热月卷起袖子，把最后一摞白纸搬上机台。\n\n" +
        "「今晚报纸一定要出去。」\n\n" +
        "她说完，才发现自己一直攥着那盆快枯又没枯的植物的叶子。",
      choices: [
        { id: "help-press", label: "留下来帮忙上墨。", next: "press-help" },
        { id: "fetch-pigeon", label: "去把送报鸽找来。", next: "pigeon-run" },
        { id: "watch-press", label: "站在门口看印刷机转起来。", next: "press-watch" },
      ],
    },
    "press-help": {
      id: "press-help",
      title: "印刷间",
      savepoint: false,
      activeActorIds: ["weekly_editor"],
      text:
        "油墨的味道一下子浓了。滚筒转起来，白纸从另一头出来时已经印满了字。\n\n" +
        "热月的手背上沾了一道黑，她没擦。\n\n" +
        "「三年九十六期，每个周日都是这么过来的。」\n\n" +
        "她盯着出口一张张数，像在数一整座城这一周的日子。",
      choices: [
        { id: "to-deadline-choice", label: "天快亮了。", next: "deadline-choice" },
      ],
    },
    "press-watch": {
      id: "press-watch",
      title: "印刷间",
      savepoint: false,
      activeActorIds: ["weekly_editor"],
      text:
        "机器响得整间屋子都在轻轻震。白纸一张接一张翻过去，油墨在灯下泛着湿光。\n\n" +
        "热月站在机台边，没有看你，也没有看纸。\n\n" +
        "她在看窗台上那盆植物。叶子还是那几片，没多也没少。\n\n" +
        "「每周一期地活着。」她说。",
      choices: [
        { id: "to-deadline-choice", label: "天快亮了。", next: "deadline-choice" },
      ],
    },
    "pigeon-run": {
      id: "pigeon-run",
      title: "后檐",
      savepoint: false,
      activeActorIds: ["weekly_pigeon"],
      text:
        "报社后檐下蹲着一只灰鸽子，脚环上拴着卷成小筒的本周报纸。\n\n" +
        "它歪头看你，不飞，也不躲。\n\n" +
        "雨已经小了。远处传来印刷机低低的响声。",
      choices: [
        { id: "stroke-pigeon", label: "摸摸它。", next: "pigeon-stroke" },
        { id: "to-deadline-choice", label: "让它先飞。", next: "deadline-choice" },
      ],
    },
    "pigeon-stroke": {
      id: "pigeon-stroke",
      title: "后檐",
      savepoint: false,
      activeActorIds: ["weekly_pigeon"],
      text:
        "鸽子发出一声很敷衍的咕，扑棱一下飞向下一个信箱。\n\n" +
        "檐下掉了半根羽毛，落在你脚边。\n\n" +
        "远处，第一户人家的信箱轻轻响了一声。",
      choices: [
        { id: "to-deadline-choice", label: "回到印刷间。", next: "deadline-choice" },
      ],
    },
    "deadline-choice": {
      id: "deadline-choice",
      title: "天亮之前",
      savepoint: true,
      activeActorIds: ["weekly_editor"],
      guide: { title: "物实之辉周刊", objective: "决定这一夜怎么收尾" },
      text:
        "天快亮了。印刷机慢慢停下来，报纸一摞摞码在墙边，油墨还没干透。\n\n" +
        "热月把最后一捆推给你，自己靠着桌沿坐下。\n\n" +
        "「剩下的路，你想怎么走？」",
      choices: [
        {
          id: "stay-dawn",
          label: "留下来，等第一份报纸出门。",
          next: "ending-dawn",
          effects: [
            {
              type: "event.publish",
              eventType: "story.achievement",
              payload: { id: "weekly_ordinary_week", name: "平凡的一周" },
            },
          ],
        },
        { id: "empty-desk", label: "去里侧看看那张空桌。", next: "empty-desk" },
        { id: "summer-mailbox", label: "去开报社门口的信箱。", next: "summer-mailbox" },
        { id: "special-issue", label: "提议出一期特刊。", next: "special-issue" },
      ],
    },

    /* ───────────────────── 回访：空桌与信箱 ───────────────────── */
    "empty-desk": {
      id: "empty-desk",
      title: "主编的空桌",
      savepoint: false,
      activeActorIds: ["weekly_editor"],
      text:
        "里侧靠窗的桌子收拾得很干净，但没搬空。\n\n" +
        "一支钢笔搁在笔架上，笔帽朝着门的方向，像随时准备被拿起来。\n\n" +
        "桌角压着一本翻旧了的书，摊开的那页有两句用铅笔描过的字：\n\n" +
        "「哀州土之平乐兮，悲江介之遗风」\n\n" +
        "桌上的日历停在今年夏天之前。",
      choices: [
        { id: "read-book", label: "翻开那本书。", next: "desk-book" },
        { id: "leave-note", label: "把一张便签压在笔架下。", next: "ending-desk" },
      ],
    },
    "desk-book": {
      id: "desk-book",
      title: "主编的空桌",
      savepoint: false,
      activeActorIds: ["weekly_editor"],
      text:
        "热月不知什么时候站在你身后。\n\n" +
        "「他自己带走了笔尖，留下笔帽。」\n\n" +
        "她把桌上的稿纸收齐，边角对得很准。\n\n" +
        "「他说，字模留在字盘里，人才能走得远。」\n\n" +
        "你没有再问。窗外的天已经亮了一线。",
      choices: [
        { id: "leave", label: "把书合上，留一张便签。", next: "ending-desk" },
      ],
    },
    "summer-mailbox": {
      id: "summer-mailbox",
      title: "报社信箱",
      savepoint: false,
      activeActorIds: ["weekly_editor"],
      text:
        "信箱里躺着一封信。邮戳是外地的，字迹被雨洇过一点。\n\n" +
        "信不长：\n\n" +
        "「夏天到了，又到了编辑萌发的季节。\n\n" +
        "听说新一期出了。刊号别排错。\n\n" +
        "——待删的笔名，待定的归期」\n\n" +
        "信没有署全名。",
      choices: [
        {
          id: "pin-letter",
          label: "把信钉在荣誉墙第一块铜牌旁边。",
          next: "ending-summer",
          effects: [
            {
              type: "event.publish",
              eventType: "story.achievement",
              payload: { id: "weekly_summer_letter", name: "夏天的信" },
            },
          ],
        },
      ],
    },
    "special-issue": {
      id: "special-issue",
      title: "特刊",
      savepoint: false,
      activeActorIds: ["weekly_editor"],
      text:
        "「特刊？」热月抬起头。\n\n" +
        "「大选、新春、周年——报社以前都出过。」你把想好的由头说完，她一直没打断。\n\n" +
        "壁炉上方刻着一行木字，平时看不太清：\n\n" +
        "「总之，总要让这把火，再烧起来」\n\n" +
        "热月顺着你的目光看过去，过了一会儿才说：「那得先有人点火。」",
      choices: [
        {
          id: "light-fire",
          label: "点亮壁炉，帮她把特刊的稿约发出去。",
          next: "ending-fire",
          effects: [
            {
              type: "event.publish",
              eventType: "story.achievement",
              payload: { id: "weekly_fire_again", name: "总要让这把火，再烧起来" },
            },
          ],
        },
      ],
    },

    /* ───────────────────── 结局 ───────────────────── */
    "ending-dawn": {
      id: "ending-dawn",
      title: "物实之辉周刊",
      role: "结局 · 出街",
      presentation: "blackout",
      terminal: true,
      guide: null,
      text:
        "周一清晨，第一份报纸出了门。\n\n" +
        "送报鸽落在巷口的信箱上，脚环上的小筒已经空了。各家门口的报纸还带着一点潮气，头版标题被晨光照得发亮。\n\n" +
        "热月站在报亭里，把新一期样张钉上窗口。\n\n" +
        "「平凡的一周。」她说。\n\n" +
        "然后她顿了顿，像每周一样补上最后一句：\n\n" +
        "「祝小城欣欣向荣。」",
    },
    "ending-desk": {
      id: "ending-desk",
      title: "物实之辉周刊",
      role: "结局 · 回访",
      presentation: "blackout",
      terminal: true,
      guide: null,
      text:
        "便签压在笔架下，只写了一行：\n\n" +
        "「报纸出到大后天，别忘取。」\n\n" +
        "你走出门时回头看了一眼。桌上的钢笔反着一点晨光，笔帽仍旧朝着门的方向。\n\n" +
        "外面，第一份报纸正被塞进信箱。",
    },
    "ending-summer": {
      id: "ending-summer",
      title: "物实之辉周刊",
      role: "结局 · 夏日回信",
      presentation: "blackout",
      terminal: true,
      guide: null,
      text:
        "热月把信钉在第一块铜牌旁边，钉得很轻，像怕钉疼了什么。\n\n" +
        "「钉一夏天。」她说。\n\n" +
        "窗外蝉声很响。印刷间里，下一期的白纸已经码好了。\n\n" +
        "她没有说那人会不会回来。她只是把信纸的边角抚平，又回去排下一期的版。",
    },
    "ending-fire": {
      id: "ending-fire",
      title: "物实之辉周刊",
      role: "结局 · 特刊",
      presentation: "blackout",
      terminal: true,
      guide: null,
      text:
        "壁炉亮起来的时候，整间编辑部都暖了一层。\n\n" +
        "稿约一封封写出去，送到实验区、老巷、茶馆和每一张还亮着灯的桌子。第二天，回信开始往报社里涌。\n\n" +
        "热月把特刊的报头排好，抬头看了你一眼。\n\n" +
        "「这期不写平凡的一周。」\n\n" +
        "她把最后一枚铅字压进版槽。\n\n" +
        "「这期写火是怎么烧起来的。」",
    },
  },
};
