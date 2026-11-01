// S014 动物园怪谈：逐字文案表。
//
// 来源：/tmp/stories/S014-动物园怪谈.md 与移植计划第 4 节。正文台词按
// 文档逐字照录，不做同义改写。红线内容（外部作品意象、第一人称投稿、
// 真实评论者身份、政治历史评论、emoji）一律不进入本文件。
//
// 本文件只导出字符串与只读表；剧情结构在 zooStory.ts。

export const ZOO_RULEBOOK_TITLE = '小城动物园·游客守则·抄本';
export const ZOO_RULEBOOK_VERSION_LABEL = '第七版';
export const ZOO_RULEBOOK_VERSION_LABEL_NEXT = '第八版';
export const ZOO_RULEBOOK_KEEPER_NOTE = '本守则一直在更新。你手里这份，是第七版。';

/** 七条守则 + 两条附则，逐字照录。 */
export const ZOO_RULES: readonly string[] = Object.freeze([
  '一、本园有且只有五个展区：鸽馆、猫馆、猿猴街、兽舍分馆、水禽池。若有人向你提起“沉水馆”，请微笑回答：本园没有沉水馆。（园长小字：园史馆里那面水墙不算展区，它算账。）',
  '二、鸽馆的鸽子白天在装死。它们愿意的话，会咕一声证明自己活着。请把这一声当作荣幸，不要索要第二声。',
  '三、猫馆的猫夜里不在馆里。它们去了哪里不重要——重要的是，猫咖馆的猫睁着眼的时候，这里的猫一定在睡。两边的猫换班，四年没错过一次。',
  '四、猿猴街有且只有一条路。如果你觉得自己走到了第二条——站住，原地转一圈。转回来还是同一条街，那就对了，继续走。',
  '五、兽舍分馆的住户天黑要去旅馆上夜班。日落前它们会排好队等班车。不要给夜班动物投喂咖啡，尤其是猫头鹰。',
  '六、水禽池的倒影里，园子的灯比岸上多一盏。那盏灯在园长办公室，它必须亮着。规矩是园长立的，他得先守。',
  '七、〔此条由第 N 位游客续写。下一任，是你。〕',
  '附则一：本园对小孩子、以及像小孩子一样认真的人，格外宽容。',
  '附则二：若守则与你的快乐冲突，请以快乐为准，并把这个冲突告诉售票亭。守则会改。',
]);

export const ZOO_INTERPRETATION_TITLE = '游客守则解读（佚名）';

export const ZOO_GATE_INTRO =
  '「欢迎来到小城动物园——重新开园第一天，你是第……」（看了一眼计数器）「不重要，反正从今天重新数。门票免费，先回答一个问题：企鹅为什么不会飞？」';

export const ZOO_TICKET_SERIOUS =
  '「认真答的都算对。这园子对小孩子和像小孩子一样认真的人，格外宽容。」';

export const ZOO_TICKET_CASUAL =
  '「那先入个会吧。标准满足一点即可：热爱小城。」';

export const ZOO_HANDOUT =
  '「历届游客。你手里这份是第七版——第七条还空着，等下一个人。」\n\n「这本是守则，这本是解读。」\n\n两本小册子交到你手里。守则封面上印着「第七版」，最后一条还是空白。';

export const ZOO_KEEPER_INTERPRETATION =
  '「不是。是一位路过的游客写的。我们不熟。」\n\n「重要的不是谁写的，是写的时候，想让人看懂。」';

export const ZOO_KEEPER_O5 = '「工号。零五号检票员。」';

export const ZOO_KEEPER_O5_BADGE =
  '联盟编号见纲领 2.0 第 0 条。在评论区发“逐影”二字即视为点名。';

export const ZOO_KEEPER_THREE_YEARS =
  '「联盟有大低谷，园子也有。低谷的意思不是谷底——是还在谷里，没散。」\n\n「上一次闭园那天，我在门口数了数旗子，五面，一面都没倒。那就还会再开的。」';

