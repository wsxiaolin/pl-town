import type { StoryDefinition } from "../../../stories/types";

export const YOUXUEPAI_STORY: StoryDefinition = {
  schemaVersion: 1,
  definitionVersion: 1,
  id: "side.youxuepai.loophole",
  title: "优学派漏洞",
  startNode: "youxuepai.start",
  entryActorId: "youxuepai_owner",

  interactions: [
    { actorId: "youxuepai_owner", nodeId: "youxuepai.start", choiceId: "open-tablet" },
  ],

  buildingInteractions: [
    { buildingId: "academy", nodeId: "youxuepai.start", choiceId: "open-tablet" },
  ],

  nodes: {
    "youxuepai.start": {
      id: "youxuepai.start", title: "设备房", role: "序章", savepoint: true,
      guide: { title: "优学派漏洞", objective: "在设备房找到那台旧平板" },
      activeActorIds: ["youxuepai_owner"],
      text: "学院的设备房在走廊尽头。门半开着，里面堆着淘汰的投影仪、卷起来的幕布，还有一排贴了编号的旧抽屉。\n\n屋主坐在窗下擦一台平板。屏幕亮着，停在一个打不开的界面上。\n\n「你来得正好。」他把平板翻过来，背面贴着一张褪色的标签。「这台机器锁了很久。抽屉里还有一本册子，不知道谁塞进去的。」",
      choices: [
        { id: "open-tablet", label: "先看看那台平板。", next: "youxuepai.tablet" },
        { id: "ask-owner", label: "册子是谁留下的？", next: "youxuepai.owner-talk" },
      ],
    },

    "youxuepai.owner-talk": {
      id: "youxuepai.owner-talk", title: "屋主", savepoint: false,
      activeActorIds: ["youxuepai_owner"],
      text: "「不知道。」屋主把螺丝刀放回盒里。「设备房清点的时候，它就在这台平板的保护套里。扉页没有名字，只有一句话：正在寻找其他漏洞。」\n\n他朝窗外抬了抬下巴。栈桥那边有一座高脚木屋，屋顶漏雨，城里人叫它漏洞木屋。\n\n「册子上画的是那屋里的五根木杆。你要真想弄明白，得去那边。」",
      choices: [
        { id: "read-book", label: "翻开册子。", next: "youxuepai.manual" },
        { id: "look-tablet", label: "再看看平板。", next: "youxuepai.tablet" },
      ],
    },

    "youxuepai.tablet": {
      id: "youxuepai.tablet", title: "旧平板", role: "设备房", savepoint: false,
      activeActorIds: ["youxuepai_owner"],
      text: "平板的外壳磨得发白。按下电源键，屏幕亮起，先跳出「已由远程锁定」的提示，随后只剩一个要求输入管理口令的方框。\n\n你试了几个常见的口令，都不对。\n\n保护套里滑出一张折过很多次的纸。上面画着五根木杆，旁边写着：闸口向岸五十步。",
      choices: [
        { id: "read-manual", label: "展开那张纸。", next: "youxuepai.manual" },
        { id: "back-owner", label: "问屋主这台机器从哪来。", next: "youxuepai.owner-talk" },
      ],
    },

    "youxuepai.manual": {
      id: "youxuepai.manual", title: "通关册", role: "设备房", savepoint: true,
      guide: { title: "优学派漏洞", objective: "去栈桥边找那座通关木屋" },
      text: "纸上的字很小，写得很密。开头是一句：「通过几天对这台学习机的研究，我发现了一个漏洞。」\n\n后面没有口令，也没有任何可以直接照抄的按钮。只有一座木屋的平面图：五根木杆、一道总闸、一扇里间的门、一只靠墙的柜子，还有屋角的邮口。\n\n最后一行写着：\n\n「可能对其他机器同样适用。」\n\n再往下，是一页被折起来的空白。",
      choices: [
        { id: "go-bridge", label: "去栈桥边找那座木屋。", next: "youxuepai.bridge" },
        { id: "ask-more", label: "再问屋主一句。", next: "youxuepai.owner-talk" },
      ],
    },

    "youxuepai.bridge": {
      id: "youxuepai.bridge", title: "栈桥", role: "第一幕 · 木屋", savepoint: true,
      guide: { title: "优学派漏洞", objective: "找到通关木屋，读一读门口的匾额" },
      text: "沿着栈桥往岸上走五十步，滩地上立着一座浅木色的高脚屋。帆布篷塌了半边，屋顶真有一个洞，底下接着一只木桶。\n\n檐口阴刻着四个字：通关木屋。柱子上钉着一块更旧的牌子，上面写着：漏洞木屋。\n\n走近时，桶沿的两个字才看清：知道。\n\n城里人问「漏吗」，屋主早就答过了。",
      choices: [
        { id: "to-gate", label: "走向闸口。", next: "youxuepai.gate" },
        { id: "to-house", label: "先推门进屋。", next: "youxuepai.levers" },
      ],
    },

    "youxuepai.gate": {
      id: "youxuepai.gate", title: "闸口", role: "第一幕 · 木屋", savepoint: true,
      activeActorIds: ["youxuepai_guard"],
      text: "闸口立着一截人形木头。它没有五官，只有肩、臂和一条笔直的脊背。\n\n你走近，能听见木头内部极轻的声音——像谁在数呼吸。\n\n门在它身后。门也在它身体里。",
      choices: [
        { id: "try-force", label: "试着从旁边挤过去。", next: "youxuepai.guard-block" },
        { id: "find-levers", label: "退回屋里找闸的开关。", next: "youxuepai.levers" },
      ],
    },

    "youxuepai.guard-block": {
      id: "youxuepai.guard-block", title: "滚木卫", role: "第一幕 · 木屋", savepoint: false,
      activeActorIds: ["youxuepai_guard"],
      text: "（他不动。门在他身后，门也在他身体里。）\n\n你退了一步。木头内部那阵极轻的声音停了一下，又慢慢接上。",
      choices: [
        { id: "back-levers", label: "回屋里去。", next: "youxuepai.levers" },
      ],
    },

    "youxuepai.levers": {
      id: "youxuepai.levers", title: "五根木杆", role: "第一幕 · 木屋", savepoint: true,
      guide: { title: "优学派漏洞", objective: "照通关册的次序扳动五根木杆" },
      text: "屋里没有点灯。柜台后立着五根木杆，杆身被手磨得发亮。旁边是一道总闸，再往里，是里间的门。\n\n《通关册》摊在柜台上。五根杆的次序画得很清楚。\n\n册子边角还有一行小字：\n\n「顺序会变。旧序已划。」",
      choices: [
        { id: "pull-in-order", label: "照册子上的次序扳下五根木杆。", next: "youxuepai.levers-right" },
        { id: "pull-random", label: "先随便试一根。", next: "youxuepai.levers-wrong" },
        { id: "read-again", label: "再读一遍册子。", next: "youxuepai.manual" },
      ],
    },

    "youxuepai.levers-wrong": {
      id: "youxuepai.levers-wrong", title: "五根木杆", savepoint: false,
      text: "第一根扳下去，屋里深处传来一声木响。\n\n五根杆同时弹回原位。\n\n没有机关追出来，也没有惩罚。柜台上的册子被震得翻了一页，露出背面那行小字：旧序已划。",
      choices: [
        { id: "retry", label: "按册子上的次序重来。", next: "youxuepai.levers-right" },
        { id: "step-back", label: "先退到门口想一想。", next: "youxuepai.gate" },
      ],
    },

    "youxuepai.levers-right": {
      id: "youxuepai.levers-right", title: "断电", role: "第一幕 · 木屋", savepoint: false,
      text: "五根木杆依次落下。最后一下，屋里所有声音都停了。\n\n你拉下总闸。黑暗持续了十秒。\n\n再推上去时，闸口传来一声很轻的、像湿木头松开的声音。\n\n里间的门自己开了一条缝。柜台上那盏小灯亮了起来。",
      choices: [
        { id: "look-guard", label: "去看闸口。", next: "youxuepai.guard-log", effects: [{ type: "flag.set", flagId: "youxuepai.gate.open", value: true }, { type: "event.publish", eventType: "story.achievement", payload: { id: "youxuepai_rollwood", name: "滚木" } }] },
        { id: "look-tablet", label: "把平板放到柜台上。", next: "youxuepai.tablet-unlocked", effects: [{ type: "flag.set", flagId: "youxuepai.gate.open", value: true }, { type: "event.publish", eventType: "story.achievement", payload: { id: "youxuepai_rollwood", name: "滚木" } }] },
      ],
    },

    "youxuepai.guard-log": {
      id: "youxuepai.guard-log", title: "滚木卫", savepoint: false,
      activeActorIds: ["youxuepai_guard"],
      text: "（闸口只剩一截圆木横在门边。木头是湿的，像刚退潮。）\n\n你从圆木旁边走过去。门开着。",
      choices: [
        { id: "to-tablet", label: "进屋，把平板拿出来。", next: "youxuepai.tablet-unlocked" },
        { id: "to-treasure", label: "先看看里间。", next: "youxuepai.treasure-brick" },
      ],
    },

    "youxuepai.treasure-brick": {
      id: "youxuepai.treasure-brick", title: "里间", savepoint: false,
      text: "里间的门后面，本该是一排官营货架。现在只有一面新砌的砖墙。\n\n砖缝里的灰还没干。墙上浮着一行字：\n\n「门还在，门后没了。」\n\n你伸手碰了碰。砖是实的。",
      choices: [
        { id: "back-tablet", label: "退出来，看平板。", next: "youxuepai.tablet-unlocked" },
        { id: "back-levers", label: "回到柜台前。", next: "youxuepai.levers" },
      ],
    },

    "youxuepai.tablet-unlocked": {
      id: "youxuepai.tablet-unlocked", title: "平板", role: "第二幕 · 验证", savepoint: true,
      guide: { title: "优学派漏洞", objective: "确认平板真的解开了" },
      text: "平板放上柜台，屏幕自己亮了。\n\n「已由远程锁定」的提示消失了。先前灰着的图标一个接一个恢复颜色。你点开一个被冻住的应用，它打开了。\n\n柜台上的册子还在那一页。\n\n五根木杆、一道总闸、十秒黑暗。就这些。",
      choices: [
        { id: "test-lock", label: "再试一次被锁住的功能。", next: "youxuepai.verify" },
        { id: "think-gate", label: "先想想这道闸意味着什么。", next: "youxuepai.verify" },
      ],
    },

    "youxuepai.verify": {
      id: "youxuepai.verify", title: "验证", role: "第二幕 · 验证", savepoint: true,
      guide: { title: "优学派漏洞", objective: "决定拿这台平板怎么办" },
      text: "你反复试了几次。每次结果都一样：锁住的东西能用了。\n\n但里间那面砖墙没有变。官营的宝库进不去，柜台上也没有别的门。\n\n开一条路，死一扇门。\n\n你把平板翻过来，背面那张褪色标签还在。册子上的每一句，都对上了。",
      choices: [
        { id: "carry-out", label: "把平板装进包里，带出闸口。", next: "youxuepai.confiscate" },
        { id: "search-house", label: "先在屋里找找别的办法。", next: "youxuepai.mailroom" },
      ],
    },

    "youxuepai.confiscate": {
      id: "youxuepai.confiscate", title: "去向不明", role: "第三幕 · 寄信", savepoint: false,
      text: "你抱着平板跨过门槛。\n\n闸口旁边那只靠墙的柜子「咔」了一声。柜门没有开，玻璃后面却多了一样东西——你的平板，压在一层层旧物上面。\n\n柜子上没有锁孔，也没有把手。只有一张小纸片：去向不明。\n\n只进，不出。",
      choices: [
        { id: "look-cabinet", label: "贴着玻璃看一会儿。", next: "youxuepai.mailroom" },
        { id: "ask-mailroom", label: "去屋角找别的出路。", next: "youxuepai.mailroom" },
      ],
    },

    "youxuepai.mailroom": {
      id: "youxuepai.mailroom", title: "屋角", role: "第三幕 · 寄信", savepoint: true,
      guide: { title: "优学派漏洞", objective: "想办法把平板送过闸" },
      text: "屋角有一张矮桌。桌上摞着牛皮纸信封，旁边是一道窄窄的邮口，邮口上方挂着一只铜铃。\n\n墙上钉着一张告示：\n\n「当日十八时前投递，当日达。十八时后，次日达。」\n\n告示下面还有一行更小的字：\n\n「守门的拦得住货物，拦不住信。」",
      choices: [
        { id: "pack-envelope", label: "把平板装进信封。", next: "youxuepai.mail-send" },
        { id: "ring-bell", label: "摇一下铜铃。", next: "youxuepai.bell" },
        { id: "check-slot", label: "先看看邮口。", next: "youxuepai.bell" },
      ],
    },

    "youxuepai.bell": {
      id: "youxuepai.bell", title: "问问铜铃", savepoint: false,
      text: "铜铃响了一声。柜台底下传来机括转动的声音，一块暗板弹开，里面整整齐齐码着第二摞信封。\n\n暗板只开了很短一会儿，又自己合上。\n\n铃身上刻着三个字：问问。",
      choices: [
        { id: "take-envelopes", label: "取一只信封。", next: "youxuepai.mail-send" },
        { id: "leave-bell", label: "把铃挂回去。", next: "youxuepai.mailroom" },
      ],
    },

    "youxuepai.mail-send": {
      id: "youxuepai.mail-send", title: "寄信", savepoint: true,
      text: "你把平板装进信封。信封比想象中厚，封口时能感觉到里面那台机器的边角。\n\n你在封面写下自己的名字。\n\n然后把它投进邮口。\n\n邮口深处轻轻响了一下。",
      choices: [
        { id: "wait-mailbox", label: "去岛侧信箱等。", next: "youxuepai.mailbox" },
        { id: "go-decision", label: "先回城里，把册子的事想清楚。", next: "youxuepai.decision" },
      ],
    },

    "youxuepai.mailbox": {
      id: "youxuepai.mailbox", title: "岛侧信箱", role: "第三幕 · 寄信", savepoint: true,
      guide: { title: "优学派漏洞", objective: "在岛侧信箱取回自己的信" },
      text: "栈桥中段的立柱上挂着一只信箱，取件口朝海。\n\n傍晚，信箱里「嗒」了一声。\n\n你打开取件口。信封躺在里面，封面上是你自己的字。拆开，平板还在。\n\n东西进去了。\n\n邮口旁边不知谁刻了一行小字：「信到了自己手里，才算真的到了。」",
      choices: [
        { id: "read-letter", label: "把信封收好。", next: "youxuepai.decision", effects: [{ type: "flag.set", flagId: "youxuepai.selfmail", value: true }, { type: "event.publish", eventType: "story.achievement", payload: { id: "youxuepai_selfmail", name: "把软件寄给自己" } }] },
        { id: "to-sea", label: "带着信去滩地另一头看看。", next: "youxuepai.thymol", effects: [{ type: "flag.set", flagId: "youxuepai.selfmail", value: true }, { type: "event.publish", eventType: "story.achievement", payload: { id: "youxuepai_selfmail", name: "把软件寄给自己" } }] },
      ],
    },

    "youxuepai.decision": {
      id: "youxuepai.decision", title: "柜台", role: "第四幕 · 抉择", savepoint: true,
      guide: { title: "优学派漏洞", objective: "决定这本通关册怎么处理" },
      text: "天色暗下来。你回到柜台前，《通关册》还摊在灯下。\n\n五根木杆、十秒黑暗、一扇变成砖墙的门、一只只进不出的柜子。\n\n你知道该怎么做了。\n\n问题是，这件事要不要让别人知道。",
      choices: [
        { id: "report-book", label: "把册子交回学院。", next: "youxuepai.report" },
        { id: "share-book", label: "把册子抄到外面的黑板上。", next: "youxuepai.share" },
        { id: "keep-book", label: "把册子收进自己的包里。", next: "youxuepai.keep" },
        { id: "restore-first", label: "先把五根木杆扳回原样。", next: "youxuepai.restore" },
      ],
    },

    "youxuepai.report": {
      id: "youxuepai.report", title: "学院", role: "第四幕 · 上报", savepoint: false,
      activeActorIds: ["youxuepai_owner"],
      text: "你把册子带回设备房。屋主一页一页翻完，翻得很慢。\n\n「你照这个做了？」\n\n你点头。\n\n他把册子合上，手指在封面上停了一会儿。\n\n「这东西要是留在外面，会有人照着试。要是收起来，又会有人问为什么。」\n\n他抬头看你：「你想怎么处理？」",
      choices: [
        { id: "seal-house", label: "把木屋封起来，册子归档。", next: "youxuepai.ending-report" },
        { id: "return-book", label: "把册子放回木屋，什么也不改。", next: "youxuepai.ending-restore" },
        { id: "ask-crowd", label: "先听听城里的人怎么说。", next: "youxuepai.crowd" },
      ],
    },

    "youxuepai.share": {
      id: "youxuepai.share", title: "外墙黑板", role: "第四幕 · 公开", savepoint: false,
      text: "你把册子摊在木屋外墙的黑板前，用粉笔一行一行抄上去。\n\n五根木杆、总闸、十秒、砖墙、邮口。抄到最后一行时，粉笔断了一次。\n\n「可能对其他机器同样适用。」\n\n你把断掉的粉笔头捡起来，放在黑板槽里。",
      choices: [
        { id: "watch-crowd", label: "退后几步，看谁会来。", next: "youxuepai.crowd" },
        { id: "erase-after", label: "抄完就擦掉。", next: "youxuepai.restore" },
      ],
    },

    "youxuepai.keep": {
      id: "youxuepai.keep", title: "收进包里", role: "第四幕 · 独藏", savepoint: false,
      text: "你把册子收进包里。\n\n走出木屋时，闸口的圆木还躺在门边。你回头看了一眼，觉得那截木头像是在看你。\n\n城里没有人知道这座屋子里发生过什么。\n\n你也可以让这件事一直这样。",
      choices: [
        { id: "use-alone", label: "回去，把平板留给自己用。", next: "youxuepai.ending-mail" },
        { id: "tell-one", label: "至少告诉一个人。", next: "youxuepai.crowd" },
      ],
    },

    "youxuepai.crowd": {
      id: "youxuepai.crowd", title: "人来了", role: "第五幕 · 社区", savepoint: true,
      guide: { title: "优学派漏洞", objective: "看看城里的人怎么面对这座木屋" },
      text: "第二天下午，木屋前开始有人停下。\n\n先是几个放学的孩子，围着闸口看那截圆木。后来又来了两个大人，站在黑板前抄写。\n\n再后来，人越来越多。有人照着册子试，有人只站在旁边看，有人试到一半就转身走了。\n\n闸口的木头始终没有动。",
      choices: [
        { id: "talk-keeper", label: "和守柜的人聊聊。", next: "youxuepai.advesa" },
        { id: "talk-watcher", label: "去滩地另一头看看。", next: "youxuepai.thymol" },
        { id: "watch-finder", label: "留在木板前，等一个人。", next: "youxuepai.failure" },
        { id: "go-counter", label: "去看外墙的黑板。", next: "youxuepai.counter" },
      ],
    },

    "youxuepai.advesa": {
      id: "youxuepai.advesa", title: "守柜的人", role: "第五幕 · 社区", savepoint: false,
      activeActorIds: ["youxuepai_keeper"],
      text: "一个年轻人蹲在闸口旁的小黑板前，写完一行编号才慢慢站起来。\n\n「看柜子的。」他说。「楼里都叫我来看这个。」\n\n他把粉笔夹在耳后，目光越过你，落在木屋的门上。",
      choices: [
        { id: "ask-cabinet", label: "柜子里是什么？", next: "youxuepai.advesa-cabinet" },
        { id: "ask-years", label: "你找了多久？", next: "youxuepai.advesa-years" },
        { id: "ask-other", label: "别的机器也行吗？", next: "youxuepai.advesa-other" },
      ],
    },

    "youxuepai.advesa-cabinet": {
      id: "youxuepai.advesa-cabinet", title: "守柜的人", savepoint: false,
      activeActorIds: ["youxuepai_keeper"],
      text: "「其实有很多，但全被修了，而且每个型号的bug还不一样。」\n\n他用粉笔在小黑板上敲了敲。\n\n「你今天能用的，明天可能就没了。不是同一把锁，也不是同一把钥匙。」",
      choices: [
        { id: "ask-years-next", label: "那你还在找？", next: "youxuepai.advesa-years" },
        { id: "back-crowd", label: "（点头）", next: "youxuepai.crowd" },
      ],
    },

    "youxuepai.advesa-years": {
      id: "youxuepai.advesa-years", title: "守柜的人", savepoint: false,
      activeActorIds: ["youxuepai_keeper"],
      text: "「我初中三年找到bug现在一个都用不了了。」\n\n他把小黑板翻过来。背面密密麻麻全是编号，一行挨着一行。\n\n「都在这上头。能用的时候，没记这么多。」",
      choices: [
        { id: "ask-other-next", label: "别的机器也一样？", next: "youxuepai.advesa-other" },
        { id: "back-crowd-2", label: "（把粉笔递回去）", next: "youxuepai.crowd" },
      ],
    },

    "youxuepai.advesa-other": {
      id: "youxuepai.advesa-other", title: "守柜的人", savepoint: false,
      activeActorIds: ["youxuepai_keeper"],
      text: "他往滩地那头努了努下巴。\n\n「那台学海，立了有些日子了。没人开过。」\n\n停了一下，他又说：\n\n「牌子不一样，锁就不一样。这话我说了三年，没人爱听。」",
      choices: [
        { id: "to-watcher", label: "去学海柜那边看看。", next: "youxuepai.thymol" },
        { id: "back-crowd-3", label: "（记下这句话）", next: "youxuepai.crowd" },
      ],
    },

    "youxuepai.thymol": {
      id: "youxuepai.thymol", title: "看牌子的人", role: "第五幕 · 社区", savepoint: false,
      activeActorIds: ["youxuepai_watcher"],
      text: "滩地另一头立着一座玻璃面柜子，铭牌上写着：学海牌·三星底座。\n\n一个年轻人站在柜前，像在等人，也像在等答案。\n\n你走近时，他先开了口：\n\n「有人会『学海』的吗，就是那个以三星为平台的。」",
      choices: [
        { id: "ask-closed", label: "它很难开？", next: "youxuepai.sea-cabinet" },
        { id: "try-sea", label: "照木屋的次序试一次。", next: "youxuepai.sea-cabinet" },
        { id: "leave-watcher", label: "先不打扰他。", next: "youxuepai.crowd" },
      ],
    },

    "youxuepai.sea-cabinet": {
      id: "youxuepai.sea-cabinet", title: "学海柜", savepoint: false,
      text: "你照着册子上的次序，把柜前的五个把手依次按下，再拉下侧面的总闸。\n\n等了十秒。\n\n又把总闸推回去。\n\n柜子里没有声音。玻璃后面那台机器一动不动。\n\n只浮出四个字：\n\n「（没有反应。）」\n\n看牌子的人把手从玻璃上收回来。\n\n「它是封闭的系统，拿在手里跟废品一样。」",
      choices: [
        { id: "tell-watcher", label: "「不通用。」", next: "youxuepai.thymol-after", effects: [{ type: "event.publish", eventType: "story.achievement", payload: { id: "youxuepai_key", name: "不通用的钥匙" } }] },
        { id: "back-crowd-sea", label: "（把册子合上）", next: "youxuepai.crowd", effects: [{ type: "event.publish", eventType: "story.achievement", payload: { id: "youxuepai_key", name: "不通用的钥匙" } }] },
      ],
    },

    "youxuepai.thymol-after": {
      id: "youxuepai.thymol-after", title: "看牌子的人", savepoint: false,
      activeActorIds: ["youxuepai_watcher"],
      text: "「……你把那台打开了？」\n\n他看了看你手里的空信封。\n\n「嗯。都是盒子。一个一个的，都是盒子。」\n\n他说完，又转回去看那座学海柜。玻璃很硬，声音很闷。",
      choices: [
        { id: "back-crowd-after", label: "回到木屋前。", next: "youxuepai.crowd" },
        { id: "to-counter-after", label: "去看黑板。", next: "youxuepai.counter" },
      ],
    },

    "youxuepai.failure": {
      id: "youxuepai.failure", title: "找漏洞的人", role: "第五幕 · 判词", savepoint: false,
      activeActorIds: ["youxuepai_finder"],
      text: "一个从碑区方向走来的人在你身边站定。他没有看你，只看着木屋前的黑板。\n\n「随便找呗，两分钟找出来一个。」\n\n他说完，又补了一句。",
      choices: [
        { id: "two-minutes", label: "两分钟一个？", next: "youxuepai.failure-lines" },
        { id: "how-many", label: "你已经找到多少了？", next: "youxuepai.failure-lines" },
        { id: "give-chalk", label: "（递粉笔）", next: "youxuepai.failure-lines", effects: [{ type: "flag.set", flagId: "youxuepai.chalk", value: true }, { type: "event.publish", eventType: "story.achievement", payload: { id: "youxuepai_endless", name: "找不完的" } }] },
        { id: "no-answer", label: "（不答）", next: "youxuepai.failure-lines" },
      ],
    },

    "youxuepai.failure-lines": {
      id: "youxuepai.failure-lines", title: "找漏洞的人", savepoint: false,
      activeActorIds: ["youxuepai_finder"],
      text: "「他妈安全性摆设来的，漏洞一堆。」\n\n他停了停，目光从黑板移到闸口。\n\n「慢慢找，你找不完的，这玩意儿太垃圾了。」\n\n说完，他往城里走。走两步，停一下，回头看了看滩地那头的学海柜，又继续走。",
      choices: [
        { id: "look-counter", label: "去看黑板上的数字。", next: "youxuepai.counter" },
        { id: "walk-away", label: "（看着他走远）", next: "youxuepai.ending-endless" },
      ],
    },

    "youxuepai.counter": {
      id: "youxuepai.counter", title: "黑板", role: "第五幕 · 计数器", savepoint: true,
      guide: { title: "优学派漏洞", objective: "在木屋外墙上留下自己的答案" },
      text: "木屋外墙上挂着一块黑板，粉笔字只有一行数字。\n\n你站了一会儿，数字自己变了。\n\n浮出一行小字：\n\n「（黑板自己长了一行。）」\n\n没有人擦它。也没有人有办法把它擦回原来的数。",
      choices: [
        { id: "to-revisit", label: "过一天再来看看。", next: "youxuepai.revisit" },
        { id: "to-sea-again", label: "再去试一次学海柜。", next: "youxuepai.thymol" },
        { id: "to-ending-open", label: "把册子留在黑板上，走。", next: "youxuepai.ending-endless" },
      ],
    },

    "youxuepai.revisit": {
      id: "youxuepai.revisit", title: "回访", role: "尾声 · 回访", savepoint: true,
      guide: { title: "优学派漏洞", objective: "决定给这座木屋留下什么" },
      text: "再来时，木屋前的脚印已经被潮水抹平了。\n\n黑板上的数字又多了几行。闸口那截圆木还横在门边，湿漉漉的。\n\n守柜的人蹲在老地方，看牌子的人还站在学海柜前。\n\n你手里有册子，也有一枚空信封。",
      choices: [
        { id: "restore-gate", label: "把五根木杆扳回原样。", next: "youxuepai.restore" },
        { id: "ask-keeper-again", label: "去和守柜的人说几句话。", next: "youxuepai.advesa" },
        { id: "ask-watcher-again", label: "去学海柜那边。", next: "youxuepai.thymol" },
        { id: "leave-revisit", label: "什么也不做，离开。", next: "youxuepai.ending-mail" },
      ],
    },

    "youxuepai.restore": {
      id: "youxuepai.restore", title: "原样归还", role: "尾声 · 复原", savepoint: true,
      guide: { title: "优学派漏洞", objective: "把木屋恢复成你来之前的样子" },
      text: "你照册子最后一页的次序，把五根木杆一根一根扳回去，再拉下总闸。\n\n十秒后，电回来了。\n\n闸口传来木头重新绷紧的声音。那截圆木慢慢立直，抬起手，拂了一下肩上的灰——如果木头有肩的话。\n\n然后它不动了。\n\n《通关册》自己翻到最后一页。上面只有一行字：\n\n「正在寻找其他漏洞。」\n\n墨迹未干。",
      choices: [
        { id: "close-book", label: "合上《通关册》。", next: "youxuepai.ending-restore", effects: [{ type: "flag.set", flagId: "youxuepai.restored", value: true }, { type: "event.publish", eventType: "story.achievement", payload: { id: "youxuepai_restore", name: "原样归还" } }] },
        { id: "read-counter", label: "再去看一眼黑板。", next: "youxuepai.counter", effects: [{ type: "flag.set", flagId: "youxuepai.restored", value: true }, { type: "event.publish", eventType: "story.achievement", payload: { id: "youxuepai_restore", name: "原样归还" } }] },
      ],
    },

    "youxuepai.ending-report": {
      id: "youxuepai.ending-report", title: "优学派漏洞", role: "结局 · 归档", savepoint: true,
      presentation: "blackout", terminal: true, guide: null,
      text: "木屋的门被钉上了两块交叉的木板。册子装进档案袋，封口处盖了学院的章。\n\n屋主把最后一页复印了一份，压在设备房的抽屉里。\n\n「留着。」他说。「不是为了让人照着做。是为了以后有人问起，能告诉他们，这里曾经有过一扇门。」\n\n闸口那截圆木被搬进了库房。\n\n栈桥边少了一座木屋，多了一块没有字的牌子。",
    },

    "youxuepai.ending-mail": {
      id: "youxuepai.ending-mail", title: "优学派漏洞", role: "结局 · 自留", savepoint: true,
      presentation: "blackout", terminal: true, guide: null,
      text: "你把册子收好，把平板留在自己包里。\n\n木屋的闸门重新合上。你没有告诉任何人。\n\n后来的几天，你用它做了很多事。每一次打开那台机器，你都会想起邮口、想起信封、想起闸口那截湿木头。\n\n再后来，某一次系统提示更新，平板上的图标又灰了回去。\n\n你按照册子上的次序试了一遍。\n\n没有反应。\n\n旧序已划。",
    },

    "youxuepai.ending-endless": {
      id: "youxuepai.ending-endless", title: "优学派漏洞", role: "结局 · 找不完", savepoint: true,
      presentation: "blackout", terminal: true, guide: null,
      text: "册子留在了黑板上。\n\n第二天，有人照着抄了一遍；第三天，有人改了两个数字；第四天，黑板被擦干净，又重新写满。\n\n闸口的人换了一拨又一拨。有人找到了能用的次序，有人找了很久也没找到。\n\n黑板上的数字一直在长。\n\n没有人把它擦回去。\n\n也没有人找到最后一个漏洞。",
    },

    "youxuepai.ending-restore": {
      id: "youxuepai.ending-restore", title: "优学派漏洞", role: "结局 · 复原", savepoint: true,
      presentation: "blackout", terminal: true, guide: null,
      text: "你把册子放回柜台，压在那盏小灯下面。\n\n出门时，闸口的木头人站得笔直。它没有看你，也没有拦你。\n\n栈桥上的风从海面吹过来，木屋屋顶的洞漏下一线天光，落在木桶里。\n\n桶沿那两个字还在：知道。\n\n你没有带走任何东西。",
    },
  },
};
