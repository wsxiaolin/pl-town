import type { StoryDefinition } from "../../../stories/types";

export const RECRUIT_STORY: StoryDefinition = {
  schemaVersion: 1,
  definitionVersion: 1,
  id: "side.recruit.everyone",
  title: "所有人都要招",
  startNode: "lobby_arrival",
  entryActorId: "recruit_youmang",
  interactions: [{ actorId: "recruit_youmang", nodeId: "lobby_arrival", choiceId: "enter-front-desk" }],
  buildingInteractions: [{ buildingId: "west_research_dept", nodeId: "lobby_arrival", choiceId: "enter-front-desk" }],
  nodes: {
    "lobby_arrival": {
      id: "lobby_arrival",
      title: "西山研究部",
      role: "序章",
      guide: { title: "所有人都要招", objective: "走进西山研究部，向前台登记" },
      activeActorIds: ["recruit_youmang"],
      text: `高地院子里的两层小楼挂着新牌子：西山研究部。\n\n门虚掩着，里面有人在登记簿上写字。走廊深处传来搬动柜子的声音。`,
      choices: [
        { id: "enter-front-desk", label: "（走向前台）", next: "lobby_front_desk", set: { "recruit.state": 0 } },
      ],
    },

    "lobby_front_desk": {
      id: "lobby_front_desk",
      title: "溯叶悠芒",
      role: "前台 · 登记官",
      guide: { title: "所有人都要招", objective: "和前台登记官谈谈入册" },
      activeActorIds: ["recruit_youmang"],
      text: `悠芒：（头也不抬，在登记簿上写字）「发布一个收容物就可以加入噢。」\n\n（抬头看你）啊，新面孔。楼下认领了吗？墙认东西，楼上认人——都是同一堵楼。`,
      choices: [
        { id: "ask-recruit", label: "这里是在招人吗？", next: "lobby_recruit_rule" },
        { id: "claim-return", label: "我确认过了，楼下已经认领。", next: "lobby_claim", availableWhen: [{ type: "flag.equals", flagId: "recruit.state", value: 1 }] },
        { id: "ask-leader", label: "你是这里的负责人？", next: "lobby_leader" },
        { id: "go-wall", label: "（走向名牌墙）", next: "wall_hub" },
      ],
    },

    "lobby_recruit_rule": {
      id: "lobby_recruit_rule",
      title: "溯叶悠芒",
      role: "前台 · 登记官",
      activeActorIds: ["recruit_youmang"],
      text: `悠芒：招。「所有人都要招」——楼里每块牌都写着这句的下半句：「只要一篇投稿就能成为研究员。」\n\n他把登记簿往前推了推。「研究员可以自行报名，有时间的话我会出故事的。」`,
      choices: [
        { id: "claim-done", label: "我在楼下认领过一篇了。", next: "lobby_claim", set: { "recruit.state": 1 }, availableWhen: [{ type: "flag.equals", flagId: "recruit.state", value: 0 }] },
        { id: "ask-minutes", label: "研究部是什么时候建的？", next: "lobby_minutes", set: { "recruit.fragment.desk": true } },
        { id: "back-front", label: "（回前台）", next: "lobby_front_desk" },
      ],
    },

    "lobby_minutes": {
      id: "lobby_minutes",
      title: "前台台账",
      activeActorIds: ["recruit_youmang"],
      text: `悠芒：（翻台账，翻到最后，愣了一下，念）「研究部挂牌 10:03:20——比编号列表早 63 秒。别问为什么，我也不知道。」\n\n他合上本子。「……这句不是我写的。谁写的？你问问部长。」`,
      choices: [
        { id: "minutes-to-wall", label: "（去看看名牌墙）", next: "wall_hub" },
        { id: "minutes-back", label: "（回前台）", next: "lobby_front_desk" },
      ],
    },

    "lobby_leader": {
      id: "lobby_leader",
      title: "溯叶悠芒",
      activeActorIds: ["recruit_youmang"],
      text: `悠芒：不是噢，我管的是墙。话事人是楼上那位——不对，部长也是楼上那位——（翻登记簿）算了，都在楼上。我只管墙。`,
      choices: [
        { id: "leader-to-wall", label: "（走向名牌墙）", next: "wall_hub" },
        { id: "leader-back", label: "（回前台）", next: "lobby_front_desk" },
      ],
    },

    "wall_hub": {
      id: "wall_hub",
      title: "名牌墙",
      role: "一层大厅",
      guide: { title: "所有人都要招", objective: "读一读大厅里的百格名牌墙" },
      text: `一层大厅的主墙有一百格。001 到 100，四十一块名牌，五十九个空号原样保留。二十三块牌挂着自设，十八块写着「暂无自设」。\n\n001 沃尔夫冈，B级，第一块牌不是建墙的人；030 ENTP不取名，前A级，全墙唯一带「前」的等级；091 邪恶莫蒂，D级，全墙唯一的 D；083 小提琴男孩，A级，研究部部长，牌和人一样普通；100 一只三角猫，C-级，墙到这里正好用完。\n\n墙顶有一行注释：建墙的人不在墙上。第 100 格下方，有一行肉眼几乎看不见的白字。`,
      choices: [
        { id: "read-white", label: "（贴墙看那行白字）", next: "wall_white_locked" },
        { id: "read-white-open", label: "（白字在反光）", next: "wall_white_open", availableWhen: [{ type: "flag.equals", flagId: "recruit.state", value: 4 }] },
        { id: "wall-to-corridor", label: "（去研究员走廊）", next: "corridor_hub" },
        { id: "wall-back-front", label: "（回前台）", next: "lobby_front_desk" },
      ],
    },

    "wall_white_locked": {
      id: "wall_white_locked",
      title: "名牌墙",
      text: `你贴着墙换了几个角度。墙面很干净。\n\n只有一行很淡的印子，像是有字在更深处反光，但现在还看不见。`,
      choices: [
        { id: "locked-to-wall", label: "（退开一点）", next: "wall_hub" },
        { id: "locked-back-front", label: "（回前台）", next: "lobby_front_desk" },
      ],
    },

    "lobby_claim": {
      id: "lobby_claim",
      title: "溯叶悠芒",
      role: "前台 · 入册",
      activeActorIds: ["recruit_youmang"],
      text: `悠芒：（登记簿翻到新的一页）哟，你写了一篇。楼下墙收了？那这边——「话说我是不是也可以报名了」？（笑）这句这半年我听了四遍。`,
      choices: [
        { id: "can-register", label: "我可以报名了。", next: "lobby_pick_number" },
        { id: "claim-wait", label: "（先不报名）", next: "lobby_front_desk" },
      ],
    },

    "lobby_pick_number": {
      id: "lobby_pick_number",
      title: "三块空牌",
      role: "前台 · 选号",
      activeActorIds: ["recruit_youmang"],
      text: `悠芒：（拿笔）「070吧」——这句不是我说的，是清风若水自己挑的号。你自己挑一个，墙上的空号都是门。\n\n号是人的，不是顺序的。有人走了号还留着；有人回来，重新拿一个。墙不删牌。\n\n【桌上摆着三块空牌：026 / 050 / 098】`,
      choices: [
        { id: "pick-026", label: "026", next: "lobby_register", set: { "recruit.number": "026", "recruit.state": 2 }, effects: [{ type: "event.publish", eventType: "story.achievement", payload: { id: "recruit_everyone", name: "所有人都要招" } }] },
        { id: "pick-050", label: "050", next: "lobby_register", set: { "recruit.number": "050", "recruit.state": 2 }, effects: [{ type: "event.publish", eventType: "story.achievement", payload: { id: "recruit_everyone", name: "所有人都要招" } }] },
        { id: "pick-098", label: "098", next: "lobby_register", set: { "recruit.number": "098", "recruit.state": 2 }, effects: [{ type: "event.publish", eventType: "story.achievement", payload: { id: "recruit_everyone", name: "所有人都要招" } }] },
        { id: "pick-back", label: "（再想想）", next: "lobby_claim" },
      ],
    },

    "lobby_register": {
      id: "lobby_register",
      title: "溯叶悠芒",
      role: "前台 · 入册",
      guide: { title: "所有人都要招", objective: "听完入册说明，去走廊看看" },
      activeActorIds: ["recruit_youmang"],
      text: `悠芒：（写完最后一笔，把登记簿转过来给你看）你的名字，在上面了。\n\n（合上本子）「OK啦。」——这句是跟清风若水学的，用得顺口。\n\n研究员证拿着。C-级，「暂无自设」。`,
      choices: [
        { id: "ask-no-resume", label: "暂无自设是什么意思？", next: "lobby_resume_talk" },
        { id: "go-form", label: "自设怎么写？", next: "lobby_resume_talk" },
        { id: "ask-promotion", label: "我什么时候升级？", next: "lobby_promotion" },
        { id: "register-to-corridor", label: "（去走廊）", next: "corridor_hub" },
      ],
    },

    "lobby_promotion": {
      id: "lobby_promotion",
      title: "溯叶悠芒",
      role: "前台 · 升迁问答",
      activeActorIds: ["recruit_youmang"],
      text: `悠芒：「西山特色申请才升（）」\n\n（背书）写档案，升得快；交简历，算入册；一直写，字数和质量到了，申请，审批，升。\n\n（放下登记簿，看你）其实没什么玩家版。这楼里没有「升到头」，只有「还在写」。墙上 083，部长，A级——他也在写。都还在写。\n\n（翻出权限手册，指给你看那行小字，收回）手册原文，我不评论。（顿）这楼里没有 D 的路，门在那边。（指向墙上 091 那块牌）D 牌全墙就一块。别学他。`,
      choices: [
        { id: "promotion-back", label: "（回前台）", next: "lobby_register" },
        { id: "promotion-corridor", label: "（去走廊）", next: "corridor_hub" },
      ],
    },

    "lobby_resume_talk": {
      id: "lobby_resume_talk",
      title: "溯叶悠芒",
      activeActorIds: ["recruit_youmang"],
      text: `悠芒：字面意思噢，墙不催简历。全楼四十一块牌，十八块都还「暂无自设」呢。想写的时候，一层走廊那张「自设简历表」就是了。交不交，牌都在。\n\n（想了想，从抽屉里翻出一张便签抄了一行字递给你）楼主的原话，比我讲得好：「照着他们的写，可以随心所欲一点。」`,
      choices: [
        { id: "resume-talk-fill", label: "去填自设简历表", next: "resume_form" },
        { id: "resume-talk-back", label: "（回前台）", next: "lobby_register" },
      ],
    },

    "resume_form": {
      id: "resume_form",
      title: "自设简历表",
      role: "一层走廊",
      text: `一层走廊的小桌上放着一张「自设简历表」。四个空栏：姓名、代号、一个技能、一个怪癖。每栏限二十四个字。\n\n表旁贴着一张便签：「照着他们的写，可以随心所欲一点。」`,
      choices: [
        { id: "submit-resume", label: "交表", next: "resume_submitted", set: { "recruit.state": 3 }, effects: [{ type: "event.publish", eventType: "story.achievement", payload: { id: "recruit_ok", name: "OK啦" } }] },
        { id: "resume-think", label: "（再想想）", next: "corridor_hub" },
      ],
    },

    "resume_submitted": {
      id: "resume_submitted",
      title: "有自设",
      role: "一层走廊",
      guide: { title: "所有人都要招", objective: "去二层档案互审室看看自己的档案" },
      text: `你把表交上去。悠芒看了一遍，没改，收进抽屉。\n\n「OK啦。」\n\n过了一会儿，大厅那面墙上，你选的空号旁边多了一行小字。名牌从「暂无自设」变成了「有自设」。二层档案互审室的门也开了。`,
      choices: [
        { id: "submitted-to-review", label: "去二层档案互审室", next: "review_room" },
        { id: "submitted-to-corridor", label: "回走廊", next: "corridor_hub" },
      ],
    },

    "corridor_hub": {
      id: "corridor_hub",
      title: "研究员走廊",
      role: "自由交互",
      guide: { title: "所有人都要招", objective: "在六间办公室之间自由走走" },
      text: `研究员走廊两侧是六扇门：066 面试间、004 副部长室、037 玩具间、054 乙式起居室；二层是 083 部长室和档案互审室。走廊尽头还有一面白墙、一排新装的分类柜、一扇永远虚掩的编外之门。\n\n旧讲台上摆着五块蒙灰的铭牌。两个没有脸的工人正把最后一排柜子推进墙里。`,
      choices: [
        { id: "enter-066", label: "066 面试间", next: "office_066" },
        { id: "enter-004", label: "004 副部长室", next: "office_004" },
        { id: "enter-037", label: "037 玩具间", next: "office_037" },
        { id: "enter-054", label: "054 乙式起居室", next: "office_054" },
        { id: "enter-083", label: "083 部长室", next: "office_083" },
        { id: "enter-review", label: "档案互审室", next: "review_room" },
        { id: "enter-cabinet", label: "（看看新装的分类柜）", next: "cabinet_event" },
        { id: "enter-yilintong", label: "（和抱档案的人打招呼）", next: "yilintong_encounter" },
        { id: "enter-white", label: "（走廊尽头的白墙）", next: "wall_white_open", availableWhen: [{ type: "flag.equals", flagId: "recruit.state", value: 4 }] },
        { id: "enter-side-door", label: "（推开虚掩的编外之门）", next: "ending_side_door" },
        { id: "trace-109", label: "（把三个时间碎片拼起来）", next: "ending_109", availableWhen: [{ type: "flag.equals", flagId: "recruit.fragment.desk", value: true }, { type: "flag.equals", flagId: "recruit.fragment.minister", value: true }, { type: "flag.equals", flagId: "recruit.fragment.yilintong", value: true }] },
        { id: "corridor-back-lobby", label: "（回大厅）", next: "lobby_front_desk" },
      ],
    },

    "yilintong_encounter": {
      id: "yilintong_encounter",
      title: "义林同",
      role: "部长层 · 走动",
      activeActorIds: ["recruit_yilintong"],
      text: `义林同：（在部长层走廊，抱着一摞档案）楼上啊。023 是我，收容部也是我。一人两块牌子，两份档案，一个班。\n\n（打了个哈欠）牌子多了，觉没多。\n\n（放下档案，看了你一会儿）会。写你的人都算数。红笔就三支：后勤、墙、我。到我这支的时候，别怕。那句话不是坏话。\n\n他们挂牌那天我在场。基地的门是 10:05 才装的。人事处比总部先开张，这不叫顺序错，这叫招人优先。`,
      choices: [
        { id: "take-fragment", label: "我记住了。", next: "corridor_hub", set: { "recruit.fragment.yilintong": true } },
        { id: "yilintong-back", label: "（回走廊）", next: "corridor_hub" },
      ],
    },

    "office_066": {
      id: "office_066",
      title: "何胖胖",
      role: "066 面试间",
      activeActorIds: ["recruit_hepangpang"],
      text: `何胖胖：（把你按到椅子对面的位置，自己坐正，清嗓子）面试！规矩我熟——我自己就是这么进来的。「你叫什么名字？」\n\n（他低头记下你名牌上的名字）好。第二个问题——「月薪多少？五险一金？包吃包住？一天工作几小时？」`,
      choices: [
        { id: "ask-terms", label: "月薪、五险一金、包吃包住、工时？", next: "office_066_terms", set: { "recruit.hepangpang.interview": true } },
        { id: "ask-contract", label: "合同呢？", next: "office_066_terms", set: { "recruit.hepangpang.interview": true } },
        { id: "066-leave", label: "（先出去）", next: "corridor_hub" },
      ],
    },

    "office_066_terms": {
      id: "office_066_terms",
      title: "何胖胖",
      role: "066 面试间",
      activeActorIds: ["recruit_hepangpang"],
      text: `何胖胖：问得好！我来答——「月薪没有，要啥直接说，五险一金没有，但有全球顶级医生，干3休2，包吃包住，工作1小时以上就行」。（竖手指）逐条都真。我就冲这个来的。\n\n「合同呢？」——「这玩意没有用，你觉得法律在我们这有用吗，不过我们这里有专门的人维持秩序。」（压低声音）维持秩序的那位，楼下睡觉。轻点。`,
      choices: [
        { id: "terms-to-photo", label: "就这些了？", next: "office_066_photo", effects: [{ type: "event.publish", eventType: "story.achievement", payload: { id: "recruit_hepangpang", name: "大哥，我8月29号才上任的" } }] },
        { id: "terms-leave", label: "（回走廊）", next: "corridor_hub" },
      ],
    },

    "office_066_photo": {
      id: "office_066_photo",
      title: "何胖胖",
      role: "066 面试间",
      activeActorIds: ["recruit_hepangpang"],
      text: `何胖胖：（拍桌）「行！」——当时他们也是这么答我的。\n\n（起身，从墙上取下一张照片给你看）我入职那天拍的。喏，「你先挂着ENTP不取名干」——那是我第一个名。墙上 030 那块「前A级」，前就是我。\n\n（把照片挂回去）后来丢了两个号，重新来的。喏，那两个丢了的就是。（指着墙上并排的两张小照片）都还亮着。号是人的。`,
      choices: [
        { id: "ask-why-me", label: "为什么把我拉进来？", next: "office_066_time_dragon" },
        { id: "photo-leave", label: "（回走廊）", next: "corridor_hub" },
      ],
    },

    "office_066_time_dragon": {
      id: "office_066_time_dragon",
      title: "何胖胖",
      role: "066 面试间",
      activeActorIds: ["recruit_hepangpang"],
      text: `何胖胖：（左右看看，压到最低声）「时序之龙确认过了，他不是属于这个时空的人。」\n\n——他们当时这么写我。你现在也……（挤眼）属于不属于，自己心里有数就行。\n\n（恢复大嗓门）一小时以上就行！但写档案的时候不算工时。没人在乎那个。`,
      choices: [
        { id: "dragon-to-photo", label: "（再看一眼照片）", next: "office_066_photo" },
        { id: "dragon-leave", label: "（回走廊）", next: "corridor_hub" },
      ],
    },

    "office_004": {
      id: "office_004",
      title: "cerman",
      role: "004 副部长室 · 停职中",
      activeActorIds: ["recruit_cerman"],
      text: `cerman：（门牌上挂着「停职中…」，他坐在灯下整理档案，抬头）访客？请进。停职不影响接待——停职也不影响干活，（想了一秒）主要影响工资。没有工资。所以没有影响。`,
      choices: [
        { id: "ask-suspend", label: "你为什么停职？", next: "office_004_suspend", set: { "recruit.cerman.suspend": true } },
        { id: "look-cage", label: "（看向空笼子）", next: "office_004_cage", set: { "recruit.cerman.cage": true } },
        { id: "ask-yilin", label: "和义林同……（楼下那位）", next: "office_004_yilintong", set: { "recruit.cerman.yilin": true } },
        { id: "cerman-rounds", label: "（把三件事都聊完）", next: "office_004_complete", availableWhen: [{ type: "flag.equals", flagId: "recruit.cerman.suspend", value: true }, { type: "flag.equals", flagId: "recruit.cerman.cage", value: true }, { type: "flag.equals", flagId: "recruit.cerman.yilin", value: true }], effects: [{ type: "event.publish", eventType: "story.achievement", payload: { id: "recruit_cerman", name: "不要把我认成006-2啊" } }] },
        { id: "004-leave", label: "（回走廊）", next: "corridor_hub" },
      ],
    },

    "office_004_suspend": {
      id: "office_004_suspend",
      title: "cerman",
      role: "004 副部长室",
      activeActorIds: ["recruit_cerman"],
      text: `cerman：（把一份文件推到抽屉里）历史遗留问题。想听吗？《#002a-3次提案》通过之前，我养过一只 002-1。（指桌上空笼子）就是它。提案通过之后嘛……（把笼门重新扣好）制度是对的。龙是对的。`,
      choices: [{ id: "suspend-back", label: "（回到门口）", next: "office_004" }],
    },

    "office_004_cage": {
      id: "office_004_cage",
      title: "cerman",
      role: "004 副部长室",
      activeActorIds: ["recruit_cerman"],
      text: `cerman：蜕的皮，留个纪念。（忽然凑近看你，盯着你的眼睛看）……你瞳孔没事吧？我是说，颜色。我的左金右黑——「不要把我认成006-2啊」，此楼的著名误会。006-2 是收容物，我是研究员。（停顿）在停职的研究员。`,
      choices: [{ id: "cage-back", label: "（回到门口）", next: "office_004" }],
    },

    "office_004_yilintong": {
      id: "office_004_yilintong",
      title: "cerman",
      role: "004 副部长室",
      activeActorIds: ["recruit_cerman"],
      text: `cerman：（抬手打断）「被肘进西山医务室半个多月」——我档案原文。后面那句你也读一下：「（没有黑义林同）」。（低头继续整理）楼里的事，档案都会写清楚。这就是为什么楼上的一切都要过红笔。`,
      choices: [{ id: "yilin-back", label: "（回到门口）", next: "office_004" }],
    },

    "office_004_complete": {
      id: "office_004_complete",
      title: "cerman",
      role: "004 副部长室",
      activeActorIds: ["recruit_cerman"],
      text: `cerman 把三份档案并排合上，抬手在封皮上敲了两下。\n\n「都问完了。停职的人也有义务把话说清楚。」（把笔插回胸前口袋）「下次来，记得先看门牌，再看眼睛。」`,
      choices: [{ id: "cerman-complete-leave", label: "（回走廊）", next: "corridor_hub" }],
    },

    "office_037": {
      id: "office_037",
      title: "玩具间",
      role: "037 玩具间",
      text: `悠芒的玩具间里堆满手工玩具。每只玩具底下都有一行手写标签：「给019的」「给100的」「给091的」……收件人全是墙上的名字。\n\n桌上的终端亮着，屏幕上滚动着一行模板：>欢迎访问本文档，来访者！靠近时，那个变量慢慢变成了你的名字。\n\n窗边有一副没拼完的拼图，标签只有一句：「不能理解死亡。」`,
      choices: [
        { id: "ask-toy", label: "这个是给谁的？", next: "office_037_toy" },
        { id: "037-leave", label: "（回走廊）", next: "corridor_hub" },
      ],
    },

    "office_037_toy": {
      id: "office_037_toy",
      title: "玩具间",
      role: "037 玩具间",
      text: `悠芒：（从你手里接过玩具看一眼）哦，给 091 的。（把它放回去）D 级也有玩具。\n\n（补充，很快）游戏机不算玩具，是装备。装备归收容。`,
      choices: [
        { id: "toy-back-room", label: "（放回玩具）", next: "office_037" },
        { id: "toy-to-corridor", label: "（回走廊）", next: "corridor_hub" },
      ],
    },

    "office_054": {
      id: "office_054",
      title: "夏炎",
      role: "054 乙式起居室",
      activeActorIds: ["recruit_xiayan"],
      text: `054 室是全楼最安静的一间。书桌、冲锋衣挂钩、一台空着的游戏机底座，充电线还插着。\n\n夏炎：（趴在窗边看外面，回头看你一眼，又转回去）……嗯。`,
      choices: [
        { id: "look-console", label: "（指空着的游戏机底座）", next: "office_054_console" },
        { id: "read-note", label: "（指留言板上的便签）", next: "office_054_note", set: { "recruit.xia.note": true } },
        { id: "open-drawer", label: "（指抽屉——093 档案）", next: "archive_093" },
        { id: "ask-whale", label: "（问鲸）", next: "office_054_whale" },
        { id: "054-leave", label: "（回走廊）", next: "corridor_hub" },
      ],
    },

    "office_054_console": {
      id: "office_054_console",
      title: "夏炎",
      role: "054 乙式起居室",
      activeActorIds: ["recruit_xiayan"],
      text: `夏炎：（顺着你的手指看过去，收回目光）……收了。`,
      choices: [{ id: "console-back", label: "（收回目光）", next: "office_054" }],
    },

    "office_054_note": {
      id: "office_054_note",
      title: "夏炎",
      role: "054 乙式起居室",
      activeActorIds: ["recruit_xiayan"],
      text: `留言板上钉着一张便签，字迹很轻：\n\n「游戏机没收完能还我个新的吗，不然真的很无聊————来自夏炎的留言」\n\n夏炎：（不动）……是我写的。`,
      choices: [{ id: "note-back", label: "（放下便签）", next: "office_054" }],
    },

    "office_054_whale": {
      id: "office_054_whale",
      title: "夏炎",
      role: "054 乙式起居室",
      activeActorIds: ["recruit_xiayan"],
      text: `夏炎：（目光停在窗外）……嗯。\n\n他没有再说别的。窗台上压着一张旧船票根，边角已经磨白了。`,
      choices: [{ id: "whale-back", label: "（不再追问）", next: "office_054" }],
    },

    "archive_093": {
      id: "archive_093",
      title: "编号093-回溯卡带",
      role: "054 乙式起居室 · 抽屉",
      activeActorIds: ["recruit_xiayan"],
      text: `夏炎：（第一次正眼看你，看了两秒，把头转向窗外）……可以看。\n\n抽屉里是一份《编号093-回溯卡带》的档案。红色 Switch 卡带，光经过机器时会弯曲。日本分部接到市民报告：「最近两个星期的生活过得完全一样。」测试读档，回溯昨天二十四小时。\n\n档案里写：「该市民技术太菜，一天读了七遍档才打过。」`,
      choices: [
        { id: "read-093-end", label: "翻到档案末尾", next: "archive_093_deleted", effects: [{ type: "event.publish", eventType: "story.achievement", payload: { id: "recruit_missing_person", name: "跟少了个人一样" } }] },
        { id: "read-093-seven", label: "想起夏炎的便签，再看一遍", next: "archive_093_seven", availableWhen: [{ type: "flag.equals", flagId: "recruit.xia.note", value: true }], effects: [{ type: "event.publish", eventType: "story.achievement", payload: { id: "recruit_seven_saves", name: "一天读七遍档" } }] },
        { id: "close-093", label: "合上档案", next: "office_054" },
      ],
    },

    "archive_093_deleted": {
      id: "archive_093_deleted",
      title: "编号093-回溯卡带",
      role: "档案末尾",
      activeActorIds: ["recruit_xiayan"],
      text: `你翻到档案末尾。一段标着「已被删除」的评论还留在正文里：\n\n「怎么回事，莫名其妙多出的工位，无人认领的装备，多出一套的制服，所有东西都多出了一件，跟少了个人一样，后勤部应该不会在这方面犯错误啊」\n\n你读完，夏炎把脸埋进臂弯里，趴着。`,
      choices: [{ id: "deleted-close", label: "（合上档案）", next: "office_054" }],
    },

    "archive_093_seven": {
      id: "archive_093_seven",
      title: "编号093-回溯卡带",
      role: "档案末尾",
      activeActorIds: ["recruit_xiayan"],
      text: `你又看了一遍那句「一天读了七遍档才打过」。\n\n想起留言板上那张便签，你忽然明白他为什么把游戏机底座留在这里。\n\n夏炎一直没回头。游戏没有说他在害羞。`,
      choices: [{ id: "seven-close", label: "（合上档案）", next: "office_054" }],
    },

    "office_083": {
      id: "office_083",
      title: "小提琴男孩",
      role: "083 部长室",
      activeActorIds: ["recruit_xiaotiqin"],
      text: `张xuan：（正在谱架上批注什么，头也没抬）门没锁就是可以进。（写完一笔，抬头）找我，还是找墙？墙在一层，我在这。`,
      choices: [
        { id: "ask-minister", label: "你就是部长？", next: "office_083_minister", set: { "recruit.fragment.minister": true } },
        { id: "look-cases", label: "（看五只琴盒）", next: "office_083_cases" },
        { id: "read-red", label: "（走到谱架，读档案红字）", next: "office_083_red" },
        { id: "083-leave", label: "（回走廊）", next: "corridor_hub" },
      ],
    },

    "office_083_minister": {
      id: "office_083_minister",
      title: "小提琴男孩",
      role: "083 部长室",
      activeActorIds: ["recruit_xiaotiqin"],
      text: `张xuan：研究部部长，小提琴男孩。（指墙上自己的镜框聘书）聘书 10:03 挂的牌，我 10 点 03 分之后才存在。——开个玩笑。我比这块牌早存在很久，入职也早。\n\n墙上 083 那块牌是我自己。建墙的人不给自己发牌，部长给自己发一块。这楼里的头衔都长在牌上，不长在门上。\n\n（取下镜框，指着落款）聘书落款 10:03:2 几——墨洇了，末位看不清。委任状正文只有一句，你念：「有时间的话我会出故事的。」`,
      choices: [
        { id: "minister-to-cases", label: "（去看琴盒）", next: "office_083_cases" },
        { id: "minister-back", label: "（回到谱架）", next: "office_083" },
      ],
    },

    "office_083_cases": {
      id: "office_083_cases",
      title: "小提琴男孩",
      role: "083 部长室",
      activeActorIds: ["recruit_xiaotiqin"],
      text: `张xuan：（站起来，逐只打开琴盒看一遍又合上，如数家珍）终焉小提琴，五模式；熵律琴弓，熵不减；悖论墨水笔，写出的命题自动带上它的否定；荧光微分匕首——（加速）高斯曲线、根号负一、鲁米诺、三碘化氮，接触爆炸三百克 TNT 当量，炸完量子隧穿回手；沉默之书盾，理想国、东方快车、几何原本、克莱采尔 42 首。\n\n（合上最后一只，恢复正常语速）……档案写它们「几乎可以被定性为收容物」。红字的。不是我写的。见那边谱架。\n\n日历翻到 7 月 10 日和 3 月 21 日两页，画着红圈。`,
      choices: [
        { id: "cases-to-red", label: "（去读红字）", next: "office_083_red" },
        { id: "cases-back", label: "（回到谱架）", next: "office_083" },
      ],
    },

    "office_083_red": {
      id: "office_083_red",
      title: "小提琴男孩",
      role: "083 部长室 · 档案互审",
      activeActorIds: ["recruit_xiaotiqin"],
      text: `谱架上的档案摊开着，三段红字批注就摆在明面。\n\n义林同：「武器系统已与使用者深度绑定……他的武器系统几乎可以被定性为收容物。」\n\n后勤部：「维尼亚夫斯基生日是 7 月 10 日，记得准备大量血液以供输血。似乎体质变得越来越虚弱，每月都要昏倒好几次。」\n\n建墙的人：「少数能驾驭 017 并且将伤害转移的人。但是代价却是永久性的身体上的缺陷。」\n\n张xuan：（在你身后念完，把档案合上）研究部的传统：互相挑刺，互相签字。你也会有你的红字。别急。`,
      choices: [
        { id: "red-back-corridor", label: "（回走廊）", next: "corridor_hub" },
        { id: "red-back-minister", label: "（回到谱架）", next: "office_083" },
      ],
    },

    "review_room": {
      id: "review_room",
      title: "档案互审室",
      role: "二层 · 回访",
      guide: { title: "所有人都要招", objective: "回访档案互审室，收集自己的红字批注" },
      text: `二层档案互审室。长桌上摆着三支红笔：后勤部、墙、义林同。\n\n墙上贴着一张说明：档案写完不算完，要有人读，有人批，有人签字。每回访一次，你的档案上就会多一段红字。`,
      choices: [
        { id: "review-first", label: "第一次回访：看看自己的档案", next: "review_note_1", set: { "recruit.review.1": true }, availableWhen: [{ type: "flag.equals", flagId: "recruit.state", value: 3 }] },
        { id: "review-second", label: "第二次回访：再看看", next: "review_note_2", set: { "recruit.review.2": true }, availableWhen: [{ type: "flag.equals", flagId: "recruit.review.1", value: true }, { type: "flag.equals", flagId: "recruit.state", value: 3 }] },
        { id: "review-third", label: "第三次回访：再翻一页", next: "review_note_3", set: { "recruit.state": 4 }, availableWhen: [{ type: "flag.equals", flagId: "recruit.review.2", value: true }, { type: "flag.equals", flagId: "recruit.state", value: 3 }], effects: [{ type: "event.publish", eventType: "story.achievement", payload: { id: "recruit_bound", name: "几乎可以被定性为收容物" } }] },
        { id: "review-back", label: "（回走廊）", next: "corridor_hub" },
      ],
    },

    "review_note_1": {
      id: "review_note_1",
      title: "第一次批注",
      role: "档案互审室",
      text: `第一次回访。你的档案上多了一行浅红的仿体字：\n\n「申请的〔技能〕已备。福利清单在宣传册第三页，记得看完。」\n\n落款是后勤部。字迹很轻，像怕压坏了纸。`,
      choices: [{ id: "note-1-back", label: "（合上档案）", next: "review_room" }],
    },

    "review_note_2": {
      id: "review_note_2",
      title: "第二次批注",
      role: "档案互审室",
      text: `第二次回访。你的档案上多了一行熟悉的笔迹：\n\n「〔代号〕的档案已录入。格式没问题——照着他们写的，可以随心所欲一点。」\n\n是悠芒。他把「可以随心所欲一点」写得很慢。`,
      choices: [{ id: "note-2-back", label: "（合上档案）", next: "review_room" }],
    },

    "review_note_3": {
      id: "review_note_3",
      title: "第三批注",
      role: "档案互审室 · 结局前置",
      guide: { title: "所有人都要招", objective: "决定是留在墙前，还是走向白墙" },
      text: `第三次回访。义林同站在你的名牌旁边，刚收笔。红笔别回胸前口袋。\n\n「念一遍。」\n\n你的名牌上浮出最后一行深红批注：\n\n「该研究员的档案已与本人深度绑定。几乎可以被定性为收容物。——义林同 批注」\n\n你退后一步，整面墙在眼前展开：四十一块牌、白字行、墙顶计数器——已入册 42 ｜ 暂无自设 N ｜ 待认领 ∞。\n\n走廊尽头的白墙出现一道白色门缝。`,
      choices: [
        { id: "note-3-white", label: "走向那道白色门缝", next: "wall_white_open" },
        { id: "note-3-wall", label: "站在原地，看完整面墙", next: "ending_wall" },
        { id: "note-3-review", label: "（再看一眼档案）", next: "review_room" },
      ],
    },

    "wall_white_open": {
      id: "wall_white_open",
      title: "白字行",
      role: "走廊尽头",
      text: `你贴着墙走到特定角度。那行白字忽然反光：\n\n「西山隐藏档案编号-111」\n\n走廊尽头的白墙裂开一道很细的门缝。里面没有审讯室的味道，只有一点暖光。`,
      choices: [
        { id: "white-enter", label: "推门进去", next: "room_111_gate" },
        { id: "white-back-corridor", label: "（回走廊）", next: "corridor_hub" },
        { id: "white-back-wall", label: "（回到名牌墙）", next: "wall_hub" },
      ],
    },

    "room_111_gate": {
      id: "room_111_gate",
      title: "-111",
      role: "隐藏房间 · 门禁",
      activeActorIds: ["recruit_mie"],
      text: `门禁声响起：\n\n「【重要提示：该介绍仅A+级以上人员可查看，当前验证身份中】」\n\n两秒。\n\n「【验证已通过，欢迎 Dr.研究员】」\n\n门开了。`,
      choices: [
        { id: "gate-enter", label: "推门", next: "room_111", effects: [{ type: "event.publish", eventType: "story.achievement", payload: { id: "recruit_mie", name: "灭" } }] },
        { id: "gate-back", label: "（退回走廊）", next: "wall_white_open" },
      ],
    },

    "room_111": {
      id: "room_111",
      title: "灭",
      role: "隐藏结局",
      presentation: "cg",
      terminal: true,
      guide: null,
      activeActorIds: ["recruit_mie"],
      text: `门后是一间塞满游戏设备和软沙发的大房间。很高的男孩背对门口坐在地毯上，拼一盒超龄的拼图。\n\n听到门响，他回头，看见你，挥了挥手。\n\n「……你好。」\n\n他转回去，把最后一块拼图按下去。拼图上是这座小城。\n\n门在你身后自己合上——很轻。灯没灭。`,
    },

    "cabinet_event": {
      id: "cabinet_event",
      title: "分类柜进场",
      role: "走廊尽头 · 事件",
      activeActorIds: ["recruit_youmang"],
      text: `走廊尽头，两个没有脸的工人正在装最后一排柜子。四扇新柜门已经挂好，门牌是 I 神秘、II 基源、III 异质、IV 异则。第五扇门没装，门洞上贴着一张纸：「V：视情况」。\n\n悠芒：（扶着梯子，跟剪影工人比划）第四扇，对，IV……好。第五扇不装，贴「视情况」就行。\n\n柜子装好后，全楼四十一块名牌旁多了一个小色标。每个人都被归了类，包括部长。083 的色标落在 I 和 IV 之间的一格，柜门没开，标签手写：「之间」。`,
      choices: [
        { id: "cabinet-ask", label: "新柜子是干什么的？", next: "cabinet_kind" },
        { id: "cabinet-back", label: "（回走廊）", next: "corridor_hub" },
      ],
    },

    "cabinet_kind": {
      id: "cabinet_kind",
      title: "分类学",
      role: "走廊尽头",
      activeActorIds: ["recruit_youmang"],
      text: `悠芒：分类。研究部开了十八个月，昨天才有的分类学。（拍拍柜门）I 神秘，II 基源，III 异质，IV 异则。V 视情况——（笑）编外那间房也是这么说的。\n\n（指向旧讲台那边）十八个月之前用吵架分。密度论、媒介论、单一因子论、质料论、多元论……每一块牌子后面都站过一个认真的人。\n\n最后赢的是「先分了再一起干活」那一派。\n\n（把最后一块「四分类法」铭牌翻面）背面刻着一句话：「它既回答了『异常是什么』，又解决了『我们该怎么应对』的问题。」`,
      choices: [
        { id: "kind-back-corridor", label: "（回走廊）", next: "corridor_hub" },
        { id: "kind-back-event", label: "（再看一眼柜子）", next: "cabinet_event" },
      ],
    },

    "ending_side_door": {
      id: "ending_side_door",
      title: "编外之门",
      role: "结局 · 编外",
      presentation: "blackout",
      terminal: true,
      guide: null,
      text: `走廊侧门始终虚掩着。门牌是一行原文：「西山基地编外研究员名单（属西山二创，视情况转为官设）」。\n\n你从门缝看进去。一条很长的走廊，很多影子在走动，没有一块名牌。\n\n身后有人问：「看见什么了？」\n\n你答：「视情况。」\n\n门没有开。`,
    },

    "ending_109": {
      id: "ending_109",
      title: "109 秒",
      role: "支线结局 · 时间锚",
      presentation: "blackout",
      terminal: true,
      guide: null,
      text: `前台台账的最后一行、部长室聘书的落款、义林同的那句话，在你脑子里接上了。\n\n大厅挂钟的秒针停在 10:03:20，停了三秒，跳过 10:04:23 与 10:05:09 两格，直接往前走。\n\n墙上浮出一行字：\n\n「先有书，再有研究部，后有城。」\n\n人事处比总部先开张。这不叫顺序错，这叫招人优先。`,
    },

    "ending_wall": {
      id: "ending_wall",
      title: "所有人都要招",
      role: "结局 · 入册",
      presentation: "blackout",
      terminal: true,
      guide: null,
      text: `你站在原地，把这面墙从头看到尾。\n\n一百格，四十一块牌，五十九个空号。建墙的人不在墙上。第 100 格下面是那行白字。墙顶计数器亮着：已入册 42 ｜ 暂无自设 N ｜ 待认领 ∞。\n\n这里收容人的唯一条件，是你写过一篇东西。\n\n而且墙还留着空位。`,
    },
  },
};