export const ZOO_KEEPER_NIGHT_LIGHT =
  '「守则第六条，水禽池里那盏。规矩是我立的，我得先守。给别人立规矩自己不守的人，写不出让人安心的守则。」';

export const ZOO_KEEPER_FORMS =
  '「……」（他难得停下手里的活）「组织是不会散伙的朋友。人可能走，表还在。哪天他们想回来了，签名栏还留着位置。」';

export const ZOO_KEEPER_THESIS =
  '「都集齐了？那你现在知道了——怪谈进了物理社区，就会长出物理解。恐惧到这里都得先过一遍公式。」\n\n「所以这园子从来不怕什么。它只是想有人来。」';

export const ZOO_KEEPER_RAIN =
  '「雨天守则字迹会晕开，但附则不会——附则是印在心里的。」';

export const ZOO_KEEPER_RENAMES =
  '「听说你收集过档案馆那位的名字？我也收——不过我收的是自己的。」\n\n「逐影常乐、逐影星空即O5常乐、高幂力量、星辰Sans、逐影星空。」\n\n「都是我。有且只有一个我，就是有点挤。」';

export const ZOO_EXHIBIT_PIGEON =
  '在鸽馆大声数鸽子。所有鸽子转过头来。\n\n一位游客递来一张卡：【思想钢印】。\n\n鸽子们向你立正敬礼三秒。守则二并未被违反，它们只是配合演出。';

export const ZOO_EXHIBIT_CAT =
  '猫馆的猫睁着一只眼，看你把猫咖馆的换班记录翻到最后一页。两边的猫换班，四年没错过一次。\n\n纸页边缘夹着一张卡：【二向箔】。';

export const ZOO_EXHIBIT_MONKEY =
  '你在猿猴街原地转圈。转回来，还是同一条街。\n\n出口镜子向你道歉。牌示：抱歉，又照到你了一次。\n\n镜框背面贴着一张卡：【加特林】。';

export const ZOO_EXHIBIT_BEAST =
  '你给猫头鹰递了一杯咖啡。它清醒到第二天中午。\n\n次日白天，它戴着墨镜在兽舍分馆补觉。牌子：夜班加班，勿扰。';

export const ZOO_EXHIBIT_WATERFOWL =
  '你蹲在水禽池边数倒影里的灯。岸上数到第七盏，水里多出一盏。\n\n【歼20】卡触发空中路线。从空中看，办公室窗里园长在给一摞申请表盖章，一盏灯，一个人，一笔一划。';

export const ZOO_EXHIBIT_WATERFOWL_HIDDEN =
  '水面像一张被折过的地图。所有动物都变成了笑脸，包括你。\n\n你从倒影里摸出一张卡：【元首的万能地图】。';

export const ZOO_VETERAN_INTRO =
  '「小伙子，看你盯着守则第四条发愁。要解法吗？我这儿有的是。」';

export const ZOO_VETERAN_YIELD =
  '「一千万吨。」\n\n另一位游客插话：\n\n「两千万。」\n\n他转头：\n\n「你有考虑过土方量吗？」\n\n两位游客就地开始争论地壳应力。你选了一边；无论选哪边，都拿到了【当量谈判】。';

export const ZOO_VETERAN_MECH = '「好东西。我选择闪击。」';

export const ZOO_VISITOR_KAOGU =
  '他站在园史馆最老的展柜前，看完，掏出小刀想刻字，发现牌子写着“请用粉笔”。\n\n「……」（用粉笔留了一个字：烤咕）';

export const ZOO_VISITOR_KAOGU_ANSWER =
  '「考古的考。我们这代人喜欢这么写。」\n\n「老地方都得有人来看。看一眼，就算数。」';

export const ZOO_VISITOR_KAOGU_S013 =
  '「档案馆书架内侧也有一行。同一个人刻的。哪个人？我啊。」';

export const ZOO_MUSEUM_ENTRY =
  '全场沉默两拍。\n\n猫馆的猫睁开一只眼。\n\n园长在售票亭叹气：「本园没有沉水馆。来，坐下。我跟你说说那面水墙。」';

