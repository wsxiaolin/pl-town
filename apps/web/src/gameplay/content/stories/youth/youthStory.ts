import type { StoryDefinition } from "../../../stories/types";

export const YOUTH_STORY: StoryDefinition = {
  schemaVersion: 1,
  definitionVersion: 1,
  id: "side.youth.years",
  title: "那年我们正值青春",
  startNode: "youth.school-gate",
  entryActorId: "youth_teacher",

  interactions: [
    { actorId: "youth_teacher", nodeId: "youth.school-gate", choiceId: "ask-teacher" },
  ],

  buildingInteractions: [
    { buildingId: "youth_bridge", nodeId: "youth.school-gate", choiceId: "ask-teacher" },
  ],

  nodes: {
    // ── 第一幕：校园与课堂 ──────────────────────────────────────────

    "youth.school-gate": {
      id: "youth.school-gate",
      title: "校门口",
      role: "序章 · 放学后",
      savepoint: true,
      guide: { title: "那年我们正值青春", objective: "放学后跟枫老师走一趟" },
      activeActorIds: ["youth_teacher"],
      text:
        "放学后的校门口比教室里还吵。自行车铃、值日生的哨子、有人把书包甩上肩。\n\n" +
        "枫老师靠在东侧门柱边，手里捏着一截白粉笔，指节上全是粉。他看见你，把粉笔在掌心转了半圈。\n\n" +
        "「来得正好。帮我拿一下这个——不重，就是容易断。」",
      choices: [
        { id: "ask-teacher", label: "老师，你拿粉笔去哪儿？", next: "youth.chalk-case" },
        { id: "look-gate", label: "先看看校门口的公告栏。", next: "youth.chalk-case" },
      ],
    },

    "youth.chalk-case": {
      id: "youth.chalk-case",
      title: "校门口",
      savepoint: false,
      activeActorIds: ["youth_teacher"],
      text:
        "「桥上。」他说得很快，像这个答案已经等在嘴边很久了。「不是学校那座。是河边那座，修到一半的。」\n\n" +
        "他把粉笔递给你，又收回半寸。「先别问为什么。你跟我走一段，到了就明白。」\n\n" +
        "「今天教室里那块黑板，你也看见了吧。」",
      choices: [
        { id: "follow-teacher", label: "跟你走。", next: "youth.classroom" },
        { id: "ask-blackboard", label: "黑板上的句子是谁写的？", next: "youth.classroom", set: { "youth.curious": true } },
      ],
    },

    "youth.classroom": {
      id: "youth.classroom",
      title: "教室",
      role: "第一幕 · 黑板",
      savepoint: true,
      guide: { title: "那年我们正值青春", objective: "读完黑板上留下的半句话" },
      activeActorIds: ["youth_teacher"],
      text:
        "教室里只剩最后一排的窗开着。黑板上还留着值日生没擦干净的字，中间一行被特意保了下来。\n\n" +
        "日出，是你摸着我的头说要等我一起长大\n" +
        "日落，是＿＿＿\n\n" +
        "你说要陪我看无尽的夜空，看那繁星点点\n" +
        "＿＿＿＿＿\n\n" +
        "粉笔灰在斜光里浮着。枫老师站在门口，没有进来。",
      choices: [
        { id: "read-board", label: "走到黑板前。", next: "youth.blackboard" },
        { id: "look-desk", label: "先看看靠窗的课桌。", next: "youth.desk-memory" },
      ],
    },

    "youth.blackboard": {
      id: "youth.blackboard",
      title: "黑板",
      savepoint: false,
      activeActorIds: ["youth_teacher"],
      text:
        "你站在黑板前。空格边缘有一圈被反复擦过的白痕，像有很多人在这里停过手。\n\n" +
        "后排有人留下的小字：「别写太满，留一点给明天。」旁边另一行更小：「明天也要考试。」\n\n" +
        "枫老师的声音从门口过来：「第一句先别急着写。你想接哪一句？」",
      choices: [
        { id: "fill-evening", label: "接「日落，是……」。", next: "youth.first-fill", set: { "youth.fill.pick": "sunset" } },
        { id: "fill-stars", label: "接「看那繁星点点」的下一句。", next: "youth.first-fill", set: { "youth.fill.pick": "stars" } },
        { id: "fill-both", label: "两句都试着写。", next: "youth.first-fill", set: { "youth.fill.pick": "both" } },
        { id: "leave-blank", label: "先不写，去问问老师。", next: "youth.chalk-case" },
      ],
    },

    "youth.first-fill": {
      id: "youth.first-fill",
      title: "黑板前",
      savepoint: false,
      activeActorIds: ["youth_teacher"],
      text:
        "粉笔在黑板上落下去，声音比想象中响。\n\n" +
        "你写完最后一个字，后排的同学探头看了一眼，什么也没说，只把窗户关小了一点。\n\n" +
        "枫老师走进来，看了看那行字。「这句先留在这儿。晚上去桥上，再写一句更长的。」",
      choices: [
        { id: "to-bridge", label: "好，去桥上。", next: "youth.dismissal" },
        { id: "read-yearbook", label: "先翻翻讲台那本旧练习册。", next: "youth.yearbook" },
        { id: "ask-why", label: "为什么还要再写一句？", next: "youth.dismissal", set: { "youth.asked.second": true } },
      ],
    },

    "youth.desk-memory": {
      id: "youth.desk-memory",
      title: "靠窗的课桌",
      savepoint: false,
      text:
        "你在靠窗的位置停下。桌面上刻着几行歪歪扭扭的字，被校服袖子磨得发亮：\n\n" +
        "「周三换座位」\n" +
        "「物理作业借我抄一下」\n" +
        "「别擦，等我回来」\n\n" +
        "最后一行没有署名。窗外的操场上，有人在收最后一筐篮球。",
      choices: [
        { id: "write-answer", label: "回到黑板前。", next: "youth.blackboard" },
        { id: "look-out", label: "看看走廊上还有谁。", next: "youth.classmate" },
      ],
    },

    "youth.classmate": {
      id: "youth.classmate",
      title: "同班同学",
      savepoint: false,
      activeActorIds: ["youth_classmate"],
      text:
        "一个抱着作业本的同学从后门探头进来。看见黑板上的空格，他停了一下。\n\n" +
        "「这个啊，上学期也有人写过。写完又被擦了。每年都有人写。」\n\n" +
        "他把作业本往上托了托。「你要写吗？写完记得拍下来。不然下学期就没了。」",
      choices: [
        { id: "ask-what", label: "写了会怎么样？", next: "youth.yearbook", set: { "youth.memory.asked": true } },
        { id: "answer-now", label: "现在就写。", next: "youth.blackboard" },
      ],
    },

    "youth.yearbook": {
      id: "youth.yearbook",
      title: "旧练习册",
      savepoint: false,
      activeActorIds: ["youth_classmate"],
      text:
        "讲台抽屉里压着一本旧练习册，封面写着「班级留言」。翻开，里面不是留言，都是半句话。\n\n" +
        "「以后要去很远的地方，」\n" +
        "「如果那天没有下雨，」\n" +
        "「我会记得这次考试，」\n\n" +
        "每一句后面都空着。纸张边缘卷起来，像被很多人翻过。有人还在页脚写：「那年夏天断过一次线，后来大家就改用纸条了。」",
      choices: [
        { id: "close-yearbook", label: "合上练习册。", next: "youth.dismissal" },
        { id: "add-line", label: "也在后面添半句。", next: "youth.blackboard", set: { "youth.yearbook.line": true } },
      ],
    },

    "youth.dismissal": {
      id: "youth.dismissal",
      title: "楼梯口",
      savepoint: true,
      guide: { title: "那年我们正值青春", objective: "在天黑前赶到河边" },
      activeActorIds: ["youth_teacher"],
      text:
        "放学铃响过第二遍，走廊很快空了。\n\n" +
        "枫老师把粉笔盒塞进外套口袋，往楼梯口走。「走吧。天黑之前到河边，还能看清碑上的字。」\n\n" +
        "他走到楼梯拐角，又回头补了一句：「桥上的风比操场大。写完了记得把手揣兜里。」",
      choices: [
        { id: "go-bridge", label: "跟上去。", next: "youth.river-road" },
        { id: "ask-why-bridge", label: "为什么非要去桥上写？", next: "youth.river-road", set: { "youth.asked.bridge": true } },
      ],
    },

    "youth.river-road": {
      id: "youth.river-road",
      title: "沿河的路",
      savepoint: false,
      activeActorIds: ["youth_teacher"],
      text:
        "从学校东门出去，沿河走一段，城市的声音慢慢落在身后。\n\n" +
        "对岸是旧城的方向，烟从低矮的屋顶间升起来。河面上浮着几块木牌，被水推着打转。\n\n" +
        "枫老师走在前头，没有解释那些木牌。",
      choices: [
        { id: "keep-walking", label: "继续走。", next: "youth.bridge-arrival" },
        { id: "read-floating", label: "看一眼水上的木牌。", next: "youth.bridge-arrival", set: { "youth.saw.floating": true } },
      ],
    },

    "youth.bridge-arrival": {
      id: "youth.bridge-arrival",
      title: "半句桥",
      role: "第一幕 · 断桥",
      savepoint: true,
      guide: { title: "那年我们正值青春", objective: "读一读桥心碑上的字" },
      activeActorIds: ["youth_teacher"],
      text:
        "桥从南岸出发，修到河心就断了。最后一块石板的位置空着，露出底下的木梁。\n\n" +
        "断口前立着一块矮碑。碑顶是平的，正好够一只鸟停。碑边插着几截粉笔，颜色深浅不一。\n\n" +
        "引桥两侧斜插着密密麻麻的小木牌。风一过，几百块木牌一起响。",
      choices: [
        { id: "read-tablet", label: "走到碑前。", next: "youth.tablet" },
        { id: "look-plaques", label: "先看引桥上的木牌。", next: "youth.plaque-wall" },
      ],
    },

    "youth.tablet": {
      id: "youth.tablet",
      title: "桥心碑",
      savepoint: false,
      activeActorIds: ["youth_teacher"],
      text:
        "碑正面刻着六行字。\n\n" +
        "日出，是你摸着我的头说要等我一起长大\n" +
        "日落，是＿＿＿\n\n" +
        "你说要陪我看无尽的夜空，看那繁星点点\n" +
        "＿＿＿＿＿\n\n" +
        "碑脚有一行小字：「写在这里的话，桥替你收着。」",
      choices: [
        { id: "fill-second", label: "从石缝里抽一截粉笔。", next: "youth.second-fill" },
        { id: "look-around", label: "再看看周围的木牌。", next: "youth.plaque-wall" },
        { id: "wait-night", label: "在桥上等天黑。", next: "youth.teacher-night", set: { "youth.waited": true } },
      ],
    },

    "youth.second-fill": {
      id: "youth.second-fill",
      title: "桥心碑",
      savepoint: false,
      activeActorIds: ["youth_teacher"],
      text:
        "你从石缝里抽出一截粉笔。碑面比黑板凉，粉笔落下去的声音很轻。\n\n" +
        "第二个空格比第一个宽。旁边的木牌上已经有很多种答案，长的、短的、只画了一个圈的。\n\n" +
        "枫老师没有催你。他站在断口边，看河。",
      choices: [
        {
          id: "write-own",
          label: "写自己的下半句。",
          next: "youth.young-plaque",
          set: { "youth.fill.second": "own" },
          effects: [
            { type: "event.publish", eventType: "story.achievement", payload: { id: "youth_half_bridge", name: "半句桥" } },
          ],
        },
        {
          id: "copy-young",
          label: "照着最小的木牌写一个词。",
          next: "youth.young-plaque",
          set: { "youth.fill.second": "young" },
          effects: [
            { type: "event.publish", eventType: "story.achievement", payload: { id: "youth_half_bridge", name: "半句桥" } },
          ],
        },
        {
          id: "copy-p",
          label: "只写一个字母，再点一个句号。",
          next: "youth.young-plaque",
          set: { "youth.fill.second": "p" },
          effects: [
            { type: "event.publish", eventType: "story.achievement", payload: { id: "youth_half_bridge", name: "半句桥" } },
          ],
        },
        { id: "ask-what", label: "先看看别人怎么写。", next: "youth.plaque-wall" },
      ],
    },

    "youth.young-plaque": {
      id: "youth.young-plaque",
      title: "引桥",
      savepoint: true,
      guide: { title: "那年我们正值青春", objective: "看看引桥尽头那两块小木牌" },
      activeActorIds: ["youth_teacher"],
      text:
        "你退后一步。桥心的风把碑边的粉笔灰吹散了。\n\n" +
        "引桥最外侧有两块很小的木牌，比别的小一号。上面各只有一个词和一个句号：\n\n" +
        "Young。\n" +
        "p。\n\n" +
        "像一个很短的回声。",
      choices: [
        { id: "teacher-arrives", label: "回头找枫老师。", next: "youth.teacher-night" },
        { id: "read-wall", label: "再读几块木牌。", next: "youth.plaque-wall" },
        { id: "leave-early", label: "今天就到这里。", next: "youth.first-night-end", set: { "youth.left.early": true } },
      ],
    },

    "youth.plaque-wall": {
      id: "youth.plaque-wall",
      title: "引桥木牌",
      savepoint: false,
      text:
        "木牌一块挨一块，很多字被雨水泡得发白。\n\n" +
        "「25 咕币一声咕。」\n" +
        "「北京烤鸽，热的。」\n" +
        "「给他拜个早年吧。」\n" +
        "「以上全是假的。」\n\n" +
        "再往里，有一块朝里的木牌，翻面挂着。你看不清上面的字。",
      choices: [
        { id: "read-young", label: "去看那两块最小的木牌。", next: "youth.young-plaque" },
        { id: "back-tablet", label: "回到碑前。", next: "youth.tablet" },
        { id: "to-gardenia", label: "去看桥边的花丛。", next: "youth.gardenia" },
      ],
    },

    "youth.teacher-night": {
      id: "youth.teacher-night",
      title: "枫老师",
      role: "第二幕 · 夜谈",
      savepoint: true,
      guide: { title: "那年我们正值青春", objective: "听枫老师说说桥与名字的事" },
      activeActorIds: ["youth_teacher"],
      text:
        "天完全黑下来以后，枫老师才在碑边坐下。他把外套下摆压在腿下，从口袋里摸出一小截粉笔，放在你手边。\n\n" +
        "「晚上好。桥上风大，写完了记得把手揣兜里。」\n\n" +
        "他说完就不再看你，像在等你自己开口。",
      choices: [
        { id: "ask-name", label: "你是谁？", next: "youth.name-question" },
        { id: "ask-half", label: "这桥为什么只修了一半？", next: "youth.why-half" },
        { id: "stay-silent", label: "陪他坐一会儿。", next: "youth.first-night-end" },
      ],
    },

    "youth.name-question": {
      id: "youth.name-question",
      title: "枫老师",
      savepoint: false,
      activeActorIds: ["youth_teacher"],
      text:
        "他低头看了看引桥脚的小亭子。亭里挂着七块木牌，今晚只有一块朝着外面。\n\n" +
        "「今晚亭子里翻出来的是这块——杰瑞的老汤姆。你就这么叫我吧。」",
      choices: [
        { id: "ask-yesterday", label: "昨天呢？", next: "youth.yesterday-name" },
        { id: "ask-bridge", label: "这桥为什么只修了一半？", next: "youth.why-half" },
        { id: "to-pavilion", label: "去看看那个亭子。", next: "youth.pavilion" },
      ],
    },

    "youth.yesterday-name": {
      id: "youth.yesterday-name",
      title: "枫老师",
      savepoint: false,
      activeActorIds: ["youth_teacher"],
      text:
        "「昨天是非汤姆也。上礼拜是华亭熠。」他停了一下。「都行，反正都是我。名字嘛，穿旧了就换，换了也别扔——亭子里挂着呢，七块，一块不少。」",
      choices: [
        {
          id: "ask-more",
          label: "七块都是你的名字？",
          next: "youth.pavilion",
          effects: [
            { type: "event.publish", eventType: "story.achievement", payload: { id: "youth_seven_names", name: "七个名字" } },
          ],
        },
        { id: "ask-bridge", label: "这桥为什么只修了一半？", next: "youth.why-half" },
      ],
    },

    "youth.pavilion": {
      id: "youth.pavilion",
      title: "名牌亭",
      savepoint: false,
      activeActorIds: ["youth_teacher"],
      text:
        "小亭子里没有灯。七块名牌并排挂着，木纹深浅不一。\n\n" +
        "牌面朝向每天都会变。今天翻正的那块边角磨得最圆，背面刻着一行更小的字。\n\n" +
        "你凑近看，四块牌的背面刻的是同一行：枫松柏栀。",
      choices: [
        { id: "ask-eight", label: "为什么背面刻的是这四个字？", next: "youth.name-question" },
        { id: "pavilion-bridge", label: "回到桥上。", next: "youth.why-half" },
        { id: "leave-pavilion", label: "离开亭子。", next: "youth.first-night-end" },
      ],
    },

    "youth.why-half": {
      id: "youth.why-half",
      title: "枫老师",
      savepoint: false,
      activeActorIds: ["youth_teacher"],
      text:
        "「修桥的人说，上半句刻在碑上，下半句得你们来。写满一千句，桥自己往对岸长一寸。」\n\n" +
        "他抬了抬下巴，示意引桥上的木牌。「你看，早就满了。满了好几轮。」",
      choices: [
        { id: "ask-grow", label: "长过吗？", next: "youth.grow" },
        { id: "ask-across", label: "桥对面是什么？", next: "youth.across" },
        { id: "end-night", label: "今天就到这里。", next: "youth.first-night-end" },
      ],
    },

    "youth.grow": {
      id: "youth.grow",
      title: "枫老师",
      savepoint: false,
      activeActorIds: ["youth_teacher"],
      text:
        "他笑了一下，笑意很浅。「我在这儿守了两年多，一寸都没长。但是你看那些木牌——一千句早就满了，满了好几轮了。」\n\n" +
        "「桥不长的原因，我猜是它故意的：留着一截没修，就永远有一句没写完；永远有一句没写完，就永远有人再来。」",
      choices: [
        { id: "to-across", label: "桥对面是什么？", next: "youth.across" },
        { id: "to-flagpole", label: "去看桥头的旗杆。", next: "youth.flagpole" },
        { id: "end-night", label: "今天就到这里。", next: "youth.first-night-end" },
      ],
    },

    "youth.across": {
      id: "youth.across",
      title: "断口",
      savepoint: false,
      activeActorIds: ["youth_teacher"],
      text:
        "「不知道。我考试前在这儿填过一句，填的就是想去的地方。后来去了别的地方，再后来回来的第一件事，还是来这儿填了一句。」\n\n" +
        "他看了看断口。「也许桥修完的那天，对面就不是现在这样了。」",
      choices: [
        { id: "to-flagpole", label: "去看桥头的旗杆。", next: "youth.flagpole" },
        { id: "to-gardenia", label: "去看桥边的花丛。", next: "youth.gardenia" },
        { id: "end-night", label: "今天就到这里。", next: "youth.first-night-end" },
      ],
    },

    "youth.flagpole": {
      id: "youth.flagpole",
      title: "旗杆",
      savepoint: false,
      activeActorIds: ["youth_teacher"],
      text:
        "南岸桥头立着一根歪旗杆，绳子上挂着几面旧旗。旗面被风吹得发白，边角起了毛。\n\n" +
        "旗杆下有一块小木牌：「立 flag，不给答案。」\n\n" +
        "枫老师站在旁边，没有劝你。",
      choices: [
        {
          id: "raise-flag",
          label: "写下自己的 flag，挂上去。",
          next: "youth.first-night-end",
          set: { "youth.flag.raised": true },
          effects: [
            { type: "event.publish", eventType: "story.achievement", payload: { id: "youth_flag", name: "旗子不需要答案" } },
          ],
        },
        { id: "no-answer", label: "站着看一会儿。", next: "youth.first-night-end", set: { "youth.flag.left": true } },
        { id: "ask-why-flag", label: "为什么没有结果？", next: "youth.grow" },
      ],
    },

    "youth.gardenia": {
      id: "youth.gardenia",
      title: "栀子花丛",
      savepoint: false,
      text:
        "桥心碑侧有一丛栀子，六月才开。现在只有叶子，叶背积着薄灰。\n\n" +
        "花丛前插着一块窄木牌，字迹被雨洗过很多次，还认得出：\n\n" +
        "「种花的人说，她要去的学校和这里隔一条河。」\n\n" +
        "木牌后面没有别的说明。",
      choices: [
        { id: "back-tablet", label: "回到碑前。", next: "youth.tablet" },
        { id: "to-pavilion", label: "去名牌亭看看。", next: "youth.pavilion" },
        { id: "end-night", label: "今天就到这里。", next: "youth.first-night-end" },
      ],
    },

    "youth.first-night-end": {
      id: "youth.first-night-end",
      title: "桥头",
      role: "第二幕 · 收束",
      savepoint: true,
      guide: { title: "那年我们正值青春", objective: "回学校等毕业那天" },
      activeActorIds: ["youth_teacher"],
      text:
        "夜里的河面很静。引桥上的木牌偶尔碰在一起，声音像很多人在很远的地方翻书。\n\n" +
        "枫老师把粉笔盒收好。「今天写到这儿。桥会替你收着。」\n\n" +
        "他先走了。走到引桥尽头，又回头说：「明天放学，教室见。」",
      choices: [
        { id: "return-school", label: "回学校去。", next: "youth.return-school" },
        { id: "come-back-night", label: "过些天再来桥上看看。", next: "youth.revisit", set: { "youth.revisit.early": true } },
      ],
    },

    // ── 第三幕：毕业与告别 ──────────────────────────────────────────

    "youth.return-school": {
      id: "youth.return-school",
      title: "毕业季",
      role: "第三幕 · 六月",
      savepoint: true,
      guide: { title: "那年我们正值青春", objective: "参加毕业典礼" },
      text:
        "第二天下午，教室里多了一摞毕业册。窗台上的粉笔盒空了，黑板被擦得干干净净。\n\n" +
        "有人在讲台上写：「最后一天，别迟到。」\n\n" +
        "枫老师站在门口，手里没有粉笔。",
      choices: [
        { id: "to-graduation", label: "去操场。", next: "youth.graduation" },
        { id: "to-last-desk", label: "先回最后一排看看。", next: "youth.last-desk" },
      ],
    },

    "youth.graduation": {
      id: "youth.graduation",
      title: "操场",
      savepoint: false,
      activeActorIds: ["youth_teacher"],
      text:
        "毕业典礼在操场上。太阳很大，校服后背很快湿了一片。\n\n" +
        "没有人哭。大家只是把椅子搬回教室，把名字写在别人的校服上，把没说完的话留给下一次见面。\n\n" +
        "枫老师站在队伍最后，像一个不打算发言的人。",
      choices: [
        { id: "to-last-desk", label: "回教室看看。", next: "youth.last-desk" },
        { id: "to-farewell", label: "走到他身边。", next: "youth.farewell" },
      ],
    },

    "youth.last-desk": {
      id: "youth.last-desk",
      title: "最后一排",
      savepoint: false,
      text:
        "教室最后一排的桌子被清空了。桌面上那行「别擦，等我回来」还在。\n\n" +
        "抽屉里躺着一张折起来的纸，上面只有半句：\n\n" +
        "「以后要去很远的地方，」\n\n" +
        "纸的背面是空白的。",
      choices: [
        { id: "write-mine", label: "在背面写下自己的下半句。", next: "youth.farewell", set: { "youth.note.written": true } },
        { id: "leave-note", label: "把纸留在抽屉里。", next: "youth.farewell" },
        { id: "keep-note", label: "把纸收起来。", next: "youth.farewell", set: { "youth.note.kept": true } },
      ],
    },

    "youth.farewell": {
      id: "youth.farewell",
      title: "枫老师",
      role: "第三幕 · 告别",
      savepoint: true,
      guide: { title: "那年我们正值青春", objective: "去桥心灯下写最后一句话" },
      activeActorIds: ["youth_teacher"],
      text:
        "散场以后，枫老师把教室钥匙放在讲台上。\n\n" +
        "「我下学期不一定还在这儿。」他说得很平。「桥那边，晚上还是有人去的。」\n\n" +
        "他把一截粉笔放在你手心。「六月桥心的灯会亮。你要是想说什么，就那时候去。」",
      choices: [
        { id: "to-lantern", label: "去桥上。", next: "youth.bridge-lantern" },
        { id: "ask-really", label: "你真的要走吗？", next: "youth.bridge-lantern", set: { "youth.asked.leaving": true } },
        { id: "walk-away", label: "什么也不说，先走。", next: "youth.ending-leave" },
      ],
    },

    "youth.bridge-lantern": {
      id: "youth.bridge-lantern",
      title: "桥心灯",
      role: "第三幕 · 点灯",
      savepoint: true,
      guide: { title: "那年我们正值青春", objective: "在灯下决定要不要重写那句" },
      activeActorIds: ["youth_teacher"],
      text:
        "六月，河面上多了一盏灯。灯挂在断桥的碑边，光很轻，只照得亮碑面。\n\n" +
        "栀子花开了。花丛的白和灯的光混在一起，分不清哪边更亮。\n\n" +
        "枫老师站在灯下。「这盏灯一年只亮这一个月。灯下写的话，和别处不一样——别处是写给桥的，这里得写给自己。」",
      choices: [
        { id: "rewrite", label: "重写那年的一句。", next: "youth.rewrite" },
        {
          id: "keep",
          label: "我还是不改了。",
          next: "youth.ending-keep",
          effects: [
            { type: "event.publish", eventType: "story.achievement", payload: { id: "youth_rewrite_keep", name: "不改也是一种写法" } },
          ],
        },
        { id: "give-plaque", label: "把自己的木牌留给下一个人。", next: "youth.ending-plaque" },
        { id: "leave-lantern", label: "看完灯就走。", next: "youth.ending-leave" },
      ],
    },

    "youth.rewrite": {
      id: "youth.rewrite",
      title: "灯下",
      savepoint: false,
      activeActorIds: ["youth_teacher"],
      text:
        "碑面上浮出你上次写的那行字，很淡，像隔着水。\n\n" +
        "你拿着粉笔，在旧字旁边停住。风把灯影吹得晃了一下。\n\n" +
        "「写吧。」枫老师说。「旧的那句不会删。木牌会翻个面，挂到最里面去。」",
      choices: [
        {
          id: "finish-rewrite",
          label: "写下去。",
          next: "youth.ending-years",
          effects: [
            { type: "event.publish", eventType: "story.achievement", payload: { id: "youth_years", name: "那年我们正值青春" } },
          ],
        },
        { id: "put-down", label: "把粉笔放下。", next: "youth.ending-keep" },
      ],
    },

    "youth.ending-years": {
      id: "youth.ending-years",
      title: "那年我们正值青春",
      role: "结局 · 那年",
      savepoint: true,
      presentation: "blackout",
      terminal: true,
      guide: null,
      activeActorIds: ["youth_teacher"],
      text:
        "你写完了。粉笔在碑面上最后顿了一下。\n\n" +
        "旧的那行字没有消失，只是慢慢淡下去。引桥最里面，一块木牌轻轻翻了个面。\n\n" +
        "枫老师看着碑，过了很久才说：\n\n" +
        "「那年我们正值青春——这话是我考试前写的。后来我才知道，人是在故事还没结束的时候，就开始怀念它了。」\n\n" +
        "灯还亮着。六月的风从河心吹过来，把粉笔灰带走了一点。",
    },

    "youth.ending-keep": {
      id: "youth.ending-keep",
      title: "那年我们正值青春",
      role: "结局 · 不改",
      savepoint: true,
      presentation: "blackout",
      terminal: true,
      guide: null,
      activeActorIds: ["youth_teacher"],
      text:
        "你把粉笔放回石缝里。\n\n" +
        "「也行。」枫老师说。「不改也是一种写法。」\n\n" +
        "灯下的旧字还在。它没有被覆盖，也没有被带走。\n\n" +
        "你在桥上站了一会儿，听见引桥的木牌一块接一块地响。",
    },

    "youth.ending-plaque": {
      id: "youth.ending-plaque",
      title: "那年我们正值青春",
      role: "结局 · 留牌",
      savepoint: true,
      presentation: "blackout",
      terminal: true,
      guide: null,
      activeActorIds: ["youth_teacher"],
      text:
        "你没有重写。你从引桥边抽出一块空白木牌，挂到断口最靠外的位置。\n\n" +
        "木牌空着一面。风一吹，它就转过去，又转回来。\n\n" +
        "「留给下一个人。」枫老师说。「他要是想接，就让他接。」\n\n" +
        "桥还是没有长。但断口边的木牌多了一块。",
    },

    "youth.ending-leave": {
      id: "youth.ending-leave",
      title: "那年我们正值青春",
      role: "结局 · 留白",
      savepoint: true,
      presentation: "blackout",
      terminal: true,
      guide: null,
      text:
        "你沿着引桥走回南岸。身后的桥越来越小。\n\n" +
        "枫老师没有叫住你。\n\n" +
        "走到桥头时，你回头看了一眼。断口还在那里，像一句没有写完的话。\n\n" +
        "你没有再写。桥也没有长。河面把桥影拉得很长。",
    },

    "youth.revisit": {
      id: "youth.revisit",
      title: "回访",
      role: "回访 · 又一夜",
      savepoint: true,
      guide: { title: "那年我们正值青春", objective: "看看引桥最深处翻面的木牌" },
      activeActorIds: ["youth_teacher"],
      text:
        "又一个晚上，你回到桥上。引桥最深处多了一块朝里的木牌，翻面挂着。\n\n" +
        "亭子里的名牌换了一块。今晚那块写着「ZR枫」。\n\n" +
        "枫老师坐在断口边，什么也没问，只把一截很短的粉笔推到你手边。",
      choices: [
        {
          id: "flip-plaque",
          label: "把那块翻面的木牌扶正。",
          next: "youth.ending-flipped",
          effects: [
            { type: "event.publish", eventType: "story.achievement", payload: { id: "youth_flipped", name: "翻面的木牌" } },
          ],
        },
        { id: "ask-name-again", label: "今晚你是谁？", next: "youth.name-question" },
        { id: "leave-again", label: "看看就走。", next: "youth.ending-leave" },
      ],
    },

    "youth.ending-flipped": {
      id: "youth.ending-flipped",
      title: "那年我们正值青春",
      role: "结局 · 翻面",
      savepoint: true,
      presentation: "blackout",
      terminal: true,
      guide: null,
      activeActorIds: ["youth_teacher"],
      text:
        "你把那块翻面的木牌扶正。\n\n" +
        "背面朝外的一行字很浅，像写的人犹豫了很久：\n\n" +
        "「她和我上不了同一个高中。」\n\n" +
        "木牌没有落款。花丛那边，六月的花已经谢了。\n\n" +
        "枫老师坐在断口边，什么也没有说明。\n\n" +
        "风把木牌吹回原来的方向。字又朝里了。",
    },
  },
};
