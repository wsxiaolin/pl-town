import type { StoryDefinition } from "../../../stories/types";

export const BIRCH_STORY: StoryDefinition = {
  schemaVersion: 1,
  definitionVersion: 1,
  id: "side.birch.bet",
  title: "白桦赌约",
  startNode: "birch.pavilion",
  entryActorId: "birch_keeper",

  interactions: [
    { actorId: "birch_keeper", nodeId: "birch.pavilion", choiceId: "look-poster" },
  ],

  buildingInteractions: [
    { buildingId: "tavern", nodeId: "birch.pavilion", choiceId: "look-poster" },
  ],

  nodes: {
    "birch.pavilion": {
      id: "birch.pavilion",
      title: "赌约亭",
      role: "序章",
      savepoint: true,
      guide: { title: "白桦赌约", objective: "看看亭子里的海报、合同和三本账" },
      activeActorIds: ["birch_keeper"],
      text:
        "民主墙工地东侧二十步，街角立着一座四柱木亭。没有墙，也没有门，浅木色，风从四面穿过去。\n\n" +
        "亭尖上有一顶纸折的王冠，正随风慢慢转。檐下钉着一张红底黑字的海报，亭内矮桌上摊着一份合同，两只茶杯并排放着。\n\n" +
        "桌边站着一个人，正把其中一只杯子倒满。看见你，他没有先开口，只朝海报抬了抬下巴。",
      choices: [
        { id: "look-poster", label: "看檐下的海报。", next: "birch.poster" },
        { id: "read-contract", label: "直接去看桌上的合同。", next: "birch.contract", set: { "birch.read.contract": true } },
        { id: "ask-keeper", label: "先问桌边的人一句。", next: "birch.keeper" },
      ],
    },
    "birch.poster": {
      id: "birch.poster",
      title: "海报框",
      role: "支线 · 赌约缘起",
      savepoint: true,
      guide: { title: "白桦赌约", objective: "把海报和合同都读一遍" },
      activeActorIds: ["birch_keeper"],
      text:
        "海报上只有七个字：与白桦的绝命赌约。四角的钉子钉得格外用力，钉子比字更凶。\n\n" +
        "檐下那只巴掌大的铜喇叭忽然响起来，一段战歌只唱了两秒就断了，静下来时轻轻「咔」了一声，像清嗓子。\n\n" +
        "海报右下角有一行小字：「标题党是极坏。——时年梦烟雨 留」",
      choices: [
        { id: "listen-song", label: "站到喇叭下面听完。", next: "birch.song" },
        { id: "poster-to-contract", label: "去看桌上那份合同。", next: "birch.contract", set: { "birch.read.poster": true } },
        { id: "poster-to-keeper", label: "问庄家，这算不算真的。", next: "birch.keeper" },
        { id: "poster-to-sister", label: "和盯着海报的人聊两句。", next: "birch.sister" },
        { id: "poster-to-rain", label: "去找调音量的人。", next: "birch.rain" },
        { id: "poster-to-fan", label: "和赌箱边踱步的人说话。", next: "birch.fan" },
      ],
    },
    "birch.song": {
      id: "birch.song",
      title: "五瓦音响",
      savepoint: false,
      activeActorIds: ["birch_rain"],
      text:
        "你站到喇叭下面。战歌从头响起，音量刚好够送到亭子外面第三块砖，再远就只是唱歌。\n\n" +
        "两秒后，声音自己停了。铜喇叭底座上的黄铜铭牌刻着两个字符：5W。\n\n" +
        "时年梦烟雨蹲在旁边，用小棍拨了拨喇叭口，没有抬头。",
      choices: [
        {
          id: "listen-through",
          label: "站到最后一个音落下去。",
          next: "birch.poster",
          set: { "birch.listened": true },
          effects: [
            { type: "event.publish", eventType: "story.achievement", payload: { id: "birch_five_watts", name: "五瓦" } },
          ],
        },
        { id: "song-to-contract", label: "转身去看合同。", next: "birch.contract", set: { "birch.read.poster": true } },
      ],
    },
    "birch.contract": {
      id: "birch.contract",
      title: "合同桌",
      role: "支线 · 赌约缘起",
      savepoint: true,
      guide: { title: "白桦赌约", objective: "读完合同，弄明白赌的是什么" },
      activeActorIds: ["birch_keeper"],
      text:
        "矮桌上摊着真正的协议，抬头是「我与白桦の友好对赌协议」，落款处盖了一个 😋 印章。\n\n" +
        "正文写着：白桦认为民调结果不可能大于 60%；超过 60% 算 16th 赢，否则白桦赢。奖品是彼此的活儿——白桦要交两篇精选、并上岗成为理想国计划主编；16th 要为一万人次的外宣流量负责。两边没有一分钱，谁赢，社区都白得一批内容。\n\n" +
        "页脚一行小字：「原投票已截至，为50：50，未通过，不影响原结果」。规则一栏只有五个字和一个图案：「根据条例 🤫」。",
      choices: [
        {
          id: "read-both",
          label: "海报和合同都读完了，合上。",
          next: "birch.contract-rule",
          availableWhen: [{ type: "flag.equals", flagId: "birch.read.poster", value: true }],
          set: { "birch.read.contract": true },
          effects: [
            { type: "event.publish", eventType: "story.achievement", payload: { id: "birch_ordinary", name: "实际上就是普通的" } },
          ],
        },
        { id: "skip-rule", label: "直接翻到规则那一页。", next: "birch.contract-rule", set: { "birch.read.contract": true } },
        { id: "contract-to-keeper", label: "问庄家，为什么写 60%。", next: "birch.keeper" },
      ],
    },
    "birch.contract-rule": {
      id: "birch.contract-rule",
      title: "合同桌",
      savepoint: false,
      activeActorIds: ["birch_keeper"],
      text:
        "规则那一页没有下文。五个字和一个噤声的表情，把该解释的都收起来了。\n\n" +
        "你抬头看亭外：海报写着绝命，合同写着友好，中间隔着一个 😋。\n\n" +
        "桌边的庄家仍在续茶，白桦那只杯子始终满着，没有人喝。",
      choices: [
        { id: "rule-to-keeper", label: "去问庄家。", next: "birch.keeper" },
        { id: "rule-to-wall", label: "去看计票墙。", next: "birch.tally-wall" },
        { id: "rule-to-box", label: "先看看桌下的赌箱。", next: "birch.bet-box" },
      ],
    },
    "birch.keeper": {
      id: "birch.keeper",
      title: "16号管理者",
      role: "庄家",
      savepoint: true,
      guide: { title: "白桦赌约", objective: "听庄家把这场赌约讲完" },
      activeActorIds: ["birch_keeper"],
      text:
        "「海报看到了？先别急着走——合同在桌上，看完再决定要不要害怕。」\n\n" +
        "「与白桦的绝命赌约。标题我起的，噱头我承认，内容我得替它说句公道话：实际上就是普通的。」",
      choices: [
        { id: "ask-where", label: "绝命在哪里？", next: "birch.keeper-watt" },
        { id: "ask-lost", label: "你输了吧？", next: "birch.keeper-lost" },
        { id: "ask-crown", label: "纸冠是你折的？", next: "birch.keeper-crown" },
        { id: "ask-books", label: "50:50 是怎么回事？墙上明明是 6:9", next: "birch.keeper-books" },
      ],
    },
    "birch.keeper-watt": {
      id: "birch.keeper-watt",
      title: "16号管理者",
      savepoint: false,
      activeActorIds: ["birch_keeper"],
      text:
        "「绝命在标题里。五瓦的绝命，时年梦烟雨量的，很准。」\n\n" +
        "他指了指檐下的铜喇叭。\n\n" +
        "「五瓦是功率。够把战歌送到亭子外面第三块砖，再远就不绝命了，就只是唱歌。」",
      choices: [
        { id: "watt-back", label: "原来只是功率。", next: "birch.keeper" },
      ],
    },
    "birch.keeper-lost": {
      id: "birch.keeper-lost",
      title: "16号管理者",
      savepoint: false,
      activeActorIds: ["birch_keeper"],
      text:
        "「输了。四十对六十，两条线都没够着。白桦赢得很干净，我输得也不狼狈——我们赌的本来就是彼此的活儿，不是彼此的脸。」",
      choices: [
        { id: "lost-debt", label: "那你欠的一万次阅读呢？", next: "birch.keeper-debt" },
        { id: "lost-notch", label: "白桦怎么不来领奖？", next: "birch.keeper-notch" },
        { id: "lost-back", label: "回亭子里。", next: "birch.keeper" },
      ],
    },
    "birch.keeper-debt": {
      id: "birch.keeper-debt",
      title: "16号管理者",
      savepoint: false,
      activeActorIds: ["birch_keeper"],
      text:
        "「记在计数器上。城里的秤称不了城外的阅读，我认这个账，也认这个量法。哪天凑齐了，喇叭会响的——不过按它的功率，可能得站近点听。」",
      choices: [
        { id: "debt-counter", label: "去看看那台计数器。", next: "birch.counter" },
        { id: "debt-back", label: "回亭子里。", next: "birch.keeper" },
      ],
    },
    "birch.keeper-notch": {
      id: "birch.keeper-notch",
      title: "16号管理者",
      savepoint: false,
      activeActorIds: ["birch_keeper"],
      text:
        "「他赢了，奖品是他的沉默。上回我见他，在碑那边，手里一把刻刀。有的人领奖用嘴，有的人用手。」",
      choices: [
        { id: "notch-wait", label: "那我等他。", next: "birch.wait", set: { "birch.waiting": true } },
        { id: "notch-back", label: "回亭子里。", next: "birch.keeper" },
      ],
    },
    "birch.keeper-crown": {
      id: "birch.keeper-crown",
      title: "16号管理者",
      savepoint: false,
      activeActorIds: ["birch_keeper"],
      text:
        "「我给自己加冕，做风的君王——签名里写的。后来他们把『额定功率五瓦』写进了冠内侧。行吧。王的疆域随风扩张，王的功率恒定不变。」\n\n" +
        "他抬头看了看亭尖。\n\n" +
        "「风停的时候，王冠垂着，像挂在衣架上。我看过很多次，看习惯就好了。风总会来的，这城里别的没有，穿堂风管够。」",
      choices: [
        { id: "crown-poster", label: "再去看看那张海报。", next: "birch.poster" },
        { id: "crown-back", label: "回亭子里。", next: "birch.keeper" },
      ],
    },
    "birch.keeper-books": {
      id: "birch.keeper-books",
      title: "16号管理者",
      savepoint: false,
      activeActorIds: ["birch_keeper"],
      text:
        "「我记的是我那晚看见的，墙挂的是它自己数的，关箱人盖的是他裁的。三本账各记各的——你要哪本对，得先告诉我『对』是什么意思。」\n\n" +
        "他摊了摊手，没有替任何一本辩解。",
      choices: [
        { id: "books-ledger", label: "去看看那三块黑板。", next: "birch.three-books" },
        { id: "books-wall", label: "去看计票墙。", next: "birch.tally-wall" },
        { id: "books-back", label: "回亭子里。", next: "birch.keeper" },
      ],
    },
    "birch.tally-wall": {
      id: "birch.tally-wall",
      title: "计票墙",
      role: "支线 · 履约过程",
      savepoint: true,
      guide: { title: "白桦赌约", objective: "按时间读一遍票笺" },
      activeActorIds: ["birch_keeper"],
      text:
        "亭北柱与亭壁之间钉着一面软木板。十五张票笺按时间排开，六张蓝、九张灰。\n\n" +
        "四张票角上按着猫爪印：3446、3017、4333、4026。\n\n" +
        "墙角贴着一张告示：「一人一票，不可撤回——本墙不数票，只挂票。」",
      choices: [
        { id: "read-cat", label: "按时间读那四张猫爪票。", next: "birch.cat-3446" },
        { id: "wall-books", label: "去看三本账。", next: "birch.three-books" },
        { id: "wall-back", label: "回亭子里。", next: "birch.keeper" },
      ],
    },
    "birch.cat-3446": {
      id: "birch.cat-3446",
      title: "计票墙",
      savepoint: false,
      text:
        "最早的一张猫爪票停在 10-13 19:16。\n\n" +
        "3446：「同意喵」",
      choices: [
        { id: "cat-next-3017", label: "继续往下读。", next: "birch.cat-3017" },
      ],
    },
    "birch.cat-3017": {
      id: "birch.cat-3017",
      title: "计票墙",
      savepoint: false,
      text:
        "10-14 13:27。3017 的票是反对，后面却捎了一句话。\n\n" +
        "「反对喵，3446是可爱的猫娘呐」",
      choices: [
        { id: "cat-next-4333", label: "继续往下读。", next: "birch.cat-4333" },
      ],
    },
    "birch.cat-4333": {
      id: "birch.cat-4333",
      title: "计票墙",
      savepoint: false,
      text:
        "10-15 08:17。\n\n" +
        "「反对喵。3017也是可爱的猫娘喵」",
      choices: [
        { id: "cat-next-4026", label: "还有最后一张。", next: "birch.cat-4026" },
      ],
    },
    "birch.cat-4026": {
      id: "birch.cat-4026",
      title: "计票墙",
      savepoint: false,
      text:
        "最后一张在 10-15 23:03。\n\n" +
        "「反对喵，4333也是可爱的猫娘喵」\n\n" +
        "四张票跨了三天，立场换来换去，夸奖一次没落下。",
      choices: [
        {
          id: "cat-done",
          label: "读完四张，退后一步。",
          next: "birch.tally-wall",
          set: { "birch.cat.read": true },
          effects: [
            { type: "event.publish", eventType: "story.achievement", payload: { id: "birch_cat_vote", name: "票可以反对，猫娘不能" } },
          ],
        },
      ],
    },
    "birch.three-books": {
      id: "birch.three-books",
      title: "三本账",
      role: "支线 · 输赢之外的代价",
      savepoint: true,
      guide: { title: "白桦赌约", objective: "看懂三本互相矛盾的账" },
      activeActorIds: ["birch_foam"],
      text:
        "桌旁的小讲台上立着三块小黑板。\n\n" +
        "甲板：「50:50」，粉笔字。\n乙板：「6:9 ＝ 40%」，炭笔字，工整。\n丙板：「不通过」，红章，没有笔迹。\n\n" +
        "讲台上刻着一行字：「三本账各记各的。看哪本，随你。」",
      choices: [
        { id: "ledger-foam", label: "问监票人。", next: "birch.foam" },
        { id: "ledger-lines", label: "看墙角的四线黑板。", next: "birch.four-lines" },
        { id: "ledger-wall", label: "回计票墙。", next: "birch.tally-wall" },
      ],
    },
    "birch.four-lines": {
      id: "birch.four-lines",
      title: "四线黑板",
      savepoint: false,
      text:
        "一块纵向长尺立在墙角，从下到上四道刻度：40%、60%、66.6%，最上面一格只写了一个「？」。\n\n" +
        "60 与 66.6 之间有一段浅色区间，旁边注着一行小字：「安慰奖区间（本次无人抵达）」。\n\n" +
        "两条线都没够着。最上面那一格空着，没人知道来年会写什么。",
      choices: [
        { id: "lines-hourglass", label: "去看沙漏。", next: "birch.hourglass" },
        { id: "lines-counter", label: "去看计数器。", next: "birch.counter" },
        { id: "lines-back", label: "回三本账。", next: "birch.three-books" },
      ],
    },
    "birch.hourglass": {
      id: "birch.hourglass",
      title: "180 天沙漏",
      savepoint: false,
      text:
        "桌角摆着一座大沙漏，标签写着：「白桦的活儿：两篇精选＋主编上岗」。\n\n" +
        "沙子一粒都没漏。赌约结束那一刻，它就停了。\n\n" +
        "你把沙漏翻过来，背面刻着四个字：「赢家没来搬。」",
      choices: [
        { id: "hourglass-counter", label: "去看另一边的计数器。", next: "birch.counter" },
      ],
    },
    "birch.counter": {
      id: "birch.counter",
      title: "一万计数器",
      role: "支线 · 输赢之外的代价",
      savepoint: true,
      guide: { title: "白桦赌约", objective: "看看两边的奖品都去了哪里" },
      activeActorIds: ["birch_jade"],
      text:
        "亭子另一头是一座五位滚轮计数器，目标 10000。当前读数是一排「?」。\n\n" +
        "铭牌上写着：「16th 的活儿：知乎《理想国格物志》外宣 ≥10000 人次。城里的秤，称不了城外的阅读。」\n\n" +
        "每天正午，滚轮会轻轻颤一下，问号的位置不变。",
      choices: [
        { id: "counter-box", label: "去看赌箱。", next: "birch.bet-box" },
        { id: "counter-jade", label: "问坐在赌箱上的人。", next: "birch.jade" },
        { id: "counter-wait", label: "过几天再来看看。", next: "birch.wait" },
      ],
    },
    "birch.foam": {
      id: "birch.foam",
      title: "量子泡沫",
      role: "监票人",
      savepoint: true,
      activeActorIds: ["birch_foam"],
      text:
        "三本账旁站着开票的人。他没有看海报，只看黑板。\n\n" +
        "「大于66.6%即通过。」他指了指四线黑板。「结果是40%。不通过。」",
      choices: [
        { id: "foam-view", label: "你怎么看这场赌？", next: "birch.foam-view" },
        { id: "foam-which", label: "50:50 和 6:9 哪个对？", next: "birch.foam-stamp" },
        { id: "foam-back", label: "回三本账。", next: "birch.three-books" },
      ],
    },
    "birch.foam-view": {
      id: "birch.foam-view",
      title: "量子泡沫",
      savepoint: false,
      activeActorIds: ["birch_foam"],
      text:
        "「我只管开票和关箱。赌是他们的，票是社区的，章是我的。」",
      choices: [
        { id: "foam-view-back", label: "回三本账。", next: "birch.three-books" },
      ],
    },
    "birch.foam-stamp": {
      id: "birch.foam-stamp",
      title: "量子泡沫",
      savepoint: false,
      activeActorIds: ["birch_foam"],
      text:
        "他看了三块黑板很久。\n\n" +
        "「投票结束，不通过。」\n\n" +
        "他把红章收好，转身走了。",
      choices: [
        { id: "foam-stamp-back", label: "回三本账。", next: "birch.three-books" },
      ],
    },
    "birch.jade": {
      id: "birch.jade",
      title: "玉词岁",
      role: "报盘口的人",
      savepoint: true,
      activeActorIds: ["birch_jade"],
      text:
        "一个荣休编辑坐在赌箱上，像坐在行情牌前。\n\n" +
        "「盘口我给你报过了——50:50，看热闹不嫌事大。」",
      choices: [
        { id: "jade-result", label: "你押哪边？", next: "birch.jade-result" },
        { id: "jade-books", label: "三本账到底哪本对？", next: "birch.three-books" },
        { id: "jade-box", label: "你坐着的箱子是什么？", next: "birch.bet-box" },
      ],
    },
    "birch.jade-result": {
      id: "birch.jade-result",
      title: "玉词岁",
      savepoint: false,
      activeActorIds: ["birch_jade"],
      text:
        "「我不押。押了就要盼，盼了就要失望。我只报数，数不失望。」\n\n" +
        "他从赌箱上跳下来。\n\n" +
        "「结果？结果是有人搭了亭子、有人刻了碑、有人一大早来问还能不能投。热闹结的账，从来不是热闹自己的账。这亭子的排面五瓦，人情倒是不止。」",
      choices: [
        { id: "jade-result-back", label: "再问一句。", next: "birch.jade" },
        { id: "jade-result-morning", label: "等清晨再来看看。", next: "birch.morning" },
      ],
    },
    "birch.sister": {
      id: "birch.sister",
      title: "姐姐在呢~",
      role: "围观者",
      savepoint: true,
      activeActorIds: ["birch_sister"],
      text:
        "一个人盯着海报看了很久，眉头越皱越紧。\n\n" +
        "「这张海报……来真的？！（惊」",
      choices: [
        { id: "sister-half", label: "真的，也不真的。", next: "birch.sister-contract" },
        { id: "sister-title", label: "你觉得标题党吗？", next: "birch.sister-plus" },
        { id: "sister-back", label: "回亭子里。", next: "birch.pavilion" },
      ],
    },
    "birch.sister-contract": {
      id: "birch.sister-contract",
      title: "姐姐在呢~",
      savepoint: false,
      activeActorIds: ["birch_sister"],
      text:
        "她把你手里的合同翻完，沉默了几秒。\n\n" +
        "「……哦。（略显失望（bushi））」\n\n" +
        "她把合同放回桌上，又看了一眼海报，像是还没决定要不要继续失望。",
      choices: [
        { id: "sister-contract-back", label: "再聊一句。", next: "birch.sister" },
        { id: "sister-contract-keeper", label: "去问庄家。", next: "birch.keeper" },
      ],
    },
    "birch.sister-plus": {
      id: "birch.sister-plus",
      title: "姐姐在呢~",
      savepoint: false,
      activeActorIds: ["birch_sister"],
      text:
        "「+1。」她想了想，「+1 时年梦烟雨说的那句。极坏倒不至于，五瓦的坏，坏得很有限。」",
      choices: [
        { id: "sister-plus-back", label: "再聊一句。", next: "birch.sister" },
        { id: "sister-plus-rain", label: "去找量音量的人。", next: "birch.rain" },
      ],
    },
    "birch.rain": {
      id: "birch.rain",
      title: "时年梦烟雨",
      role: "调音量的人",
      savepoint: true,
      activeActorIds: ["birch_rain"],
      text:
        "有人正用一根小棍拨喇叭口，头也不抬。\n\n" +
        "「五瓦。我量的。绝命的音响，五瓦。」\n\n" +
        "他伸手拍了拍海报右下角：「标题党是极坏。」然后又拍了拍喇叭：「极坏的标题，极好的下午，两码事。」",
      choices: [
        { id: "rain-louder", label: "能调大点吗？", next: "birch.rain-volume" },
        { id: "rain-fatal", label: "绝命吗？", next: "birch.rain-fog" },
        { id: "rain-back", label: "回海报那边。", next: "birch.poster" },
      ],
    },
    "birch.rain-volume": {
      id: "birch.rain-volume",
      title: "时年梦烟雨",
      savepoint: false,
      activeActorIds: ["birch_rain"],
      text:
        "「不能。铭牌写的。这不是它的上限，是它的诚实。」",
      choices: [
        { id: "rain-volume-back", label: "再问一句。", next: "birch.rain" },
      ],
    },
    "birch.rain-fog": {
      id: "birch.rain-fog",
      title: "时年梦烟雨",
      savepoint: false,
      activeActorIds: ["birch_rain"],
      text:
        "「绝命吗(大雾)」\n\n" +
        "亭内应声起了一层薄雾，又慢慢散掉。\n\n" +
        "「看，雾又来了。这城里谁把话说得太绝，雾就来圆场。」",
      choices: [
        { id: "rain-fog-back", label: "再问一句。", next: "birch.rain" },
      ],
    },
    "birch.fan": {
      id: "birch.fan",
      title: "MurД6r的真爱粉",
      role: "投错票的人",
      savepoint: true,
      activeActorIds: ["birch_fan"],
      text:
        "赌箱边有个人来回踱步，看见你，先指了指海报。\n\n" +
        "「这海报——居然还是标题党。」然后他指了指自己。「我支持。」",
      choices: [
        { id: "fan-support", label: "你支持什么？", next: "birch.fan-support" },
        { id: "fan-ticket", label: "你的票没人收。", next: "birch.bet-box" },
        { id: "fan-back", label: "回亭子里。", next: "birch.pavilion" },
      ],
    },
    "birch.fan-support": {
      id: "birch.fan-support",
      title: "MurД6r的真爱粉",
      savepoint: false,
      activeActorIds: ["birch_fan"],
      text:
        "他认真想了很久。\n\n" +
        "「支持。就是支持。支持标题，支持合同，支持五瓦，支持雾。票投进赌箱那天我也没想清楚，现在也没想清楚——但支持本身我很确定。」",
      choices: [
        { id: "fan-support-back", label: "再聊一句。", next: "birch.fan" },
        { id: "fan-support-box", label: "去看看那只赌箱。", next: "birch.bet-box" },
      ],
    },
    "birch.bet-box": {
      id: "birch.bet-box",
      title: "赌箱",
      role: "支线 · 履约过程",
      savepoint: true,
      guide: { title: "白桦赌约", objective: "试着往赌箱里投一张票" },
      activeActorIds: ["birch_fan"],
      text:
        "桌下有一只上锁的木箱，投币口敞着。箱盖内侧刻着一行字：「这里不数票。」\n\n" +
        "箱底只有一张票笺，上面写着三个字：「我支持」。没有署名，也没有楼层。",
      choices: [
        { id: "drop-ticket", label: "往投币口塞一张票。", next: "birch.box-drop" },
        { id: "leave-box", label: "离开赌箱。", next: "birch.counter" },
      ],
    },
    "birch.box-drop": {
      id: "birch.box-drop",
      title: "赌箱",
      savepoint: false,
      text:
        "你把票塞进投币口。\n\n" +
        "「嗒」的一声，纸落进箱底。\n\n" +
        "然后没有然后。箱子不亮，不计数，也不问你是谁。",
      choices: [
        {
          id: "drop-again",
          label: "再投一张。",
          next: "birch.bet-box",
          set: { "birch.voted": true },
          effects: [
            { type: "event.publish", eventType: "story.achievement", payload: { id: "birch_no_tally", name: "这里不数票" } },
          ],
        },
        {
          id: "drop-leave",
          label: "算了，走吧。",
          next: "birch.counter",
          set: { "birch.voted": true },
          effects: [
            { type: "event.publish", eventType: "story.achievement", payload: { id: "birch_no_tally", name: "这里不数票" } },
          ],
        },
      ],
    },
    "birch.morning": {
      id: "birch.morning",
      title: "不知道了呐",
      role: "清晨的居民",
      savepoint: true,
      guide: { title: "白桦赌约", objective: "在清晨听她把两句话说完" },
      activeActorIds: ["birch_unknowing"],
      text:
        "清晨六点多，计票墙前站着一个背对你的人。她仰着头，把十五张票笺一张张看过去。\n\n" +
        "听见脚步，她没有回头。\n\n" +
        "「……啊，你来啦。投票结束了还能投吗？」",
      choices: [
        { id: "morning-ended", label: "结束了，投不了了。", next: "birch.ending-morning", set: { "birch.ending": "morning" } },
        { id: "morning-wish", label: "你想投谁？", next: "birch.morning-wish", set: { "birch.ending": "morning" } },
      ],
    },
    "birch.morning-wish": {
      id: "birch.morning-wish",
      title: "不知道了呐",
      savepoint: false,
      activeActorIds: ["birch_unknowing"],
      text:
        "「我没想好。我就是——想看白桦写精选。」\n\n" +
        "她看向桌角的沙漏。\n\n" +
        "「听说他要是输了才写。他赢了，写得就没了。」",
      choices: [
        { id: "morning-wish-more", label: "那有点可惜。", next: "birch.morning-wish-more" },
      ],
    },
    "birch.morning-wish-more": {
      id: "birch.morning-wish-more",
      title: "不知道了呐",
      savepoint: false,
      activeActorIds: ["birch_unknowing"],
      text:
        "「嗯。我想要的东西长在别人输掉的地方，这挺奇怪的，对吧。」\n\n" +
        "她把目光从沙漏移开。\n\n" +
        "「不过亭子还在，纸冠还在转，精选嘛——想来想去，还是可以想的。」",
      choices: [
        { id: "morning-wish-end", label: "陪她站到风停。", next: "birch.ending-morning" },
      ],
    },
    "birch.ending-morning": {
      id: "birch.ending-morning",
      title: "白桦赌约",
      role: "结局 · 清晨",
      savepoint: true,
      presentation: "blackout",
      terminal: true,
      guide: null,
      activeActorIds: ["birch_unknowing"],
      text:
        "票投完了，精选没来。\n\n" +
        "你站在亭子里，风一吹，纸冠就转。\n\n" +
        "不知道了呐没有再追问。她把问题留在计票墙前，像把一张没有人收的票，轻轻压在桌上。\n\n" +
        "四十、六十、六十六点六。三条线画在那里，谁也没有走上去。亭子替这场赌约把没结算的部分收好了。\n\n" +
        "下一场投票，就不在这个亭子里了。",
    },
    "birch.wait": {
      id: "birch.wait",
      title: "亭外",
      role: "回访",
      savepoint: true,
      guide: { title: "白桦赌约", objective: "过几天再回亭子看看" },
      text:
        "你连着来过几天。\n\n" +
        "庄家照旧在下午出现，茶照旧续满。问起白桦，所有人都只说一句：他没来过。\n\n" +
        "亭外那条街往西，尽头是碑区。风从那边吹过来，纸冠转得比平时快。",
      choices: [
        {
          id: "wait-third-day",
          label: "第三日傍晚再来。",
          next: "birch.winner",
          set: { "birch.waiting": true },
          effects: [
            { type: "event.publish", eventType: "story.achievement", payload: { id: "birch_winner_absent", name: "赢家还没来" } },
          ],
        },
        {
          id: "wait-gap",
          label: "在截止之后、盖章之前来。",
          next: "birch.ending-gap",
          set: { "birch.ending": "gap" },
          effects: [
            { type: "event.publish", eventType: "story.achievement", payload: { id: "birch_gap", name: "空档" } },
          ],
        },
        { id: "wait-back", label: "回亭子里坐坐。", next: "birch.pavilion" },
      ],
    },
    "birch.winner": {
      id: "birch.winner",
      title: "白桦赌约",
      role: "结局 · 赢家",
      savepoint: true,
      presentation: "cg",
      terminal: true,
      guide: null,
      text:
        "第三日傍晚，街的尽头出现一个背影。\n\n" +
        "肩上挎着刻刀袋，走得很慢，没有回头。他没有靠近亭子，也没有停在白桦那只茶杯前。\n\n" +
        "亭子里，那只始终满着的杯子，水面轻轻晃了一下。\n\n" +
        "他赢了，他没有来领。他把名字留在别人的转述里，把手留在碑上。",
    },
    "birch.ending-gap": {
      id: "birch.ending-gap",
      title: "白桦赌约",
      role: "结局 · 空档",
      savepoint: true,
      presentation: "blackout",
      terminal: true,
      guide: null,
      text:
        "你挑了一个特别的时候回来：截止之后，盖章之前。\n\n" +
        "计票墙上的十五张票笺全翻成了白纸。赌箱的锁孔透出一点光。亭子里没有庄家，没有监票人，也没有那个清晨来问的人。\n\n" +
        "十四个半小时里，亭子只做一件事：等一场已经结束、却还没有盖章的结果。\n\n" +
        "风照常穿过四根柱子。纸冠垂着，像挂在衣架上。",
    },
  },
};
