import type { StoryDefinition } from "../../../stories/types";

export const WANDERING_STORY: StoryDefinition = {
  schemaVersion: 1,
  definitionVersion: 1,
  id: "side.wandering.earth",
  title: "流浪地球可行吗",
  startNode: "wandering.gate",
  entryActorId: "wandering_host",

  interactions: [
    { actorId: "wandering_host", nodeId: "wandering.gate", choiceId: "greet" },
  ],

  buildingInteractions: [
    { buildingId: "north_stellar_hall", nodeId: "wandering.gate", choiceId: "greet" },
  ],

  nodes: {
    "wandering.gate": {
      id: "wandering.gate",
      title: "天问台",
      role: "序章",
      savepoint: true,
      guide: { title: "流浪地球可行吗", objective: "在天问台前和守馆人说话" },
      activeActorIds: ["wandering_host"],
      text:
        "天问台立在小城北坡最高处。奶油色石砌基座，圆顶，一座细长的四层观星塔从侧面拔起。塔顶的白色观测室上，七道彩色窄缝从东向西排开。\n\n" +
        "台前站着一位围着白围巾的老人，袖口有一点粉笔灰。他看见你，先抬头看了看塔顶那个问号形状的风向标。\n\n" +
        "「客人来看星星？」",
      choices: [
        { id: "greet", label: "来看这座台。", next: "wandering.purpose" },
        { id: "read-sign", label: "先读台前的铭牌。", next: "wandering.sign" },
      ],
    },

    "wandering.sign": {
      id: "wandering.sign",
      title: "台前铭牌",
      savepoint: false,
      activeActorIds: ["wandering_host"],
      text:
        "铭牌上没有抒情文案，只抄着一句话：\n\n" +
        "「综上所述，从科学理论和实际计算来看，《流浪地球》中的全过程在目前几乎无法成真。」\n\n" +
        "下面还有一行小字：\n\n" +
        "「本馆因此得以建成。」",
      choices: [
        { id: "ask-why-build", label: "为什么不可行，反而要建馆？", next: "wandering.purpose" },
        { id: "understand", label: "我懂了。", next: "wandering.purpose" },
      ],
    },

    "wandering.purpose": {
      id: "wandering.purpose",
      title: "守馆人",
      savepoint: true,
      guide: { title: "流浪地球可行吗", objective: "听守馆人说完建馆的缘由" },
      activeActorIds: ["wandering_host"],
      text:
        "「算一件不可能的事，算给它看。算完了，把它挂在梁上。」\n\n" +
        "老人侧过身，让出门。\n\n" +
        "「不是因为想证明它一定不行。是因为只有算过，才知道它究竟难在哪里。」",
      choices: [
        { id: "ask-founder", label: "金匾上那个第一名，是谁？", next: "wandering.founder", set: { "wandering.asked.founder": true } },
        { id: "ask-host", label: "（凑近）你是谁？", next: "wandering.host-identity" },
        { id: "enter", label: "进门看看。", next: "wandering.enter-hall", set: { "wandering.asked.purpose": true } },
      ],
    },

    "wandering.founder": {
      id: "wandering.founder",
      title: "守馆人",
      savepoint: false,
      activeActorIds: ["wandering_host"],
      text:
        "「一个把『重磅』两个字说了一年又一年的年轻人。他二月发车，年年二月发车。」\n\n" +
        "他指了指塔门内的金匾。\n\n" +
        "「第一次发车，他带着地球走了四站：停转、逃逸、航行、到站。每一站都算了一遍。」\n\n" +
        "「后来每年二月，他都还会来一次。至少，这座馆是这么记得的。」",
      choices: [
        { id: "ask-host", label: "（凑近）你是谁？", next: "wandering.host-identity" },
        { id: "enter", label: "进门看看。", next: "wandering.enter-hall" },
      ],
    },

    "wandering.host-identity": {
      id: "wandering.host-identity",
      title: "守馆人",
      savepoint: true,
      guide: { title: "流浪地球可行吗", objective: "听守馆人说完自己的来历" },
      activeActorIds: ["wandering_host"],
      text:
        "你凑近了些。\n\n" +
        "「我啊……我读文章。读了很多很多篇。读到最后，别人问我在忙什么，我说，拜拜，有缘再见呢——你看，干我们这行的，连告别都像连载。」\n\n" +
        "他笑了一下，把围巾往脖子里掖了掖。",
      choices: [
        {
          id: "remember",
          label: "记住了。",
          next: "wandering.enter-hall",
          set: { "wandering.asked.host": true },
          effects: [
            { type: "event.publish", eventType: "story.achievement", payload: { id: "wandering_first_star", name: "客人来看星星" } },
          ],
        },
        {
          id: "ask-archaeology",
          label: "你一直守在这里？",
          next: "wandering.archaeology",
          set: { "wandering.asked.host": true },
        },
      ],
    },

    "wandering.archaeology": {
      id: "wandering.archaeology",
      title: "守馆人",
      savepoint: true,
      activeActorIds: ["wandering_host"],
      text:
        "「客人是来考古的？」老人先问，又自己摇头。「不对，考古这个词，是我们自己叫顺口的。」\n\n" +
        "「就是一件一年半以前的事，今天还有人愿意推开它的门。墙上的牌子只剩十六块——不是没人写了，是墙只记得住最新的十六句。」",
      choices: [
        { id: "ask-drawer", label: "抽屉里的牌子能看吗？", next: "wandering.archive", set: { "wandering.asked.archaeology": true } },
        { id: "enter", label: "先进塔里看看。", next: "wandering.enter-hall" },
      ],
    },

    "wandering.enter-hall": {
      id: "wandering.enter-hall",
      title: "塔门内",
      role: "第一幕 · 天问台",
      savepoint: true,
      guide: { title: "流浪地球可行吗", objective: "在天问台里四处看看" },
      activeActorIds: ["wandering_host"],
      text:
        "门内正梁上悬着一块素色金匾：「史上最热门知识库 · 第一」。落款只有三个数字：1454 星，43337 访，57750 热度。\n\n" +
        "匾旁是一面素色锦旗，旗面绣着四个字：「参赛作品」。再旁边，一只小捐箱安静地挂着。\n\n" +
        "环廊一圈是留言墙。塔门右手边，通往上层的楼梯盘旋而上。",
      choices: [
        { id: "look-slits", label: "去看七色缝。", next: "wandering.slits" },
        { id: "look-board", label: "去看迎宾牌。", next: "wandering.welcome" },
        { id: "go-wall", label: "去看留言墙。", next: "wandering.wall" },
        { id: "go-pigeon", label: "去鸽舍看看。", next: "wandering.pigeon" },
        { id: "climb-tower", label: "爬观星塔。", next: "wandering.tower" },
        { id: "ask-debate", label: "和守馆人谈谈那些计算。", next: "wandering.debate-hub" },
      ],
    },

    "wandering.slits": {
      id: "wandering.slits",
      title: "七色缝",
      savepoint: false,
      activeActorIds: ["wandering_host"],
      text:
        "观测室的圆顶上开着七道竖直窄缝，自东向西按红、橙、黄、绿、浅蓝、蓝、紫排列。平时它们只是七条安静的彩色细线。\n\n" +
        "老人说：「每天黄昏，十七点半到十八点，夕阳光会以正确角度穿过去。地上会拼出七个光斑。」",
      choices: [
        { id: "wait-dusk", label: "等到黄昏。", next: "wandering.slits-dusk" },
        { id: "back", label: "回廊下。", next: "wandering.enter-hall" },
      ],
    },

    "wandering.slits-dusk": {
      id: "wandering.slits-dusk",
      title: "黄昏光谱",
      savepoint: false,
      presentation: "cg",
      activeActorIds: ["wandering_host"],
      text:
        "你们等到黄昏。光线一寸一寸斜下来，穿过七道缝，在观测室的地板上落下七个光斑。\n\n" +
        "红、橙、黄、绿、浅蓝、蓝、紫。\n\n" +
        "走近低头看，光斑排成一行字：\n\n" +
        "「流浪地球可行吗」",
      choices: [
        {
          id: "look-floor",
          label: "低头看那行字。",
          next: "wandering.enter-hall",
          set: { "wandering.saw.seven": true },
          effects: [
            { type: "event.publish", eventType: "story.achievement", payload: { id: "wandering_seven_colors", name: "七色缝" } },
          ],
        },
        { id: "back", label: "回廊下。", next: "wandering.enter-hall" },
      ],
    },

    "wandering.welcome": {
      id: "wandering.welcome",
      title: "迎宾牌",
      savepoint: false,
      activeActorIds: ["wandering_host"],
      text:
        "入口立着一块空白的迎宾牌。你走近两步，牌面上浮起一行字：\n\n" +
        "「你好，{visitor}！如果你喜欢我的作品，可以在评论区给出支持」\n\n" +
        "那个变量没有原样留着。它在你眼前换成了你自己的名字。\n\n" +
        "翻到背面，一块小铜牌上刻着另一段问答：「我不会用。」「{visitor }」\n\n" +
        "老人说：「有人把变量名本身当作回答发了出去。你不会用？你的名字就写在那里，去看。」",
      choices: [
        { id: "read-back", label: "读完背面的铜牌。", next: "wandering.enter-hall", set: { "wandering.saw.board": true } },
        { id: "back", label: "回廊下。", next: "wandering.enter-hall" },
      ],
    },

    "wandering.wall": {
      id: "wandering.wall",
      title: "留言墙",
      savepoint: true,
      activeActorIds: ["wandering_host"],
      text:
        "留言墙只挂十六块木牌，一块不多。\n\n" +
        "「墙是满的，永远满的。」老人说。「新的访客想留言，就把最旧的一块收进墙下的抽屉，空出的位置挂新的。」",
      choices: [
        { id: "read-board", label: "读现役的十六块。", next: "wandering.wall-lines", set: { "wandering.read.wall": true } },
        { id: "open-drawer", label: "打开考古抽屉。", next: "wandering.archive" },
        { id: "see-shadows", label: "看看墙前的剪影。", next: "wandering.archaeologists" },
        { id: "back", label: "回廊下。", next: "wandering.enter-hall" },
      ],
    },

    "wandering.wall-lines": {
      id: "wandering.wall-lines",
      title: "十六块木牌",
      savepoint: false,
      activeActorIds: ["wandering_host"],
      text:
        "十六块现役木牌上，刻着不同年份的留言。\n\n" +
        "「烤咕。」\n" +
        "「可行吗」\n" +
        "「！？」\n" +
        "「嗯？」\n" +
        "「史上热门知识库榜一，怎能不考古（）」\n" +
        "「实验内容好强」\n" +
        "「我居然没支持这个作品！？」\n" +
        "「1.44K收藏，103支持吓哭了」\n" +
        "「作品很不错」\n" +
        "「水3」\n" +
        "「最近怎么这么多人考古这个作品（）」\n" +
        "「怎么还没出？」\n" +
        "「呵呵」\n\n" +
        "有些字迹已经被人摸得发亮。",
      choices: [
        { id: "back-wall", label: "回墙边。", next: "wandering.wall" },
        { id: "open-drawer", label: "打开抽屉。", next: "wandering.archive" },
      ],
    },

    "wandering.archive": {
      id: "wandering.archive",
      title: "考古抽屉",
      savepoint: false,
      activeActorIds: ["wandering_host"],
      text:
        "墙下是一只多层斗柜。老人把最上面一层拉开：「翻吧，轻一点。」\n\n" +
        "每一层是一个更早的地层。旧的木牌按顺序叠着，没有编号，只有日期。\n\n" +
        "最底下几层是空的。柜底贴着一张小签：「再往下的字迹，还没有人替它们拓下来。」\n\n" +
        "老人站在你身后，没有催。「也许等你。」",
      choices: [
        {
          id: "go-bottom",
          label: "继续往下翻。",
          next: "wandering.wall",
          set: { "wandering.read.drawer": true },
          effects: [
            { type: "event.publish", eventType: "story.achievement", payload: { id: "wandering_archive", name: "也许等你" } },
          ],
        },
        { id: "back-wall", label: "只看现役的十六块。", next: "wandering.wall" },
      ],
    },

    "wandering.archaeologists": {
      id: "wandering.archaeologists",
      title: "墙前的剪影",
      savepoint: false,
      activeActorIds: ["wandering_archaeologist", "wandering_stargazer", "wandering_longtime_reader"],
      text:
        "黄昏时分，留言墙前会多出几道剪影。他们不总在，来了也不一定说话。\n\n" +
        "一道影子说：「烤咕。」说完不走，又抬头看了一遍金匾。\n\n" +
        "另一道问：「可行吗？」问完，墙上第十七块牌子亮了一下。\n\n" +
        "还有人低声说：「我居然没支持这个作品！？」然后掏出支持键。",
      choices: [
        { id: "watch-longer", label: "再看一会儿。", next: "wandering.wall", set: { "wandering.met.archaeologists": true } },
        { id: "back", label: "回廊下。", next: "wandering.enter-hall" },
      ],
    },

    "wandering.pigeon": {
      id: "wandering.pigeon",
      title: "咕咕鸽",
      savepoint: false,
      activeActorIds: ["wandering_pigeon"],
      text:
        "天文台侧翼的鸽舍里住着一群灰鸽子。其中一只停在到站钟上，像在值班。\n\n" +
        "你走近，它转过头。\n\n" +
        "「你在值班？」\n\n" +
        "「咕。」\n\n" +
        "钟摆慢了一格。",
      choices: [
        { id: "ask-update", label: "作者什么时候更新？", next: "wandering.pigeon-update" },
        { id: "ask-arrival", label: "什么时候到站？", next: "wandering.pigeon-arrival", set: { "wandering.met.pigeon": true } },
        { id: "back", label: "回廊下。", next: "wandering.enter-hall" },
      ],
    },

    "wandering.pigeon-update": {
      id: "wandering.pigeon-update",
      title: "咕咕鸽",
      savepoint: false,
      activeActorIds: ["wandering_pigeon"],
      text:
        "「作者什么时候更新？」\n\n" +
        "鸽子展开羽翼，指向塔顶。风向标旁挂着一面小旗，旗上正写着：「2026又要发重磅实验」。\n\n" +
        "它收回翅膀，又叫了一声：「咕。」",
      choices: [
        { id: "ask-arrival", label: "什么时候到站？", next: "wandering.pigeon-arrival" },
        { id: "back", label: "回廊下。", next: "wandering.pigeon" },
      ],
    },

    "wandering.pigeon-arrival": {
      id: "wandering.pigeon-arrival",
      title: "咕咕鸽",
      savepoint: false,
      activeActorIds: ["wandering_pigeon"],
      text:
        "「什么时候到站？」\n\n" +
        "鸽子看向钟。钟看向 4300 年后。\n\n" +
        "良久，它说：「咕。」\n\n" +
        "这是全馆唯一诚实的回答。",
      choices: [
        {
          id: "wait-with-pigeon",
          label: "陪它等一会儿。",
          next: "wandering.enter-hall",
          effects: [
            { type: "event.publish", eventType: "story.achievement", payload: { id: "wandering_honest_answer", name: "唯一的诚实回答" } },
          ],
        },
        { id: "back", label: "回廊下。", next: "wandering.enter-hall" },
      ],
    },

    "wandering.tower": {
      id: "wandering.tower",
      title: "四层观星塔",
      role: "第二幕 · 陪地球走完全程",
      savepoint: true,
      guide: { title: "流浪地球可行吗", objective: "逐层看完四节计算" },
      activeActorIds: ["wandering_host"],
      text:
        "四层观星塔，对应四节计算。每一层有一间小观测厅，各住着一件互动展品。\n\n" +
        "楼梯很窄，墙上每隔几级就有一行小字。老人没有跟上来，只在下面说：「一层一层看。别跳站。」",
      choices: [
        { id: "floor1", label: "一层 · 停转厅。", next: "wandering.stop-hall" },
        { id: "floor2", label: "二层 · 逃逸厅。", next: "wandering.escape-hall" },
        { id: "floor3", label: "三层 · 星际厅。", next: "wandering.life-hall" },
        { id: "floor4", label: "四层 · 到站厅。", next: "wandering.arrival-hall" },
        { id: "broken", label: "去看那台坏掉的模拟器。", next: "wandering.broken" },
        { id: "supplement", label: "去看观众补充展位。", next: "wandering.supplement" },
        { id: "ask-debate", label: "下楼和守馆人谈谈。", next: "wandering.debate-hub" },
      ],
    },

    "wandering.stop-hall": {
      id: "wandering.stop-hall",
      title: "一层 · 停转厅",
      savepoint: false,
      activeActorIds: ["wandering_host"],
      text:
        "一台黄铜地球仪缓缓旋转，底座上有一只可供推动的手柄。\n\n" +
        "「地球转动惯量 I＝2/5mr²，代进质量和半径，得到 9.70×10³⁷ kg·m²。自转角速度 7.29×10⁻⁵ rad/s，初角动量约 7.07×10³³。」\n\n" +
        "铭牌上第二行写着：「差 2.62×10²² 牛。」\n\n" +
        "你握住手柄往前推。地球仪没有停，转速分毫不变。你换了个角度，又推了一次，还是不变。\n\n" +
        "老人不知什么时候站在门口：「推不动是剧情，不是 bug。」",
      choices: [
        { id: "push-handle", label: "推一下手柄。", next: "wandering.stop-compare", set: { "wandering.seen.globe": true } },
        { id: "compare-force", label: "2.62×10²² 牛是多少？", next: "wandering.stop-compare" },
        { id: "back", label: "下楼。", next: "wandering.tower" },
      ],
    },

    "wandering.stop-compare": {
      id: "wandering.stop-compare",
      title: "停转厅",
      savepoint: false,
      activeActorIds: ["wandering_host"],
      text:
        "铭牌旁边贴着一张换算表：\n\n" +
        "一台起重机约 2.5 万牛；一枚火箭发动机约 10⁵ 牛。\n\n" +
        "而要在 11.8 小时内让地球停转，按这套算法，需要约 2.62×10²² 牛。\n\n" +
        "「数字来自原作给出的假设。」老人说。「换一个停转时间，需要的力就会变。问题从来不是某一句结论，是这些假设能不能同时成立。」",
      choices: [
        { id: "next-floor", label: "上一层。", next: "wandering.escape-hall" },
        { id: "back", label: "回停转厅。", next: "wandering.stop-hall" },
      ],
    },

    "wandering.escape-hall": {
      id: "wandering.escape-hall",
      title: "二层 · 逃逸厅",
      savepoint: false,
      activeActorIds: ["wandering_host"],
      text:
        "一条环形轨道上，一颗小球永不停歇地追着一块刻着「16.7 km/s」的界碑。\n\n" +
        "它总是差一点。\n\n" +
        "墙上的小字：「第三宇宙速度 16.7 km/s。若用一百年加速，a≈5.3×10⁻⁶ m/s²，F≈3.17×10¹⁹ 牛。」\n\n" +
        "再下面一行：「这远远超出了人类目前能够产生的推力水平，实现起来困难重重。」",
      choices: [
        { id: "ask-never", label: "它永远追不上吗？", next: "wandering.debate-future", set: { "wandering.seen.escape": true } },
        { id: "next-floor", label: "上一层。", next: "wandering.life-hall", set: { "wandering.seen.escape": true } },
        { id: "back", label: "下楼。", next: "wandering.tower" },
      ],
    },

    "wandering.life-hall": {
      id: "wandering.life-hall",
      title: "三层 · 星际厅",
      savepoint: false,
      activeActorIds: ["wandering_host"],
      text:
        "一盏生态灯，灯罩是一颗小小的、有云有海的球。灯以极缓的速率变暗。\n\n" +
        "旁边的天平另一端堆着细沙。\n\n" +
        "「按每年 10²⁴ 焦耳的需求，质能方程给出每年约 1.11×10⁷ 千克的质量。这仅仅是能量供应方面。」\n\n" +
        "沙漏不停，灯就亮着。质量换光。",
      choices: [
        { id: "ask-energy", label: "能量从哪来？", next: "wandering.debate-energy", set: { "wandering.seen.life": true } },
        { id: "next-floor", label: "上一层。", next: "wandering.arrival-hall", set: { "wandering.seen.life": true } },
        { id: "back", label: "下楼。", next: "wandering.tower" },
      ],
    },

    "wandering.arrival-hall": {
      id: "wandering.arrival-hall",
      title: "四层 · 到站厅",
      savepoint: false,
      activeActorIds: ["wandering_host"],
      text:
        "一座巨大的摆钟，钟面只有一根慢到近乎凝滞的指针。\n\n" +
        "铭牌：「发车：2025-02-03。到站：4.3 光年外，单程 4300 年。」\n\n" +
        "指针的读数接的是真实时间戳。你盯着它看了很久，它只往前挪了极微小的一格。\n\n" +
        "「每个玩家在任何时刻来看，它都诚实地走过了同样的微秒。」老人说。「4300 年量程，急不来。」\n\n" +
        "钟侧挂着一块小木牌，是留给未来的：「到站那天，请替作者看一眼半人马座。」",
      choices: [
        { id: "ring-bell", label: "摇一下催更铃。", next: "wandering.arrival-bell", set: { "wandering.seen.clock": true } },
        { id: "back", label: "下楼。", next: "wandering.tower" },
      ],
    },

    "wandering.arrival-bell": {
      id: "wandering.arrival-bell",
      title: "催更铃",
      savepoint: false,
      activeActorIds: ["wandering_host"],
      text:
        "到站钟旁有一枚小铜铃。铭牌上写着一句话：「怎么还没出？」\n\n" +
        "下面没有署名，只有一个日期。\n\n" +
        "你摇了一下。铃声很轻，飞出窗外。\n\n" +
        "老人说：「三十三个游戏日后，公告栏会多一行新展预告。催更到兑现，本来就是一个完整的故事。」",
      choices: [
        { id: "back", label: "回到到站厅。", next: "wandering.arrival-hall" },
      ],
    },

    "wandering.broken": {
      id: "wandering.broken",
      title: "停摆的模拟器",
      savepoint: false,
      activeActorIds: ["wandering_host"],
      text:
        "塔内一角，一台停摆的模拟器。屏幕上是一颗已经飞出画面外的地球。\n\n" +
        "木牌只写着四个字符和一个颜文字：\n\n" +
        "「实验坏了awa」\n\n" +
        "旁边的小字注明：该展品运营了 19 个月，服务过 43337 次访问。\n\n" +
        "「不修，也不遮。」老人说。「损坏是展品历史的一部分。」",
      choices: [
        { id: "go-supplement", label: "去看观众补充展位。", next: "wandering.supplement", set: { "wandering.seen.broken": true } },
        { id: "back", label: "回楼梯。", next: "wandering.tower" },
      ],
    },

    "wandering.supplement": {
      id: "wandering.supplement",
      title: "观众补充展位",
      savepoint: false,
      activeActorIds: ["wandering_host"],
      text:
        "模拟器旁有一面小小的展示墙，专门陈列观众对馆藏的补充演算。\n\n" +
        "第一块上墙的展品标签写着：「一位访客的补充讨论，作者已挂链致谢」。\n\n" +
        "老人说：「后来者的补充，提交给守馆人审核。通过的挂墙。」审核章是一枚小小的「（）」。\n\n" +
        "你可以把演算写在一张卡片上递过去。他看得很慢，逐行看完，才在角落按下一个「（）」。\n\n" +
        "「上墙要等下一批。」他说。「但你的名字会在这座馆里多留一会儿。」",
      choices: [
        { id: "submit", label: "提交一份补充演算。", next: "wandering.tower", set: { "wandering.supplemented": true } },
        { id: "ask-debate", label: "回到争论。", next: "wandering.debate-hub" },
      ],
    },

    "wandering.debate-hub": {
      id: "wandering.debate-hub",
      title: "环廊小桌",
      role: "第三幕 · 分歧与不确定性",
      savepoint: true,
      guide: { title: "流浪地球可行吗", objective: "和守馆人谈完四节计算的不确定性" },
      activeActorIds: ["wandering_host"],
      text:
        "老人把你带到环廊尽头的一张小桌旁。桌上摊着四张纸，分别写着「停转」「逃逸」「航行」「到站」。\n\n" +
        "「很多人在这里吵起来。」他说。「有人觉得算出来不行，就是劝人别做梦；有人觉得未来技术一变，今天的数字就都不算数。」\n\n" +
        "「你想先谈哪一个？」",
      choices: [
        { id: "talk-stop", label: "停转。", next: "wandering.debate-stop" },
        { id: "talk-energy", label: "能量。", next: "wandering.debate-energy" },
        { id: "talk-nav", label: "航行与导航。", next: "wandering.debate-nav" },
        { id: "talk-future", label: "如果未来技术变了呢？", next: "wandering.debate-future" },
        { id: "conclude", label: "我想好了。", next: "wandering.decision" },
      ],
    },

    "wandering.debate-stop": {
      id: "wandering.debate-stop",
      title: "停转的前提",
      savepoint: false,
      activeActorIds: ["wandering_host"],
      text:
        "「停转这一节，最容易让人误会。」老人说。\n\n" +
        "「2.62×10²² 牛是在『11.8 小时停转』这个前提下算出来的。把时间拉长，需要的力会下降，但工程、地质和生态要承受的东西会换一种方式出现。」\n\n" +
        "「所以准确的说法是：这套方案在目前的假设下不可行。至于换一套假设会怎样，需要重新算。」",
      choices: [
        { id: "to-energy", label: "再去谈能量。", next: "wandering.debate-energy", set: { "wandering.debate.stop": true } },
        { id: "back", label: "回到四个问题。", next: "wandering.debate-hub", set: { "wandering.debate.stop": true } },
      ],
    },

    "wandering.debate-energy": {
      id: "wandering.debate-energy",
      title: "能量的账",
      savepoint: false,
      activeActorIds: ["wandering_host"],
      text:
        "「加速和维持生态系统，是两种不同的难。」老人说。\n\n" +
        "「一百年加速到第三宇宙速度，推力是 3.17×10¹⁹ 牛；而按每年 10²⁴ 焦耳的需求，质能方程给出每年约 1.11×10⁷ 千克的质量。」\n\n" +
        "「这些数都建立在原作的参数上。聚变、反物质、恒星能量采集——哪一种能把数量级压下来，目前没有公开答案。」",
      choices: [
        { id: "to-nav", label: "再去谈导航。", next: "wandering.debate-nav", set: { "wandering.debate.energy": true } },
        { id: "back", label: "回到四个问题。", next: "wandering.debate-hub", set: { "wandering.debate.energy": true } },
      ],
    },

    "wandering.debate-nav": {
      id: "wandering.debate-nav",
      title: "4300 年的航线",
      savepoint: false,
      activeActorIds: ["wandering_host"],
      text:
        "「最后一节，最容易被人略过。」老人说。\n\n" +
        "「4.3 光年，按 0.01c 航行，单程 4300 年。末段还要连续减速 3.17 年。」\n\n" +
        "「推力与导航精度，都属于『目前的技术难以实现』。注意，是『目前』。这句话不封死未来，也不替未来担保。」",
      choices: [
        { id: "to-future", label: "那未来呢？", next: "wandering.debate-future", set: { "wandering.debate.nav": true } },
        { id: "back", label: "回到四个问题。", next: "wandering.debate-hub", set: { "wandering.debate.nav": true } },
      ],
    },

    "wandering.debate-future": {
      id: "wandering.debate-future",
      title: "未来与证据",
      savepoint: false,
      activeActorIds: ["wandering_host"],
      text:
        "「如果未来技术突然改变数量级呢？」老人把四张纸收拢。\n\n" +
        "「那就重新算。科学结论允许被更强的证据推翻，前提是证据足够强。」\n\n" +
        "「但在证据出现之前，我们不能把『也许可以』当成『已经可以』。这是两件事。」\n\n" +
        "他顿了顿：「所以这馆不陈列失败。它陈列的是那个被算出来的天文数字本身。」",
      choices: [
        { id: "to-decision", label: "我明白了。", next: "wandering.decision", set: { "wandering.debate.future": true } },
        { id: "back", label: "回到四个问题。", next: "wandering.debate-hub", set: { "wandering.debate.future": true } },
      ],
    },

    "wandering.decision": {
      id: "wandering.decision",
      title: "怎么记住",
      role: "支线 · 抉择",
      savepoint: true,
      guide: { title: "流浪地球可行吗", objective: "决定如何记住这次天问台的访问" },
      activeActorIds: ["wandering_host"],
      text:
        "你们回到环廊。金匾在灯下没有反光，留言墙的十六块木牌安静地挂着。\n\n" +
        "老人问：「你现在打算怎么记住这件事？」",
      choices: [
        {
          id: "measure",
          label: "把结论抄下来：算过了，才说不。",
          next: "wandering.ending-measure",
          set: { "wandering.stance": "measure" },
          effects: [
            { type: "event.publish", eventType: "story.achievement", payload: { id: "wandering_measure", name: "算过了才说不" } },
          ],
        },
        {
          id: "leave-question",
          label: "把问题留在梁上，让它继续被问。",
          next: "wandering.ending-plaque",
          set: { "wandering.stance": "plaque" },
        },
        {
          id: "repair",
          label: "去把损坏的模拟器修好。",
          next: "wandering.ending-repair",
          set: { "wandering.stance": "repair" },
        },
        {
          id: "revisit",
          label: "记住日子，明年二月再回来。",
          next: "wandering.ending-revisit",
          set: { "wandering.stance": "revisit" },
          effects: [
            { type: "event.publish", eventType: "story.achievement", payload: { id: "wandering_next_year", name: "明年二月" } },
          ],
        },
        { id: "back", label: "再想想。", next: "wandering.debate-hub" },
      ],
    },

    "wandering.ending-measure": {
      id: "wandering.ending-measure",
      title: "流浪地球可行吗",
      role: "结局 · 称重",
      savepoint: true,
      presentation: "blackout",
      terminal: true,
      guide: null,
      activeActorIds: ["wandering_host"],
      text:
        "你把四节计算重新抄了一遍。停转、逃逸、航行、到站，每一节都留下一个天文数字。\n\n" +
        "抄到最后，你在纸角写下：\n\n" +
        "「综上所述，从科学理论和实际计算来看，《流浪地球》中的全过程在目前几乎无法成真。」\n\n" +
        "老人看了一眼，没有评价。他只是把纸接过去，夹进留言墙下的抽屉。\n\n" +
        "「算过了，才说不。」他说。「这比直接说不，重得多。」",
    },

    "wandering.ending-plaque": {
      id: "wandering.ending-plaque",
      title: "流浪地球可行吗",
      role: "结局 · 留问",
      savepoint: true,
      presentation: "blackout",
      terminal: true,
      guide: null,
      activeActorIds: ["wandering_host"],
      text:
        "你什么也没带走。\n\n" +
        "走出塔门时，你回头看了一眼塔顶。那个问号形状的风向标还立在那里，七道彩色窄缝在暮色里像七根很细的线。\n\n" +
        "「敢把问题举到最高处，就得替全馆挨雷。」老人在门里说。「但这馆就是为这个建的。」\n\n" +
        "你没有回答。问题留在梁上，也留在你脑子里。",
    },

    "wandering.ending-repair": {
      id: "wandering.ending-repair",
      title: "流浪地球可行吗",
      role: "结局 · 修复",
      savepoint: true,
      presentation: "blackout",
      terminal: true,
      guide: null,
      activeActorIds: ["wandering_host"],
      text:
        "你回到那台停摆的模拟器前。屏幕上的地球已经飞出画面，木牌上的「实验坏了awa」没有动。\n\n" +
        "你没有把牌子摘下来。你只是把松动的电源线重新插好，又擦掉了屏幕边缘的灰。\n\n" +
        "屏幕亮了一下，又暗了。\n\n" +
        "老人站在门口：「修不好也没关系。它坏在这里，也是它历史的一部分。」\n\n" +
        "「你让它多亮了一秒，那一秒也算数。」",
    },

    "wandering.ending-revisit": {
      id: "wandering.ending-revisit",
      title: "流浪地球可行吗",
      role: "结局 · 回访",
      savepoint: true,
      presentation: "blackout",
      terminal: true,
      guide: null,
      activeActorIds: ["wandering_host"],
      text:
        "你在留言墙最边上的空木牌背面，记下了一个日子。\n\n" +
        "老人看见了，没有拦你。\n\n" +
        "「明年二月，门还是从这边开。」他说。「金匾不会换，七色缝也不会换。但你会换。」\n\n" +
        "「到站那天，记得替作者看一眼半人马座。」\n\n" +
        "你走出天问台。北坡的风把塔顶的小旗吹得笔直，旗上写着：「2026又要发重磅实验」。",
    },
  },
};
