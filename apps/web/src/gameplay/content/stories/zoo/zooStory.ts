import type {
  StoryChoice,
  StoryCondition,
  StoryDefinition,
  StoryEffect,
  StoryFlagValue,
  StoryNode,
} from '../../../stories/types';
import {
  S013_COMPLETED_ACHIEVEMENT,
  ZOO_ACHIEVEMENT_IDS,
  ZOO_BUILDING_ID,
  ZOO_ECHO_ARCHIVED_COUNT,
  ZOO_ECHO_READABLE_COUNT,
  ZOO_EVENTS,
  ZOO_EXHIBIT_FLAGS,
  ZOO_FLAGS,
  ZOO_GUIDE_TITLE,
  ZOO_NPC_IDS,
  ZOO_POINT_IDS,
  ZOO_RULE_ENDING_ID,
  ZOO_RULE_VERSION,
  ZOO_RULE_VERSION_NEXT,
  ZOO_STORY_ID,
  ZOO_STORY_TITLE,
} from './zooMeta';
import {
  ZOO_BORROW_NOTE,
  ZOO_CARD_COPY,
  ZOO_DOORPLATE,
  ZOO_DOORPLATE_KEEPER,
  ZOO_ENCYCLOPEDIA_FOOTER,
  ZOO_ENDING_JOY,
  ZOO_ENDING_KEEP,
  ZOO_ENDING_PASS,
  ZOO_EXHIBIT_BEAST,
  ZOO_EXHIBIT_CAT,
  ZOO_EXHIBIT_MONKEY,
  ZOO_EXHIBIT_PIGEON,
  ZOO_EXHIBIT_WATERFOWL,
  ZOO_EXHIBIT_WATERFOWL_HIDDEN,
  ZOO_GATE_INTRO,
  ZOO_GUIDE_OBJECTIVES,
  ZOO_HANDOUT,
  ZOO_KEEPER_FORMS,
  ZOO_KEEPER_INTERPRETATION,
  ZOO_KEEPER_NIGHT_LIGHT,
  ZOO_KEEPER_O5,
  ZOO_KEEPER_O5_BADGE,
  ZOO_KEEPER_RAIN,
  ZOO_KEEPER_RENAMES,
  ZOO_KEEPER_THESIS,
  ZOO_KEEPER_THREE_YEARS,
  ZOO_MEETING_ANSWER,
  ZOO_MEETING_END,
  ZOO_MEETING_S013,
  ZOO_MEETING_START,
  ZOO_MEETING_WHERE,
  ZOO_MUSEUM_DONE,
  ZOO_MUSEUM_ECHO,
  ZOO_MUSEUM_ENTRY,
  ZOO_MUSEUM_KEEPER,
  ZOO_MUSEUM_KEEPER_S013,
  ZOO_MUSEUM_PLAQUE,
  ZOO_PHONE,
  ZOO_PROXY_KEEPER_ANSWER,
  ZOO_PROXY_SIGN,
  ZOO_RULE_BLANK,
  ZOO_SIGNIN,
  ZOO_TICKET_CASUAL,
  ZOO_TICKET_SERIOUS,
  ZOO_VETERAN_INTRO,
  ZOO_VETERAN_MECH,
  ZOO_VETERAN_YIELD,
  ZOO_VISITOR_KAOGU,
  ZOO_VISITOR_KAOGU_ANSWER,
  ZOO_VISITOR_KAOGU_S013,
} from './zooContent';

const flag = (flagId: string, value: StoryFlagValue): StoryEffect => ({
  type: 'flag.set',
  flagId,
  value,
});

const event = (eventType: string): StoryEffect => ({
  type: 'event.publish',
  eventType,
});

const flagIs = (flagId: string, value: StoryFlagValue): StoryCondition => ({
  type: 'flag.equals',
  flagId,
  value,
});

const achievement = (achievementId: string): StoryCondition => ({
  type: 'achievement.unlocked',
  achievementId,
});

const ALL_EXHIBITS_VISITED: readonly StoryCondition[] = ZOO_EXHIBIT_FLAGS.map((flagId) => flagIs(flagId, true));

