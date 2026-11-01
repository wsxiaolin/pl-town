import type { StoryDefinition } from "../../../stories/types";

export const ZILAN_STORY: StoryDefinition = {
  schemaVersion: 1,
  definitionVersion: 1,
  id: "side.zilan.house",
  title: "紫兰世家",
  startNode: "zilan.gate",
  entryActorId: "zilan_elder",

  interactions: [
    { actorId: "zilan_elder", nodeId: "zilan.gate", choiceId: "approach" },
  ],

  buildingInteractions: [
    { buildingId: "zilan_shrine", nodeId: "zilan.gate", choiceId: "approach" },
  ],

  nodes: {
    "zilan.gate": {
      id: "zilan.gate",
      title: "世家门口",
      role: "序章",
      savepoint: true,
      guide: { title: "紫兰世家", objective: "走到碑后，从另一边推开丛祠的门" },
      activeActorIds: ["zilan_elder"],
      text:
        "十周年碑的背面三步之外，立着一座小祠。三面矮墙，一面敞开，院角的篝火还没点。\n\n" +
        "祠门和碑面是同一扇门。碑那边刻着「点击可查看」，推不开；这一边挂着一根木闩，闩头磨得发亮。\n\n" +
        "门边站着一个握扫帚的人，脚边放着一只灰桶。他看见你，先看了一眼门闩。",
      choices: [
        { id: "approach", label: "上前问一句。", next: "zilan.gate-talk", set: { "zilan.entered": true } },
        { id: "read-lintel", label: "先看门楣上的字。", next: "zilan.door-inscription", set: { "zilan.entered": true } },
      ],
    },

    "zilan.gate-talk": {
      id: "zilan.gate-talk",
      title: "守祠人",
      savepoint: true,
      guide: { title: "紫兰世家", objective: "听守祠人说完门与祠的来历" },
      activeActorIds: ["zilan_elder"],
      text:
        "「门找到了？——从这边开的，都这么说。」他把扫帚靠在墙边，往门里让了半步。\n\n" +
        "「祠比碑老。碑是我立的，文是他们 2024 年写的。我只管刻，不管写。」\n\n" +
        "他抬手指了指门闩。「要进就抬闩。吱呀一声，门就开了。」",
      choices: [
        { id: "enter", label: "抬闩进门。", next: "zilan.door-inscription" },
        { id: "ask-owner", label: "紫兰斋会来吗？", next: "zilan.owner-question" },
      ],
    },

    "zilan.door-inscription": {
      id: "zilan.door-inscription",
      title: "门与地砖",
      savepoint: false,
      activeActorIds: ["zilan_elder"],
      text:
        "门楣朝祠这一侧刻着六个字：天下苦物理乃久矣。\n\n" +
        "门槛内嵌着一块地砖，低头可见：失期，考皆失利。\n\n" +
        "守祠人在你身后说：「你回头看一眼。碑那边刻的『点击可查看』，在这边读作『已查看』。」",
      choices: [
        { id: "cross", label: "跨过门槛。", next: "zilan.courtyard" },
        { id: "look-back", label: "回头看一眼门背。", next: "zilan.courtyard" },
      ],
    },

    "zilan.courtyard": {
      id: "zilan.courtyard",
      title: "丛祠小院",
      role: "支线 · 白日",
      savepoint: true,
      guide: { title: "紫兰世家", objective: "在丛祠里四处看看，再决定去留" },
      activeActorIds: ["zilan_elder"],
      text:
        "祠内很小。进门正对一面影壁，两侧是注疏墙，墙下摆着一只矮玻璃柜。\n\n" +
        "祠角有鱼形邮筒，门内侧有一把旧木椅，侧墙书架两格，地面嵌着五枚铜脚印，墙边挂着一张五城战图。\n\n" +
        "院角的篝火现在只剩一圈冷灰。守祠人把灰桶放下，等你先开口。",
      choices: [
        { id: "read-wall", label: "读 754 字影壁。", next: "zilan.hall" },
        { id: "annotations", label: "看注疏墙与佚文柜。", next: "zilan.annotation-wall" },
        { id: "mailbox", label: "走向鱼腹邮筒。", next: "zilan.mailbox" },
        { id: "chair", label: "坐上那把旧木椅。", next: "zilan.old-chair" },
        { id: "genealogy", label: "翻看书架与镇记之宝。", next: "zilan.genealogy" },
        { id: "footprints", label: "去看五枚铜脚印。", next: "zilan.footprints" },
        { id: "map", label: "看五城战图。", next: "zilan.city-map" },
        { id: "night", label: "在院里等天黑。", next: "zilan.fox-night" },
        { id: "historian", label: "找太史说说话。", next: "zilan.historian" },
        { id: "decide", label: "想好了，去留做个决定。", next: "zilan.decision" },
      ],
    },

    "zilan.hall": {
      id: "zilan.hall",
      title: "754 字影壁",
      savepoint: true,
      activeActorIds: ["zilan_elder"],
      text:
        "影壁正对大门，上面刻着三段文言。右下角有一只小计数器，此刻停在零。\n\n" +
        "壁角另有一行小字：「这可是754个字 ( )」。\n\n" +
        "守祠人没有跟进来，只在门外说：「逐行读。读完了，你就别问了。」",
      choices: [
        { id: "read-part1", label: "从第一段读起。", next: "zilan.read-first" },
        { id: "word-count", label: "先看计数器旁的铭牌。", next: "zilan.word-count" },
        { id: "back", label: "先退出去。", next: "zilan.courtyard" },
      ],
    },

    "zilan.read-first": {
      id: "zilan.read-first",
      title: "影壁 · 第一段",
      savepoint: false,
      activeActorIds: ["zilan_elder"],
      text:
        "紫兰者，中国人也，字斋。管理者，物实人也，字员。\n\n" +
        "紫兰少时，尝与人习文，独坐椅上，怅恨久之，曰：「苟富贵，无相忘。」\n\n" +
        "习者笑而应曰：「若为习文，何富贵也？」\n\n" +
        "紫兰太息曰：「嗟乎，燕雀安知鸿鹄之志哉！」",
      choices: [
        { id: "next", label: "继续读第二段。", next: "zilan.read-second", set: { "zilan.read.part1": true } },
        { id: "back", label: "先停一下。", next: "zilan.courtyard" },
      ],
    },

    "zilan.read-second": {
      id: "zilan.read-second",
      title: "影壁 · 第二段",
      savepoint: false,
      activeActorIds: ["zilan_elder"],
      text:
        "二世元年七月，发闾左適戍软件九百人，屯大泽乡。紫兰皆次当行为屯长。\n\n" +
        "会天大雨，道不通，度已失期。失期，考皆失利。\n\n" +
        "紫兰、管理乃谋曰：「今失利亦废，举大计亦废，等废，废国可乎？」\n\n" +
        "紫兰曰：「天下苦物理乃久矣。」乃信息曰：「紫兰王」，置人所赠邮箱中。\n\n" +
        "夜篝火，狐鸣呼曰：「物实兴，紫兰王」。卒皆夜惊恐。",
      choices: [
        { id: "next", label: "继续读第三段。", next: "zilan.read-third", set: { "zilan.read.part2": true } },
        { id: "back", label: "先停一下。", next: "zilan.courtyard" },
      ],
    },

    "zilan.read-third": {
      id: "zilan.read-third",
      title: "影壁 · 第三段",
      savepoint: false,
      activeActorIds: ["zilan_elder"],
      text:
        "紫兰素爱人，士卒多为用者。召令徒属曰：「公等遇雨，皆己失期，失期失利。藉第令废，而复读者固十六七。且壮士不废即己，失利即举大名耳，化学实验宁有种乎！」\n\n" +
        "徒属皆曰：「敬受命。」乃诈称公子实验、海龟，从民欲也。\n\n" +
        "攻物、理、实、验、室，皆下之。比至理，车六七百乘，骑千余，卒数万人。\n\n" +
        "数日，号令召编辑、志愿与皆来会计事。紫兰乃立为王，号为物实。",
      choices: [
        {
          id: "finish",
          label: "读到最后一行。",
          next: "zilan.recited",
          set: { "zilan.read.part3": true, "zilan.read.all": true },
          effects: [
            { type: "event.publish", eventType: "story.achievement", payload: { id: "zilan_recite", name: "我天我好像会背了" } },
          ],
        },
        { id: "back", label: "先停一下。", next: "zilan.courtyard" },
      ],
    },

    "zilan.recited": {
      id: "zilan.recited",
      title: "读毕",
      savepoint: true,
      activeActorIds: ["zilan_elder"],
      text:
        "最后一行落定。计数器从零开始走字，一直走到 754，停住。\n\n" +
        "影壁上的三段字没有变化，但你发现自己已经能在心里接上下一句。\n\n" +
        "门外传来守祠人的声音：「读完了？那你还问什么。」",
      choices: [
        { id: "to-courtyard", label: "回到院里。", next: "zilan.courtyard" },
        { id: "to-word-count", label: "再看一眼计数器铭牌。", next: "zilan.word-count" },
      ],
    },

    "zilan.word-count": {
      id: "zilan.word-count",
      title: "计数器铭牌",
      savepoint: false,
      text:
        "计数器旁钉着一块小铭牌。\n\n" +
        "「这可是754个字 ( )」\n\n" +
        "下面还有一行更小的字：「另计 834 字符（含标点）。两账并存，祠不判数。」\n\n" +
        "两个数字并排刻着，谁也没有被划掉。",
      choices: [
        { id: "back", label: "回到影壁前。", next: "zilan.hall" },
      ],
    },

    "zilan.annotation-wall": {
      id: "zilan.annotation-wall",
      title: "注疏墙",
      savepoint: true,
      activeActorIds: ["zilan_elder"],
      text:
        "影壁两侧共挂 16 块木牌。牌上都是那篇文字底下的原话，连标点一起刻着。\n\n" +
        "墙顶有一张告示：「16 块挂出来，21 块在柜里。」\n\n" +
        "墙下矮玻璃柜里，21 卷卷轴密封着，透光，不可读。柜签写着：「2024年7月2日 12:49—20:14 · 首日下午 · 佚二十一条」。",
      choices: [
        { id: "read-plaque", label: "读一块最亮的木牌。", next: "zilan.plaque-one" },
        { id: "cabinet", label: "俯身看玻璃柜。", next: "zilan.sealed-cabinet" },
        { id: "back", label: "退回院中。", next: "zilan.courtyard" },
      ],
    },

    "zilan.plaque-one": {
      id: "zilan.plaque-one",
      title: "木牌",
      savepoint: false,
      text:
        "第一块木牌上写着：「我天我好像会背了（」\n\n" +
        "旁边一块：「这可是754个字 ( )」\n\n" +
        "再旁边：「建议把紫兰改成紫大()」「要是把王改成亡就没亊了（」\n\n" +
        "最后一块刻着那句错版口号：「物实兴，紫大亡 (大雾」。括号也一起刻了进去。",
      choices: [
        { id: "back", label: "回到注疏墙。", next: "zilan.annotation-wall" },
      ],
    },

    "zilan.sealed-cabinet": {
      id: "zilan.sealed-cabinet",
      title: "佚文柜",
      savepoint: false,
      text:
        "玻璃擦得很干净，里面的卷轴却一封也看不清。\n\n" +
        "柜签只标数量与时段，没有标题，没有摘要。\n\n" +
        "玻璃上有一道手写的箭头，指向墙上 20:19 那块木牌。牌上只有一句：「@了 (真的」。",
      choices: [
        { id: "back", label: "回到注疏墙。", next: "zilan.annotation-wall" },
      ],
    },

    "zilan.mailbox": {
      id: "zilan.mailbox",
      title: "鱼腹邮筒",
      savepoint: true,
      activeActorIds: ["zilan_elder"],
      text:
        "祠角立着一只鱼形木邮筒，鱼腹开口。铭牌上刻着：「置人所赠邮箱中」。\n\n" +
        "筒身侧面还有一行：「收件人一栏是空的。信照收。」\n\n" +
        "守祠人远远看了一眼，说：「投什么都行。这里只回一声。」",
      choices: [
        { id: "write", label: "借纸笔写一封信。", next: "zilan.mail-write" },
        { id: "old", label: "看看筒里已有的信。", next: "zilan.old-letters" },
        { id: "back", label: "先不投。", next: "zilan.courtyard" },
      ],
    },

    "zilan.mail-write": {
      id: "zilan.mail-write",
      title: "投信",
      savepoint: false,
      text:
        "你写了一张纸，折好，投进鱼腹。\n\n" +
        "纸片落到底部，只发出一声很轻的「嗒」。\n\n" +
        "没有回执，没有提示，也没有任何东西从筒里回来。",
      choices: [
        { id: "listen", label: "站在原地听一会儿。", next: "zilan.mail-reply", set: { "zilan.mail.sent": true } },
        { id: "keep", label: "这样就好。", next: "zilan.courtyard", set: { "zilan.mail.sent": true } },
      ],
    },

    "zilan.mail-reply": {
      id: "zilan.mail-reply",
      title: "一声",
      savepoint: false,
      activeActorIds: ["zilan_elder"],
      text:
        "守祠人把灰桶拎到门边，停了一下。\n\n" +
        "「嗒——听见了。筒是空的才响。满的那天，就该换个大点的祠了。」\n\n" +
        "他说完就走了，没有问你写了什么。",
      choices: [
        { id: "back", label: "回到院里。", next: "zilan.courtyard" },
      ],
    },

    "zilan.old-letters": {
      id: "zilan.old-letters",
      title: "筒中的三封信",
      savepoint: false,
      text:
        "筒底躺着三封旧信，封口都开着。\n\n" +
        "第一封只有一个符号：「@」。\n\n" +
        "第二封写着：「他是官方」。\n\n" +
        "第三封没有落款，只有半句没写完的话：「回来吧」。",
      choices: [
        { id: "back", label: "把信放回原处。", next: "zilan.mailbox" },
      ],
    },

    "zilan.old-chair": {
      id: "zilan.old-chair",
      title: "少时旧椅",
      savepoint: true,
      activeActorIds: ["zilan_elder"],
      text:
        "门内侧一把旧木椅，椅背刻着四个字：「独坐椅上」。\n\n" +
        "椅背上方挂着一块小铭牌：「上一个签名不是我改的」。\n\n" +
        "你靠近时，椅子里像有一句很轻的话落下来：「苟富贵，无相忘。」",
      choices: [
        {
          id: "answer",
          label: "应一声。",
          next: "zilan.chair-answer",
          set: { "zilan.chair.answered": true },
          effects: [
            { type: "event.publish", eventType: "story.achievement", payload: { id: "zilan_promise", name: "苟富贵，无相忘" } },
          ],
        },
        { id: "silent", label: "不应。", next: "zilan.chair-silent" },
        { id: "note", label: "看椅背上方的铭牌。", next: "zilan.chair-note" },
        { id: "back", label: "先站起来。", next: "zilan.courtyard" },
      ],
    },

    "zilan.chair-answer": {
      id: "zilan.chair-answer",
      title: "灯亮一盏",
      savepoint: false,
      activeActorIds: ["zilan_elder"],
      text:
        "你应了一声。\n\n" +
        "祠内某一处亮起一盏小灯。灯不大，却把旧椅的扶手照出来一道浅浅的亮边。\n\n" +
        "守祠人在门外说：「应了就好。灯没有上限，谁也数不完。」",
      choices: [
        { id: "to-decision", label: "起身，去做去留的决定。", next: "zilan.decision" },
        { id: "back", label: "再坐一会儿。", next: "zilan.courtyard" },
      ],
    },

    "zilan.chair-silent": {
      id: "zilan.chair-silent",
      title: "吱呀",
      savepoint: false,
      text:
        "你没有应声。\n\n" +
        "椅子轻轻「吱呀」了一下，像是在替你回答。\n\n" +
        "没有惩罚，没有追问。那句耳语也没有再来第二遍。",
      choices: [
        { id: "back", label: "起身。", next: "zilan.courtyard" },
      ],
    },

    "zilan.chair-note": {
      id: "zilan.chair-note",
      title: "铭牌",
      savepoint: false,
      text:
        "小铭牌做得很旧，字却清楚：「上一个签名不是我改的」。\n\n" +
        "铭牌背面没有解释，也没有第二个名字。",
      choices: [
        { id: "back", label: "回到旧椅前。", next: "zilan.old-chair" },
      ],
    },

    "zilan.genealogy": {
      id: "zilan.genealogy",
      title: "镇记之宝",
      savepoint: true,
      activeActorIds: ["zilan_elder"],
      text:
        "侧墙书架两格。上格两件镇记之宝：《紫兰世家》摊开着，《从实验区到黑洞区》合着，书脊烫金一行小字：「重拾远古系列（爷青回！）（）」。\n\n" +
        "下格列着《目录》《果糖列传》《编辑见乙酸公》《物实慢》《菌群之死》《诗三首》《背水一战海实》《紫兰世家，但是翻译十遍》。全部钉死，抽不出来。\n\n" +
        "书架顶上钉着一块木牌：「没有时间线的，没有时间线，没有时间线！（」",
      choices: [
        { id: "second", label: "翻开《从实验区到黑洞区》。", next: "zilan.second-book" },
        { id: "series", label: "问太史这套书的来历。", next: "zilan.series" },
        { id: "owner", label: "问守祠人：被立传的人来过吗？", next: "zilan.owner-question" },
        { id: "back", label: "离开书架。", next: "zilan.courtyard" },
      ],
    },

    "zilan.second-book": {
      id: "zilan.second-book",
      title: "书页",
      savepoint: false,
      activeActorIds: ["zilan_elder"],
      text:
        "书页停在一段旧文上。写书的人把先生读书的样子记得很细：高而瘦、极方正、质朴、博学。\n\n" +
        "先生读到尽兴处，「将头仰起，摇着，向后面拗过去，拗过去」。\n\n" +
        "有人问他问题，他只喊一个词：「study！」。\n\n" +
        "读到这一页，书页间滑出一张夹页，上面是作者自题：「重拾远古系列（爷青回！）（）」。",
      choices: [
        {
          id: "close",
          label: "把夹页放回书里。",
          next: "zilan.courtyard",
          effects: [
            { type: "event.publish", eventType: "story.achievement", payload: { id: "zilan_oldfan", name: "爷青回！" } },
          ],
        },
      ],
    },

    "zilan.owner-question": {
      id: "zilan.owner-question",
      title: "守祠人",
      savepoint: true,
      activeActorIds: ["zilan_elder"],
      text:
        "守祠人的扫帚停了一下。\n\n" +
        "「……我在他每个门口都留过话。」\n\n" +
        "他望向祠里的旧椅，又低下头去。\n\n" +
        "「他来不来是他的事，我留不留是我的事。」",
      choices: [
        { id: "ask-historian", label: "去问太史，他读过没有。", next: "zilan.historian" },
        { id: "back", label: "不再追问。", next: "zilan.courtyard" },
      ],
    },

    "zilan.historian": {
      id: "zilan.historian",
      title: "太史",
      savepoint: true,
      activeActorIds: ["zilan_historian"],
      text:
        "小桌前坐着一个誊稿的人，头也不抬。\n\n" +
        "「要立传吗？应要求的那种。」\n\n" +
        "他把笔搁下，终于看了你一眼。",
      choices: [
        { id: "ask-series", label: "物实记是什么？", next: "zilan.series" },
        { id: "ask-owner", label: "紫兰世家写了真人，他本人看过吗？", next: "zilan.historian-owner" },
        { id: "commission", label: "给我也立一篇列传。", next: "zilan.commission" },
        { id: "back", label: "先不打扰。", next: "zilan.courtyard" },
      ],
    },

    "zilan.historian-owner": {
      id: "zilan.historian-owner",
      title: "太史",
      savepoint: false,
      activeActorIds: ["zilan_historian"],
      text:
        "笔停了一下。\n\n" +
        "「……你问我我问谁（。他们 @ 了他，我喊完了闹大了，后来——后来就是后来。」\n\n" +
        "他低头继续写，写了两笔又停住。\n\n" +
        "「碑都立了，你说他看没看过。」",
      choices: [
        { id: "back", label: "回到桌前。", next: "zilan.historian" },
      ],
    },

    "zilan.series": {
      id: "zilan.series",
      title: "物实记",
      savepoint: false,
      activeActorIds: ["zilan_historian"],
      text:
        "太史把稿纸抖平。\n\n" +
        "「物实记，即物理实验室的史记，被誉为史家之绝唱，无韵之《紫兰先生传》（」\n\n" +
        "他指了指书架顶上的木牌。「没有时间线的，没有时间线，没有时间线！（」\n\n" +
        "你问为什么说三遍。他抬了抬眉毛：「重要的事情才用说三遍。史书不用——史书只要有人肯翻开。」",
      choices: [
        { id: "commission", label: "那就给我立一篇。", next: "zilan.commission" },
        { id: "back", label: "回到桌前。", next: "zilan.historian" },
      ],
    },

    "zilan.commission": {
      id: "zilan.commission",
      title: "接单",
      savepoint: true,
      activeActorIds: ["zilan_historian"],
      text:
        "太史抽出一张新纸，压平。\n\n" +
        "「行。老规矩——你给我三件事，我给你三个句子。碑区的：那把椅子、那道闩、那张图、那些脚印、邮筒、碑，随便挑。」\n\n" +
        "他把笔尖蘸饱墨，等你报出三样。",
      choices: [
        {
          id: "pick-chair-door-map",
          label: "旧椅、门闩、五城战图。",
          next: "zilan.commission-done",
          set: { "zilan.commission.done": true },
          effects: [
            { type: "event.publish", eventType: "story.achievement", payload: { id: "zilan_biography", name: "应要求立传" } },
          ],
        },
        {
          id: "pick-feet-mail-stele",
          label: "铜脚印、鱼腹邮筒、十周年碑。",
          next: "zilan.commission-done",
          set: { "zilan.commission.done": true },
          effects: [
            { type: "event.publish", eventType: "story.achievement", payload: { id: "zilan_biography", name: "应要求立传" } },
          ],
        },
        {
          id: "pick-chair-mail-map",
          label: "旧椅、邮筒、五城战图。",
          next: "zilan.commission-done",
          set: { "zilan.commission.done": true },
          effects: [
            { type: "event.publish", eventType: "story.achievement", payload: { id: "zilan_biography", name: "应要求立传" } },
          ],
        },
      ],
    },

    "zilan.commission-done": {
      id: "zilan.commission-done",
      title: "玩家列传",
      savepoint: true,
      activeActorIds: ["zilan_historian"],
      text:
        "研墨，翻纸，三声笔落。\n\n" +
        "太史把写好的纸递出来。三段文言，句式都旧，名字和事情都是你的。\n\n" +
        "「好了。——句式是老的，字是你的。」\n\n" +
        "纸角盖着一个小小的印记，没有编号。",
      choices: [
        { id: "back", label: "收好列传，回到院里。", next: "zilan.courtyard" },
        { id: "to-historian", label: "再和太史说两句。", next: "zilan.historian" },
      ],
    },

    "zilan.footprints": {
      id: "zilan.footprints",
      title: "五枚铜脚印",
      savepoint: true,
      activeActorIds: ["zilan_elder"],
      text:
        "地面嵌着五枚铜脚印，每一枚旁边刻着日期和一句话。\n\n" +
        "10-07：「烤咕~」\n" +
        "10-11：「？？？」\n" +
        "10-11：「烤咕！！！！！！！！！」\n" +
        "10-13：「有人吗？？？？？」\n" +
        "10-18：「491」\n\n" +
        "第五枚只刻数字，没有注释。",
      choices: [
        {
          id: "walk-all",
          label: "把五枚脚印都踩一遍。",
          next: "zilan.courtyard",
          set: { "zilan.footprints.all": true },
          effects: [
            { type: "event.publish", eventType: "story.achievement", payload: { id: "zilan_footprints", name: "有人吗？？？？？" } },
          ],
        },
        { id: "fifth", label: "只踩第五枚。", next: "zilan.courtyard" },
        { id: "back", label: "退回院中。", next: "zilan.courtyard" },
      ],
    },

    "zilan.city-map": {
      id: "zilan.city-map",
      title: "五城战图",
      savepoint: false,
      activeActorIds: ["zilan_elder"],
      text:
        "影壁侧面挂着一张小巷图。五座小城门沿线排开，门楣各刻一字：物、理、实、验、室。\n\n" +
        "尽头还有第六座城，只刻一个字：陈。\n\n" +
        "图角小字：「攻物、理、实、验、室，皆下之。——城的名字连起来，是城的名字。」",
      choices: [
        { id: "back", label: "离开战图。", next: "zilan.courtyard" },
      ],
    },

    "zilan.fox-night": {
      id: "zilan.fox-night",
      title: "篝火与狐鸣",
      savepoint: true,
      activeActorIds: ["zilan_fox"],
      text:
        "天黑以后，院角的篝火燃起来。\n\n" +
        "一道狐影绕祠三圈，每圈喊一声：「物实兴，紫兰王」。\n\n" +
        "如果起了雾，它的喊法会变，连括号一起喊出来：「物实兴，紫大亡 (大雾」。",
      choices: [
        { id: "normal", label: "听夜里的狐鸣。", next: "zilan.courtyard" },
        {
          id: "fog",
          label: "站在雾里，听它喊错版。",
          next: "zilan.courtyard",
          set: { "zilan.fog.heard": true },
          effects: [
            { type: "event.publish", eventType: "story.achievement", payload: { id: "zilan_fog", name: "大雾" } },
          ],
        },
        { id: "back", label: "回祠里去。", next: "zilan.courtyard" },
      ],
    },

    "zilan.decision": {
      id: "zilan.decision",
      title: "去留",
      role: "支线 · 抉择",
      savepoint: true,
      guide: { title: "紫兰世家", objective: "决定留下守祠，还是带着这段文字离开" },
      activeActorIds: ["zilan_elder"],
      text:
        "你在祠里站了很久。影壁上的字已经读完，旧椅的耳语已经听过，邮筒也响过一声。\n\n" +
        "守祠人把扫帚重新拿起来，没有催你。\n\n" +
        "「门在这边，什么时候开都行。」他说。「走，或者留，都算数。」",
      choices: [
        { id: "stay", label: "留下，接过这把扫帚。", next: "zilan.ending-keeper" },
        { id: "leave-recite", label: "离开，把这段文字记住。", next: "zilan.ending-recite" },
        { id: "leave-lamp", label: "离开，但让那盏灯一直亮着。", next: "zilan.ending-lamp" },
        { id: "come-back", label: "现在离开，明年今日再回来。", next: "zilan.ending-revisit" },
        { id: "back", label: "还没想好，再走走。", next: "zilan.courtyard" },
      ],
    },

    "zilan.ending-keeper": {
      id: "zilan.ending-keeper",
      title: "紫兰世家",
      role: "结局 · 守祠",
      savepoint: true,
      presentation: "blackout",
      terminal: true,
      guide: null,
      activeActorIds: ["zilan_elder"],
      text:
        "你接过扫帚。守祠人没有客气，只把灰桶也推到你脚边。\n\n" +
        "「档案馆 2027 年 3 月 1 日完工，之后要筹资、要招人——现在这些，都是没工资的活儿。」他拍了拍手上的灰。\n\n" +
        "「工资的事完工再谈，祠的事今天就得扫。」\n\n" +
        "他往门外走，走到门口又回头：「门找到了？——从这边开的，都这么说。」\n\n" +
        "从今天起，这句话由你来说。",
    },

    "zilan.ending-recite": {
      id: "zilan.ending-recite",
      title: "紫兰世家",
      role: "结局 · 会背",
      savepoint: true,
      presentation: "blackout",
      terminal: true,
      guide: null,
      text:
        "你从祠侧抬闩出门，绕回碑前。\n\n" +
        "碑面还是那行「点击可查看」。这一次，你没有再推。\n\n" +
        "754 个字留在你脑子里，像一段早就背过的课文，只换了几个名字。\n\n" +
        "历史不等答案，历史等会背的人。",
    },

    "zilan.ending-lamp": {
      id: "zilan.ending-lamp",
      title: "紫兰世家",
      role: "结局 · 灯",
      savepoint: true,
      presentation: "blackout",
      terminal: true,
      guide: null,
      text:
        "你走出丛祠，门没有关严，留了一道缝。\n\n" +
        "祠里那盏因你应声而亮的灯还亮着。灯很小，从门缝里看，只像一粒没有睡着的火星。\n\n" +
        "他看没看过，没有人知道。但你读完了，灯亮了一盏。\n\n" +
        "灯没有上限，谁也数不完。",
    },

    "zilan.ending-revisit": {
      id: "zilan.ending-revisit",
      title: "紫兰世家",
      role: "结局 · 回访",
      savepoint: true,
      presentation: "blackout",
      terminal: true,
      guide: null,
      text:
        "你回到碑前，记下了一个日子。\n\n" +
        "明年 7 月 2 日，12:49，影壁会从第一段起逐段亮起；20:14 到 20:35，注疏墙会按原来的分钟一块一块回声；20:35:00，祠区起雾十分钟，狐影会喊那声错版。\n\n" +
        "守祠人站在门边，没有留你。\n\n" +
        "「明年今日，门还是从这边开。」",
    },
  },
};
