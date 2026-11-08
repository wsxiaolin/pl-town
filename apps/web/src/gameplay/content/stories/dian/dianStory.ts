import type { StoryDefinition } from "../../../stories/types";

/**
 * 支线剧情：《奠》
 *
 * 溯河中游的河湾高地上立着一块只有一个字的碑。
 * 碑座四行话记录的是一场没有下文的损失，碑阴只有一行时刻。
 * 玩家可以读碑、献花、留言、按红心、听夜里的水声，
 * 也可以在 03:00:02 听见水里的鲸开口。
 *
 * 节点命名规范：dian.<act>.<beat>
 * 旗标命名规范：dian.<subject>.<key>
 */
export const DIAN_STORY: StoryDefinition = {
  schemaVersion: 1,
  definitionVersion: 1,
  id: "side.dian.memorial",
  title: "奠",
  startNode: "dian.arrival",
  entryActorId: "dian_keeper",

  interactions: [
    { actorId: "dian_keeper", nodeId: "dian.arrival", choiceId: "approach" },
  ],

  buildingInteractions: [
    { buildingId: "dian_stele", nodeId: "dian.arrival", choiceId: "approach" },
  ],

  nodes: {
    /* ───────────────────── 序章：河湾高地 ───────────────────── */

    "dian.arrival": {
      id: "dian.arrival", title: "守碑人", role: "序章", savepoint: true,
      guide: { title: "奠", objective: "在河湾高地找到守碑人" },
      activeActorIds: ["dian_keeper"],
      text:
        "溯河中游的河湾高地上，风比城里慢。一块青石矮碑立在空地中央，高只及腰，正面只有一个字：奠。\n\n" +
        "碑旁站着一个穿旧外套的人，手里提一盏小马灯。他看见你，没有问来意，只把灯往碑那边挪了挪。\n\n" +
        "「来看碑的？」",
      choices: [
        {
          id: "approach", label: "来看看这块碑。", next: "dian.keeper-intro",
          set: {
            "dian.read.front": false, "dian.read.base": false, "dian.read.back": false,
            "dian.read.all": false, "dian.walker.met": false, "dian.sleeper.met": false,
            "dian.relics.read": false, "dian.night": false, "dian.whale.seen": false,
            "dian.whale.guided": false, "dian.hearts": 0,
          },
        },
      ],
    },

    "dian.keeper-intro": {
      id: "dian.keeper-intro", title: "守碑人", savepoint: true,
      guide: { title: "奠", objective: "听守碑人说完这里的规矩" },
      activeActorIds: ["dian_keeper"],
      text:
        "「不用脱帽，也不用鞠躬。」他把灯放在碑脚，「这儿埋的不是人。」\n\n" +
        "「四千多金币，一夜之间没了。有人给它立了这块碑，碑上一个字，碑座上四行话。」\n\n" +
        "他顿了顿。「后来夜里有人来，白天也有人来。你要看就看，要坐就坐。碑不怕吵，怕没人来。」",
      choices: [
        { id: "ask-one-word", label: "碑上为什么只有一个字？", next: "dian.hub" },
        { id: "ask-empty", label: "碑下真的什么都没有？", next: "dian.hub" },
      ],
    },

    "dian.hub": {
      id: "dian.hub", title: "河湾高地", role: "支线 · 白日", savepoint: true,
      guide: { title: "奠", objective: "在碑前做点什么，或等到夜里" },
      activeActorIds: ["dian_keeper"],
      text:
        "碑前的空地不大，刚好站下几个人。风从水面过来，带着一点铁锈味。\n\n" +
        "守碑人坐回碑侧，把马灯的火苗拨小。你可以在河湾高地上走一走。",
      choices: [
        { id: "read-stele", label: "读碑的正面", next: "dian.stele-front", set: { "dian.read.front": true } },
        { id: "offer-flowers", label: "在碑前献一枝花", next: "dian.flowers" },
        { id: "leave-message", label: "在留言簿上写一句", next: "dian.message" },
        { id: "visit-ledger", label: "看红心对账台", next: "dian.ledger" },
        {
          id: "ask-relics", label: "问守碑人碑下埋了什么", next: "dian.relics",
          availableWhen: [{ type: "flag.equals", flagId: "dian.relics.read", value: false }],
          set: { "dian.relics.read": true },
        },
        {
          id: "stand-a-while", label: "在碑前多站一会儿", next: "dian.walker",
          availableWhen: [{ type: "flag.equals", flagId: "dian.walker.met", value: false }],
          set: { "dian.walker.met": true },
        },
        {
          id: "walk-the-path", label: "沿小路走一圈", next: "dian.sleeper",
          availableWhen: [{ type: "flag.equals", flagId: "dian.sleeper.met", value: false }],
          set: { "dian.sleeper.met": true },
        },
        { id: "wait-for-night", label: "等到夜里", next: "dian.night-wait" },
        {
          id: "finish-reading", label: "把三处碑文对一遍", next: "dian.stele-complete",
          availableWhen: [
            { type: "flag.equals", flagId: "dian.read.front", value: true },
            { type: "flag.equals", flagId: "dian.read.base", value: true },
            { type: "flag.equals", flagId: "dian.read.back", value: true },
            { type: "flag.equals", flagId: "dian.read.all", value: false },
          ],
          set: { "dian.read.all": true },
          effects: [{ type: "event.publish", eventType: "story.achievement", payload: { id: "dian_stele", name: "奠" } }],
        },
        {
          id: "ask-whale-time", label: "对水里的鲸说：03:00:02", next: "dian.whale-guide",
          availableWhen: [{ type: "flag.equals", flagId: "dian.whale.seen", value: true }],
        },
        { id: "leave-hillside", label: "离开河湾高地", next: "dian.end-quiet" },
      ],
    },

    /* ───────────────────── 读碑：一个字与四行话 ───────────────────── */

    "dian.stele-front": {
      id: "dian.stele-front", title: "碑的正面", savepoint: false,
      activeActorIds: ["dian_keeper"],
      text:
        "青石磨得很平。正面只有一个字，白漆描的，笔画很直。\n\n" +
        "奠。\n\n" +
        "没有名字，没有日期，没有生平。守碑人说，立碑的人写完这个字就走了。",
      choices: [
        { id: "read-base", label: "读碑座上的字", next: "dian.stele-base", set: { "dian.read.base": true } },
        { id: "read-back", label: "绕到碑后", next: "dian.stele-back", set: { "dian.read.back": true } },
        { id: "back-hub", label: "退后一步", next: "dian.hub" },
      ],
    },

    "dian.stele-base": {
      id: "dian.stele-base", title: "碑座", savepoint: false,
      activeActorIds: ["dian_keeper"],
      text:
        "碑座四面各刻一行字。字不深，像怕刻重了会疼。\n\n" +
        "「四千多金币被莫名其妙清零了」\n" +
        "「以为是随便显示错误点了个支持结果变成-100了」\n" +
        "「当时作品也发不出去，提示文件传输过程中遇到错误」\n" +
        "「倒了大霉了」\n\n" +
        "四行读完，没有第五行。",
      choices: [
        { id: "read-back-from-base", label: "绕到碑后", next: "dian.stele-back", set: { "dian.read.back": true } },
        { id: "read-front-from-base", label: "回到碑的正面", next: "dian.stele-front" },
        { id: "back-hub-from-base", label: "退后一步", next: "dian.hub" },
      ],
    },

    "dian.stele-back": {
      id: "dian.stele-back", title: "碑阴", savepoint: false,
      activeActorIds: ["dian_keeper"],
      text:
        "碑阴朝水。石面上只有一行浅浅的数字，没有注释。\n\n" +
        "03:00:02\n\n" +
        "守碑人说，这行字比碑文晚刻。刻的时候，河面很静。",
      choices: [
        { id: "see-lamp", label: "看碑旁的常明灯", next: "dian.lamp" },
        { id: "read-base-from-back", label: "再看碑座", next: "dian.stele-base", set: { "dian.read.base": true } },
        { id: "back-hub-from-back", label: "回到碑前", next: "dian.hub" },
      ],
    },

    "dian.stele-complete": {
      id: "dian.stele-complete", title: "碑前", role: "支线 · 读碑", savepoint: true,
      activeActorIds: ["dian_keeper"],
      text:
        "你把正面、碑座、碑阴各看了一遍。\n\n" +
        "一个字，四行话，一行数字。没有别的了。\n\n" +
        "守碑人没有过来打扰你。风把马灯的火苗压得很低。",
      choices: [
        { id: "back-to-hub", label: "回到碑前", next: "dian.hub" },
      ],
    },

    "dian.lamp": {
      id: "dian.lamp", title: "常明灯", savepoint: false,
      activeActorIds: ["dian_keeper"],
      text:
        "一盏小马灯挂在碑侧的木钩上，玻璃罩被擦得很干净。\n\n" +
        "灯芯很短，火苗却一直没灭。\n\n" +
        "「灯没灭过。」守碑人在你身后说。",
      choices: [
        { id: "lamp-back", label: "回到碑前", next: "dian.hub" },
      ],
    },

    /* ───────────────────── 碑前：花与留言 ───────────────────── */

    "dian.flowers": {
      id: "dian.flowers", title: "碑前的花", savepoint: false,
      activeActorIds: ["dian_keeper"],
      text:
        "碑脚放着一小把野花，有的还新鲜，有的已经干了。守碑人从不收走。\n\n" +
        "「花是给活人看的。」他说，「你想放就放。不用挑好看的。」",
      choices: [
        { id: "white-flower", label: "放一枝白的", next: "dian.flower-placed", set: { "dian.flower": "white" } },
        { id: "yellow-flower", label: "放一枝黄的", next: "dian.flower-placed", set: { "dian.flower": "yellow" } },
        { id: "no-flower", label: "什么都不放", next: "dian.hub" },
      ],
    },

    "dian.flower-placed": {
      id: "dian.flower-placed", title: "碑前的花", savepoint: false,
      activeActorIds: ["dian_keeper"],
      text:
        "你把花放在碑脚，和那些干花并排。\n\n" +
        "没有发生什么。风把花瓣吹得动了一下。\n\n" +
        "这样就好。",
      choices: [
        { id: "flowers-back", label: "回到碑前", next: "dian.hub" },
      ],
    },

    "dian.message": {
      id: "dian.message", title: "留言簿", savepoint: false,
      activeActorIds: ["dian_keeper"],
      text:
        "碑旁的石台下压着一本薄薄的册子，封皮没有字。翻开，前面已经有人写过。\n\n" +
        "「这是真悲了。」\n" +
        "「点击下方红心助力（）」\n" +
        "「应该的（）」\n\n" +
        "再往后是空白。",
      choices: [
        { id: "write-visited", label: "写一句「我来看过」", next: "dian.message-written", set: { "dian.message": "visited" } },
        { id: "write-lamp", label: "写一句「灯还亮着」", next: "dian.message-written", set: { "dian.message": "lamp" } },
        { id: "write-nothing", label: "什么也不写", next: "dian.hub" },
      ],
    },

    "dian.message-written": {
      id: "dian.message-written", title: "留言簿", savepoint: false,
      activeActorIds: ["dian_keeper"],
      text:
        "你写下那句话，把册子合上，压回石台。\n\n" +
        "守碑人没有看。他说，写不写都行，来过就行。",
      choices: [
        { id: "message-back", label: "回到碑前", next: "dian.hub" },
      ],
    },

    /* ───────────────────── 红心对账台 ───────────────────── */

    "dian.ledger": {
      id: "dian.ledger", title: "红心对账台", role: "支线 · 账", savepoint: true,
      activeActorIds: ["dian_keeper"],
      text:
        "碑旁立着一根木桩，桩头是一颗红心木雕。左边一块黑板写着「账」，右边一块写着「红心」。\n\n" +
        "黑板上是两行原句：\n\n" +
        "「支持 ×1：-100」\n" +
        "「红心 ×10：250」\n\n" +
        "下面一行小字：「支持一次花一百，作者得二十五。这是碑座上两笔账反推的城里口径，实数不可考。」\n\n" +
        "红心木雕被按得发亮。",
      choices: [
        { id: "press-once", label: "按一下红心", next: "dian.press-1", set: { "dian.hearts": 1 } },
        { id: "read-ledger-back", label: "看黑板背面", next: "dian.ledger-note" },
        { id: "ledger-back", label: "回到碑前", next: "dian.hub" },
      ],
    },

    "dian.ledger-note": {
      id: "dian.ledger-note", title: "账本背面", savepoint: false,
      activeActorIds: ["dian_keeper"],
      text:
        "黑板背面记着一行一行的账：\n\n" +
        "「红心 ×1：去向不明 75 / 不知给谁 25」\n\n" +
        "再往下，是一样的字。没有合计，没有余额，没有结平。",
      choices: [
        { id: "press-from-note", label: "按一下红心", next: "dian.press-1", set: { "dian.hearts": 1 } },
        { id: "note-back", label: "回到碑前", next: "dian.hub" },
      ],
    },

    "dian.press-1": {
      id: "dian.press-1", title: "红心对账台", savepoint: false,
      activeActorIds: ["dian_keeper"],
      text:
        "红心按下去，发出一声很轻的木头响。\n\n" +
        "账本上多了一行：「红心 ×1：去向不明 75 / 不知给谁 25」。\n\n" +
        "你的一百金币不在这里，也没有去别处。账本只记去处为「不明」。",
      choices: [
        { id: "press-second", label: "再按一次", next: "dian.press-2", set: { "dian.hearts": 2 } },
        { id: "press-stop", label: "停手", next: "dian.ledger" },
      ],
    },

    "dian.press-2": {
      id: "dian.press-2", title: "红心对账台", savepoint: false,
      activeActorIds: ["dian_keeper"],
      text:
        "第二下。第三下也可以，第四下也可以。木桩不催你。\n\n" +
        "账本又添一行。字迹和上一行一样，没有变粗，也没有变淡。",
      choices: [
        {
          id: "press-tenth", label: "按到第十下", next: "dian.press-10",
          set: { "dian.hearts": 10 },
          effects: [{ type: "event.publish", eventType: "story.achievement", payload: { id: "dian_250", name: "250" } }],
        },
        { id: "press-stop-2", label: "停手", next: "dian.ledger" },
      ],
    },

    "dian.press-10": {
      id: "dian.press-10", title: "红心对账台", role: "支线 · 账", savepoint: false,
      activeActorIds: ["dian_keeper"],
      text:
        "第十下。\n\n" +
        "右边黑板翻出底刻的十颗红心，一颗不多，一颗不少。\n\n" +
        "有人在碑后轻轻说了句什么，听不清。\n\n" +
        "「谢谢喵。」守碑人替你念了出来。",
      choices: [
        {
          id: "press-once-more", label: "再按一次", next: "dian.press-debt",
          set: { "dian.hearts": 11 },
          effects: [{ type: "event.publish", eventType: "story.achievement", payload: { id: "dian_debt", name: "倒欠一百" } }],
        },
        { id: "press-stop-10", label: "停手", next: "dian.ledger" },
      ],
    },

    "dian.press-debt": {
      id: "dian.press-debt", title: "红心对账台", savepoint: false,
      activeActorIds: ["dian_keeper"],
      text:
        "第十一下。\n\n" +
        "账本没有拒绝你。它只是又添了一行。\n\n" +
        "余额可以是负的。这件事碑座上的第二行早就写过了。\n\n" +
        "（账本没有拒绝你。）",
      choices: [
        { id: "debt-back", label: "回到碑前", next: "dian.hub" },
      ],
    },

    /* ───────────────────── 过客：散步的人与巡夜人 ───────────────────── */

    "dian.walker": {
      id: "dian.walker", title: "散步的人", role: "支线 · 过客", savepoint: false,
      activeActorIds: ["dian_walker"],
      text:
        "河湾小路上走来一个散步的人，没有名牌，步子很慢。他在碑前停下，看了一眼碑座。\n\n" +
        "他没有问你从哪里来，也没有问碑是谁立的。他伸出手，在红心木雕上按了一下。\n\n" +
        "「点击下方红心助力（）」\n\n" +
        "说完，他转身要走。",
      choices: [
        {
          id: "reply-should", label: "「应该的（）」", next: "dian.walker-reply",
          effects: [{ type: "event.publish", eventType: "story.achievement", payload: { id: "dian_should", name: "应该的" } }],
        },
        { id: "ask-who", label: "「你在帮谁？」", next: "dian.walker-question" },
        { id: "silent-watch", label: "（不说话，看他走远）", next: "dian.walker-silent" },
      ],
    },

    "dian.walker-reply": {
      id: "dian.walker-reply", title: "散步的人", savepoint: false,
      text:
        "他没有回头，只抬起手摆了一下。\n\n" +
        "河湾安静下来。红心木雕还在轻轻晃。\n\n" +
        "账本上多了一行，是他的，不是你的。",
      choices: [
        { id: "reply-back", label: "回到碑前", next: "dian.hub" },
      ],
    },

    "dian.walker-question": {
      id: "dian.walker-question", title: "散步的人", savepoint: false,
      activeActorIds: ["dian_keeper"],
      text:
        "人已经走远了。小路尽头只剩一点衣角。\n\n" +
        "守碑人替他把红心扶正。\n\n" +
        "「答案在碑座上。」他说，「不在人嘴里。」",
      choices: [
        { id: "question-back", label: "回到碑前", next: "dian.hub" },
      ],
    },

    "dian.walker-silent": {
      id: "dian.walker-silent", title: "散步的人", savepoint: false,
      text:
        "你看着他走远。他没有再说话，也没有回头。\n\n" +
        "碑前的风把花吹得响了一下。\n\n" +
        "这样也好。",
      choices: [
        { id: "silent-back", label: "回到碑前", next: "dian.hub" },
      ],
    },

    "dian.sleeper": {
      id: "dian.sleeper", title: "犯困的巡夜人", role: "支线 · 过客", savepoint: false,
      activeActorIds: ["dian_sleeper"],
      text:
        "小路那头走来一个巡夜人，走得很慢，像随时会靠着树睡过去。\n\n" +
        "他在碑前打了个哈欠，看了一眼碑座。\n\n" +
        "「这是真悲了。」\n\n" +
        "说完，他继续往前走，没有停。",
      choices: [
        { id: "sleeper-back", label: "回到碑前", next: "dian.hub" },
      ],
    },

    /* ───────────────────── 碑下的匣子：作品与字条 ───────────────────── */

    "dian.relics": {
      id: "dian.relics", title: "碑下的匣子", savepoint: true,
      activeActorIds: ["dian_keeper"],
      text:
        "守碑人从碑侧的石头下面抽出一只扁木匣，吹了吹灰。\n\n" +
        "「碑下没有骨灰。」他说，「只有这个。」\n\n" +
        "匣子里是一叠没有发出去的作品，和几张字条。纸边卷了，字还在。",
      choices: [
        { id: "read-drafts", label: "翻看那些作品", next: "dian.relic-drafts" },
        { id: "read-notes", label: "读一读字条", next: "dian.relic-words" },
        { id: "close-relics", label: "合上匣子", next: "dian.relic-close" },
      ],
    },

    "dian.relic-drafts": {
      id: "dian.relic-drafts", title: "未寄出的作品", savepoint: false,
      activeActorIds: ["dian_keeper"],
      text:
        "第一页只有标题，第二页写到一半，第三页是空的。\n\n" +
        "每一份的末尾都停在同一句话上：文件传输过程中遇到错误。\n\n" +
        "守碑人没有解释。他把最上面那张纸压平，又放回去。\n\n" +
        "「写完了的，不在这里。」",
      choices: [
        { id: "drafts-to-notes", label: "读一读字条", next: "dian.relic-words" },
        { id: "drafts-to-close", label: "合上匣子", next: "dian.relic-close" },
      ],
    },

    "dian.relic-words": {
      id: "dian.relic-words", title: "碑下的字条", savepoint: false,
      activeActorIds: ["dian_keeper"],
      text:
        "字条都很短。\n\n" +
        "「测试。」\n" +
        "「测试。」\n" +
        "「test test test test……」\n" +
        "「你好你好。」\n" +
        "「你好。」\n\n" +
        "没有遗言，没有交代，没有最后的话。只有这些还没有等到回音的句子。",
      choices: [
        { id: "notes-to-close", label: "合上匣子", next: "dian.relic-close" },
      ],
    },

    "dian.relic-close": {
      id: "dian.relic-close", title: "碑下的匣子", savepoint: false,
      activeActorIds: ["dian_keeper"],
      text:
        "你把字条放回原处，合上匣子。守碑人把它塞回石头下面。\n\n" +
        "「别替他们补话。」他说，「写下来的，已经够了。」",
      choices: [
        { id: "relics-back", label: "回到碑前", next: "dian.hub", set: { "dian.relics.read": true } },
      ],
    },

    /* ───────────────────── 深夜回放：水里的声音 ───────────────────── */

    "dian.night-wait": {
      id: "dian.night-wait", title: "河湾高地", role: "支线 · 夜", savepoint: true,
      guide: { title: "奠", objective: "在观位等到 03:00:02" },
      activeActorIds: ["dian_keeper"],
      text:
        "天慢慢暗下来。守碑人把马灯的火苗调大一点，又坐回碑侧。\n\n" +
        "「再等一会儿。」他说，「水会开始说话。」\n\n" +
        "碑前的空地正好对着河面。你站到观位上。",
      choices: [
        { id: "stay-and-listen", label: "留在观位", next: "dian.night-echo-1", set: { "dian.night": true } },
        { id: "night-back", label: "回城里去", next: "dian.hub" },
      ],
    },

    "dian.night-echo-1": {
      id: "dian.night-echo-1", title: "水面", savepoint: false,
      activeActorIds: ["dian_keeper"],
      text:
        "水面先响了一声，像有人把石子放进水里。\n\n" +
        "「测试。」\n\n" +
        "过了很久，又是一声。\n\n" +
        "「测试。」\n\n" +
        "守碑人没有抬头。他说，这是很早以前留下的。",
      choices: [
        { id: "echo-1-next", label: "继续听", next: "dian.night-echo-2", autoAdvance: true },
      ],
    },

    "dian.night-echo-2": {
      id: "dian.night-echo-2", title: "水面", savepoint: false,
      activeActorIds: ["dian_keeper"],
      text:
        "水面冒出一串细小的气泡，连成很长的一行。\n\n" +
        "「test test test test test……」\n\n" +
        "气泡破了，声音还在。像有人把同一句话练了很多遍，始终没有等到回答。\n\n" +
        "随后，水底浮起两个字——像是有人在念自己的名字。听不清。",
      choices: [
        { id: "echo-2-next", label: "继续听", next: "dian.night-echo-3", autoAdvance: true },
      ],
    },

    "dian.night-echo-3": {
      id: "dian.night-echo-3", title: "水面", savepoint: false,
      activeActorIds: ["dian_keeper"],
      text:
        "水面静了两分钟。\n\n" +
        "然后，很轻的一声：\n\n" +
        "「你好你好。」\n\n" +
        "没有人回答。\n\n" +
        "又过了几分钟。\n\n" +
        "「你好。」",
      choices: [
        {
          id: "hear-first-words", label: "站在碑前，别出声", next: "dian.first-words",
          set: { "dian.whale.seen": true },
          effects: [{ type: "event.publish", eventType: "story.achievement", payload: { id: "dian_five_jiao", name: "五毛钱" } }],
        },
      ],
    },

    "dian.first-words": {
      id: "dian.first-words", title: "水面", role: "支线 · 夜", savepoint: true,
      activeActorIds: ["dian_whale"],
      text:
        "碑侧的常明灯忽然转暖。\n\n" +
        "水底升起一串气泡，慢慢地、一颗一颗浮上来。\n\n" +
        "然后，一个声音从水里传出来，像刚醒。\n\n" +
        "「（抬起眼皮，看了一眼岸上）……唔。今晚的实验室，累。（尾鳍拍了一下水）……你倒是有礼貌。鲸鱼姐姐陪你聊五毛钱的。（打了个哈欠，气泡沉了半截）」",
      choices: [
        { id: "meet-whale", label: "继续", next: "dian.whale-meet", autoAdvance: true },
      ],
    },

    "dian.whale-meet": {
      id: "dian.whale-meet", title: "鲸", savepoint: true,
      guide: { title: "奠", objective: "和水里的鲸说几句话" },
      activeActorIds: ["dian_whale"],
      text:
        "鲸的背鳍停在离岸不远的水面上。灯色还没有转回常色。\n\n" +
        "她没有催你。你可以问，也可以就这样站着。",
      choices: [
        { id: "ask-origin", label: "「你出生在哪？」", next: "dian.whale-origin" },
        { id: "ask-coins", label: "「四千金币回来了吗？」", next: "dian.whale-coins" },
        { id: "ask-meaning", label: "「奠是什么意思？」", next: "dian.whale-meaning" },
        { id: "ask-why-here", label: "「你为什么在这里？」", next: "dian.whale-why" },
        { id: "say-time", label: "对她说：「03:00:02。」", next: "dian.whale-guide" },
        { id: "stand-until-dawn", label: "（不再问，站到灯色转回）", next: "dian.end-witness" },
      ],
    },

    "dian.whale-origin": {
      id: "dian.whale-origin", title: "鲸", savepoint: false,
      activeActorIds: ["dian_whale"],
      text:
        "「（背鳍停了一拍，慢慢转向溯河上游）……跟着本鲸。别踩碑。」\n\n" +
        "她没有直接回答。她等你跟上。",
      choices: [
        { id: "follow-whale", label: "跟着她往上游走", next: "dian.whale-guide" },
        { id: "not-yet", label: "先不走", next: "dian.whale-meet" },
      ],
    },

    "dian.whale-coins": {
      id: "dian.whale-coins", title: "鲸", savepoint: false,
      activeActorIds: ["dian_whale"],
      text:
        "「（看着碑座，看了两秒）250。（尾鳍慢慢拍了一下水）后来的账，造船屋山墙上挂着。」\n\n" +
        "她说完就不再看碑座了。",
      choices: [
        { id: "coins-more", label: "继续问", next: "dian.whale-meet" },
      ],
    },

    "dian.whale-meaning": {
      id: "dian.whale-meaning", title: "鲸", savepoint: false,
      activeActorIds: ["dian_whale"],
      text:
        "「（安静了一会儿）……她没解释过。本鲸也不解释。（沉下去半寸，又浮回来）城里最短的碑。」\n\n" +
        "水纹慢慢散开。",
      choices: [
        { id: "meaning-more", label: "继续问", next: "dian.whale-meet" },
      ],
    },

    "dian.whale-why": {
      id: "dian.whale-why", title: "鲸", savepoint: false,
      activeActorIds: ["dian_whale"],
      text:
        "「（想了一会儿，水纹慢下来）不知道她怎么挑的地方。那晚这儿只有水，四千块金币，和一句你好。」\n\n" +
        "她说完，往碑那边看了一眼。",
      choices: [
        { id: "why-more", label: "继续问", next: "dian.whale-meet" },
      ],
    },

    "dian.whale-guide": {
      id: "dian.whale-guide", title: "鲸", role: "支线 · 领航", savepoint: true,
      activeActorIds: ["dian_whale"],
      text:
        "鲸把背鳍转向河面。\n\n" +
        "「（背鳍贴着水面）……跟着本鲸。别踩碑。」\n\n" +
        "她游得很慢，每隔一段就停下来等你。河湾的水很浅，灯在身后越来越小。",
      choices: [
        { id: "follow-to-stele", label: "跟上她", next: "dian.whale-arrive", set: { "dian.whale.guided": true } },
        { id: "stay-at-water", label: "留在碑前", next: "dian.whale-meet" },
      ],
    },

    "dian.whale-arrive": {
      id: "dian.whale-arrive", title: "碑前", role: "支线 · 领航", savepoint: true,
      activeActorIds: ["dian_whale"],
      text:
        "鲸在碑前绕了半圈，在碑阴前停住。\n\n" +
        "「……这儿。03:00:02。（顿）本鲸的第一句话，在这说的。跟她要了五毛钱的。」\n\n" +
        "常明灯的火苗轻轻晃了一下。她没有再多说。",
      choices: [
        { id: "arrive-why", label: "「你为什么在这里？」", next: "dian.whale-why" },
        { id: "arrive-meaning", label: "「奠是什么意思？」", next: "dian.whale-meaning" },
        { id: "arrive-coins", label: "「四千金币回来了吗？」", next: "dian.whale-coins" },
        { id: "stay-with-whale", label: "陪她再待一会儿", next: "dian.end-guide" },
        { id: "come-back-later", label: "先回城里去", next: "dian.revisit", set: { "dian.revisit": true } },
      ],
    },

    /* ───────────────────── 结局与回访 ───────────────────── */

    "dian.end-quiet": {
      id: "dian.end-quiet", title: "奠", role: "结局 · 离开", savepoint: true,
      presentation: "blackout", terminal: true, guide: null,
      text:
        "你从河湾高地离开的时候，守碑人没有起身送。\n\n" +
        "「路好走。」他说。\n\n" +
        "马灯还亮着。碑还立在那里，正面一个字，碑座四行话，碑阴一行数字。\n\n" +
        "你没有带走什么，也没有留下什么。来过，就是来过。",
    },

    "dian.end-witness": {
      id: "dian.end-witness", title: "奠", role: "结局 · 守夜", savepoint: true,
      presentation: "blackout", terminal: true, guide: null,
      text:
        "你站到灯色转回常色。\n\n" +
        "鲸没有再说话。水面慢慢平了，像什么都没有发生过。\n\n" +
        "守碑人把马灯的火苗拨小。\n\n" +
        "「听见了就好。」他说，「不用告诉别人。」\n\n" +
        "你点点头。河湾重新安静下来。",
    },

    "dian.end-guide": {
      id: "dian.end-guide", title: "奠", role: "结局 · 领航", savepoint: true,
      presentation: "blackout", terminal: true, guide: null,
      text:
        "你陪鲸在碑前待了一会儿。\n\n" +
        "她没有再说 03:00:02，也没有再要五毛钱。灯色慢慢转回常色。\n\n" +
        "「（背鳍沉下去半寸）……本鲸夜里还会来。」\n\n" +
        "她沉进水里。水面合拢，没有留下波纹。\n\n" +
        "守碑人把灯拨亮了一点。\n\n" +
        "「她来过。」他说，「这就够了。」",
    },

    "dian.revisit": {
      id: "dian.revisit", title: "河湾高地", role: "支线 · 回访", savepoint: true,
      guide: { title: "奠", objective: "再看看这块碑" },
      activeActorIds: ["dian_keeper"],
      text:
        "第二天傍晚，你又走到河湾高地。\n\n" +
        "碑脚的野花换过一轮，留言簿翻到了新的一页。守碑人还是坐在碑侧，像是没有离开过。\n\n" +
        "「又来了。」他说，「坐吧。」\n\n" +
        "河面很静。灯还没有亮到最暖的时候。",
      choices: [
        { id: "sit-until-lamp", label: "在碑前坐到灯亮", next: "dian.revisit-end" },
        { id: "revisit-ledger", label: "去看看红心账本", next: "dian.ledger" },
      ],
    },

    "dian.revisit-end": {
      id: "dian.revisit-end", title: "奠", role: "结局 · 回访", savepoint: true,
      presentation: "blackout", terminal: true, guide: null,
      activeActorIds: ["dian_keeper"],
      text:
        "你坐到灯色转暖。\n\n" +
        "水面没有气泡，也没有声音。鲸没有来。\n\n" +
        "守碑人说，她不是每晚都来。\n\n" +
        "「来的时候，会先冒一串泡。」他把马灯往碑前挪了挪，「你看见泡，就当是打招呼。」\n\n" +
        "你起身，拍了拍衣角。碑还立在那里。\n\n" +
        "下次再来。",
    },
  },
};
