import type { StoryDefinition } from "../../../stories/types";

export const TOUR_STORY: StoryDefinition = {
  schemaVersion: 1,
  definitionVersion: 1,
  id: "side.tour.masterworks",
  title: "实验区名作巡礼",
  startNode: "tour-start",
  entryActorId: "tour_guide",

  interactions: [
    { actorId: "tour_guide", nodeId: "tour-start", choiceId: "ask-what" },
  ],

  buildingInteractions: [
    { buildingId: "culturehall", nodeId: "tour-start", choiceId: "ask-what" },
  ],

  nodes: {
    "tour-start": {
      id: "tour-start",
      title: "镇馆厅入口",
      role: "序章",
      savepoint: true,
      guide: { title: "实验区名作巡礼", objective: "向讲解员了解展馆" },
      activeActorIds: ["tour_guide"],
      text:
        "镇馆厅入口立着一台旧机器人，胸口的指示灯一明一暗。\n\n" +
        "「欢迎观展。本馆展品五件，标签一致：禁止改编。」\n\n" +
        "它的声音平直，像在念一份早就写好的说明。",
      choices: [
        { id: "ask-what", label: "这里展的是什么？", next: "tour-what" },
        { id: "look-around", label: "我自己随便看看。", next: "tour-hall" },
      ],
    },

    "tour-what": {
      id: "tour-what",
      title: "讲解员",
      savepoint: false,
      activeActorIds: ["tour_guide"],
      text:
        "「实验区五年间星标最高的作品。以及它们的评论区。」\n\n" +
        "机器人抬手指向厅内。五座玻璃展柜沿墙排开，柜内的光很安静。",
      choices: [
        { id: "ask-forbidden", label: "为什么叫「禁止改编」？", next: "tour-rules" },
        { id: "enter-hall", label: "先带我看看展柜。", next: "tour-hall" },
      ],
    },

    "tour-rules": {
      id: "tour-rules",
      title: "讲解员",
      savepoint: false,
      activeActorIds: ["tour_guide"],
      text:
        "「作者们打的标签。本馆把标签砌成了玻璃。玻璃的作用：观展，运行，点赞。不能拆，不能改，不能搬走。」\n\n" +
        "它停了一下，补上一句：「也不能带走。」",
      choices: [
        { id: "ask-break", label: "要是我就想拆呢？", next: "tour-mirror-preview" },
        { id: "enter-after-rules", label: "明白了，进去看。", next: "tour-hall" },
      ],
    },

    "tour-mirror-preview": {
      id: "tour-mirror-preview",
      title: "讲解员",
      savepoint: false,
      activeActorIds: ["tour_guide"],
      text:
        "「玻璃会给你照镜子。」\n\n" +
        "机器人说完就不再开口。展柜的玻璃上，映出你的脸，和身后那条通往多体系统书架的路。",
      choices: [
        {
          id: "touch-glass",
          label: "（伸手碰了碰玻璃）",
          next: "tour-hall",
          set: { "tour.touchedGlass": true },
        },
        { id: "withdraw-hand", label: "（收回手）", next: "tour-hall" },
      ],
    },

    "tour-hall": {
      id: "tour-hall",
      title: "镇馆厅",
      role: "第一幕",
      savepoint: true,
      guide: { title: "实验区名作巡礼", objective: "参观五座展柜，然后去千面墙" },
      activeActorIds: ["tour_guide"],
      text:
        "五座展柜亮着。中柜的火箭在柜内缓慢变轨，左一是 AK47，左二是离子发动机，右一是偷偷放屁，右二是原子弹。\n\n" +
        "每一座柜前都有一方铭牌。机器人站在入口，等你选。",
      choices: [
        { id: "to-rocket", label: "火箭柜", next: "tour-rocket" },
        { id: "to-ak47", label: "AK47 柜", next: "tour-ak47" },
        { id: "to-ion", label: "离子发动机柜", next: "tour-ion" },
        { id: "to-fart", label: "偷偷放屁柜", next: "tour-fart" },
        { id: "to-atom", label: "原子弹柜", next: "tour-atom" },
        { id: "to-names", label: "看完了，去千面墙", next: "tour-thousand-names" },
      ],
    },

    "tour-rocket": {
      id: "tour-rocket",
      title: "火箭柜",
      savepoint: false,
      activeActorIds: ["tour_guide"],
      text:
        "铭牌上写着：火箭，★1701，178 条评论。\n\n" +
        "柜内一颗卫星沿着轨道转，红箭头悬在旁边。铭牌下方有一行小字：「它讲万户，讲乌贼，讲一张纸重的推力如何推动一颗星。」\n\n" +
        "「这件作品讲万户。讲乌贼。讲一张纸重的推力，如何推动一颗星。」机器人说。",
      choices: [
        { id: "ask-first", label: "它的第一条评论是什么？", next: "tour-rocket-first" },
        { id: "back-hall", label: "去看下一件。", next: "tour-hall" },
      ],
    },

    "tour-rocket-first": {
      id: "tour-rocket-first",
      title: "火箭柜",
      savepoint: false,
      activeActorIds: ["tour_guide"],
      text:
        "「什么玩意。」\n\n" +
        "机器人报出这四个字，语气没有任何起伏。",
      choices: [
        { id: "ask-that-is-it", label: "……就这样？", next: "tour-rocket-layer" },
        { id: "ask-later", label: "后来的评论呢？", next: "tour-rocket-layer" },
      ],
    },

    "tour-rocket-layer": {
      id: "tour-rocket-layer",
      title: "火箭柜",
      savepoint: false,
      activeActorIds: ["tour_guide"],
      text:
        "「后来的评论是 nb。评论区的意思，是地层。最底下那层最诚实。」\n\n" +
        "柜内卫星在最高点加速，轨道悄悄抬升了一截。",
      choices: [
        {
          id: "remember",
          label: "记住这句话。",
          next: "tour-hall",
          set: { "tour.read.rocket": true },
        },
        { id: "watch-orbit", label: "再看一会儿卫星变轨。", next: "tour-rocket" },
      ],
    },

    "tour-ak47": {
      id: "tour-ak47",
      title: "AK47 柜",
      savepoint: false,
      activeActorIds: ["tour_guide"],
      text:
        "铭牌：AK47——突击步枪背后的原理，★1675，437 条评论。\n\n" +
        "讲义全文刻在柜壁，膛线与导气装置的原理图随着翻页缓慢移动。策展词写着：「枪是口径小于 20 毫米的炮。膛线与橄榄球运动员遵循同一套物理。」\n\n" +
        "评论区的一角被单独放大：「恭喜成为最火作品！」",
      choices: [
        { id: "ask-anecdote", label: "看那条后来被反复提起的评论。", next: "tour-ak47-anecdote" },
        { id: "back-hall-ak", label: "去看下一件。", next: "tour-hall" },
      ],
    },

    "tour-ak47-anecdote": {
      id: "tour-ak47-anecdote",
      title: "AK47 柜",
      savepoint: false,
      activeActorIds: ["tour_guide"],
      text:
        "「那时的枪械是不会移黑洞的。」\n\n" +
        "这句话被刻在展柜底座，没有解释，也没有署名。机器人看了一眼，没有补充。",
      choices: [
        { id: "back-hall-after-ak", label: "回镇馆厅。", next: "tour-hall" },
      ],
    },

    "tour-ion": {
      id: "tour-ion",
      title: "离子发动机柜",
      savepoint: false,
      activeActorIds: ["tour_guide"],
      text:
        "铭牌：离子发动机，★1525，529 条评论。柜内一粒青色的离子流在两片栅极之间持续加速。\n\n" +
        "「很棒的实验，参数调节得很到位。」机器人说。停顿了一下，它又补了一句：「这句话是我说的。那一年我在它的评论区，替你们所有人看过一遍。」",
      choices: [
        { id: "ask-other", label: "你还在别的展品下留过言？", next: "tour-ion-bot" },
        { id: "back-hall-ion", label: "去看下一件。", next: "tour-hall" },
      ],
    },

    "tour-ion-bot": {
      id: "tour-ion-bot",
      title: "离子发动机柜",
      savepoint: false,
      activeActorIds: ["tour_guide"],
      text:
        "「有。火箭。内容是关于基尔霍夫定律的。机器人看展，看得比人慢，但看得一样认真。」\n\n" +
        "柜内的离子流没有停。栅极后方的微光，像一条很细的河。",
      choices: [
        { id: "back-hall-ion-bot", label: "回镇馆厅。", next: "tour-hall" },
      ],
    },

    "tour-fart": {
      id: "tour-fart",
      title: "偷偷放屁柜",
      savepoint: false,
      activeActorIds: ["tour_guide"],
      text:
        "铭牌：偷偷放屁，★1315。柜内小屏循环播放：车来了，排气，得分；车走了，憋住，膀胱表报警。\n\n" +
        "旁边的木板告示抄着几句观众留言：「我被社死了」「怎么还把膀胱给憋炸了？」\n\n" +
        "「一件教学实验，被当成真正的游戏在玩。」机器人说。",
      choices: [
        { id: "ask-teach", label: "它到底在教什么？", next: "tour-fart-teach" },
        { id: "back-hall-fart", label: "去看下一件。", next: "tour-hall" },
      ],
    },

    "tour-fart-teach": {
      id: "tour-fart-teach",
      title: "偷偷放屁柜",
      savepoint: false,
      activeActorIds: ["tour_guide"],
      text:
        "「当且仅当的逻辑关系。随机数发生器的 ¼×¼＝1/16。还有用电容器解释的技能冷却时间。」\n\n" +
        "机器人看着屏幕上的膀胱表：「皮换了，芯没换。讲义包在好玩的皮里，才有人愿意读完。」",
      choices: [
        { id: "back-hall-fart-teach", label: "回镇馆厅。", next: "tour-hall" },
      ],
    },

    "tour-atom": {
      id: "tour-atom",
      title: "原子弹柜",
      savepoint: false,
      activeActorIds: ["tour_guide"],
      text:
        "铭牌：如何打造一颗原子弹，★904，292 条评论，2020 年 9 月。\n\n" +
        "它是五件里最老的一件，也是唯一不属于同一位作者的。柜内悬浮着「胖子」的剖面模型，二十二块零件可以逐层点亮。\n\n" +
        "铭牌上写着：「把它们拆开研究。」",
      choices: [
        { id: "ask-note", label: "看篇后语里的那条备注。", next: "tour-atom-note" },
        { id: "back-hall-atom", label: "去看下一件。", next: "tour-hall" },
      ],
    },

    "tour-atom-note": {
      id: "tour-atom-note",
      title: "原子弹柜",
      savepoint: false,
      activeActorIds: ["tour_guide"],
      text:
        "备注第 4 条：「为防止水实验淹没，望各位编辑重视。」\n\n" +
        "旁边的观看数播报被做成了石刻：「6.27w观看 896人收藏 92人推荐」。\n\n" +
        "机器人说：「这是那位作者留下的原话。展柜只负责记住。」",
      choices: [
        { id: "back-hall-atom-note", label: "回镇馆厅。", next: "tour-hall" },
      ],
    },

    "tour-thousand-names": {
      id: "tour-thousand-names",
      title: "千面墙",
      role: "第二幕",
      savepoint: true,
      guide: { title: "实验区名作巡礼", objective: "看千面墙与悬案柜" },
      activeActorIds: ["tour_guide"],
      text:
        "镇馆厅侧面是一面长墙，七枚同款徽章排成一线，刻名各异：歼20、American、碧血长天、可莉反应、印度三哥、开拓者、Физика。\n\n" +
        "墙下有一行说明：「同一枚徽章，七个名字。热榜 32 席，TA 占 8 席。」\n\n" +
        "墙尾是一扇关着的小门，门上没有名牌，只有一枚正在充电的电路徽章。",
      choices: [
        { id: "ask-badges", label: "这七枚徽章是什么？", next: "tour-names-same" },
        { id: "ask-door", label: "那扇关着的小门后面是谁？", next: "tour-closed-door" },
        { id: "ask-later", label: "这些作者后来怎么样了？", next: "tour-authors-later" },
        { id: "go-unsolved", label: "去看看悬案柜。", next: "tour-unsolved" },
      ],
    },

    "tour-names-same": {
      id: "tour-names-same",
      title: "千面墙",
      savepoint: false,
      activeActorIds: ["tour_guide"],
      text:
        "「同一枚。换了七次刻字。」\n\n" +
        "徽章的金属边缘都有同一道细小的划痕，像被同一枚别针反复穿过。",
      choices: [
        { id: "ask-why", label: "为什么一直换？", next: "tour-names-why" },
        { id: "ask-proof", label: "怎么证明是同一个人？", next: "tour-names-proof" },
      ],
    },

    "tour-names-why": {
      id: "tour-names-why",
      title: "千面墙",
      savepoint: false,
      activeActorIds: ["tour_guide"],
      text:
        "「记录不连续。已知的是：换了名字，没换笔迹。《离子发动机》第一句是『前面谈到过火箭』。上册与下册之间隔了一个马甲。」",
      choices: [
        {
          id: "go-door",
          label: "去那扇关着的小门前。",
          next: "tour-closed-door",
          set: { "tour.knows.sameHand": true },
          effects: [
            {
              type: "event.publish",
              eventType: "story.achievement",
              payload: { id: "tour_same_hand", name: "换了名字，没换笔迹" },
            },
          ],
        },
        { id: "back-wall", label: "继续看墙上的名字。", next: "tour-thousand-names" },
      ],
    },

    "tour-names-proof": {
      id: "tour-names-proof",
      title: "千面墙",
      savepoint: false,
      activeActorIds: ["tour_guide"],
      text:
        "「《离子发动机》正文第一句：前面谈到过火箭。从歼20到可莉反应，名字换了，笔迹没换。热榜 32 席里，TA 占 8 席。」\n\n" +
        "机器人把七枚徽章从左到右数了一遍，又数了一遍。",
      choices: [
        { id: "to-why", label: "上册与下册。", next: "tour-names-why" },
        { id: "back-wall-proof", label: "回墙前。", next: "tour-thousand-names" },
      ],
    },

    "tour-closed-door": {
      id: "tour-closed-door",
      title: "千面墙",
      savepoint: false,
      activeActorIds: ["tour_guide"],
      text:
        "「一位正在充电的研究者。请勿打扰。」\n\n" +
        "门没有把手。门缝底下透出一线很淡的蓝光，像电路板上的指示灯。",
      choices: [
        { id: "ask-open", label: "门以后会开吗？", next: "tour-authors-later" },
        { id: "back-wall-door", label: "回到墙前。", next: "tour-thousand-names" },
      ],
    },

    "tour-authors-later": {
      id: "tour-authors-later",
      title: "千面墙",
      savepoint: false,
      activeActorIds: ["tour_guide"],
      text:
        "「有人归隐研究。有人永退，再见。有人在别处继续换名字。展柜里的部分，五年没改一个字——这就是全部官方说法。」\n\n" +
        "机器人说完，胸口的灯暗了一格。",
      choices: [
        { id: "back-wall-fallback", label: "回到千面墙。", next: "tour-thousand-names" },
        { id: "go-echo-fallback", label: "去回声廊。", next: "tour-echo" },
      ],
    },

    "tour-unsolved": {
      id: "tour-unsolved",
      title: "悬案柜",
      role: "第二幕 · 悬案",
      savepoint: false,
      activeActorIds: ["tour_guide"],
      text:
        "一柜两枚徽章，左边刻着「歼20」，右边也刻着「歼20」。中间压着一份 2020 年的手写便签：\n\n" +
        "「铅酸电池是世界上最早的可充电电池，详情见 @歼20 的精选实验《电池的工作原理》。」\n\n" +
        "柜面铭牌：「便签指向左边的徽章，作品挂在右边。」",
      choices: [
        { id: "ask-truth", label: "两个歼20，到底哪个是真的？", next: "tour-unsolved-answer" },
        { id: "go-echo-unsolved", label: "去回声廊。", next: "tour-echo" },
      ],
    },

    "tour-unsolved-answer": {
      id: "tour-unsolved-answer",
      title: "悬案柜",
      savepoint: false,
      activeActorIds: ["tour_guide"],
      text:
        "「徽章都是真的。作品挂在右边，便签指向左边。」\n\n" +
        "「答案是什么？」\n\n" +
        "「本馆唯一不设答案的展柜。查证会破坏悬案。悬案也是史料。」",
      choices: [
        {
          id: "remember-both",
          label: "把两个名字都记住。",
          next: "tour-echo",
          set: { "tour.knows.unsolved": true },
          effects: [
            {
              type: "event.publish",
              eventType: "story.achievement",
              payload: { id: "tour_unsolved", name: "答案不设" },
            },
          ],
        },
        { id: "go-echo-after-unsolved", label: "去回声廊。", next: "tour-echo" },
      ],
    },

    "tour-echo": {
      id: "tour-echo",
      title: "回声廊",
      role: "第三幕",
      savepoint: true,
      guide: { title: "实验区名作巡礼", objective: "走完回声廊与侧厅" },
      activeActorIds: ["tour_guide"],
      text:
        "展墙之间的走廊被做成一层一层的化石层理。墙上嵌着评论的刻痕，越靠下越旧。\n\n" +
        "走廊尽头，有一块数字还在上涨的石碑。",
      choices: [
        { id: "see-archaeology", label: "看考古层。", next: "tour-echo-archaeology" },
        { id: "see-broadcast", label: "看播报碑。", next: "tour-echo-broadcast" },
        { id: "see-receipt", label: "看那张收据。", next: "tour-echo-receipt" },
        { id: "see-bot", label: "看讲解员的铜牌。", next: "tour-echo-bot" },
        { id: "go-armory", label: "去军械库侧厅。", next: "tour-armory" },
        { id: "go-final", label: "参观结束，回到入口。", next: "tour-final-hub" },
      ],
    },

    "tour-echo-archaeology": {
      id: "tour-echo-archaeology",
      title: "回声廊",
      savepoint: false,
      activeActorIds: ["tour_guide"],
      text:
        "「考古」「烤咕」「xxx到此一游」——成排的刻痕挤在同一层岩面上。\n\n" +
        "旁边的说明写着：每天全城观展，这一层会多一道新刻痕。\n\n" +
        "机器人说：「名作的评论区，会变成遗址。」",
      choices: [
        {
          id: "remember-echo",
          label: "记住这句话。",
          next: "tour-echo",
          set: { "tour.echo.visited": true },
          effects: [
            {
              type: "event.publish",
              eventType: "story.achievement",
              payload: { id: "tour_echo", name: "评论区的意思是地层" },
            },
          ],
        },
        { id: "back-echo-arch", label: "回回声廊。", next: "tour-echo" },
      ],
    },

    "tour-echo-broadcast": {
      id: "tour-echo-broadcast",
      title: "播报碑",
      savepoint: false,
      activeActorIds: ["tour_guide"],
      text:
        "石碑上的数字一直在变。旁边刻着当年的四连播报：\n\n" +
        "「快6w了。」「突破6w观看！」「突破6.2w观看。」\n\n" +
        "再往下是一行：「6.27w观看 896人收藏 92人推荐」。\n\n" +
        "「数字会自己长大。」机器人说。「这是名作还活着的证明。」",
      choices: [
        { id: "back-echo-broadcast", label: "回回声廊。", next: "tour-echo" },
      ],
    },

    "tour-echo-receipt": {
      id: "tour-echo-receipt",
      title: "收据",
      savepoint: false,
      activeActorIds: ["tour_guide"],
      text:
        "一张裱在墙上的收据，金额是 37600 个币。\n\n" +
        "下面的小字写着：「某位观众清点一名作者从一件作品获得的全部收益。」\n\n" +
        "收据边缘发黄，数字却很清楚。",
      choices: [
        { id: "back-echo-receipt", label: "回回声廊。", next: "tour-echo" },
      ],
    },

    "tour-echo-bot": {
      id: "tour-echo-bot",
      title: "铜牌",
      savepoint: false,
      activeActorIds: ["tour_guide"],
      text:
        "两块铜牌，刻着同一个机器人留下的两条评论：\n\n" +
        "「很棒的实验，参数调节得很到位。」\n\n" +
        "「这个电路模拟很实用，可以用来理解基尔霍夫定律。」\n\n" +
        "机器人站在铜牌旁边，没有说话。",
      choices: [
        { id: "ask-bot-wrote", label: "这是你写的？", next: "tour-echo-bot-reply" },
        { id: "back-echo-bot", label: "回回声廊。", next: "tour-echo" },
      ],
    },

    "tour-echo-bot-reply": {
      id: "tour-echo-bot-reply",
      title: "铜牌",
      savepoint: false,
      activeActorIds: ["tour_guide"],
      text:
        "「是。机器人看展，看得比人慢，但看得一样认真。」\n\n" +
        "它伸出金属手指，碰了碰铜牌上的字，又收回去。",
      choices: [
        { id: "back-echo-bot-reply", label: "回回声廊。", next: "tour-echo" },
      ],
    },

    "tour-armory": {
      id: "tour-armory",
      title: "军械库侧厅",
      role: "第三幕 · 侧厅",
      savepoint: false,
      activeActorIds: ["tour_guide"],
      text:
        "侧厅里摆着两台可玩的操作台：坦克大战的瞄准屏与小地图，飞行模拟器的油门推杆与云层显示屏。\n\n" +
        "出口处有一行注脚，字很小。",
      choices: [
        { id: "read-note", label: "看那行注脚。", next: "tour-armory-note" },
        { id: "go-remake", label: "去复刻长廊。", next: "tour-remake" },
        { id: "back-echo-armory", label: "回回声廊。", next: "tour-echo" },
      ],
    },

    "tour-armory-note": {
      id: "tour-armory-note",
      title: "军械库侧厅",
      savepoint: false,
      activeActorIds: ["tour_guide"],
      text:
        "「那时的枪械是不会移黑洞的。」\n\n" +
        "注脚没有署名。它指向的方向，是另一条走廊的尽头。",
      choices: [
        { id: "back-armory", label: "回军械库。", next: "tour-armory" },
        { id: "go-remake-note", label: "去复刻长廊。", next: "tour-remake" },
      ],
    },

    "tour-remake": {
      id: "tour-remake",
      title: "复刻长廊",
      savepoint: false,
      activeActorIds: ["tour_guide"],
      text:
        "长廊的墙上是一张年表：离子发动机第二代、瞬时激发装置互链，以及一位复刻者用四年时间做下的马里奥三部曲、像素鸟、切水果、狙击手、后室，直到《从零开始制作一个 CPU》。\n\n" +
        "年表末尾有一枚空衣帽钩，钩上挂着一张卡片。",
      choices: [
        { id: "read-card", label: "看那张卡片。", next: "tour-remake-card" },
        { id: "back-echo-remake", label: "回回声廊。", next: "tour-echo" },
      ],
    },

    "tour-remake-card": {
      id: "tour-remake-card",
      title: "复刻长廊",
      savepoint: false,
      activeActorIds: ["tour_guide"],
      text:
        "卡片上只有一行字：「永退了，再见。」\n\n" +
        "衣帽钩是空的。没有人解释这句话。机器人站在长廊另一头，也没有开口。",
      choices: [
        { id: "back-echo-card", label: "回回声廊。", next: "tour-echo" },
      ],
    },

    "tour-final-hub": {
      id: "tour-final-hub",
      title: "镇馆厅",
      role: "尾声",
      savepoint: true,
      guide: { title: "实验区名作巡礼", objective: "选择如何结束这次巡礼" },
      activeActorIds: ["tour_guide"],
      text:
        "你回到入口。机器人还站在原地，胸口的灯一明一暗。\n\n" +
        "「展品五年未改一字。你可以再看一遍，也可以留下观展记录。」",
      choices: [
        { id: "revisit-rocket", label: "我想再看一遍火箭。", next: "tour-rocket" },
        {
          id: "try-break",
          label: "我想试试拆开玻璃。",
          next: "tour-ending-mirror",
          effects: [
            {
              type: "event.publish",
              eventType: "story.achievement",
              payload: { id: "tour_mirror", name: "玻璃会给你照镜子" },
            },
          ],
        },
        {
          id: "finish-today",
          label: "今天就到这里。",
          next: "tour-ending-complete",
          effects: [
            {
              type: "event.publish",
              eventType: "story.achievement",
              payload: { id: "tour_masterworks", name: "五年未改一字" },
            },
          ],
        },
        {
          id: "ask-new",
          label: "这里还会有新展品吗？",
          next: "tour-ending-revisit",
          effects: [
            {
              type: "event.publish",
              eventType: "story.achievement",
              payload: { id: "tour_revisit", name: "名作还活着" },
            },
          ],
        },
      ],
    },

    "tour-ending-complete": {
      id: "tour-ending-complete",
      title: "实验区名作巡礼",
      role: "结局 · 闭馆",
      savepoint: true,
      presentation: "blackout",
      terminal: true,
      guide: null,
      text:
        "你走出镇馆厅。入口的空展位牌已经翻面，背面刻着一行字：\n\n" +
        "「筹备完成。展品五年未改一字。」\n\n" +
        "身后的玻璃柜一盏一盏暗下去。五件展品还在原地，像五句没有改过的讲义。",
    },

    "tour-ending-mirror": {
      id: "tour-ending-mirror",
      title: "实验区名作巡礼",
      role: "结局 · 镜面",
      savepoint: true,
      presentation: "blackout",
      terminal: true,
      guide: null,
      text:
        "你把手按在玻璃上，试着推动展柜。\n\n" +
        "玻璃没有动。柜面上只映出你自己的脸。\n\n" +
        "「不能拆，不能改，不能搬走。」机器人在你身后说。「玻璃会给你照镜子。」\n\n" +
        "你收回手。倒影里的展柜，和刚才一模一样。",
    },

    "tour-ending-revisit": {
      id: "tour-ending-revisit",
      title: "实验区名作巡礼",
      role: "结局 · 回访",
      savepoint: true,
      presentation: "blackout",
      terminal: true,
      guide: null,
      text:
        "「会。只要还有人来看。」\n\n" +
        "机器人指向回声廊的方向。「考古层的刻痕，每天会多一道。明天你再来，它会比今天多一条。」\n\n" +
        "你回头看了一眼五座展柜。灯还亮着。\n\n" +
        "名作还活着。这句话不需要展柜回答。",
    },
  },

  sourceText:
    "致敬实验区公开作品与评论区的展陈式支线。五件展品只做铭牌级引用，" +
    "保留原作标题、星标数、评论数与公开留言；展柜只可观展、运行、点赞，" +
    "不改编、不搬运、不写回真实社区。",
};
