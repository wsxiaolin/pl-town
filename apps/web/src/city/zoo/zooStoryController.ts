import {
  S013_COMPLETED_ACHIEVEMENT,
  ZOO_ACHIEVEMENT_IDS,
  ZOO_BUILDING_ID,
  ZOO_EVENTS,
  ZOO_EXHIBIT_FLAGS,
  ZOO_FLAGS,
  ZOO_NPC_IDS,
  ZOO_POINT_IDS,
  ZOO_STORY_ID,
  ZOO_WORLD_POINT_IDS,
} from '../../gameplay/content/stories/zoo/zooMeta';
import {
  ZOO_BORROW_NOTE,
  ZOO_DOORPLATE,
  ZOO_DOORPLATE_KEEPER,
  ZOO_HANDOUT,
  ZOO_KEEPER_FORMS,
  ZOO_KEEPER_INTERPRETATION,
  ZOO_KEEPER_NIGHT_LIGHT,
  ZOO_KEEPER_O5,
  ZOO_KEEPER_RENAMES,
  ZOO_KEEPER_THREE_YEARS,
  ZOO_PHONE,
  ZOO_PROXY_KEEPER_ANSWER,
  ZOO_PROXY_SIGN,
  ZOO_SIGNIN,
  ZOO_TOASTS,
  ZOO_VETERAN_INTRO,
  ZOO_VISITOR_KAOGU,
} from '../../gameplay/content/stories/zoo/zooContent';
import { ZOO_STORY } from '../../gameplay/content/stories/zoo/zooStory';
import { getStoryEventCount, type StoryPhase } from '../../gameplay/stories/StoryRuntime';
import type { StoryConditionContext, StoryEvent } from '../../gameplay/stories/types';
import { LocalStorageStoryRepository } from '../../adapters/storage/stories/LocalStorageStoryRepository';
import { createStoryDialogFlow } from '../../adapters/ui/stories/storyDialogFlow';
import type { CityDialogController } from '../../adapters/ui/cityDialogController';
import { publishStoryGuideEvent } from '../../adapters/ui/storyTaskGuide';
import { openZooGuestBookPanel } from '../../adapters/ui/zoo/zooGuestBookPanel';
import { openZooRuleWritePanel } from '../../adapters/ui/zoo/zooRuleWritePanel';
import {
  createZooCollectionStore,
  resolveZooRuleLine,
  type ZooRuleDirection,
} from './zooCollectionStore';
import {
  isZooStorySuspended,
  resolveZooPointActivation,
  zooMeetingReady,
} from './zooControllerState';
import { normalizePendingAchievementIds, parsePendingAchievementIds, ZOO_PENDING_ACHIEVEMENTS_KEY } from './zooPending';
import { isZooMeetingDay, isZooMeetingWindow, nextZooMeetingDayKey } from './zooTime';

const TICK_INTERVAL_MS = 800;

const ACHIEVEMENT_NAMES: Record<string, string> = {
  [ZOO_ACHIEVEMENT_IDS.physicsSolution]: '物理解',
  [ZOO_ACHIEVEMENT_IDS.rollCall]: '代答到',
  [ZOO_ACHIEVEMENT_IDS.childHeart]: '童心免检',
  [ZOO_ACHIEVEMENT_IDS.ruleEight]: '守则第八版·合著者',
};

const CARD_EVENTS: Readonly<Record<string, string>> = {
  [ZOO_EVENTS.cardThoughtStamp]: 'zoo_card_thought_stamp',
  [ZOO_EVENTS.cardGatling]: 'zoo_card_gatling',
  [ZOO_EVENTS.cardYieldNegotiation]: 'zoo_card_yield_negotiation',
  [ZOO_EVENTS.cardTwoWayFoil]: 'zoo_card_two_way_foil',
  [ZOO_EVENTS.cardRocketArtillery]: 'zoo_card_rocket_artillery',
  [ZOO_EVENTS.cardJ20]: 'zoo_card_j20',
  [ZOO_EVENTS.cardMechCharge]: 'zoo_card_mech_charge',
  [ZOO_EVENTS.cardUniversalMap]: 'zoo_card_universal_map',
};

const RESUME_NODE_IDS = new Set([
  'exhibit-pigeon-reveal',
  'exhibit-cat-reveal',
  'exhibit-monkey-reveal',
  'exhibit-beast-reveal',
  'exhibit-waterfowl-reveal',
  'exhibit-waterfowl-hidden',
  'keeper-thesis',
  'museum-entry',
  'museum-done',
  'meeting-answer',
  'meeting-end',
]);

