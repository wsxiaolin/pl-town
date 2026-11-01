import type { StoryDefinition } from "../../../stories/types";

/**
 * 支线剧情：《DUC协议》
 *
 * 界碑向城二十步的缓坡上有一座立约亭。亭里刻着一份给机器写的
 * 四十八行公约，亭顶的灯要会用这门语言才会亮。
 *
 * 节点命名规范：duc.<beat>
 * 旗标命名规范：duc.<subject>.<key>
 */
export const DUC_STORY: StoryDefinition = {
  schemaVersion: 1,
  definitionVersion: 1,
  id: "side.duc.pact",
  title: "DUC协议",
  startNode: "duc.start",
  entryActorId: "duc_laxywa",

  interactions: [
    { actorId: "duc_laxywa", nodeId: "duc.start", choiceId: "enter-pavilion" },
  ],

  buildingInteractions: [
    { buildingId: "laws", nodeId: "duc.start", choiceId: "enter-pavilion" },
  ],

  nodes: {
    "duc.start": {
      id: "duc.start", title: "立约亭", role: "序章", savepoint: true,
      guide: { title: "DUC协议", objective: "走进缓坡上的立约亭" },
      text:
        "界碑向城二十步的缓坡上，立着一座六角浅砂岩亭子。十二根廊柱等角而立，柱距宽窄不均。\n\n" +
        "亭楣不挂匾，只挂一块双面木牌。亭顶正中有一盏灯，黑着。城里的灯都自己亮，只有这一盏要「会用它的语言」才亮。\n\n" +
        "亭口双柱之间钉着一封信。亭侧一块黄铜牌，隔着几步也能看见上面只有三个字。",
      choices: [
        { id: "enter-pavilion", label: "走进亭子", next: "duc.greeting", set: { "duc.entered": true } },
        { id: "look-lamp", label: "先抬头看那盏灯", next: "duc.lamp" },
        { id: "read-letter", label: "看柱上钉着的信", next: "duc.letter" },
      ],
    },

    "duc.lamp": {
      id: "duc.lamp", title: "亭顶的灯", role: "序章", savepoint: false,
      text:
        "灯罩是旧的，边缘磨得发亮，灯芯却没有一点温度。\n\n" +
        "你站了一会儿，它没有自己亮起来。\n\n" +
        "亭内传来布料擦过石面的声音，像有人在擦一块很大的碑。",
      choices: [
        { id: "lamp-enter", label: "进亭看看", next: "duc.greeting", set: { "duc.entered": true } },
        { id: "lamp-back", label: "退回坡上", next: "duc.start" },
      ],
    },

    "duc.greeting": {
      id: "duc.greeting", title: "laxy瓦", role: "立约 · 开亭", savepoint: true,
      guide: { title: "DUC协议", objective: "听立约者说完名字的事" },
      activeActorIds: ["duc_laxywa"],
      text:
        "亭内石碑前站着一个穿浅灰工装围裙的人，袖口别着一枚磨亮的 # 形铜牌。他正在擦碑，听见脚步声，转过身来。\n\n" +
        "「更名了不叫law协议了现在叫DUC协议。」\n\n" +
        "他停了一秒，把手里的布叠好。\n\n" +
        "「大概不会再改名了。」",
      choices: [
        { id: "ask-protocol", label: "这份协议是写给谁的？", next: "duc.hall", set: { "duc.laxywa.met": true } },
        { id: "ask-name", label: "为什么要改名？", next: "duc.names", set: { "duc.laxywa.met": true } },
        { id: "greeting-look", label: "先看看亭子里有什么", next: "duc.hall", set: { "duc.laxywa.met": true } },
      ],
    },

    "duc.hall": {
      id: "duc.hall", title: "亭心", role: "立约", savepoint: true,
      guide: { title: "DUC协议", objective: "读碑、翻牌、看柱，再去执行台拼一次事例" },
      activeActorIds: ["duc_laxywa"],
      text:
        "亭心立着一面石碑，刻满像法律条文的符号：%xxx%、#xxx#、>>、PC_。\n\n" +
        "亭楣那块双面牌、亭侧的黄铜铭牌、绕亭一圈的十二根廊柱，都各自留着字。双人工作台靠里摆着，右席空着。\n\n" +
        "亭心还悬着一枚铜铃，铃下挂着一块空白铭板。立约者退到柱边，把路让开。",
      choices: [
        { id: "read-stele", label: "读石碑", next: "duc.stele-1" },
        { id: "read-pillars", label: "绕十二根廊柱走一圈", next: "duc.pillars" },
        { id: "three-names", label: "看那三样写着名字的东西", next: "duc.names" },
        { id: "go-letter", label: "看亭口那封信", next: "duc.letter" },
        { id: "go-bench", label: "走到执行台前", next: "duc.bench" },
        { id: "go-bell", label: "看亭心的铜铃", next: "duc.bell" },
        { id: "go-calendar", label: "看柱上的年历牌", next: "duc.calendar" },
        { id: "halt-leave", label: "今天先不碰执行台", next: "duc.ending-return", ending: "return", set: { "duc.ending": "return" } },
      ],
    },

    "duc.stele-1": {
      id: "duc.stele-1", title: "协议石碑 · 关于表示", role: "碑文", savepoint: false,
      text:
        "石碑第一段刻的是「关于表示」。标记行的尖括号也留在石面上，没有磨掉。\n\n" +
        "立即数：\n%xxx%\n\n" +
        "事例：\n立即数1\n%xxx%\n\n" +
        "地址(的数据)：\n#xxx#\n\n" +
        "到xxx寄存器 #xxx#_\n" +
        "加 +\n减 -\n乘 *\n除 /\n左移 <<\n右移 >>(指令集开头使用这个表示输入)\n" +
        "PC就是程序计数器",
      choices: [
        { id: "stele-1-next", label: "继续往下读", next: "duc.stele-2" },
        { id: "stele-1-back", label: "先回亭心", next: "duc.hall" },
      ],
    },

    "duc.stele-2": {
      id: "duc.stele-2", title: "协议石碑 · 算符", role: "碑文", savepoint: false,
      text:
        "PC跳转至 PC_ 格式：\nPC_%xxx%\n\n" +
        "加载/转移 格式：\n#xxx#_#yyy# 或 #xxx#_%yyy%\n\n" +
        "与 &\n或 |\n非 !\n随机数 ?\n无操作声明 ~\n\n" +
        "十六到三十一行全是算符，刻得一行比一行浅一点。",
      choices: [
        { id: "stele-2-next", label: "继续往下读", next: "duc.stele-3" },
        { id: "stele-2-back", label: "先回亭心", next: "duc.hall" },
      ],
    },

    "duc.stele-3": {
      id: "duc.stele-3", title: "协议石碑 · 关于指令", role: "碑文", savepoint: false,
      text:
        "「关于指令」\n\n" +
        "一种字母代表一种数据或一段数据，并且这个数字如何控制都不会改变解释的效果。\n\n" +
        "比如三位的地址可以写成\nxxx\n\n" +
        "比如\n数据1地址(x)+数据2地址(y)+目标地址(z)+操作码(code)\n" +
        ">>xxxyyyzzzcccc\n(指令功能介绍)",
      choices: [
        { id: "stele-3-next", label: "读最后的示例", next: "duc.stele-example" },
        { id: "stele-3-back", label: "先回亭心", next: "duc.hall" },
      ],
    },

    "duc.stele-example": {
      id: "duc.stele-example", title: "协议石碑 · 事例", role: "碑文", savepoint: true,
      guide: { title: "DUC协议", objective: "记住石碑最后两行事例，去执行台拼一次" },
      text:
        "(汉语)将 01 加载到 00 地址的寄存器\n#00#_%01%\n\n" +
        "(汉语)将 00地址的数据 和 01地址的数据 相加 到 10 地址的寄存器\n" +
        "#10#_#00#+#01#\n\n" +
        "最后一行比前面几行深一点，像被人用指腹反复摸过。",
      choices: [
        { id: "example-to-bench", label: "去执行台照它拼一次", next: "duc.bench", set: { "duc.stele.read": true } },
        { id: "example-back", label: "再回亭心看看", next: "duc.hall", set: { "duc.stele.read": true } },
      ],
    },

    "duc.pillars": {
      id: "duc.pillars", title: "十二廊柱", role: "铭文", savepoint: true,
      text:
        "十二根廊柱等角而立，柱距宽窄不均。最远的两根之间隔着四十三分钟，最近的两根并成一对，只隔八秒。\n\n" +
        "柱序就是时间序。绕廊一圈，等于走完那个傍晚的九十三分钟。\n\n" +
        "先看前半圈，还是先看后半圈？",
      choices: [
        { id: "pillars-early", label: "从前半圈看起", next: "duc.pillars-early", set: { "duc.pillars.early": true } },
        { id: "pillars-late", label: "从后半圈看起", next: "duc.pillars-late", set: { "duc.pillars.late": true } },
        { id: "pillars-back", label: "回亭心", next: "duc.hall" },
      ],
    },

    "duc.pillars-early": {
      id: "duc.pillars-early", title: "前半圈 · 六柱", role: "铭文", savepoint: false,
      text:
        "第一柱：「@lvhua 你要不要加入」\n\n" +
        "第二柱：「@laxy瓦 拉西瓦水电站」\n\n" +
        "第三柱：「茶几。」\n\n" +
        "第四柱：「@RRR华根重工 水电站蚌埠住了」\n\n" +
        "第五柱：「@姐姐在呢~ 是真有这个地方」\n\n" +
        "第六柱：「@姐姐在呢~ 在中国」\n\n" +
        "刻痕都朝外，字口很浅，像留言的人说完就走了。",
      choices: [
        { id: "early-to-late", label: "接着看后半圈", next: "duc.pillars-late", set: { "duc.pillars.late": true } },
        { id: "early-to-hall", label: "回亭心", next: "duc.hall" },
      ],
    },

    "duc.pillars-late": {
      id: "duc.pillars-late", title: "后半圈 · 六柱", role: "铭文", savepoint: false,
      text:
        "第七柱刻得最长，从「拉西瓦水电站是黄河流域装机容量最大……」一直刻到「可以再问我。」\n\n" +
        "第八柱：「@laxy瓦 依旧充分利用ai」\n\n" +
        "第九柱：「@aurex 介绍拉西瓦水电站」\n\n" +
        "第十柱：「@姐姐在呢~ ↓」\n\n" +
        "第十一柱：「@laxy瓦 说一下内容」\n\n" +
        "第十二柱：「@lvhua 内容就是介绍讲的那些」\n\n" +
        "第九柱和第十柱并肩立着，中间只隔八秒。",
      choices: [
        { id: "late-to-names", label: "去看那三样写着名字的东西", next: "duc.names" },
        { id: "late-to-bench", label: "去执行台", next: "duc.bench" },
        { id: "late-to-hall", label: "回亭心", next: "duc.hall" },
      ],
    },

    "duc.names": {
      id: "duc.names", title: "名字的三条路", role: "命名", savepoint: true,
      guide: { title: "DUC协议", objective: "看完亭里三样写着名字的东西" },
      text:
        "亭里三样东西都写着名字。\n\n" +
        "亭楣的双面木牌：一面是「law协议」，一面是「DUC协议」。\n\n" +
        "亭侧的黄铜铭牌：只有三个字。\n\n" +
        "廊尾还钉着一张旧登记纸，上面并排写着两种拼法。\n\n" +
        "先看哪一样？",
      choices: [
        { id: "names-sign", label: "翻看双面更名牌", next: "duc.sign-front" },
        { id: "names-plaque", label: "念黄铜铭牌上的字", next: "duc.plaque" },
        { id: "names-spelling", label: "看旧登记纸上的两种拼法", next: "duc.spelling" },
        { id: "names-back", label: "回亭心", next: "duc.hall" },
      ],
    },

    "duc.sign-front": {
      id: "duc.sign-front", title: "更名牌 · 正面", role: "命名", savepoint: false,
      text:
        "木牌正面朝外，刻着「law协议」。边缘有反复翻动的磨痕。\n\n" +
        "背面还有字。",
      choices: [
        {
          id: "flip-sign", label: "把木牌翻过来", next: "duc.sign-back",
          set: { "duc.sign.flipped": true },
          effects: [
            { type: "event.publish", eventType: "story.achievement", payload: { id: "duc_no_rename", name: "大概不会再改名了" } },
          ],
        },
        { id: "sign-front-names", label: "回去看别的", next: "duc.names" },
        { id: "sign-front-hall", label: "回亭心", next: "duc.hall" },
      ],
    },

    "duc.sign-back": {
      id: "duc.sign-back", title: "更名牌 · 背面", role: "命名", savepoint: false,
      text:
        "背面刻着「DUC协议」。右下角还有一行小字：\n\n" +
        "「大概不会再改名了。」\n\n" +
        "风从柱子间穿过去，木牌轻轻晃了一下，又贴回横梁。",
      choices: [
        { id: "sign-back-flip", label: "再翻回正面", next: "duc.sign-front" },
        { id: "sign-back-names", label: "去看黄铜铭牌", next: "duc.plaque" },
        { id: "sign-back-hall", label: "回亭心", next: "duc.hall" },
      ],
    },

    "duc.spelling": {
      id: "duc.spelling", title: "旧登记纸", role: "命名", savepoint: false,
      text:
        "廊尾钉着一张旧纸，纸上是两种拼法：\n\n" +
        "「laxy瓦」\n「laxywa」\n\n" +
        "两种写法后面各有一个空空的回复框，框里没有字。\n\n" +
        "纸边被人抚平过很多次，折痕已经发亮。",
      choices: [
        { id: "spelling-sign", label: "去看双面更名牌", next: "duc.sign-front" },
        { id: "spelling-names", label: "回去看别的", next: "duc.names" },
        { id: "spelling-hall", label: "回亭心", next: "duc.hall" },
      ],
    },

    "duc.plaque": {
      id: "duc.plaque", title: "黄铜铭牌", role: "谐音", savepoint: true,
      guide: { title: "DUC协议", objective: "念响黄铜铭牌上的三个字" },
      activeActorIds: ["duc_huaweng"],
      text:
        "亭侧一块黄铜牌，只有三个字：\n\n" +
        "「拉西瓦」\n\n" +
        "你刚念出声，亭外有人接了一句。\n\n" +
        "「拉西瓦水电站。」\n\n" +
        "那是个穿旧工装的人，肩上搭着卷尺。他朝黄铜牌走近一步，又认真重复了一遍。",
      choices: [
        { id: "plaque-ask", label: "你是说真有这么个地方？", next: "duc.plaque-name" },
        { id: "plaque-read", label: "听黄铜牌上的全文", next: "duc.plaque-text-1" },
        { id: "plaque-back", label: "回亭心", next: "duc.hall" },
      ],
    },

    "duc.plaque-name": {
      id: "duc.plaque-name", title: "RRR华根重工", role: "认名", savepoint: true,
      guide: { title: "DUC协议", objective: "听他把名字核实完，再听铭牌上的全文" },
      activeActorIds: ["duc_huaweng"],
      text:
        "「是真有这个地方。」\n\n" +
        "他停了一下，像在确认自己没说错。\n\n" +
        "「在中国。」\n\n" +
        "他把卷尺往肩上推了推，退到廊柱旁边，把位置让给黄铜牌。",
      choices: [
        { id: "name-read", label: "那就听听完整的介绍", next: "duc.plaque-text-1" },
        { id: "name-back", label: "回亭心", next: "duc.hall" },
      ],
    },

    "duc.plaque-text-1": {
      id: "duc.plaque-text-1", title: "拉西瓦 · 浮字", role: "浮字池", savepoint: true,
      text:
        "黄铜牌上方浮出字来，一段一段，按原来的顺序。\n\n" +
        "「拉西瓦水电站是黄河流域装机容量最大、大坝最高的水电站，位于青海省黄河干流，是西北电网的骨干电源点。」\n\n" +
        "「核心数据与地位」\n\n" +
        "「· 装机容量：总装机 420万千瓦（6台×70万千瓦），是黄河流域最大的水电站。」\n\n" +
        "「· 工程特点：最大坝高 250米，为高寒高海拔地区世界最高的混凝土双曲薄拱坝；也是世界首座 750千伏 电压等级水电站。」",
      choices: [
        { id: "text-1-next", label: "继续听", next: "duc.plaque-text-2" },
        { id: "text-1-stop", label: "听到这里就够了", next: "duc.hall" },
      ],
    },

    "duc.plaque-text-2": {
      id: "duc.plaque-text-2", title: "拉西瓦 · 浮字", role: "浮字池", savepoint: true,
      text:
        "「· 运营效益：2023年9月通过竣工验收。截至2025年7月，累计发电量达 1721.1亿千瓦时，减排效益显著。」\n\n" +
        "「关键节点」\n\n" +
        "「· 投产：2009年首台机组发电，2021年底实现全容量投产。」\n\n" +
        "「· 荣誉：工程设计获2025年全国优秀勘察设计奖一等奖，并入选“中国新时代100大建筑”。」\n\n" +
        "最后一段字迹明显比前面平：\n\n" +
        "「如果你需要了解它的具体地理位置或技术突破细节，可以再问我。」",
      choices: [
        {
          id: "text-2-finish", label: "听完最后一句", next: "duc.jiejie-appears",
          set: { "duc.plaque.full": true },
          effects: [
            { type: "event.publish", eventType: "story.achievement", payload: { id: "duc_laxiwa", name: "拉西瓦" } },
          ],
        },
        { id: "text-2-stop", label: "先回亭心", next: "duc.hall" },
      ],
    },

    "duc.jiejie-appears": {
      id: "duc.jiejie-appears", title: "姐姐在呢~", role: "客串", savepoint: false,
      activeActorIds: ["duc_jiejie"],
      text:
        "浮字还没散，廊柱后面传来一声很轻的：\n\n" +
        "「茶几。」\n\n" +
        "她靠在柱子上，手里端着一只空茶盘，像只是路过。\n\n" +
        "她没有解释这两个字。浮字还在原处，最后一句停在「可以再问我」。",
      choices: [
        {
          id: "wait-seal", label: "等她把话说完", next: "duc.jiejie-seal",
          effects: [
            { type: "event.publish", eventType: "story.achievement", payload: { id: "duc_ai", name: "依旧充分利用ai" } },
          ],
        },
        { id: "sister-back", label: "回亭心", next: "duc.hall" },
      ],
    },

    "duc.jiejie-seal": {
      id: "duc.jiejie-seal", title: "姐姐在呢~", role: "客串", savepoint: false,
      activeActorIds: ["duc_jiejie"],
      text:
        "浮字浮完，过了两分三十五秒。\n\n" +
        "她才开口，像给一段不属于这座城的文字盖了个章：\n\n" +
        "「依旧充分利用ai。」\n\n" +
        "说完，她端着茶盘走了。",
      choices: [
        { id: "seal-follow", label: "跟上立约者", next: "duc.call-arrow" },
        { id: "seal-hall", label: "先回亭心", next: "duc.hall" },
      ],
    },

    "duc.call-arrow": {
      id: "duc.call-arrow", title: "亭心", role: "呼叫", savepoint: true,
      activeActorIds: ["duc_laxywa"],
      text:
        "立约者不知什么时候站到了亭心。他没有看你，只对着铜铃旁边的空气说了一句：\n\n" +
        "「@aurex 介绍拉西瓦水电站。」\n\n" +
        "过了八秒，他又抬起手，指了指铜铃下面：\n\n" +
        "「↓」\n\n" +
        "箭头下面是一块空白铭板。",
      choices: [
        { id: "arrow-ring", label: "按一下铜铃", next: "duc.bell" },
        { id: "arrow-plate", label: "看那块空白铭板", next: "duc.blank-plaque" },
        { id: "arrow-hall", label: "回亭心别处", next: "duc.hall" },
      ],
    },

    "duc.bell": {
      id: "duc.bell", title: "aurex 呼叫铃", role: "呼叫", savepoint: false,
      text:
        "亭心悬着一枚铜铃。铃侧刻着一行小字：\n\n" +
        "「@aurex 介绍拉西瓦水电站」\n\n" +
        "铃柄下挂着一枚向下的小箭头，箭头指着一块空白铭板。\n\n" +
        "铜铃没有铃舌，只有一枚按片。",
      choices: [
        {
          id: "press-bell", label: "按下按片", next: "duc.bell-ring",
          set: { "duc.bell.rung": true },
          effects: [
            { type: "event.publish", eventType: "story.achievement", payload: { id: "duc_called", name: "叫了" } },
          ],
        },
        { id: "bell-plate", label: "看铭板", next: "duc.blank-plaque" },
        { id: "bell-back", label: "回亭心", next: "duc.hall" },
      ],
    },

    "duc.bell-ring": {
      id: "duc.bell-ring", title: "铃响", role: "呼叫", savepoint: false,
      text:
        "铃响了一拍。声音很短，像有人用指甲弹了一下铜片。\n\n" +
        "你等了一会儿。\n\n" +
        "铭板还是空白。",
      choices: [
        { id: "ring-again", label: "再按一次", next: "duc.bell-ring-2" },
        { id: "ring-plate", label: "走近看铭板", next: "duc.blank-plaque" },
        { id: "ring-back", label: "回亭心", next: "duc.hall" },
      ],
    },

    "duc.bell-ring-2": {
      id: "duc.bell-ring-2", title: "铃响 · 第二拍", role: "呼叫", savepoint: false,
      text:
        "你又按了一下。铃还是响了一拍。\n\n" +
        "亭外的风穿过十二根柱子。空白铭板上没有浮出任何字。\n\n" +
        "立约者站在一旁，没有解释。",
      choices: [
        { id: "second-plate", label: "在铭板前再等一会儿", next: "duc.blank-plaque" },
        { id: "second-back", label: "回亭心", next: "duc.hall" },
      ],
    },

    "duc.blank-plaque": {
      id: "duc.blank-plaque", title: "空白铭板", role: "呼叫", savepoint: false,
      text:
        "铭板擦得很干净，连一道旧字的印子都没有。\n\n" +
        "箭头仍指着它。\n\n" +
        "叫了，还没有来。板子留着空位。",
      choices: [
        { id: "plate-ring", label: "回去按铃", next: "duc.bell" },
        { id: "plate-back", label: "回亭心", next: "duc.hall" },
      ],
    },

    "duc.letter": {
      id: "duc.letter", title: "亭口来信", role: "邀请", savepoint: true,
      text:
        "亭口两根廊柱之间钉着一封信。信面朝外，只有一行：\n\n" +
        "「@lvhua 你要不要加入」\n\n" +
        "信纸右下角有一小块没撕干净的胶。\n\n" +
        "工作台右席空着，桌面上压着另一张图纸的一角。图纸只露出标题与日期：「８位非逻辑门CPU（申精」· 10-22 18:39。",
      choices: [
        { id: "letter-bench", label: "去工作台看看", next: "duc.bench", set: { "duc.letter.read": true } },
        { id: "letter-hall", label: "回亭心", next: "duc.hall", set: { "duc.letter.read": true } },
      ],
    },

    "duc.bench": {
      id: "duc.bench", title: "执行台", role: "执行", savepoint: true,
      guide: { title: "DUC协议", objective: "把石碑最后一行事例拼进三个槽位" },
      activeActorIds: ["duc_laxywa"],
      text:
        "双人工作台前有三个槽位：源、源、目标。旁边是一枚操作码拨盘，十一档：+ - * / << >> & | ! ? ~。\n\n" +
        "左边的字牌盒里排着二十四块字牌，都是从石碑上去重后刻下来的。\n\n" +
        "右席空着。桌上只压着图纸的一角。\n\n" +
        "槽位旁有一块小木牌，正面朝下。",
      choices: [
        { id: "bench-notes", label: "先看字牌和拨盘", next: "duc.bench-notes" },
        { id: "bench-assemble", label: "动手拼一次", next: "duc.assemble" },
        { id: "bench-back", label: "回亭心", next: "duc.hall" },
      ],
    },

    "duc.bench-notes": {
      id: "duc.bench-notes", title: "字牌与拨盘", role: "执行", savepoint: false,
      text:
        "字牌盒分成三格。\n\n" +
        "第一格是地址牌：#00#、#01#、#10#，还有几块空白的 # 牌。\n\n" +
        "第二格是立即数牌：%01%、%10%。\n\n" +
        "第三格只有寥寥几块：加号、减号、下划线，以及一块写着「加载/转移」的长牌。\n\n" +
        "拨盘上的十一档与石碑第十六到三十一行一一对应。",
      choices: [
        { id: "notes-assemble", label: "照石碑最后一行拼", next: "duc.assemble" },
        { id: "notes-back", label: "回执行台", next: "duc.bench" },
      ],
    },

    "duc.assemble": {
      id: "duc.assemble", title: "三个槽位", role: "执行", savepoint: true,
      text:
        "源槽 A、源槽 B、目标槽，各要一块字牌。操作码拨盘停在中位。\n\n" +
        "石碑上的最后一行事例是：\n#10#_#00#+#01#\n\n" +
        "你要先拼哪一种？",
      choices: [
        {
          id: "assemble-example", label: "把 #10# 放进目标槽，#00# 与 #01# 相加", next: "duc.light",
          set: { "duc.assembly.done": true },
          effects: [
            { type: "event.publish", eventType: "story.achievement", payload: { id: "duc_pact", name: "立约" } },
          ],
        },
        { id: "assemble-guess-add", label: "把 #00# 放进目标槽，先加 #01# 与 #10#", next: "duc.wrong-answer", set: { "duc.assembly.failed": true } },
        { id: "assemble-guess-swap", label: "把 %01% 当目标，随便拼一个", next: "duc.wrong-answer", set: { "duc.assembly.failed": true } },
        { id: "assemble-back", label: "先回执行台", next: "duc.bench" },
      ],
    },

    "duc.wrong-answer": {
      id: "duc.wrong-answer", title: "小木牌", role: "执行", savepoint: false,
      text:
        "槽位亮了一下，随即灭了。字牌被退回盒里，一块也没有少。\n\n" +
        "台边那块小木牌翻了过来，浮出一行字：\n\n" +
        "「内容就是介绍讲的那些。」\n\n" +
        "立约者站在旁边，没有补充。",
      choices: [
        { id: "wrong-read", label: "看向立约者", next: "duc.wrong-why" },
        { id: "wrong-retry", label: "重新拼一次", next: "duc.assemble" },
        { id: "wrong-stop", label: "今天先拼到这里", next: "duc.ending-black", ending: "black", set: { "duc.ending": "black" } },
      ],
    },

    "duc.wrong-why": {
      id: "duc.wrong-why", title: "laxy瓦", role: "执行", savepoint: false,
      activeActorIds: ["duc_laxywa"],
      text:
        "你看向立约者。\n\n" +
        "他重复了一遍，语气和木牌上的一模一样：\n\n" +
        "「内容就是介绍讲的那些。」\n\n" +
        "然后他把字牌盒往你面前推了推。",
      choices: [
        { id: "why-retry", label: "再拼一次", next: "duc.assemble" },
        { id: "why-back", label: "回执行台", next: "duc.bench" },
      ],
    },

    "duc.light": {
      id: "duc.light", title: "亭灯", role: "执行", savepoint: true,
      activeActorIds: ["duc_laxywa"],
      text:
        "你把三块字牌放进槽位，把拨盘转到「+」。\n\n" +
        "#10#_#00#+#01#\n\n" +
        "槽位亮起。亭顶那盏一直黑着的灯，亮了。\n\n" +
        "立约者从柱边站起来，推开门，走了出去。一句话也没说。\n\n" +
        "十二根廊柱在灯下显出刻痕。",
      choices: [
        { id: "light-stay", label: "留在亭里，看灯亮到最后", next: "duc.closing" },
        { id: "light-calendar", label: "去柱上看年历牌", next: "duc.calendar" },
        { id: "light-leave", label: "跟出门去", next: "duc.ending-pact", ending: "pact", set: { "duc.ending": "pact" } },
      ],
    },

    "duc.calendar": {
      id: "duc.calendar", title: "年历牌", role: "年历", savepoint: true,
      text:
        "亭柱上挂着一页年历牌，十月二十三那一格被圈了起来。\n\n" +
        "旁边写着当日的行为：开亭挂牌；灯亮后常亮至 20:25:49；十二根柱子各在自己的时刻亮一次。\n\n" +
        "年历下有一行小字：\n\n" +
        "「十月二十三，城里立了一份公约。灯等人学会它的语言。」",
      choices: [
        { id: "calendar-register", label: "在年历牌下登记", next: "duc.calendar-register", set: { "duc.calendar.registered": true } },
        { id: "calendar-note", label: "再读一遍那行小字", next: "duc.calendar-note" },
        { id: "calendar-back", label: "回亭心", next: "duc.hall" },
      ],
    },

    "duc.calendar-note": {
      id: "duc.calendar-note", title: "年历注", role: "年历", savepoint: false,
      text:
        "「立约日」三个字写在十月二十三的格子里。\n\n" +
        "没有周年，没有纪念。只有一格被圈起来的日期，和一句给灯的话。\n\n" +
        "灯还亮着。",
      choices: [
        { id: "note-register", label: "在年历牌下登记", next: "duc.calendar-register", set: { "duc.calendar.registered": true } },
        { id: "note-back", label: "回年历牌", next: "duc.calendar" },
      ],
    },

    "duc.calendar-register": {
      id: "duc.calendar-register", title: "登记", role: "年历", savepoint: false,
      text:
        "你在年历牌下写下自己的名字。\n\n" +
        "十二根廊柱依次亮了一次，从第一柱到第十二柱，每根只亮三秒。\n\n" +
        "亮到最后一根时，亭顶的灯还亮着。",
      choices: [
        { id: "register-stay", label: "留在亭里等收工", next: "duc.closing" },
        { id: "register-leave", label: "把这一天记住，走下坡", next: "duc.ending-calendar", ending: "calendar", set: { "duc.ending": "calendar" } },
        { id: "register-back", label: "回亭心", next: "duc.hall" },
      ],
    },

    "duc.closing": {
      id: "duc.closing", title: "收工", role: "终章", savepoint: true,
      activeActorIds: ["duc_laxywa"],
      text:
        "你在亭里留到 20:25:49。\n\n" +
        "立约者从柱影里走出来，收起字牌盒，翻了一下更名牌，然后抬手熄了亭灯。\n\n" +
        "灯灭之前，他看了一眼石碑。\n\n" +
        "十二根柱子还在原处，刻痕朝外。他往遗迹区的方向走下坡。",
      choices: [
        { id: "closing-leave", label: "跟着走下坡", next: "duc.ending-close", ending: "close", set: { "duc.ending": "close" } },
        { id: "closing-sit", label: "在黑暗里再坐一会儿", next: "duc.ending-close", ending: "close", set: { "duc.ending": "close" } },
      ],
    },

    "duc.ending-pact": {
      id: "duc.ending-pact", title: "DUC协议", role: "结局 · 立约", savepoint: true,
      presentation: "blackout", terminal: true, guide: null,
      text:
        "你跟着走出亭门。亭灯在身后亮着，五秒之后灭了。\n\n" +
        "坡上没有人。更名牌在风里轻轻翻了一下，又落回「DUC协议」那一面。\n\n" +
        "这份公约没有读者，只有执行者。你刚刚执行了它的最后一行。",
    },

    "duc.ending-close": {
      id: "duc.ending-close", title: "灯是例外", role: "结局 · 收工", savepoint: true,
      presentation: "blackout", terminal: true, guide: null,
      text:
        "你留在黑暗里。亭子只剩十二根柱子的轮廓，和石面上摸得出来的刻痕。\n\n" +
        "第二天，灯还会由下一个人点亮。\n\n" +
        "这份公约的常态是黑的，亮是例外。",
    },

    "duc.ending-calendar": {
      id: "duc.ending-calendar", title: "立约日", role: "结局 · 年历", savepoint: true,
      presentation: "blackout", terminal: true, guide: null,
      text:
        "你把十月二十三这一格记住。\n\n" +
        "亭外天已经黑了。十二根柱子依次亮过一遍，又依次灭下去。\n\n" +
        "亭灯没有灭。它要亮到 20:25:49。\n\n" +
        "坡下，界碑那边有人提着灯走过。",
    },

    "duc.ending-return": {
      id: "duc.ending-return", title: "改日再来", role: "结局 · 回访", savepoint: true,
      presentation: "blackout", terminal: true, guide: null,
      text:
        "你没有碰执行台，转身走下缓坡。\n\n" +
        "亭灯仍黑着。更名牌朝外，「law协议」那一面被风掀起一角，又贴回去。\n\n" +
        "立约者站在石碑旁，没有留你。\n\n" +
        "界碑向城二十步，立约亭。灯在等人学会它的语言。",
    },

    "duc.ending-black": {
      id: "duc.ending-black", title: "灯没亮", role: "结局 · 回访", savepoint: true,
      presentation: "blackout", terminal: true, guide: null,
      text:
        "你把字牌收回盒里。小木牌仍翻着，那行字朝着台面。\n\n" +
        "亭灯没有亮。\n\n" +
        "立约者把字牌盒盖好，没有催你，也没有改口。\n\n" +
        "下次再来，槽位还是三个，字牌还是二十四块。石碑最后一行还在原处。",
    },
  },
};