const MEETING_READY: readonly StoryCondition[] = [
  ...ALL_EXHIBITS_VISITED,
  flagIs(ZOO_FLAGS.museumDone, true),
];

const MAINSTATE_DEFAULTS = {
  [ZOO_FLAGS.ticketSerious]: false,
  [ZOO_FLAGS.ticketCasual]: false,
  [ZOO_FLAGS.exhibitPigeon]: false,
  [ZOO_FLAGS.exhibitCat]: false,
  [ZOO_FLAGS.exhibitMonkey]: false,
  [ZOO_FLAGS.exhibitBeast]: false,
  [ZOO_FLAGS.exhibitWaterfowl]: false,
  [ZOO_FLAGS.museumDone]: false,
  [ZOO_FLAGS.rollcallAnswered]: false,
  [ZOO_FLAGS.ruleDirection]: '',
  [ZOO_FLAGS.ruleVersion]: ZOO_RULE_VERSION,
  [ZOO_FLAGS.meetingDone]: false,
} satisfies Readonly<Record<string, StoryFlagValue>>;

function guide(objective: string): StoryNode['guide'] {
  return { title: ZOO_GUIDE_TITLE, objective };
}

function cardText(id: string): string {
  const card = ZOO_CARD_COPY.find((item) => item.id === id);
  if (!card) throw new Error(`unknown zoo card: ${id}`);
  return `【${card.name}】（${card.layer}）——${card.text}`;
}

const backToHub: StoryChoice = {
  id: 'back-to-exhibits',
  label: '（回到园区）',
  next: 'exhibits-open',
};

const ticketAnswer = (site: 'serious' | 'casual'): StoryChoice => ({
  id: `answer-${site}`,
  label: site === 'serious' ? '认真回答（随便什么答案）' : '敷衍两句',
  next: `ticket-${site}`,
});

const ticketBranch = (site: 'serious' | 'casual', flagged: string): StoryChoice => ({
  id: `continue-${site}-handout`,
  label: '',
  autoAdvance: true,
  next: 'handout',
  set: {
    ...MAINSTATE_DEFAULTS,
    [flagged]: true,
  },
  effects: [
    event(ZOO_EVENTS.ticketAnswered),
    event(site === 'serious' ? ZOO_EVENTS.childHeart : ZOO_EVENTS.formAlliance),
  ],
});

const exhibitReveal = (
  id: string,
  title: string,
  text: string,
  flagId: string,
  effects: readonly StoryEffect[],
  extraChoices: readonly StoryChoice[] = [],
): StoryNode => ({
  savepoint: true,
  id,
  title,
  role: null,
  text,
  choices: [
    {
      id: `continue-${id}`,
      label: '',
      autoAdvance: true,
      next: 'exhibits-open',
      set: { [flagId]: true },
      effects: [flag(flagId, true), ...effects],
    },
    ...extraChoices,
  ],
});