export const ZOO_MUSEUM_ECHO =
  '园史馆的灯比外面暗。玻璃后是一面水墙，水下沉着最早的一批留言。\n\n铭牌写着诚实的数字：收藏 74，可读 16。\n\n「本园没有沉水馆。但最早那批话还在水底下——数得出来，捞不上来。读不到最早的，那就往最晚的添一笔。」';

export const ZOO_MUSEUM_PLAQUE =
  '收藏 74，可读 16。\n\n最早的一层留言沉在水下。计数器诚实地数着它们。';

export const ZOO_MUSEUM_KEEPER =
  '「本园没有沉水馆。但最早那批话还在水底下——数得出来，捞不上来。读不到最早的，那就往最晚的添一笔。」\n\n墙上挂着两本小册子的创始件，墨迹同一晚晾干。作者铭牌：佚名。\n\n园长说不认识他。\n\n《动物园规则怪谈之全面解析——老友赠》\n\n字缝里隐约露出原刻《全面解析》被改短过的痕迹。';

export const ZOO_MUSEUM_KEEPER_S013 =
  '展柜里有一封档案馆长的信，只可阅读，不可抄录。\n\n此门通向城南。';

export const ZOO_MUSEUM_DONE =
  '水墙安静下来。园长把申请表收回口袋。\n\n「本园没有沉水馆。但最早那批话还在水底下——数得出来，捞不上来。」';

export const ZOO_MEETING_START =
  '闭园后，办公室的灯亮着。\n\n窗内，他站在空会议室的名册前。反乱用标签部，反刷屏部，反侮辱部，善后部。念一个名字，停一停。';

export const ZOO_MEETING_WHERE =
  '「深潜的、浮上来的、去档案馆当馆长的。」';

export const ZOO_MEETING_S013 =
  '「善后部那位开的馆，跟这园子同年。他给我写门牌的时候用的还是老名字——后来我们都改了名，谁也没通知谁。那块牌子是文物，不许修。」';

export const ZOO_MEETING_ANSWER =
  '「答一个就行。剩下的，得留给他们自己答。」';

export const ZOO_MEETING_END =
  '他把守则翻到第七条。那是一条空白栏，历届续写人的名字排成一列。\n\n「下一任是你。」';

export const ZOO_RULE_BLANK =
  '园长递来空白条。\n\n「想好了再写。写完它就不是你的了——是下一位游客的。」';

export const ZOO_ENDING_KEEP =
  '你把那条规则写在了第七条。\n\n守则从第七版变成第八版。园长把它翻回第一页，又从头念了一遍。\n\n「下一任是你。」\n\n离开动物园的时候，售票亭的灯还亮着。下一班游客会先翻到第七条——他们看见的第一条规则，是你写的。';

export const ZOO_ENDING_JOY =
  '你写了一条让人开心的规则。\n\n园长看完，笑了一下，把守则翻到附则二，又在旁边补了半句。\n\n「会改的。」他说。\n\n守则变成第八版。下一班游客翻到第七条时，会先看见你的快乐。';

export const ZOO_ENDING_PASS =
  '你把空白条留在了第七条。园长没有追问，只把空白条夹进守则。\n\n「空白也算一条。」\n\n守则变成第八版。下一班游客翻到第七条时，会先看见一片空白，和旁边那行小字：下一任，是你。';

export const ZOO_SIGNIN =
  '《逐影联盟点名簿》\n\n签名栏还留着位置。\n\n你签下了“逐影”两个字。';

export const ZOO_BORROW_NOTE =
  '借：十年纪念碑的围观者若干。用途：开园人气。归还：不还了。';

export const ZOO_PROXY_SIGN =
  '园长外出期间由 你相信光吗 代理';

export const ZOO_PROXY_KEEPER_ANSWER =
  '「一个名字很亮的人。我不在的时候，光替我看门。」';

