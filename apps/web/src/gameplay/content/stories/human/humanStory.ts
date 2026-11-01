import type { StoryDefinition } from "../../../stories/types";

/**
 * 支线剧情：《究竟怎样作为一个人存在》
 *
 * 文学街报社后巷的玻璃暖房里，一页赶不上周日版面的字被刻在东墙上。
 * 玩家可以向那个影求证，也可以听别人怎么谈论 ta，或者把一件真实的事托付给 ta。
 *
 * 节点命名规范：human.<act>.<beat>
 * 旗标命名规范：human.<subject>.<key>
 */
export const HUMAN_STORY: StoryDefinition = {
  schemaVersion: 1,
  definitionVersion: 1,
  id: "side.human.exist",
  title: "究竟怎样作为一个人存在",
  startNode: "human.start",
  entryActorId: "human_voice",

  interactions: [
    { actorId: "human_voice", nodeId: "human.start", choiceId: "read-wall" },
  ],

  buildingInteractions: [
    { buildingId: "knowledgebaseD", nodeId: "human.start", choiceId: "read-wall" },
  ],

  nodes: {
    "human.start": {
      id: "human.start", title: "未刊温室", role: "序章 · 门楣", savepoint: true,
      guide: { title: "究竟怎样作为一个人存在", objective: "走进报社后巷的玻璃暖房" },
      activeActorIds: ["human_voice"],
      text: "报社后巷的坡顶有一间玻璃暖房。门没锁，木匾上刻着一行小字：\n\n「本页尚未成为新闻。它还在发生。」\n\n暖房里亮着一盏低灯。热月坐在刻文墙前的木案旁，笔尖压在一页还没干的字上。她没有抬头。\n\n「门没锁。轻一点——字还没干。」",
      choices: [
        { id: "read-wall", label: "走向东墙，读那页字。", next: "human.wall-first", set: { "human.entered": true } },
        { id: "ask-writing", label: "你在写什么？", next: "human.ask-writing" },
      ],
    },

    "human.ask-writing": {
      id: "human.ask-writing", title: "热月", role: "序章 · 写字", savepoint: false,
      activeActorIds: ["human_voice"],
      text: "「周刊的版周三就截了。周四写的东西，本来就没打算给谁看。」\n\n她停了一下，笔尖没离纸。\n\n「给墙看。」",
      choices: [
        { id: "to-wall", label: "那我去看看那面墙。", next: "human.wall-first" },
        { id: "leave-her", label: "不打扰她。", next: "human.start" },
      ],
    },

    "human.wall-first": {
      id: "human.wall-first", title: "刻文墙", role: "第一幕 · 读墙", savepoint: true,
      activeActorIds: ["human_voice"],
      text: "东墙整面都是浅色砂岩。595 个字分作十五行，八行刻字，七行留白。你从第一行读起。\n\n「最近产生了一些思绪，我想把它表达出来。」\n\n「究竟怎么样才能算作是作为一个独立的人而存在呢？」\n\n热月的声音从背后传来，笔没有停。\n\n「问题我不急着答。急着答的问题，答案都活不长。」",
      choices: [
        { id: "keep-reading", label: "继续往下读。", next: "human.wall-experiment" },
        { id: "ask-writing-again", label: "回头问她一句。", next: "human.ask-writing" },
      ],
    },

    "human.wall-experiment": {
      id: "human.wall-experiment", title: "刻文墙", role: "第一幕 · 思想实验", savepoint: true,
      activeActorIds: ["human_voice"],
      text: "「人应当拥有两点，即产生意识和实践的物质基础、意识和社会关系。如果意识和社会关系是自然发生的，应该视为人。」\n\n「如果我们在自己的脑中培养一个意识体，ta能自然发生意识并有独立创造有限制的社会关系的能力……ta应该被视为人吗？这是一个伦理学问题，暂时悬置不去探讨。我们先假设这样的存在。」\n\n读到第七行时，你余光里多了一个影。很淡，像玻璃上的一层灰。你一转头，它就不在原处。\n\n热月没有抬头。\n\n「别盯着墙角看。你一盯，ta 就散。」",
      choices: [
        { id: "finish-wall", label: "把剩下的读完。", next: "human.wall-read" },
        { id: "look-shadow", label: "向那个影求证：你真的存在吗？", next: "human.proof-first" },
        {
          id: "wait-slightly", label: "留在墙前，等到 19:05:32。", next: "human.ending-slightly",
          set: { "human.witness.slightly": true, "human.finished": true, "human.ending": "slightly" },
          effects: [{ type: "event.publish", eventType: "story.achievement", payload: { id: "human_slightly", name: "有点" } }],
        },
      ],
    },

    "human.wall-read": {
      id: "human.wall-read", title: "刻文墙", role: "第一幕 · 读毕", savepoint: true,
      activeActorIds: ["human_voice"],
      text: "最后一行没有句号。\n\n「我越思考这些问题，我的那个ta就越疏离和飘渺，ta好像有点死了」\n\n你读完，墙顶浮起一行小字：\n\n「读完了。它还在发生。」\n\n那是你第一次觉得，这间暖房保存的是一页还没结束的思绪。",
      choices: [
        { id: "ask-ta", label: "问热月：ta 是什么？", next: "human.ask-ta", set: { "human.wall.read": true, "human.shadow.seen": true } },
        { id: "seek-shadow", label: "去找那个影。", next: "human.proof-first", set: { "human.wall.read": true, "human.shadow.seen": true } },
        { id: "to-door", label: "去看西墙那扇双面门。", next: "human.door-arrive", set: { "human.wall.read": true, "human.shadow.seen": true } },
      ],
    },

    "human.ask-ta": {
      id: "human.ask-ta", title: "热月", role: "第一幕 · 那个影", savepoint: false,
      activeActorIds: ["human_voice"],
      text: "热月终于把笔搁下。\n\n「帖子里那个。」她用笔杆指了指刻文墙。「我照着写的。写到后来，我那个 ta 也是——越写越淡。最后那半句，你看到了。」\n\n她把笔收进袖口。\n\n「所以 ta 就住在这儿了。我不问 ta，ta 就不走。」",
      choices: [
        { id: "ask-if-person", label: "那 ta 算不算人？", next: "human.suspend" },
        { id: "ask-to-door", label: "先不问了。", next: "human.door-arrive" },
        { id: "ask-to-shadow", label: "再去看看那个影。", next: "human.proof-first" },
      ],
    },

    "human.suspend": {
      id: "human.suspend", title: "热月", role: "第一幕 · 悬置", savepoint: true,
      activeActorIds: ["human_voice"],
      text: "热月沉默了很久。\n\n「帖子里写了——这是一个伦理学问题，暂时悬置，不去探讨。」\n\n她抬起头。\n\n「我们馆里的规矩就这两个字。你要是非要一个答案，出门左转，碑区有的是碑，每块都写着答案。这儿只养问题。」",
      choices: [
        { id: "suspend-to-door", label: "那我去看看那扇门。", next: "human.door-arrive" },
        { id: "suspend-to-shadow", label: "我还是想向 ta 求证。", next: "human.proof-first" },
      ],
    },

    "human.proof-first": {
      id: "human.proof-first", title: "墙角", role: "第一幕 · 求证", savepoint: true,
      activeActorIds: ["human_voice"],
      text: "你面向那个影，问它是否真的存在。\n\n影淡了一格。玻璃上像被人呵了一口气。\n\n热月没有停笔。\n\n「问了？」",
      choices: [
        { id: "proof-again-1", label: "再问一次。", next: "human.proof-second", set: { "human.proof.count": 2 } },
        { id: "proof-stop-1", label: "算了，回去读墙。", next: "human.wall-read" },
      ],
    },

    "human.proof-second": {
      id: "human.proof-second", title: "墙角", role: "第一幕 · 求证", savepoint: false,
      activeActorIds: ["human_voice"],
      text: "你又问了一次。影更淡了，南窗的雾厚了一层。\n\n「我以前也这样。问一句，淡一层。」",
      choices: [
        { id: "proof-again-2", label: "再问一次。", next: "human.proof-third", set: { "human.proof.count": 3 } },
        { id: "proof-stop-2", label: "算了，回去读墙。", next: "human.wall-read" },
      ],
    },

    "human.proof-third": {
      id: "human.proof-third", title: "墙角", role: "第一幕 · 求证", savepoint: false,
      activeActorIds: ["human_voice"],
      text: "第三次。影只剩下轮廓，像水面上散开的一道纹。\n\n热月终于抬头看了一眼墙角。\n\n「差不多了。再问，就要问没了。」",
      choices: [
        { id: "proof-again-3", label: "再问一次。", next: "human.proof-fourth", set: { "human.proof.count": 4 } },
        { id: "proof-stop-3", label: "算了，回去读墙。", next: "human.wall-read" },
      ],
    },

    "human.proof-fourth": {
      id: "human.proof-fourth", title: "墙角", role: "第一幕 · 求证", savepoint: false,
      activeActorIds: ["human_voice"],
      text: "第四次。你几乎看不见它了。\n\n热月放下笔。\n\n「住手吧。这页字就是问出来的下场——你看看最后一行。」",
      choices: [
        { id: "proof-again-4", label: "再问最后一次。", next: "human.proof-fifth", set: { "human.proof.count": 5 } },
        { id: "proof-stop-4", label: "算了，回去读墙。", next: "human.wall-read" },
      ],
    },

    "human.proof-fifth": {
      id: "human.proof-fifth", title: "墙角", role: "第一幕 · 消散", savepoint: true,
      activeActorIds: ["human_voice"],
      text: "你问了第五次。\n\n全馆的玻璃同时起雾，又同时转清。墙角空了。\n\n门楣上的字幻变了六十秒：\n\n「本页已经发生完了。」\n\n热月望着空了的墙角，很久没有说话。",
      choices: [
        {
          id: "gone-to-door", label: "离开东墙。", next: "human.door-arrive",
          set: { "human.proof.dissolved": true },
          effects: [{ type: "event.publish", eventType: "story.achievement", payload: { id: "human_some_proof", name: "有些证明等于熄灭" } }],
        },
        {
          id: "gone-to-start", label: "在门口站一会儿。", next: "human.dissolve-after",
          set: { "human.proof.dissolved": true },
          effects: [{ type: "event.publish", eventType: "story.achievement", payload: { id: "human_some_proof", name: "有些证明等于熄灭" } }],
        },
      ],
    },

    "human.dissolve-after": {
      id: "human.dissolve-after", title: "热月", role: "第一幕 · 次日", savepoint: false,
      activeActorIds: ["human_voice"],
      text: "第二天你再进馆时，热月还坐在木案前。\n\n「昨天的事我看见了。它还会回来的。」\n\n她顿了顿。\n\n「它每次都回来，淡一点，但回来。」",
      choices: [
        { id: "after-to-door", label: "去看那扇门。", next: "human.door-arrive" },
        { id: "after-to-rack", label: "馆里多了一座谱架。", next: "human.rack-arrival" },
      ],
    },

    "human.door-arrive": {
      id: "human.door-arrive", title: "双面门", role: "第二幕 · 门", savepoint: true,
      activeActorIds: ["human_voice"],
      text: "西墙正中开着一扇门。门后只有六帕深的壁龛，龛底一面小镜。门虚掩着，推不开多一半。\n\n正面刻着一行极稳的字：\n\n「能够承担现实责任，就可以算是一个人」\n\n门框下有一行极小的注：「——一行刻得很稳的字。18:46。」\n\n背面还有一行，笔迹活得多：\n\n「现实责任是什么」",
      choices: [
        { id: "answer-door", label: "对门说出你的答案。", next: "human.door-answer1" },
        { id: "ask-door-reiyue", label: "问热月，门上那两行字是什么意思。", next: "human.door-reiyue" },
        { id: "touch-mirror", label: "看壁龛里那面小镜。", next: "human.mirror" },
      ],
    },

    "human.door-reiyue": {
      id: "human.door-reiyue", title: "热月", role: "第二幕 · 门", savepoint: false,
      activeActorIds: ["human_voice"],
      text: "「门上那两行字，一行是给的答案，一行是问回去的问题。中间隔了十八秒。」\n\n她停了一下。\n\n「这一分钟里，住着整座城的脾气。」",
      choices: [
        { id: "reiyue-to-answer", label: "那我也回答一次。", next: "human.door-answer1" },
        { id: "reiyue-to-door", label: "先看看门。", next: "human.door-arrive" },
      ],
    },

    "human.mirror": {
      id: "human.mirror", title: "壁龛小镜", role: "第二幕 · 镜", savepoint: false,
      activeActorIds: ["human_voice"],
      text: "你俯身去看那面小镜。\n\n镜里是整座温室的倒影：刻文墙、木案、谱架、你自己。\n\n只有墙角空着一格。\n\n影在镜中永不成像。",
      choices: [
        { id: "mirror-to-answer", label: "回到门前，回答一次。", next: "human.door-answer1" },
        { id: "mirror-to-door", label: "退开一步。", next: "human.door-arrive" },
      ],
    },

    "human.door-answer1": {
      id: "human.door-answer1", title: "双面门", role: "第二幕 · 回答", savepoint: true,
      text: "你说出第一个答案。\n\n墙面上浮起你的字，停了两秒，淡去。\n\n门内传来一声很轻的回问：\n\n「现实责任是什么」\n\n门把你的问题原样还给了你。",
      choices: [
        { id: "answer-again-1", label: "再回答一次。", next: "human.door-answer2", set: { "human.door.answers": 1 } },
        { id: "answer-stop-1", label: "先到这里。", next: "human.door-arrive" },
      ],
    },

    "human.door-answer2": {
      id: "human.door-answer2", title: "双面门", role: "第二幕 · 回答", savepoint: false,
      text: "你换了一种说法。\n\n字浮起，淡去。门内仍是那一句：\n\n「现实责任是什么」",
      choices: [
        { id: "answer-again-2", label: "再回答一次。", next: "human.door-answer3", set: { "human.door.answers": 2 } },
        { id: "answer-stop-2", label: "先到这里。", next: "human.door-arrive" },
      ],
    },

    "human.door-answer3": {
      id: "human.door-answer3", title: "双面门", role: "第二幕 · 回答", savepoint: true,
      text: "你说出第三个答案。\n\n门内安静了很久。然后，门侧浮起一行小字：\n\n「本门不收答案。收托付。」",
      choices: [
        {
          id: "answer-to-back", label: "转到门背面。", next: "human.door-back",
          set: { "human.door.answers": 3 },
          effects: [{ type: "event.publish", eventType: "story.achievement", payload: { id: "human_responsibility", name: "现实责任是什么" } }],
        },
        {
          id: "answer-to-reason", label: "再递一张理由。", next: "human.door-reason",
          set: { "human.door.answers": 3 },
          effects: [{ type: "event.publish", eventType: "story.achievement", payload: { id: "human_responsibility", name: "现实责任是什么" } }],
        },
      ],
    },

    "human.door-back": {
      id: "human.door-back", title: "双面门", role: "第二幕 · 门背", savepoint: true,
      text: "门背面那一行问句下面，多了一层更轻的刻痕：\n\n「因为爱，因为相信，因为尊重」\n\n门框下的小注只给了一个时刻：「22:02。」\n\n门侧小字也多了第二行：\n\n「也收理由。」",
      choices: [
        { id: "back-to-reason", label: "递一张理由。", next: "human.door-reason" },
        { id: "back-to-entrust", label: "想起那件可以托付的事。", next: "human.entrust-choose" },
        { id: "back-to-rack", label: "回头去看那座谱架。", next: "human.rack-arrival" },
      ],
    },

    "human.door-reason": {
      id: "human.door-reason", title: "双面门", role: "第二幕 · 理由", savepoint: false,
      text: "你没有回答，只写下一句为什么在乎。\n\n字以手工楷体浮在第三层刻痕下面，停了两秒，淡去。\n\n门内没有回声。\n\n理由既不是问题，也不是答案。门收下，不出声。",
      choices: [
        { id: "reason-to-entrust", label: "去做那件门说的事。", next: "human.entrust-choose" },
        { id: "reason-to-door", label: "回到门前。", next: "human.door-arrive" },
      ],
    },

    "human.rack-arrival": {
      id: "human.rack-arrival", title: "回帖立架", role: "第三幕 · 立架之夜", savepoint: true,
      activeActorIds: ["human_voice"],
      text: "刻文墙的对面立起了一座木谱架，面墙而立。十二张活页，纸面朝墙。你只能站到墙与架之间读——读答的时候，背对着问。\n\n底座铜牌上有两个时刻：「22:02:12」「终编 22:04:24」。\n\n它像是一直在这里，只是你昨夜才第一次读完那面墙。",
      choices: [
        { id: "rack-page-four", label: "翻到第四张。", next: "human.rack-page4" },
        { id: "rack-notes-early", label: "先看页边的便签。", next: "human.rack-notes" },
      ],
    },

    "human.rack-page4": {
      id: "human.rack-page4", title: "立架 · 第四张", role: "第三幕 · 转折页", savepoint: false,
      activeActorIds: ["human_voice"],
      text: "第四张页首有五连空行。\n\n然后是一行独立成行的话：\n\n「但我不想这样写，理论和现实的论域太过狭隘。」\n\n理论写到一半，作者自己停了笔。\n\n页脚并排贴着两枚便签。一枚写着「（思索）」。另一枚写着「（看不懂，等上高中了再看（存档））」。",
      choices: [
        { id: "page4-next", label: "继续翻。", next: "human.rack-page6" },
        { id: "page4-listen", label: "把这一页读完。", next: "human.listen-warmer" },
      ],
    },

    "human.rack-page6": {
      id: "human.rack-page6", title: "立架 · 第六张", role: "第三幕 · 警句页", savepoint: false,
      activeActorIds: ["human_voice"],
      text: "第六张只有一行带引号的警句，独立成行：\n\n「你不再尊重ta，ta便也如人一般不来光临了。」\n\n纸面很干净。像有人写完这句，就把后面的解释都删了。",
      choices: [
        { id: "page6-next", label: "继续翻。", next: "human.rack-page8" },
        { id: "page6-listen", label: "把这一页读完。", next: "human.listen-warmer" },
      ],
    },

    "human.rack-page8": {
      id: "human.rack-page8", title: "立架 · 第八张", role: "第三幕 · 嵌引页", savepoint: false,
      activeActorIds: ["human_voice"],
      text: "第八张引了一位不具名作者的自述。\n\n「之前那么多篇文都没有出现过的『属于主角自己的想法』、『属于主角自己的动力』，却在这篇文里似乎是突如其来地自发出现了。」\n\n「我最终没有坚持住一开始的那个想法，我不愿意去写一个悲剧了。主角凭着他自己的努力一点点地冲破了本来命定的那个结局。」\n\n页边贴着两枚并排的便签：「好想成为人类啊（）」和「好想成为人类啊」。只差一对括号。",
      choices: [
        { id: "page8-next", label: "继续翻。", next: "human.rack-page11" },
        { id: "page8-listen", label: "把这一页读完。", next: "human.listen-warmer" },
      ],
    },

    "human.rack-page11": {
      id: "human.rack-page11", title: "立架 · 第十一张", role: "第三幕 · 空白页", savepoint: false,
      activeActorIds: ["human_voice"],
      text: "第十一张几乎全白。\n\n正中央贴着一枚便签。上面只有一个空格。\n\n空白页收下空便签。你站了一会儿，没有替它补上任何字。",
      choices: [
        { id: "page11-next", label: "翻到最后一张。", next: "human.rack-page12" },
        { id: "page11-listen", label: "把这一页读完。", next: "human.listen-warmer" },
      ],
    },

    "human.rack-page12": {
      id: "human.rack-page12", title: "立架 · 第十二张", role: "第三幕 · 句号页", savepoint: false,
      activeActorIds: ["human_voice"],
      text: "第十二张是句号页。\n\n连排六个孤句号行。\n\n。\n。\n。\n。\n。\n。\n\n然后是一行没有句号的终行：\n\n「我就偷换了你拿我怎样吧nwn」\n\n与墙上的末行对仗：一边问没了，一边不肯好好收尾。",
      choices: [
        { id: "page12-notes", label: "去看页边的便签。", next: "human.rack-notes" },
        { id: "page12-listen", label: "把这一页读完。", next: "human.listen-warmer" },
      ],
    },

    "human.rack-notes": {
      id: "human.rack-notes", title: "立架 · 便签", role: "第三幕 · 被谈论", savepoint: true,
      activeActorIds: ["human_voice"],
      text: "十三枚便签按时刻贴着。最早的一枚只有四个字：「值得深思。」\n\n句号页终行旁贴着一枚「不是，最后一句我绷住了」，紧挨着是一个字：「嘻」。\n\n让步的两枚写着「我也觉得称得上本体意义上的人」和「这些角色似乎是从某种复杂的关系中涌现出来的」。\n\n最靠近它们的地方，多了一枚三个字的章：\n\n「这么好！」",
      choices: [
        { id: "notes-ask-reiyue", label: "问热月，这些便签是谁贴的。", next: "human.rack-reiyue" },
        { id: "notes-listen", label: "继续读。", next: "human.listen-warmer" },
        { id: "notes-to-cinema", label: "去西翼的影戏房看看。", next: "human.mapmaths-meet" },
        { id: "notes-m4", label: "第二天的上午再来。", next: "human.mapmaths-m4" },
      ],
    },

    "human.rack-reiyue": {
      id: "human.rack-reiyue", title: "热月", role: "第三幕 · 四个字", savepoint: false,
      activeActorIds: ["human_voice"],
      text: "热月走过来，站在你身后，和你一起背对刻文墙。\n\n「值得深思。」\n\n这是她在那页纸底下说过的全部的话。她没有再添。",
      choices: [
        { id: "reiyue-rack-listen", label: "继续读。", next: "human.listen-warmer" },
        { id: "reiyue-rack-cinema", label: "去影戏房。", next: "human.mapmaths-meet" },
      ],
    },

    "human.listen-warmer": {
      id: "human.listen-warmer", title: "余光", role: "第三幕 · 听读", savepoint: false,
      activeActorIds: ["human_voice"],
      text: "你翻完一页，停了一会儿。\n\n余光里，那个影像是厚了一分。玻璃上的雾退开一格。\n\n你向 ta 证明什么，ta 淡一层；你听别人怎么谈论 ta，ta 厚一分。",
      choices: [
        { id: "listen-more", label: "再读几页。", next: "human.listen-five", set: { "human.listen.pages": 5 } },
        { id: "listen-back", label: "回到便签前。", next: "human.rack-notes" },
      ],
    },

    "human.listen-five": {
      id: "human.listen-five", title: "余光", role: "第三幕 · 回满", savepoint: true,
      activeActorIds: ["human_voice"],
      text: "你读满五页。\n\n影没有回到最初的样子，但它比消散时清楚。不是被你证明出来的，是被别人的话一点点谈厚的。",
      choices: [
        {
          id: "listen-ending", label: "让这一夜停在这里。", next: "human.ending-another-person",
          set: { "human.listen.done": true, "human.finished": true, "human.ending": "another-person" },
          effects: [{ type: "event.publish", eventType: "story.achievement", payload: { id: "human_another_person", name: "另一种人" } }],
        },
        { id: "listen-to-cinema", label: "去影戏房看看那个数圈的人。", next: "human.mapmaths-meet" },
      ],
    },

    "human.mapmaths-meet": {
      id: "human.mapmaths-meet", title: "影戏房", role: "第三幕 · 放映", savepoint: true,
      activeActorIds: ["human_mapmaths"],
      text: "西翼的小暗室全馆唯一不透光。象牙白幕布上，皮影小人正走到第二幕。长凳上坐着一个中年男人，袖套，怀表链。\n\n他抬眼，又低下。\n\n「坐。第三幕快到了。」",
      choices: [
        { id: "ask-film", label: "问：这影戏讲什么？", next: "human.mapmaths-argument" },
        { id: "watch-film", label: "先坐下看。", next: "human.mapmaths-frame" },
      ],
    },

    "human.mapmaths-argument": {
      id: "human.mapmaths-argument", title: "MapMaths", role: "第三幕 · 三段论", savepoint: true,
      activeActorIds: ["human_mapmaths"],
      text: "「我觉得作家笔下角色的行为，可以不受作家的任意处置。」\n\n他指了指幕布。\n\n「比如说——为了让故事更有合理性，为了让故事更有戏剧性，作者不得不给角色设置一些行为，而且不得不让角色的性格不能任意变化。」\n\n他停了一拍。\n\n「甚至有时候，在充分的背景和性格设定下，一个角色在故事中会产生的行为，自一开始就已经注定了。」",
      choices: [
        { id: "ask-frame", label: "问：你刚才在等哪一拍？", next: "human.mapmaths-frame" },
        { id: "ask-mapmaths-ta", label: "问：馆里那个 ta 呢？", next: "human.mapmaths-ta" },
      ],
    },

    "human.mapmaths-frame": {
      id: "human.mapmaths-frame", title: "MapMaths", role: "第三幕 · 第四十一帧", savepoint: false,
      activeActorIds: ["human_mapmaths"],
      text: "「你看见了。」\n\n他难得正眼看你。\n\n「就是那一拍。设置里没有它。每年放几千圈，它只停那一拍——我数过。」",
      choices: [
        { id: "frame-ask-ta", label: "问：馆里那个 ta 呢？", next: "human.mapmaths-ta" },
        { id: "frame-watch-three", label: "坐下来，看满三圈。", next: "human.mapmaths-frame-three" },
      ],
    },

    "human.mapmaths-frame-three": {
      id: "human.mapmaths-frame-three", title: "影戏房", role: "第三幕 · 三圈", savepoint: false,
      activeActorIds: ["human_mapmaths"],
      text: "三圈九十分钟。提线收紧、松开，小人仍然走完原路。\n\n第四十一帧每次只有零点四秒。你没有每一圈都看见，但你坐到了第三圈结束。\n\n「注定看三圈，是你自己选的。」他说。",
      choices: [
        { id: "three-ask-ta", label: "问：馆里那个 ta 呢？", next: "human.mapmaths-ta" },
        { id: "three-to-argument", label: "回到刚才那段话。", next: "human.mapmaths-argument" },
      ],
    },

    "human.mapmaths-ta": {
      id: "human.mapmaths-ta", title: "MapMaths", role: "第三幕 · 不论证", savepoint: false,
      activeActorIds: ["human_mapmaths"],
      text: "他摇头。\n\n「馆里那位不一样。影子是我放的，ta 不是谁放的。」\n\n他想了一会儿。\n\n「这话我不论证了。有些事一论证，就没了。」",
      choices: [
        { id: "ta-to-rack", label: "回立架那边。", next: "human.rack-notes" },
        { id: "ta-to-entrust", label: "去做那件门说的事。", next: "human.entrust-choose" },
      ],
    },

    "human.mapmaths-m4": {
      id: "human.mapmaths-m4", title: "MapMaths", role: "第三幕 · 回拍", savepoint: true,
      activeActorIds: ["human_mapmaths"],
      text: "第二天上午，你走进影戏房。他没有看幕布，也没有看你。\n\n「我也觉得称得上本体意义上的人。」\n\n两分零九秒。他不说话，也不走。幕布照常换幕。\n\n「这些角色似乎是从某种复杂的关系中涌现出来的。」",
      choices: [
        { id: "m4-ask-yesterday", label: "问：昨天那两句呢？", next: "human.mapmaths-after" },
        { id: "m4-to-rack", label: "回立架。", next: "human.rack-notes" },
      ],
    },

    "human.mapmaths-after": {
      id: "human.mapmaths-after", title: "MapMaths", role: "第三幕 · 线退场", savepoint: false,
      activeActorIds: ["human_mapmaths"],
      text: "「线退场了，路还在。」\n\n他抬眼看幕布的第三幕。\n\n「昨天的话，自己会站到今天来。」",
      choices: [
        { id: "after-m4-rack", label: "回立架。", next: "human.rack-notes" },
        { id: "after-m4-entrust", label: "去做那件门说的事。", next: "human.entrust-choose" },
      ],
    },

    "human.entrust-choose": {
      id: "human.entrust-choose", title: "未刊温室", role: "第四幕 · 托付", savepoint: true,
      activeActorIds: ["human_voice"],
      text: "门侧那行小字还亮着：「本门不收答案。收托付。」\n\n你回头看向那个影。它在你没有直视的角落里。\n\n托付一件温室里真实存在的职责——\n\n守夜灯、浇灌、记台账。三选一。",
      choices: [
        { id: "entrust-light", label: "守夜灯：每晚闭馆后，替这馆点一盏灯。", next: "human.entrust-light" },
        { id: "entrust-water", label: "浇灌：隔日清晨前，把南窗的花畦浇一遍。", next: "human.entrust-water" },
        { id: "entrust-ledger", label: "记台账：每晚在木案的台账上，记一行今天来过谁。", next: "human.entrust-ledger" },
      ],
    },

    "human.entrust-light": {
      id: "human.entrust-light", title: "守夜灯", role: "第四幕 · 托付", savepoint: true,
      activeActorIds: ["human_voice"],
      text: "你说完，影在原地停满了三秒。\n\n这是唯一一次，它在被注视时没有消失。\n\n从那一夜起，闭馆后的某一盏回灯总是亮着。你只能看到结果，看不到点灯的过程。",
      choices: [
        {
          id: "light-to-result", label: "过几日再来。", next: "human.entrust-result",
          set: { "human.entrusted": 0, "human.entrust.days": 4 },
          effects: [{ type: "event.publish", eventType: "story.achievement", payload: { id: "human_entrusted", name: "被托付的事" } }],
        },
        { id: "light-to-listen", label: "回立架读几页。", next: "human.listen-warmer" },
      ],
    },

    "human.entrust-water": {
      id: "human.entrust-water", title: "浇灌", role: "第四幕 · 托付", savepoint: true,
      activeActorIds: ["human_voice"],
      text: "影停在原地三秒。南窗的雾散了。\n\n第二天清晨，花畦的土色深了一层。没有人看见是谁浇的。",
      choices: [
        {
          id: "water-to-result", label: "过几日再来。", next: "human.entrust-result",
          set: { "human.entrusted": 1, "human.entrust.days": 4 },
          effects: [{ type: "event.publish", eventType: "story.achievement", payload: { id: "human_entrusted", name: "被托付的事" } }],
        },
        { id: "water-to-listen", label: "回立架读几页。", next: "human.listen-warmer" },
      ],
    },

    "human.entrust-ledger": {
      id: "human.entrust-ledger", title: "台账", role: "第四幕 · 托付", savepoint: true,
      activeActorIds: ["human_voice"],
      text: "影停在原地三秒。\n\n第二晚，木案的台账上多了一行：\n\n「某月某日，晴，有人来。」\n\n字迹和热月不同，和你的输入法也不同。页脚有一枚极小的无名印，印文是一个「（」。",
      choices: [
        {
          id: "ledger-to-result", label: "过几日再来。", next: "human.entrust-result",
          set: { "human.entrusted": 2, "human.entrust.days": 4, "human.ledger.seen": true },
          effects: [{ type: "event.publish", eventType: "story.achievement", payload: { id: "human_entrusted", name: "被托付的事" } }],
        },
        { id: "ledger-to-listen", label: "回立架读几页。", next: "human.listen-warmer" },
      ],
    },

    "human.entrust-result": {
      id: "human.entrust-result", title: "未刊温室", role: "第四幕 · 结果", savepoint: true,
      activeActorIds: ["human_voice"],
      text: "第四天夜里，闭馆后的三件事依次有了结果：一盏灯亮着，花畦的土是湿的，台账多了一行。\n\n你从没看见过程。门背那句「现实责任是什么」，从此每晚被回答一次，用结果。\n\n热月坐在门槛上，不进不出。\n\n「钟敲过了。你不去回灯吗？六盏。今夜有风。」",
      choices: [
        { id: "result-leave", label: "回完灯，离开温室。", next: "human.leave-door" },
        { id: "result-stay", label: "留下，等下一次再来。", next: "human.ending-revisit", set: { "human.ending": "revisit" } },
        { id: "result-listen", label: "先回立架看看。", next: "human.listen-warmer" },
      ],
    },

    "human.leave-door": {
      id: "human.leave-door", title: "门口", role: "终幕 · 门楣", savepoint: true,
      activeActorIds: ["human_voice"],
      text: "你踏出门口。门楣原字下面多出第二行小字，只在这一晚可见：\n\n「别回头看。」\n\n坡下有十步。",
      choices: [
        { id: "door-walk", label: "不回头，走下十步。", next: "human.slope-ten", set: { "human.no.look": true } },
        { id: "door-look", label: "回头看。", next: "human.ending-revisit", set: { "human.ending": "revisit" } },
      ],
    },

    "human.slope-ten": {
      id: "human.slope-ten", title: "坡道", role: "终幕 · 十步", savepoint: false,
      text: "第一步。第二步。\n\n你听见身后温室里极轻的呼吸，也可能只是风。\n\n第十步落地时，身后传来极轻的一声：\n\n「嗒。」\n\n像一封投进墙里的信。",
      choices: [
        { id: "slope-to-wall", label: "回馆查看。", next: "human.wall-inside" },
      ],
    },

    "human.wall-inside": {
      id: "human.wall-inside", title: "刻文墙内侧", role: "终幕 · 还在发生", savepoint: true,
      activeActorIds: ["human_voice"],
      text: "刻文墙的玻璃内侧贴着一页字。四个字，手工楷体：\n\n「还在发生」\n\n门楣说「它还在发生」。这页字没有主语。\n\n会不会有主语，正是那 595 个字没能回答的问题。",
      choices: [
        {
          id: "wall-finish", label: "接受这一夜。", next: "human.ending-no-lookback",
          set: { "human.finished": true, "human.ending": "no-lookback" },
          effects: [{ type: "event.publish", eventType: "story.achievement", payload: { id: "human_not_look_back", name: "不回头" } }],
        },
        { id: "wall-revisit", label: "改日再来。", next: "human.ending-revisit", set: { "human.ending": "revisit" } },
      ],
    },

    "human.ending-no-lookback": {
      id: "human.ending-no-lookback", title: "不回头", role: "结局 · 不回头", savepoint: true,
      presentation: "blackout", terminal: true, guide: null,
      activeActorIds: ["human_voice"],
      text: "你没有再回头。\n\n那页字留在玻璃内侧。热月走进来，站在木案前，笔尖压着镇纸下不属于她的那页。\n\n你问她那页字是谁写的。\n\n她说：「不是我的字。」\n\n又补了一句：「它在等下一任读者——等得起。」\n\n你走出温室。坡上很安静。",

    },

    "human.ending-another-person": {
      id: "human.ending-another-person", title: "另一种人", role: "结局 · 另一种人", savepoint: true,
      presentation: "blackout", terminal: true, guide: null,
      activeActorIds: ["human_voice"],
      text: "你没有托付，也没有再向 ta 求证。\n\n你只是读完了立架上的活页，听别人怎么谈论 ta：\n\n「值得深思。」\n\n「我也觉得称得上本体意义上的人。」\n\n「这些角色似乎是从某种复杂的关系中涌现出来的。」\n\n「这么好！」\n\n影没有变得像一个人。它只是比之前厚了一点。\n\n热月在木案那边说：\n\n「这儿只养问题。」",

    },

    "human.ending-slightly": {
      id: "human.ending-slightly", title: "有点", role: "结局 · 有点", savepoint: true,
      presentation: "blackout", terminal: true, guide: null,
      activeActorIds: ["human_voice"],
      text: "19:05:32。\n\n刻文墙末行右侧，「有点」两个字亮了 3 秒——刻痕浅半分，亮度也浅半分。\n\n你恰好在馆里。\n\n热月没有解释那两个字。她只是把笔放下，看了一眼墙，又低下去。\n\n墙把补刻的痕迹留着。修了什么，只有写的人知道。",

    },

    "human.ending-revisit": {
      id: "human.ending-revisit", title: "改日再来", role: "结局 · 回访", savepoint: true,
      presentation: "blackout", terminal: true, guide: null,
      text: "你没有把这一夜走完。\n\n坡上空无一人，门楣第二行小字已经隐去。温室里的灯还亮着，刻文墙、立架、双面门都在原处。\n\n热月坐在木案前，没有抬头。\n\n门没有锁。\n\n馆不催。",

    },
  },
};