export const ZOO_STORY: StoryDefinition = {
  schemaVersion: 1,
  definitionVersion: 1,
  id: ZOO_STORY_ID,
  title: ZOO_STORY_TITLE,
  startNode: 'gate-intro',
  entryActorId: ZOO_NPC_IDS.keeper,
  interactions: [
    {
      actorId: ZOO_NPC_IDS.veteran,
      nodeId: 'exhibits-open',
      choiceId: 'talk-veteran',
    },
    {
      actorId: ZOO_NPC_IDS.visitor,
      nodeId: 'exhibits-open',
      choiceId: 'talk-kaogu',
    },
  ],
  worldInteractions: [
    {
      interestPointId: ZOO_POINT_IDS.pigeon,
      nodeId: 'exhibits-open',
      choiceId: 'inspect-pigeon',
    },
    {
      interestPointId: ZOO_POINT_IDS.cat,
      nodeId: 'exhibits-open',
      choiceId: 'inspect-cat',
    },
    {
      interestPointId: ZOO_POINT_IDS.monkey,
      nodeId: 'exhibits-open',
      choiceId: 'inspect-monkey',
    },
    {
      interestPointId: ZOO_POINT_IDS.beast,
      nodeId: 'exhibits-open',
      choiceId: 'inspect-beast',
    },
    {
      interestPointId: ZOO_POINT_IDS.waterfowl,
      nodeId: 'exhibits-open',
      choiceId: 'inspect-waterfowl',
    },
    {
      interestPointId: ZOO_POINT_IDS.museum,
      nodeId: 'exhibits-open',
      choiceId: 'enter-museum',
    },
  ],
  nodes: {
    'gate-intro': {
      savepoint: true,
      id: 'gate-intro',
      title: ZOO_STORY_TITLE,
      role: '园长·逐影',
      guide: guide(ZOO_GUIDE_OBJECTIVES.gateIntro),
      text: ZOO_GATE_INTRO,
      choices: [
        ticketAnswer('serious'),
        ticketAnswer('casual'),
        { id: 'ask-rules', label: '守则是谁写的？', next: 'keeper-rules' },
        { id: 'ask-o5', label: 'O5 是什么？', next: 'keeper-o5' },
        { id: 'ask-three-years', label: '园子为什么关了三年？', next: 'keeper-three-years' },
        { id: 'ask-night-light', label: '晚上办公室为什么总亮着灯？', next: 'keeper-night-light' },
        { id: 'ask-forms', label: '你为什么老在发申请表？', next: 'keeper-forms' },
        {
          id: 'enter-park',
          label: '（进园）',
          next: 'handout',
          availableWhen: [{ type: 'event.occurred', eventType: ZOO_EVENTS.ticketAnswered }],
        },
        {
          id: 'rain-handout',
          label: '',
          hidden: true,
          next: 'keeper-rain',
        },
      ],
    },

    'ticket-serious': {
      savepoint: true,
      id: 'ticket-serious',
      title: ZOO_STORY_TITLE,
      role: '园长·逐影',
      guide: guide(ZOO_GUIDE_OBJECTIVES.handout),
      text: ZOO_TICKET_SERIOUS,
      choices: [ticketBranch('serious', ZOO_FLAGS.ticketSerious)],
    },

    'ticket-casual': {
      savepoint: true,
      id: 'ticket-casual',
      title: ZOO_STORY_TITLE,
      role: '园长·逐影',
      guide: guide(ZOO_GUIDE_OBJECTIVES.handout),
      text: ZOO_TICKET_CASUAL,
      choices: [ticketBranch('casual', ZOO_FLAGS.ticketCasual)],
    },

    handout: {
      savepoint: true,
      id: 'handout',
      title: ZOO_STORY_TITLE,
      role: '园长·逐影',
      guide: guide(ZOO_GUIDE_OBJECTIVES.handout),
      text: ZOO_HANDOUT,
      choices: [
        {
          id: 'continue-exhibits-open',
          label: '',
          autoAdvance: true,
          next: 'exhibits-open',
        },
      ],
    },

    'exhibits-open': {
      savepoint: true,
      id: 'exhibits-open',
      title: '小城动物园',
      role: '园区',
      guide: guide(ZOO_GUIDE_OBJECTIVES.exhibitsOpen),
      text: '五个展区围着中央的水禽池：鸽馆、猫馆、猿猴街、兽舍分馆，还有池子本身。园史馆在更里面，门还关着。\n\n售票亭的灯亮着，园长还在。守则第七条的空白页在你手里，暂时只是空白。',
      choices: [
        {
          id: 'inspect-pigeon',
          label: '（走进鸽馆）',
          hidden: true,
          next: 'exhibit-pigeon-reveal',
          availableWhen: [flagIs(ZOO_FLAGS.exhibitPigeon, false)],
        },
        {
          id: 'inspect-cat',
          label: '（走进猫馆）',
          hidden: true,
          next: 'exhibit-cat-reveal',
          availableWhen: [flagIs(ZOO_FLAGS.exhibitCat, false)],
        },
        {
          id: 'inspect-monkey',
          label: '（走进猿猴街）',
          hidden: true,
          next: 'exhibit-monkey-reveal',
          availableWhen: [flagIs(ZOO_FLAGS.exhibitMonkey, false)],
        },
        {
          id: 'inspect-beast',
          label: '（走进兽舍分馆）',
          hidden: true,
          next: 'exhibit-beast-reveal',
          availableWhen: [flagIs(ZOO_FLAGS.exhibitBeast, false)],
        },
        {
          id: 'inspect-waterfowl',
          label: '（走到水禽池边）',
          hidden: true,
          next: 'exhibit-waterfowl-reveal',
          availableWhen: [flagIs(ZOO_FLAGS.exhibitWaterfowl, false)],
        },
        {
          id: 'enter-museum',
          label: '（进入园史馆）',
          hidden: true,
          next: 'museum-entry',
          availableWhen: ALL_EXHIBITS_VISITED,
        },
        {
          id: 'attend-meeting',
          label: '（去办公室窗口）',
          hidden: true,
          next: 'meeting-start',
          availableWhen: [...MEETING_READY, flagIs(ZOO_FLAGS.meetingDone, false)],
        },
        {
          id: 'keeper-thesis',
          label: '（听园长说完那句话）',
          hidden: true,
          next: 'keeper-thesis',
          availableWhen: [achievement(ZOO_ACHIEVEMENT_IDS.physicsSolution)],
        },
        {
          id: 'keeper-renames',
          label: '（问园长还有没有别的名字）',
          hidden: true,
          next: 'keeper-renames',
          availableWhen: [achievement(S013_COMPLETED_ACHIEVEMENT)],
        },
        {
          id: 'talk-veteran',
          label: '（听老毕登说解法）',
          hidden: true,
          next: 'veteran-intro',
        },
        {
          id: 'talk-kaogu',
          label: '（和考古的访客说话）',
          hidden: true,
          next: 'visitor-kaogu',
        },
        {
          id: 'poster-rocket',
          label: '（看售票亭的海报）',
          hidden: true,
          next: 'card-rocket',
        },
      ],
    },

    'exhibit-pigeon-reveal': exhibitReveal(
      'exhibit-pigeon-reveal',
      '鸽馆',
      ZOO_EXHIBIT_PIGEON,
      ZOO_FLAGS.exhibitPigeon,
      [event(ZOO_EVENTS.cardThoughtStamp)],
    ),

    'exhibit-cat-reveal': exhibitReveal(
      'exhibit-cat-reveal',
      '猫馆',
      ZOO_EXHIBIT_CAT,
      ZOO_FLAGS.exhibitCat,
      [event(ZOO_EVENTS.cardTwoWayFoil)],
    ),

    'exhibit-monkey-reveal': exhibitReveal(
      'exhibit-monkey-reveal',
      '猿猴街',
      ZOO_EXHIBIT_MONKEY,
      ZOO_FLAGS.exhibitMonkey,
      [event(ZOO_EVENTS.cardGatling)],
    ),

    'exhibit-beast-reveal': exhibitReveal(
      'exhibit-beast-reveal',
      '兽舍分馆',
      ZOO_EXHIBIT_BEAST,
      ZOO_FLAGS.exhibitBeast,
      [],
    ),

    'exhibit-waterfowl-reveal': exhibitReveal(
      'exhibit-waterfowl-reveal',
      '水禽池',
      ZOO_EXHIBIT_WATERFOWL,
      ZOO_FLAGS.exhibitWaterfowl,
      [event(ZOO_EVENTS.cardJ20)],
      [
        {
          id: 'inspect-reflection-again',
          label: '（再看一眼水里的灯）',
          next: 'exhibit-waterfowl-hidden',
        },
      ],
    ),

    'exhibit-waterfowl-hidden': {
      savepoint: true,
      id: 'exhibit-waterfowl-hidden',
      title: '水禽池的倒影',
      role: null,
      text: ZOO_EXHIBIT_WATERFOWL_HIDDEN,
      choices: [
        {
          id: 'continue-waterfowl-hidden',
          label: '',
          autoAdvance: true,
          next: 'exhibits-open',
          effects: [
            event(ZOO_EVENTS.cardUniversalMap),
            { type: 'flag.set', flagId: ZOO_FLAGS.exhibitWaterfowl, value: true },
            event(ZOO_EVENTS.cardJ20),
          ],
        },
      ],
    },

    'keeper-rules': {
      savepoint: false,
      id: 'keeper-rules',
      title: '园长·逐影',
      role: '小城动物园园长',
      text: '「历届游客。你手里这份是第七版——第七条还空着，等下一个人。」\n\n「这本是守则，这本是解读。」',
      choices: [
        { id: 'ask-interpretation', label: '解读是谁写的？', next: 'keeper-interpretation' },
        { id: 'back-to-gate', label: '（回到售票亭）', next: 'gate-intro' },
      ],
    },

    'keeper-interpretation': {
      savepoint: false,
      id: 'keeper-interpretation',
      title: '园长·逐影',
      role: '小城动物园园长',
      text: ZOO_KEEPER_INTERPRETATION,
      choices: [{ id: 'back-to-gate', label: '（回到售票亭）', next: 'gate-intro' }],
    },

    'keeper-o5': {
      savepoint: false,
      id: 'keeper-o5',
      title: '园长·逐影',
      role: '小城动物园园长',
      text: ZOO_KEEPER_O5,
      choices: [
        { id: 'ask-o5-again', label: '（再看一眼他的工牌）', next: 'keeper-o5-badge' },
        { id: 'back-to-gate', label: '（回到售票亭）', next: 'gate-intro' },
      ],
    },

    'keeper-o5-badge': {
      savepoint: false,
      id: 'keeper-o5-badge',
      title: '工牌背面',
      role: '园长·逐影',
      text: ZOO_KEEPER_O5_BADGE,
      choices: [{ id: 'back-to-gate', label: '（回到售票亭）', next: 'gate-intro' }],
    },

    'keeper-three-years': {
      savepoint: false,
      id: 'keeper-three-years',
      title: '园长·逐影',
      role: '小城动物园园长',
      text: ZOO_KEEPER_THREE_YEARS,
      choices: [{ id: 'back-to-gate', label: '（回到售票亭）', next: 'gate-intro' }],
    },

    'keeper-night-light': {
      savepoint: false,
      id: 'keeper-night-light',
      title: '园长·逐影',
      role: '小城动物园园长',
      text: ZOO_KEEPER_NIGHT_LIGHT,
      choices: [{ id: 'back-to-gate', label: '（回到售票亭）', next: 'gate-intro' }],
    },

    'keeper-forms': {
      savepoint: false,
      id: 'keeper-forms',
      title: '园长·逐影',
      role: '小城动物园园长',
      text: ZOO_KEEPER_FORMS,
      choices: [{ id: 'back-to-gate', label: '（回到售票亭）', next: 'gate-intro' }],
    },

    'keeper-rain': {
      savepoint: false,
      id: 'keeper-rain',
      title: '园长·逐影',
      role: '小城动物园园长',
      text: ZOO_KEEPER_RAIN,
      choices: [{ id: 'back-to-gate', label: '（回到售票亭）', next: 'gate-intro' }],
    },

    'keeper-thesis': {
      savepoint: true,
      id: 'keeper-thesis',
      title: '园长·逐影',
      role: '小城动物园园长',
      text: ZOO_KEEPER_THESIS,
      choices: [
        {
          id: 'continue-after-thesis',
          label: '',
          autoAdvance: true,
          next: 'exhibits-open',
          effects: [event(ZOO_EVENTS.thesisHeard)],
        },
      ],
    },

    'keeper-renames': {
      savepoint: false,
      id: 'keeper-renames',
      title: '园长·逐影',
      role: '小城动物园园长',
      text: ZOO_KEEPER_RENAMES,
      choices: [backToHub],
    },

    'veteran-intro': {
      savepoint: false,
      id: 'veteran-intro',
      title: '老毕登',
      role: '军武解法收藏家',
      text: ZOO_VETERAN_INTRO,
      choices: [
        { id: 'veteran-yield', label: '当量到底多少才够？', next: 'veteran-yield' },
        { id: 'veteran-mech', label: '机械化部队怎么样？', next: 'veteran-mech' },
        backToHub,
      ],
    },

    'veteran-yield': {
      savepoint: false,
      id: 'veteran-yield',
      title: '老毕登',
      role: '军武解法收藏家',
      text: ZOO_VETERAN_YIELD,
      choices: [
        { id: 'side-ten', label: '（站在一千万吨这边）', next: 'card-yield' },
        { id: 'side-twenty', label: '（站在两千万吨这边）', next: 'card-yield' },
        backToHub,
      ],
    },

    'card-yield': {
      savepoint: false,
      id: 'card-yield',
      title: '当量谈判',
      role: '民间解法',
      text: cardText('zoo_card_yield_negotiation'),
      choices: [
        {
          id: 'continue-after-yield',
          label: '',
          autoAdvance: true,
          next: 'exhibits-open',
          effects: [event(ZOO_EVENTS.cardYieldNegotiation)],
        },
      ],
    },

    'veteran-mech': {
      savepoint: false,
      id: 'veteran-mech',
      title: '老毕登',
      role: '军武解法收藏家',
      text: ZOO_VETERAN_MECH,
      choices: [{ id: 'continue-mech', label: '（听他说完）', next: 'card-mech' }],
    },

    'card-mech': {
      savepoint: false,
      id: 'card-mech',
      title: '机械化部队闪击',
      role: '民间解法',
      text: cardText('zoo_card_mech_charge'),
      choices: [
        {
          id: 'continue-after-mech',
          label: '',
          autoAdvance: true,
          next: 'exhibits-open',
          effects: [event(ZOO_EVENTS.cardMechCharge)],
        },
      ],
    },

    'card-rocket': {
      savepoint: false,
      id: 'card-rocket',
      title: '无限火力火箭炮',
      role: '售票亭海报',
      text: cardText('zoo_card_rocket_artillery'),
      choices: [
        {
          id: 'continue-after-rocket',
          label: '',
          autoAdvance: true,
          next: 'exhibits-open',
          effects: [event(ZOO_EVENTS.cardRocketArtillery)],
        },
      ],
    },

    'visitor-kaogu': {
      savepoint: false,
      id: 'visitor-kaogu',
      title: '考古的访客',
      role: '游客',
      text: ZOO_VISITOR_KAOGU,
      choices: [
        { id: 'ask-kaogu', label: '「这是什么意思？」', next: 'visitor-kaogu-answer' },
        { id: 'back-to-exhibits', label: '（不打扰他）', next: 'exhibits-open' },
      ],
    },

    'visitor-kaogu-answer': {
      savepoint: false,
      id: 'visitor-kaogu-answer',
      title: '考古的访客',
      role: '游客',
      text: ZOO_VISITOR_KAOGU_ANSWER,
      choices: [
        {
          id: 'ask-archive-line',
          label: '（问起档案馆）',
          next: 'visitor-kaogu-s013',
          availableWhen: [achievement(S013_COMPLETED_ACHIEVEMENT)],
        },
        backToHub,
      ],
    },

    'visitor-kaogu-s013': {
      savepoint: false,
      id: 'visitor-kaogu-s013',
      title: '考古的访客',
      role: '游客',
      text: ZOO_VISITOR_KAOGU_S013,
      choices: [backToHub],
    },

    'museum-entry': {
      savepoint: true,
      id: 'museum-entry',
      title: '园史馆',
      role: '水墙',
      guide: guide(ZOO_GUIDE_OBJECTIVES.museumEntry),
      text: ZOO_MUSEUM_ENTRY,
      choices: [
        {
          id: 'continue-museum-echo',
          label: '',
          autoAdvance: true,
          next: 'museum-echo',
        },
      ],
    },

    'museum-echo': {
      savepoint: true,
      id: 'museum-echo',
      title: 'Echo Layer',
      role: `收藏 ${ZOO_ECHO_ARCHIVED_COUNT}，可读 ${ZOO_ECHO_READABLE_COUNT}`,
      text: ZOO_MUSEUM_ECHO,
      choices: [
        { id: 'read-plaque', label: '看铭牌', next: 'museum-plaque' },
        { id: 'ask-keeper', label: '问园长', next: 'museum-keeper' },
        { id: 'leave-echo', label: '（离开水墙）', next: 'museum-done' },
      ],
    },

    'museum-plaque': {
      savepoint: false,
      id: 'museum-plaque',
      title: '水墙铭牌',
      role: `收藏 ${ZOO_ECHO_ARCHIVED_COUNT}，可读 ${ZOO_ECHO_READABLE_COUNT}`,
      text: ZOO_MUSEUM_PLAQUE,
      choices: [{ id: 'back-to-echo', label: '（回到水墙前）', next: 'museum-echo' }],
    },

    'museum-keeper': {
      savepoint: false,
      id: 'museum-keeper',
      title: '园长·逐影',
      role: '小城动物园园长',
      text: ZOO_MUSEUM_KEEPER,
      choices: [
        {
          id: 'read-s013-letter',
          label: '（看那封档案馆长的信）',
          next: 'museum-keeper-s013',
          availableWhen: [achievement(S013_COMPLETED_ACHIEVEMENT)],
        },
        { id: 'back-to-echo', label: '（回到水墙前）', next: 'museum-echo' },
      ],
    },

    'museum-keeper-s013': {
      savepoint: false,
      id: 'museum-keeper-s013',
      title: '档案馆长的信',
      role: '只可阅读，不可抄录',
      text: ZOO_MUSEUM_KEEPER_S013,
      choices: [{ id: 'back-to-echo', label: '（回到水墙前）', next: 'museum-echo' }],
    },

    'museum-done': {
      savepoint: true,
      id: 'museum-done',
      title: '园史馆',
      role: '水墙',
      guide: guide(ZOO_GUIDE_OBJECTIVES.museumDone),
      text: ZOO_MUSEUM_DONE,
      choices: [
        {
          id: 'continue-after-museum',
          label: '',
          autoAdvance: true,
          next: 'exhibits-open',
          set: { [ZOO_FLAGS.museumDone]: true },
          effects: [flag(ZOO_FLAGS.museumDone, true), event(ZOO_EVENTS.museumDone)],
        },
      ],
    },

    'meeting-start': {
      savepoint: true,
      id: 'meeting-start',
      title: '办公室窗口',
      role: '例会夜',
      guide: guide(ZOO_GUIDE_OBJECTIVES.meetingStart),
      text: ZOO_MEETING_START,
      choices: [
        { id: 'ask-where', label: '他们人呢？', next: 'meeting-where' },
        {
          id: 'answer-rollcall',
          label: '（替一位缺席者答“到”）',
          next: 'meeting-answer',
          availableWhen: [flagIs(ZOO_FLAGS.rollcallAnswered, false)],
        },
        { id: 'meeting-end', label: '（等他念完）', next: 'meeting-end' },
        {
          id: 'meeting-s013',
          label: '（问起善后部那位）',
          next: 'meeting-s013',
          availableWhen: [achievement(S013_COMPLETED_ACHIEVEMENT)],
        },
      ],
    },

    'meeting-where': {
      savepoint: false,
      id: 'meeting-where',
      title: '办公室窗口',
      role: '例会夜',
      text: ZOO_MEETING_WHERE,
      choices: [{ id: 'back-to-meeting', label: '（回到窗口）', next: 'meeting-start' }],
    },

    'meeting-answer': {
      savepoint: false,
      id: 'meeting-answer',
      title: '办公室窗口',
      role: '例会夜',
      text: ZOO_MEETING_ANSWER,
      choices: [
        {
          id: 'continue-after-rollcall',
          label: '',
          autoAdvance: true,
          next: 'meeting-start',
          set: { [ZOO_FLAGS.rollcallAnswered]: true },
          effects: [flag(ZOO_FLAGS.rollcallAnswered, true), event(ZOO_EVENTS.rollCall)],
        },
      ],
    },

    'meeting-s013': {
      savepoint: false,
      id: 'meeting-s013',
      title: '办公室窗口',
      role: '例会夜',
      text: ZOO_MEETING_S013,
      choices: [{ id: 'back-to-meeting', label: '（回到窗口）', next: 'meeting-start' }],
    },

    'meeting-end': {
      savepoint: true,
      id: 'meeting-end',
      title: '办公室窗口',
      role: '例会夜',
      guide: guide(ZOO_GUIDE_OBJECTIVES.ruleBlank),
      text: ZOO_MEETING_END,
      choices: [
        {
          id: 'continue-rule-blank',
          label: '',
          autoAdvance: true,
          next: 'rule-blank',
          set: { [ZOO_FLAGS.meetingDone]: true },
          effects: [flag(ZOO_FLAGS.meetingDone, true), event(ZOO_EVENTS.meetingDone)],
        },
      ],
    },

    'rule-blank': {
      savepoint: true,
      id: 'rule-blank',
      title: '守则第七条',
      role: '空白栏',
      guide: guide(ZOO_GUIDE_OBJECTIVES.ruleBlank),
      text: ZOO_RULE_BLANK,
      choices: [
        {
          id: 'rule-keep',
          label: '写一条让人安心的规则',
          next: 'ending-keep',
          ending: ZOO_RULE_ENDING_ID,
          set: {
            [ZOO_FLAGS.ruleDirection]: 'keep',
            [ZOO_FLAGS.ruleVersion]: ZOO_RULE_VERSION_NEXT,
          },
          effects: [event(ZOO_EVENTS.ruleEight)],
        },
        {
          id: 'rule-joy',
          label: '写一条让人开心的规则',
          next: 'ending-joy',
          ending: ZOO_RULE_ENDING_ID,
          set: {
            [ZOO_FLAGS.ruleDirection]: 'joy',
            [ZOO_FLAGS.ruleVersion]: ZOO_RULE_VERSION_NEXT,
          },
          effects: [event(ZOO_EVENTS.ruleEight)],
        },
        {
          id: 'rule-pass',
          label: '先留空，交给下一位',
          next: 'ending-pass',
          ending: ZOO_RULE_ENDING_ID,
          set: {
            [ZOO_FLAGS.ruleDirection]: 'pass',
            [ZOO_FLAGS.ruleVersion]: ZOO_RULE_VERSION_NEXT,
          },
          effects: [event(ZOO_EVENTS.ruleEight)],
        },
      ],
    },

    'ending-keep': {
      id: 'ending-keep',
      title: '守则第八版',
      role: '结局',
      terminal: true,
      guide: null,
      text: ZOO_ENDING_KEEP,
      achievement: { id: ZOO_ACHIEVEMENT_IDS.ruleEight, name: '守则第八版·合著者' },
    },

    'ending-joy': {
      id: 'ending-joy',
      title: '守则第八版',
      role: '结局',
      terminal: true,
      guide: null,
      text: ZOO_ENDING_JOY,
      achievement: { id: ZOO_ACHIEVEMENT_IDS.ruleEight, name: '守则第八版·合著者' },
    },

    'ending-pass': {
      id: 'ending-pass',
      title: '守则第八版',
      role: '结局',
      terminal: true,
      guide: null,
      text: ZOO_ENDING_PASS,
      achievement: { id: ZOO_ACHIEVEMENT_IDS.ruleEight, name: '守则第八版·合著者' },
    },
  },
  sourceText: `S014 · 动物园怪谈（故事文档 2021-12-19 / 2026-05-06 / 2026-11-01 移植计划）。

真实事实：2021-12-14 联盟纲领 2.0；2021-12-18 月度会议室；
2021-12-19 动物园主帖与“他人解析”；2021-12-27 百科；2022-05-06 解析帖；
2023-03-05 法学会；2026 签名“三年后，复活”。
主帖评论 74 条、可读 16 条；姊妹帖 99/16；解析帖 51/16。
“数得出来，捞不上来”的水下留言层，是游戏内 Echo Layer 的 74/16 铭牌来源。
解析帖标注不适配：游戏内只作为收藏条目与“只可阅读不可抄录”的展柜。
第一人称投稿标注不适配：脆弱细节全部留在游戏外，园长是搭建者。
八张解法卡与“烤咕”来自真实评论，游戏内改写为短句；老毕登是唯一保留的具名评论者。
外部作品意象不进入文案。“沉水馆”是园内对“不存在的馆”的原创替代说法。

玩家做的事：读守则 → 回答门票问题 → 收下第七版守则与佚名解读 →
在五个展区各破一次戒 → 进园史馆读 74/16 水墙 → 在每月第一个周五
21:30–24:00 的例会窗口听点名 → 把守则翻到第七条，写下自己的那一条。
八张解法与五张申请表是可收集支线，不阻塞主线结局。`,
};

export { ZOO_BUILDING_ID };
