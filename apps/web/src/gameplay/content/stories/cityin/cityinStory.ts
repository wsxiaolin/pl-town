import type { StoryDefinition } from "../../../stories/types";

/**
 * 支线剧情：《物实里的城》
 *
 * 老城知识带最深处，图书馆背后的巷子里有一口枯井。
 * 井底是 2023 年那座用文字与链接搭起来的旧城遗址。
 * 玩家在旧城广场、两个半城的门牌之间穿行，翻阅公告板上的访客簿，
 * 最后在居民证石碑前签下第 13 个名字。
 *
 * 节点命名规范：cityin.<act>.<beat>
 * 旗标命名规范：cityin.<subject>.<key>
 * NPC：规划者 cityin_planner、空旷的声音 cityin_voice。
 */

export const CITYIN_STORY: StoryDefinition = {
  schemaVersion: 1,
  definitionVersion: 1,
  id: "side.cityin.town",
  title: "物实里的城",
  startNode: "cityin.well",
  entryActorId: "cityin_planner",

  interactions: [
    { actorId: "cityin_planner", nodeId: "cityin.well", choiceId: "look-down" },
  ],

  buildingInteractions: [
    { buildingId: "cityin_well", nodeId: "cityin.well", choiceId: "look-down" },
  ],

  nodes: {
    /* ───────────────────── 第一幕：井口 ───────────────────── */
    "cityin.well": {
      id: "cityin.well",
      title: "枯井",
      role: "序章",
      savepoint: true,
      guide: { title: "物实里的城", objective: "在图书馆背后的巷子里看看那口井" },
      activeActorIds: ["cityin_planner"],
      text:
        "图书馆背后的巷子到了尽头。一口石井爬满藤蔓，井沿的字迹几乎被磨平。\n\n井边站着一个拿图纸的人，正用铅笔在纸上比划。听见脚步声，他抬起头。\n\n「你要找的旧城就在下面。地面这座城开建时，图纸参考的就是它。想下去看看吗？」",
      choices: [
        {
          id: "look-down",
          label: "探头看井。",
          next: "cityin.fall",
          set: { "cityin.signed": false, "cityin.rim.read": false, "cityin.board.page4": false, "cityin.board.page6": false, "cityin.door.dead": false },
        },
        { id: "read-rim", label: "先读井沿的刻字。", next: "cityin.rim" },
        { id: "ask-plan", label: "问图纸上的城怎么建。", next: "cityin.plan-talk" },
        { id: "leave-town", label: "今天不看了。", next: "cityin.ending-leave" },
        {
          id: "revisit-old-town",
          label: "再下井看一眼。",
          next: "cityin.revisit",
          availableWhen: [{ type: "flag.equals", flagId: "cityin.signed", value: true }],
        },
      ],
    },
    "cityin.rim": {
      id: "cityin.rim",
      title: "井沿",
      savepoint: false,
      activeActorIds: ["cityin_planner"],
      text:
        "你蹲下去，用手指顺着刻痕摸了一遍。\n\n「你对着空气说：我怎么能离开这里？——『抱歉，我们属于这里，无法帮你离开』」\n\n这句对白写在这里的时候，这座城还没有名字。",
      choices: [
        { id: "rim-look", label: "探头看井。", next: "cityin.fall" },
        { id: "rim-back", label: "站起来。", next: "cityin.well" },
      ],
    },
    "cityin.plan-talk": {
      id: "cityin.plan-talk",
      title: "规划者",
      savepoint: false,
      activeActorIds: ["cityin_planner"],
      text:
        "他把图纸转过来给你看。线条很密，边角写满小字。「地面那座城，是照着这张图纸一点点拼起来的。居民、建筑，都来自大家的投稿。\n\n「我抽了 200 位居民，文案是机器写的。这事做得急，可城总得先立起来，才有人愿意往里走。\n\n「你脚下这座旧城，就是最早的投稿——一个人，一块砖，砌了一年多。」",
      choices: [
        { id: "plan-down", label: "探头看井。", next: "cityin.fall" },
        { id: "plan-back", label: "把图纸还给他。", next: "cityin.well" },
      ],
    },
    "cityin.fall": {
      id: "cityin.fall",
      title: "坠落",
      role: "序章 · 坠落",
      savepoint: false,
      presentation: "blackout",
      activeActorIds: ["cityin_planner"],
      text:
        "坠落……坠落……\n\n没有撞到地面。\n\n你睁开眼睛。",
      choices: [
        {
          id: "land",
          label: "继续",
          next: "cityin.arrival",
          autoAdvance: true,
          effects: [{ type: "event.publish", eventType: "story.achievement", payload: { id: "cityin_fall", name: "坠落…坠落…" } }],
        },
      ],
    },
    "cityin.arrival": {
      id: "cityin.arrival",
      title: "旧城广场",
      role: "第一幕 · 坠落",
      savepoint: true,
      guide: { title: "物实里的城", objective: "听那个空旷的声音说完话" },
      activeActorIds: ["cityin_voice"],
      text:
        "你站在一片褪色的广场上。四周的立面很浅，像纸片立起来，又被雨水洗过。\n\n一个空旷的声音从街道尽头传来。\n\n「你好，欢迎来到物实。」\n\n（一行停顿）\n\n「……抱歉，这句话我等了三年，说顺口了。现在是 2026 年——欢迎来到物实的下面。」\n\n广场中央立着一块牌子，上面写着四个字：竖着耳朵。",
      choices: [
        { id: "approach", label: "走过去。", next: "cityin.square" },
      ],
    },

    /* ───────────────────── 第二幕：旧城广场 ───────────────────── */
    "cityin.square": {
      id: "cityin.square",
      title: "竖着耳朵",
      role: "第二幕 · 广场",
      savepoint: true,
      guide: { title: "物实里的城", objective: "在旧城里走走，听听这里还剩什么" },
      activeActorIds: ["cityin_voice"],
      text:
        "那声音没有形状，像从每一块门牌后面同时渗出来。\n\n「问吧。这城里剩下的字不多了，够你问一会儿。」",
      choices: [
        { id: "ask-who", label: "「你是谁？」", next: "cityin.voice-who" },
        { id: "ask-relation", label: "「这里和小城是什么关系？」", next: "cityin.voice-relation" },
        { id: "ask-task", label: "「我能做点什么？」", next: "cityin.voice-task" },
        { id: "ask-tour", label: "「带我看看这座城。」", next: "cityin.voice-tour" },
        { id: "go-board", label: "去看广场角落的公告板。", next: "cityin.board" },
        { id: "go-screen", label: "去街道尽头看那块大屏幕。", next: "cityin.screen" },
        { id: "go-certificate", label: "走到居民证石碑前。", next: "cityin.certificate" },
        { id: "climb-out", label: "先爬回地面。", next: "cityin.ending-restless" },
      ],
    },

    /* ── A.「你是谁？」 ─────────────────────────────────────────── */
    "cityin.voice-who": {
      id: "cityin.voice-who",
      title: "空旷的声音",
      savepoint: false,
      activeActorIds: ["cityin_voice"],
      text:
        "「我是这座城剩下的部分。门是链接，墙是帖子，我是它们中间那点空隙——你走在街上听见的那个回声。」",
      choices: [
        { id: "who-lonely", label: "「听起来有点孤单。」", next: "cityin.voice-who-lonely" },
        { id: "who-left", label: "「是谁把你留下来的？」", next: "cityin.voice-who-left" },
        { id: "who-back", label: "（结束）", next: "cityin.square" },
      ],
    },
    "cityin.voice-who-lonely": {
      id: "cityin.voice-who-lonely",
      title: "空旷的声音",
      savepoint: false,
      activeActorIds: ["cityin_voice"],
      text:
        "「还好。每过几个月，就有人掉下来一次。他们管这个叫『考古』，我管这个叫串门。」",
      choices: [
        { id: "lonely-more", label: "「还有别的事想问。」", next: "cityin.voice-who" },
        { id: "lonely-back", label: "（结束）", next: "cityin.square" },
      ],
    },
    "cityin.voice-who-left": {
      id: "cityin.voice-who-left",
      title: "空旷的声音",
      savepoint: false,
      activeActorIds: ["cityin_voice"],
      text:
        "「一个盖房子的人。他在这儿砌了一年多砖，然后有一天上午去写别的连载，下午回来把城里最后一块砖补好，就再没动过。\n\n「城是他放下的。放下的东西不会凉——你回家看看你妈给你留的饭就懂了。」",
      choices: [
        { id: "left-who", label: "「那他是谁？」", next: "cityin.voice-relation" },
        { id: "left-back", label: "（结束）", next: "cityin.square" },
      ],
    },

    /* ── B.「这里和小城是什么关系？」 ───────────────────────────── */
    "cityin.voice-relation": {
      id: "cityin.voice-relation",
      title: "空旷的声音",
      savepoint: false,
      activeActorIds: ["cityin_voice"],
      text:
        "「小城是这儿的转世。上面那座城开建的时候，从这座城的居民档案里随机抽了 200 个人，让机器替他们重新学会了说话。\n\n「所以你在上面街上碰到的某些人——别问是谁——三年前就住在这儿。他们自己都不知道。」",
      choices: [
        { id: "rel-residents", label: "「那原来住在这儿的人呢？」", next: "cityin.relation-residents" },
        { id: "rel-creator", label: "「创世的人再也找不到了吗？」", next: "cityin.relation-creator" },
        { id: "rel-back", label: "（结束）", next: "cityin.square" },
      ],
    },
    "cityin.relation-residents": {
      id: "cityin.relation-residents",
      title: "空旷的声音",
      savepoint: false,
      activeActorIds: ["cityin_voice"],
      text:
        "「搬家的搬家，改名的改名。你看那块公告板，走的人都往上头留了字——那是这城唯一还在自动翻页的东西。」",
      choices: [
        { id: "res-board", label: "去看看公告板。", next: "cityin.board" },
        { id: "res-back", label: "（结束）", next: "cityin.voice-relation" },
      ],
    },
    "cityin.relation-creator": {
      id: "cityin.relation-creator",
      title: "空旷的声音",
      savepoint: false,
      activeActorIds: ["cityin_voice"],
      text:
        "「找得到。他就没走过。三年半，三千二百多条评论，你当那些都是谁写的？\n\n「他只是换了个名字，名字换得比换季还勤。上面那座小城满城找他，贴了寻人启事——可惜寻人启事上用的还是他的旧名字。\n\n「城认得他，认人不认名字。」",
      choices: [
        {
          id: "creator-look",
          label: "「那我不去找他吗？」",
          next: "cityin.relation-creator-look",
          availableWhen: [{ type: "flag.equals", flagId: "cityin.board.page6", value: true }],
        },
        { id: "creator-back", label: "（结束）", next: "cityin.voice-relation" },
      ],
    },
    "cityin.relation-creator-look": {
      id: "cityin.relation-creator-look",
      title: "空旷的声音",
      savepoint: false,
      activeActorIds: ["cityin_voice"],
      text:
        "「去吧。不过等你真在街上碰见一个眼熟的名字，别叫破他。\n\n「人家 2024 年中考都没考好，你就当没看见，这叫礼貌。」",
      choices: [
        {
          id: "promise-quiet",
          label: "「我记住了。」",
          next: "cityin.square",
          set: { "cityin.creator.hint": true },
          effects: [{ type: "event.publish", eventType: "story.achievement", payload: { id: "cityin_dont_call_him", name: "别叫破他" } }],
        },
      ],
    },

    /* ── C.「我能做点什么？」 ───────────────────────────────────── */
    "cityin.voice-task": {
      id: "cityin.voice-task",
      title: "空旷的声音",
      savepoint: false,
      activeActorIds: ["cityin_voice"],
      text:
        "「能。街尽头那块大屏幕，五条规则播了三年，你把第 5 条做一遍。」",
      choices: [
        { id: "task-rule5", label: "「第 5 条是什么来着？」", next: "cityin.voice-rule5" },
        { id: "task-back", label: "「我还有别的事想问。」", next: "cityin.square" },
      ],
    },
    "cityin.voice-rule5": {
      id: "cityin.voice-rule5",
      title: "空旷的声音",
      savepoint: false,
      activeActorIds: ["cityin_voice"],
      text:
        "「把屏幕拆下来，揣兜里。放心拆——它不会消失的，下一个来的人照样看得到。\n\n「这台屏幕的工作原理，就是这座城传下去的方式。」",
      choices: [
        { id: "rule5-screen", label: "去大屏幕。", next: "cityin.screen" },
        { id: "rule5-back", label: "（结束）", next: "cityin.square" },
      ],
    },

    /* ── D.「带我看看这座城。」 ─────────────────────────────────── */
    "cityin.voice-tour": {
      id: "cityin.voice-tour",
      title: "空旷的声音",
      savepoint: false,
      activeActorIds: ["cityin_voice"],
      text:
        "「两个半城，自己挑。技术半城的门牌亮得多，规矩也多；黑洞半城什么都收着，连被封禁的人都收。\n\n「当年两边的管理人员互相把串门的居民『请回去』，一天能走八趟。」",
      choices: [
        { id: "tour-tech", label: "「去技术半城。」", next: "cityin.tech" },
        { id: "tour-black", label: "「去黑洞半城。」", next: "cityin.black" },
        { id: "tour-back", label: "「先不去。」", next: "cityin.square" },
      ],
    },

    /* ───────────────────── 技术半城 · 图书馆街区 ───────────────── */
    "cityin.tech": {
      id: "cityin.tech",
      title: "图书馆街区",
      role: "第二幕 · 技术半城",
      savepoint: true,
      guide: { title: "物实里的城", objective: "读一读技术半城的门牌" },
      activeActorIds: ["cityin_voice"],
      text:
        "街道两侧立着一块块石碑。每块碑上刻着一个名字和一行描写，像门牌，也像墓志。\n\n多数碑面是冷色的，只有少数还泛着微光。",
      choices: [
        { id: "tech-experiment", label: "《实验记录》", next: "cityin.stele-experiment" },
        { id: "tech-encyclopedia", label: "物实百科全书2023.2.6版", next: "cityin.stele-encyclopedia" },
        { id: "tech-novels", label: "小说合集部分", next: "cityin.stele-novels" },
        { id: "tech-audit", label: "文学审核部", next: "cityin.stele-audit" },
        { id: "tech-academy", label: "物实学院", next: "cityin.stele-academy" },
        { id: "tech-black", label: "穿过街心，去黑洞半城。", next: "cityin.black" },
        { id: "tech-back", label: "回广场。", next: "cityin.square" },
      ],
    },
    "cityin.stele-experiment": {
      id: "cityin.stele-experiment",
      title: "《实验记录》",
      savepoint: false,
      activeActorIds: ["cityin_voice"],
      text:
        "碑文：「技术半城的人们，绞尽脑汁为大家做出了一些优质作品。」\n\n碑面是亮的。门后浮起一段实验合的目录，字迹虚虚的，像隔着水看。",
      choices: [
        { id: "experiment-back", label: "离开。", next: "cityin.tech" },
      ],
    },
    "cityin.stele-encyclopedia": {
      id: "cityin.stele-encyclopedia",
      title: "物实百科全书2023.2.6版",
      savepoint: false,
      activeActorIds: ["cityin_voice"],
      text:
        "碑文：「这个城的历史和文化……」\n\n你伸手推了推。碑后没有光。\n\n碑脚刻着一行后来者的字：「百科全書進不去了似乎 ——s106183」",
      choices: [
        {
          id: "encyclopedia-read",
          label: "读碑。",
          next: "cityin.tech",
          set: { "cityin.door.dead": true },
          effects: [{ type: "event.publish", eventType: "story.achievement", payload: { id: "cityin_dead_door", name: "有些门已经死了" } }],
        },
        { id: "encyclopedia-back", label: "离开。", next: "cityin.tech" },
      ],
    },
    "cityin.stele-novels": {
      id: "cityin.stele-novels",
      title: "小说合集部分",
      savepoint: false,
      activeActorIds: ["cityin_voice"],
      text:
        "碑文：「文学可以带给你乐趣。」「招募图书管理员、收集员，欢迎大家／待收集:杂文 未完整:小说」\n\n门后透出半亮的光，照出两行清单。\n\n碑角有一行更小的字：「待收集，永远待收集。」",
      choices: [
        { id: "novels-back", label: "离开。", next: "cityin.tech" },
      ],
    },
    "cityin.stele-audit": {
      id: "cityin.stele-audit",
      title: "文学审核部",
      savepoint: false,
      activeActorIds: ["cityin_voice"],
      text:
        "碑文：「一栋古里古气的大房子，似乎很久没人住过了。门前脚印十分杂乱，管理者似乎匆匆忙忙地离开的。『己废弃』」\n\n这是全城最重的一块碑。碑上没有一条留言。\n\n空旷的声音从很远的地方补了一句：「这儿曾经是全城权力最大的地方——所有书进图书馆之前都要过他们的手。你看，最有权审核别人的门，是最先没人管的门。」",
      choices: [
        {
          id: "audit-read",
          label: "读碑。",
          next: "cityin.tech",
          set: { "cityin.door.dead": true },
          effects: [{ type: "event.publish", eventType: "story.achievement", payload: { id: "cityin_dead_door", name: "有些门已经死了" } }],
        },
        { id: "audit-back", label: "离开。", next: "cityin.tech" },
      ],
    },
    "cityin.stele-academy": {
      id: "cityin.stele-academy",
      title: "物实学院",
      savepoint: false,
      activeActorIds: ["cityin_voice"],
      text:
        "碑文：「这貌似是一个学校，现代化的大楼……面前出现了一个五角星，这里可以收藏吗？拿着这些课，以后或许有用。」\n\n门后亮起一颗五角星，慢慢被点亮，像有人刚刚收藏了一门课。\n\n最后一行浮出来：「文化一条街，从这儿一直修到了地面上。」",
      choices: [
        { id: "academy-back", label: "离开。", next: "cityin.tech" },
      ],
    },

    /* ───────────────────── 黑洞半城 · 杂市街区 ─────────────────── */
    "cityin.black": {
      id: "cityin.black",
      title: "杂市街区",
      role: "第二幕 · 黑洞半城",
      savepoint: true,
      guide: { title: "物实里的城", objective: "读一读黑洞半城的门牌" },
      activeActorIds: ["cityin_voice"],
      text:
        "街心的那块地砖颜色更暗。再往前，门牌挨得更挤，空气里有旧纸和铁锈的味道。\n\n「正如名字所说的，这里包容一切。」那声音说。",
      choices: [
        { id: "black-knowledge", label: "《这都是知识》", next: "cityin.stele-knowledge" },
        { id: "black-catcafe", label: "物实猫咖馆", next: "cityin.stele-catcafe" },
        { id: "black-newspaper", label: "星尘报社总部", next: "cityin.stele-newspaper" },
        { id: "black-mutual", label: "互助团", next: "cityin.stele-mutual" },
        { id: "black-law", label: "这个城的法则", next: "cityin.stele-law" },
        { id: "black-elevator", label: "街尾的电梯残骸", next: "cityin.stele-elevator" },
        { id: "black-lost", label: "最深处那块没有碑文的门牌", next: "cityin.stele-lost" },
        { id: "black-back", label: "回广场。", next: "cityin.square" },
      ],
    },
    "cityin.stele-knowledge": {
      id: "cityin.stele-knowledge",
      title: "《这都是知识》",
      savepoint: false,
      activeActorIds: ["cityin_voice"],
      text:
        "碑文：「黑洞半城的人们也不落后，有些大佬就是出现在这个半城。」\n\n碑面亮着，门后浮出一排书脊，看不清书名。",
      choices: [
        { id: "knowledge-back", label: "离开。", next: "cityin.black" },
      ],
    },
    "cityin.stele-catcafe": {
      id: "cityin.stele-catcafe",
      title: "物实猫咖馆",
      savepoint: false,
      activeActorIds: ["cityin_voice"],
      text:
        "碑文：「闲暇时光来撸猫也不错／趁着三月的暖阳，和着微风听听风铃吧／不过，这可是高达 15000 多层的楼哦／还有，小心军火！」\n\n碑下钉着一块小木牌：「此门通往地面——猫咖馆在你头顶上盖了 15000 层，你脚下这层是第 1 层。」",
      choices: [
        { id: "catcafe-back", label: "离开。", next: "cityin.black" },
      ],
    },
    "cityin.stele-newspaper": {
      id: "cityin.stele-newspaper",
      title: "星尘报社总部",
      savepoint: false,
      activeActorIds: ["cityin_voice"],
      text:
        "碑文：「拿着这份报纸吧！」你看了看手中的报纸，问他们是哪个报社的，可是那个人消失了。「隶属于 SNO.星尘报社总部」\n\n门后浮出一张泛黄的报纸，报头是 SNO 星尘。\n\n报纸背面印着一行小字：「本报社后来改组，见地面星辉报社——本报记者仍在截稿逃跑中。」",
      choices: [
        { id: "newspaper-back", label: "离开。", next: "cityin.black" },
      ],
    },
    "cityin.stele-mutual": {
      id: "cityin.stele-mutual",
      title: "互助团",
      savepoint: false,
      activeActorIds: ["cityin_voice"],
      text:
        "碑文：「互助团成立了！你有什么需要吗？快来这里投稿吧，我们会尽所可能的帮助你！」\n\n门后只留着一句话：「我们属于这里，无法帮你离开。」\n\n和井沿上刻的是同一句。",
      choices: [
        {
          id: "mutual-back",
          label: "离开。",
          next: "cityin.black",
          set: { "cityin.mutual.read": true },
        },
      ],
    },
    "cityin.stele-law": {
      id: "cityin.stele-law",
      title: "这个城的法则",
      savepoint: false,
      activeActorIds: ["cityin_voice"],
      text:
        "碑文：「你违反的每一条法则，都会化作你不甘的泪水。」\n\n门后浮出三条法则的全文，字迹句句分明，就是潦草了些。\n\n末尾的签名，和地面上那条管理条例是同一笔迹。",
      choices: [
        { id: "law-back", label: "离开。", next: "cityin.black" },
      ],
    },
    "cityin.stele-elevator": {
      id: "cityin.stele-elevator",
      title: "电梯残骸",
      savepoint: false,
      activeActorIds: ["cityin_voice"],
      text:
        "一台没有门的电梯，楼层按钮只剩下一个还认得出符号：-①。\n\n按钮下面刻着一句：「我们会尽快修复其他按钮。」\n\n至于 -① 通到哪里，碑上没有写。",
      choices: [
        { id: "elevator-back", label: "离开。", next: "cityin.black" },
      ],
    },
    "cityin.stele-lost": {
      id: "cityin.stele-lost",
      title: "《迷失者》",
      savepoint: false,
      activeActorIds: ["cityin_voice"],
      text:
        "整座旧城最深处，一块没有碑文的门牌，上面只有三个字：《迷失者》。\n\n门是锁着的。\n\n那个声音第一次放轻了：「这是城最后一扇门。他没写门后是什么——不是没写完，是留给你。」",
      choices: [
        { id: "lost-back", label: "读门牌，然后离开。", next: "cityin.black" },
      ],
    },

    /* ───────────────────── 公告板 · 访客簿 ─────────────────────── */
    "cityin.board": {
      id: "cityin.board",
      title: "公告板",
      role: "第二幕 · 访客簿",
      savepoint: true,
      guide: { title: "物实里的城", objective: "翻阅公告板上的访客簿" },
      activeActorIds: ["cityin_voice"],
      text:
        "一块普通的大木板，用铁镶了框，还安了雨棚。很明显，这里最近有人来修过。\n\n板上贴满泛黄的纸条，钉成厚厚一叠，像一本没有封面的册子。",
      choices: [
        { id: "board-p1", label: "翻到第 1 页（2023）", next: "cityin.board-page1" },
        { id: "board-p2", label: "翻到第 2 页（2024）", next: "cityin.board-page2" },
        { id: "board-p3", label: "翻到第 3 页（2025）", next: "cityin.board-page3" },
        { id: "board-p4", label: "翻到第 4 页（2026 夏）", next: "cityin.board-page4" },
        { id: "board-p5", label: "翻到第 5 页（2026 秋）", next: "cityin.board-page5" },
        { id: "board-p6", label: "翻到最后一页", next: "cityin.board-page6" },
        { id: "board-back", label: "合上访客簿。", next: "cityin.square" },
      ],
    },
    "cityin.board-page1": {
      id: "cityin.board-page1",
      title: "访客簿 · 第 1 页",
      savepoint: false,
      activeActorIds: ["cityin_voice"],
      text:
        "纸条已经脆了，边角一碰就掉屑。\n\n「进藤光？」\n\n落款年号只剩一个 3。",
      choices: [
        { id: "p1-next", label: "翻到下一页。", next: "cityin.board-page2" },
        { id: "p1-back", label: "合上访客簿。", next: "cityin.board" },
      ],
    },
    "cityin.board-page2": {
      id: "cityin.board-page2",
      title: "访客簿 · 第 2 页",
      savepoint: false,
      activeActorIds: ["cityin_voice"],
      text:
        "这一页贴着一张剪报、一张字条和半页手写。\n\n《物实图鉴集 v0.2.5》的剪报。\n\n一张字条，上面是一串已经点不开的网页链接，署名「沃尔夫冈」。\n\n还有一行：「我有《注梦》。」",
      choices: [
        { id: "p2-next", label: "翻到下一页。", next: "cityin.board-page3" },
        { id: "p2-back", label: "合上访客簿。", next: "cityin.board" },
      ],
    },
    "cityin.board-page3": {
      id: "cityin.board-page3",
      title: "访客簿 · 第 3 页",
      savepoint: false,
      activeActorIds: ["cityin_voice"],
      text:
        "「我加入 50 里的城。」\n\n「考古。」\n\n字迹都很轻，像怕把纸压坏。",
      choices: [
        { id: "p3-next", label: "翻到下一页。", next: "cityin.board-page4" },
        { id: "p3-back", label: "合上访客簿。", next: "cityin.board" },
      ],
    },
    "cityin.board-page4": {
      id: "cityin.board-page4",
      title: "访客簿 · 第 4 页",
      savepoint: false,
      activeActorIds: ["cityin_voice"],
      text:
        "「百科全書進不去了似乎」\n\n八月十日晚：「考古」。八月十五日：「打卡」。\n\n八月十九日，一行用大写数字写下的日期：「现在是二零二六年八月十九日」。",
      choices: [
        {
          id: "p4-next",
          label: "翻到下一页。",
          next: "cityin.board-page5",
          set: { "cityin.board.page4": true },
          effects: [{ type: "event.publish", eventType: "story.achievement", payload: { id: "cityin_archaeology", name: "考古" } }],
        },
        { id: "p4-back", label: "合上访客簿。", next: "cityin.board" },
      ],
    },
    "cityin.board-page5": {
      id: "cityin.board-page5",
      title: "访客簿 · 第 5 页",
      savepoint: false,
      activeActorIds: ["cityin_voice"],
      text:
        "只有一张纸条，边角还新。\n\n「你说我是吧？」\n\n再往后，纸的颜色忽然变白了。",
      choices: [
        { id: "p5-next", label: "翻到最后一页。", next: "cityin.board-page6" },
        { id: "p5-back", label: "合上访客簿。", next: "cityin.board" },
      ],
    },
    "cityin.board-page6": {
      id: "cityin.board-page6",
      title: "访客簿 · 最后一页",
      savepoint: false,
      activeActorIds: ["cityin_voice"],
      text:
        "最后一页是一张白底的新纸，墨迹未干。字迹一笔一画，很工整。\n\n「没什么事，就是我没什么事哈。\n——留言时间：2025 年 6 月 3 日，转抄于地面。」\n\n那个声音在背后响起：「看见没。访客簿最近这页，比你的鞋还新。城里没人了，可这本子一直在自动翻页——有人来，有人留字，有人替不在场的人捎话。\n\n「上头那座新城管这个叫『社区』，我们这老城，管这叫还有人记得。」",
      choices: [
        {
          id: "p6-back",
          label: "合上访客簿。",
          next: "cityin.board",
          set: { "cityin.board.page6": true },
          effects: [{ type: "event.publish", eventType: "story.achievement", payload: { id: "cityin_time_capsule", name: "现在是二零二六年八月十九日" } }],
        },
      ],
    },

    /* ───────────────────── 大屏幕与居民证 ─────────────────────── */
    "cityin.screen": {
      id: "cityin.screen",
      title: "大屏幕",
      role: "第三幕 · 法则",
      savepoint: true,
      guide: { title: "物实里的城", objective: "读完大屏幕上的五条规则" },
      activeActorIds: ["cityin_voice"],
      text:
        "街道尽头，一块大屏幕还闪着荧荧的光。五条规则一条接一条地播：\n\n1. 一定要尊敬管理员们，尤其是紫兰斋\n2. 不要理会那些骂人、刷屏的居民。\n3. 如果你是管理人员，记住，你的责任就是「移水」和「处理事件」\n4. 尽量发布一些有意义的作品，否则你会失去一些货币。\n5. 请一定把这个大屏幕拆下来拿下来揣在兜里，不要担心它会消失，下一个来这里的人同样也会看到它。",
      choices: [
        {
          id: "take-screen",
          label: "把屏幕拆下来，揣进兜里。",
          next: "cityin.certificate",
          set: { "cityin.screen.taken": true },
        },
        { id: "screen-back", label: "先不拆。", next: "cityin.square" },
      ],
    },
    "cityin.certificate": {
      id: "cityin.certificate",
      title: "居民证石碑",
      role: "第三幕 · 签名",
      savepoint: true,
      guide: { title: "物实里的城", objective: "决定要不要在居民证上签名" },
      activeActorIds: ["cityin_voice"],
      text:
        "大屏幕下方立着一块石碑，碑面刻着居民证的全文。下面竖排着十二个名字，刻痕深浅不一。\n\n「请撕下这张纸作为你的居民证\n——————————\n我会遵守这个城的法则，我已阅读。\n——————————\n如你遇到 Bug 类困难，请联系 turtlesim\n你要参与这个故事的话，就请签上你的名字」",
      choices: [
        { id: "sign-name", label: "签下你的名字。", next: "cityin.sign-confirm" },
        { id: "certificate-back", label: "再走一走。", next: "cityin.square" },
      ],
    },
    "cityin.sign-confirm": {
      id: "cityin.sign-confirm",
      title: "居民证石碑",
      savepoint: false,
      activeActorIds: ["cityin_voice"],
      text:
        "碑面留着一行空位，是第十三个。\n\n「请撕下这张纸作为你的居民证——我会遵守这个城的法则，我已阅读。」\n\n那个声音在等。",
      choices: [
        {
          id: "confirm-sign",
          label: "〔签〕",
          next: "cityin.ending-sign",
          set: { "cityin.signed": true },
          effects: [{ type: "event.publish", eventType: "story.achievement", payload: { id: "cityin_thirteenth", name: "第 13 位居民" } }],
        },
        { id: "reconsider", label: "〔再想想〕", next: "cityin.certificate" },
      ],
    },

    /* ───────────────────── 结局与回访 ─────────────────────────── */
    "cityin.ending-sign": {
      id: "cityin.ending-sign",
      title: "物实里的城",
      role: "结局 · 第 13 位",
      savepoint: true,
      presentation: "blackout",
      terminal: true,
      guide: null,
      activeActorIds: ["cityin_voice"],
      text:
        "笔迹落在第十三个空位上。\n\n大屏幕忽然亮了一格，多出从未播过的第 6 条规则：\n\n6. 城不会消失。它只是换了批居民。\n\n「恭喜，第 13 位。前 12 位签的时候，这儿还是座新城——他们后来有的成了管理人员，有的成了作家，有一个还成了你头顶上那 200 个人里的一员。现在轮到你了。\n\n「屏幕你随便拆，揣兜里——第 5 条说的，它不会消失，下一个来的人同样也会看到它。这句我替他多说一遍，因为这是他留下的规则里，我最喜欢的一条。\n\n「井在原来的位置。慢走。替我往地上捎一句：小城挺好，就是别再叫 AI 写台词了——我听三年了，味儿都熟。」\n\n你沿井壁的藤蔓爬回地面。回头望去，井底深处还有一点屏幕的微光。",
    },
    "cityin.ending-leave": {
      id: "cityin.ending-leave",
      title: "巷子尽头",
      role: "结局 · 改日",
      savepoint: false,
      presentation: "blackout",
      terminal: true,
      guide: null,
      activeActorIds: ["cityin_planner"],
      text:
        "你退回巷子里。\n\n拿图纸的人没有拦你，只把铅笔夹回耳朵上。\n\n「行。井又不会跑。」\n\n藤蔓垂在井沿，一动不动。",
    },
    "cityin.ending-restless": {
      id: "cityin.ending-restless",
      title: "井壁",
      role: "结局 · 提前离开",
      savepoint: false,
      presentation: "blackout",
      terminal: true,
      guide: null,
      activeActorIds: ["cityin_voice"],
      text:
        "你顺着藤蔓往上爬。\n\n爬到一半，那个声音从下面追上来，不紧不慢：\n\n「居民证还空着一行。下次来，字可能就淡了。」\n\n你翻出井口。巷子里的光很白，图纸上的线条一条也看不清。",
    },
    "cityin.revisit": {
      id: "cityin.revisit",
      title: "旧城 · 回访",
      role: "回访 · 井下",
      savepoint: true,
      presentation: "blackout",
      terminal: true,
      guide: null,
      activeActorIds: ["cityin_voice"],
      text:
        "你又顺着藤蔓下到井底。\n\n广场比记忆里更浅了。那块大屏幕还亮着，第 6 条规则已经并进了循环，和前面五条一样，慢吞吞地滚过去。\n\n「回来了。」那个声音说，像早就留好了门。\n\n公告板上多了一张新纸条，墨迹很新：「又有人下来过。」\n\n你在居民证石碑前站了一会儿。第十三个名字还在，刻痕比上次深了一点。\n\n爬回地面时，巷子口的灯正亮着。",
    },
  },

  sourceText:
    "改编自讨论区作品《物 实 里 的 城》。\n原作以第二人称写一场坠落，把社区里真实存在的帖子做成门牌，读者可以从开场一路走到结尾，并在居民证上签下自己的名字。\n本支线把旧城搬到老城知识带地下的枯井里，玩家在两个半城的门牌之间穿行，翻阅公告板上的访客簿，最后成为第 13 位签署居民证的访客。",
};