export const ZOO_ENCYCLOPEDIA_FOOTER = '本词条由志愿者维护，欢迎补充';

export const ZOO_PHONE = '「……你好？哦，打错了也没关系。顺便问一句——今天玩得开心吗？」';

export const ZOO_DOORPLATE =
  '《动物园规则怪谈之全面解析——老友赠》';

export const ZOO_DOORPLATE_KEEPER =
  '「他改名那天没告诉我，我也没告诉他我知道。这就是老朋友。」';

export const ZOO_STAND_TABS = ['守则', '解读', '民间解法图鉴', '申请表'] as const;

export const ZOO_CARD_GALLERY_HEADER = '民间解法图鉴 · 已收集 X / 8';
export const ZOO_FORM_GALLERY_HEADER = '申请表 · 已收集 X / 5';

export const ZOO_GUIDE_OBJECTIVES = {
  gateIntro: '和园长说话，回答门票问题',
  handout: '收下两本小册子，逛五个展区',
  exhibitsOpen: '在五个展区里破戒，收集民间解法',
  museumEntry: '去园史馆，看看水墙',
  museumDone: '等一个周五晚上，办公室的灯亮着',
  meetingStart: '听园长点名',
  ruleBlank: '在守则第七条写下你的规则',
} as const;

export const ZOO_TOASTS = {
  visitExhibits: '先把五个展区都逛完。',
  cardsRemaining: '还差 X 张解法卡。',
  meetingNotLit: '办公室的灯还没亮。每月第一个周五 21:30 后再来。',
  notMeetingDay: '今天不是例会夜。',
  ruleAlreadyWritten: '这条守则已经写过了。',
  rainRule: '雨天的守则字迹会晕开，但附则不会。',
} as const;

export interface ZooCardCopy {
  id: string;
  name: string;
  layer: string;
  text: string;
}

/** 八张民间解法卡：名称、地层与短文案。 */
export const ZOO_CARD_COPY: readonly ZooCardCopy[] = Object.freeze([
  {
    id: 'zoo_card_thought_stamp',
    name: '思想钢印',
    layer: '2023-01 地层',
    text: '给恐慌者打上“你是人”三个字。效果：全园动物向你立正敬礼三秒。',
  },
  {
    id: 'zoo_card_gatling',
    name: '加特林',
    layer: '2023-02 地层',
    text: '对不该出现的生物扫射并确认击毙为止。效果：彩带雨。鸽子们并不介意。',
  },
  {
    id: 'zoo_card_yield_negotiation',
    name: '当量谈判',
    layer: '2023-02/03 地层',
    text: '1000 万吨 TNT 够不够。效果：两位游客就地开始地壳应力辩论。卡面注：此争论始于 2023 年，至今未分胜负。',
  },
  {
    id: 'zoo_card_two_way_foil',
    name: '二向箔',
    layer: '2023-04 地层',
    text: '撕开包装，取出，降维。效果：全园 5 秒纸雕视角，然后弹回。',
  },
  {
    id: 'zoo_card_rocket_artillery',
    name: '无限火力火箭炮',
    layer: '2023-10 地层',
    text: '“可无视所有规则，并干掉园长”。效果：园长举起一块牌子：本园规定，火箭炮当日免预约。（园长至今活着，可见火箭炮从未到货。）',
  },
  {
    id: 'zoo_card_j20',
    name: '歼20 空中路线',
    layer: '2024-04 地层',
    text: '优先选择空中路线。效果：短暂俯瞰视角，水禽池的倒影里能看到那盏多出来的灯。',
  },
  {
    id: 'zoo_card_mech_charge',
    name: '机械化部队闪击',
    layer: '2024-08 地层',
    text: '“是个好东西，我选择闪击它”。效果：发条小坦克编队巡游猿猴街。一队列发条小坦克穿过猿猴街，猴子们趴在栏杆上鼓掌。',
  },
  {
    id: 'zoo_card_universal_map',
    name: '元首的万能地图',
    layer: '2022-12 地层',
    text: '拿来比划比划怎么把园子炸干净（bushi）。效果：地图上所有动物变成笑脸，包括你。',
  },
]);

