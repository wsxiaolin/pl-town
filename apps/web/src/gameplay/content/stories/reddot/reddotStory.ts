import type { StoryDefinition } from "../../../stories/types";

/**
 * 支线剧情：复刻我的成功之路
 *
 * 电路街区的红点亭：一面 4×4 红点墙、一张空赏金榜、
 * 六个传承壁龛和一张只在周日有人的木椅。
 *
 * 节点命名规范：reddot.<beat>
 * 旗标命名规范：reddot.<subject>
 *
 * @see docs/story-authoring.md
 */
export const REDDOT_STORY: StoryDefinition = {
  schemaVersion: 1,
  definitionVersion: 1,
  id: "side.reddot.remake",
  title: "复刻我的成功之路",
  startNode: "pavilion_door",
  entryActorId: "reddot_dudu",
  interactions: [
    { actorId: "reddot_dudu", nodeId: "pavilion_door", choiceId: "ask-dudu" },
  ],
  buildingInteractions: [
    { buildingId: "reddot_pavilion", nodeId: "pavilion_door", choiceId: "enter-pavilion" },
  ],
  nodes: {
    /* ───────────────────── 第一幕：亭子进门 ───────────────────── */
    "pavilion_door": {
      id: "pavilion_door",
      title: "红点亭门口",
      role: "支线 · 第一幕",
      savepoint: true,
      guide: { title: "复刻我的成功之路", objective: "走进红点亭，看看那面墙" },
      activeActorIds: ["reddot_dudu"],
      text: "电路街区尽头有一间白天也亮着微光的小机房。屋顶铺着4×4的十六格天窗，红点一明一灭。\n\n门楣上刻着「RRR申精：红点迭代」，三个R的形状各不相同。门边挂着一块小牌：「又来申请精选了」。\n\n檐下两排八位显示器夹着两颗小警示红点。门侧立着一盏四元件双控灯，铭牌写：「红点墙的祖先就长这样，只是它只有一盏灯。」",
      choices: [
        { id: "enter-pavilion", label: "推门进去", next: "wall_intro", set: { "reddot.entered": true } },
        { id: "ask-dudu", label: "和门口的人说话", next: "dudu_greeting" },
        { id: "read-rrr", label: "看门楣上的三个R", next: "rrr_sign" },
        { id: "read-plaque", label: "读按钮下方的铜牌", next: "first_press_plaque" },
        { id: "walk-away", label: "先不进去，沿街走开", next: "ending_empty_board" },
      ],
    },
    "dudu_greeting": {
      id: "dudu_greeting",
      title: "杜Du",
      savepoint: true,
      activeActorIds: ["reddot_dudu"],
      text: "问询台后站着一个袖口别着志愿者袖章的人，见你进门，先抬了抬下巴。\n\n「大家好，我是杜Du，我又来申请精选了！」\n\n他看了一眼门口的时刻钟。「今天有十五到三十分钟。你问吧。」",
      choices: [
        { id: "how-to-play", label: "这个游戏怎么玩？", next: "wall_rules" },
        { id: "ask-bounty", label: "门口那张榜是什么？", next: "bounty_board" },
        { id: "ask-origin", label: "你从哪学的这个游戏？", next: "lineage_wall" },
        { id: "still-open", label: "窗口还开着吗？", next: "dudu_offline" },
        { id: "back-door", label: "先自己看看。", next: "pavilion_door" },
      ],
    },
    /* ───────────────────── 第二幕：4×4 红点墙 ───────────────────── */
    "wall_intro": {
      id: "wall_intro",
      title: "红点墙",
      role: "支线 · 第二幕",
      savepoint: true,
      guide: { title: "复刻我的成功之路", objective: "按一次按钮，读懂这面墙" },
      activeActorIds: ["reddot_dudu"],
      text: "整面墙是十六个大按钮，每个按钮上方一盏红点灯。墙侧左边是一排八位显示器，右边也是一排。\n\n「地图4×4。按一下按钮，这个点和上下左右四个点都会翻。让16个红点全部亮起——稍微等一下——分就来了，图也换了。你有256步。」\n\n第一下还没按，显示器停在256和0。",
      choices: [
        { id: "try-first", label: "先按一下试试", next: "first_press" },
        { id: "read-rules", label: "把规则再讲一遍", next: "wall_rules" },
        { id: "ask-half", label: "为什么要等一下？", next: "half_second" },
        { id: "step-back", label: "从墙前退开", next: "wall_done" },
      ],
    },
    "wall_rules": {
      id: "wall_rules",
      title: "杜Du",
      savepoint: false,
      activeActorIds: ["reddot_dudu"],
      text: "「按一次按钮开关会消耗一次。」他把手放在墙角的模式开关上。「打乱复原模式会随机生成一张红点图，全亮就得分换图；自由模式初始全灭，不耗步数，也不得分。」\n\n「调整模式要在暂停模式下调整。」他敲了敲锁住的盖板。「机器转着的时候，这里拨不动。」",
      choices: [
        { id: "try-first", label: "先按一下试试", next: "first_press" },
        { id: "free-mode", label: "试试自由模式", next: "free_mode" },
        { id: "ask-half", label: "全亮之后为什么要等？", next: "half_second" },
        { id: "step-back", label: "从墙前退开", next: "wall_done" },
      ],
    },
    "first_press": {
      id: "first_press",
      title: "红点墙",
      savepoint: false,
      text: "你按下墙中央的按钮。\n\n什么都没有发生。步数还是256，分数还是0，连一盏灯都没动。\n\n杜Du没有抬头。",
      choices: [
        { id: "read-plaque", label: "低头看按钮下方的铜牌", next: "first_press_plaque", effects: [{ type: "event.publish", eventType: "story.achievement", payload: { id: "reddot_first_press", name: "第一次按下" } }] },
        { id: "ask-dudu", label: "问杜Du这是不是坏了", next: "first_press_dudu", effects: [{ type: "event.publish", eventType: "story.achievement", payload: { id: "reddot_first_press", name: "第一次按下" } }] },
      ],
    },
    "first_press_plaque": {
      id: "first_press_plaque",
      title: "铜牌",
      savepoint: false,
      text: "按钮下方钉着一块小铜牌，字被摸得发亮：「第一次按下时示数不会有变化」。\n\n牌子背面刻着一幅小图：非门、或门储存器、非门、与门，四格连环。末行只有三个字：「用 bug 修 bug」。\n\n「你第一次按下的时候他不会有反应。」杜Du在墙后说，「计数器要先记住这一下。」",
      choices: [
        { id: "press-again", label: "继续按下去", next: "half_second" },
        { id: "ask-why", label: "为什么要用另一个 bug 修？", next: "first_press_dudu" },
        { id: "step-back", label: "先退开", next: "wall_done" },
      ],
    },
    "first_press_dudu": {
      id: "first_press_dudu",
      title: "杜Du",
      savepoint: false,
      activeActorIds: ["reddot_dudu"],
      text: "「机器没坏。」杜Du终于开口，「它只是在数这一下。」\n\n「你第一次按下的时候他不会有反应。计数器要先记住这一下，之后才肯开始算。」\n\n他说完，又低头去看墙。",
      choices: [
        { id: "continue-press", label: "继续按下去", next: "half_second" },
        { id: "back-to-wall", label: "先退开", next: "wall_done" },
      ],
    },
    "half_second": {
      id: "half_second",
      title: "红点墙",
      role: "支线 · 第二幕",
      savepoint: true,
      guide: { title: "复刻我的成功之路", objective: "让十六盏红点保持半秒" },
      text: "你继续按。红点一盏接一盏亮起来，十字五点翻过来又翻过去。\n\n最后一下，十六盏红点全亮了。\n\n机器没有立刻记分。玻璃后一枚黄铜节拍器开始摆，十六盏灯集体轻轻呼吸了一次，亮度微涨，又落回去。",
      choices: [
        { id: "wait-half", label: "等这半秒走完", next: "half_second_confirm" },
        { id: "flinch", label: "忍不住再按一下", next: "half_second_fail" },
        { id: "step-back", label: "从墙前退开", next: "wall_done" },
      ],
    },
    "half_second_confirm": {
      id: "half_second_confirm",
      title: "红点墙",
      savepoint: false,
      text: "半秒过去。节拍器摆到另一边，发出一声轻响。\n\n十六盏灯仍然全亮。分数从0跳到1，旧图熄灭，一张新的红点图铺开。\n\n「只有当方波发生器输出的时候，并且满足了16个灯亮起才可以加分。」杜Du说，「这样就把原本卡的那个瞬间延长的时间直接抵消掉。」",
      choices: [
        { id: "keep-playing", label: "接着玩", next: "scoring", set: { "reddot.halfSecond": true }, effects: [{ type: "event.publish", eventType: "story.achievement", payload: { id: "reddot_sixteen", name: "十六盏全亮" } }, { type: "event.publish", eventType: "story.achievement", payload: { id: "reddot_half_second", name: "等了半秒" } }] },
        { id: "watch-map", label: "先看一会儿新图", next: "new_map", set: { "reddot.halfSecond": true }, effects: [{ type: "event.publish", eventType: "story.achievement", payload: { id: "reddot_sixteen", name: "十六盏全亮" } }, { type: "event.publish", eventType: "story.achievement", payload: { id: "reddot_half_second", name: "等了半秒" } }] },
      ],
    },
    "half_second_fail": {
      id: "half_second_fail",
      title: "红点墙",
      savepoint: false,
      text: "就在半秒里，有一盏灯被系统翻回去。\n\n节拍器停了一拍。分数没有动，地图也没有换。十六盏里缺了一角。\n\n「那一瞬间不算。」杜Du说，「重来。」",
      choices: [
        { id: "retry-half", label: "重新等一拍", next: "half_second" },
        { id: "to-free-mode", label: "换自由模式慢慢按", next: "free_mode" },
      ],
    },
    "free_mode": {
      id: "free_mode",
      title: "自由模式",
      savepoint: false,
      text: "你拨到自由模式。红点初始全灭，步数显示器暗下去，分数也不再跳动。\n\n这里的灯只按你的手翻动，不会自己生成新图，也不会催你。\n\n墙角的模式开关已经锁上。",
      choices: [
        { id: "try-switch", label: "试着拨回打乱复原模式", next: "mode_locked" },
        { id: "back-challenge", label: "回到打乱复原模式", next: "challenge_resume" },
        { id: "step-back", label: "从墙前退开", next: "wall_done" },
      ],
    },
    "mode_locked": {
      id: "mode_locked",
      title: "模式开关",
      savepoint: false,
      text: "你伸手去拨模式开关，盖板纹丝不动。\n\n杜Du头也不抬：「调整模式要在暂停模式下调整。」\n\n他指了指墙角的暂停键。",
      choices: [
        { id: "pause-resume", label: "按下暂停键", next: "challenge_resume" },
        { id: "step-back", label: "先退开", next: "wall_done" },
      ],
    },
    "challenge_resume": {
      id: "challenge_resume",
      title: "打乱复原模式",
      savepoint: true,
      guide: { title: "复刻我的成功之路", objective: "在256步内让十六盏红点全亮" },
      text: "你回到打乱复原模式。新的红点图在十六格里亮着，步数从256重新起算。\n\n每按一次，左八位显示器就少一；右边那排数字还在等十六盏全亮。\n\n玻璃后的节拍器安静地悬在半空。",
      choices: [
        { id: "solve-wall", label: "把十六盏按到全亮", next: "half_second" },
        { id: "exhaust", label: "一直按到步数见底", next: "steps_zero" },
        { id: "step-back", label: "从墙前退开", next: "wall_done" },
      ],
    },
    "steps_zero": {
      id: "steps_zero",
      title: "步数归零",
      savepoint: false,
      text: "步数从1跳到0。檐下两颗警示红点同时亮起。\n\n墙上的红点图停在半解的状态，不再接受这局的计分。\n\n「你的步数归零。」杜Du说，「这局到头了。换自由模式，或者重开。」",
      choices: [
        { id: "restart", label: "重新开一局", next: "challenge_resume", set: { "reddot.stepsZero": true }, effects: [{ type: "event.publish", eventType: "story.achievement", payload: { id: "reddot_256", name: "二百五十六" } }] },
        { id: "to-free", label: "换自由模式", next: "free_mode", set: { "reddot.stepsZero": true }, effects: [{ type: "event.publish", eventType: "story.achievement", payload: { id: "reddot_256", name: "二百五十六" } }] },
      ],
    },
    "scoring": {
      id: "scoring",
      title: "分数",
      savepoint: false,
      text: "分数又跳了一格。旧图熄灭，新图铺开，十六盏重新从暗处开始。\n\n杜Du在问询台的纸上记了一笔：「新图是从已解状态反推随机按压生成的，保证十六盏都能合上。」\n\n「每按一次，左八位少一；右边这排，才是分数。」",
      choices: [
        { id: "keep-playing", label: "接着玩", next: "challenge_resume" },
        { id: "step-back", label: "从墙前退开", next: "wall_done" },
      ],
    },
    "new_map": {
      id: "new_map",
      title: "新图",
      savepoint: false,
      text: "新图生成时，十六盏灯会从已解状态往回退几步，再交到你手上。\n\n所以每一张都有路，只是路不一定好找。\n\n你侧头看见赏金榜的一角，十格铜框还空着。",
      choices: [
        { id: "keep-playing", label: "接着玩", next: "challenge_resume" },
        { id: "look-board", label: "去看赏金榜", next: "bounty_board" },
      ],
    },
    "wall_done": {
      id: "wall_done",
      title: "亭内",
      role: "支线 · 第三幕",
      savepoint: true,
      guide: { title: "复刻我的成功之路", objective: "看看传承墙、赏金榜和那张木椅" },
      activeActorIds: ["reddot_dudu"],
      text: "你从墙前退开。整间亭子安静下来，只剩节拍器偶尔的一声轻响。\n\n侧墙是一列六个壁龛，出口旁立着赏金榜，榜边一张木椅，问询台侧还有一块刻字的板。\n\n杜Du在问询台后，袖章压着一张签名条。",
      choices: [
        { id: "to-lineage", label: "看传承墙的六个壁龛", next: "lineage_wall" },
        { id: "to-bounty", label: "看赏金榜", next: "bounty_board" },
        { id: "to-sunday", label: "看榜边的木椅", next: "sunday_chair" },
        { id: "to-questions", label: "看问询台侧的问句板", next: "question_board" },
        { id: "to-rrr", label: "再看一眼门楣上的三个R", next: "rrr_sign" },
        { id: "leave-pavilion", label: "走出亭门", next: "ending_empty_board" },
      ],
    },
    /* ───────────────────── 第三幕：传承墙六龛 ───────────────────── */
    "lineage_wall": {
      id: "lineage_wall",
      title: "传承墙",
      role: "支线 · 第三幕",
      savepoint: true,
      guide: { title: "复刻我的成功之路", objective: "从第一龛看到第六龛" },
      text: "六个壁龛由浅入深排成一列，每龛嵌着一件4×4小格物，黑白与红点两色交替。\n\n从老电视里的黑白格，到海龟纹样，到改编标记，到铜铭牌，到红色格与触发器小阵，最后一龛空着，只挂一张可揭下的空白图样。",
      choices: [
        { id: "niche-tv", label: "第一龛：老电视", next: "niche_tv" },
        { id: "niche-turtle", label: "第二龛：海龟纹样", next: "niche_turtle" },
        { id: "niche-dasu", label: "第三龛：改编标记", next: "niche_dasu" },
        { id: "niche-2024", label: "第四龛：2024年的铜牌", next: "niche_2024" },
        { id: "niche-dudu", label: "第五龛：红色格", next: "niche_dudu" },
        { id: "niche-empty", label: "第六龛：空龛", next: "niche_empty" },
        { id: "back-ward", label: "回到亭内", next: "wall_done" },
      ],
    },
    "niche_tv": {
      id: "niche_tv",
      title: "第一龛",
      savepoint: false,
      text: "第一龛是一台老电视造型的4×4黑白格。屏幕里没有画面，只有十六格黑白方块缓慢变换。\n\n铭牌：「《最强大脑》·黑白迭代——考验智力的游戏项目」。",
      choices: [
        { id: "next-niche", label: "看下一龛", next: "niche_turtle" },
        { id: "back-wall", label: "回到传承墙", next: "lineage_wall" },
      ],
    },
    "niche_turtle": {
      id: "niche_turtle",
      title: "第二龛",
      savepoint: false,
      text: "第二龛的黑白格边角刻着海龟纹样。旁边的铜牌写：「海龟实验室·Electrolysis电解《黑白迭代》·精选·三年前」。\n\n龛前留着一小段空位，像给某个还没讲完的名字。",
      choices: [
        { id: "open-turtle-door", label: "看龛间的小门", next: "turtle_door" },
        { id: "next-niche", label: "看下一龛", next: "niche_dasu" },
        { id: "back-wall", label: "回到传承墙", next: "lineage_wall" },
      ],
    },
    "turtle_door": {
      id: "turtle_door",
      title: "海龟小门",
      savepoint: false,
      text: "第二龛和第三龛之间有一扇很小的门，门板上刻着海龟纹样。门永远虚掩着一条缝，推不开，只能从缝里看见对面的灯影。\n\n门框两侧刻着两行字——\n\n「你要知道这玩意儿他海龟实验室里你知道用多少代码吗？」\n「其实也就171行。」\n\n下面还有一行，笔迹换了：「哦？那就只能放弃入坑海实了。」",
      choices: [
        { id: "next-niche", label: "看下一龛", next: "niche_dasu" },
        { id: "back-niche", label: "回到第二龛", next: "niche_turtle" },
      ],
    },
    "niche_dasu": {
      id: "niche_dasu",
      title: "第三龛",
      savepoint: false,
      text: "第三龛是一张黑白4×4格，角上多了一枚小小的改编标记。\n\n铭牌：「海龟实验室·我的世界大苏·改编」。\n\n龛沿刻着一句话：「如果不是你……我也不会注意到这个作品。」",
      choices: [
        { id: "next-niche", label: "看下一龛", next: "niche_2024" },
        { id: "back-wall", label: "回到传承墙", next: "lineage_wall" },
      ],
    },
    "niche_2024": {
      id: "niche_2024",
      title: "第四龛",
      savepoint: false,
      text: "第四龛是一块2024年的铜铭牌，旁边嵌着145个元件的微缩图。\n\n铭牌：「物实·散不了一点《申精4×4黑白迭代》·2024·精选」。\n\n侧刻一行：「这种题材很多人做过了」。",
      choices: [
        { id: "next-niche", label: "看下一龛", next: "niche_dudu" },
        { id: "back-wall", label: "回到传承墙", next: "lineage_wall" },
      ],
    },
    "niche_dudu": {
      id: "niche_dudu",
      title: "第五龛",
      savepoint: false,
      text: "第五龛是红色4×4格，旁边排着一小列T触发器。\n\n铭牌：「物实·杜Du《RRR申精：红点迭代》·2026」。\n\n格子里十六盏红点全亮，像刚过完半秒。",
      choices: [
        { id: "next-niche", label: "看下一龛", next: "niche_empty" },
        { id: "back-wall", label: "回到传承墙", next: "lineage_wall" },
      ],
    },
    "niche_empty": {
      id: "niche_empty",
      title: "第六龛",
      role: "支线 · 第三幕",
      savepoint: true,
      guide: { title: "复刻我的成功之路", objective: "决定要不要揭走第六龛的空白图样" },
      text: "第六龛空着。龛楣上刻着一段话：「……你完全可以复刻我的成功之路。」\n\n下面一行小字：「改编作品位」。\n\n龛里只挂着一张可揭下的空白图样，纸角没有被钉死。",
      choices: [
        { id: "take-pattern", label: "揭下空白图样", next: "pattern_taken" },
        { id: "leave-empty", label: "让它继续空着", next: "lineage_wall" },
      ],
    },
    "pattern_taken": {
      id: "pattern_taken",
      title: "空白图样",
      savepoint: false,
      text: "你揭下空白图样。纸背透出几行浅浅的字，像是写的人用力太深。\n\n「封面一定要拍清楚你的分数。」\n\n杜Du在身后看了一眼，没有阻止。",
      choices: [
        { id: "carry-out", label: "带出亭门", next: "ending_pattern_out", set: { "reddot.patternTaken": true }, effects: [{ type: "event.publish", eventType: "story.achievement", payload: { id: "reddot_remake", name: "复刻我的成功之路" } }] },
        { id: "put-back", label: "把图样放回龛里", next: "lineage_wall" },
      ],
    },
    /* ───────────────────── 第四幕：赏金榜与空位 ───────────────────── */
    "bounty_board": {
      id: "bounty_board",
      title: "赏金榜",
      role: "支线 · 第四幕",
      savepoint: true,
      guide: { title: "复刻我的成功之路", objective: "读赏金榜，看看十格榜位" },
      text: "出口旁的赏金榜嵌着十格铜框，榜位是从1到10的数字，每一格下面留着一个空的分数小窗。\n\n榜侧的日历牌翻在「十月二十五日」。榜脚压着一整段条款，字很小，但刻得很深。",
      choices: [
        { id: "read-terms", label: "读榜脚的条款", next: "bounty_terms", set: { "reddot.bountyRead": true } },
        { id: "read-calendar", label: "看日历牌", next: "deadline_calendar" },
        { id: "ask-why", label: "问杜Du为什么要发赏金", next: "dudu_goals" },
        { id: "to-chair", label: "看榜边的木椅", next: "sunday_chair" },
        { id: "back-ward", label: "回到亭内", next: "wall_done" },
      ],
    },
    "bounty_terms": {
      id: "bounty_terms",
      title: "赏金条款",
      savepoint: false,
      text: "「游戏赏金：2026年10月25号前发布改编作品，并且艾特我，封面一定要拍清楚你的分数，我将会把你的成绩记录到排名榜上……」\n\n「奖金金额等于（你得到的分数÷5向上取整）个支持。如果你没有那么多的作品，那么每一个支持我将会等效替换成3个收藏。」\n\n榜上十格仍是空的。",
      choices: [
        { id: "ask-why", label: "问杜Du为什么要发赏金", next: "dudu_goals" },
        { id: "back-board", label: "回到赏金榜", next: "bounty_board" },
      ],
    },
    "deadline_calendar": {
      id: "deadline_calendar",
      title: "日历牌",
      savepoint: false,
      text: "日历牌只翻了一页：十月二十五日。没有写具体的时刻。\n\n「25号前」四个字留在牌面上，像一道还没走完的倒计时。\n\n榜上十格仍然空着。",
      choices: [
        { id: "ask-dudu", label: "问杜Du榜上怎么还没有名字", next: "dudu_goals" },
        { id: "back-board", label: "回到赏金榜", next: "bounty_board" },
      ],
    },
    "dudu_goals": {
      id: "dudu_goals",
      title: "杜Du",
      savepoint: false,
      activeActorIds: ["reddot_dudu"],
      text: "「目标1：把今年物理实验室的实验精选超过去年数量。当前63，去年72。」\n\n「目标2：知识库。当前45，去年80。」\n\n他说得很平，像在念一张公开的账本。",
      choices: [
        { id: "ask-volunteer", label: "这跟你有什么关系？", next: "dudu_volunteer" },
        { id: "back-board", label: "回到赏金榜", next: "bounty_board" },
      ],
    },
    "dudu_volunteer": {
      id: "dudu_volunteer",
      title: "杜Du",
      savepoint: false,
      activeActorIds: ["reddot_dudu"],
      text: "「我有9精选，1知识库。」\n\n他指了指自己的袖章。「运气好，甚至可以申请精选，甚至再放大一点，你可以靠这些积累志愿者的精选知识要求。」",
      choices: [
        { id: "teach-me", label: "那要怎么开始？", next: "teaching_long" },
        { id: "back-goals", label: "回到刚才的话", next: "dudu_goals" },
      ],
    },
    "teaching_long": {
      id: "teaching_long",
      title: "杜Du",
      role: "支线 · 第四幕",
      savepoint: true,
      guide: { title: "复刻我的成功之路", objective: "听完杜Du给后人的那段话" },
      activeActorIds: ["reddot_dudu"],
      text: "杜Du看了你一会儿。\n\n「你去海龟实验室看看，那里游戏特别多。较为简单的话，你可以尝试在物理实验室复刻一下。运气好，甚至可以申请精选。甚至再放大一点，你可以靠这些积累志愿者的精选知识要求。如果你想要服务社区的话，」\n\n节拍器摆过去半拍。\n\n「你完全可以复刻我的成功之路。」",
      choices: [
        { id: "who-taught-you", label: "那你是谁的路？", next: "dudu_origin" },
        { id: "sit-and-wait", label: "去榜边坐一会儿", next: "sunday_chair" },
        { id: "back-volunteer", label: "回到刚才的话", next: "dudu_volunteer" },
      ],
    },
    "dudu_origin": {
      id: "dudu_origin",
      title: "杜Du",
      savepoint: false,
      activeActorIds: ["reddot_dudu"],
      text: "他没有立刻回答，只抬手指了指传承墙的第三龛。\n\n「如果不是你……我也不会注意到这个作品。」\n\n那句话朝向第三龛，说给那个改编标记听。",
      choices: [
        { id: "to-lineage", label: "走近传承墙", next: "lineage_wall" },
        { id: "back-teaching", label: "回到刚才的话", next: "teaching_long" },
      ],
    },
    "question_board": {
      id: "question_board",
      title: "问句板",
      savepoint: false,
      text: "问询台侧立着一块窄木板，三行字刻得很深，没有一行后面跟着答案。\n\n「发布的时候最后一步是什吗」\n「你知道发布的最后一部是什么吗？」\n「什么意思？」\n\n最后一行之后，木板就空了。",
      choices: [
        { id: "to-sunday", label: "去看榜边的木椅", next: "sunday_chair" },
        { id: "back-ward", label: "回到亭内", next: "wall_done" },
      ],
    },
    /* ───────────────────── 第五幕：周日椅 ───────────────────── */
    "sunday_chair": {
      id: "sunday_chair",
      title: "榜边的木椅",
      role: "支线 · 第五幕",
      savepoint: true,
      guide: { title: "复刻我的成功之路", objective: "看看木椅上有没有人" },
      text: "赏金榜旁放着一张木椅。椅面压着一张便签，字迹很轻：「周日我再来」。\n\n椅背上还有一行更小的字：「最近没有什么游戏」。\n\n平日里椅子空着。如果赶上周日，会有人坐在那里。",
      choices: [
        { id: "weekday", label: "平日：看看那张空椅", next: "chair_empty" },
        { id: "sunday", label: "周日：椅子上有人", next: "sunday_sit", set: { "reddot.sundaySeen": true } },
        { id: "back-ward", label: "回到亭内", next: "wall_done" },
      ],
    },
    "chair_empty": {
      id: "chair_empty",
      title: "空椅",
      savepoint: false,
      text: "椅子空着。便签压在座面正中，边角被风掀起一点。\n\n椅背那行小字在光里很清楚：「他说这话的时候，榜上还没有一个名字。」\n\n榜上十格仍是空的。",
      choices: [
        { id: "wait-sunday", label: "在椅边等到周日", next: "sunday_sit", set: { "reddot.sundaySeen": true } },
        { id: "back-board", label: "回到赏金榜", next: "bounty_board" },
      ],
    },
    "sunday_sit": {
      id: "sunday_sit",
      title: "我的世界大苏",
      savepoint: false,
      activeActorIds: ["reddot_dasu"],
      text: "大苏坐在木椅上，手放在膝盖上，不看你。\n\n他头顶的空气里浮起一行字，停一会儿，换下一行——\n\n「4个了」\n「最近没有什么游戏」\n「周日我再来」",
      choices: [
        { id: "hand-note", label: "递给他一张空白纸条", next: "sunday_note" },
        { id: "ask-board", label: "问榜上怎么还没有名字", next: "sunday_silence" },
        { id: "leave-chair", label: "不打扰他，起身离开", next: "ending_sunday", effects: [{ type: "event.publish", eventType: "story.achievement", payload: { id: "reddot_sunday", name: "周日" } }] },
        { id: "back-chair", label: "再看看这张椅子", next: "sunday_chair" },
      ],
    },
    "sunday_note": {
      id: "sunday_note",
      title: "我的世界大苏",
      savepoint: false,
      activeActorIds: ["reddot_dasu"],
      text: "你把一张空白纸条递过去。\n\n大苏想了很久，低头写字。笔尖在纸上停了两次，才把纸条递回来。\n\n上面只有四个字：「周日我再来」。",
      choices: [
        { id: "take-note", label: "收下字条，起身离开", next: "ending_sunday", effects: [{ type: "event.publish", eventType: "story.achievement", payload: { id: "reddot_sunday", name: "周日" } }] },
        { id: "stay-longer", label: "再坐一会儿", next: "sunday_silence" },
      ],
    },
    "sunday_silence": {
      id: "sunday_silence",
      title: "我的世界大苏",
      savepoint: false,
      activeActorIds: ["reddot_dasu"],
      text: "你问榜上怎么还没有名字。\n\n大苏沉默。节拍器摆了一拍。\n\n然后他说：「预则虑其败，行则信其成。」\n\n他没有再看你。",
      choices: [
        { id: "listen-silence", label: "把这句话记住，起身离开", next: "ending_sunday", effects: [{ type: "event.publish", eventType: "story.achievement", payload: { id: "reddot_sunday", name: "周日" } }] },
        { id: "back-chair", label: "回到椅边", next: "sunday_sit" },
      ],
    },
    /* ───────────────────── 第六幕：门楣与下线 ───────────────────── */
    "rrr_sign": {
      id: "rrr_sign",
      title: "门楣",
      savepoint: false,
      text: "你回头看门楣。招牌上三个R的形状各不相同，像三个人各刻了一笔。\n\n你伸手碰了碰第一个R。它亮了一下。接着第二个、第三个，依次亮起，又依次熄灭。\n\n没有任何说明文字。杜Du也没有开口。",
      choices: [
        { id: "ask-dudu-rrr", label: "问杜Du这三个R是什么意思", next: "dudu_greeting" },
        { id: "back-ward", label: "回到亭内", next: "wall_done" },
      ],
    },
    "dudu_offline": {
      id: "dudu_offline",
      title: "问询台",
      savepoint: false,
      text: "你回头再看问询台。\n\n刚才还站在那里的人已经不在了。没有告别，没有淡出，就是下一帧不在了。\n\n柜上压着一张便条：「如果你们发的消息我没有回的话，大概就就是我下线了。」",
      choices: [
        { id: "read-note", label: "把便条读一遍", next: "ending_offline" },
        { id: "wait-note", label: "在门口等一会儿", next: "ending_offline" },
      ],
    },
    /* ───────────────────── 结局与回访 ───────────────────── */
    "ending_empty_board": {
      id: "ending_empty_board",
      title: "复刻我的成功之路",
      role: "结局 · 空榜",
      presentation: "blackout",
      terminal: true,
      guide: null,
      text: "你走出红点亭。屋顶的十六格天窗还在夜里一明一灭。\n\n赏金榜的十格仍是空的，日历停在十月二十五日之前。\n\n出题的人、答题的人、看榜的人，共用同一张空榜。\n\n这座亭子不庆祝终点。它在等下一环。",
    },
    "ending_pattern_out": {
      id: "ending_pattern_out",
      title: "复刻我的成功之路",
      role: "结局 · 带出图样",
      presentation: "blackout",
      terminal: true,
      guide: null,
      achievement: { id: "reddot_remake", name: "复刻我的成功之路" },
      text: "你把那张空白图样带出亭门。纸背的字被街灯照出来：「封面一定要拍清楚你的分数。」\n\n身后的节拍器又摆了一拍。十六盏红点在窗里亮着，像一句没有说完的话。\n\n第六龛空着。空位留给下一个复刻的人。",
    },
    "ending_sunday": {
      id: "ending_sunday",
      title: "复刻我的成功之路",
      role: "结局 · 周日",
      presentation: "blackout",
      terminal: true,
      guide: null,
      achievement: { id: "reddot_sunday", name: "周日" },
      text: "你从木椅旁离开。大苏仍坐在那里，便签压在座面上。\n\n问询台的窗口碰巧还开着，杜Du在纸上写下一行字，又划掉。\n\n节拍器摆过去半拍。\n\n「预则虑其败，行则信其成。」",
    },
    "ending_offline": {
      id: "ending_offline",
      title: "复刻我的成功之路",
      role: "结局 · 下线",
      presentation: "blackout",
      terminal: true,
      guide: null,
      text: "窗口结束了。问询台后没有人，柜上的便条还在。\n\n门口的营业时刻小钟停在最后一格，牌子翻到「下线了」。\n\n风碰了一下牌子，发出一声轻响。\n\n亭子里只剩那面红点墙和半秒一次的节拍。",
    },
  },
};
