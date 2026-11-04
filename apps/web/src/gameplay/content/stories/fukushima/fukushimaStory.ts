import type { StoryDefinition } from "../../../stories/types";

export const FUKUSHIMA_STORY: StoryDefinition = {
  schemaVersion: 1,
  definitionVersion: 1,
  id: "side.fukushima.water",
  title: "福岛核废水",
  startNode: "fukushima.start",
  entryActorId: "fukushima_teacher",

  interactions: [
    { actorId: "fukushima_teacher", nodeId: "fukushima.start", choiceId: "read-wall" },
  ],

  buildingInteractions: [
    { buildingId: "fukushima_reactor", nodeId: "fukushima.start", choiceId: "read-wall" },
  ],

  nodes: {
    "fukushima.start": {
      id: "fukushima.start", title: "新闻反应堆", role: "序章", savepoint: true,
      guide: { title: "福岛核废水", objective: "在新闻反应堆外墙下找到值日讲师" },
      activeActorIds: ["fukushima_teacher"],
      text: "老城西侧的下坡路上，白色圆柱形建筑立在傍晚的风里。顶上探出一圈环形吊车轨道，像一顶戴歪的机械皇冠。\n\n外墙没有馆名，只有一行被截断的小字：\n\n「本来想好好的打个游戏——」\n\n一个穿浅灰工装的人站在门前，胸牌上写着「值日讲师」。他朝那行字抬了抬下巴。\n\n「后面的话，作者没有写完。要进去看全文吗？」",
      choices: [
        { id: "read-wall", label: "走近外墙，读完那行字", next: "fukushima.entry-hall" },
      ],
    },

    "fukushima.entry-hall": {
      id: "fukushima.entry-hall", title: "进料口", role: "第一展厅 · 时事", savepoint: true,
      guide: { title: "福岛核废水", objective: "读进料口的剪报墙" },
      activeActorIds: ["fukushima_teacher"],
      text: "门内是一面剪报墙。手写体大字把外墙那句话补全了：\n\n「本来想好好的打个游戏陪女朋友逛街但是想起福岛核电站我就忍不住就写了这篇文章。」\n\n墙面下方一行小字：「全文只在这里出现一次。外墙留给第一眼。」\n\n剪报墙两侧并排放着两座模型：一边是切尔诺贝利的石棺，围栏上标着「2600 km² · 36 年」；一边是福岛的厂房，标着「<15 年 · 已迁回」。\n\n值日讲师站在两座模型中间，没有先开口。",
      choices: [
        { id: "read-models", label: "走到两座模型之间", next: "fukushima.models", set: { "fukushima.wall.read": true } },
        { id: "ask-teacher", label: "先问讲师：这两个数字在比什么？", next: "fukushima.uncertainty", set: { "fukushima.wall.read": true } },
      ],
    },

    "fukushima.models": {
      id: "fukushima.models", title: "两座模型", role: "第一展厅 · 数据", savepoint: false,
      activeActorIds: ["fukushima_teacher"],
      text: "两座模型之间没有说明牌，只有数字。\n\n石棺那侧的围栏上写着「2600 km² · 36 年」。厂房那侧写着「<15 年 · 已迁回」。两个数字并排站着，谁也不看谁。\n\n讲师说：「这是同一等级的事故，不同口径的记录。展馆把它们放在一起，不替它们和解。」",
      choices: [
        { id: "ask-certainty", label: "这些数字能直接比较吗？", next: "fukushima.uncertainty" },
        { id: "to-pond", label: "往慢化池走", next: "fukushima.pond" },
        { id: "back-entry", label: "再看一眼剪报墙", next: "fukushima.entry-hall" },
      ],
    },

    "fukushima.uncertainty": {
      id: "fukushima.uncertainty", title: "值日讲师", role: "第一展厅 · 数据", savepoint: true,
      activeActorIds: ["fukushima_teacher"],
      text: "「先说清楚一件事。」讲师把手插进工装口袋。\n\n「隔离区面积和迁回时间来自不同年份、不同统计口径，不能直接相减。展馆只负责把数字摆出来，结论要你自己带回去。」\n\n他停了一下。「这里有没有疑问？是否有更大的危机正在酝酿？这是作者的提问。展馆不替他回答。」",
      choices: [
        { id: "to-pond-again", label: "去慢化池看看", next: "fukushima.pond" },
        { id: "to-models-again", label: "回到两座模型前", next: "fukushima.models" },
      ],
    },

    "fukushima.pond": {
      id: "fukushima.pond", title: "慢化池", role: "第二展厅 · 链式反应", savepoint: true,
      guide: { title: "福岛核废水", objective: "在慢化池边推动浓度滑杆" },
      activeActorIds: ["fukushima_teacher"],
      text: "展厅中央是一池清水，一枚铀-235 晶体模型悬在水下。池边有一只旧式滑杆，刻度从 2% 一直推到 85%。\n\n讲师说：「滑杆只是科普装置。真实燃料的丰度与用途还受堆型、同位素比例和工程条件影响，展馆把范围简化成两个端点。」\n\n「你可以推推看。」",
      choices: [
        { id: "slide-low", label: "把滑杆推到 2%～5%", next: "fukushima.pond-low" },
        {
          id: "slide-high", label: "把滑杆推到底", next: "fukushima.pond-high",
          effects: [{ type: "event.publish", eventType: "story.achievement", payload: { id: "fukushima_cant_help", name: "忍不住" } }],
        },
        { id: "read-note", label: "先读池边的解说牌", next: "fukushima.pond-note" },
      ],
    },

    "fukushima.pond-low": {
      id: "fukushima.pond-low", title: "慢化池", role: "第二展厅 · 2%～5%", savepoint: false,
      activeActorIds: ["fukushima_teacher"],
      text: "滑杆停在 2%～5% 之间。池水泛起一层安稳的蓝光，池边的小牌翻到正面：「核电站」。\n\n池边立牌上抄着正文原句，错字也一并保留：\n\n「核电站的铀235的浓度在2%～5%之间与中子慢化结合剂形成链式反应，浓度在85%以上就是核武器。」\n\n讲师说：「这是作者当年的写法。展馆不改他的字。」",
      choices: [
        { id: "to-compare", label: "去双堆对照", next: "fukushima.compare" },
        { id: "back-pond", label: "回到滑杆前", next: "fukushima.pond" },
      ],
    },

    "fukushima.pond-high": {
      id: "fukushima.pond-high", title: "慢化池", role: "第二展厅 · 85%", savepoint: false,
      activeActorIds: ["fukushima_teacher"],
      text: "滑杆被推到底。蓝光转白，池壁的警报轻轻响了一声，又停住。小牌翻面：「核武器」。\n\n池水没有变热，也没有危险。它只是一件展品。\n\n讲师看着水面说：「了解了原理，就再也装作不知道。2022 年，有人也是这样忍不住的。」",
      choices: [
        { id: "to-compare-high", label: "去双堆对照", next: "fukushima.compare" },
        { id: "back-pond-high", label: "回到滑杆前", next: "fukushima.pond" },
      ],
    },

    "fukushima.pond-note": {
      id: "fukushima.pond-note", title: "解说牌", role: "第二展厅 · 静物", savepoint: false,
      activeActorIds: ["fukushima_teacher"],
      text: "池边的解说牌写着一小段话：\n\n「一个中子撞进原子核，释放三个中子。\n三个变九个，九个变二十七个。\n没有人按下开关，它只是——忍不住。\n2022 年 2 月 20 日 12:55，有个少年也是这样开始的。」\n\n牌上没有署名。讲师说：「这一段是展馆写的，不是作者原文。」",
      choices: [
        { id: "slide-low-again", label: "把滑杆推到 2%～5%", next: "fukushima.pond-low" },
        {
          id: "slide-high-again", label: "把滑杆推到底", next: "fukushima.pond-high",
          effects: [{ type: "event.publish", eventType: "story.achievement", payload: { id: "fukushima_cant_help", name: "忍不住" } }],
        },
        { id: "back-note", label: "回到池边", next: "fukushima.pond" },
      ],
    },

    "fukushima.compare": {
      id: "fukushima.compare", title: "双堆对照", role: "第三展厅 · 沸水堆", savepoint: true,
      guide: { title: "福岛核废水", objective: "看完双堆对照，结束三段展廊" },
      activeActorIds: ["fukushima_teacher"],
      text: "环廊尽头，两座剖面模型背靠背摆着。一边标着 RBMK，一边标着 BWR。同一套水流灯效在两具躯体里循环：加热、沸腾、推动汽轮机、冷凝、回水。\n\n两座模型之间没有高下之分，只有管道走向的差别。\n\n讲师说：「这里讲的是原理。事件本身的是非，展厅不做陈列。」",
      choices: [
        { id: "read-base", label: "读基座上的刻字", next: "fukushima.compare-base" },
        { id: "press-rods", label: "按住控制棒按钮", next: "fukushima.compare-rods" },
        { id: "back-pond-compare", label: "回到慢化池", next: "fukushima.pond" },
      ],
    },

    "fukushima.compare-rods": {
      id: "fukushima.compare-rods", title: "控制棒", role: "第三展厅 · 控制棒", savepoint: false,
      activeActorIds: ["fukushima_teacher"],
      text: "你按住控制棒按钮。模型里的中子灯一颗接一颗熄灭，水流还在循环，但链式反应慢了下来。\n\n讲师说：「控制棒吸收中子。真正停堆还要考虑衰变热，模型没有画那一层。」\n\n灯全灭之后，模型基座上那行字露了出来。",
      choices: [
        { id: "to-base", label: "去看基座", next: "fukushima.compare-base" },
        { id: "finish-hall", label: "三段展廊看完了", next: "fukushima.hall-complete" },
      ],
    },

    "fukushima.compare-base": {
      id: "fukushima.compare-base", title: "基座刻字", role: "第三展厅 · 总结", savepoint: false,
      activeActorIds: ["fukushima_teacher"],
      text: "基座上刻着作者当年的一句话：\n\n「那我们应该暂时不要在纠结责任的问题了。」\n\n讲师说：「原文如此，『在』字是手误。这是作者的个人判断，不是展馆的结论。」\n\n他后退半步，让那行字完整地露在灯下。「三段展廊到这里就结束了。」",
      choices: [
        { id: "to-rods", label: "再看一眼控制棒", next: "fukushima.compare-rods" },
        { id: "finish-hall-2", label: "三段展廊看完了", next: "fukushima.hall-complete" },
      ],
    },

    "fukushima.hall-complete": {
      id: "fukushima.hall-complete", title: "三段展廊", role: "第二幕 · 读完", savepoint: true,
      activeActorIds: ["fukushima_teacher"],
      text: "你在进料口、慢化池和双堆对照前各停了一次。三块展签上的字已经被你读顺了。\n\n讲师把一枚小小的展馆票根递给你。「看完的人不多。留个记号吧。」",
      choices: [
        {
          id: "finish-galleries", label: "接过票根，走向出口", next: "fukushima.doors",
          effects: [{ type: "event.publish", eventType: "story.achievement", payload: { id: "fukushima_eyestrain", name: "眼都花了" } }],
        },
      ],
    },

    "fukushima.doors": {
      id: "fukushima.doors", title: "术语双门", role: "第三幕 · 出口", savepoint: true,
      guide: { title: "福岛核废水", objective: "从核废水或核污水任意一扇门走出去" },
      activeActorIds: ["fukushima_teacher"],
      text: "出口的墙裂成两扇并排的门。左门牌「核废水」，右门牌「核污水」。两扇门一样高、一样宽、一样的灯光。\n\n门楣上的石碑刻着一句问话：\n\n「应该是核污水吧?」\n\n碑上没有落款。两扇门后是同一个出口。",
      choices: [
        { id: "walk-left", label: "从左门「核废水」走出去", next: "fukushima.door-left" },
        { id: "walk-right", label: "从右门「核污水」走出去", next: "fukushima.door-right" },
        {
          id: "walk-through", label: "把手按在门缝上，走出去", next: "fukushima.after-doors",
          availableWhen: [
            { type: "flag.equals", flagId: "fukushima.door.left", value: true },
            { type: "flag.equals", flagId: "fukushima.door.right", value: true },
          ],
        },
      ],
    },

    "fukushima.door-left": {
      id: "fukushima.door-left", title: "左门", role: "第三幕 · 出口", savepoint: false,
      text: "你从「核废水」那扇门走出去。门后是一条短短的回廊，灯很安静。\n\n回廊尽头没有岔路。你回头看了一眼，右门也在同一个方向。",
      choices: [
        { id: "left-back", label: "回到门前", next: "fukushima.doors", set: { "fukushima.door.left": true } },
      ],
    },

    "fukushima.door-right": {
      id: "fukushima.door-right", title: "右门", role: "第三幕 · 出口", savepoint: false,
      text: "你从「核污水」那扇门走出去。门后是一条短短的回廊，灯很安静。\n\n回廊尽头没有岔路。你回头看了一眼，左门也在同一个方向。",
      choices: [
        { id: "right-back", label: "回到门前", next: "fukushima.doors", set: { "fukushima.door.right": true } },
      ],
    },

    "fukushima.after-doors": {
      id: "fukushima.after-doors", title: "回廊", role: "第三幕 · 同一个出口", savepoint: true,
      activeActorIds: ["fukushima_teacher"],
      text: "你在两扇门之间走了一个来回。最后一次回头时，两扇门在视野里合成一道缝。\n\n讲师在回廊尽头等你。「你走了两遍，出口只有一个。」\n\n「用词之争没有标准答案。展馆把两种说法并排挂着，只记录争议存在。」",
      choices: [
        {
          id: "to-inquiry", label: "继续走向问询机", next: "fukushima.inquiry",
          effects: [{ type: "event.publish", eventType: "story.achievement", payload: { id: "fukushima_two_doors", name: "两扇门" } }],
        },
      ],
    },

    "fukushima.inquiry": {
      id: "fukushima.inquiry", title: "问询机", role: "第四幕 · 精选之争", savepoint: true,
      guide: { title: "福岛核废水", objective: "在问询机前选一个问题" },
      activeActorIds: ["fukushima_inquirer"],
      text: "回廊尽头立着一台老式问询机。屏幕永远亮着，滚着一行字：\n\n「他们为什么是精选？ ——凌晨 04:13」\n\n机器下方有一道出纸口。你靠近时，它吐出一张空白纸条。",
      choices: [
        { id: "ask-featured", label: "他们为什么是精选？", next: "fukushima.inquiry-featured" },
        { id: "ask-typos", label: "这堆展板有错字，能改吗？", next: "fukushima.inquiry-typos" },
        { id: "ask-summary", label: "能帮我总结一下这个馆吗？", next: "fukushima.inquiry-summary" },
        { id: "stand-silent", label: "（只是站着）", next: "fukushima.inquiry-silent" },
        { id: "leave-machine", label: "离开问询机", next: "fukushima.courtyard" },
      ],
    },

    "fukushima.inquiry-featured": {
      id: "fukushima.inquiry-featured", title: "问询机", role: "第四幕 · 检索", savepoint: false,
      activeActorIds: ["fukushima_inquirer"],
      text: "问询机：正在检索精选标准……检索完毕。本机无法回答该问题。\n\n（停顿两秒，再吐一张纸条）\n\n问询机：补充记录：该问题于一年前首次被提出，至今无人领走答案。",
      choices: [
        { id: "featured-back", label: "再问一个问题", next: "fukushima.inquiry" },
        { id: "featured-leave", label: "离开问询机", next: "fukushima.courtyard" },
      ],
    },

    "fukushima.inquiry-typos": {
      id: "fukushima.inquiry-typos", title: "问询机", role: "第四幕 · 错字", savepoint: false,
      activeActorIds: ["fukushima_inquirer"],
      text: "问询机：检测到错字 11 处：轴铀、油矿、电轮机、爱次、Parr3……\n\n问询机：修改权限：所有人。修改意愿：零。\n\n问询机：本馆展板保留作者手打原貌。错字是时间的一部分。",
      choices: [
        { id: "typos-back", label: "再问一个问题", next: "fukushima.inquiry" },
        { id: "typos-leave", label: "离开问询机", next: "fukushima.courtyard" },
      ],
    },

    "fukushima.inquiry-summary": {
      id: "fukushima.inquiry-summary", title: "问询机", role: "第四幕 · 摘要", savepoint: false,
      activeActorIds: ["fukushima_inquirer"],
      text: "问询机：正在生成摘要……\n\n（纸条吐出一半，卡住，三秒后缓缓缩回）\n\n问询机：生成失败。原因：未知。\n\n（再停顿）\n\n问询机：去年也有人问过同样的问题。抱歉，两次都是这样。",
      choices: [
        { id: "summary-back", label: "再问一个问题", next: "fukushima.inquiry" },
        { id: "summary-leave", label: "离开问询机", next: "fukushima.courtyard" },
      ],
    },

    "fukushima.inquiry-silent": {
      id: "fukushima.inquiry-silent", title: "问询机", role: "第四幕 · 低语", savepoint: false,
      activeActorIds: ["fukushima_inquirer"],
      text: "问询机：（每 30 秒循环低语）\n\n——「123 个支持？」\n\n——「应该是核污水吧?」\n\n——「他们为什么是精选？」\n\n——「到底是……什么事？」\n\n四句循环，音量渐弱，像池水降温。你在机器前站了很久，久到回廊的灯只剩一层薄光。",
      choices: [
        {
          id: "stay-until-four", label: "再站一会儿", next: "fukushima.inquiry",
          effects: [{ type: "event.publish", eventType: "story.achievement", payload: { id: "fukushima_four_am", name: "凌晨四点的问题" } }],
        },
        { id: "silent-leave", label: "离开问询机", next: "fukushima.courtyard" },
      ],
    },

    "fukushima.courtyard": {
      id: "fukushima.courtyard", title: "庭院", role: "第五幕 · 馆外", savepoint: true,
      guide: { title: "福岛核废水", objective: "在庭院里看看冷却池、摘要亭、小贩车和长椅" },
      text: "从问询机的回廊出来，是一片窄窄的庭院。安全壳外侧绕着半圈浅水，水面下隐约有一层一层的沉积。\n\n庭院另一头，玻璃亭亮着慢速滚动的屏幕；坡下停着一辆小贩车；大门外，一张双人长椅正对着下坡路。\n\n讲师没有跟出来。",
      choices: [
        { id: "go-pool", label: "走到冷却池边", next: "fukushima.pool" },
        { id: "go-pavilion", label: "去摘要亭", next: "fukushima.pavilion" },
        { id: "go-vendor", label: "去坡下的小贩车", next: "fukushima.vendor" },
        { id: "go-bench", label: "去大门外的长椅", next: "fukushima.bench" },
        { id: "leave-courtyard", label: "回到外墙下找讲师", next: "fukushima.teacher-return" },
      ],
    },

    "fukushima.pool": {
      id: "fukushima.pool", title: "冷却池", role: "第五幕 · 评论沉积", savepoint: true,
      text: "池水很浅，环着安全壳半周。水面下能看到一层一层的沉积，数到第 16 层就到了底。\n\n池底一块铜牌：\n\n「本池可读 16 层，其下 175 层已封存。\n——不是消失，是水太深。」\n\n池边石阶上散落着几枚考古标签。",
      choices: [
        {
          id: "collect-tags", label: "拾起石阶上的考古标签", next: "fukushima.pool-tags",
          effects: [{ type: "event.publish", eventType: "story.achievement", payload: { id: "fukushima_archaeologist", name: "考古学家" } }],
        },
        { id: "throw-link", label: "把作品链接牌投进池里", next: "fukushima.pool-link" },
        { id: "read-plaque", label: "俯身读池底铜牌", next: "fukushima.pool-plaque" },
        { id: "back-courtyard", label: "回到庭院", next: "fukushima.courtyard" },
      ],
    },

    "fukushima.pool-tags": {
      id: "fukushima.pool-tags", title: "考古标签", role: "第五幕 · 沉积层", savepoint: false,
      text: "你拾起石阶上的标签。每一枚都只印着一句从评论区抄下来的话，上下文已经不见了。\n\n「话说到底是什么事？」\n「我看介绍看到眼都花了。」\n「这个应该是水实验吧。」\n\n最后一块标签背面写着一行小字：「2024 年 11 月，有人读到那半句话，笑出了声。」",
      choices: [
        { id: "tags-back", label: "把标签放回石阶", next: "fukushima.pool" },
      ],
    },

    "fukushima.pool-link": {
      id: "fukushima.pool-link", title: "作品链接牌", role: "第五幕 · 一枚中子", savepoint: false,
      text: "池边挂着一块薄薄的木牌，上面印着这篇作品的标题和链接。\n\n你把木牌取下来，投进水里。它没有沉，只是浮在第十六层上面，慢慢转了一圈。\n\n讲师的声音从身后传来：「有人真的这么做过。把作品本身，投进了它自己的评论区。」",
      choices: [
        {
          id: "link-back", label: "看着木牌漂远", next: "fukushima.pool",
          effects: [{ type: "event.publish", eventType: "fukushima.pool.link" }],
        },
      ],
    },

    "fukushima.pool-plaque": {
      id: "fukushima.pool-plaque", title: "池底铜牌", role: "第五幕 · 封存", savepoint: false,
      text: "你俯身去看池底的铜牌。\n\n「本池可读 16 层，其下 175 层已封存。\n——不是消失，是水太深。」\n\n水很清，但再往下就看不见了。",
      choices: [
        { id: "plaque-back", label: "直起身", next: "fukushima.pool" },
      ],
    },

    "fukushima.pavilion": {
      id: "fukushima.pavilion", title: "摘要亭", role: "第五幕 · AI 读过", savepoint: true,
      text: "庭院外侧有一座玻璃亭。亭内一块屏幕慢慢滚动，逐字显示一份机器生成的摘要：\n\n「文章讨论了福岛核电站事故及其对全球环境的潜在影响，表达了作者对……的不满和担忧。」\n\n亭角的记录牌只写着一件事：\n\n「2025 年 7 月 15 日，有人在此召唤过摘要。\n机器沉默。」\n\n记录牌上没有名字。",
      choices: [
        { id: "pavilion-back", label: "回到庭院", next: "fukushima.courtyard" },
      ],
    },

    "fukushima.vendor": {
      id: "fukushima.vendor", title: "小贩车", role: "隐藏层 · 二创", savepoint: true,
      activeActorIds: ["fukushima_vendor_doll"],
      text: "坡下停着一辆小贩车，车篷上挂着歪歪扭扭的幌子：「冲精提取DNA——paperYY 8.70%」。\n\n摊位上摆着香蕉、洗洁精和食盐。摊主是一只打瞌睡的机械玩偶，胸口贴着「如何提取DNA……」的纸条。\n\n它没有醒。",
      choices: [
        {
          id: "wake-doll", label: "敲敲摊位，听它说梦话", next: "fukushima.vendor-dream",
          effects: [{ type: "event.publish", eventType: "story.achievement", payload: { id: "fukushima_check_report", name: "查重报告" } }],
        },
        { id: "leave-vendor", label: "不打扰它", next: "fukushima.courtyard" },
      ],
    },

    "fukushima.vendor-dream": {
      id: "fukushima.vendor-dream", title: "机械玩偶", role: "隐藏层 · 梦话", savepoint: false,
      activeActorIds: ["fukushima_vendor_doll"],
      text: "玩偶的喇叭响了一下，像是梦里翻了个身。\n\n「重复率……8.70%……」\n\n「热爱率……100%……」\n\n它又睡过去了。摊位上那三样东西还摆得整整齐齐。",
      choices: [
        { id: "dream-back", label: "回到庭院", next: "fukushima.courtyard" },
      ],
    },

    "fukushima.bench": {
      id: "fukushima.bench", title: "馆前长椅", role: "第六幕 · 分寸", savepoint: true,
      text: "大门外，一张双人长椅正对着下坡路。\n\n左边椅背铭牌：「Emeritus / Problem is me. / ——2023 年 5 月 21 日上午，他替这篇作品做了最后一次整理。」\n\n右边椅背铭牌：「你还坐在小时候的篝火旁 / 2021.3 —」。落款处只有起年份，没有终年份。\n\n扶手上钉着一块小小的馆舍手记。",
      choices: [
        { id: "read-handnote", label: "读扶手上的馆舍手记", next: "fukushima.bench-sit" },
        { id: "sit-bench", label: "在长椅上坐下", next: "fukushima.ending-bench" },
        { id: "leave-bench", label: "离开长椅", next: "fukushima.teacher-return" },
      ],
    },

    "fukushima.bench-sit": {
      id: "fukushima.bench-sit", title: "馆舍手记", role: "第六幕 · 长椅", savepoint: false,
      text: "「本馆作者后来离开了社区。\n离开的方式，不在本馆的展出范围。\n他在离开前说过：『我为社区做的已经足够多了。』\n这句话真假几何，各人自行称量。\n长椅留给坐的人，不留给评判。」\n\n你把目光从铭牌上移开。下坡路上没有人经过。",
      choices: [
        { id: "stand-up", label: "站起来，回到外墙下", next: "fukushima.teacher-return" },
      ],
    },

    "fukushima.teacher-return": {
      id: "fukushima.teacher-return", title: "值日讲师", role: "第七幕 · 怎么讨论", savepoint: true,
      guide: { title: "福岛核废水", objective: "回答讲师最后一个问题" },
      activeActorIds: ["fukushima_teacher"],
      text: "讲师在外墙下等你。天色暗了，安全壳顶上的环形轨道亮起一圈冷白灯。\n\n「看完了。」他说。「最后一个问题，不是关于福岛，是关于我们怎么谈福岛。」\n\n「如果两块展板上的数字彼此冲突，你会怎么讨论？」",
      choices: [
        { id: "path-evidence", label: "先问数字从哪来", next: "fukushima.dispute-evidence" },
        { id: "path-uncertainty", label: "先承认自己不知道", next: "fukushima.dispute-uncertainty" },
        { id: "path-voices", label: "先让不同的声音都留在桌上", next: "fukushima.dispute-voices" },
        { id: "path-single", label: "只保留一个最可信的结论", next: "fukushima.dispute-single" },
      ],
    },

    "fukushima.dispute-evidence": {
      id: "fukushima.dispute-evidence", title: "值日讲师", role: "第七幕 · 证据", savepoint: false,
      activeActorIds: ["fukushima_teacher"],
      text: "「先问数字从哪来。」讲师点头。「年份、口径、统计机构、测量方法。先分清事实与立场，再谈立场之间的差别。」\n\n「这不是把问题推给专家。是把问题放回它能被检验的地方。」",
      choices: [
        { id: "evidence-to-open", label: "带着这个问题离开", next: "fukushima.ending-open" },
        { id: "evidence-to-ledger", label: "把这几句话记下来", next: "fukushima.ending-ledger" },
        { id: "evidence-back", label: "再想想", next: "fukushima.teacher-return" },
      ],
    },

    "fukushima.dispute-uncertainty": {
      id: "fukushima.dispute-uncertainty", title: "值日讲师", role: "第七幕 · 不确定", savepoint: false,
      activeActorIds: ["fukushima_teacher"],
      text: "「先承认不知道。」讲师说。「展馆里所有数字都有边界。物理原理能算清楚链式反应，算不清楚每一个受影响的人怎么生活。」\n\n「把不确定说出来，讨论才有地方落脚。」",
      choices: [
        { id: "uncertainty-to-open", label: "带着这个问题离开", next: "fukushima.ending-open" },
        { id: "uncertainty-to-ledger", label: "把这几句话记下来", next: "fukushima.ending-ledger" },
        { id: "uncertainty-back", label: "再想想", next: "fukushima.teacher-return" },
      ],
    },

    "fukushima.dispute-voices": {
      id: "fukushima.dispute-voices", title: "值日讲师", role: "第七幕 · 多方", savepoint: false,
      activeActorIds: ["fukushima_teacher"],
      text: "「让不止一个声音留在桌上。」讲师看着那两扇门的方向。「核废水还是核污水，两扇门后是同一个出口。词不一样，担心的东西可能是同一件事。」\n\n「先听完，再决定自己要站在哪。」",
      choices: [
        { id: "voices-to-ledger", label: "把这几句话记下来", next: "fukushima.ending-ledger" },
        { id: "voices-to-open", label: "带着这个问题离开", next: "fukushima.ending-open" },
        { id: "voices-back", label: "再想想", next: "fukushima.teacher-return" },
      ],
    },

    "fukushima.dispute-single": {
      id: "fukushima.dispute-single", title: "值日讲师", role: "第七幕 · 一个结论", savepoint: false,
      activeActorIds: ["fukushima_teacher"],
      text: "「只保留一个结论最省事。」讲师没有反驳，只是把视线移回外墙那行字。\n\n「省事不等于清楚。展馆里并排挂着的数字，本来就是为了让它们互相打扰。」\n\n「你可以带着一个结论走。只要记得它是怎么来的。」",
      choices: [
        { id: "single-to-open", label: "带着这个结论离开", next: "fukushima.ending-open" },
        { id: "single-back", label: "再想想", next: "fukushima.teacher-return" },
      ],
    },

    "fukushima.ending-open": {
      id: "fukushima.ending-open", title: "福岛核废水", role: "结局 · 未决", savepoint: false,
      presentation: "blackout", terminal: true, guide: null,
      text: "你走出新闻反应堆。下坡路很长，老城的灯一盏一盏亮起来。\n\n外墙那行字在背后，仍然是半句。\n\n你没有得到一个可以带走的答案。你带走的是几个还没有互相说服的数字，和一台说「无法回答」的机器。\n\n这也许就是它想留下的东西。",
    },

    "fukushima.ending-bench": {
      id: "fukushima.ending-bench", title: "福岛核废水", role: "结局 · 长椅", savepoint: false,
      presentation: "blackout", terminal: true, guide: null,
      text: "你在长椅上坐下。左边铭牌和右边铭牌都没有看你，下坡路上偶尔有人经过。\n\n风从安全壳顶上绕下来，带着一点金属味。\n\n你没有评判谁。你只是坐了一会儿，像所有后来的人一样。\n\n长椅留给坐的人。",
    },

    "fukushima.ending-ledger": {
      id: "fukushima.ending-ledger", title: "福岛核废水", role: "结局 · 讨论守则", savepoint: false,
      presentation: "blackout", terminal: true, guide: null,
      text: "你回到庭院，把一路读到的东西在心里排成几行：\n\n先分清事实与立场。\n把不确定说出来。\n让不止一个声音留在桌上。\n\n不是每一条都能做到。但下一次再看到「福岛」两个字时，你知道该先问什么。\n\n新闻反应堆的灯在你身后慢慢暗下去。",
    },
  },
};
