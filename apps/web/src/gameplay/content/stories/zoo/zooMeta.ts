// S014 动物园怪谈：稳定的剧情标识、兴趣点、成就与跨案常量。
//
// 这里只放“会被别的模块引用”的常量，避免剧情、控制器、UI 各自写死字符串。
// 文案与节点表分别在 zooContent.ts / zooStory.ts。

export const ZOO_STORY_ID = 'side.s014.zoo';
export const ZOO_STORY_TITLE = '动物园怪谈';
export const ZOO_GUIDE_TITLE = '守则第七条';
export const ZOO_BUILDING_ID = 'zoo';
export const ZOO_RULE_ENDING_ID = 'zoo.rule-eight';

/** 园内三个可交互 NPC。 */
export const ZOO_NPC_IDS = {
  keeper: 'zoo_keeper',
  veteran: 'laobideng',
  visitor: 'zoo_kaogu_visitor',
} as const;

/** 全部 zoo 兴趣点（含控制器自管的非 worldInteractions 点位）。 */
export const ZOO_POINT_IDS = {
  pigeon: 'zoo-pigeon',
  cat: 'zoo-cat',
  monkey: 'zoo-monkey',
  beast: 'zoo-beast',
  waterfowl: 'zoo-waterfowl',
  museum: 'zoo-museum',
  office: 'zoo-office',
  stand: 'zoo-stand',
  signin: 'zoo-signin',
  borrowNote: 'zoo-borrow-note',
  doorplate: 'zoo-doorplate',
  phone: 'zoo-phone',
  proxySign: 'zoo-proxy-sign',
} as const;

/** 只有这六个点位由 StoryDefinition.worldInteractions 声明。 */
export const ZOO_WORLD_POINT_IDS = [
  ZOO_POINT_IDS.pigeon,
  ZOO_POINT_IDS.cat,
  ZOO_POINT_IDS.monkey,
  ZOO_POINT_IDS.beast,
  ZOO_POINT_IDS.waterfowl,
  ZOO_POINT_IDS.museum,
] as const;

export const ZOO_ACHIEVEMENT_IDS = {
  physicsSolution: 'zoo_physics_solution',
  rollCall: 'zoo_roll_call',
  childHeart: 'zoo_child_heart',
  ruleEight: 'zoo_rule_eight',
} as const;

/** 跨案咬合：S013 尚未实装时，相关台词与选项自然休眠。 */
export const S013_COMPLETED_ACHIEVEMENT = 's013_completed';
export const S009_COMPLETED_ACHIEVEMENT = 's009_dove_cafe';

/** 水墙（Echo Layer）铭牌的诚实数字。 */
export const ZOO_ECHO_ARCHIVED_COUNT = 74;
export const ZOO_ECHO_READABLE_COUNT = 16;

/** 每月第一个周五的例会窗口：21:30–24:00（游戏时钟）。 */
export const ZOO_MEETING_START_HOUR = 21.5;
export const ZOO_MEETING_END_HOUR = 24;

export const ZOO_RULE_VERSION = 7;
export const ZOO_RULE_VERSION_NEXT = 8;
export const ZOO_RULE_MAX_LENGTH = 24;

/** 主线旗标；测试会校验所有 flag.equals 只引用这里声明过的 id。 */
export const ZOO_FLAGS = {
  ticketSerious: 'zoo.ticket.serious',
  ticketCasual: 'zoo.ticket.casual',
  exhibitPigeon: 'zoo.exhibit.pigeon',
  exhibitCat: 'zoo.exhibit.cat',
  exhibitMonkey: 'zoo.exhibit.monkey',
  exhibitBeast: 'zoo.exhibit.beast',
  exhibitWaterfowl: 'zoo.exhibit.waterfowl',
  museumDone: 'zoo.museum.done',
  rollcallAnswered: 'zoo.rollcall.answered',
  ruleDirection: 'zoo.rule.direction',
  ruleVersion: 'zoo.rule.version',
  meetingDone: 'zoo.meeting.done',
} as const;

export const ZOO_DECLARED_FLAGS: readonly string[] = Object.freeze(Object.values(ZOO_FLAGS));

/** 剧情发布的事件；控制器在此之上发成就、写收集与推进 UI。 */
export const ZOO_EVENTS = {
  ticketAnswered: 'zoo.ticket.answered',
  childHeart: 'zoo.achievement.child-heart',
  rollCall: 'zoo.achievement.roll-call',
  ruleEight: 'zoo.achievement.rule-eight',
  museumDone: 'zoo.museum.done',
  meetingDone: 'zoo.meeting.done',
  thesisHeard: 'zoo.thesis.heard',
  cardsComplete: 'zoo.collection.cards-complete',
  formAlliance: 'zoo.collection.form.alliance',
  cardThoughtStamp: 'zoo.collection.card.thought-stamp',
  cardGatling: 'zoo.collection.card.gatling',
  cardYieldNegotiation: 'zoo.collection.card.yield-negotiation',
  cardTwoWayFoil: 'zoo.collection.card.two-way-foil',
  cardRocketArtillery: 'zoo.collection.card.rocket-artillery',
  cardJ20: 'zoo.collection.card.j20',
  cardMechCharge: 'zoo.collection.card.mech-charge',
  cardUniversalMap: 'zoo.collection.card.universal-map',
} as const;

export const ZOO_EXHIBIT_FLAGS = [
  ZOO_FLAGS.exhibitPigeon,
  ZOO_FLAGS.exhibitCat,
  ZOO_FLAGS.exhibitMonkey,
  ZOO_FLAGS.exhibitBeast,
  ZOO_FLAGS.exhibitWaterfowl,
] as const;
