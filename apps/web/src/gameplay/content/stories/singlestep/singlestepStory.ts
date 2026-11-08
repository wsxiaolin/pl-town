import type { StoryDefinition } from "../../../stories/types";

export const SINGLESTEP_STORY: StoryDefinition = {
  schemaVersion: 1,
  definitionVersion: 1,
  id: "side.singlestep.cpu",
  title: "所有数电CPU都是由逻辑门组成的",
  startNode: "door",
  entryActorId: "singlestep_laxywa",
  interactions: [{ actorId: "singlestep_laxywa", nodeId: "door", choiceId: "enter-room" }],
  buildingInteractions: [{ buildingId: "singlestep_room", nodeId: "door", choiceId: "enter-room" }],
  nodes: {
    door: {
      id: "door", title: "单步机房", role: "序章", savepoint: true,
      guide: { title: "所有数电CPU都是由逻辑门组成的", objective: "走进机房，看看那台停着的机器" },
      text: "界碑向城二十五步，缓坡上立着一间浅色的小机房。门楣上钉着一块木招牌，字迹只刻到一半：\n\n「８位非逻辑门CPU（申精」\n\n窗内亮着一盏主灯。屋里没有声音，像有什么东西正停在某一拍上，等你按下去。",
      choices: [
        { id: "enter-room", label: "推门进去", next: "hall", set: { "singlestep.entered": true } },
        { id: "touch-non", label: "先碰一碰招牌上那个「非」字", next: "sign-non", set: { "singlestep.sign.non": true }, effects: [{ type: "event.publish", eventType: "story.achievement", payload: { id: "singlestep_non", name: "非，何解？" } }] },
        { id: "leave-door", label: "改天再来", next: "ending-leave", ending: "leave", set: { "singlestep.ending": "leave" } },
      ],
    },
    "sign-non": {
      id: "sign-non", title: "门楣招牌", role: "序章", savepoint: false,
      text: "你的指尖碰到那个「非」字。\n\n它亮了。\n\n灯光停在字上，三秒，不解释，也不眨眼。\n\n三秒后，它灭了。招牌还是那行字：８位非逻辑门CPU（申精",
      choices: [
        { id: "enter-after-sign", label: "推门进去", next: "hall", set: { "singlestep.entered": true } },
        { id: "back-to-door", label: "退回坡上", next: "door" },
      ],
    },
    hall: {
      id: "hall", title: "机房", role: "序章", savepoint: true,
      guide: { title: "所有数电CPU都是由逻辑门组成的", objective: "听师父说完第一课" },
      activeActorIds: ["singlestep_laxywa"],
      text: "机房正中是一台手搓的 8 位 CPU。控制台上三枚开关，ROM 区八枚拨码，左侧一只数码管，右侧两盏 IR 监视灯，顶上一枚与门。\n\n门在你身后合上时，坡上传来脚步声。一个高个男人从立约亭方向走来，站到机器旁。\n\n「注意啦，数电的输出端(即红色端)不能连在一起，包括连在同一个输入。」",
      choices: [
        { id: "ask-red", label: "红色端为什么不能连在一起？", next: "lesson-clock", set: { "singlestep.lesson.red": true } },
        { id: "go-machine-first", label: "先走近机器看看", next: "machine-idle", set: { "singlestep.lesson.red": true } },
      ],
    },
    "lesson-clock": {
      id: "lesson-clock", title: "laxy瓦", role: "教学", savepoint: false,
      activeActorIds: ["singlestep_laxywa"],
      text: "他蹲下去，指了指机器右下角。\n\n「右下角逻辑输入连clock，时钟也连接了clock。」\n\n他的手指在两根并排的线上停了一下，没有再多说。",
      choices: [
        { id: "to-machine", label: "去看那台机器", next: "machine-idle", set: { "singlestep.lesson.red": true } },
        { id: "ask-or", label: "有好多并联的位置，怎么办？", next: "lesson-or", set: { "singlestep.lesson.red": true } },
      ],
    },
    "lesson-or": {
      id: "lesson-or", title: "laxy瓦", role: "教学", savepoint: false,
      activeActorIds: ["singlestep_laxywa"],
      text: "「把并联换成或门连接。」\n\n他从口袋里摸出一小截线，在 ROM 拨码区边上比了个方向。\n\n「先记住这一句。等你打开烧录指南，再讲格式。」",
      choices: [
        { id: "or-to-glass", label: "回到侧窗玻璃前", next: "glass", set: { "singlestep.lesson.or": true } },
        { id: "or-to-machine", label: "回到机器前", next: "machine-idle", set: { "singlestep.lesson.or": true } },
      ],
    },
    "machine-idle": {
      id: "machine-idle", title: "单步机房", role: "单步", savepoint: true,
      guide: { title: "所有数电CPU都是由逻辑门组成的", objective: "按一下顶层红色单步钮，看它走一拍" },
      activeActorIds: ["singlestep_laxywa"],
      text: "机器停着。PC 的四格指针停在 Row 0，IR 两盏灯都暗着，数码管显示 0。\n\n顶层红色点动按钮就在手边。按一下，它只走一拍。\n\n旁边还有 ROM 拨码区、窗边一本线装留言簿、侧窗玻璃上的三行刻字，以及墙上的两块手册告示牌。",
      choices: [
        { id: "step-once", label: "按下顶层红色单步钮", next: "beat-1", set: { "singlestep.seen.machine": true } },
        { id: "view-rom", label: "查看八枚拨码", next: "rom-panel" },
        { id: "view-guestbook", label: "翻留言簿", next: "guestbook-cover" },
        { id: "view-glass", label: "看侧窗玻璃上的刻字", next: "glass" },
        { id: "view-plaque", label: "看门内铭牌", next: "plaque" },
        { id: "view-board-b", label: "读牌 B：指令集与演示程序", next: "board-b" },
        { id: "view-board-d", label: "读牌 D：停机现场", next: "board-d" },
        { id: "visit-tablet", label: "走到亭口看一眼木牌", next: "tablet-memory", set: { "singlestep.tablet.known": true } },
        { id: "leave-machine", label: "先离开机房", next: "ending-leave", ending: "leave", set: { "singlestep.ending": "leave" } },
      ],
    },
    "beat-1": {
      id: "beat-1", title: "第一拍", role: "FETCH / EXEC", savepoint: false,
      text: "前半拍，FETCH。IR 两盏灯亮起 00，PC 指针还在 Row 0。\n\n后半拍，EXEC。ALU 灯闪了一次，数码管从 0 跳到 1。PC 向前一格，停到 Row 1。\n\n一拍结束，机器又停住了。",
      choices: [
        { id: "beat-1-next", label: "再按一下", next: "beat-2" },
        { id: "beat-1-pause", label: "先停在这里", next: "machine-idle" },
      ],
    },
    "beat-2": {
      id: "beat-2", title: "第二拍", role: "FETCH / EXEC", savepoint: false,
      text: "前半拍，FETCH。IR 再次亮起 00。\n\n后半拍，EXEC。数码管从 1 跳到 2，PC 推到 Row 2。\n\n寄存器 B 的 1 又被加了一次。机器仍然没有自己往下跑。",
      choices: [
        { id: "beat-2-next", label: "再按一下", next: "beat-3" },
        { id: "beat-2-pause", label: "先停在这里", next: "machine-idle" },
      ],
    },
    "beat-3": {
      id: "beat-3", title: "第三拍", role: "FETCH / EXEC", savepoint: false,
      text: "前半拍，FETCH。IR 亮起 01。\n\n后半拍，EXEC。青色反相求补线亮了半秒，数码管从 2 回到 1。PC 推到 Row 3。\n\nSUB 的补码减法写回了 A。",
      choices: [
        { id: "beat-3-next", label: "执行最后一拍", next: "beat-4-hlt", set: { "singlestep.four.beats": true }, effects: [{ type: "event.publish", eventType: "story.achievement", payload: { id: "singlestep_four_beats", name: "四拍" } }] },
        { id: "beat-3-pause", label: "先停在这里", next: "machine-idle" },
      ],
    },
    "beat-4-hlt": {
      id: "beat-4-hlt", title: "第四拍 · HLT", role: "FETCH / EXEC / PC / HLT", savepoint: true,
      text: "前半拍，FETCH。IR 两盏灯一起亮到 HIGH/HIGH，也就是 11。\n\n后半拍，EXEC。HLT 停机与门被激活，长蓝线从 IR 一路亮回顶部门控。方波被切断，整机锁死。\n\n数码管稳停在 1。PC 指针停在 Row 3。现在，只有底层红色 RESET 钮可按。",
      choices: [
        { id: "press-reset", label: "按底层 RESET 钮", next: "reset" },
        { id: "check-board-d", label: "对照牌 D 核对停机状态", next: "board-d" },
        { id: "stay-locked", label: "就让它停着", next: "ending-locked", ending: "locked", set: { "singlestep.ending": "locked" } },
      ],
    },
    reset: {
      id: "reset", title: "复位", role: "RESET", savepoint: false,
      text: "你按下底层红色点动按钮。\n\nPC 计数器清零，IR 被补入一拍取指脉冲，停机自锁解除。数码管回到 0，机器重新可跑。\n\n像一次很短的呼吸。",
      choices: [
        { id: "rerun", label: "再跑一轮", next: "rerun-hlt", set: { "singlestep.rerun": true }, effects: [{ type: "event.publish", eventType: "story.achievement", payload: { id: "singlestep_rerun", name: "唤醒与重跑" } }] },
        { id: "reset-back", label: "先不跑", next: "machine-idle" },
      ],
    },
    "rerun-hlt": {
      id: "rerun-hlt", title: "第二轮", role: "四拍", savepoint: true,
      text: "第二轮走完。IR 再次停在 11，长蓝线亮起，数码管稳稳停在 1。\n\n停机和上一次一模一样。机器不记得自己跑过几轮。",
      choices: [
        { id: "rerun-back", label: "回到机器前", next: "machine-idle" },
        { id: "rerun-stay", label: "让它继续停着", next: "ending-locked", ending: "locked", set: { "singlestep.ending": "locked" } },
      ],
    },
    "board-d": {
      id: "board-d", title: "牌 D · 停机现场", presentation: "document", savepoint: false,
      text: "牌上列着停机时要核对的五件事：\n\n一、PC 计数器走完 4 步，指针停在 Row 3。\n二、IR 两盏监视灯全部点亮，显示 11。\n三、长蓝线把 11 信号送回顶部门控逻辑。\n四、与门关断脉冲输出，方波被阻隔。\n五、运算结果稳稳停在最终数值上。\n\n最下面一行字很小：\n\n「……这个是测试档，有些按键没排列整齐」",
      choices: [
        { id: "board-d-back", label: "回到机器前", next: "machine-idle" },
        { id: "board-d-reset", label: "按 RESET 再跑一轮", next: "reset" },
      ],
    },
    "rom-panel": {
      id: "rom-panel", title: "八枚拨码", role: "烧录", savepoint: true,
      text: "ROM 区是 4 行 × 2 列，一共八枚拨码。Row 0 到 Row 3，每行左边是高位，右边是低位。\n\n拨 HIGH 或 LOW，就是给这台机器现场烧录微程序。每行四种组合：00、01、10、11。\n\n寄存器 B 固定预置 1，为加减法提供基数。",
      choices: [
        { id: "rom-default", label: "读默认演示程序", next: "rom-default" },
        { id: "rom-count", label: "只写 00 和 11：数数机", next: "rom-count" },
        { id: "rom-nop", label: "写一条 10：空指令", next: "rom-nop" },
        { id: "rom-loop", label: "全行都不写 11：让它循环", next: "rom-loop" },
        { id: "rom-custom", label: "自己排一版程序", next: "rom-custom" },
        { id: "rom-back", label: "回到机器前", next: "machine-idle" },
      ],
    },
    "rom-default": {
      id: "rom-default", title: "默认程序", presentation: "document", savepoint: false,
      text: "Row 0：00 ADD → A=0+1=1\nRow 1：00 ADD → A=1+1=2\nRow 2：01 SUB → A=2-1=1\nRow 3：11 HLT → 停机锁死，等待按键复位\n\n拨码已经按这四行排好。自动挡在 LOW，机器停着。",
      choices: [
        { id: "run-default", label: "按单步钮，从第一拍开始", next: "beat-1", set: { "singlestep.program": "default" } },
        { id: "default-back", label: "再看别的程序", next: "rom-panel" },
      ],
    },
    "rom-count": {
      id: "rom-count", title: "数数机", savepoint: false,
      text: "你把四行写成 00、00、00、11：三次累加，最后一拍停机。\n\n寄存器 B 是 1，所以每走一拍，数码管就加一。",
      choices: [
        { id: "run-count", label: "拨到自动挡，看它数数", next: "rom-count-run", set: { "singlestep.program": "count" } },
        { id: "count-back", label: "重新拨码", next: "rom-panel" },
      ],
    },
    "rom-count-run": {
      id: "rom-count-run", title: "数数机", savepoint: false,
      text: "自动挡 HIGH，机器约半秒一拍地跑起来。\n\n数码管从 0 跳到 1，再跳到 2，再跳到 3。第四拍 IR 亮起 11，长蓝线亮，整机停在 3。\n\n八枚拨码真的能改写它的下一轮。",
      choices: [{ id: "count-run-back", label: "回到机器前", next: "machine-idle" }],
    },
    "rom-nop": {
      id: "rom-nop", title: "空指令", savepoint: false,
      text: "你在第二行拨出 10。\n\n10 是 NOP，预留的空指令，后续可以扩展跳转。它不会改动 A，只让 PC 指针空走一拍。",
      choices: [
        { id: "run-nop", label: "单步看它空走", next: "rom-nop-run", set: { "singlestep.program": "nop" } },
        { id: "nop-back", label: "重新拨码", next: "rom-panel" },
      ],
    },
    "rom-nop-run": {
      id: "rom-nop-run", title: "空指令", savepoint: false,
      text: "IR 亮起 10，数码管没有变化。PC 向前一格，程序继续。\n\n这一拍被机器走掉了，却没有留下任何运算。",
      choices: [{ id: "nop-run-back", label: "回到机器前", next: "machine-idle" }],
    },
    "rom-loop": {
      id: "rom-loop", title: "循环", savepoint: false,
      text: "你把四行都写成不含 11 的程序，最后一行留 00。\n\n没有停机指令，PC 走完四步后会回到 Row 0，继续下一轮。",
      choices: [
        { id: "run-loop", label: "拨到自动挡，看它回卷", next: "rom-loop-run", set: { "singlestep.program": "loop" } },
        { id: "loop-back", label: "重新拨码", next: "rom-panel" },
      ],
    },
    "rom-loop-run": {
      id: "rom-loop-run", title: "循环", savepoint: false,
      text: "机器跑完四拍，指针没有锁死，而是回到 Row 0。\n\n数码管继续加。它不会自己停，除非你把自动挡拨回 LOW，或者按下 RESET。",
      choices: [{ id: "loop-run-back", label: "回到机器前", next: "machine-idle" }],
    },
    "rom-custom": {
      id: "rom-custom", title: "自编程序", savepoint: false,
      text: "八枚拨码都在你手边。每一行只能选 00、01、10、11。\n\n你可以把加法、减法、空指令和停机排成任意顺序。只要最后有一行是 11，机器就会在那一拍锁死。",
      choices: [
        { id: "custom-a", label: "排 00 / 00 / 01 / 11", next: "rom-run-custom", set: { "singlestep.program.custom": "add-add-sub-hlt" }, effects: [{ type: "event.publish", eventType: "story.achievement", payload: { id: "singlestep_burner", name: "烧录工" } }] },
        { id: "custom-b", label: "排 10 / 00 / 11 / 11", next: "rom-run-custom", set: { "singlestep.program.custom": "nop-add-hlt-hlt" }, effects: [{ type: "event.publish", eventType: "story.achievement", payload: { id: "singlestep_burner", name: "烧录工" } }] },
        { id: "custom-back", label: "回到机器前", next: "machine-idle" },
      ],
    },
    "rom-run-custom": {
      id: "rom-run-custom", title: "自编程序", role: "烧录", savepoint: true,
      text: "你按下自动挡。机器按你排的顺序跑完，IR 最终停在 11，长蓝线亮起，数码管停在你写下的结果上。\n\n它没有问这版程序是谁写的。拨码在，程序就在。",
      choices: [
        { id: "custom-back-machine", label: "回到机器前", next: "machine-idle" },
        { id: "custom-ending", label: "把这一版留在机器里", next: "ending-burner", ending: "burner", set: { "singlestep.ending": "burner" } },
      ],
    },
    glass: {
      id: "glass", title: "侧窗玻璃", savepoint: true,
      text: "侧窗玻璃上刻着三行字，每行后面都有一个小小的时刻。\n\n第一行，07:36:29：「是这么设计的，保持同步计算」\n第二行，07:37:16：「那这个怎么做呢？有好多并联的位置，没办法」\n第三行，19:28:05：「那东西不是一般多啊」",
      choices: [
        { id: "glass-line-1", label: "碰第一行刻字", next: "glass-line1" },
        { id: "glass-line-2", label: "碰第二行刻字", next: "lesson-or" },
        { id: "glass-line-3", label: "碰第三行刻字", next: "consolation-1" },
        { id: "compare-boards", label: "把第三行和亭口木牌并排看", next: "puzzle-44", availableWhen: [{ type: "flag.equals", flagId: "singlestep.glass.line3", value: true }, { type: "flag.equals", flagId: "singlestep.tablet.known", value: true }], set: { "singlestep.44s": true }, effects: [{ type: "event.publish", eventType: "story.achievement", payload: { id: "singlestep_44s", name: "44 秒" } }] },
        { id: "glass-back", label: "回到机器前", next: "machine-idle" },
      ],
    },
    "glass-line1": {
      id: "glass-line1", title: "第一行刻字", savepoint: false,
      text: "玻璃行亮了一下，又暗下去。\n\n「是这么设计的，保持同步计算」\n\n师父没有为这一行开口。它只是刻在这里。",
      choices: [{ id: "glass-line1-back", label: "回到玻璃前", next: "glass" }],
    },
    "consolation-1": {
      id: "consolation-1", title: "laxy瓦", role: "四连播", savepoint: false,
      activeActorIds: ["singlestep_laxywa"],
      text: "你碰到第三行。师父从机器与玻璃之间走过来。\n\n「不会多。」\n\n他停了一下，像在等你先别急着反驳。",
      choices: [{ id: "consolation-1-next", label: "等他说下去", next: "consolation-2" }],
    },
    "consolation-2": {
      id: "consolation-2", title: "laxy瓦", role: "四连播", savepoint: false,
      activeActorIds: ["singlestep_laxywa"],
      text: "「就方波发生器来讲，对应的数电元件不到3个。」\n\n他伸出手指，点了点机器右下角那几枚小元件。",
      choices: [{ id: "consolation-2-next", label: "继续听", next: "consolation-3" }],
    },
    "consolation-3": {
      id: "consolation-3", title: "laxy瓦", role: "四连播", savepoint: false,
      activeActorIds: ["singlestep_laxywa"],
      text: "「对了这CPU就是逻辑门组成的。」\n\n他说完，没有立刻接下一句。机房里安静了一秒。",
      choices: [{ id: "consolation-3-next", label: "等那一秒过去", next: "consolation-4" }],
    },
    "consolation-4": {
      id: "consolation-4", title: "laxy瓦", role: "四连播", savepoint: true,
      activeActorIds: ["singlestep_laxywa"],
      text: "「所有数电CPU都是由逻辑门组成的。」\n\n他说完这句，转身往立约亭的方向走。走到门口又停下，但没有回头。\n\n玻璃上的第三行还亮着。",
      choices: [
        { id: "consolation-4-back", label: "回到玻璃前", next: "glass", set: { "singlestep.glass.line3": true } },
        { id: "consolation-4-compare", label: "把两处时刻并排看", next: "puzzle-44", availableWhen: [{ type: "flag.equals", flagId: "singlestep.tablet.known", value: true }], set: { "singlestep.glass.line3": true, "singlestep.44s": true }, effects: [{ type: "event.publish", eventType: "story.achievement", payload: { id: "singlestep_44s", name: "44 秒" } }] },
        { id: "consolation-4-ending", label: "站在原地，把这句话听完", next: "ending-title", ending: "title", set: { "singlestep.glass.line3": true, "singlestep.ending": "title" } },
      ],
    },
    plaque: {
      id: "plaque", title: "门内铭牌", presentation: "document", savepoint: false,
      text: "门内侧钉着一块小铭牌。\n\n「一个纯懒技术人员，欢迎大家一起讨论问题」\n\n下面只有一行等级：Lv 4。\n\n铭牌旁边没有照片，也没有名字。机房的主人把机器留在这里，人没有出现。",
      choices: [{ id: "plaque-back", label: "回到机器前", next: "machine-idle" }],
    },
    "board-b": {
      id: "board-b", title: "牌 B · 指令集", presentation: "document", savepoint: false,
      text: "牌 B 上半是四行 ISA：\n\n00 ADD：A=A+B\n01 SUB：A=A-B，补码减法写回 A\n10 NOP：预留空指令\n11 HLT：停机锁死\n\n下半是默认演示程序：\nRow 0 00 → A=1\nRow 1 00 → A=2\nRow 2 01 → A=1\nRow 3 11 → 停机\n\n旁边有一行手写批注：「其实写指令集有一套物实格式。」",
      choices: [{ id: "board-b-back", label: "回到机器前", next: "machine-idle" }],
    },
    "guestbook-cover": {
      id: "guestbook-cover", title: "留言簿", presentation: "document", savepoint: true,
      text: "窗边放着一本线装留言簿。封面只有一行小字：\n\n「欢迎在评论区交流或改编测试」\n\n纸页很薄，翻动时会发出干涩的声响。",
      choices: [
        { id: "guestbook-read", label: "从第一页开始翻", next: "guestbook-1" },
        { id: "guestbook-close", label: "合上簿子", next: "machine-idle" },
      ],
    },
    "guestbook-1": {
      id: "guestbook-1", title: "留言簿 · 一至四页", presentation: "document", savepoint: false,
      text: "第一页：空白。页心只留下一个换行。\n\n第二页：「第二个 @laxy瓦 ？」\n\n第三页：「注意啦，数电的输出端(即红色端)不能连在一起，包括连在同一个输入」\n\n第四页：「右下角逻辑输入连clock，时钟也连接了clock」",
      choices: [
        { id: "guestbook-1-next", label: "翻到第五页", next: "guestbook-2" },
        { id: "guestbook-1-close", label: "合上簿子", next: "machine-idle" },
      ],
    },
    "guestbook-2": {
      id: "guestbook-2", title: "留言簿 · 五至八页", presentation: "document", savepoint: false,
      text: "第五页：「是这么设计的，保持同步计算」\n\n第六页：「那这个怎么做呢？有好多并联的位置，没办法」\n\n第七页：「把并联换成或门连接」\n\n第八页：「其实写指令集有一套物实格式」",
      choices: [
        { id: "guestbook-2-next", label: "翻到第九页", next: "guestbook-3" },
        { id: "guestbook-2-close", label: "合上簿子", next: "machine-idle" },
      ],
    },
    "guestbook-3": {
      id: "guestbook-3", title: "留言簿 · 九至十二页", presentation: "document", savepoint: false,
      text: "第九页：「我以前没掌握数电基础的时候用过二级管，那时候做的是数字显示嚣」\n\n同一页下缘有一行红字：「数电模电混用真的可能出bug」\n\n第十页：「那东西不是一般多啊」\n\n第十一页：「不会多」\n\n第十二页：「就方波发生器来讲，对应的数电元件不到3个」",
      choices: [
        { id: "guestbook-3-next", label: "翻到第十三页", next: "guestbook-4" },
        { id: "guestbook-3-close", label: "合上簿子", next: "machine-idle" },
      ],
    },
    "guestbook-4": {
      id: "guestbook-4", title: "留言簿 · 十三至十六页", presentation: "document", savepoint: true,
      text: "第十三页：「就方波发生器来讲，对应的数电元件不到3个」\n\n第十四页：「对了这CPU就是逻辑门组成的」\n\n第十五页：「所有数电CPU都是由逻辑门组成的」\n\n第十六页：「bro拿AI写完介绍记得校一遍」\n\n封底压着一枚页码印章：「十七」。你碰了碰它，浮起的只有两个字：不可达。",
      choices: [{ id: "guestbook-4-close", label: "合上簿子", next: "machine-idle", set: { "singlestep.guestbook.read": true } }],
    },
    "tablet-memory": {
      id: "tablet-memory", title: "亭口木牌", savepoint: false,
      text: "你沿坡走回立约亭。执行台的木牌上刻着 19:28:49。\n\n亭子旁边就是那间机房，五步之外。\n\n木牌只有这一个时刻。要看另一处，还得回机房侧窗。",
      choices: [
        { id: "tablet-to-glass", label: "回机房，把两处时刻并排看", next: "glass" },
        { id: "tablet-to-machine", label: "回机房，先不并排看", next: "machine-idle" },
        { id: "tablet-compute", label: "就站在这里算一算", next: "puzzle-44", availableWhen: [{ type: "flag.equals", flagId: "singlestep.glass.line3", value: true }], set: { "singlestep.44s": true }, effects: [{ type: "event.publish", eventType: "story.achievement", payload: { id: "singlestep_44s", name: "44 秒" } }] },
      ],
    },
    "puzzle-44": {
      id: "puzzle-44", title: "四十四秒", role: "谜题", savepoint: true,
      text: "你把玻璃第三行的 19:28:05 和亭口木牌上的 19:28:49 并排放在一起。\n\n44 秒。\n\n四十四秒里问了两个问题：一个关于门，一个关于约。\n\n两块牌子各自只有时刻，没有写他先去了哪里，也没有写为什么。",
      choices: [
        { id: "puzzle-back-glass", label: "回到玻璃前", next: "glass" },
        { id: "puzzle-back-machine", label: "回到机器前", next: "machine-idle" },
        { id: "puzzle-ending", label: "记住这 44 秒", next: "ending-title", ending: "title", set: { "singlestep.ending": "title" } },
      ],
    },
    "ending-locked": {
      id: "ending-locked", title: "停着的机器", role: "结局 · 停机", savepoint: true, presentation: "blackout", terminal: true, guide: null,
      text: "你没有再按 RESET。\n\n机器就停在最后一拍：PC 在 Row 3，IR 两盏灯 HIGH/HIGH，长蓝线亮着，数码管停在 1。\n\n它停着的样子，和出厂时一样。想让它再走一拍，只需要按一下底层那颗红色按钮。\n\n你走出机房时，门楣上的招牌在坡上投下一小片影子。",
    },
    "ending-burner": {
      id: "ending-burner", title: "烧录工", role: "结局 · 烧录", savepoint: true, presentation: "blackout", terminal: true, guide: null,
      text: "你把自编的程序留在八枚拨码上。\n\n机器停在你写的最后一拍，数码管停在一个只有这一版程序才会得到的结果。\n\n下一次推门进来的人，会先看到这一版。他可能把它拨掉，也可能接着往下写。\n\n机房里多了一版没有署名的程序。",
    },
    "ending-title": {
      id: "ending-title", title: "所有", role: "结局 · 终课", savepoint: true, presentation: "blackout", terminal: true, guide: null,
      text: "「所有数电CPU都是由逻辑门组成的。」\n\n这句话和门楣上的招牌并排放在一起：\n\n「８位非逻辑门CPU（申精」\n\n招牌说「非」，终课说「都是」。\n\n没有人解释那个「非」字。机器停着，招牌亮着一颗星灯，坡上很安静。\n\n你可以把这两句话都记住，也可以只记住其中一句。",
    },
    "ending-leave": {
      id: "ending-leave", title: "改天再来", role: "结局 · 回访", savepoint: true, presentation: "blackout", terminal: true, guide: null,
      text: "你退回坡上。门在身后合上，机房的灯还亮着。\n\n那台机器留在原处，PC 指针停在某一行，等你下一次推门。\n\n界碑向城二十五步，单步机房。这里收着一台停着的机器。按一下，它想一拍。",
    },
  },
};
