import type { StoryDefinition } from "../../../stories/types";

/**
 * 支线剧情1：麦琪的礼物
 *
 * 改编自欧·亨利短篇小说《The Gift of the Magi》。
 * 玩家在平安夜前后于小城客栈附近遇见德拉，被卷入一对
 * 贫穷夫妻为彼此准备圣诞礼物的故事。玩家可以改善细节
 * （争取更公平的价格、选到更合适的礼物、买一顿像样的
 * 晚餐），但无法消除代价——这正是原作的核心。
 *
 * 节点命名规范：magi.<act>.<beat>
 * 旗标命名规范：magi.<subject>.<key>
 */

export const MAGI_STORY: StoryDefinition = {
  schemaVersion: 1,
  definitionVersion: 1,
  id: "side.magi.gift",
  title: "麦琪的礼物",
  startNode: "magi.start",
  entryActorId: "della",

  interactions: [
    { actorId: "della", nodeId: "magi.start", choiceId: "talk-della" },
    { actorId: "della", nodeId: "magi.della-waiting", choiceId: "talk-della-waiting" },
    { actorId: "jim", nodeId: "magi.jim-meet", choiceId: "talk-jim" },
    { actorId: "della", nodeId: "magi.eve-arrive", choiceId: "talk-della-eve" },
  ],

  buildingInteractions: [
    { buildingId: "mall_west", nodeId: "magi.wig-shop-arrival", choiceId: "enter-wig-shop" },
    { buildingId: "mall_south", nodeId: "magi.chain-shop-arrival", choiceId: "enter-chain-shop" },
    { buildingId: "guesthouse", nodeId: "magi.eve-arrive", choiceId: "enter-guesthouse-eve" },
  ],

  nodes: {
    /* ───────────────────── 第一幕：遇见德拉 ───────────────────── */

    "magi.start": {
      id: "magi.start",
      title: "德拉",
      role: "序章",
      savepoint: true,
      text: "客栈门口的台阶上坐着一个年轻女人。你路过时，她正把几枚硬币从一只手倒到另一只手，反复数了三遍。\n\n她抬起头，勉强笑了一下。「又数错了。不对，没数错。就是……太少了。」",
      guide: { title: "麦琪的礼物", objective: "在客栈门口和德拉说话" },
      choices: [
        {
          id: "talk-della",
          label: "你在数什么？",
          next: "magi.della-coins",
        },
      ],
    },

    "magi.della-coins": {
      id: "magi.della-coins",
      title: "德拉",
      savepoint: false,
      text: "「一美元八十七美分。」德拉把硬币摊在掌心给你看，像是怕你不信。「其中六十美分还是分币，攒了两个月。」\n\n她收拢手指，把硬币握紧了。「明天就是圣诞节了。我总不能什么也不送他吧？」",
      choices: [
        { id: "ask-who", label: "「他」是谁？", next: "magi.della-jim" },
        { id: "ask-plan", label: "你打算怎么办？", next: "magi.della-hair" },
      ],
    },

    "magi.della-jim": {
      id: "magi.della-jim",
      title: "德拉",
      savepoint: false,
      text: "「吉姆。我丈夫。」德拉的语气很平淡，但说名字的时候嘴角微微翘了一下。「我们在二楼租了一间房，窗户对着后巷。家具是房东留下的，缺了一条腿的餐桌他用书垫着。」\n\n她顿了顿。「他值得一件真正好的礼物。不是领带那种——是那种他每天用得上、会想起我的东西。」",
      choices: [
        { id: "continue-hair", label: "继续", next: "magi.della-hair" },
      ],
    },

    "magi.della-hair": {
      id: "magi.della-hair",
      title: "德拉",
      savepoint: true,
      text: "德拉站起来，把头发从围巾里解出来。\n\n那是一头极长的、深栗色的头发，垂下来的时候几乎盖住了她的膝盖。即便在冬天灰蒙蒙的光线下，它仍然泛着一层柔和的亮色。\n\n「这是家里唯一值钱的东西了。」她把头发重新拢到肩后，语气像在陈述一个她已反复确认过的事实。「吉姆有一块祖传金表，可他没有表链，一直只能塞在口袋里偷偷看。」",
      guide: { title: "麦琪的礼物", objective: "听德拉说完她的计划" },
      choices: [
        { id: "offer-help", label: "我陪你走一趟", next: "magi.della-accept" },
        { id: "try-dissuade", label: "吉姆不会希望你卖掉头发的", next: "magi.della-dissuade" },
      ],
    },

    "magi.della-dissuade": {
      id: "magi.della-dissuade",
      title: "德拉",
      savepoint: false,
      text: "德拉沉默了几秒。\n\n「我知道。」她说。「但你也见过他每天把表从口袋里掏出来、又赶紧塞回去的样子。每次有人问时间，他都假装不看表。你知道那是什么感觉吗？明明有一样好东西，却拿不出手。」\n\n她轻轻拍了拍自己的头发。「而且，头发会再长的。」",
      choices: [
        { id: "accept-after-dissuade", label: "……走吧，我陪你", next: "magi.della-accept" },
      ],
    },

    "magi.della-accept": {
      id: "magi.della-accept",
      title: "德拉",
      savepoint: false,
      text: "德拉的眼睛亮了一下。「真的？那……谢谢你。」\n\n她把围巾重新裹紧。「断星玄那边有一家假发店，老板人很精明，但价格公道。我们走吧。」",
      choices: [
        {
          id: "go-wig-shop",
          label: "前往断星玄（假发店）",
          next: "magi.wig-shop-arrival",
        },
      ],
    },

    /* ───────────────────── 第二幕：假发店 ───────────────────── */

    "magi.wig-shop-arrival": {
      id: "magi.wig-shop-arrival",
      title: "假发店",
      role: "第一幕",
      savepoint: true,
      text: "断星玄的假发店很小，墙上挂满了各种颜色的发套，像一个排列整齐的标本室。\n\n老板是个矮胖的中年人，戴一副金丝眼镜，看见德拉走进来，目光立刻落在她的头发上。\n\n「要卖？」他问。德拉点了点头。老板让她把头发散开，用手指捻了捻发梢，又拿到鼻子前闻了闻。\n\n「发质不错。但年底了，假发不是旺季。」他报了个价：「二十美元。」",
      guide: { title: "麦琪的礼物", objective: "在假发店帮德拉争取公平价格" },
      choices: [
        {
          id: "bargain-hard",
          label: "「这头发至少值四十。」",
          next: "magi.wig-bargain-hard",
        },
        {
          id: "bargain-soft",
          label: "「二十太少了，年底也不是理由。」",
          next: "magi.wig-bargain-soft",
        },
        {
          id: "stay-quiet",
          label: "（站在旁边，让德拉自己谈）",
          next: "magi.wig-observe",
        },
      ],
    },

    "magi.wig-bargain-hard": {
      id: "magi.wig-bargain-hard",
      title: "假发店",
      savepoint: false,
      text: "老板抬起眼皮看了你一眼，又回头看了看德拉的头发。\n\n「四十？你以为这是金线织的？」他从柜子里取出一把尺子，量了量德拉头发的长度。「长是够长，但颜色偏深，不是今年流行的浅栗色。三十，不能再多了。」\n\n德拉看了你一眼，目光里有一丝犹豫。",
      choices: [
        {
          id: "accept-thirty",
          label: "三十就三十",
          next: "magi.wig-deal-good",
          effects: [{ type: "flag.set", flagId: "magi.wig.price", value: 30 }],
        },
        {
          id: "push-further",
          label: "「三十五，我们马上成交。」",
          next: "magi.wig-deal-good",
          effects: [{ type: "flag.set", flagId: "magi.wig.price", value: 35 }],
        },
        {
          id: "back-to-twenty",
          label: "（算了，别逼太紧）",
          next: "magi.wig-deal-fair",
          effects: [{ type: "flag.set", flagId: "magi.wig.price", value: 22 }],
        },
      ],
    },

    "magi.wig-bargain-soft": {
      id: "magi.wig-bargain-soft",
      title: "假发店",
      savepoint: false,
      text: "老板哼了一声。「年底确实不是理由，但也没人冬天来买假发啊。」他想了想，在算盘上拨了几下。「二十二。这是公道价。」\n\n德拉的手指捏紧了围巾的边角。",
      choices: [
        {
          id: "accept-twentytwo",
          label: "二十二就二十二",
          next: "magi.wig-deal-fair",
          effects: [{ type: "flag.set", flagId: "magi.wig.price", value: 22 }],
        },
        {
          id: "try-thirty",
          label: "「三十，这头发真的很长。」",
          next: "magi.wig-deal-good",
          effects: [{ type: "flag.set", flagId: "magi.wig.price", value: 30 }],
        },
      ],
    },

    "magi.wig-observe": {
      id: "magi.wig-observe",
      title: "假发店",
      savepoint: false,
      text: "德拉自己开了口：「二十……能不能再加一点？」\n\n老板摇头。「年底不好卖。二十是实诚价。」德拉咬了咬嘴唇，点了点头。\n\n剪刀的声音在安静的店里格外清脆。你看着那头长发一缕一缕落在地上，像某种缓慢的仪式。",
      choices: [
        {
          id: "wig-done-fair",
          label: "继续",
          next: "magi.wig-deal-fair",
          effects: [{ type: "flag.set", flagId: "magi.wig.price", value: 20 }],
        },
      ],
    },

    "magi.wig-deal-good": {
      id: "magi.wig-deal-good",
      title: "假发店",
      savepoint: true,
      text: "老板把钞票数了两遍，递给德拉。\n\n德拉把信封装进围巾口袋里，下意识地抬手摸了摸后脑勺——那里现在只剩一层短短的发茬。她愣了一下，然后笑了起来，笑得眼眶有点红。\n\n「走吧。」她说。「金月店那边应该有表链卖。」",
      guide: { title: "麦琪的礼物", objective: "陪德拉去金月店挑选表链" },
      choices: [
        {
          id: "go-chain-shop",
          label: "前往金月店（珠宝店）",
          next: "magi.chain-shop-arrival",
        },
      ],
    },

    "magi.wig-deal-fair": {
      id: "magi.wig-deal-fair",
      title: "假发店",
      savepoint: true,
      text: "老板把零钱和几张钞票一起递过来。德拉数了数，收进口袋。\n\n她站在镜子前看了一眼自己——短发让她整个人的轮廓都变了，像一个陌生人。她深吸一口气，转身面对你。\n\n「够买一条好表链了。走吧，金月店那边应该有。」",
      guide: { title: "麦琪的礼物", objective: "陪德拉去金月店挑选表链" },
      choices: [
        {
          id: "go-chain-shop-fair",
          label: "前往金月店（珠宝店）",
          next: "magi.chain-shop-arrival",
        },
      ],
    },

    /* ───────────────────── 第三幕：珠宝店 ───────────────────── */

    "magi.chain-shop-arrival": {
      id: "magi.chain-shop-arrival",
      title: "金月店",
      role: "第二幕",
      savepoint: true,
      text: "金月店的玻璃柜里摆满了各种表链。德拉的手指在柜面上慢慢移动，像在一条河流上寻找一颗特定的石头。\n\n「这三条，」她指给老板看，「能拿出来吗？」\n\n三条表链并排放在绒布上：一条镀金的，花纹繁复，在灯光下很闪亮；一条银色的，链节很粗，看起来结实但笨重；最后一条白金的，朴素到几乎没有装饰，但每一节都打磨得像镜面。",
      guide: { title: "麦琪的礼物", objective: "帮德拉挑选一条适合吉姆的表链" },
      choices: [
        {
          id: "suggest-simple",
          label: "「白金那条，最配吉姆的表。」",
          next: "magi.chain-simple",
        },
        {
          id: "suggest-fancy",
          label: "「镀金那条挺好看的。」",
          next: "magi.chain-fancy",
        },
        {
          id: "let-della-choose",
          label: "「你自己觉得呢？」",
          next: "magi.chain-let-her",
        },
      ],
    },

    "magi.chain-simple": {
      id: "magi.chain-simple",
      title: "金月店",
      savepoint: false,
      text: "德拉把白金表链拿在手里掂了掂。链节在指缝间滑过，发出细微的、像呼吸一样的声响。\n\n「就是它了。」她说。语气很轻，但很确定。「吉姆的表是老式的，表壳上有细纹。这条链子不抢眼，但配上去一定刚好。」\n\n她问了价。老板报了一个数字，德拉的手指在口袋里捏了捏那几张钞票，然后点了一下头。",
      choices: [
        {
          id: "buy-simple",
          label: "买下白金表链",
          next: "magi.chain-buy",
          effects: [{ type: "flag.set", flagId: "magi.chain.choice", value: "simple" }],
        },
      ],
    },

    "magi.chain-fancy": {
      id: "magi.chain-fancy",
      title: "金月店",
      savepoint: false,
      text: "德拉把镀金表链拿起来看了看，又放下了。\n\n「太花了。吉姆不是那种人。」她把表链推回柜面上，白金的那个被她的指尖碰了一下，在绒布上微微转了个角度。\n\n「……还是这条。」",
      choices: [
        {
          id: "buy-simple-after-fancy",
          label: "买下白金表链",
          next: "magi.chain-buy",
          effects: [{ type: "flag.set", flagId: "magi.chain.choice", value: "simple" }],
        },
      ],
    },

    "magi.chain-let-her": {
      id: "magi.chain-let-her",
      title: "金月店",
      savepoint: false,
      text: "德拉没有犹豫太久。她的目光从三条表链上扫过，最后落在白金那条上，停住了。\n\n「这一条。」她说，声音比之前任何一刻都要平静。「不贵，也不便宜。刚好。」\n\n她付了钱，把装表链的盒子小心地放进围巾口袋，和那几张剩余的钞票放在一起。",
      choices: [
        {
          id: "buy-simple-let-her",
          label: "继续",
          next: "magi.chain-buy",
          effects: [{ type: "flag.set", flagId: "magi.chain.choice", value: "simple" }],
        },
      ],
    },

    "magi.chain-buy": {
      id: "magi.chain-buy",
      title: "德拉",
      role: "第二幕 · 结",
      savepoint: true,
      text: "出了金月店，德拉在门口站了一会儿。风把她短短的碎发吹到额前，她伸手别到耳后，动作还习惯性地往长发该在的位置够了一下，然后落了空。\n\n她笑了一下，然后突然紧张地拉住你的袖子。\n\n「拜托你——」她压低声音，「吉姆还不知道我卖了头发。他……可能不会喜欢。但我不知道该怎么跟他说。你能先帮我保密吗？」",
      guide: { title: "麦琪的礼物", objective: "决定是否替德拉保守秘密" },
      choices: [
        {
          id: "keep-della-secret",
          label: "「放心，我不会说的。」",
          next: "magi.della-secret-kept",
          effects: [{ type: "flag.set", flagId: "magi.della.secretKept", value: true }],
        },
        {
          id: "hint-della-secret",
          label: "「吉姆迟早会知道的。」",
          next: "magi.della-secret-hint",
          effects: [{ type: "flag.set", flagId: "magi.della.secretKept", value: false }],
        },
      ],
    },

    "magi.della-secret-kept": {
      id: "magi.della-secret-kept",
      title: "德拉",
      savepoint: false,
      text: "德拉松了口气。「谢谢你。」\n\n她往客栈的方向看了看。「我得先回去准备晚餐。如果你下午在城里逛逛，说不定会遇到吉姆——他今天在帮忙跑腿。」\n\n她转身往回走，走了几步又回头：「对了，如果你看到他……什么都别说，好吗？」",
      choices: [
        {
          id: "go-find-jim",
          label: "在城里走走",
          next: "magi.della-waiting",
          effects: [{ type: "event.publish", eventType: "magi.della.secret.kept" }],
        },
      ],
    },

    "magi.della-secret-hint": {
      id: "magi.della-secret-hint",
      title: "德拉",
      savepoint: false,
      text: "德拉咬了咬嘴唇。「我知道……但我至少想在送他礼物的时候亲口跟他说。不是从别人嘴里听到这件事。」\n\n她往客栈方向看了看。「我先回去准备晚餐了。如果遇到吉姆……拜托，什么都别说。」\n\n她的背影消失在巷口。你在街上站了一会儿，决定随便走走。",
      choices: [
        {
          id: "go-find-jim-hint",
          label: "在城里走走",
          next: "magi.della-waiting",
          effects: [{ type: "event.publish", eventType: "magi.della.secret.hint" }],
        },
      ],
    },

    "magi.della-waiting": {
      id: "magi.della-waiting",
      title: "街道",
      savepoint: true,
      text: "你沿着主街往报摊方向走去。\n\n路过一家杂货铺的时候，你看见一个年轻男人站在橱窗前。他穿着一件洗得发白的旧外套，正盯着橱窗里的一排梳子出神。\n\n他注意到你的目光，有些不自在地把视线移开，然后又忍不住回头看了两眼。",
      guide: { title: "麦琪的礼物", objective: "和那个在橱窗前的男人说话" },
      choices: [
        {
          id: "talk-jim",
          label: "搭话",
          next: "magi.jim-meet",
        },
      ],
    },

    /* ───────────────────── 第四幕：遇见吉姆 ───────────────────── */

    "magi.jim-meet": {
      id: "magi.jim-meet",
      title: "吉姆",
      role: "第三幕",
      savepoint: true,
      text: "「啊，你好。」男人转过身来。他有一张瘦削的、略显疲惫的脸，但眼神很温和。\n\n「我叫吉姆。就住那边——客栈二楼。」他朝客栈方向指了指，然后不自觉地又看了一眼橱窗。\n\n橱窗里有三组梳子。最贵的那组是玳瑁色的，带贝壳的光泽，标价刚好是一个吉姆这样的年轻人一个月能攒下的数目。",
      guide: { title: "麦琪的礼物", objective: "和吉姆聊聊" },
      choices: [
        { id: "ask-combs", label: "在看梳子？", next: "magi.jim-combs" },
        { id: "ask-watch", label: "你口袋里那是……金表？", next: "magi.jim-watch-reveal" },
      ],
    },

    "magi.jim-combs": {
      id: "magi.jim-combs",
      title: "吉姆",
      savepoint: false,
      text: "吉姆的脸微微红了。\n\n「是给我妻子看的。她——德拉——之前在橱窗前站了很久，就是看这组玳瑁梳。她每天路过都会看一眼。」\n\n他叹了口气。「但我们现在……」他没说完，把目光移向街对面。\n\n「我攒了一点钱。但还差不少。」",
      choices: [
        { id: "ask-about-watch", label: "你那块金表呢？", next: "magi.jim-watch-reveal" },
        { id: "suggest-combs", label: "玳瑁那组确实最好看", next: "magi.jim-comb-choose" },
      ],
    },

    "magi.jim-watch-reveal": {
      id: "magi.jim-watch-reveal",
      title: "吉姆",
      savepoint: false,
      text: "吉姆下意识把手揣进兜里，然后又掏了出来。\n\n金表躺在掌心里。表壳上有一圈细致的纹路，已经有些磨损了，但表盘依然光洁。\n\n「祖传的。」他说。「我爷爷给我爸，我爸给我。一直没舍得卖。」\n\n他沉默了一会儿。「但如果卖掉它……刚好够买那组梳子。」",
      choices: [
        { id: "jim-sell-watch", label: "你真的要卖掉它？", next: "magi.jim-sell-decision" },
        { id: "jim-fetch-watch", label: "表不是送去清洗了吗？", next: "magi.jim-fetch" },
      ],
    },

    "magi.jim-fetch": {
      id: "magi.jim-fetch",
      title: "吉姆",
      savepoint: false,
      text: "吉姆点头。「对，送去金月店那边清洗了。本来说今天下午取。」他苦笑了一下。「其实我昨天就想好了。取回来就直接卖给那边收旧表的，价格虽然低一点，但今天之内能拿到钱。」\n\n他看了看天色。「如果你不介意……能陪我走一趟吗？我一个人取回来，犹豫一下可能就舍不得卖了。」",
      choices: [
        {
          id: "go-with-jim",
          label: "陪你走一趟",
          next: "magi.jim-fetch-back",
          effects: [{ type: "flag.set", flagId: "magi.jim.helped", value: true }],
        },
        {
          id: "let-jim-go-alone",
          label: "你自己去吧",
          next: "magi.jim-fetch-back",
          effects: [{ type: "flag.set", flagId: "magi.jim.helped", value: false }],
        },
      ],
    },

    "magi.jim-sell-decision": {
      id: "magi.jim-sell-decision",
      title: "吉姆",
      savepoint: false,
      text: "吉姆把表合在手心里，拇指摩挲着表壳上的纹路。\n\n「我爷爷说过一句话：表是给活着的人用的，不是供着的。」他轻声说。\n\n他抬起头。「你认识德拉吗？不，应该不认识。她——她有一头很漂亮的头发，每次路过这家店都会停下来看梳子。我总想，等有钱了，一定要买给她。」\n\n「可是我们一直没什么钱。」",
      choices: [
        { id: "jim-sell-confirm", label: "那就卖掉它", next: "magi.jim-sell-done" },
        { id: "jim-fetch-alt", label: "表不是在清洗吗？", next: "magi.jim-fetch" },
      ],
    },

    "magi.jim-fetch-back": {
      id: "magi.jim-fetch-back",
      title: "吉姆",
      savepoint: false,
      text: "吉姆把金表拿在手里翻来覆去看了很久。最终，他长出一口气，走进旁边那家收旧表的铺子。\n\n几分钟以后他出来了，口袋里多了几张钞票，手里空了。\n\n「走吧。」他说，声音有点哑。「去买那组梳子。」",
      choices: [
        { id: "buy-combs", label: "去买梳子", next: "magi.jim-comb-choose" },
      ],
    },

    "magi.jim-sell-done": {
      id: "magi.jim-sell-done",
      title: "吉姆",
      savepoint: false,
      text: "吉姆把金表放进一个旧绒布袋里，走进旁边收旧表的铺子。\n\n他出来的时候，表情很平静，但两手空空。\n\n「够了。」他拍了拍口袋。「去买梳子吧。」",
      choices: [
        { id: "buy-combs-after-sell", label: "去买梳子", next: "magi.jim-comb-choose" },
      ],
    },

    "magi.jim-comb-choose": {
      id: "magi.jim-comb-choose",
      title: "杂货铺",
      savepoint: true,
      text: "吉姆站在橱窗前，目光在三组梳子之间游移。\n\n玳瑁色的那组在灯光下泛着温润的光泽，梳背上嵌着细小的贝壳纹路。另外两组——木质的和塑料的——虽然便宜得多，但怎么看都少了点什么。\n\n「德拉一直看的就是那组玳瑁的。」吉姆说。他的声音像是在说服自己。",
      guide: { title: "麦琪的礼物", objective: "帮吉姆选一组梳子" },
      choices: [
        {
          id: "pick-tortoise",
          label: "「就玳瑁那组，她一定会喜欢。」",
          next: "magi.jim-comb-bought",
          effects: [
            { type: "flag.set", flagId: "magi.jim.combChoice", value: "tortoise" },
          ],
        },
        {
          id: "pick-wood",
          label: "「木梳也挺好的，省下来的钱……」",
          next: "magi.jim-comb-wood",
        },
      ],
    },

    "magi.jim-comb-wood": {
      id: "magi.jim-comb-wood",
      title: "杂货铺",
      savepoint: false,
      text: "吉姆看了看木梳，摇了摇头。\n\n「不。德拉看过太多次那组玳瑁的了。如果买别的，她会知道我在敷衍。」\n\n他回头对店老板说：「玳瑁那组，麻烦包起来。」",
      choices: [
        {
          id: "buy-tortoise-after-wood",
          label: "继续",
          next: "magi.jim-comb-bought",
          effects: [
            { type: "flag.set", flagId: "magi.jim.combChoice", value: "tortoise" },
          ],
        },
      ],
    },

    "magi.jim-comb-bought": {
      id: "magi.jim-comb-bought",
      title: "吉姆",
      savepoint: true,
      text: "店老板把梳子包好，系上了一条红色细绳。吉姆接过纸包，小心地放进外套内侧口袋里。\n\n他站在店门口，拍了拍胸口确认纸包还在，然后突然转向你。\n\n「有件事……拜托你。」他压低声音，表情变得认真起来。「德拉不知道我卖了表。她一直觉得我应该好好留着它。如果她知道了——她不会生我的气，但她会心疼。」\n\n「我不想让她心疼。」",
      guide: { title: "麦琪的礼物", objective: "决定是否替吉姆保守秘密" },
      choices: [
        {
          id: "keep-jim-secret",
          label: "「我不会说的。」",
          next: "magi.jim-secret-kept",
          effects: [{ type: "flag.set", flagId: "magi.jim.secretKept", value: true }],
        },
        {
          id: "hint-jim-secret",
          label: "「德拉那边……也许该让她知道。」",
          next: "magi.jim-secret-hint",
          effects: [{ type: "flag.set", flagId: "magi.jim.secretKept", value: false }],
        },
      ],
    },

    "magi.jim-secret-kept": {
      id: "magi.jim-secret-kept",
      title: "吉姆",
      savepoint: false,
      text: "吉姆明显松了口气。「谢谢你。」\n\n他抬头看了看天色。「天快黑了。我得回去了——德拉可能在等我吃晚饭。」\n\n他走了两步又回头：「如果你今晚没事……路过客栈的话，可以来看看。我——我觉得今晚可能会是个特别的夜晚。」",
      choices: [
        {
          id: "go-to-eve",
          label: "晚上去客栈看看",
          next: "magi.eve-arrive",
          effects: [{ type: "event.publish", eventType: "magi.jim.secret.kept" }],
        },
      ],
    },

    "magi.jim-secret-hint": {
      id: "magi.jim-secret-hint",
      title: "吉姆",
      savepoint: false,
      text: "吉姆沉默了一会儿。\n\n「也许你说得对。但不是今晚。」他轻声说。「今晚我只是想——给她一个惊喜。就像她可能也想给我一个惊喜一样。」\n\n他朝客栈方向走去。「如果你今晚路过……来坐坐吧。」",
      choices: [
        {
          id: "go-to-eve-hint",
          label: "晚上去客栈看看",
          next: "magi.eve-arrive",
          effects: [{ type: "event.publish", eventType: "magi.jim.secret.hint" }],
        },
      ],
    },

    /* ───────────────────── 第五幕：平安夜 ───────────────────── */

    "magi.eve-arrive": {
      id: "magi.eve-arrive",
      title: "客栈",
      role: "终章",
      savepoint: true,
      text: "天黑透了。客栈二楼的窗户透出暖黄色的灯光。\n\n你走上楼梯，门虚掩着。透过门缝，你看见德拉站在那张摇晃的餐桌旁边，桌上摆着两副碗筷和一锅热汤。她的短发别在耳后，露出完整的脸庞。\n\n吉姆坐在桌对面，外套搭在椅背上，胸口内侧口袋微微鼓起。两个人都没有说话，但空气里有一种安静的、暖烘烘的东西。\n\n德拉看到了门缝外的你，朝你点了点头。",
      guide: { title: "麦琪的礼物", objective: "选择留下见证，或安静离开" },
      choices: [
        {
          id: "stay-witness",
          label: "推门进去，见证这一刻",
          next: "magi.exchange-witness",
        },
        {
          id: "leave-quiet",
          label: "不打扰，安静离开",
          next: "magi.exchange-quiet",
        },
      ],
    },

    /* ───────────────────── 结局A：见证 ───────────────────── */

    "magi.exchange-witness": {
      id: "magi.exchange-witness",
      title: "客栈二楼",
      savepoint: false,
      text: "你推开门走进去。德拉拉了一把椅子给你，但你摇了摇头，示意自己只是路过。\n\n吉姆从口袋里拿出一个纸包，放在桌上推向德拉。「圣诞快乐。」他说。\n\n德拉愣了一下，然后从围巾口袋里掏出一个小盒子，推到吉姆面前。「……你先打开。」\n\n「一起打开。」吉姆说。",
      choices: [
        { id: "witness-open", label: "继续", next: "magi.reveal-della" },
      ],
    },

    "magi.reveal-della": {
      id: "magi.reveal-della",
      title: "德拉",
      savepoint: false,
      text: "德拉拆开纸包。\n\n她看见玳瑁梳了。\n\n她没有说话。她抬手摸了摸自己短短的头发——那里原本应该垂着一头长发，足够让梳子从发顶一直滑到发梢。\n\n「吉姆……」她说。声音很轻，像怕碰碎什么。「它们真好看。」\n\n她把梳子拿起来，贴在脸颊旁边，像在感受某种温度。然后她把梳子轻轻放在桌上，从口袋里拿出那个小盒子，推到吉姆面前。\n\n「轮到你了。」",
      choices: [
        { id: "witness-jim-open", label: "继续", next: "magi.reveal-jim" },
      ],
    },

    "magi.reveal-jim": {
      id: "magi.reveal-jim",
      title: "吉姆",
      savepoint: false,
      text: "吉姆打开盒子。\n\n白金表链躺在绒布上，每一节都打磨得像镜子。\n\n他看了很久。然后他笑了一下——不是苦笑，是一种很复杂的、带着一点无奈和一点释然的笑。他把表链拿起来，在手指间过了一遍。\n\n「德拉。」他说。\n\n「嗯？」\n\n「我的表……今天卖给收旧表的了。」\n\n德拉的眼睛慢慢睁大。她低头看了看手里的玳瑁梳，又看了看吉姆手里的表链，然后她笑了——一开始是轻轻的，后来越来越大声，最后笑着笑着眼眶就红了。",
      choices: [
        { id: "witness-silence", label: "继续", next: "magi.silence" },
      ],
    },

    "magi.silence": {
      id: "magi.silence",
      title: "客栈二楼",
      savepoint: false,
      text: "他们谁也没有再说话。德拉端起汤锅给吉姆盛了一碗，吉姆把表链仔细放回盒子里，和梳子并排摆在桌上。\n\n两个盒子靠在一起。一条没有表可以配的表链，一组没有头发可以梳的梳子。\n\n吉姆拿起勺子喝了一口汤，说：「味道不错。」\n\n德拉擦了擦眼角，也盛了一碗。「当然不错。我炖了两个小时。」\n\n窗外有雪开始落了。",
      choices: [
        {
          id: "witness-end",
          label: "安静起身离开",
          next: "magi.ending-witness",
          effects: [
            { type: "event.publish", eventType: "magi.achievement.87-cents" },
            { type: "event.publish", eventType: "magi.completed.witness" },
          ],
        },
      ],
    },

    "magi.ending-witness": {
      id: "magi.ending-witness",
      title: "麦琪的礼物",
      role: "好结局",
      presentation: "blackout",
      terminal: true,
      guide: null,
      text: "你轻轻带上门。楼梯上很暗，但你能听到楼上传来的碗碟声和偶尔的一两句话。\n\n一美元八十七美分。\n有些礼物不能立刻使用。\n但它们已经完成了自己的使命。",
      achievement: { id: "magi_87_cents", name: "一美元八十七美分" },
    },

    /* ───────────────────── 结局B：安静离开 ───────────────────── */

    "magi.exchange-quiet": {
      id: "magi.exchange-quiet",
      title: "客栈二楼",
      savepoint: false,
      text: "你站在门外，透过门缝看了一会儿。\n\n吉姆从口袋里拿出一个纸包，德拉从围巾口袋里掏出一个小盒子。他们同时把东西推向对方，然后对视了一眼，都笑了。\n\n你听不清他们在说什么，但德拉的笑容很亮。你退后一步，轻轻走下楼梯。\n\n有些时刻不需要第三个人在场。",
      choices: [
        {
          id: "quiet-end",
          label: "离开客栈",
          next: "magi.ending-quiet",
          effects: [
            { type: "event.publish", eventType: "magi.achievement.87-cents" },
            { type: "event.publish", eventType: "magi.completed.quiet" },
          ],
        },
      ],
    },

    "magi.ending-quiet": {
      id: "magi.ending-quiet",
      title: "麦琪的礼物",
      role: "结局",
      presentation: "blackout",
      terminal: true,
      guide: null,
      text: "你走出客栈。雪开始落了。\n\n你不知道他们交换了什么。但你知道，两个人都在笑。\n\n一美元八十七美分。\n有些礼物不能立刻使用。\n但它们已经完成了自己的使命。",
      achievement: { id: "magi_87_cents", name: "一美元八十七美分" },
    },
  },

  sourceText: "改编自欧·亨利《The Gift of the Magi》(1905)。原作主角为德拉与吉姆·杨，故事发生在纽约的一间廉价公寓。本支线将舞台移至物实小城，保留了原作的核心情节——夫妻双方各自卖掉最珍贵的东西为对方买礼物——并赋予玩家在过程中改善细节的有限能力。玩家无法消除原作的苦涩底色，这正契合欧·亨利对「麦琪」的定义：礼物的价值不在于能否使用，而在于交出最珍贵之物时的那份心意。",
};
