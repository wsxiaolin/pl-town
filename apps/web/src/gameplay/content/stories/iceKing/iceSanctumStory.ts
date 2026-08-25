import type { StoryDefinition } from '../../../stories/types';

export const ICE_SANCTUM_STORY_ID = 'main.ice-king.sanctum';

export const ICE_SANCTUM_NODES = Object.freeze({
  start: 'audience-silence',
  invitation: 'invitation',
  rejectResponse: 'reject-response',
  acceptResponse: 'accept-response',
  timeSkipBlackout: 'time-skip-blackout',
  timeSkipCaption: 'time-skip-caption',
  afterCrown: 'after-time-skip-crown',
  afterThanks: 'after-time-skip-thanks',
  afterGift: 'after-time-skip-gift',
  rejectPending: 'reject-reward-pending',
  acceptPending: 'accept-reward-pending',
  rejectComplete: 'reject-complete',
  acceptComplete: 'accept-complete',
});

export const ICE_SANCTUM_CHOICES = Object.freeze({
  acceptCasual: 'accept-casual',
  acceptHonor: 'accept-honor',
  reject: 'reject-invitation',
  toBlackout: 'continue-to-blackout',
  toCaption: 'continue-to-caption',
  resumeAudience: 'resume-audience',
  receiveGift: 'receive-lemonade',
  completeReward: 'complete-reward',
});

export const ICE_SANCTUM_STORY: StoryDefinition = {
  schemaVersion: 1,
  definitionVersion: 1,
  id: ICE_SANCTUM_STORY_ID,
  title: 'King Ice',
  startNode: ICE_SANCTUM_NODES.start,
  nodes: {
    [ICE_SANCTUM_NODES.start]: {
      id: ICE_SANCTUM_NODES.start,
      title: '？？？',
      text: '……',
      choices: [{ id: 'ask-identity', label: '你是……', next: 'identity' }],
    },
    identity: {
      savepoint: false,
      id: 'identity',
      title: '？？？',
      text: '冰',
      choices: [
        { id: 'ask-purpose', label: '哦，你在这做什么', next: 'response' },
        { id: 'hail-ice', label: '我的天哪冰块大人', next: 'response' },
        { id: 'apologize-to-ice', label: '呜呜呜我不该来这里的对不起对不起对不起不要惩罚我冰块大人呜呜呜', next: 'response' },
      ],
    },
    response: {
      savepoint: false,
      id: 'response',
      title: 'Ice',
      text: '……',
      choices: [{ id: 'confused', label: '？？', next: ICE_SANCTUM_NODES.invitation }],
    },
    [ICE_SANCTUM_NODES.invitation]: {
      savepoint: false,
      id: ICE_SANCTUM_NODES.invitation,
      title: 'Ice',
      text: '你……愿意陪我坐一会吗？',
      choices: [
        { id: ICE_SANCTUM_CHOICES.acceptCasual, label: '……行？', next: ICE_SANCTUM_NODES.acceptResponse },
        { id: ICE_SANCTUM_CHOICES.acceptHonor, label: '我的荣幸冰块大人', next: ICE_SANCTUM_NODES.acceptResponse },
        { id: ICE_SANCTUM_CHOICES.reject, label: '不……', next: ICE_SANCTUM_NODES.rejectResponse },
      ],
    },
    [ICE_SANCTUM_NODES.rejectResponse]: {
      savepoint: false,
      id: ICE_SANCTUM_NODES.rejectResponse,
      title: 'Ice',
      text: '……抱歉',
      choices: [{ id: 'prepare-reject-reward', label: '', next: ICE_SANCTUM_NODES.rejectPending, hidden: true }],
    },
    [ICE_SANCTUM_NODES.acceptResponse]: {
      savepoint: false,
      id: ICE_SANCTUM_NODES.acceptResponse,
      title: 'Ice',
      text: '……谢谢',
      choices: [{ id: ICE_SANCTUM_CHOICES.toBlackout, label: '', next: ICE_SANCTUM_NODES.timeSkipBlackout, hidden: true }],
    },
    [ICE_SANCTUM_NODES.timeSkipBlackout]: {
      savepoint: false,
      id: ICE_SANCTUM_NODES.timeSkipBlackout,
      title: null,
      text: '',
      presentation: 'blackout',
      choices: [{ id: ICE_SANCTUM_CHOICES.toCaption, label: '', next: ICE_SANCTUM_NODES.timeSkipCaption, hidden: true }],
    },
    [ICE_SANCTUM_NODES.timeSkipCaption]: {
      savepoint: false,
      id: ICE_SANCTUM_NODES.timeSkipCaption,
      title: null,
      text: '一段时间后……',
      presentation: 'blackout',
      choices: [{ id: ICE_SANCTUM_CHOICES.resumeAudience, label: '', next: ICE_SANCTUM_NODES.afterCrown, hidden: true }],
    },
    [ICE_SANCTUM_NODES.afterCrown]: {
      savepoint: false,
      id: ICE_SANCTUM_NODES.afterCrown,
      title: 'Ice',
      text: '你喜欢我的皇冠吗？',
      choices: [
        { id: 'like-crown', label: '喜欢', next: ICE_SANCTUM_NODES.afterThanks },
        { id: 'praise-crown', label: '呃……挺好的', next: ICE_SANCTUM_NODES.afterThanks },
      ],
    },
    [ICE_SANCTUM_NODES.afterThanks]: {
      savepoint: false,
      id: ICE_SANCTUM_NODES.afterThanks,
      title: 'Ice',
      text: '谢谢，我很喜欢你陪着我的感觉。',
      choices: [{ id: 'ask-meaning', label: '什么？', next: ICE_SANCTUM_NODES.afterGift }],
    },
    [ICE_SANCTUM_NODES.afterGift]: {
      savepoint: false,
      id: ICE_SANCTUM_NODES.afterGift,
      title: 'Ice',
      text: '没什么，希望你喜欢这杯柠檬茶',
      choices: [{ id: ICE_SANCTUM_CHOICES.receiveGift, label: '收下', next: ICE_SANCTUM_NODES.acceptPending }],
    },
    [ICE_SANCTUM_NODES.rejectPending]: {
      id: ICE_SANCTUM_NODES.rejectPending,
      title: null,
      text: '',
      presentation: 'blackout',
      choices: [{ id: ICE_SANCTUM_CHOICES.completeReward, label: '', next: ICE_SANCTUM_NODES.rejectComplete, ending: 'reject', hidden: true }],
    },
    [ICE_SANCTUM_NODES.acceptPending]: {
      id: ICE_SANCTUM_NODES.acceptPending,
      title: null,
      text: '',
      presentation: 'blackout',
      choices: [{ id: ICE_SANCTUM_CHOICES.completeReward, label: '', next: ICE_SANCTUM_NODES.acceptComplete, ending: 'accept', hidden: true }],
    },
    [ICE_SANCTUM_NODES.rejectComplete]: { id: ICE_SANCTUM_NODES.rejectComplete, text: '', terminal: true },
    [ICE_SANCTUM_NODES.acceptComplete]: { id: ICE_SANCTUM_NODES.acceptComplete, text: '', terminal: true },
  },
};

export const ICE_SANCTUM_TIMINGS_MS = Object.freeze({
  rejectReturn: 2_000,
  acceptBlackout: 2_400,
  acceptTimeSkip: 2_000,
  acceptResume: 2_500,
  finishAccept: 300,
});
