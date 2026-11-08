import type { StoryDefinition } from "../../../stories/types";

export const PROOFREAD_STORY: StoryDefinition = {
  schemaVersion: 1,
  definitionVersion: 1,
  id: "side.proofread.renumber",
  title: "改编号没改全",
  startNode: "proofread.start",
  entryActorId: "proofread_youmang",

  interactions: [
    { actorId: "proofread_youmang", nodeId: "proofread.start", choiceId: "enter-desk" },
  ],


  nodes: {
    "proofread.start": {
      id: "proofread.start", title: "审稿台", role: "序章", savepoint: true,
      guide: { title: "改编号没改全", objective: "走到实验知识库深处的审稿台前" },
      text: "实验知识库最里面，靠窗有一张空桌。台灯亮着，稿纸压在一只旧镇纸下面，旁边并排放着两只黄铜铃铛。\n\n桌上摊着一本示范卷宗，封面写着：《编号128-血肉房屋》。\n\n椅背上搭着一件没人认领的外套。",
      choices: [
        { id: "enter-desk", label: "走到审稿台前", next: "proofread.desk" },
      ],
    },

    "proofread.desk": {
      id: "proofread.desk", title: "审稿台", role: "状态 0 · 读者", savepoint: true,
      guide: { title: "改编号没改全", objective: "读一读示范卷宗，或把自己的档案放上去" },
      text: "你翻开示范卷宗。第一页写着：「外形是一栋普通的住宅/烂尾楼/商场。」\n\n窗外远处有一栋小房子的剪影，其中一扇窗慢慢亮起暖光。\n\n桌子另一头，两只铃铛都擦得很亮。一本台账压在抽屉把手上。",
      choices: [
        { id: "read-sample", label: "翻开示范卷宗", next: "proofread.sample-1" },
        { id: "submit-dossier", label: "把我的档案放上去", next: "proofread.submit" },
        { id: "inspect-bells", label: "看看两只铃铛", next: "proofread.bells" },
      ],
    },

    "proofread.sample-1": {
      id: "proofread.sample-1", title: "示范卷宗", role: "状态 0 · 读者", savepoint: false,
      text: "收容间常备汽油与喷火器，长期保持一百摄氏度以上。它怕火，怕疼，尖啸起来会收回触手。\n\n再往后是研究记录。\n\n第一行：喷火器攻击，尖啸。\n\n第二行：圣水攻击，死亡。实验备注只有一句——「再去找一只吧」。\n\n第三行：缩小后丢入编号-108。备注：「128被它判定为人类？」\n\n第四行：带有121逆模因特性的炸药。记录最后写着：「128是什么？我们基地根本就没有128这个编号啊？你是不是马戏团的间谍？」",
      choices: [
        { id: "read-card", label: "翻到最后的档案卡", next: "proofread.sample-2" },
        { id: "back-desk", label: "合上卷宗", next: "proofread.desk" },
      ],
    },

    "proofread.sample-2": {
      id: "proofread.sample-2", title: "示范卷宗", role: "状态 0 · 读者", savepoint: false,
      text: "最后一页的档案卡很短。\n\n「编号-128，原收容于25号站点。现状：于启明者的攻击中被彻底消灭，全球范围内已没有个体。威胁等级改为O级。」\n\n「编号-005，原收容于25号站点。现状：于启明者攻击中被暂时性无效化。」\n\n「暂时」两个字被人用铅笔轻轻圈了一下。",
      choices: [
        { id: "close-sample", label: "合上卷宗，放回原处", next: "proofread.desk" },
      ],
    },

    "proofread.bells": {
      id: "proofread.bells", title: "两只铃铛", role: "状态 2 · 传唤", savepoint: false,
      text: "左边那只铃的底座刻着「灭神之天」。右边那只刻着「溯叶悠芒」。\n\n两只铃铛都擦得很亮。\n\n铃响之后，桌对面才会有动静。",
      choices: [
        { id: "ring-founder", label: "摇灭神之天的铃", next: "proofread.bell-founder", availableWhen: [{ type: "flag.equals", flagId: "proofread.submitted", value: true }], effects: [{ type: "event.publish", eventType: "proofread.bell.founder" }] },
        { id: "ring-youmang", label: "摇溯叶悠芒的铃", next: "proofread.arrival", availableWhen: [{ type: "flag.equals", flagId: "proofread.submitted", value: true }] },
        { id: "back-bells", label: "回到桌前", next: "proofread.desk" },
      ],
    },

    "proofread.bell-founder": {
      id: "proofread.bell-founder", title: "灭神之天的铃", role: "状态 2 · 传唤", savepoint: false,
      text: "铃响了。声音很清脆，在互审室里转了一圈，慢慢落回桌面。\n\n没有人来。\n\n门开着，走廊里也没有脚步声。",
      choices: [
        { id: "ring-again", label: "再摇一次", next: "proofread.bell-founder-2", effects: [{ type: "event.publish", eventType: "proofread.bell.founder" }] },
        { id: "return-bells", label: "把铃放回原处", next: "proofread.bells" },
      ],
    },

    "proofread.bell-founder-2": {
      id: "proofread.bell-founder-2", title: "灭神之天的铃", role: "状态 2 · 传唤", savepoint: false,
      text: "铃还是好的。\n\n桌上的稿纸被震得挪了半寸。你等了一会儿，走廊里仍然没有声音。\n\n那只铃的底座上，刻字被擦得很亮。",
      choices: [
        { id: "ring-third", label: "再摇第三次", next: "proofread.bell-founder-3", effects: [{ type: "event.publish", eventType: "proofread.bell.founder" }, { type: "event.publish", eventType: "story.achievement", payload: { id: "proofread_bell_good", name: "铃是好的" } }] },
        { id: "return-bells-2", label: "算了，把铃放回去", next: "proofread.bells" },
      ],
    },

    "proofread.bell-founder-3": {
      id: "proofread.bell-founder-3", title: "灭神之天的铃", role: "状态 2 · 传唤", savepoint: false,
      text: "铃又响了一次。\n\n「别摇了，它会坏的。」\n\n这句话不知道从哪里冒出来。你把铃轻轻放回原位。它还是好好的。",
      choices: [
        { id: "back-founder", label: "回到桌前", next: "proofread.bells" },
      ],
    },

    "proofread.submit": {
      id: "proofread.submit", title: "投稿", role: "状态 1 · 投稿人", savepoint: true,
      guide: { title: "改编号没改全", objective: "把你的档案放上审稿台" },
      text: "你把一沓空稿纸摆到台灯下面。\n\n审稿台只认三栏：名称、外形、弱点。每栏一行。\n\n抽屉里还压着几张认领生成器吐出来的旧档案。",
      choices: [
        { id: "draft-new", label: "现场写一篇简版收容物档案", next: "proofread.draft" },
        { id: "submit-claimed", label: "把认领生成器里那篇放上去", next: "proofread.claimed" },
      ],
    },

    "proofread.draft": {
      id: "proofread.draft", title: "空稿纸", role: "状态 1 · 投稿人", savepoint: false,
      text: "你在第一栏写下名称。笔尖在第二栏停了一会儿，又往下写了外形和弱点。\n\n写到编号时，你想起了墙上那些密密麻麻的牌子。\n\n有些编号是空的，有些编号已经有人。",
      choices: [
        { id: "draft-filled", label: "把三栏都填满", next: "proofread.draft-filled" },
        { id: "draft-blank", label: "只写标题，三栏留白", next: "proofread.bells", set: { "proofread.submitted": true, "proofread.state": 1, "proofread.collision": false } },
        { id: "back-submit", label: "先不写了", next: "proofread.submit" },
      ],
    },

    "proofread.draft-filled": {
      id: "proofread.draft-filled", title: "编号", role: "状态 1 · 投稿人", savepoint: false,
      text: "三栏都填满了。最后只剩编号。\n\n你想起刚才在名录墙上看到的两个号：124 和 128。\n\n124 那一行已经有人了。",
      choices: [
        { id: "use-124", label: "就用 124", next: "proofread.bells", set: { "proofread.submitted": true, "proofread.state": 1, "proofread.collision": true } },
        { id: "use-128", label: "改成 128", next: "proofread.bells", set: { "proofread.submitted": true, "proofread.state": 1, "proofread.collision": false } },
      ],
    },

    "proofread.claimed": {
      id: "proofread.claimed", title: "旧档案", role: "状态 1 · 投稿人", savepoint: false,
      text: "那是一篇从认领生成器里打出来的旧档案。封面上的编号是 124。\n\n正文第一行还留着同一个数字。\n\n你把档案放上台面。",
      choices: [
        { id: "submit-124", label: "原样放上去", next: "proofread.bells", set: { "proofread.submitted": true, "proofread.state": 1, "proofread.collision": true } },
        { id: "change-before-submit", label: "先把封面改成 128", next: "proofread.bells", set: { "proofread.submitted": true, "proofread.state": 1, "proofread.collision": false } },
      ],
    },

    "proofread.arrival": {
      id: "proofread.arrival", title: "溯叶悠芒", role: "状态 3 · 被审", savepoint: true,
      activeActorIds: ["proofread_youmang"],
      guide: { title: "改编号没改全", objective: "接受审稿三问" },
      text: "你摇响右边那只铃，然后离开互审室，走到楼梯口再折返。\n\n门轴吱呀一声。悠芒已经坐在桌子对面，红笔别在胸前口袋，头也不抬地翻你的卷宗。\n\n翻完最后一页，他抬眼。\n\n「铃响得挺快。之前有位，发完稿 31 秒就来 @ 我。你比他沉得住气。」\n\n他把卷宗抚平。「来，三问。」",
      choices: [
        { id: "sit-down", label: "（坐下沉住）", next: "proofread.question-one" },
        { id: "look-pen", label: "（看他的红笔）", next: "proofread.red-pen" },
      ],
    },

    "proofread.red-pen": {
      id: "proofread.red-pen", title: "溯叶悠芒", role: "状态 3 · 被审", savepoint: false,
      activeActorIds: ["proofread_youmang"],
      text: "悠芒顺着你的视线看了一眼胸前口袋。\n\n「红笔不咬人。它只找两样东西：错的编号，和没改全的地方。」\n\n他顿了一下。「都是好东西。错的地方改完，就是档案了。」",
      choices: [
        { id: "to-question-one", label: "（把卷宗推过去）", next: "proofread.question-one" },
      ],
    },

    "proofread.question-one": {
      id: "proofread.question-one", title: "第一问 · 编号", role: "状态 3 · 被审", savepoint: true,
      activeActorIds: ["proofread_youmang"],
      text: "悠芒把卷宗翻到封面。\n\n第一问。「到底是124还是128」——\n\n你的编号，墙上有吗？",
      choices: [
        { id: "answer-collision", label: "（把封面推过去）", next: "proofread.collision", availableWhen: [{ type: "flag.equals", flagId: "proofread.collision", value: true }] },
        { id: "answer-clean", label: "（把封面推过去）", next: "proofread.number-question", availableWhen: [{ type: "flag.equals", flagId: "proofread.collision", value: false }] },
      ],
    },

    "proofread.collision": {
      id: "proofread.collision", title: "撞号", role: "状态 3 · 被审", savepoint: true,
      activeActorIds: ["proofread_youmang"],
      text: "悠芒的笔尖停住。\n\n「这号有主。」\n\n他在纸上点了点。「（原编号是124，后来124被占了，改编号没改全）」——原话不是我说的，是上一位踩坑的说的。墙不跟你商量，墙只跟先来的人商量。你换一个。」",
      choices: [
        { id: "change-number", label: "（换号）", next: "proofread.renumber" },
        { id: "ask-first-line", label: "为什么第一行最容易漏？", next: "proofread.why-first-line" },
      ],
    },

    "proofread.why-first-line": {
      id: "proofread.why-first-line", title: "第一行", role: "状态 3 · 被审", savepoint: false,
      activeActorIds: ["proofread_youmang"],
      text: "「因为写它的时候你还没决定编号。」\n\n悠芒敲了敲桌面。「人的第一行都是这样——写的时候以为定稿，其实只是开头。」\n\n「我读稿也从第一行读起。撞上了。」",
      choices: [
        { id: "renumber-after-why", label: "（换号）", next: "proofread.renumber" },
      ],
    },

    "proofread.renumber": {
      id: "proofread.renumber", title: "换号", role: "状态 3 · 被审", savepoint: false,
      activeActorIds: ["proofread_youmang"],
      text: "你在卷宗封面划掉旧号，写上新的。\n\n悠芒把卷宗推回给你，笔尖在正文第一行停了停。\n\n「封面改好了。」\n\n「里面那行，你自己改。」\n\n「『改编号没改全』——这六个字，全宇宙就我一个人在抓。」\n\n他收回笔。「先别急着找。第二问。」",
      choices: [
        { id: "renumber-to-rule", label: "（把卷宗翻到第二页）", next: "proofread.rule-question", set: { "proofread.renumbered": true, "proofread.residual": true } },
      ],
    },

    "proofread.number-question": {
      id: "proofread.number-question", title: "第一问 · 编号", role: "状态 3 · 被审", savepoint: true,
      activeActorIds: ["proofread_youmang"],
      text: "悠芒看了一眼封面。\n\n「你这编号……墙上有吗？」\n\n他侧头想了想墙上的名录，笔尖在空白处点了一下。\n\n「没有。算你运气好。」\n\n「第二问。」",
      choices: [
        { id: "clean-to-rule", label: "（翻到第二页）", next: "proofread.rule-question", set: { "proofread.residual": true } },
      ],
    },

    "proofread.rule-question": {
      id: "proofread.rule-question", title: "第二问 · 规程", role: "状态 3 · 被审", savepoint: true,
      activeActorIds: ["proofread_youmang"],
      text: "「第二问。你这外形——」他念了一遍你写的外形，「——配这弱点？」\n\n「『不要滥用现实稳定锚，这又不是现实扭曲型异常』。」\n\n「普通的东西用普通的规程。乱用锚，锚会累的。」",
      choices: [
        { id: "revise-weakness", label: "（现场改弱点栏）", next: "proofread.rule-fixed" },
        { id: "keep-weakness", label: "（坚持不改）", next: "proofread.rule-insist" },
      ],
    },

    "proofread.rule-fixed": {
      id: "proofread.rule-fixed", title: "第二问 · 规程", role: "状态 3 · 被审", savepoint: false,
      activeActorIds: ["proofread_youmang"],
      text: "你划掉原来的弱点，重新写。\n\n悠芒等改完，扫了一眼。\n\n「行。房子怕火就写怕火，收容间备汽油和喷火器，一百度以上——」\n\n他停了一下，指了指桌上的示范卷宗。「这例子不是我举的。是那份卷宗里抄的。抄得对。抄规程不丢人。」",
      choices: [
        { id: "fixed-to-ethics", label: "（翻到下一页）", next: "proofread.ethics-question", set: { "proofread.weakness.revised": true } },
      ],
    },

    "proofread.rule-insist": {
      id: "proofread.rule-insist", title: "第二问 · 规程", role: "状态 3 · 被审", savepoint: false,
      activeActorIds: ["proofread_youmang"],
      text: "你没改。\n\n悠芒在卷宗边角画了个圈，没说话。\n\n半晌，他开口：「行。你的档案你做主。」\n\n「但圈在这。以后谁翻到这页，谁看见。」\n\n「——这就是审稿的意思。不留情面，只留笔迹。」",
      choices: [
        { id: "insist-to-ethics", label: "（翻到下一页）", next: "proofread.ethics-question", set: { "proofread.weakness.revised": false } },
      ],
    },

    "proofread.ethics-question": {
      id: "proofread.ethics-question", title: "第三问 · 伦理", role: "状态 3 · 被审", savepoint: true,
      activeActorIds: ["proofread_youmang"],
      text: "「第三问。」\n\n悠芒把红笔帽合上，第一次抬头直视你。\n\n「『收容，不是消耗。』」\n\n「你这收容方式——养它，还是用完再抓？」",
      choices: [
        { id: "answer-consume", label: "用完再抓。", next: "proofread.ethics-consume", set: { "proofread.ethics.answer": "consume" }, effects: [{ type: "event.publish", eventType: "story.achievement", payload: { id: "proofread_again", name: "再去找一只吧" } }] },
        { id: "answer-raise", label: "养它。", next: "proofread.ethics-raise", set: { "proofread.ethics.answer": "raise" } },
        { id: "answer-silent", label: "（沉默）", next: "proofread.ethics-silent", set: { "proofread.ethics.answer": "silent" } },
      ],
    },

    "proofread.ethics-consume": {
      id: "proofread.ethics-consume", title: "第三问 · 伦理", role: "状态 3 · 被审", savepoint: false,
      activeActorIds: ["proofread_youmang"],
      text: "悠芒的笔停了两秒，记下。\n\n「『再去找一只吧』——有位研究记录里就这么写。我问过他：『居然还能再找一只？』」\n\n「他不答。你答了。」\n\n他合上笔帽。「答完档案照收。审稿不管人心，管记录。记录里你诚实，就行。」",
      choices: [
        { id: "consume-to-comedy", label: "（继续）", next: "proofread.comedy" },
      ],
    },

    "proofread.ethics-raise": {
      id: "proofread.ethics-raise", title: "第三问 · 伦理", role: "状态 3 · 被审", savepoint: false,
      activeActorIds: ["proofread_youmang"],
      text: "悠芒点头，记下。\n\n「好。那它死了你会难过。」\n\n「难过也记下来。」\n\n他顿了顿。「编号比异常活得久，难过比编号活得久。都是档案的一部分。」",
      choices: [
        { id: "raise-to-comedy", label: "（继续）", next: "proofread.comedy" },
      ],
    },

    "proofread.ethics-silent": {
      id: "proofread.ethics-silent", title: "第三问 · 伦理", role: "状态 3 · 被审", savepoint: false,
      activeActorIds: ["proofread_youmang"],
      text: "你沉默。\n\n悠芒等了一会儿，笔尖落下，写了两个字：「沉默」。\n\n「沉默也是答。收下了。」",
      choices: [
        { id: "silent-to-comedy", label: "（继续）", next: "proofread.comedy" },
      ],
    },

    "proofread.comedy": {
      id: "proofread.comedy", title: "审稿中段", role: "状态 3 · 被审", savepoint: false,
      activeActorIds: ["proofread_youmang"],
      text: "悠芒翻到收容方式那一页，笔尖悬在纸上。\n\n「所以，它到底靠什么被压住？」\n\n他抬眼看你，等你回答。",
      choices: [
        { id: "quote-original", label: "（引用原文回应）", next: "proofread.comedy-intercepted" },
        { id: "normal-answer", label: "（老老实实自己说）", next: "proofread.check-pass" },
      ],
    },

    "proofread.comedy-intercepted": {
      id: "proofread.comedy-intercepted", title: "你的话被拦截了", role: "状态 3 · 被审", savepoint: false,
      activeActorIds: ["proofread_youmang"],
      text: "回应框里浮出半句话：\n\n「低阶现实扭曲能力，***示稳定锚：）」\n\n三个星号悬在屏幕中间，停了两秒。\n\n悠芒盯着看了两秒，肩膀抖了一下。\n\n「你的话被拦截了（）」\n\n他把卷宗转过来。「在纸上写没事，纸不过滤。过滤的是话，不是档案。换个说法，再来。」",
      choices: [
        { id: "say-anchor", label: "「低阶现实扭曲能力，用锚压着。」", next: "proofread.comedy-rephrased" },
        { id: "say-nail", label: "「它扭曲现实，锚把它钉住。」", next: "proofread.comedy-rephrased" },
        { id: "say-torque", label: "「低阶扭力，锚定处理。」", next: "proofread.comedy-rephrased" },
      ],
    },

    "proofread.comedy-rephrased": {
      id: "proofread.comedy-rephrased", title: "档案语言", role: "状态 3 · 被审", savepoint: false,
      activeActorIds: ["proofread_youmang"],
      text: "悠芒点头。\n\n「这才叫档案语言。」\n\n「不过——『有现实扭曲能力你档案没体现啊』。」\n\n他红笔圈住正文空白处。「这里补三行。写完这案就结了。」",
      choices: [
        { id: "write-three-lines", label: "（补上三行说明）", next: "proofread.check-pass", set: { "proofread.intercepted": true }, effects: [{ type: "event.publish", eventType: "story.achievement", payload: { id: "proofread_intercepted", name: "你的话被拦截了" } }] },
      ],
    },

    "proofread.check-pass": {
      id: "proofread.check-pass", title: "审稿完毕", role: "状态 3 · 被审", savepoint: true,
      activeActorIds: ["proofread_youmang"],
      text: "三问的红痕都留在卷宗上。\n\n悠芒合上卷宗，却没有往抽屉里放。\n\n「看完了，两个问题。」\n\n「一个，刚才说完了。」\n\n他把卷宗推回你面前。「还有一个——在第一行。」\n\n「逐字找。找到再叫我。」",
      choices: [
        { id: "scan-lines", label: "（逐字扫读）", next: "proofread.find-error" },
      ],
    },

    "proofread.find-error": {
      id: "proofread.find-error", title: "第一行", role: "寻错", savepoint: false,
      activeActorIds: ["proofread_youmang"],
      text: "你把第一行从头读到尾。\n\n写到一半，你停住了。\n\n那里还留着旧编号。它很小，藏在句子中间，像一枚没拔干净的钉子。\n\n你把它划掉，写上新的。\n\n台灯闪了一下。",
      choices: [
        { id: "call-youmang", label: "（改完，抬头）", next: "proofread.after-fix", set: { "proofread.residual.fixed": true, "proofread.state": 4 }, effects: [{ type: "event.publish", eventType: "story.achievement", payload: { id: "proofread_renumber", name: "改编号没改全" } }] },
      ],
    },

    "proofread.after-fix": {
      id: "proofread.after-fix", title: "找到了", role: "状态 4 · 已入册", savepoint: true,
      activeActorIds: ["proofread_youmang"],
      guide: { title: "改编号没改全", objective: "去看那 27 秒，然后上墙" },
      text: "悠芒收卷，起身。\n\n「找到了。」\n\n他顿了顿。「上一位是三小时后自己想通的。你比他快——也可能他早找到了，就是懒得改。」\n\n「他是鸽子。你不知道什么是鸽子，挺好。」\n\n走到门口，他回头。「27 秒后看墙。」",
      choices: [
        { id: "to-clock", label: "去看挂钟和台账", next: "proofread.twentyseven" },
      ],
    },

    "proofread.twentyseven": {
      id: "proofread.twentyseven", title: "二十七秒", role: "状态 4 · 已入册", savepoint: true,
      activeActorIds: ["proofread_youmang"],
      text: "你抬头看墙上的挂钟。秒针走着，走到整点时忽然快跳了 27 格。\n\n抽屉里的台账摊开着。朱笔写着一行字：\n\n「08:23:27 审毕／08:23:54 入册——中间那 27 秒在干嘛？在改墙。」\n\n窗外，一层名牌墙的方向亮着一盏小灯。",
      choices: [
        { id: "inspect-clock", label: "数挂钟快跳的格数", next: "proofread.seven-clock", effects: [{ type: "event.publish", eventType: "proofread.time.fragment" }] },
        { id: "open-ledger", label: "翻开台账", next: "proofread.seven-ledger", effects: [{ type: "event.publish", eventType: "proofread.time.fragment" }] },
        { id: "ask-about-27", label: "问悠芒那 27 秒在干嘛", next: "proofread.seven-chat", effects: [{ type: "event.publish", eventType: "proofread.time.fragment" }] },
        { id: "to-wall", label: "去一层名牌墙", next: "proofread.seven-complete", availableWhen: [{ type: "event.occurred", eventType: "proofread.time.fragment", atLeast: 3 }] },
      ],
    },

    "proofread.seven-clock": {
      id: "proofread.seven-clock", title: "挂钟", role: "时间锚", savepoint: false,
      text: "你数了三遍。每次都是 27 格。\n\n秒针在 08:23:27 的位置上停了停，像在等什么，然后一口气跳到 08:23:54。\n\n墙上的钟没有解释。它只是继续走。",
      choices: [
        { id: "clock-back", label: "回到桌前", next: "proofread.twentyseven" },
      ],
    },

    "proofread.seven-ledger": {
      id: "proofread.seven-ledger", title: "台账", role: "时间锚", savepoint: false,
      text: "台账那一页只有一行朱笔，笔锋很重。\n\n「08:23:27 审毕／08:23:54 入册——中间那 27 秒在干嘛？在改墙。」\n\n下面压着一沓旧稿纸，每张页边都有红痕。你没有翻。",
      choices: [
        { id: "ledger-back", label: "回到桌前", next: "proofread.twentyseven" },
      ],
    },

    "proofread.seven-chat": {
      id: "proofread.seven-chat", title: "悠芒", role: "时间锚", savepoint: false,
      activeActorIds: ["proofread_youmang"],
      text: "悠芒正在把红笔别回口袋。\n\n「那 27 秒我干嘛了？」\n\n他看了你一眼，笑了一下。\n\n「你猜。」\n\n他没有再说。",
      choices: [
        { id: "chat-back", label: "回到桌前", next: "proofread.twentyseven" },
      ],
    },

    "proofread.seven-complete": {
      id: "proofread.seven-complete", title: "骂完了就收编", role: "时间锚", savepoint: true,
      text: "挂钟的秒针停在 08:23:27，停了三秒。\n\n然后快跳。\n\n08:23:54。\n\n钟面下方浮出四个小字，很快又淡下去：\n\n「骂完了就收编。」",
      choices: [
        { id: "complete-to-wall", label: "去一层名牌墙", next: "proofread.wall", set: { "proofread.time.anchor": true }, effects: [{ type: "event.publish", eventType: "story.achievement", payload: { id: "proofread_twenty_seven", name: "二十七秒" } }] },
      ],
    },

    "proofread.wall": {
      id: "proofread.wall", title: "名牌墙", role: "状态 4 · 已入册", savepoint: true,
      activeActorIds: ["proofread_youmang"],
      guide: { title: "改编号没改全", objective: "决定怎么离开审稿台" },
      text: "一层的名牌墙前，悠芒已经站在那里。\n\n他指了指你档案旁边的位置。一枚灰框的收容物铭牌，上面写着你的编号和档案名。\n\n「上墙了。」\n\n「收容物铭牌，灰框。你的档案从今天起比你的名字先挂在墙上——名牌要等你入册，铭牌只等你的稿子。」\n\n他把手插回口袋。「一篇一个。墙够大。」",
      choices: [
        { id: "end-wall", label: "把卷宗收好，离开", next: "proofread.ending-wall" },
        { id: "stay-night", label: "在城里绕一圈，深夜再回来", next: "proofread.night-return" },
        { id: "next-time", label: "不看了，下次再来", next: "proofread.ending-next-time" },
      ],
    },

    "proofread.night-return": {
      id: "proofread.night-return", title: "深夜的审稿台", role: "回访", savepoint: true,
      activeActorIds: ["proofread_youmang", "proofread_zhanshuai"],
      text: "你回到互审室时，楼里已经没什么人了。\n\n台灯还亮着。桌上多了一张便签，压在你的卷宗上面。\n\n便签是另一种笔迹，字写得很慢：\n\n「深渊设定越补越多了（）——回去把档案改了。别学我。（我到现在还没改。）」\n\n卷宗末页浮出一条红字批注：\n\n「已入册。第一行的问题，下次自己找。」\n\n桌子另一头，战帅荷鲁斯正坐在那里，手里翻着一本旧卷宗。",
      choices: [
        { id: "read-note", label: "把便签读完", next: "proofread.night-note" },
        { id: "ask-zhanshuai", label: "问战帅：你到底改没改？", next: "proofread.night-zhanshuai" },
        { id: "leave-folder", label: "把卷宗留在台灯下，离开", next: "proofread.ending-night" },
      ],
    },

    "proofread.night-note": {
      id: "proofread.night-note", title: "便签", role: "回访", savepoint: false,
      activeActorIds: ["proofread_zhanshuai"],
      text: "你把便签翻过来。背面还有一行更小的字：\n\n「明天。或者后天。反正会改。」\n\n你看向战帅。他没有抬头，只是把手里那本旧卷宗又翻过一页。\n\n台灯的光落在便签边缘，照出纸纤维的毛边。",
      choices: [
        { id: "keep-note", label: "把便签夹进自己的卷宗", next: "proofread.night-return", availableWhen: [{ type: "flag.equals", flagId: "proofread.note.read", value: false }], set: { "proofread.note.read": true }, effects: [{ type: "event.publish", eventType: "story.achievement", payload: { id: "proofread_patch", name: "深渊设定越补越多" } }] },
        { id: "note-back", label: "把便签放回去", next: "proofread.night-return" },
      ],
    },

    "proofread.night-zhanshuai": {
      id: "proofread.night-zhanshuai", title: "战帅荷鲁斯", role: "回访", savepoint: false,
      activeActorIds: ["proofread_zhanshuai"],
      text: "他听见你走近，把卷宗合上。\n\n「哦。」\n\n他看了你一眼，又看了看你的铭牌方向。「你的也上墙了。」\n\n你问他到底改没改档案。\n\n他沉默了两秒。「咕。」\n\n他把便签翻过去，扣在桌上。「今天的更新量已满。明天。」\n\n顿了顿。「或者后天。」\n\n又顿了顿。「反正会改。」\n\n他小声补了一句：「——这句是真的。你看编号：124 改 128，我改了的。就是没改全。」",
      choices: [
        { id: "ask-how-many", label: "你写了多少篇？", next: "proofread.night-zhanshuai-2" },
        { id: "zhanshuai-back", label: "（不再追问）", next: "proofread.night-return" },
      ],
    },

    "proofread.night-zhanshuai-2": {
      id: "proofread.night-zhanshuai-2", title: "战帅荷鲁斯", role: "回访", savepoint: false,
      activeActorIds: ["proofread_zhanshuai"],
      text: "他掰着指头数。\n\n「七十六、八十三、八十九、一百零八、一百十七、一百二十一、一百二十二……一百二十八。」\n\n数到这里，他停下。「中间还有三篇短篇。低质同人。」\n\n他很快补了一句：「低质，但交了。」\n\n「交了就上墙。这楼就这一点好。」",
      choices: [
        { id: "count-back", label: "（点头）", next: "proofread.night-return" },
      ],
    },

    "proofread.ending-wall": {
      id: "proofread.ending-wall", title: "改编号没改全", role: "结局 · 上墙", savepoint: true, presentation: "blackout", terminal: true, guide: null,
      text: "你最后看了一眼那枚灰框铭牌。\n\n编号比异常活得久。写对编号的人，也比编号活得久一点。\n\n你走出实验知识库。街上风很轻。\n\n口袋里那篇卷宗已经交出去了，但你记得第一行的位置。\n\n下次写的时候，你会先回头看一眼。",
    },

    "proofread.ending-next-time": {
      id: "proofread.ending-next-time", title: "改编号没改全", role: "结局 · 回访", savepoint: true, presentation: "blackout", terminal: true, guide: null,
      text: "你没有等到深夜。\n\n卷宗留在审稿台上，台灯还亮着。\n\n走出门的时候，你听见身后很轻的一声——像是铃，又像是纸页翻动。\n\n「下次自己找。」\n\n你记住了这句话。",
    },

    "proofread.ending-night": {
      id: "proofread.ending-night", title: "改编号没改全", role: "结局 · 批注", savepoint: true, presentation: "blackout", terminal: true, guide: null,
      activeActorIds: ["proofread_youmang", "proofread_zhanshuai"],
      text: "你把卷宗留在台灯下，没有带走。\n\n便签压在封面上，红字批注留在末页。\n\n审稿台不需要关门。它只需要有人把灯留着。\n\n第二天你再来时，卷宗已经被放回架上。第一行改过的地方，多了一道很淡的铅笔线。\n\n没有署名。",
    },
  },
};