/** 五张申请表：与本地收集 store 的 id 一一对应。 */
export const ZOO_FORM_COPY: readonly { id: string; name: string }[] = Object.freeze([
  { id: 'zoo_form_alliance', name: '逐影联盟入会申请表' },
  { id: 'zoo_form_encyclopedia', name: '百科志愿者申请表' },
  { id: 'zoo_form_law_society', name: '法学会申请表' },
  { id: 'zoo_form_beast_bus', name: '兽舍班车监督员申请表' },
  { id: 'zoo_form_waterfowl_lamp', name: '水禽数灯人申请表' },
]);

/** 供红线测试一次性扫描的全部玩家可见文案。 */
export const ZOO_PLAYER_TEXT: readonly string[] = Object.freeze([
  ZOO_RULEBOOK_TITLE,
  ZOO_RULEBOOK_VERSION_LABEL,
  ZOO_RULEBOOK_VERSION_LABEL_NEXT,
  ZOO_RULEBOOK_KEEPER_NOTE,
  ...ZOO_RULES,
  ZOO_INTERPRETATION_TITLE,
  ZOO_GATE_INTRO,
  ZOO_TICKET_SERIOUS,
  ZOO_TICKET_CASUAL,
  ZOO_HANDOUT,
  ZOO_KEEPER_INTERPRETATION,
  ZOO_KEEPER_O5,
  ZOO_KEEPER_O5_BADGE,
  ZOO_KEEPER_THREE_YEARS,
  ZOO_KEEPER_NIGHT_LIGHT,
  ZOO_KEEPER_FORMS,
  ZOO_KEEPER_THESIS,
  ZOO_KEEPER_RAIN,
  ZOO_KEEPER_RENAMES,
  ZOO_EXHIBIT_PIGEON,
  ZOO_EXHIBIT_CAT,
  ZOO_EXHIBIT_MONKEY,
  ZOO_EXHIBIT_BEAST,
  ZOO_EXHIBIT_WATERFOWL,
  ZOO_EXHIBIT_WATERFOWL_HIDDEN,
  ZOO_VETERAN_INTRO,
  ZOO_VETERAN_YIELD,
  ZOO_VETERAN_MECH,
  ZOO_VISITOR_KAOGU,
  ZOO_VISITOR_KAOGU_ANSWER,
  ZOO_VISITOR_KAOGU_S013,
  ZOO_MUSEUM_ENTRY,
  ZOO_MUSEUM_ECHO,
  ZOO_MUSEUM_PLAQUE,
  ZOO_MUSEUM_KEEPER,
  ZOO_MUSEUM_KEEPER_S013,
  ZOO_MUSEUM_DONE,
  ZOO_MEETING_START,
  ZOO_MEETING_WHERE,
  ZOO_MEETING_S013,
  ZOO_MEETING_ANSWER,
  ZOO_MEETING_END,
  ZOO_RULE_BLANK,
  ZOO_ENDING_KEEP,
  ZOO_ENDING_JOY,
  ZOO_ENDING_PASS,
  ZOO_SIGNIN,
  ZOO_BORROW_NOTE,
  ZOO_PROXY_SIGN,
  ZOO_PROXY_KEEPER_ANSWER,
  ZOO_ENCYCLOPEDIA_FOOTER,
  ZOO_PHONE,
  ZOO_DOORPLATE,
  ZOO_DOORPLATE_KEEPER,
  ...ZOO_STAND_TABS,
  ZOO_CARD_GALLERY_HEADER,
  ZOO_FORM_GALLERY_HEADER,
  ...Object.values(ZOO_GUIDE_OBJECTIVES),
  ...Object.values(ZOO_TOASTS),
  ...ZOO_CARD_COPY.flatMap((card) => [card.name, card.layer, card.text]),
  ...ZOO_FORM_COPY.map((form) => form.name),
]);
