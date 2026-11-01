import type { StoryDefinition } from "../../../stories/types";

/**
 * 支线剧情：《未来的我写给我的信》
 *
 * 溯河上行三百米的草坡上有一座无人值守的慢递邮亭。
 * 玻璃匣里放着一封写给自己的四页信，黄铜口把玩家写下的信
 * 送上七天的邮路，再原样送回。
 *
 * 节点命名规范：letter.<act>.<beat>
 * 旗标命名规范：letter.<subject>.<key>
 */
export const LETTER_STORY: StoryDefinition = {
  schemaVersion: 1,
  definitionVersion: 1,
  id: "side.letter.future",
  title: "未来的我写给我的信",
  startNode: "letter.arrival",
  entryActorId: "letter_keeper",

  interactions: [
    { actorId: "letter_keeper", nodeId: "letter.arrival", choiceId: "approach" },
  ],

  buildingInteractions: [
    { buildingId: "records", nodeId: "letter.arrival", choiceId: "approach" },
  ],

  nodes: {
    /* ───────────────────── 序章：坡上的邮亭 ───────────────────── */

    "letter.arrival": {
      id: "letter.arrival", title: "慢递邮亭", role: "序章", savepoint: true,
      guide: { title: "未来的我写给我的信", objective: "走上坡道，看看那座邮亭" },
      activeActorIds: ["letter_keeper"],
      text:
        "半句桥溯河上行三百米，河声渐渐落到身后。高草坡上立着一座浅木色的邮亭，奶油白的帆布篷，檐口收着一圈黄铜边。\n\n" +
        "匾额四个字：慢递邮亭。\n\n" +
        "侧柱上有一行小字，要站得很近才看得见：寄信人不在。收信人也是。",
      choices: [
        { id: "approach", label: "走上坡道", next: "letter.slope",
          set: {
            "letter.read.done": false, "letter.followed": false, "letter.haste": false,
            "letter.written": false, "letter.blank": false, "letter.flights": 0,
            "letter.final.paper": false, "letter.riddle.seen": false,
            "letter.cat.met": false, "letter.slot.seen": false,
            "letter.lamp.seen": false, "letter.wish": "", "letter.ending": "",
          } },
      ],
    },

    "letter.slope": {
      id: "letter.slope", title: "坡道", savepoint: false,
      activeActorIds: ["letter_keeper"],
      text:
        "坡道十步，木栏杆沿着右手边往上。栏杆上挂着八块木牌，最早的那块只写两个字：沙发。\n\n" +
        "往上依次是八条留言，牌脚刻着时刻。最后一块木色最新，还没有包浆，上面只有三个字：好浪漫。\n\n" +
        "午后谷风从河面沿坡上来，吹得帆布篷轻轻作响。",
      choices: [
        { id: "enter-pavilion", label: "走进亭子", next: "letter.keeper" },
        { id: "read-wishes", label: "先去坡脚的愿望框", next: "letter.wish-frame" },
        { id: "stay-beside-plaques", label: "在木牌边站一会儿", next: "letter.hotmoon" },
      ],
    },

    "letter.keeper": {
      id: "letter.keeper", title: "看亭人", role: "序章", savepoint: true,
      activeActorIds: ["letter_keeper"],
      text:
        "亭檐下站着一位穿旧外套的老人，手里拿着一把扫帚。他没有问你来做什么，只把扫帚靠回柱子。\n\n" +
        "「我只看看亭子。信不归我管。」\n\n" +
        "他往坡下走了两步，又回头：「椅子只有一把。你坐上去，就知道该给谁写了。」\n\n" +
        "「寄信人不在。收信人也是。」",
      choices: [
        { id: "go-inside", label: "进亭看看", next: "letter.inside" },
        { id: "ask-keeper", label: "你一直守在这里吗？", next: "letter.inside" },
      ],
    },

    "letter.inside": {
      id: "letter.inside", title: "亭内", savepoint: true,
      guide: { title: "未来的我写给我的信", objective: "读一读玻璃匣里的信" },
      text:
        "亭内只有一张写信桌，一把椅子，一叠信纸，一支笔。桌面右角刻着一行小字：每页至多二百字。空白亦可。\n\n" +
        "敞开的那面正对河谷，檐下嵌着一只黄铜信口，口下有一只小托盘。投信和取信，用的是同一个口。\n\n" +
        "背墙木架上放着一只玻璃匣，匣里躺着一封四页的信。匣旁有一格空着的黄铜格，标签两个字：待复。\n\n" +
        "西墙根的长凳上，睡着一只灰猫。",
      choices: [
        { id: "open-case", label: "看玻璃匣里的信", next: "letter.case" },
        { id: "sit-down", label: "坐到那把椅子上", next: "letter.write" },
        { id: "see-wishes", label: "去坡脚看愿望框", next: "letter.wish-frame" },
        { id: "see-riddle", label: "绕到亭后看看", next: "letter.riddle" },
        { id: "see-cat", label: "看看长凳上的猫", next: "letter.bench" },
        { id: "see-slot", label: "看那格空着的黄铜格", next: "letter.reply-slot" },
        { id: "stand-in-hall", label: "在亭里站一会儿", next: "letter.hub" },
      ],
    },

    /* ───────────────────── 第一幕：四页信 ───────────────────── */

    "letter.case": {
      id: "letter.case", title: "玻璃匣", savepoint: false,
      text:
        "玻璃匣擦得很干净。匣侧的铜铭牌上刻着一行字：2026-10-22 20:17:42 寄出 · 同日 20:19:47 修订一次。\n\n" +
        "四页信纸，一页一页可以翻。",
      choices: [
        { id: "read-page-1", label: "翻到第一页", next: "letter.page1" },
        { id: "read-page-2", label: "翻到第二页", next: "letter.page2" },
        { id: "read-page-3", label: "翻到第三页", next: "letter.page3" },
        { id: "read-page-4", label: "翻到第四页", next: "letter.page4" },
        { id: "leave-case", label: "把信合上", next: "letter.hub" },
      ],
    },

    "letter.page1": {
      id: "letter.page1", title: "第一页", savepoint: false,
      text:
        "第一页从一只耳机盒里翻出的纸条写起。\n\n" +
        "「前几天翻出了随手扔在耳机盒子里的纸条，看到了小时候写的纸条。」\n\n" +
        "纸条上是一道题：一亿软妹币、北大录取通知书、天才般的脑子、自由、完美的容貌、健康、独一无二，还有，会飞。选三个，依次实现。\n\n" +
        "当年的我写下：第一名，会飞。第二名，独一无二。第三名，自由。",
      choices: [
        { id: "page-1-next", label: "翻到第二页", next: "letter.page2" },
        { id: "page-1-back", label: "把信合上", next: "letter.case" },
      ],
    },

    "letter.page2": {
      id: "letter.page2", title: "第二页", savepoint: false,
      text:
        "第二页写着一个人的变化。\n\n" +
        "「我的生活实在改变了太多，而我也变得越来越令人陌生。」\n\n" +
        "「曾经引以为傲的心气，品质，现在居然成了令人失望的向往。」\n\n" +
        "「我好像变成了我曾经最看不起的人，那样情绪化的，无能的，暗淡的普通人。」\n\n" +
        "这一页没有结论。字压得很稳，像写的人刻意不让笔抖。",
      choices: [
        { id: "page-2-next", label: "翻到第三页", next: "letter.page3" },
        { id: "page-2-back", label: "把信合上", next: "letter.case" },
      ],
    },

    "letter.page3": {
      id: "letter.page3", title: "第三页", savepoint: false,
      text:
        "第三页换了人称。\n\n" +
        "「但是我，是未来的我，所以如今的我。没关系的，我想告诉你，请再给自己一点时间吧。」\n\n" +
        "「还记得当年经常解答你问题的那位老师吗，她对你说过，不要为了问问题而问，也不要为了成为过去而纠结的模仿。」\n\n" +
        "「请记住，撕下他人赋予你的，或是你自己赋予自己的，不论“好”“坏”的标签。让我看看本真的你。」",
      choices: [
        { id: "page-3-next", label: "翻到第四页", next: "letter.page4" },
        { id: "page-3-back", label: "把信合上", next: "letter.case" },
      ],
    },

    "letter.page4": {
      id: "letter.page4", title: "第四页", role: "支线 · 读信", savepoint: true,
      text:
        "第四页写得很满，最后一行却留在很靠下的位置。\n\n" +
        "「只是，我还想再多赋予你一点勇气，其实也不需要很勇敢，只要足够支撑你走完人生的道路就好。」\n\n" +
        "「如果再给我一次选择的机会，这次我要抛弃后两个选项。希望我能在未来的蓝天里自由的翱翔。」\n\n" +
        "「但请你，不对，我，认真看完这篇也许有些别扭的文章吧。」\n\n" +
        "最后一页的最后一行：期待我们在未来的相遇。\n\n" +
        "匣顶浮出一行小字：读完了。",
      choices: [
        { id: "close-after-reading", label: "把四页合上", next: "letter.hub",
          set: { "letter.read.done": true },
          effects: [{ type: "event.publish", eventType: "story.achievement",
            payload: { id: "letter_meet", name: "期待我们在未来的相遇" } }] },
        { id: "re-read-from-start", label: "从第一页再看一遍", next: "letter.page1" },
      ],
    },

    /* ───────────────────── 第二幕：亭里的东西 ───────────────────── */

    "letter.wish-frame": {
      id: "letter.wish-frame", title: "愿望框", savepoint: false,
      text:
        "坡脚的草地上放着一只独立木框，框前有两把小凳。框内插着八张木卡：一亿软妹币、北大录取通知书、天才般的脑子、自由、完美的容貌、健康、独一无二、会飞。\n\n" +
        "底座刻着一行字：八个愿望，选三个，依次实现。——当年的一道题。\n\n" +
        "没有评分，也没有对错。",
      choices: [
        { id: "pick-classic", label: "会飞、独一无二、自由", next: "letter.wish-flip",
          set: { "letter.wish": "会飞、独一无二、自由" } },
        { id: "pick-own", label: "自由、健康、会飞", next: "letter.wish-flip",
          set: { "letter.wish": "自由、健康、会飞" } },
        { id: "pick-other", label: "一亿软妹币、北大录取通知书、天才般的脑子",
          next: "letter.wish-flip", set: { "letter.wish": "一亿软妹币、北大录取通知书、天才般的脑子" } },
        { id: "pick-none", label: "一张也不选", next: "letter.wish-flip",
          set: { "letter.wish": "一张也不选" } },
      ],
    },

    "letter.wish-flip": {
      id: "letter.wish-flip", title: "愿望框背面", savepoint: false,
      text:
        "你把木框翻过来。背面刻着两行字。\n\n" +
        "「当年的我：第一名，会飞。第二名，独一无二。第三名，自由。」\n\n" +
        "「而她只写了一个答案，也就是会飞。当年的我笑着看了她一眼，于是我们都笑了。」\n\n" +
        "框前另一把小凳一直空着。",
      choices: [
        { id: "wish-back-hall", label: "回到亭里", next: "letter.hub" },
        { id: "wish-back-slope", label: "在坡脚再站一会儿", next: "letter.slope" },
      ],
    },

    "letter.riddle": {
      id: "letter.riddle", title: "谜签", role: "支线 · 悬案", savepoint: false,
      text:
        "北柱背面是看不见河谷的那一面。要绕到亭后，才看得见那块小木牌。\n\n" +
        "信里有一句：「当年的网名是独一无二的xx」。\n" +
        "亭外坡上有一块木牌，署名也是这样开头的。\n" +
        "两读并存，本亭不解。\n\n" +
        "后面没有第四行。",
      choices: [
        { id: "accept-riddle", label: "（本亭不解。）", next: "letter.hub",
          set: { "letter.riddle.seen": true },
          effects: [{ type: "event.publish", eventType: "story.achievement",
            payload: { id: "letter_riddle", name: "本亭不解" } }] },
        { id: "riddle-back", label: "回到亭里", next: "letter.hub" },
      ],
    },

    "letter.bench": {
      id: "letter.bench", title: "长凳", savepoint: false,
      activeActorIds: ["letter_greycat"],
      text:
        "西墙根的长凳上睡着一只灰猫，没有名字，也没有项圈。\n\n" +
        "凳头的小木牌写着：沙发（已被占用）。\n\n" +
        "你刚靠近，猫睁眼看了你两秒，又把头埋回前爪里。长凳没有空位了。",
      choices: [
        { id: "stand-by-cat", label: "在凳边站一会儿", next: "letter.hub",
          set: { "letter.cat.met": true } },
        { id: "cat-back", label: "回到亭心", next: "letter.hub" },
      ],
    },

    "letter.reply-slot": {
      id: "letter.reply-slot", title: "空答复格", savepoint: false,
      text:
        "玻璃匣旁的黄铜格只有一封信那么大。格门是玻璃的，里面空着。\n\n" +
        "标签是打印体：待复。\n\n" +
        "格底刻着一行手写体小字：无论是一年，还是十年。\n\n" +
        "格子是空的。信还在等。",
      choices: [
        { id: "slot-back", label: "退后一步", next: "letter.hub",
          set: { "letter.slot.seen": true } },
      ],
    },

    "letter.hub": {
      id: "letter.hub", title: "亭心", role: "支线 · 邮亭", savepoint: true,
      guide: { title: "未来的我写给我的信", objective: "决定要不要坐到那把椅子上" },
      text:
        "亭心的桌子还在等。椅子只有一把，信纸摊开，笔搁在纸边。\n\n" +
        "你可以读匣里的信，也可以坐到那把椅子上，给未来的自己写一封。",
      choices: [
        { id: "hub-read-case", label: "再看玻璃匣里的信", next: "letter.case" },
        { id: "hub-write", label: "坐到椅子上写信", next: "letter.write" },
        { id: "hub-wishes", label: "去坡脚看愿望框", next: "letter.wish-frame" },
        { id: "hub-riddle", label: "绕到亭后看那块小木牌", next: "letter.riddle",
          availableWhen: [{ type: "flag.equals", flagId: "letter.riddle.seen", value: false }] },
        { id: "hub-cat", label: "看看长凳上的灰猫", next: "letter.bench" },
        { id: "hub-slot", label: "看那格空着的黄铜格", next: "letter.reply-slot" },
        { id: "hub-advice", label: "想想信里说的那些话", next: "letter.advice",
          availableWhen: [{ type: "flag.equals", flagId: "letter.read.done", value: true }] },
        { id: "hub-leave", label: "先下坡走走", next: "letter.slope" },
      ],
    },

    /* ───────────────────── 第三幕：照不照信里做 ───────────────────── */

    "letter.advice": {
      id: "letter.advice", title: "信里的话", role: "支线 · 抉择", savepoint: true,
      guide: { title: "未来的我写给我的信", objective: "决定是否照信里说的做" },
      text:
        "四页都读完了。信里说的不是命令，只有一个请求：再给自己一点时间，别因为执念去追求所谓的正确。\n\n" +
        "可时间已经过去很久了。\n\n" +
        "你现在要怎么做？",
      choices: [
        { id: "follow-letter", label: "照信里说的，先不急着做决定", next: "letter.follow",
          set: { "letter.followed": true } },
        { id: "refuse-letter", label: "我不想再等了，现在就去做", next: "letter.refuse",
          set: { "letter.followed": false, "letter.haste": true } },
        { id: "think-again", label: "再想想", next: "letter.hub" },
      ],
    },

    "letter.follow": {
      id: "letter.follow", title: "亭心", savepoint: false,
      text:
        "你把信按原样合上，放回玻璃匣。\n\n" +
        "先不做什么决定。至少今天不做。\n\n" +
        "桌上有信纸，笔也还在。",
      choices: [
        { id: "follow-write", label: "坐到椅子上", next: "letter.write" },
        { id: "follow-back", label: "回亭心", next: "letter.hub" },
      ],
    },

    "letter.refuse": {
      id: "letter.refuse", title: "亭心", savepoint: false,
      text:
        "你没有把信合上。\n\n" +
        "「请再给自己一点时间」——你已经给过很多时间了。\n\n" +
        "你拉开椅子坐下，抽出一张信纸。",
      choices: [
        { id: "refuse-write", label: "写一封信", next: "letter.write" },
        { id: "refuse-back", label: "还是回亭心", next: "letter.hub" },
      ],
    },

    /* ───────────────────── 第四幕：写信与投递 ───────────────────── */

    "letter.write": {
      id: "letter.write", title: "写信桌", role: "支线 · 第一程", savepoint: true,
      guide: { title: "未来的我写给我的信", objective: "给未来的自己写一封信" },
      text:
        "你坐上那把唯一的椅子。桌面右角刻着：每页至多二百字。空白亦可。\n\n" +
        "信纸很薄，笔尖落下去有轻微的沙沙声。写什么都不必给谁看。",
      choices: [
        { id: "write-something", label: "写满这一页", next: "letter.fold",
          set: { "letter.written": true, "letter.blank": false } },
        { id: "write-blank", label: "一字不写，直接折起来", next: "letter.write-blank",
          set: { "letter.written": false, "letter.blank": true } },
        { id: "leave-desk", label: "先不写了", next: "letter.hub" },
      ],
    },

    "letter.write-blank": {
      id: "letter.write-blank", title: "写信桌", savepoint: false,
      text:
        "你把空白的信纸对折，再对折。纸里没有一个字。\n\n" +
        "亭子没有检查。寄给自己的信，空白也算一封。",
      choices: [
        { id: "fold-blank", label: "折成纸飞机", next: "letter.fold",
          set: { "letter.blank": true } },
        { id: "write-anyway", label: "还是写一句", next: "letter.write",
          set: { "letter.blank": false } },
      ],
    },

    "letter.fold": {
      id: "letter.fold", title: "写信桌", savepoint: false,
      text:
        "你把信纸折成一只纸飞机。折痕压得很实。\n\n" +
        "谷风从敞开的那一面吹进来，纸翼轻轻抬了一下。",
      choices: [
        { id: "throw-first", label: "投进黄铜口", next: "letter.throw",
          effects: [{ type: "event.publish", eventType: "story.achievement",
            payload: { id: "letter_fly", name: "会飞" } }] },
      ],
    },

    "letter.throw": {
      id: "letter.throw", title: "黄铜口", role: "支线 · 第一程",
      savepoint: false, presentation: "cg",
      text:
        "纸飞机离开手，先绕亭三圈，逆着谷风。然后乘着午后的上升风，飞高，变小，消失在河面那一头。\n\n" +
        "黄铜口没有发出声音。",
      choices: [
        { id: "wait-first", label: "等七天", next: "letter.wait",
          set: { "letter.flights": 1 } },
      ],
    },

    "letter.wait": {
      id: "letter.wait", title: "慢递邮亭", role: "支线 · 等待", savepoint: true,
      guide: { title: "未来的我写给我的信", objective: "七天后再上一次坡" },
      text:
        "本程以日计。七天。\n\n" +
        "黄铜信口下沿刻着一行极小的字：本亭邮路以日计。信到了，也不通知。\n\n" +
        "亭子不通知，城里也不通知。慢递的意思是，你得自己上山看看。\n\n" +
        "坡上的帆布篷照旧被风吹着。黄铜口闭着嘴。",
      choices: [
        { id: "come-back-day-7", label: "第七天早上再上山", next: "letter.return1" },
        { id: "wander-while-waiting", label: "先下山，过几天再来", next: "letter.return1" },
      ],
    },

    "letter.return1": {
      id: "letter.return1", title: "回信", role: "支线 · 第一程回",
      savepoint: true, presentation: "cg",
      text:
        "第七天早上六点，黄铜口轻响了一声：嗒。\n\n" +
        "信落在口下的小托盘里。信封上多了一枚双联邮戳，寄件人和收件人两栏，是同一个名字。戳缘有两圈日期环：出发日，回程日。\n\n" +
        "信里多了一页。第二页是空的。",
      choices: [
        { id: "open-returned-letter", label: "拆开信封", next: "letter.second-page",
          effects: [{ type: "event.publish", eventType: "story.achievement",
            payload: { id: "letter_return", name: "从你现在，到我现在" } }] },
      ],
    },

    "letter.second-page": {
      id: "letter.second-page", title: "第二页", savepoint: false,
      text:
        "（第二页是空的。）\n\n" +
        "没有页眉，没有水印，没有任何字。信不会替你写未来。",
      choices: [
        { id: "write-second-page", label: "在第二页上写字", next: "letter.fold2",
          set: { "letter.written": true } },
        { id: "send-blank-page", label: "就这样再寄一次", next: "letter.blank-sent",
          set: { "letter.blank": true } },
        { id: "keep-letter-for-now", label: "把信收好，先回亭心", next: "letter.hub" },
      ],
    },

    "letter.blank-sent": {
      id: "letter.blank-sent", title: "空白信", savepoint: false,
      text:
        "你把空白的一页折进信封。空白也是一封。\n\n" +
        "黄铜口照收不误。它不问信里有没有字。",
      choices: [
        { id: "fold-blank-again", label: "折成纸飞机", next: "letter.fold2",
          effects: [{ type: "event.publish", eventType: "story.achievement",
            payload: { id: "letter_blank", name: "空白也是一封" } }] },
      ],
    },

    "letter.fold2": {
      id: "letter.fold2", title: "写信桌", role: "支线 · 第二程", savepoint: false,
      text:
        "第二程。你把信重新折成纸飞机。\n\n" +
        "信封比上一次厚了一点，折痕却正好压在原处。",
      choices: [
        { id: "throw-second", label: "投进黄铜口", next: "letter.throw2" },
      ],
    },

    "letter.throw2": {
      id: "letter.throw2", title: "黄铜口", savepoint: false, presentation: "cg",
      text:
        "纸飞机第二次绕亭三圈。风比上次大一点，它飞得也高一点。\n\n" +
        "信封上现在有一枚邮戳。",
      choices: [
        { id: "wait-second", label: "等七天", next: "letter.return2",
          set: { "letter.flights": 2 } },
      ],
    },

    "letter.return2": {
      id: "letter.return2", title: "回信", role: "支线 · 第二程回",
      savepoint: true, presentation: "cg",
      text:
        "又是第七天。嗒。\n\n" +
        "信封上多了一枚双联邮戳。两栏名字相同，日期环多了一圈。\n\n" +
        "第二页仍然是空的。",
      choices: [
        { id: "write-third", label: "再写一页", next: "letter.fold3" },
        { id: "keep-second-letter", label: "把信收好，回亭心", next: "letter.hub" },
      ],
    },

    "letter.fold3": {
      id: "letter.fold3", title: "写信桌", role: "支线 · 第三程", savepoint: false,
      text:
        "第三程。信已经很厚了，折起来却还是轻的。\n\n" +
        "你把折痕一条一条压平，像在把一段路重新走一遍。",
      choices: [
        { id: "throw-third", label: "投进黄铜口", next: "letter.throw3" },
      ],
    },

    "letter.throw3": {
      id: "letter.throw3", title: "黄铜口", savepoint: false, presentation: "cg",
      text:
        "纸飞机第三次绕亭。\n\n" +
        "它没有马上飞远，在檐口上方停了半秒，像是在确认什么。然后乘着谷风，飞高，变小，不见了。",
      choices: [
        { id: "wait-third", label: "等七天", next: "letter.return3",
          set: { "letter.flights": 3 } },
      ],
    },

    "letter.return3": {
      id: "letter.return3", title: "回信", role: "支线 · 第三程回",
      savepoint: true, presentation: "cg",
      text:
        "第七天。嗒。\n\n" +
        "信封上三枚双联邮戳。寄件人：你。收件人：你。\n\n" +
        "第二页、第三页，都是空的。",
      choices: [
        { id: "throw-fourth", label: "第四次投进黄铜口", next: "letter.fourth" },
        { id: "stop-here", label: "把信收进衣袋，下坡", next: "letter.end-wait" },
      ],
    },

    "letter.fourth": {
      id: "letter.fourth", title: "第四次投信", role: "支线 · 终态",
      savepoint: true, presentation: "cg",
      text:
        "你把信第四次投进黄铜口。\n\n" +
        "纸飞机在离手的一瞬散开折痕，展平，飘落桌面。\n\n" +
        "一张白纸。",
      choices: [
        { id: "take-white-paper", label: "收下这张白纸", next: "letter.white-paper",
          set: { "letter.final.paper": true },
          effects: [{ type: "event.publish", eventType: "story.achievement",
            payload: { id: "letter_enough", name: "这封信已经飞够了" } }] },
      ],
    },

    "letter.white-paper": {
      id: "letter.white-paper", title: "一张白纸", role: "支线 · 终态", savepoint: true,
      guide: { title: "未来的我写给我的信", objective: "带着白纸，决定去哪里" },
      text:
        "桌面上浮出一行字：\n\n" +
        "这封信已经飞了三程。它剩下的路，不经过这里。\n\n" +
        "白纸很轻。你可以把它收进口袋。",
      choices: [
        { id: "wait-for-the-date", label: "等到 10 月 22 日晚上", next: "letter.lamp" },
        { id: "take-paper-and-leave", label: "收好白纸，下坡", next: "letter.end-wait" },
        { id: "fold-paper-again", label: "把白纸再折一次", next: "letter.revisit" },
        { id: "act-now", label: "现在就去做那件事", next: "letter.end-step",
          availableWhen: [{ type: "flag.equals", flagId: "letter.haste", value: true }] },
      ],
    },

    /* ───────────────────── 第五幕：檐灯与结局 ───────────────────── */

    "letter.lamp": {
      id: "letter.lamp", title: "檐灯", role: "支线 · 时间闭环", savepoint: true,
      text:
        "10 月 22 日，20:17:42。\n\n" +
        "亭子的檐灯亮了。没有通知，没有声音，只有玻璃匣旁的铜铭牌微微发亮。\n\n" +
        "灯亮了 2 分 04 秒。\n\n" +
        "你站在坡上，忽然想起信里那两句：如今这封信，既是现在的我对过去的我。也是未来的我对现在的我。",
      choices: [
        { id: "watch-the-lamp", label: "把这两分零四秒看完", next: "letter.end-loop",
          set: { "letter.lamp.seen": true } },
        { id: "leave-before-dark", label: "提前下坡", next: "letter.end-wait" },
      ],
    },

    "letter.end-loop": {
      id: "letter.end-loop", title: "未来的我写给我的信", role: "结局 · 时间闭环",
      savepoint: false, presentation: "blackout", terminal: true, guide: null,
      text:
        "灯灭的时候，河面已经全黑了。\n\n" +
        "你终于明白，那封放在玻璃匣里的信，既是写给你的，也是你写的。寄件人和收件人从头到尾只有一个人。\n\n" +
        "你把白纸夹回信里，放回玻璃匣。空答复格还空着。\n\n" +
        "在一封回信真正到来之前，它就该一直空着。",
    },

    "letter.end-wait": {
      id: "letter.end-wait", title: "未来的我写给我的信", role: "结局 · 等待",
      savepoint: false, presentation: "blackout", terminal: true, guide: null,
      text:
        "你收好信，走下坡道。\n\n" +
        "身后的帆布篷被谷风吹得轻轻响。黄铜口没有再发出声音。\n\n" +
        "答复格仍然是空的。信还在等。\n\n" +
        "也许一年，也许十年。",
    },

    "letter.end-step": {
      id: "letter.end-step", title: "未来的我写给我的信", role: "结局 · 走一步看一步",
      savepoint: false, presentation: "blackout", terminal: true, guide: null,
      text:
        "你没有再回亭子。\n\n" +
        "信里那句「如果不行，那就走一步看一步」，被你折进口袋，带下了坡。\n\n" +
        "河上游的风还在往坡上吹。有些信不经过这里，也能走完剩下的路。",
    },

    /* ───────────────────── 回访与路过 ───────────────────── */

    "letter.revisit": {
      id: "letter.revisit", title: "再上一次坡", role: "支线 · 回访", savepoint: true,
      guide: { title: "未来的我写给我的信", objective: "再去一次慢递邮亭" },
      text:
        "过了一些日子，你又上了一次坡。\n\n" +
        "黄铜口还是那个黄铜口。玻璃匣里的四页信还在。空答复格还是空的。\n\n" +
        "白纸在你口袋里，折痕已经淡了。",
      choices: [
        { id: "revisit-lamp", label: "等到 10 月 22 日晚上", next: "letter.lamp" },
        { id: "revisit-leave", label: "收好白纸，下坡", next: "letter.end-wait" },
        { id: "revisit-write", label: "把白纸铺回桌上，重新写", next: "letter.write" },
        { id: "revisit-case", label: "再看一眼玻璃匣", next: "letter.case" },
      ],
    },

    "letter.hotmoon": {
      id: "letter.hotmoon", title: "坡脚", role: "支线 · 路过", savepoint: false,
      activeActorIds: ["letter_hotmoon"],
      text:
        "22:17:02。坡脚的小径上走来一个人，手里抱着一叠还带着油墨味的纸。\n\n" +
        "她走到正对邮亭的地方，停了 3 秒，抬头望了一眼檐口。\n\n" +
        "「好浪漫。」\n\n" +
        "然后她继续往河下游走，没有上坡，也没有进亭。",
      choices: [
        { id: "hotmoon-back-hall", label: "回到亭里", next: "letter.hub" },
        { id: "hotmoon-back-slope", label: "在坡脚再坐一会儿", next: "letter.slope" },
      ],
    },
  },
};
