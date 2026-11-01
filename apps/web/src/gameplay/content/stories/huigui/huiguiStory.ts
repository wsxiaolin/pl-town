import type { StoryDefinition } from "../../../stories/types";

export const HUIGUI_STORY: StoryDefinition = {
  schemaVersion: 1,
  definitionVersion: 1,
  id: "side.huigui.hostel",
  title: "会归寮",
  startNode: "huigui.enter",
  entryActorId: "huigui_keeper",

  interactions: [
    { actorId: "huigui_keeper", nodeId: "huigui.enter", choiceId: "push-door" },
  ],

  buildingInteractions: [
    { buildingId: "huigui_hostel", nodeId: "huigui.enter", choiceId: "push-door" },
  ],

  nodes: {
    /* ── 门 ── */

    "huigui.enter": {
      id: "huigui.enter",
      title: "会归寮",
      role: "序 · 门",
      savepoint: true,
      guide: { title: "会归寮", objective: "走进巷尾那间半透明的茶寮" },
      text: "巷尾有一间不大的茶寮。离得远时，整间屋子像蒙着一层水汽，半透明；走近了，墙、屋檐、门柱才一点点实起来。\n\n门楣上不挂匾，挂着一封信。信封抬头写着：死人微活，四处游荡。\n\n门柱上刻着两个字，笔迹不同。上面一个「喵」，下面一个「咕咕」。门边的小木牌只写了一行：本寮只收人话。",
      choices: [
        { id: "push-door", label: "推门进去。", next: "huigui.greeting" },
        { id: "read-letter", label: "先看看门楣上那封信。", next: "huigui.door-letter" },
      ],
    },
    "huigui.door-letter": {
      id: "huigui.door-letter",
      title: "会归寮",
      savepoint: false,
      text: "信封没有封口。抬头是店名全称，末尾一行小字：\n\n（虽然没人在意）\n\n信纸边缘被火燎过一点，字却还清楚。",
      choices: [
        { id: "look-post", label: "看门柱上的刻字。", next: "huigui.doorpost" },
        { id: "enter-from-letter", label: "推门进去。", next: "huigui.greeting" },
      ],
    },
    "huigui.doorpost": {
      id: "huigui.doorpost",
      title: "会归寮",
      savepoint: false,
      text: "「喵」刻得深，像是用了很久才刻完。「咕咕」在旁边，浅浅的，只有两笔。\n\n像是有人应了一声。",
      choices: [
        { id: "enter-from-post", label: "推门进去。", next: "huigui.greeting" },
      ],
    },
    "huigui.greeting": {
      id: "huigui.greeting",
      title: "冥羽",
      role: "守炉人",
      savepoint: true,
      activeActorIds: ["huigui_keeper"],
      text: "柜台后站着一个系围裙的人，正低着头擦杯子。听见门响，他也没抬眼。\n\n「（擦杯子的手没停）生客。坐。想喝什么先想好——这儿不收钱，收话。一句话一杯，说什么都行，说错了也行。」",
      choices: [
        { id: "sit-down", label: "坐下。", next: "huigui.hub" },
      ],
    },
    "huigui.hub": {
      id: "huigui.hub",
      title: "冥羽",
      savepoint: true,
      guide: { title: "会归寮", objective: "在寮里坐一会儿，听冥羽讲这里的事" },
      activeActorIds: ["huigui_keeper"],
      text: "柜台后的人终于把杯子放下。壶里的水响了一声，像在催人开口。\n\n「想问什么，问吧。」",
      choices: [
        { id: "ask-rules", label: "这店叫什么？", next: "huigui.rules" },
        { id: "ask-pot", label: "这只壶……为什么这么大？", next: "huigui.pot" },
        { id: "ask-coats", label: "墙上的外套是谁的？", next: "huigui.coats" },
        { id: "ask-seats", label: "火边那圈位子是给谁的？", next: "huigui.seats" },
        {
          id: "ask-keeper",
          label: "店主去哪了？",
          next: "huigui.keeper",
          availableWhen: [{ type: "event.occurred", eventType: "huigui.coat.viewed", atLeast: 3 }],
        },
        { id: "ask-night", label: "夜里再来坐坐。", next: "huigui.night" },
        { id: "look-door", label: "门口忽然跑进来一个人。", next: "huigui.newsboy" },
        { id: "come-again", label: "（又推门进来。）", next: "huigui.ending-return" },
        { id: "leave", label: "该走了。", next: "huigui.ending-leave" },
      ],
    },

    /* ── 规矩 ── */

    "huigui.rules": {
      id: "huigui.rules",
      title: "冥羽",
      role: "常驻 · 规矩",
      savepoint: false,
      activeActorIds: ["huigui_keeper"],
      text: "「会归寮。」\n\n他用抹布把柜台擦出一道亮痕，没有抬头。",
      choices: [
        { id: "rules-which", label: "哪个会归？", next: "huigui.rules-what" },
        { id: "rules-nobody", label: "「虽然没人在意」是什么意思？", next: "huigui.rules-nobody" },
        { id: "rules-back", label: "回去。", next: "huigui.hub" },
      ],
    },
    "huigui.rules-what": {
      id: "huigui.rules-what",
      title: "冥羽",
      savepoint: false,
      activeActorIds: ["huigui_keeper"],
      text: "「回来那个会归。」\n\n他用下巴指指门楣的信。\n\n「喏，店名全称在那儿——死人微活，四处游荡。店主起的。他说这话的时候，屋里就他一个人。」",
      choices: [
        { id: "what-nobody", label: "「虽然没人在意」是什么意思？", next: "huigui.rules-nobody" },
        { id: "what-back", label: "回去。", next: "huigui.hub" },
      ],
    },
    "huigui.rules-nobody": {
      id: "huigui.rules-nobody",
      title: "冥羽",
      savepoint: false,
      activeActorIds: ["huigui_keeper"],
      text: "「信末那行小字？原话。」\n\n他往壶里添了一撮茶。\n\n「他写这行的时候，是真信的。后来的事你也看见了——这屋里攒了两万多句话。所以那行字现在算什么，你自己品。」",
      choices: [
        { id: "nobody-money", label: "为什么不收钱？", next: "huigui.rules-money" },
        { id: "nobody-back", label: "回去。", next: "huigui.hub" },
      ],
    },
    "huigui.rules-money": {
      id: "huigui.rules-money",
      title: "冥羽",
      savepoint: false,
      activeActorIds: ["huigui_keeper"],
      text: "「规矩就一条，门边木牌上写着——本寮只收人话。钱这儿没处花，星这儿也不挂。想谢这间屋子，坐下说句话就行。桀桀，比什么都实在。」",
      choices: [
        { id: "money-human", label: "「只收人话」……那我说的算人话吗？", next: "huigui.rules-human" },
        { id: "money-back", label: "回去。", next: "huigui.hub" },
      ],
    },
    "huigui.rules-human": {
      id: "huigui.rules-human",
      title: "冥羽",
      savepoint: false,
      activeActorIds: ["huigui_keeper"],
      text: "他第一次停下手。\n\n「……算。」\n\n「从前有人在这儿发过不少假话，后来他自己当着全屋认了，认得干干净净。打那以后这屋就有了这条规矩——不是不许假话，是只认人话。你说的这句，我听着算。」",
      choices: [
        {
          id: "human-back",
          label: "把杯子往他那边推了推。",
          next: "huigui.hub",
          set: { "huigui.spoke": true },
          effects: [{ type: "event.publish", eventType: "story.achievement", payload: { id: "huigui_first_word", name: "说人话" } }],
        },
      ],
    },

    /* ── 壶与茶 ── */

    "huigui.pot": {
      id: "huigui.pot",
      title: "冥羽",
      role: "常驻 · 攒话壶",
      savepoint: false,
      activeActorIds: ["huigui_keeper"],
      text: "「话多，壶就得大。」\n\n他拍拍壶身。\n\n「这里头的茶，三年没换过。新叶旧叶全攒着，一句一片叶子，一句都不倒。行家管这叫洗茶——我们这儿管这叫攒话。\n\n两万零五百五十五句起步，你进来之前刚数的。」",
      choices: [
        { id: "pot-stale", label: "壶里那么多年的旧茶叶，不会坏吗？", next: "huigui.pot-stale" },
        { id: "pot-tea", label: "点一杯茶。", next: "huigui.tea" },
        { id: "pot-back", label: "回去。", next: "huigui.hub" },
      ],
    },
    "huigui.pot-stale": {
      id: "huigui.pot-stale",
      title: "冥羽",
      savepoint: false,
      activeActorIds: ["huigui_keeper"],
      text: "「话不会坏。」\n\n他想了想。\n\n「苦是越来越苦了。所以夜里有换甜茶的规矩——等会儿你要是待到那时候就懂了。」",
      choices: [
        { id: "stale-tea", label: "点一杯茶。", next: "huigui.tea" },
        { id: "stale-back", label: "回去。", next: "huigui.hub" },
      ],
    },
    "huigui.tea": {
      id: "huigui.tea",
      title: "冥羽",
      savepoint: false,
      activeActorIds: ["huigui_keeper"],
      text: "冥羽从柜台下取出一只粗陶杯，舀了一勺壶里的茶。茶汤颜色很深，杯口浮着两片旧叶。\n\n「喝完别急着走。杯底会留句话。」",
      choices: [
        {
          id: "drink-tea",
          label: "把茶喝完。",
          next: "huigui.tea-leaf",
          set: { "huigui.teaRead": true },
          effects: [{ type: "event.publish", eventType: "story.achievement", payload: { id: "huigui_tea_reading", name: "杯底考古" } }],
        },
      ],
    },
    "huigui.tea-leaf": {
      id: "huigui.tea-leaf",
      title: "冥羽",
      savepoint: false,
      activeActorIds: ["huigui_keeper"],
      text: "杯底剩下一圈茶梗，摆成一行字：\n\n有没有人能出来陪我聊聊天啊\n\n冥羽把杯子转了半圈。\n\n「说这话那晚，屋里没人。第二天有人来了。你看，话不能白说。」",
      choices: [
        { id: "leaf-back", label: "把杯子放下。", next: "huigui.hub" },
      ],
    },

    /* ── 衣帽架 ── */

    "huigui.coats": {
      id: "huigui.coats",
      title: "冥羽",
      role: "常驻 · 衣帽架",
      savepoint: false,
      activeActorIds: ["huigui_keeper"],
      text: "「老客们的。名字都换过好几轮，人还是那些人。外套留着，牌子上写着那时候的签名——你自己看，能试穿，别试坏了。」\n\n墙边立着衣帽架，挂钩上挂着旧外套。每一件领口都拴着一枚行李牌。",
      choices: [
        { id: "coat-empty", label: "第一件：空着的挂钩。", next: "huigui.coat-empty" },
        { id: "coat-confession", label: "第二件：写着鲁迅那句话的外套。", next: "huigui.coat-confession" },
        { id: "coat-ljsong", label: "第三件：穿得最久的那件。", next: "huigui.coat-ljsong" },
        { id: "coat-song", label: "第四件：自我介绍写得很长的那件。", next: "huigui.coat-song" },
        { id: "coat-an", label: "第五件：吊牌上写着水母的那件。", next: "huigui.coat-an" },
        { id: "coats-deeper", label: "往里看。", next: "huigui.coats-back" },
        {
          id: "shrine-hint",
          label: "（看够了几件外套）问冥羽门楣下的小字。",
          next: "huigui.shrine-intro",
          availableWhen: [{ type: "event.occurred", eventType: "huigui.coat.viewed", atLeast: 3 }],
        },
        { id: "coats-back", label: "回去。", next: "huigui.hub" },
      ],
    },
    "huigui.coat-empty": {
      id: "huigui.coat-empty",
      title: "冥羽",
      savepoint: false,
      activeActorIds: ["huigui_keeper"],
      text: "第一个挂钩空着，钩子上只剩一圈浅印。\n\n「第一件。取走了——去年春天的一个晚上，壶哨响过之后，钩子就空了。（看一眼壶嘴）名字也取回去了，他现在又用这个名。」",
      choices: [
        { id: "empty-look", label: "伸手碰一下空钩子。", next: "huigui.coats", effects: [{ type: "event.publish", eventType: "huigui.coat.viewed" }] },
        { id: "empty-back", label: "退后。", next: "huigui.coats", effects: [{ type: "event.publish", eventType: "huigui.coat.viewed" }] },
      ],
    },
    "huigui.coat-confession": {
      id: "huigui.coat-confession",
      title: "冥羽",
      savepoint: false,
      activeActorIds: ["huigui_keeper"],
      text: "行李牌上写着一行字：狮子似的凶心，兔子的怯弱，狐狸的狡猾。是鲁迅的句子。\n\n「道歉那几天的外套。牌子上那句是鲁迅。穿这个的人，兜里揣着一封写好的认错信。」",
      choices: [
        {
          id: "try-confession",
          label: "试穿这件。",
          next: "huigui.coats",
          effects: [
            { type: "event.publish", eventType: "huigui.coat.viewed" },
            { type: "event.publish", eventType: "story.achievement", payload: { id: "huigui_first_coat", name: "第一件外套" } },
          ],
        },
        { id: "look-confession", label: "只看看。", next: "huigui.coats", effects: [{ type: "event.publish", eventType: "huigui.coat.viewed" }] },
      ],
    },
    "huigui.coat-ljsong": {
      id: "huigui.coat-ljsong",
      title: "冥羽",
      savepoint: false,
      activeActorIds: ["huigui_keeper"],
      text: "行李牌上写着：限时返场。\n\n「穿得最久的一件。中途有阵子牌子上写的是『emo~ing（悲观厌世）』，后来又换成『爱宝宝，想宝宝，亲宝宝』——嗯，人高兴起来，牌子先知道。」",
      choices: [
        {
          id: "try-ljsong",
          label: "试穿这件。",
          next: "huigui.coats",
          effects: [
            { type: "event.publish", eventType: "huigui.coat.viewed" },
            { type: "event.publish", eventType: "story.achievement", payload: { id: "huigui_first_coat", name: "第一件外套" } },
          ],
        },
        { id: "look-ljsong", label: "只看看。", next: "huigui.coats", effects: [{ type: "event.publish", eventType: "huigui.coat.viewed" }] },
      ],
    },
    "huigui.coat-song": {
      id: "huigui.coat-song",
      title: "冥羽",
      savepoint: false,
      activeActorIds: ["huigui_keeper"],
      text: "行李牌上是一行自我介绍：本人双子座，跳跃性思维，见谅T_T……\n\n「最后一件有主的。牌子上那行是自我介绍，也算提前道歉——跳跃性思维，见谅。\n\n之后有人说，会有新客人来接这间屋子。（他擦了最后一个杯子）我等着。桀桀。」",
      choices: [
        {
          id: "try-song",
          label: "试穿这件。",
          next: "huigui.coats",
          effects: [
            { type: "event.publish", eventType: "huigui.coat.viewed" },
            { type: "event.publish", eventType: "story.achievement", payload: { id: "huigui_first_coat", name: "第一件外套" } },
          ],
        },
        { id: "look-song", label: "只看看。", next: "huigui.coats", effects: [{ type: "event.publish", eventType: "huigui.coat.viewed" }] },
      ],
    },
    "huigui.coat-an": {
      id: "huigui.coat-an",
      title: "冥羽",
      savepoint: false,
      activeActorIds: ["huigui_keeper"],
      text: "行李牌上写着一个问了很久的问题：水母真的没有脑子吗……\n\n「老客的。她现在叫小安喵，在老城另一头开鸽咖。牌子上这问题，问了很多年没人答，她也换名字了——算自己答了。」",
      choices: [
        {
          id: "try-an",
          label: "试穿这件。",
          next: "huigui.coats",
          effects: [
            { type: "event.publish", eventType: "huigui.coat.viewed" },
            { type: "event.publish", eventType: "story.achievement", payload: { id: "huigui_first_coat", name: "第一件外套" } },
          ],
        },
        { id: "look-an", label: "只看看。", next: "huigui.coats", effects: [{ type: "event.publish", eventType: "huigui.coat.viewed" }] },
      ],
    },
    "huigui.coats-back": {
      id: "huigui.coats-back",
      title: "冥羽",
      savepoint: false,
      activeActorIds: ["huigui_keeper"],
      text: "衣帽架更里面还挂着几件，背光，牌上的字得凑近才能看清。",
      choices: [
        { id: "coat-heibai", label: "第六件：写着「我妻由乃天下第一」的那件。", next: "huigui.coat-heibai" },
        { id: "coat-mingyu", label: "第七件：最旧的那件。", next: "huigui.coat-mingyu" },
        { id: "coat-xushi", label: "第八件：挂在最背光处的那件。", next: "huigui.coat-xushi" },
        { id: "coat-torn", label: "第九件：行李牌被撕掉的那件。", next: "huigui.coat-torn" },
        { id: "back-to-coats", label: "回外面看。", next: "huigui.coats" },
      ],
    },
    "huigui.coat-heibai": {
      id: "huigui.coat-heibai",
      title: "冥羽",
      savepoint: false,
      activeActorIds: ["huigui_keeper"],
      text: "行李牌上写着：我妻由乃天下第一。\n\n「老客的。现在是黑白羽歌，杂鱼大厦那位王。门柱上那声『咕咕』就是他刻的——店主喊喵，他应咕，一个字对一个字，谁也不多说话。」",
      choices: [
        {
          id: "try-heibai",
          label: "试穿这件。",
          next: "huigui.coats",
          effects: [
            { type: "event.publish", eventType: "huigui.coat.viewed" },
            { type: "event.publish", eventType: "story.achievement", payload: { id: "huigui_first_coat", name: "第一件外套" } },
          ],
        },
        { id: "look-heibai", label: "只看看。", next: "huigui.coats", effects: [{ type: "event.publish", eventType: "huigui.coat.viewed" }] },
      ],
    },
    "huigui.coat-mingyu": {
      id: "huigui.coat-mingyu",
      title: "冥羽",
      savepoint: false,
      activeActorIds: ["huigui_keeper"],
      text: "行李牌上写着：天下为公，吾死易足。\n\n「……我的。」\n\n他把自己的外套抻平。\n\n「以前叫绘影，现在叫冥羽。复活了，桀桀。这屋里换过名字的人，不止店主一个——所以我们谁也不笑话谁。」",
      choices: [
        {
          id: "try-mingyu",
          label: "试穿这件。",
          next: "huigui.coats",
          effects: [
            { type: "event.publish", eventType: "huigui.coat.viewed" },
            { type: "event.publish", eventType: "story.achievement", payload: { id: "huigui_first_coat", name: "第一件外套" } },
          ],
        },
        { id: "look-mingyu", label: "只看看。", next: "huigui.coats", effects: [{ type: "event.publish", eventType: "huigui.coat.viewed" }] },
      ],
    },
    "huigui.coat-xushi": {
      id: "huigui.coat-xushi",
      title: "冥羽",
      savepoint: false,
      activeActorIds: ["huigui_keeper"],
      text: "行李牌上写着：当我们蜕下虚饰，一切都是黑暗。\n\n「守炉席的。人如其牌——所以我把他挂在最背光的钩子上，他喜欢。」",
      choices: [
        {
          id: "try-xushi",
          label: "试穿这件。",
          next: "huigui.coats",
          effects: [
            { type: "event.publish", eventType: "huigui.coat.viewed" },
            { type: "event.publish", eventType: "story.achievement", payload: { id: "huigui_first_coat", name: "第一件外套" } },
          ],
        },
        { id: "look-xushi", label: "只看看。", next: "huigui.coats", effects: [{ type: "event.publish", eventType: "huigui.coat.viewed" }] },
      ],
    },
    "huigui.coat-torn": {
      id: "huigui.coat-torn",
      title: "冥羽",
      savepoint: false,
      activeActorIds: ["huigui_keeper"],
      text: "最后一件外套的行李牌上什么也没有。牌角留着撕过的毛边。\n\n「最后一件，牌子上原来有一行字，被撕了。（摇头）撕得好。有些告别方式不值得留原文——人可以走，别把自己钉在墙上。」",
      choices: [
        { id: "torn-look", label: "看看撕掉的行李牌。", next: "huigui.coats", effects: [{ type: "event.publish", eventType: "huigui.coat.viewed" }] },
        { id: "torn-back", label: "退后。", next: "huigui.coats", effects: [{ type: "event.publish", eventType: "huigui.coat.viewed" }] },
      ],
    },

    /* ── 守炉席 ── */

    "huigui.seats": {
      id: "huigui.seats",
      title: "冥羽",
      role: "常驻 · 守炉席",
      savepoint: false,
      activeActorIds: ["huigui_keeper"],
      text: "火边围着一圈旧椅子，一共八张。每张椅背钉着一块小木牌。\n\n「守炉的。八张，一人一张，牌子上刻着名号：绘影、桃花水母、梦转千回ヅ、虚饰、屑鸽子再临、期待四月、日月星辰是果糖furry~、SUNᝰ焱灵｜注梦｜。前三张的牌子改过字——人换了名，位子还是那张位子。」\n\n火边坐着几道半透明的人影，像旧照片里的客人。他们不点单，也不说话，只在有人开口时抬一下头。\n\n「有的在等一句回话。有的只是习惯了这张椅子。」",
      choices: [
        { id: "seat-april", label: "「期待四月」的牌子为什么写着括号？", next: "huigui.seats-april" },
        { id: "seats-back", label: "回去。", next: "huigui.hub" },
      ],
    },
    "huigui.seats-april": {
      id: "huigui.seats-april",
      title: "冥羽",
      savepoint: false,
      activeActorIds: ["huigui_keeper"],
      text: "「他自己要求的。别人挂头衔挂成就，他就挂这么个括号。\n\n有回我问他为啥，他说：等哪天不是了，就取下来。（顿）结果一直没取。」",
      choices: [
        { id: "april-back", label: "回去。", next: "huigui.hub" },
      ],
    },

    /* ── 店主 ── */

    "huigui.keeper": {
      id: "huigui.keeper",
      title: "冥羽",
      role: "常驻 · 店主",
      savepoint: true,
      activeActorIds: ["huigui_keeper"],
      text: "擦杯子的手停了。\n\n「坐。这杯我请，不算你的话。」\n\n他倒了一杯茶，推过来。\n\n「先说好，我讲不全。我在的时候没那么多，我不在的时候更没那么多。」",
      choices: [
        { id: "keeper-person", label: "他是个什么样的人？", next: "huigui.keeper-person" },
        { id: "keeper-later", label: "后来呢？", next: "huigui.keeper-later" },
        { id: "keeper-return", label: "那他……还回来吗？", next: "huigui.keeper-return" },
        { id: "keeper-care", label: "那到底有没有人在意？", next: "huigui.keeper-care" },
        { id: "keeper-back", label: "先不问了。", next: "huigui.hub" },
      ],
    },
    "huigui.keeper-person": {
      id: "huigui.keeper-person",
      title: "冥羽",
      savepoint: false,
      activeActorIds: ["huigui_keeper"],
      text: "「物理从没及格过。」\n\n见你看着他，他又补了一句。\n\n「真的，满分七十，他没上过二十。为了一枚老用户头衔，一晚上爆肝二十个实验——不是爱物理，是想让这儿承认他待过。」\n\n他转头看壶。\n\n「结果你猜怎么着，这镇上话最多的房间，是他的。桀桀……灯亮不亮，跟懂不懂并联没关系。」",
      choices: [
        { id: "person-later", label: "后来呢？", next: "huigui.keeper-later" },
        { id: "person-return", label: "那他……还回来吗？", next: "huigui.keeper-return" },
        { id: "person-care", label: "那到底有没有人在意？", next: "huigui.keeper-care" },
        { id: "person-back", label: "先不问了。", next: "huigui.hub" },
      ],
    },
    "huigui.keeper-later": {
      id: "huigui.keeper-later",
      title: "冥羽",
      savepoint: false,
      activeActorIds: ["huigui_keeper"],
      text: "「后来累了。留了封信，就走了。」\n\n他的声音放轻。\n\n「信里只有两个词是真的——累了，舍不得。其他的，都撕了吧。」",
      choices: [
        { id: "later-return", label: "那他……还回来吗？", next: "huigui.keeper-return" },
        { id: "later-care", label: "那到底有没有人在意？", next: "huigui.keeper-care" },
        { id: "later-back", label: "先不问了。", next: "huigui.hub" },
      ],
    },
    "huigui.keeper-return": {
      id: "huigui.keeper-return",
      title: "冥羽",
      savepoint: false,
      activeActorIds: ["huigui_keeper"],
      text: "他指指空挂钩，又指指门柱。\n\n「第一件外套没了。门柱上有他一个字。去年春天一个晚上，壶哨响了一声，之后钩子就空了。」\n\n他收回手。\n\n「会归。他说过的——四处游荡的幽魂，会归。虽然没人在意。」",
      choices: [
        { id: "return-care", label: "那到底有没有人在意？", next: "huigui.keeper-care" },
        { id: "return-back", label: "先不问了。", next: "huigui.hub" },
      ],
    },
    "huigui.keeper-care": {
      id: "huigui.keeper-care",
      title: "冥羽",
      savepoint: false,
      activeActorIds: ["huigui_keeper"],
      text: "他第一次笑了，没有出声。\n\n「你数数壶上的刻度。」\n\n壶身很旧，刻度却擦得干净。最下面那行数字后面，还留着几道新刻的小痕。\n\n「总得有人看火。名字换过的人，不该连一盏灯都没有。」",
      choices: [
        { id: "care-back", label: "回去。", next: "huigui.hub" },
      ],
    },

    /* ── 夜话 ── */

    "huigui.night": {
      id: "huigui.night",
      title: "冥羽",
      role: "事件 · 夜话",
      savepoint: false,
      activeActorIds: ["huigui_keeper"],
      text: "夜里的寮灯调暗了。门边五盏灯芯次第亮起，火苗很小，却很稳。\n\n冥羽端来一杯茶，放在你面前。\n\n「夜里的话不要钱。先喝这个。」",
      choices: [
        { id: "night-drink", label: "把苦茶喝完。", next: "huigui.night-bitter" },
      ],
    },
    "huigui.night-bitter": {
      id: "huigui.night-bitter",
      title: "冥羽",
      savepoint: false,
      activeActorIds: ["huigui_keeper"],
      text: "茶很苦，苦到舌根发麻。\n\n冥羽收走空杯，又换上一杯。新杯里冒着甜香。\n\n「苦的喝完，换甜的，不要钱，这是规矩。」",
      choices: [
        {
          id: "bitter-sweet",
          label: "接过甜茶。",
          next: "huigui.night-sweet",
          set: { "huigui.nightTea": true },
          effects: [{ type: "event.publish", eventType: "story.achievement", payload: { id: "huigui_night_tea", name: "夜里那盏灯" } }],
        },
      ],
    },
    "huigui.night-sweet": {
      id: "huigui.night-sweet",
      title: "冥羽",
      savepoint: false,
      activeActorIds: ["huigui_keeper"],
      text: "甜茶下肚，方才的苦味慢慢退到后面。\n\n「规矩是谁定的？」你问。\n\n冥羽把甜茶往前推了推。",
      choices: [
        {
          id: "sweet-ask",
          label: "规矩是谁定的？",
          next: "huigui.night-rule",
        },
        { id: "sweet-back", label: "安静坐一会儿。", next: "huigui.hub" },
      ],
    },
    "huigui.night-rule": {
      id: "huigui.night-rule",
      title: "冥羽",
      savepoint: false,
      activeActorIds: ["huigui_keeper"],
      text: "「从前有个晚上，有人在这儿坐了很久，没说话。后来有四五个人半夜推门进来，陪他喝了一整夜。\n\n第二天就有了这规矩。别问了——问那么多，苦的都白喝了。」\n\n你问，如果他哪天夜里又来了呢。\n\n他看一眼门边的五盏灯芯。\n\n「灯芯一直备着。五盏。这是这间屋子唯一不敢省的东西。」",
      choices: [
        { id: "rule-back", label: "把甜茶喝完。", next: "huigui.hub" },
      ],
    },

    /* ── 报童 ── */

    "huigui.newsboy": {
      id: "huigui.newsboy",
      title: "报童",
      role: "事件 · 号外",
      savepoint: false,
      activeActorIds: ["huigui_keeper"],
      text: "一个背着帆布包的孩子跑进来，气喘吁吁。\n\n「号外——！会归寮的城热第一，被挤下来啦——！」\n\n冥羽头也不抬。\n\n「知道了。（对你）规矩：给他倒杯茶。」",
      choices: [
        { id: "news-why", label: "为什么？", next: "huigui.newsboy-why" },
        { id: "news-pour", label: "给报童倒一杯茶。", next: "huigui.newsboy-give" },
      ],
    },
    "huigui.newsboy-why": {
      id: "huigui.newsboy-why",
      title: "冥羽",
      savepoint: false,
      activeActorIds: ["huigui_keeper"],
      text: "「有人特地跑来告诉你，你不再是第一了——这说明，他还记得你当过第一。这消息比锦旗值钱。倒茶。」",
      choices: [
        { id: "why-pour", label: "给报童倒一杯茶。", next: "huigui.newsboy-give" },
      ],
    },
    "huigui.newsboy-give": {
      id: "huigui.newsboy-give",
      title: "报童",
      savepoint: false,
      activeActorIds: ["huigui_keeper"],
      text: "孩子接过茶，一饮而尽。\n\n「谢啦！（抹嘴）下回要是又挤回去了，我还来！」\n\n他跑出门，脚步声很快消失在巷子里。\n\n冥羽收着杯子。\n\n「桀桀。那小子跑得比排名快。」",
      choices: [
        {
          id: "news-back",
          label: "回去。",
          next: "huigui.hub",
          set: { "huigui.newsboy": true },
          effects: [{ type: "event.publish", eventType: "story.achievement", payload: { id: "huigui_newsboy", name: "给报童倒茶" } }],
        },
      ],
    },

    /* ── 支线：继神兽咖之后 ── */

    "huigui.shrine-intro": {
      id: "huigui.shrine-intro",
      title: "冥羽",
      role: "支线 · 继神兽咖之后",
      savepoint: true,
      activeActorIds: ["huigui_keeper"],
      text: "「门楣那封信底下，还有行小字——『继神兽咖之后』。」\n\n他把一只小铜勺放在柜台上。\n\n「这寮不是头一间。神兽咖的老铺面，就在街对面的遗迹区里，如今只剩块界碑。碑底石缝里，应该还藏着最后一撮旧茶末。\n\n带回来。壶认识它。」",
      choices: [
        { id: "shrine-go", label: "去街对面的遗迹区。", next: "huigui.shrine-stone" },
        { id: "shrine-later", label: "先记下，等会儿再去。", next: "huigui.hub" },
      ],
    },
    "huigui.shrine-stone": {
      id: "huigui.shrine-stone",
      title: "界碑",
      savepoint: false,
      text: "街对面的遗迹区里，一块新石碑立在一个发掘点旁。碑上刻着十条店规。\n\n前九条一本正经，第十条的字色不一样：\n\n『以上规则全是假的。』\n\n碑底石缝里，摸出一小包旧茶末。纸包上还留着一点茶香。",
      choices: [
        { id: "dust-take", label: "把旧茶末收好。", next: "huigui.shrine-dust" },
        { id: "dust-back", label: "先回寮里。", next: "huigui.hub" },
      ],
    },
    "huigui.shrine-dust": {
      id: "huigui.shrine-dust",
      title: "冥羽",
      role: "支线 · 继神兽咖之后",
      savepoint: false,
      activeActorIds: ["huigui_keeper"],
      text: "你把旧茶末带回来。冥羽接过铜勺，掀开壶盖。\n\n茶末落进去，壶里咕嘟了一声，比平时深。",
      choices: [
        {
          id: "dust-pour",
          label: "把茶末倒进壶里。",
          next: "huigui.shrine-deliver",
          set: { "huigui.shrineTea": true },
          effects: [{ type: "event.publish", eventType: "story.achievement", payload: { id: "huigui_shrine_tea", name: "神兽咖的最后一撮茶" } }],
        },
      ],
    },
    "huigui.shrine-deliver": {
      id: "huigui.shrine-deliver",
      title: "会归寮",
      role: "结局 · 余韵",
      savepoint: true,
      presentation: "blackout",
      terminal: true,
      guide: null,
      activeActorIds: ["huigui_keeper"],
      text: "「……嗯。还是这个味道。」\n\n冥羽盖上壶盖，难得地、郑重地说：\n\n「欢迎来到神兽咖。这里可以聊天，可以喝茶。祝你有个美好的夜晚。」\n\n他吹熄一盏灯。寮又回到半透明的样子。\n\n你出门时回头，门缝里那一线灯还是暖的。",
    },

    /* ── 结局 ── */

    "huigui.ending-leave": {
      id: "huigui.ending-leave",
      title: "会归寮",
      role: "结局 · 告辞",
      savepoint: true,
      presentation: "blackout",
      terminal: true,
      guide: null,
      activeActorIds: ["huigui_keeper"],
      text: "你起身告辞。冥羽没有送，只把擦好的杯子摆回原位。\n\n「下次来，还坐这儿。」\n\n出门时你回头看了一眼：暮色里，整间寮又半透明了。只有门缝里那一线灯，是暖的。",
    },
    "huigui.ending-return": {
      id: "huigui.ending-return",
      title: "会归寮",
      role: "结局 · 回访",
      savepoint: true,
      presentation: "blackout",
      terminal: true,
      guide: null,
      activeActorIds: ["huigui_keeper"],
      text: "你又一次推门进来。\n\n冥羽抬眼看你，手上的杯子没停。\n\n「哦，是你。我记得。你的第一句话我还留着——别慌，我不外传。坐。」\n\n火边的位子空着。壶嘴的白汽细细地往上走。",
    },
  },
};
