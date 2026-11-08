import type { StoryDefinition } from "../../../stories/types";

/**
 * 支线剧情：《解放了》
 *
 * 潮水涨上来的那个傍晚，城门边的钥匙铺亮了灯。
 * 铺子的主人茯与只在假期回来，钥匙全部免费，钥匙墙一年比一年高。
 * 玩家可以拿走一把钥匙、听完人群的议论、在夜里见到茯与，
 * 替他向三位「曾经是孩子」的居民各取一句过时的话，刻一把新钥匙挂上墙。
 *
 * 结局：收好这个假期 / 投一封信 / 不凑热闹 / 不翻木牌 / 下个假期再回来。
 */
export const LIBERATION_STORY: StoryDefinition = {
  schemaVersion: 1,
  definitionVersion: 1,
  id: "side.liberation.day",
  title: "解放了",
  startNode: "liberation.arrival",
  entryActorId: "liberation_herald",

  interactions: [
    { actorId: "liberation_herald", nodeId: "liberation.arrival", choiceId: "listen" },
  ],

  buildingInteractions: [
    { buildingId: "liberation_keyshop", nodeId: "liberation.arrival", choiceId: "listen" },
  ],

  nodes: {
    "liberation.arrival": {
      id: "liberation.arrival",
      title: "城门",
      role: "序章",
      savepoint: true,
      guide: { title: "解放了", objective: "听听城门边那个孩子在喊什么" },
      activeActorIds: ["liberation_herald"],
      text:
        "傍晚的城门边，一个孩子从坡上跑下来，鞋跟踩得石板直响。\n\n「涨潮了——钥匙铺的灯亮了——」\n\n他一边跑一边喊，声音传过整条街。有人从铺子里探出头，有人放下手里的活。\n\n孩子跑到你面前，停下来喘气，认真地看着你。\n\n「你也听见了吧？今晚，铺子有人。」",
      choices: [
        { id: "listen", label: "听听他在喊什么。", next: "liberation.rumor" },
        { id: "go-shop", label: "直接去钥匙铺。", next: "liberation.shop-door" },
        { id: "leave", label: "不凑这个热闹。", next: "liberation.ending-early" },
      ],
    },

    "liberation.rumor": {
      id: "liberation.rumor",
      title: "报信的孩子",
      savepoint: false,
      activeActorIds: ["liberation_herald"],
      text:
        "「钥匙铺，城门西边那间。木牌翻过来了。」孩子用手比划着，「我刚从那边跑过来，灯是亮的，门虚掩着。」\n\n「每年涨潮的时候，铺子都会开一阵。有时候有人，有时候没人。没人的时候，钥匙也照样拿。」\n\n他顿了顿，像是想起什么。\n\n「牌子上写着，解放了。」",
      choices: [
        { id: "ask-who", label: "铺子的主人是谁？", next: "liberation.herald-who" },
        { id: "ask-tide", label: "涨潮是什么意思？", next: "liberation.tide-talk" },
      ],
    },

    "liberation.herald-who": {
      id: "liberation.herald-who",
      title: "报信的孩子",
      savepoint: false,
      activeActorIds: ["liberation_herald"],
      text:
        "「叫茯与。」孩子说这个名字的时候很自然，像在说一个每年都会见到的邻居，「平时不在城里，涨潮才回来。住满一个假期，又走。」\n\n「他不让人送。走的时候也不说什么时候回来，只说明年。」\n\n孩子看了看城门的方向。\n\n「你要是去，帮我看看货架第二层。我去年拿过一把，今年想换一把新的。」",
      choices: [
        { id: "to-shop", label: "去钥匙铺看看。", next: "liberation.shop-door" },
        { id: "ask-key", label: "钥匙是干什么用的？", next: "liberation.tide-talk" },
      ],
    },

    "liberation.tide-talk": {
      id: "liberation.tide-talk",
      title: "报信的孩子",
      savepoint: false,
      activeActorIds: ["liberation_herald"],
      text:
        "「岛在很远的地方。一年里大半时间，岛和城之间隔着水，人过不来。」孩子想了想，「但门一直都在。」\n\n「潮水涨上来的时候，路就接上了。铺子开门，钥匙也开门。」\n\n他踢了踢脚边一颗小石子。\n\n「茯与说，回家的路不用记，回家的日子才要记。」",
      choices: [
        { id: "to-shop", label: "去钥匙铺看看。", next: "liberation.shop-door" },
      ],
    },

    "liberation.shop-door": {
      id: "liberation.shop-door",
      title: "钥匙铺",
      role: "第一幕 · 无人的铺子",
      savepoint: true,
      guide: { title: "解放了", objective: "读一读木牌上的告别信，或看看钥匙墙" },
      text:
        "城门西边的小铺比想象中旧。门框上挂着一块木牌，字是刻上去的，边缘被潮气磨得发白。\n\n铺门虚掩着，里面没有人。货架上摆满样式古旧的钥匙，每一把下面都系着一小截麻绳。\n\n侧墙整面都是钥匙，密密地挂着，像一面没有尽头的墙。\n\n木牌正面写着几行字，风一吹，轻轻晃。",
      choices: [
        { id: "read-sign", label: "读木牌上的信。", next: "liberation.read-sign" },
        { id: "look-wall", label: "看看侧墙的钥匙。", next: "liberation.look-wall" },
        { id: "leave-early", label: "转身就走。", next: "liberation.ending-early" },
      ],
    },

    "liberation.read-sign": {
      id: "liberation.read-sign",
      title: "木牌",
      savepoint: false,
      text:
        "「好了，看到这里你已经知道了，我要退城了。\n\n钥匙都在架上，随便拿，不用打招呼。每把钥匙背面刻了它能开的门——门有的时候会换锁，别怪钥匙，重新配一把就是。\n\n温馨提示：拿之前看一眼墙。墙上每一把都是一个人挂上去的。挂钥匙的人我不都认识，但他们和我上过同一座岛。\n\n涨潮的时候我会回来。下次回来，我就是老住户了。开心。\n\n——茯与」\n\n木牌下缘另有一行小字：「我在。晚上十点半以后。」",
      choices: [
        { id: "take-key", label: "拿一把钥匙。", next: "liberation.take-key" },
        { id: "look-wall", label: "先看看墙。", next: "liberation.look-wall" },
      ],
    },

    "liberation.look-wall": {
      id: "liberation.look-wall",
      title: "钥匙墙",
      savepoint: false,
      text:
        "墙上钉着七列十四行的小钩子，一共九十八格。\n\n靠近门口的十六格还能看清刻痕：名字和年份挤在一枚小小的钥匙柄上。有的钥匙亮，有的已经半锈。\n\n再往里，字迹被水汽洇开了，只剩一道道浅痕。数得出位置，数不出名字。\n\n最下面有一格空着，没有钥匙，也没有刻痕。\n\n墙脚放着一把小刷子，刷毛上沾着陈年的铜绿。",
      choices: [
        { id: "take-key", label: "拿一把钥匙。", next: "liberation.take-key" },
        { id: "join-crowd", label: "去听人群在说什么。", next: "liberation.crowd-gather" },
      ],
    },

    "liberation.take-key": {
      id: "liberation.take-key",
      title: "货架",
      savepoint: false,
      text:
        "你从货架上取下一把木柄钥匙。\n\n钥匙背面刻着一行很小的小字：「城里的门，比你想的多。」\n\n没有人拦你，也没有人收钱。货架旁边压着一张纸条：「拿之前先看墙，看完再拿。这不是规矩，是礼貌。规矩管今天，礼貌管以后。」\n\n你把钥匙收进口袋，木头还带着一点潮气。",
      choices: [
        { id: "wall-detail", label: "再走近看看墙上的旧钥匙。", next: "liberation.wall-detail" },
        { id: "join-crowd", label: "去听人群在说什么。", next: "liberation.crowd-gather" },
      ],
    },

    "liberation.wall-detail": {
      id: "liberation.wall-detail",
      title: "钥匙墙",
      savepoint: false,
      text:
        "你凑近看那些锈得最厉害的钥匙。\n\n有一把旁边的钩子上，又挂了一把新的。两把钥匙并排，新旧差了好几年，刻的是两个不同的名字。\n\n它们大概没有见过面。一个来的时候，另一个已经走了。\n\n但新钥匙的齿口，恰好对着旧钥匙锈住的方向。",
      choices: [
        { id: "join-crowd", label: "去听人群在说什么。", next: "liberation.crowd-gather" },
        { id: "wait-night", label: "在铺子门口等到夜里。", next: "liberation.night-lamp" },
      ],
    },

    "liberation.crowd-gather": {
      id: "liberation.crowd-gather",
      title: "城门口",
      role: "第一幕 · 人群",
      savepoint: true,
      guide: { title: "解放了", objective: "听听城里人怎么议论这间重新亮灯的铺子" },
      text:
        "天黑下来以后，城门口聚了十几个人。\n\n有人站在铺子外面往里头张望，有人已经拿了钥匙在手里翻来覆去地看。孩子在人缝里钻来钻去，把「解放了」三个字喊给每一个刚来的人。\n\n一个抱着菜篮的人说：「真不要钱？」\n\n旁边的人说：「去年也不要。前年也不要。」\n\n没有人先走。",
      choices: [
        { id: "hear", label: "听他们说什么。", next: "liberation.crowd-voices" },
        { id: "speak", label: "替茯与说一句。", next: "liberation.crowd-speak" },
      ],
    },

    "liberation.crowd-voices": {
      id: "liberation.crowd-voices",
      title: "人群",
      savepoint: false,
      text:
        "「钥匙真不要钱？」抱菜篮的人又问了一遍。\n\n「他什么时候回来的？」\n\n「不知道。灯先亮的。」\n\n一个年纪大些的人把钥匙举到灯下，眯着眼看背面的刻字。\n\n「拿了钥匙，门后头是什么？」\n\n没有人回答。风从城门洞里穿过去，把铺子的木牌吹得轻轻碰墙。",
      choices: [
        { id: "wait-night", label: "等到夜里，看看铺子的主人会不会回来。", next: "liberation.night-lamp" },
        { id: "leave-early", label: "不看了，回家。", next: "liberation.ending-early" },
      ],
    },

    "liberation.crowd-speak": {
      id: "liberation.crowd-speak",
      title: "人群",
      savepoint: false,
      text:
        "你开口：「门后头是什么，得自己去看。」\n\n人群安静了一瞬。抱菜篮的人转过头来看你，像是没想到有人会接这句话。\n\n「你也是来拿钥匙的？」\n\n还没等你回答，铺子里的灯忽然亮了一格。\n\n不是门口那盏，是更里面的一盏。有人从货架后面绕出来，手里拿着一把还没刻完的钥匙。",
      choices: [
        { id: "wait-night", label: "等到夜里，看看铺子的主人会不会回来。", next: "liberation.night-lamp" },
      ],
    },

    "liberation.night-lamp": {
      id: "liberation.night-lamp",
      title: "钥匙铺 · 夜",
      role: "第二幕 · 22:30",
      savepoint: true,
      guide: { title: "解放了", objective: "在钥匙铺里和茯与说说话" },
      activeActorIds: ["liberation_fuyu"],
      text:
        "夜里十点半，铺子门口那盏灯终于亮了。\n\n一个年轻人从货架后面走出来，袖口沾着木屑，手里捏着一把刻到一半的钥匙。他看见门口聚着的人，先愣了一下，然后把刻刀放下。\n\n人群没有一拥而上，反而往后退了半步。\n\n他擦了擦手，朝你这边点了点头。",
      choices: [
        { id: "approach", label: "走过去。", next: "liberation.fuyu-first", autoAdvance: true },
      ],
    },

    "liberation.fuyu-first": {
      id: "liberation.fuyu-first",
      title: "茯与",
      savepoint: true,
      activeActorIds: ["liberation_fuyu"],
      text:
        "「哦，客人。这个点还在外面逛的，要么是守夜人，要么是没写完作业的。」\n\n他把刻刀在围裙上蹭了蹭。\n\n「温馨提示：我猜你是前者。」\n\n铺子里很安静。货架上的钥匙在灯下投出细细的影子，墙上的旧钥匙一动不动。",
      choices: [
        { id: "topic-keys", label: "这些钥匙都是干什么的？", next: "liberation.topic-keys" },
        { id: "topic-away", label: "你平时去哪儿了？", next: "liberation.topic-away" },
        { id: "topic-names", label: "墙上那些名字是谁？", next: "liberation.topic-names" },
        { id: "shop", label: "详细版钥匙多少钱？", next: "liberation.shop-buy" },
        { id: "code", label: "「2007。」", next: "liberation.code-2007" },
      ],
    },

    "liberation.code-2007": {
      id: "liberation.code-2007",
      title: "茯与",
      savepoint: false,
      activeActorIds: ["liberation_fuyu"],
      text:
        "茯与警觉地看了看四周，从袖子里摸出一把小钥匙。\n\n「……你还知道这个。行，五个人一起喊才算数的，现在就你一个。」\n\n他把钥匙举到灯下给你看了一眼，又收了回去。\n\n「先给你看一眼——下次带朋友来，我兑现。」\n\n如果你再问一次，他只会伸出四根手指：「五个人。还差四个。」",
      choices: [
        { id: "back", label: "把钥匙还给他。", next: "liberation.fuyu-first" },
      ],
    },

    "liberation.topic-keys": {
      id: "liberation.topic-keys",
      title: "茯与",
      savepoint: false,
      activeActorIds: ["liberation_fuyu"],
      text:
        "「开岛上各个角落的门。」茯与把手里那把半成品的钥匙转了半圈，「那座岛你知道吧，一年里大部分时间隔着水，人过不来——但门一直都在。」\n\n「钥匙有个毛病：会过期。不是质量差，是锁那头一直在换。」\n\n他把钥匙放回货架，手指在木柄上敲了两下。\n\n「温馨提示：过期别扔，挂墙上。锈钥匙是勋章，不是废铁。」",
      choices: [
        { id: "why-not-sell", label: "为什么不当废铁卖掉？", next: "liberation.topic-names" },
        { id: "away", label: "你平时去哪儿了？", next: "liberation.topic-away" },
        { id: "stop", label: "先不问了。", next: "liberation.fuyu-first" },
      ],
    },

    "liberation.topic-away": {
      id: "liberation.topic-away",
      title: "茯与",
      savepoint: false,
      activeActorIds: ["liberation_fuyu"],
      text:
        "「岛上。上课，写作业，睡觉。周一到周六十点半到十一点半有空——前提是作业做完了，周日看几点醒。」\n\n你问他岛上有没有别的地方可去。他第一次停下来，用刻刀轻轻敲了敲桌角。\n\n「有。但是别的门都锁着，钥匙要么很贵，要么得自己去配。配钥匙很花时间——我配过一副，用了很久，很值。」\n\n「你不想留在城里吗？」\n\n「想。但是潮水不听我的。」他看着门口那盏灯，「温馨提示：潮水也不听任何人的，所以不用替我难过。」",
      choices: [
        { id: "names", label: "墙上那些名字是谁？", next: "liberation.topic-names" },
        { id: "shop", label: "详细版钥匙多少钱？", next: "liberation.shop-buy" },
      ],
    },

    "liberation.topic-names": {
      id: "liberation.topic-names",
      title: "茯与",
      savepoint: true,
      activeActorIds: ["liberation_fuyu"],
      text:
        "「一代一代的岛民。你看这把——」茯与抬手点了点墙上一把锈钥匙。\n\n「挂上来的时候还能用，后来岛换了锁，就锈了。再后来有个孩子配了把新的挂旁边。他们俩没见过面。」\n\n他把一把旧钥匙从钩子上取下来，擦去背面的灰。\n\n「我走的时候，把我配过的钥匙全留下了。特别提示：钥匙只管开门，开门之后看什么、看多久，是自己的事。」\n\n他把钥匙挂回去，忽然补了一句：「沉迷其间，你不用怀疑，我在谋财害命。」说完自己挠了挠头，「这句话是我以前写的，现在读还是很凶。但我想不出更好的说法了。」",
      choices: [
        { id: "offer-help", label: "我能帮你挂一把新的吗？", next: "liberation.task-offer" },
        { id: "just-look", label: "只是看看。", next: "liberation.shop-buy" },
      ],
    },

    "liberation.task-offer": {
      id: "liberation.task-offer",
      title: "茯与",
      savepoint: false,
      activeActorIds: ["liberation_fuyu"],
      text:
        "茯与看了你一会儿，把刻刀放下。\n\n「可以。墙上的规矩：新钥匙上墙，得带三句话——从城里三个『曾经是孩子』的人那儿取，过时的话也算话。」\n\n他从抽屉里摸出一张空白的小纸条，推到你面前。\n\n「温馨提示：他们说话都很好听，但记下来的才是真的。」",
      choices: [
        {
          id: "accept",
          label: "我去取三句话。",
          next: "liberation.task-accept",
          set: {
            "liberation.task.started": true,
            "liberation.saying.elder": false,
            "liberation.saying.stall": false,
            "liberation.saying.child": false,
          },
        },
        { id: "later", label: "今晚先不了。", next: "liberation.shop-buy" },
      ],
    },

    "liberation.task-accept": {
      id: "liberation.task-accept",
      title: "茯与",
      savepoint: true,
      guide: { title: "涨潮之前", objective: "向三位「曾经是孩子」的居民各取一句过时的话" },
      activeActorIds: ["liberation_fuyu"],
      text:
        "「码头闸房、商店街的杂货摊、老城区的桥边。」茯与一边说一边在小纸条上画了三个圈，「顺序随你，他们不赶时间。」\n\n「话取回来，我教你刻。刻完挂墙上——看准第 99 格，空的那格。」\n\n他把纸条折好递给你。\n\n「不急。过时的话不着急交——它们已经等了好几年了，不差这一个晚上。」",
      choices: [
        { id: "start", label: "出门去取话。", next: "liberation.gather-hub" },
      ],
    },

    "liberation.gather-hub": {
      id: "liberation.gather-hub",
      title: "城里",
      role: "第二幕 · 三句过时的话",
      savepoint: true,
      guide: { title: "涨潮之前", objective: "向闸房老人、杂货摊的大人、桥边的小孩各取一句过时的话" },
      text:
        "夜里的城比白天安静。潮声从水岸那边传过来，一阵一阵，不紧不慢。\n\n小纸条上有三个圈。你可以在三个地方之间来回走，没有人会催你。\n\n走到哪一处，都有一句已经用不上的话在等着。",
      choices: [
        {
          id: "go-elder",
          label: "去码头闸房。",
          next: "liberation.visit-elder",
          availableWhen: [{ type: "flag.equals", flagId: "liberation.saying.elder", value: false }],
        },
        {
          id: "go-stall",
          label: "去商店街的杂货摊。",
          next: "liberation.visit-stall",
          availableWhen: [{ type: "flag.equals", flagId: "liberation.saying.stall", value: false }],
        },
        {
          id: "go-child",
          label: "去老城区的桥边。",
          next: "liberation.visit-child",
          availableWhen: [{ type: "flag.equals", flagId: "liberation.saying.child", value: false }],
        },
        {
          id: "return-shop",
          label: "三句话都拿到了，回铺子。",
          next: "liberation.return-shop",
          availableWhen: [
            { type: "flag.equals", flagId: "liberation.saying.elder", value: true },
            { type: "flag.equals", flagId: "liberation.saying.stall", value: true },
            { type: "flag.equals", flagId: "liberation.saying.child", value: true },
          ],
        },
      ],
    },

    "liberation.visit-elder": {
      id: "liberation.visit-elder",
      title: "闸房老人",
      savepoint: false,
      activeActorIds: ["liberation_elder"],
      text:
        "栈桥闸口的边房里，一个老人正在卷缆绳。绳子上还沾着水，一圈一圈盘得很齐。\n\n「找我拿话？我这儿只有旧话。」他把绳子头压好，慢慢直起腰，「我那条路，走的时候好好的，第二年就没了。」\n\n他笑了一下，像是说起一件早就不疼的旧事。\n\n「门一直有，就是锁老换。我如今不配钥匙了——我改成记路。」",
      choices: [
        { id: "why-remember", label: "为什么记路不配钥匙？", next: "liberation.elder-saying" },
        { id: "back", label: "先走了。", next: "liberation.gather-hub" },
      ],
    },

    "liberation.elder-saying": {
      id: "liberation.elder-saying",
      title: "闸房老人",
      savepoint: false,
      activeActorIds: ["liberation_elder"],
      text:
        "「钥匙是给要开门的人的。我现在只在门口坐坐。坐着不用钥匙，用眼睛。」\n\n他把最后一段缆绳收进箱子，盖好。\n\n「路忘得慢一点。这就是我记路的意思。」\n\n他把这句话说得很慢，够你一字一字写下来。\n\n「写好了？写好了就走吧。得到的话不用谢，旧话不值钱。」",
      choices: [
        {
          id: "write-elder",
          label: "记下这句话。",
          next: "liberation.gather-hub",
          set: { "liberation.saying.elder": true },
        },
      ],
    },

    "liberation.visit-stall": {
      id: "liberation.visit-stall",
      title: "杂货摊的大人",
      savepoint: false,
      activeActorIds: ["liberation_stallkeeper"],
      text:
        "商店街的杂货摊还没收。一个大人蹲在摊后，把货箱一只只码齐，箱角都对着同一条线。\n\n「过时的话？」他抬头看了你一眼，手上的活没停，「我补的那条，撑了两年。够本了——一条路能送一批人过河，就算它自己沉了，也算到岸。」\n\n他拍了拍最上面那只箱子。\n\n「我这摊上的东西全是这样：不是新的，是还没沉的。」",
      choices: [
        { id: "still-visit", label: "你还回岛上看吗？", next: "liberation.stall-saying" },
        { id: "back", label: "先走了。", next: "liberation.gather-hub" },
      ],
    },

    "liberation.stall-saying": {
      id: "liberation.stall-saying",
      title: "杂货摊的大人",
      savepoint: false,
      activeActorIds: ["liberation_stallkeeper"],
      text:
        "「不回了。我留在这儿，专门告诉后来的：哪条路沉了，哪条还没。」\n\n他把最后一箱货搬到摊子底下，用一块旧布盖好。\n\n「这活儿不挣钱，但是体面。」\n\n说完他朝你手里的纸条抬了抬下巴。\n\n「记这句吧。哪条路沉了，哪条还没——这话比我的货耐放。」",
      choices: [
        {
          id: "write-stall",
          label: "记下这句话。",
          next: "liberation.gather-hub",
          set: { "liberation.saying.stall": true },
        },
      ],
    },

    "liberation.visit-child": {
      id: "liberation.visit-child",
      title: "桥边的小孩",
      savepoint: false,
      activeActorIds: ["liberation_child"],
      text:
        "老城区的桥边，一个小孩趴在石栏上写作业。听见脚步声，立刻警觉地合上本子。\n\n「……找我？」\n\n听完来意，他又把本子打开，笔尖在纸上顿了顿。\n\n「我的还没过时呢！」他压低声音，左右看了看，「……快了。所以趁现在多用几次，用坏为止，不亏。」\n\n忽然又认真起来：「你别记下来啊，这是我私藏的。」",
      choices: [
        { id: "waste", label: "用坏了不可惜吗？", next: "liberation.child-saying" },
        { id: "back", label: "先走了。", next: "liberation.gather-hub" },
      ],
    },

    "liberation.child-saying": {
      id: "liberation.child-saying",
      title: "桥边的小孩",
      savepoint: false,
      activeActorIds: ["liberation_child"],
      text:
        "「可惜的是没机会用坏的。」\n\n他在本子角落写了一行什么，写完用胳膊挡住。\n\n「你记也没用，等我放假回来，就换新的了。」\n\n过了一会儿，他又把那行字露出来一点，小声说：\n\n「……行吧。就这一句，你写轻点。」",
      choices: [
        {
          id: "write-child",
          label: "记下这句话。",
          next: "liberation.gather-hub",
          set: { "liberation.saying.child": true },
        },
      ],
    },

    "liberation.return-shop": {
      id: "liberation.return-shop",
      title: "钥匙铺",
      role: "第三幕 · 刻一把新钥匙",
      savepoint: true,
      guide: { title: "涨潮之前", objective: "把三句话交给茯与" },
      activeActorIds: ["liberation_fuyu"],
      text:
        "你回到钥匙铺的时候，茯与还在刻同一把钥匙。灯芯短了一截，他用剪刀修了修。\n\n「三句话拿到了几句？」他接过纸条，一行一行看，看得比递纸条的人还慢。\n\n「……第一句老成，第二句划算，第三句——」他停了停，「像我。」",
      choices: [
        {
          id: "give-lines",
          label: "把三句话都交给他。",
          next: "liberation.carve-keys",
          availableWhen: [
            { type: "flag.equals", flagId: "liberation.saying.elder", value: true },
            { type: "flag.equals", flagId: "liberation.saying.stall", value: true },
            { type: "flag.equals", flagId: "liberation.saying.child", value: true },
          ],
        },
        { id: "not-yet", label: "还差一句，我再去转转。", next: "liberation.gather-hub" },
      ],
    },

    "liberation.carve-keys": {
      id: "liberation.carve-keys",
      title: "茯与",
      savepoint: false,
      activeActorIds: ["liberation_fuyu"],
      text:
        "茯与拿起一枚新钥匙柄，把三句话各刻一行。刻痕很浅，但每一笔都收得干净。\n\n「第一句，记路。」\n\n「第二句，报路。」\n\n「第三句，趁还能用，多用几次。」\n\n他吹掉木屑，把钥匙放在灯下看了看。\n\n「都刻上了。过时的话也是话，话比路线活得长。」",
      choices: [
        {
          id: "finish-carve",
          label: "刻完最后一行。",
          next: "liberation.hang-key",
          set: { "liberation.task.done": true },
          effects: [
            {
              type: "event.publish",
              eventType: "story.achievement",
              payload: { id: "liberation_old_words", name: "过时的话也是话" },
            },
          ],
        },
      ],
    },

    "liberation.hang-key": {
      id: "liberation.hang-key",
      title: "钥匙墙 · 第 99 格",
      savepoint: true,
      activeActorIds: ["liberation_fuyu"],
      text:
        "钥匙墙最下面空着的那一格，钩子是新的。\n\n茯与把刻好的钥匙递给你。\n\n「挂的时候看准第 99 格——空的那格。墙认数字，不认力气。」\n\n你站上脚凳，钥匙在灯下晃了一下。墙上的旧钥匙没有声音，整面墙像在等你。",
      choices: [
        {
          id: "hang",
          label: "把钥匙挂上第 99 格。",
          next: "liberation.farewell",
          set: { "liberation.key.hung": true },
          effects: [
            {
              type: "event.publish",
              eventType: "story.achievement",
              payload: { id: "liberation_wall_higher", name: "墙又高了一点" },
            },
          ],
        },
        { id: "shop-first", label: "先问详细版钥匙的事。", next: "liberation.shop-buy" },
      ],
    },

    "liberation.shop-buy": {
      id: "liberation.shop-buy",
      title: "茯与",
      savepoint: false,
      activeActorIds: ["liberation_fuyu"],
      text:
        "「详细版钥匙，带图纸，五十金币。」\n\n茯与把一把钥匙放到柜台上，钥匙背面刻着五扇门的位置小抄。\n\n购买按钮下面压着一行小字：「不给也可以，不强求。」\n\n他低头继续刻字，像并不在意你选哪一个。",
      choices: [
        {
          id: "pay",
          label: "付五十金币。",
          next: "liberation.buy-pay",
          set: { "liberation.paid": true },
          effects: [
            {
              type: "event.publish",
              eventType: "story.achievement",
              payload: { id: "liberation_craftsman", name: "匠人应得的报酬" },
            },
          ],
        },
        { id: "free", label: "不付，白拿。", next: "liberation.buy-free" },
      ],
    },

    "liberation.buy-pay": {
      id: "liberation.buy-pay",
      title: "茯与",
      savepoint: false,
      activeActorIds: ["liberation_fuyu"],
      text:
        "你把金币放在柜台上。茯与愣了一下。\n\n「……你真给啊。」\n\n他把金币收进抽屉，又弯腰从柜台下面摸出一小包鱼干，塞到你手里。\n\n「拿去。不算找零，就是给。」\n\n图纸在钥匙背面，字确实很丑，但五扇门的位置一个不差。",
      choices: [
        { id: "done", label: "收下鱼干。", next: "liberation.buy-done" },
      ],
    },

    "liberation.buy-free": {
      id: "liberation.buy-free",
      title: "茯与",
      savepoint: false,
      activeActorIds: ["liberation_fuyu"],
      text:
        "你没有付钱。茯与点了点头，把钥匙推过来。\n\n「嗯，白拿就好。图纸在钥匙背面，字丑，凑合看。」\n\n他说得很自然，像这本来就是他希望的选择。\n\n图纸上的五扇门一个不差。和付钱拿到的那把，一模一样。",
      choices: [
        { id: "done", label: "收下钥匙。", next: "liberation.buy-done" },
      ],
    },

    "liberation.buy-done": {
      id: "liberation.buy-done",
      title: "钥匙铺",
      savepoint: false,
      activeActorIds: ["liberation_fuyu"],
      text:
        "铺子外面的潮声比刚才近了一点。\n\n茯与把货架上最后一排钥匙盘过一遍，抬起头。\n\n「假期最后一夜了。你要是没事，陪我走到城门？」\n\n他把灯芯又修短了一截，铺子里的光暗下去，反而显得暖。",
      choices: [
        { id: "walk", label: "陪他走到城门。", next: "liberation.farewell" },
        { id: "quiet", label: "今晚就不送了。", next: "liberation.ending-quiet" },
      ],
    },

    "liberation.farewell": {
      id: "liberation.farewell",
      title: "城门",
      role: "第四幕 · 送别",
      savepoint: true,
      guide: { title: "解放了", objective: "陪茯与走到城门" },
      activeActorIds: ["liberation_fuyu"],
      text:
        "你们并肩往城门走。没有人说话。\n\n脚步声落在石板上，潮声从水岸那边一阵一阵漫过来。铺子门口的灯留在身后，越来越小。\n\n走到城门下，茯与停了一下。\n\n「钥匙我重新盘过点了。墙每年都会再高一点——好事，说明还有人挂。」\n\n他回头看了一眼铺子的方向。\n\n「下次涨潮，我还会回来。下次回来，我就是老住户了。开心。」\n\n走出两步，他又转过身，指了指铺子的木牌。\n\n「哦对。牌子的背面，出门记得翻一下。」",
      choices: [
        {
          id: "flip",
          label: "回到铺子，翻过木牌。",
          next: "liberation.sign-back",
          set: { "liberation.ending": "farewell" },
          effects: [
            {
              type: "event.publish",
              eventType: "story.achievement",
              payload: { id: "liberation_bird", name: "候鸟章" },
            },
          ],
        },
        { id: "no-flip", label: "不翻了，就这样离开。", next: "liberation.ending-quiet" },
      ],
    },

    "liberation.sign-back": {
      id: "liberation.sign-back",
      title: "木牌背面",
      role: "尾声",
      savepoint: true,
      text:
        "木牌翻过来。背面只有三个字，刻痕很深，像是用了很久的刻刀。\n\n解放了。\n\n字的下面还有一行更小的字：「我刚回来过。别担心。」\n\n铺子里的灯已经灭了。货架上的钥匙还在，墙上的钥匙也还在。潮声退得很慢。",
      choices: [
        { id: "keep", label: "把这个假期收好。", next: "liberation.ending-complete" },
        { id: "mailbox", label: "去看看门口的旧信箱。", next: "liberation.mailbox" },
        {
          id: "next-holiday",
          label: "等下个假期再回来。",
          next: "liberation.revisit-shop",
          visit: true,
          effects: [
            {
              type: "event.publish",
              eventType: "story.achievement",
              payload: { id: "liberation_returned", name: "我刚回来过" },
            },
          ],
        },
      ],
    },

    "liberation.mailbox": {
      id: "liberation.mailbox",
      title: "旧信箱",
      savepoint: false,
      text:
        "铺子门口立着一只旧信箱，铁皮上有一层薄锈。\n\n牌子写着：「给未来才看到这条消息的人。」\n\n信箱旁边还有一块小指路牌，不是给这间铺子的：「河上游高坡上，管寄给自己的。」\n\n箱口很窄，里面没有回执，也没有铃。投进去的信，要等很久才可能有回音。",
      choices: [
        { id: "write", label: "投一封短信。", next: "liberation.ending-letter" },
        { id: "close", label: "不投了。", next: "liberation.ending-complete" },
      ],
    },

    "liberation.ending-complete": {
      id: "liberation.ending-complete",
      title: "解放了",
      role: "结局 · 收好这个假期",
      savepoint: true,
      presentation: "blackout",
      terminal: true,
      guide: null,
      text:
        "你回到城里的时候，城门边的铺子已经关好了。\n\n木牌背面朝外，三个字在晨光里很清楚。\n\n有人说铺子的主人一早就随潮水走了。也有人说，灯亮到很晚，像是忘了关。\n\n你摸了摸口袋里的钥匙。它还在。\n\n有些朋友只能涨潮的时候来；但每一次来，都是真的。",
    },

    "liberation.ending-letter": {
      id: "liberation.ending-letter",
      title: "回信",
      role: "结局 · 给未来的人",
      savepoint: true,
      presentation: "document",
      terminal: true,
      guide: null,
      text:
        "你把短信投进信箱。铁皮吞下信纸，没有回执，也没有声音。\n\n很久以后，你再次进城，信箱口亮起一点微光。里面躺着一封没有署名的回信。\n\n信纸边角印着一枚很小的钥匙。\n\n最后一句写着：「我在很后面的版本里，才看到你。」\n\n你把信折好，放回信封。风从城门洞里穿过去，潮声已经退远了。",
    },

    "liberation.ending-early": {
      id: "liberation.ending-early",
      title: "城门",
      role: "结局 · 不凑热闹",
      savepoint: true,
      presentation: "blackout",
      terminal: true,
      guide: null,
      text:
        "你转身离开。身后的喊声还在继续，渐渐被人群的议论盖住。\n\n第二天你路过城门，铺子门口已经恢复成平时的样子。木牌挂着，货架开着，里面没有人。\n\n钥匙还在架上，谁都可以拿。\n\n你没有拿。也没有人追上来问你为什么。\n\n潮汐不挽留。",
    },

    "liberation.ending-quiet": {
      id: "liberation.ending-quiet",
      title: "城门",
      role: "结局 · 未翻的木牌",
      savepoint: true,
      presentation: "blackout",
      terminal: true,
      guide: null,
      text:
        "你没有陪茯与走到城门，也没有回去翻那块木牌。\n\n假期结束后的第一个清晨，铺子照常开着，货架照常满着。\n\n木牌正面还是那封告别信，背面朝着墙，看不见写了什么。\n\n你手里有一把钥匙，或者没有。门都在那里。\n\n下一次涨潮，牌子的背面还可以再翻。",
    },

    "liberation.revisit-shop": {
      id: "liberation.revisit-shop",
      title: "钥匙铺 · 下个假期",
      role: "回访 · 第 99 格之后",
      savepoint: true,
      presentation: "dialogue",
      terminal: true,
      guide: null,
      activeActorIds: ["liberation_fuyu"],
      text:
        "下个假期，你又来到城门边。铺子的灯亮着，茯与在货架后面刻钥匙。\n\n墙上的第 99 格旁边，又多了几把新钥匙。手艺一般，字很用力。\n\n「新挂的那几把，是这一届挂的。」他没抬头，「手艺一般，字很用力。」\n\n你问他这次回来待多久。\n\n「整个假期。老规矩，晚上十点半到十一点半——前提是作业写完了。岛上的作业比城里的多，这句你别告诉别人。」\n\n木牌背面那三个字下面，多了一行小字：\n\n「——第 99 格之后，又高了一点。」",
    },
  },
};
