import type { StoryDefinition } from "../../../stories/types";

/**
 * 支线剧情：《问路处》
 *
 * 教育街区环岛上的两间问路亭。老亭用敬语，新亭直呼来访者的名字。
 * 玩家在亭子里学会回复与蓝字传送，对照两版地图，读落款栏，
 * 最后发现：地图停更了，名字搬走了，门一扇都没有锁。
 *
 * 节点命名规范：askway.<act>.<beat>
 * 旗标命名规范：askway.<subject>.<key>
 */
export const ASKWAY_STORY: StoryDefinition = {
  schemaVersion: 1,
  definitionVersion: 1,
  id: "side.askway.corner",
  title: "问路处",
  startNode: "askway.arrival",
  entryActorId: "askway_keeper",

  interactions: [
    { actorId: "askway_keeper", nodeId: "askway.arrival", choiceId: "approach" },
  ],

  buildingInteractions: [
    { buildingId: "north_night_kiosk", nodeId: "askway.arrival", choiceId: "approach" },
  ],

  nodes: {
    /* ───────────────────── 序章：环岛与两间亭子 ───────────────────── */

    "askway.arrival": {
      id: "askway.arrival", title: "环岛", role: "序章 · 两间亭子", savepoint: true,
      guide: { title: "问路处", objective: "在环岛找到问路的老亭" },
      activeActorIds: ["askway_keeper"],
      text:
        "教育街区的环岛中央有一道喷泉。五条路从这里散开：城门方向、老城区巷口、学堂街、政府街、档案馆路。\n\n" +
        "环岛两边并排站着两间亭子。左边是木结构的老亭，玻璃地图柜擦得很亮；右边是金属与玻璃的新亭，接缝紧贴着老亭的侧壁。\n\n" +
        "两间亭子里各挂着一支墨水钟。都停着。",
      choices: [
        { id: "approach", label: "请问，这里是问路处吗？", next: "askway.two_kiosks", set: { "askway.visited.arrival": true } },
        { id: "look-around", label: "先绕着两间亭子看一圈。", next: "askway.two_kiosks", set: { "askway.visited.arrival": true } },
      ],
    },

    "askway.two_kiosks": {
      id: "askway.two_kiosks", title: "两间亭子", role: "序章 · 无人值守", savepoint: true,
      guide: { title: "问路处", objective: "走进任意一间亭子" },
      text:
        "老亭的门没有锁。柜台上放着一本翻旧的留言簿，侧壁上贴着一张后来补上去的纸条。\n\n" +
        "新亭的门也没有锁。里面有一台门牌打印机，正隔一会儿轻轻咔嗒一声，像在等谁走近。\n\n" +
        "亭子里都没有人。只有两支停住的墨线，和满柜子指向别处的字。",
      choices: [
        { id: "enter-old", label: "走进左边那座木亭。", next: "askway.keeper_greeting" },
        { id: "enter-new", label: "先看右边那座新亭。", next: "askway.new_kiosk" },
        { id: "walk-roads", label: "沿着五条路看看方向。", next: "askway.directions" },
      ],
    },

    /* ───────────────────── 第一幕：敬语铜喇叭 ───────────────────── */

    "askway.keeper_greeting": {
      id: "askway.keeper_greeting", title: "铜喇叭", role: "第一幕 · 老亭", savepoint: true,
      guide: { title: "问路处", objective: "听铜喇叭把开场的话说完" },
      activeActorIds: ["askway_keeper"],
      text:
        "柜台后的黄铜喇叭先响了一阵电流杂音，然后传出一个过分礼貌的声音。\n\n" +
        "「亲爱的访客，您好。很高兴您来到这座小城。」\n\n" +
        "「如果您有不会去的地方——本亭，或许可以帮到您。」\n\n" +
        "停顿了半拍。\n\n" +
        "「——当然，您也可以询问城里戴袖章的人。」",
      choices: [
        { id: "ask-map", label: "请给我一张地图。", next: "askway.map_handover" },
        { id: "ask-new", label: "右边那座新亭是什么时候建的？", next: "askway.new_kiosk" },
      ],
    },

    "askway.map_handover": {
      id: "askway.map_handover", title: "城市地图", role: "第一幕 · 八问十七门", savepoint: true,
      presentation: "document",
      guide: { title: "问路处", objective: "听完亭子能回答的问题" },
      activeActorIds: ["askway_keeper"],
      text:
        "「地图在柜中，请自取。需要誊抄的，纸和笔也在。」\n\n" +
        "玻璃柜的锁弹开。你取出一张泛黄的地图，上面印着浅蓝色的门牌，一共十七扇。\n\n" +
        "「以下问题，您也可以直接问我。」\n\n" +
        "「刚刚来到这座城，什么也不知道，怎么办？」\n" +
        "「写了一半的东西，出门再回来，字没了，怎么办？」\n" +
        "「如何查看元件状态？」\n" +
        "「如何打出特殊字体、字符，以及传送门？」\n" +
        "「如何回复别人的话？」\n" +
        "「如何跳转？」\n" +
        "「如何修改自家门面的牌匾？」",
      choices: [
        { id: "ask-one-by-one", label: "逐个问这些问题。", next: "askway.eight_questions", set: { "askway.map.old": true } },
        { id: "read-more", label: "先念一遍地图末尾的「更多」。", next: "askway.more_doors", set: { "askway.map.old": true } },
        { id: "go-new", label: "先去新亭看看。", next: "askway.new_kiosk", set: { "askway.map.old": true } },
      ],
    },

    /* ───────────────────── 第二幕：八问柜台 ───────────────────── */

    "askway.eight_questions": {
      id: "askway.eight_questions", title: "八问柜台", role: "第二幕 · 问路", savepoint: true,
      guide: { title: "问路处", objective: "在亭柱前选一个问题" },
      activeActorIds: ["askway_keeper"],
      text:
        "亭柱上刻着八个问题，每个问题下面原本都挂着一扇门。\n\n" +
        "第五问和第六问的刻字被摸得发亮，下面却没有门——那两问的答案，亭子直接说给你听。\n\n" +
        "铜喇叭等着。",
      choices: [
        { id: "q1", label: "刚刚来到这座城，什么也不知道，怎么办？", next: "askway.q1_survival" },
        { id: "q2", label: "写了一半的东西，出门再回来，字没了，怎么办？", next: "askway.q2_typing" },
        { id: "q3", label: "如何查看元件状态？", next: "askway.q3_status" },
        { id: "q4", label: "如何打出特殊字体、字符，以及传送门？", next: "askway.q4_fonts" },
        { id: "q5", label: "如何回复别人的话？", next: "askway.q5_reply" },
        { id: "q6", label: "如何跳转？", next: "askway.q6_jump" },
        { id: "q7", label: "如何修改自家门面的牌匾？", next: "askway.q7_plaque" },
        { id: "more", label: "看看地图末尾的「更多」。", next: "askway.more_doors" },
        { id: "book", label: "翻一翻柜台的留言簿。", next: "askway.message_book" },
        { id: "roads", label: "走出亭子，看看五条路。", next: "askway.directions" },
        { id: "revisit", label: "先绕环岛走一圈。", next: "askway.revisit" },
      ],
    },

    "askway.q1_survival": {
      id: "askway.q1_survival", title: "第一问", role: "第二幕 · 新居民", savepoint: false,
      activeActorIds: ["askway_keeper"],
      text:
        "「出环岛，往城门方向走。那里有一座迎新台，台前的小册子会从头讲起。」\n\n" +
        "地图上第一扇门亮起：浅蓝色的「迎新台」。\n\n" +
        "铜喇叭补了一句：「那本册子最后一页印着一行小字：迷路了？→去环岛。」",
      choices: [
        { id: "to-survival", label: "顺着这扇门去迎新台看看。", next: "askway.dir_survival", set: { "askway.asked.q1": true } },
        { id: "back-hub-1", label: "记下门牌，回到柜台。", next: "askway.eight_questions", set: { "askway.asked.q1": true } },
      ],
    },

    "askway.q2_typing": {
      id: "askway.q2_typing", title: "第二问", role: "第二幕 · 旧图独有", savepoint: false,
      activeActorIds: ["askway_keeper"],
      text:
        "「往码字铺去。灯的 2.4.6 号版次，测试可用。」\n\n" +
        "停顿。\n\n" +
        "「——能不在亭子里码字，就别在亭子里码字哦。」\n\n" +
        "你低头看地图，这扇门在旧图上，新图上没有。",
      choices: [
        { id: "back-hub-2", label: "把这句叮嘱记下来。", next: "askway.eight_questions", set: { "askway.asked.q2": true } },
      ],
    },

    "askway.q3_status": {
      id: "askway.q3_status", title: "第三问", role: "第二幕 · 小小的蓝菜单", savepoint: false,
      activeActorIds: ["askway_keeper"],
      text:
        "「环岛东，元件工坊。点击任何元件，右上角会有一个小小的浅蓝色菜单图标。」\n\n" +
        "「有些元件没有菜单。有些元件的菜单里，什么都没有。」\n\n" +
        "「——这不算它们的问题。」\n\n" +
        "你凑近地图柜，发现门框内侧刻着一行很小的数字：09:36。",
      choices: [
        { id: "inspect-frame", label: "用放大镜看那行刻字。", next: "askway.twin_mark", set: { "askway.asked.q3": true } },
        { id: "back-hub-3", label: "先回到柜台。", next: "askway.eight_questions", set: { "askway.asked.q3": true } },
      ],
    },

    "askway.q4_fonts": {
      id: "askway.q4_fonts", title: "第四问", role: "第二幕 · 字体的四扇门", savepoint: false,
      activeActorIds: ["askway_keeper"],
      text:
        "「字体的事，一共四扇门：特殊字体及传送门、更多字体、特殊符号、Markdown 字符汇总。老城区巷口一排。」\n\n" +
        "「第一扇是杂货铺——门是那边的人先会造的。」",
      choices: [
        { id: "to-fonts", label: "去老城区巷口看看。", next: "askway.dir_fonts", set: { "askway.asked.q4": true } },
        { id: "back-hub-4", label: "记下四扇门，回到柜台。", next: "askway.eight_questions", set: { "askway.asked.q4": true } },
      ],
    },

    "askway.q5_reply": {
      id: "askway.q5_reply", title: "第五问", role: "第二幕 · 口头作答", savepoint: false,
      activeActorIds: ["askway_keeper"],
      text:
        "「这一问，不必带您去哪里。」\n\n" +
        "「点击您要回复的人所说的话，输入框内会自动补充『回复@ xxx：』——那个人的通知列表里，也会显示您的回复。」\n\n" +
        "亭柱上这行字是磨得最亮的一行。你伸手碰了碰，指腹上沾了一点旧墨。",
      choices: [
        { id: "then-jump", label: "那么，如何跳转？", next: "askway.q6_jump", set: { "askway.learned.reply": true } },
        { id: "back-hub-5", label: "先记住，回到柜台。", next: "askway.eight_questions", set: { "askway.learned.reply": true } },
      ],
    },

    "askway.q6_jump": {
      id: "askway.q6_jump", title: "第六问", role: "第二幕 · 全案题眼", savepoint: true,
      guide: { title: "问路处", objective: "听完亭子里最后一条不用挂门的答案" },
      activeActorIds: ["askway_keeper"],
      text:
        "「这一问，站在亭子里就能学会。」\n\n" +
        "「只要门牌格式没有问题——点击浅蓝色的字，就能去到它说的地方。」\n\n" +
        "铜喇叭停了一下，像在等这句话落稳。\n\n" +
        "「作品，或者人。」\n\n" +
        "全城浅蓝色的文字，从这一刻起都可以点击。",
      choices: [
        { id: "both-learned", label: "回复和跳转，都记住了。", next: "askway.reply_and_jump", set: { "askway.learned.jump": true }, availableWhen: [{ type: "flag.equals", flagId: "askway.learned.reply", value: true }] },
        { id: "back-hub-6", label: "先回柜台，再问别的。", next: "askway.eight_questions", set: { "askway.learned.jump": true } },
      ],
    },

    "askway.reply_and_jump": {
      id: "askway.reply_and_jump", title: "两问自理", role: "第二幕 · 学会离亭", savepoint: true,
      guide: { title: "问路处", objective: "带着两条规矩离开柜台" },
      activeActorIds: ["askway_keeper"],
      text:
        "你把两件事在嘴里默念了一遍：怎么应答别人，怎么去任何地方。\n\n" +
        "「学会这两件，您就不必一直等人领路了。」铜喇叭说。\n\n" +
        "亭柱上的旧墨在光里发亮。你忽然明白，为什么只有这两问不用挂门。",
      choices: [
        { id: "keep-rules", label: "收好这两条规矩。", next: "askway.eight_questions", effects: [{ type: "event.publish", eventType: "story.achievement", payload: { id: "askway_two_answers", name: "两问自理" } }] },
        { id: "to-new-kiosk", label: "去新亭试试那张新地图。", next: "askway.new_kiosk", effects: [{ type: "event.publish", eventType: "story.achievement", payload: { id: "askway_two_answers", name: "两问自理" } }] },
      ],
    },

    "askway.q7_plaque": {
      id: "askway.q7_plaque", title: "第七问", role: "第二幕 · 牌匾铺", savepoint: false,
      activeActorIds: ["askway_keeper"],
      text:
        "「换牌匾不必动用AR——牌匾铺里有不用AR的办法。」\n\n" +
        "地图上又亮起一扇旧图独有的门。门框上没有任何记号，像一间普通铺子。",
      choices: [
        { id: "to-plaque", label: "去牌匾铺那条街看看。", next: "askway.directions", set: { "askway.asked.q7": true } },
        { id: "back-hub-7", label: "回到柜台。", next: "askway.eight_questions", set: { "askway.asked.q7": true } },
      ],
    },

    "askway.more_doors": {
      id: "askway.more_doors", title: "更多", role: "第二幕 · 地图末尾", savepoint: false,
      activeActorIds: ["askway_keeper"],
      text:
        "「更多」两个字被两层放大的木牌叠着，刻地图的人显然很想让这行字被看见。\n\n" +
        "「城外有一座坐标——官网，全图唯一一扇朝城外开的门。」\n\n" +
        "「词典馆、精选书架、创号测算亭、事件记录簿、小说合集、名单……门都在图上。」\n\n" +
        "「其中一扇，门框上钉着迁址条。」\n\n" +
        "下面还有一行条例，括号打开了一半，没有合上。铜喇叭对此不解释。",
      choices: [
        { id: "to-relocated", label: "去看那扇钉着迁址条的门。", next: "askway.relocated_door" },
        { id: "back-hub-more", label: "把地图折好，回到柜台。", next: "askway.eight_questions" },
      ],
    },

    "askway.twin_mark": {
      id: "askway.twin_mark", title: "门框内侧", role: "支线 · 七分四十一秒", savepoint: false,
      activeActorIds: ["askway_keeper"],
      text:
        "门框内侧刻着「09:36」。你再去看老亭的奠基石，上面刻着「09:44」。\n\n" +
        "先有答案，后有索引。两行数字之间，只隔着一杯咖啡的时间。\n\n" +
        "铜喇叭没有催你。",
      choices: [
        { id: "record-twin", label: "把这七分四十一秒记下来。", next: "askway.eight_questions", set: { "askway.read.twin": true }, effects: [{ type: "event.publish", eventType: "story.achievement", payload: { id: "askway_seven_seconds", name: "七分四十一秒" } }] },
        { id: "skip-twin", label: "先不记，回柜台。", next: "askway.eight_questions" },
      ],
    },

    /* ───────────────────── 第三幕：新亭与两版地图 ───────────────────── */

    "askway.new_kiosk": {
      id: "askway.new_kiosk", title: "新亭", role: "第三幕 · 门牌机", savepoint: true,
      guide: { title: "问路处", objective: "让新亭的门牌机打一张纸条" },
      activeActorIds: ["askway_printer"],
      text:
        "新亭里没有铜喇叭，只有一台门牌打印机。金属外壳擦得很素，边上有一道很细的接缝，正对着老亭的侧壁。\n\n" +
        "目录只有五条：\n" +
        "一、新居民如何安全度过「萌新」期；\n" +
        "二、小城特有的语言；\n" +
        "三、咱们小城也有自己的法律法规；\n" +
        "四、如何打出彩色以及其他字体和链接；\n" +
        "五、其他。\n\n" +
        "最末一行，是一扇很小的小门。门牌上只有两个字：彩蛋。",
      choices: [
        { id: "print-slip", label: "让门牌机打一张纸条。", next: "askway.printer_greeting" },
        { id: "back-old", label: "先回老亭。", next: "askway.keeper_greeting" },
      ],
    },

    "askway.printer_greeting": {
      id: "askway.printer_greeting", title: "门牌机", role: "第三幕 · 2024 年版", savepoint: true,
      presentation: "document",
      guide: { title: "问路处", objective: "收下 2024 年版城市地图" },
      activeActorIds: ["askway_printer"],
      text:
        "打印机咔嗒一声，吐出一张纸条。你的名字被打印体嵌在开头。\n\n" +
        "「亲爱的（你的名字），你好～，欢迎来到这座小城。简称『小城』。」\n\n" +
        "下面印着和亭内一样的五条目录。纸条背面还有一行更小的自检信息：\n\n" +
        "「值守人：F35。值守自 2024 年 5 月 3 日 22 时 03 分起。」",
      choices: [
        { id: "take-new-map", label: "收好纸条和 2024 年版地图。", next: "askway.two_maps", set: { "askway.map.new": true } },
        { id: "read-back", label: "再读一遍背面的自检信息。", next: "askway.two_maps", set: { "askway.map.new": true, "askway.read.printer": true } },
      ],
    },

    "askway.two_maps": {
      id: "askway.two_maps", title: "两支墨线", role: "第三幕 · 环岛中央", savepoint: true,
      presentation: "cg",
      guide: { title: "问路处", objective: "把两张地图并排铺开" },
      activeActorIds: ["askway_keeper", "askway_printer"],
      text:
        "你回到环岛中央，把两张地图并排铺在喷泉边。\n\n" +
        "铜喇叭先开口：「本亭的墨线，走了四百七十三天。」\n\n" +
        "门牌机跟着打字：「本亭的墨线，走了三十五小时十三分。」\n\n" +
        "长久的安静。喷泉在环岛中间溅着水。\n\n" +
        "「……新亭落成那天，有个人从这里走过去，在我侧壁贴了张条子。」\n\n" +
        "「那是我。八分钟前，我刚建好。」\n\n" +
        "「他后来没再来过。」\n\n" +
        "「……」",
      choices: [
        { id: "ask-note", label: "问那张转址条是谁贴的。", next: "askway.transfer_note" },
        { id: "compare-maps", label: "把两张地图逐扇门对照。", next: "askway.map_diff" },
        { id: "ask-roads", label: "问五条路分别通向哪里。", next: "askway.directions" },
        { id: "leave-quiet", label: "什么都不问，离开环岛。", next: "askway.ending_quiet" },
      ],
    },

    "askway.transfer_note": {
      id: "askway.transfer_note", title: "转址条", role: "第三幕 · 八分钟", savepoint: false,
      activeActorIds: ["askway_keeper", "askway_printer"],
      text:
        "老亭侧壁上贴着一张很小的纸条，上面只有一行字：\n\n" +
        "「导航（新）」\n\n" +
        "纸条落款的时刻是 22:11。新亭的自检信息写着 22:03。\n\n" +
        "建完新亭，走回旧亭，贴条。中间大约八分钟。\n\n" +
        "门牌机吐出一张更小的纸条，上面只有一行字：\n\n" +
        "「永退了，再见」",
      choices: [
        { id: "keep-note", label: "把这张纸条收好。", next: "askway.two_maps", set: { "askway.read.transfer": true } },
        { id: "to-diff", label: "把纸条夹进地图，继续对照。", next: "askway.map_diff", set: { "askway.read.transfer": true } },
      ],
    },

    "askway.map_diff": {
      id: "askway.map_diff", title: "地图差集", role: "第三幕 · 门会搬家", savepoint: true,
      guide: { title: "问路处", objective: "找出两版地图的不同" },
      activeActorIds: ["askway_keeper", "askway_printer"],
      text:
        "两张地图并排铺开，差别很快显出来。\n\n" +
        "共同的门十三扇。旧图独有四扇：码字铺、元件工坊、牌匾铺、试行条例门。新图独有两扇：条例 V3 门、彩蛋门。\n\n" +
        "新图还删掉了两问的口头刻字，只留下目录。\n\n" +
        "旧图上那扇试行条例门，在政府街旧址还立着，只是门框上多了一张浅蓝色的迁址条。\n\n" +
        "五种差异都走过以后，铜喇叭只说一句：\n\n" +
        "「地图比城老。这不是地图的错。」",
      choices: [
        { id: "to-law", label: "去政府街看那扇迁址门。", next: "askway.relocated_door" },
        { id: "to-names", label: "回老亭看梁上的落款。", next: "askway.names_wall" },
        { id: "to-egg", label: "去新亭目录最末一行。", next: "askway.easter_egg" },
        { id: "back-maps", label: "回到两张地图前。", next: "askway.two_maps" },
      ],
    },

    "askway.relocated_door": {
      id: "askway.relocated_door", title: "迁址门", role: "支线 · 门搬了家", savepoint: false,
      activeActorIds: ["askway_keeper"],
      text:
        "政府街旧址的那扇门还在。门板很旧，门框上钉着一张浅蓝色的条子：\n\n" +
        "「本条例已迁至新址」\n\n" +
        "你点了一下条子。眼前的街景换了，一座新的条例碑立在政府街尽头，碑座擦得很干净。\n\n" +
        "门搬了家，条子还认路。",
      choices: [
        { id: "record-law", label: "把新址记在地图边上。", next: "askway.map_diff", set: { "askway.read.relocated": true } },
        { id: "to-roads-law", label: "顺着政府街再走走。", next: "askway.directions", set: { "askway.read.relocated": true } },
      ],
    },

    /* ───────────────────── 第四幕：落款栏与改名 ───────────────────── */

    "askway.names_wall": {
      id: "askway.names_wall", title: "落款栏", role: "第四幕 · 五个名字", savepoint: true,
      guide: { title: "问路处", objective: "看清老亭梁上的落款" },
      activeActorIds: ["askway_keeper"],
      text:
        "老亭的横梁上刻着五个人名：\n\n" +
        "寒腿叔叔 · 幻眠 · 大神阿青 · 冰如冷 · I'm dreaming\n\n" +
        "你站在下面看了很久，说：「这些名字，城里一个都搜不到。」\n\n" +
        "（除了那个一直用着旧名的人。）\n\n" +
        "铜喇叭没有替谁回答。",
      choices: [
        { id: "to-cards", label: "把落款拓下来，去档案馆查户籍。", next: "askway.archive_cards", set: { "askway.read.names": true }, effects: [{ type: "event.publish", eventType: "story.achievement", payload: { id: "askway_blue_name", name: "作品，或者人" } }] },
        { id: "back-hub-names", label: "先回柜台。", next: "askway.eight_questions" },
      ],
    },

    "askway.archive_cards": {
      id: "askway.archive_cards", title: "户籍柜", role: "第四幕 · 四张空卡", savepoint: false,
      activeActorIds: ["askway_keeper"],
      text:
        "档案馆的户籍柜里，四个旧名对应四张空卡。你把同一支笔迹的落款拓片摊在旁边，一张一张比对。\n\n" +
        "寒腿叔叔 —— iceiceiceice\n" +
        "大神阿青 —— P.Z.\n" +
        "冰如冷 —— 白露让我无可救药\n" +
        "I'm dreaming —— 铖子\n\n" +
        "幻眠还是幻眠。签名档也还是那三个字：「der，der，der」。",
      choices: [
        { id: "write-cards", label: "把四个今名抄进对照笺。", next: "askway.names_return", set: { "askway.names.solved": true } },
      ],
    },

    "askway.names_return": {
      id: "askway.names_return", title: "回到环岛", role: "第四幕 · 名字会走", savepoint: true,
      guide: { title: "问路处", objective: "把对照笺贴回落款栏旁" },
      activeActorIds: ["askway_keeper"],
      text:
        "你回到老亭，把对照笺贴在落款栏旁。旧名一个也没有被盖住。\n\n" +
        "铜喇叭说：「名字会走。」\n\n" +
        "停了一下。\n\n" +
        "「路还在。」\n\n" +
        "留言簿上那条半年前的嘀咕，现在有了答案：他找的人，现在叫 iceiceiceice。",
      choices: [
        { id: "paste-cards", label: "把对照笺贴好。", next: "askway.eight_questions", effects: [{ type: "event.publish", eventType: "story.achievement", payload: { id: "askway_names_walk", name: "名字会走，路还在" } }] },
        { id: "to-roads-names", label: "再看看五条路。", next: "askway.directions", effects: [{ type: "event.publish", eventType: "story.achievement", payload: { id: "askway_names_walk", name: "名字会走，路还在" } }] },
      ],
    },

    /* ───────────────────── 第五幕：五条路与路过的人 ───────────────────── */

    "askway.directions": {
      id: "askway.directions", title: "五条路", role: "第五幕 · 方向", savepoint: true,
      guide: { title: "问路处", objective: "选择一条路，或和环岛边的人说话" },
      activeActorIds: ["askway_keeper"],
      text:
        "环岛上的五条路各自朝外。喷泉把水声铺在中间，正好盖住远处街道的动静。\n\n" +
        "你可以往任意一条路走一段，也可以留在环岛。",
      choices: [
        { id: "road-survival", label: "往城门方向，去迎新台。", next: "askway.dir_survival" },
        { id: "road-fonts", label: "去老城区巷口，看字体的四扇门。", next: "askway.dir_fonts" },
        { id: "road-academy", label: "去学堂街，看必修楼的目录厅。", next: "askway.dir_academy" },
        { id: "road-law", label: "去政府街，看条例碑。", next: "askway.dir_law" },
        { id: "road-archive", label: "去档案馆路，看户籍柜。", next: "askway.dir_archive" },
        { id: "meet-huanmian", label: "叫住那个从环岛穿过的人。", next: "askway.huanmian" },
        { id: "watch-child", label: "看看喷泉边的小孩。", next: "askway.child" },
        { id: "back-kiosks", label: "回到两间亭子。", next: "askway.two_kiosks" },
      ],
    },

    "askway.dir_survival": {
      id: "askway.dir_survival", title: "迎新台", role: "客串 · 城门方向", savepoint: false,
      text:
        "迎新台前摆着一摞小册子，封面上写着「新用户生存指南」。\n\n" +
        "你翻到最后一页，页脚印着一行小字：\n\n" +
        "「迷路了？→去环岛。」\n\n" +
        "环岛就在你身后。指路的地方，也被人指着。",
      choices: [
        { id: "back-roads-1", label: "沿原路回环岛。", next: "askway.directions" },
        { id: "back-hub-1b", label: "回到问路柜台。", next: "askway.eight_questions" },
      ],
    },

    "askway.dir_fonts": {
      id: "askway.dir_fonts", title: "字体四门", role: "客串 · 老城区巷口", savepoint: false,
      text:
        "老城区巷口一排四扇门：特殊字体及传送门、更多字体、特殊符号、Markdown 字符汇总。\n\n" +
        "杂货铺掌柜正在门口理货。你问起传送门，他朝环岛的方向抬了抬下巴。\n\n" +
        "「传送门的用法？环岛亭子里有图。他们印得比我讲得清楚。」",
      choices: [
        { id: "back-roads-2", label: "把四扇门记下来，回环岛。", next: "askway.directions" },
        { id: "back-hub-2b", label: "回到问路柜台。", next: "askway.eight_questions" },
      ],
    },

    "askway.dir_academy": {
      id: "askway.dir_academy", title: "必修楼", role: "客串 · 学堂街", savepoint: false,
      text:
        "必修楼目录厅的楼层表挂得很整齐，每一层都写着课目和去处。\n\n" +
        "你问门房，环岛那座问路亭和本楼有没有往来。\n\n" +
        "门房想了想：「环岛那座亭子？……和本楼没有往来。」\n\n" +
        "两套索引各自挂在墙上，谁也没有指向谁。",
      choices: [
        { id: "back-roads-3", label: "回到环岛。", next: "askway.directions" },
        { id: "back-hub-3b", label: "回到问路柜台。", next: "askway.eight_questions" },
      ],
    },

    "askway.dir_law": {
      id: "askway.dir_law", title: "条例碑", role: "客串 · 政府街", savepoint: false,
      text:
        "政府街尽头立着新的条例碑。碑座边钉着一张浅蓝色的迁址条，和旧图上那半扇门正好接上。\n\n" +
        "碑上的字比旧图里的试行条例更整齐。门换了地址，条子还认得路。",
      choices: [
        { id: "back-roads-4", label: "记下新址，回环岛。", next: "askway.directions", set: { "askway.read.relocated": true } },
        { id: "back-diff-4", label: "回去继续对照地图。", next: "askway.map_diff", set: { "askway.read.relocated": true } },
      ],
    },

    "askway.dir_archive": {
      id: "askway.dir_archive", title: "档案馆", role: "客串 · 档案馆路", savepoint: false,
      text:
        "档案馆的户籍柜靠墙排开。名录墙旁边新添了一枚铜钉，钉着一张字条，上面写着「七分四十一秒」。\n\n" +
        "柜台上还留着两个空展位，标签写着「转址条」「曾用名对照笺」。\n\n" +
        "旧名与今名在抽屉里各占一格，中间只隔着一层薄木板。",
      choices: [
        { id: "archive-cards-2", label: "查那五个落款的名字。", next: "askway.archive_cards" },
        { id: "archive-names-2", label: "回到落款栏前。", next: "askway.names_wall" },
        { id: "back-roads-5", label: "回到环岛。", next: "askway.directions" },
      ],
    },

    "askway.huanmian": {
      id: "askway.huanmian", title: "幻眠", role: "路过 · 低频", savepoint: false,
      activeActorIds: ["askway_huanmian"],
      text:
        "一个慢悠悠的身影从环岛穿过，好像只是路过。他头顶飘着一行签名档：「der，der，der」。\n\n" +
        "「——你是落款上的幻眠？」\n\n" +
        "「嗯。」\n\n" +
        "他看了一眼老亭，没有停步。\n\n" +
        "「图在柜子里。自己拿。」\n\n" +
        "他走出环岛。没有再说第二句。",
      choices: [
        { id: "let-pass", label: "看着他走出环岛。", next: "askway.directions", set: { "askway.met.huanmian": true } },
        { id: "back-hub-pass", label: "回柜台继续问路。", next: "askway.eight_questions", set: { "askway.met.huanmian": true } },
      ],
    },

    "askway.child": {
      id: "askway.child", title: "喷泉边", role: "路过 · 彩蛋门", savepoint: false,
      activeActorIds: ["askway_child"],
      text:
        "喷泉边蹲着一个小孩，正用手指在池沿上画门。\n\n" +
        "「那扇彩蛋门，我进去过十一次！每次都被骗！」\n\n" +
        "「……那你还去？」\n\n" +
        "「每次都想再被骗一次。」\n\n" +
        "他说完，又画了一扇门。",
      choices: [
        { id: "child-egg", label: "去新亭最末一行看看那扇门。", next: "askway.easter_egg" },
        { id: "back-roads-child", label: "回到环岛。", next: "askway.directions" },
      ],
    },

    /* ───────────────────── 第六幕：彩蛋门与留言簿 ───────────────────── */

    "askway.easter_egg": {
      id: "askway.easter_egg", title: "彩蛋", role: "第六幕 · 最忙的门", savepoint: true,
      presentation: "cg",
      guide: { title: "问路处", objective: "推开新亭目录最末一行的小门" },
      text:
        "门后是一间糖果色的小房间，一台老式唱机摆在正中间。\n\n" +
        "你刚走进去，唱针就自动落下了。\n\n" +
        "♪ Never gonna give you up ♪\n" +
        "♪ Never gonna let you down ♪\n" +
        "♪ Never gonna run around and desert you ♪\n\n" +
        "门内侧挂着一块牌：你被骗了。\n\n" +
        "墙上的访客计数器翻了一格：43754 → 43755。",
      choices: [
        { id: "leave-egg", label: "跟着哼完，推门出来。", next: "askway.ending_easter", set: { "askway.easter.count": 43755 }, effects: [{ type: "event.publish", eventType: "story.achievement", payload: { id: "askway_never_gonna", name: "Never gonna give you up" } }] },
      ],
    },

    "askway.message_book": {
      id: "askway.message_book", title: "留言簿", role: "第六幕 · 考古", savepoint: true,
      presentation: "document",
      guide: { title: "问路处", objective: "在无人值守的亭子里留下一句话" },
      activeActorIds: ["askway_keeper"],
      text:
        "留言簿翻到最新的几页，字迹一层压着一层：\n\n" +
        "「好全呀」「好啊」\n" +
        "「导航（新）」——只有这四个字，和一个链接。\n" +
        "「请问字体大（96号）小（1号）怎么弄？」——问句里的「大」是全簿最大的字，「小」是全簿最小的字。\n" +
        "「考古」「秦朝老文物考古」「哎嘿~」——隔着五个月，墨色还很新。\n" +
        "「寒腿叔叔？不管了考古」\n" +
        "最近一页，是昨天的「考古」。\n\n" +
        "柜台上的笔还能写。",
      choices: [
        { id: "write-archaeology", label: "写下「考古」。", next: "askway.ending_message", set: { "askway.message.written": true }, effects: [{ type: "event.publish", eventType: "story.achievement", payload: { id: "askway_archaeology", name: "例行考古" } }] },
        { id: "only-read", label: "只翻不写，把簿子合上。", next: "askway.ending_quiet" },
      ],
    },

    "askway.revisit": {
      id: "askway.revisit", title: "再绕一圈", role: "回访 · 环岛", savepoint: true,
      guide: { title: "问路处", objective: "在环岛再走一圈" },
      activeActorIds: ["askway_keeper"],
      text:
        "你又绕着环岛走了一圈。老亭的玻璃柜还亮着，新亭的门牌机偶尔咔嗒一声。\n\n" +
        "喷泉没有停。五条路还是朝外伸着。\n\n" +
        "亭子无人值守，但只要有人来，它就还在指路。",
      choices: [
        { id: "revisit-roads", label: "再选一条路走走。", next: "askway.directions" },
        { id: "revisit-hub", label: "回到八问柜台。", next: "askway.eight_questions" },
        { id: "revisit-book", label: "去翻留言簿。", next: "askway.message_book" },
        { id: "revisit-leave", label: "坐到天黑，然后离开。", next: "askway.ending_quiet" },
      ],
    },

    /* ───────────────────── 结局与回访 ───────────────────── */

    "askway.ending_easter": {
      id: "askway.ending_easter", title: "问路处", role: "结局 · 彩蛋", savepoint: true,
      presentation: "blackout", terminal: true, guide: null,
      text:
        "你从彩蛋门里出来，环岛的阳光很好。\n\n" +
        "身后那首歌还在门缝里响，隔着一条街，听不清歌词，只听得见调子。\n\n" +
        "全城最忙的门，从来没更新过。\n\n" +
        "它每次推开都准时响起同一首歌，从不失约。",
    },

    "askway.ending_message": {
      id: "askway.ending_message", title: "问路处", role: "结局 · 考古", savepoint: true,
      presentation: "blackout", terminal: true, guide: null,
      text:
        "你写下「考古」两个字，簿页轻轻合上，又自己翻开一行。\n\n" +
        "最新墨迹显示着今天的日期、你的名字，和同一个词。\n\n" +
        "在无人值守的亭子里留过言的人，都是它的值守人。\n\n" +
        "你走出老亭。新亭的门牌机咔嗒一声，像在替你合上这一页。",
    },

    "askway.ending_quiet": {
      id: "askway.ending_quiet", title: "问路处", role: "结局 · 离开", savepoint: true,
      presentation: "blackout", terminal: true, guide: null,
      text:
        "你从环岛离开的时候，两间亭子都没有出声。\n\n" +
        "老亭的墨线停着，新亭的墨线也停着。门一扇都没有锁。\n\n" +
        "你没有带走什么，也没有留下什么。\n\n" +
        "走过街角时，你回头看了一眼。喷泉还在溅水，五条路还在那里。\n\n" +
        "来过，就是来过。",
    },
  },

  sourceText:
    "改编自小城教育街区环岛问路亭的公共档案与访客留言。\n" +
    "老亭由五位维护者轮流值守四百七十三天，新亭由一位志愿者建成并值守三十五小时。\n" +
    "两版地图共同十三门，旧图独有四门，新图独有两门；一扇条例门经迁址条搬到新址。\n" +
    "本支线保留敬语铜喇叭、门牌机、两问口头作答、落款改名、彩蛋门与留言簿考古等段落，" +
    "以三处结局和一处回访收束。",
};