export interface ZooStoryControllerOptions {
  awardAchievement?: (achievementId: string, achievementName: string) => void;
  showToast?: (message: string) => void;
  getQuestContext?: () => StoryConditionContext;
  getPlayerPosition?: () => { x: number; z: number } | null;
  getDialogs?: () => CityDialogController | null;
  setStoryPoints?: (ids: readonly string[]) => void;
  isMeetingWindow?: () => boolean;
  isMeetingDay?: () => boolean;
  now?: () => number;
}

export function createZooStoryController(options: ZooStoryControllerOptions) {
  const repository = new LocalStorageStoryRepository(ZOO_STORY);
  const collection = createZooCollectionStore({
    onAllCardsCollected: () => awardZooAchievement(ZOO_ACHIEVEMENT_IDS.physicsSolution),
  });

  const flow = createStoryDialogFlow(ZOO_STORY, repository, {
    getContext: options.getQuestContext,
    onEvent: (event) => handleEvent(event),
    onWorldInteractionsChanged: () => syncStoryPoints(),
  });

  let tickTimer: ReturnType<typeof setInterval> | undefined;
  let onlineHandler: (() => void) | undefined;
  let lastMeetingWindow: boolean | undefined;
  let suspensionAnnounced = false;
  let guideKey = '';
  let pendingRuleLine: string | null = null;

  function meetingWindow(): boolean {
    return options.isMeetingWindow?.() ?? isZooMeetingWindow({ now: options.now?.() });
  }

  function meetingDay(): boolean {
    return options.isMeetingDay?.() ?? isZooMeetingDay(options.now?.());
  }

  function context(): StoryConditionContext {
    return options.getQuestContext?.() ?? {};
  }

  function hasAchievement(id: string): boolean {
    return context().achievements?.has(id) ?? false;
  }

  function readPending(): string[] {
    try {
      return parsePendingAchievementIds(window.localStorage.getItem(ZOO_PENDING_ACHIEVEMENTS_KEY));
    } catch {
      return [];
    }
  }

  function writePending(ids: readonly string[]): void {
    try {
      if (ids.length === 0) window.localStorage.removeItem(ZOO_PENDING_ACHIEVEMENTS_KEY);
      else window.localStorage.setItem(ZOO_PENDING_ACHIEVEMENTS_KEY, JSON.stringify(normalizePendingAchievementIds(ids)));
    } catch {
      // Storage can be unavailable in privacy modes; awards still go out this session.
    }
  }

  function awardZooAchievement(id: string): void {
    if (hasAchievement(id)) {
      writePending(readPending().filter((item) => item !== id));
      return;
    }
    writePending([...readPending(), id]);
    options.awardAchievement?.(id, ACHIEVEMENT_NAMES[id] ?? id);
  }

  function retryPendingAchievements(): void {
    const pending = readPending();
    if (pending.length === 0) return;
    const remaining: string[] = [];
    pending.forEach((id) => {
      if (hasAchievement(id)) return;
      remaining.push(id);
      options.awardAchievement?.(id, ACHIEVEMENT_NAMES[id] ?? id);
    });
    writePending(remaining);
  }

  function exhibits(): boolean[] {
    const flags = flow.state().flags;
    return ZOO_EXHIBIT_FLAGS.map((flagId) => flags[flagId] === true);
  }

  function allExhibitsVisited(): boolean {
    return exhibits().every(Boolean);
  }

  function museumDone(): boolean {
    return flow.state().flags[ZOO_FLAGS.museumDone] === true;
  }

  function meetingDone(): boolean {
    return flow.state().flags[ZOO_FLAGS.meetingDone] === true;
  }

  function ticketAnswered(): boolean {
    return getStoryEventCount(flow.state(), ZOO_EVENTS.ticketAnswered) > 0;
  }

  function suspended(): boolean {
    return isZooStorySuspended({ museumDone: museumDone(), meetingDone: meetingDone(), meetingWindow: meetingWindow() });
  }

  function syncStoryPoints(): void {
    options.setStoryPoints?.(resolveZooPointActivation({
      nodeId: flow.state().nodeId,
      ticketAnswered: ticketAnswered(),
      exhibits: exhibits(),
      museumDone: museumDone(),
      meetingDone: meetingDone(),
      meetingWindow: meetingWindow(),
    }));
  }

  function publishGuide(type: 'story.guide.updated' | 'story.guide.cleared'): void {
    const nodeId = flow.state().nodeId;
    const guide = flow.state().activeGuide;
    if (type === 'story.guide.cleared' || !guide) {
      publishStoryGuideEvent({
        id: `${ZOO_STORY_ID}:guide:${Date.now()}`,
        type: 'story.guide.cleared',
        at: Date.now(),
        payload: { storyId: ZOO_STORY_ID, nodeId },
      });
      return;
    }
    publishStoryGuideEvent({
      id: `${ZOO_STORY_ID}:guide:${Date.now()}`,
      type: 'story.guide.updated',
      at: Date.now(),
      payload: { storyId: ZOO_STORY_ID, nodeId, title: guide.title, objective: guide.objective },
    });
  }

  function syncGuide(): void {
    const guide = flow.state().activeGuide;
    const phase = flow.phase();
    const key = phase === 'untouched' || phase === 'concluded' || suspended() || !guide
      ? 'cleared'
      : `updated:${flow.state().nodeId}:${guide.title}:${guide.objective}`;
    if (key === guideKey) return;
    guideKey = key;
    publishGuide(key === 'cleared' ? 'story.guide.cleared' : 'story.guide.updated');
  }

  function announceSuspension(): void {
    if (!suspended()) {
      suspensionAnnounced = false;
      return;
    }
    if (suspensionAnnounced) return;
    suspensionAnnounced = true;
    const dayKey = nextZooMeetingDayKey(options.now?.());
    const [, month, day] = dayKey.split('-');
    options.showToast?.(`办公室的灯还没亮。下一次例会夜：${Number(month)}月${Number(day)}日 21:30。`);
  }

  function refreshState(): void {
    syncStoryPoints();
    syncGuide();
    announceSuspension();
  }

  function finalizeRule(): void {
    const direction = flow.state().flags[ZOO_FLAGS.ruleDirection];
    const resolved = direction === 'keep' || direction === 'joy' || direction === 'pass' ? direction : 'keep';
    collection.setRule(resolveZooRuleLine(resolved, pendingRuleLine ?? ''));
    pendingRuleLine = null;
  }

  function handleEvent(event: StoryEvent): void {
    if (event.type === ZOO_EVENTS.childHeart) {
      collection.setBracelet();
      awardZooAchievement(ZOO_ACHIEVEMENT_IDS.childHeart);
    }
    if (event.type === ZOO_EVENTS.formAlliance) collection.addForm('zoo_form_alliance');
    if (event.type === ZOO_EVENTS.rollCall) awardZooAchievement(ZOO_ACHIEVEMENT_IDS.rollCall);
    if (event.type === ZOO_EVENTS.ruleEight) {
      finalizeRule();
      awardZooAchievement(ZOO_ACHIEVEMENT_IDS.ruleEight);
    }
    if (event.type === ZOO_EVENTS.thesisHeard) collection.markThesisHeard();
    if (event.type === ZOO_EVENTS.cardsComplete) awardZooAchievement(ZOO_ACHIEVEMENT_IDS.physicsSolution);
    const cardId = CARD_EVENTS[event.type];
    if (cardId) collection.addCard(cardId);
    refreshState();
  }

  function showSimpleStory(
    dialogs: CityDialogController,
    title: string,
    role: string | null,
    text: string,
  ): void {
    dialogs.openStory({
      title,
      role,
      text,
      options: [{ text: '（离开）', onPick: () => dialogs.closeNpc() }],
    });
  }

  function openKeeperMenu(dialogs: CityDialogController): void {
    const show = (text: string): void => {
      dialogs.openStory({
        title: '园长·逐影',
        role: '小城动物园园长',
        text,
        options: [{ text: '（回到售票亭）', onPick: () => openKeeperMenu(dialogs) }],
      });
    };
    const optionsList = [
      { text: '守则是谁写的？', onPick: () => show(ZOO_KEEPER_INTERPRETATION) },
      { text: 'O5 是什么？', onPick: () => show(ZOO_KEEPER_O5) },
      { text: '园子为什么关了三年？', onPick: () => show(ZOO_KEEPER_THREE_YEARS) },
      { text: '晚上办公室为什么总亮着灯？', onPick: () => show(ZOO_KEEPER_NIGHT_LIGHT) },
      { text: '你为什么老在发申请表？', onPick: () => show(ZOO_KEEPER_FORMS) },
    ];
    if (hasAchievement(S013_COMPLETED_ACHIEVEMENT)) {
      optionsList.push({ text: '（问起那些名字）', onPick: () => show(ZOO_KEEPER_RENAMES) });
    }
    optionsList.push({ text: '（聊到这儿）', onPick: () => dialogs.closeNpc() });
    dialogs.openStory({
      title: '园长·逐影',
      role: '小城动物园园长',
      text: ZOO_HANDOUT,
      options: optionsList,
    });
  }

  function enterMeeting(dialogs: CityDialogController): boolean {
    if (flow.choose(dialogs, 'attend-meeting')) {
      refreshState();
      return true;
    }
    return false;
  }

  function interactKeeper(dialogs: CityDialogController): boolean {
    const nodeId = flow.state().nodeId;
    if (nodeId === 'exhibits-open') {
      if (meetingWindow() && museumDone() && allExhibitsVisited() && !meetingDone() && enterMeeting(dialogs)) return true;
      if (collection.allCardsCollected() && !collection.get().thesisHeard && flow.choose(dialogs, 'keeper-thesis')) {
        refreshState();
        return true;
      }
      if (hasAchievement(S013_COMPLETED_ACHIEVEMENT) && flow.choose(dialogs, 'keeper-renames')) {
        refreshState();
        return true;
      }
      openKeeperMenu(dialogs);
      return true;
    }
    if (nodeId === 'rule-blank') {
      openRuleWriter(dialogs);
      return true;
    }
    flow.open(dialogs);
    refreshState();
    return true;
  }

  function interactVeteran(dialogs: CityDialogController): boolean {
    if (flow.state().nodeId === 'exhibits-open' && flow.choose(dialogs, 'talk-veteran')) {
      refreshState();
      return true;
    }
    showSimpleStory(dialogs, '老毕登', '军武解法收藏家', ZOO_VETERAN_INTRO);
    return true;
  }

  function interactVisitor(dialogs: CityDialogController): boolean {
    if (flow.state().nodeId === 'exhibits-open' && flow.choose(dialogs, 'talk-kaogu')) {
      refreshState();
      return true;
    }
    showSimpleStory(dialogs, '考古的访客', '游客', ZOO_VISITOR_KAOGU);
    return true;
  }

  function interactOffice(dialogs: CityDialogController): boolean {
    const nodeId = flow.state().nodeId;
    if (nodeId === 'rule-blank') {
      openRuleWriter(dialogs);
      return true;
    }
    if (nodeId === 'meeting-start' || nodeId === 'meeting-where' || nodeId === 'meeting-answer'
      || nodeId === 'meeting-s013' || nodeId === 'meeting-end') {
      flow.open(dialogs);
      refreshState();
      return true;
    }
    if (!allExhibitsVisited()) {
      options.showToast?.(ZOO_TOASTS.visitExhibits);
      return true;
    }
    if (!museumDone()) {
      options.showToast?.('先去园史馆，看看那面水墙。');
      return true;
    }
    if (meetingDone()) {
      options.showToast?.(ZOO_TOASTS.ruleAlreadyWritten);
      return true;
    }
    if (!meetingWindow()) {
      options.showToast?.(meetingDay() ? ZOO_TOASTS.meetingNotLit : ZOO_TOASTS.notMeetingDay);
      return true;
    }
    if (nodeId === 'exhibits-open' && enterMeeting(dialogs)) return true;
    return false;
  }

  function openGuestBook(dialogs: CityDialogController): boolean {
    openZooGuestBookPanel({
      collection: collection.get(),
      onWriteRule: flow.state().nodeId === 'rule-blank' ? () => openRuleWriter(dialogs) : undefined,
    });
    return true;
  }

  function openRuleWriter(dialogs: CityDialogController): void {
    if (flow.state().nodeId !== 'rule-blank') {
      options.showToast?.(collection.get().ruleVersion >= 8 ? ZOO_TOASTS.ruleAlreadyWritten : ZOO_TOASTS.notMeetingDay);
      return;
    }
    openZooRuleWritePanel({
      onSubmit: (direction: ZooRuleDirection, line: string) => {
        pendingRuleLine = line;
        if (!flow.choose(dialogs, `rule-${direction}`)) {
          pendingRuleLine = null;
          options.showToast?.('提交失败，请重试。');
          return;
        }
        refreshState();
      },
    });
  }

  function interactInterestPoint(interestPointId: string, dialogs: CityDialogController): boolean {
    if ((ZOO_WORLD_POINT_IDS as readonly string[]).includes(interestPointId)) {
      const handled = flow.interactInterestPoint(interestPointId, dialogs);
      if (handled) refreshState();
      return handled;
    }
    if (!ticketAnswered()) return false;
    if (interestPointId === ZOO_POINT_IDS.office) return interactOffice(dialogs);
    if (interestPointId === ZOO_POINT_IDS.stand) return openGuestBook(dialogs);
    if (interestPointId === ZOO_POINT_IDS.signin) {
      showSimpleStory(dialogs, '逐影联盟点名簿', '签名栏', ZOO_SIGNIN);
      return true;
    }
    if (interestPointId === ZOO_POINT_IDS.borrowNote) {
      showSimpleStory(dialogs, '借条展品', '园史馆', ZOO_BORROW_NOTE);
      return true;
    }
    if (interestPointId === ZOO_POINT_IDS.doorplate) {
      const extra = hasAchievement(S013_COMPLETED_ACHIEVEMENT) ? '\n\n此门通向城南。' : '';
      showSimpleStory(dialogs, '旧门牌', '园史馆门楣', `${ZOO_DOORPLATE}\n\n${ZOO_DOORPLATE_KEEPER}${extra}`);
      return true;
    }
    if (interestPointId === ZOO_POINT_IDS.phone) {
      showSimpleStory(dialogs, '黄色电话亭', '猿猴街口', ZOO_PHONE);
      return true;
    }
    if (interestPointId === ZOO_POINT_IDS.proxySign) {
      showSimpleStory(dialogs, '代理园长铭牌', '售票亭侧面', `${ZOO_PROXY_SIGN}\n\n${ZOO_PROXY_KEEPER_ANSWER}`);
      return true;
    }
    return false;
  }

  function interactBuilding(buildingId: string, dialogs: CityDialogController): boolean {
    if (buildingId !== ZOO_BUILDING_ID) return false;
    flow.open(dialogs);
    refreshState();
    return true;
  }

  function interactNpc(npcId: string, dialogs: CityDialogController): boolean {
    if (npcId === ZOO_NPC_IDS.keeper) return interactKeeper(dialogs);
    if (npcId === ZOO_NPC_IDS.veteran) return interactVeteran(dialogs);
    if (npcId === ZOO_NPC_IDS.visitor) return interactVisitor(dialogs);
    return false;
  }

  function ownsEntry(kind: 'actor' | 'building', targetId: string): boolean {
    if (kind === 'building') return targetId === ZOO_BUILDING_ID;
    return targetId === ZOO_NPC_IDS.keeper || targetId === ZOO_NPC_IDS.veteran || targetId === ZOO_NPC_IDS.visitor;
  }

  function tick(): void {
    const dialogs = options.getDialogs?.() ?? null;
    const nodeId = flow.state().nodeId;
    if (dialogs && !dialogs.isOpen() && RESUME_NODE_IDS.has(nodeId)) {
      flow.open(dialogs);
      refreshState();
      return;
    }
    const currentWindow = meetingWindow();
    if (currentWindow !== lastMeetingWindow) {
      lastMeetingWindow = currentWindow;
      refreshState();
    }
  }

  function ensureTicking(): void {
    if (tickTimer) return;
    tickTimer = setInterval(() => {
      try {
        tick();
      } catch {
        // Keep the interaction paths usable if a tick fails.
      }
    }, TICK_INTERVAL_MS);
  }

  return {
    story: flow,
    interactBuilding,
    interactNpc,
    interactInterestPoint,
    announceGuide: syncGuide,
    syncActiveActors: () => flow.syncActiveActors(),
    state: () => flow.state(),
    phase: (): StoryPhase => (suspended() ? 'concluded' : flow.phase()),
    ownsEntry,
    start: () => {
      ensureTicking();
      flow.syncWorldInteractions();
      refreshState();
      retryPendingAchievements();
      if (!onlineHandler) {
        onlineHandler = () => {
          retryPendingAchievements();
          refreshState();
        };
        window.addEventListener('online', onlineHandler);
      }
    },
    dispose: () => {
      if (tickTimer) clearInterval(tickTimer);
      tickTimer = undefined;
      if (onlineHandler) window.removeEventListener('online', onlineHandler);
      onlineHandler = undefined;
    },
  };
}

export type ZooStoryController = ReturnType<typeof createZooStoryController>;
