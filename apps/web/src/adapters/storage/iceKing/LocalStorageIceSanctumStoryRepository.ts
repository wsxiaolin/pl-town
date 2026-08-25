import { createInitialStoryState } from '../../../gameplay/stories/StoryRuntime';
import type { StoryFlagValue, StoryGuide, StoryState } from '../../../gameplay/stories/types';
import {
  ICE_KING_REPEATABLE_RESIDENT_ID,
  ICE_SANCTUM_CHOICE_STORAGE_PREFIX,
  type IceSanctumEnding,
} from '../../../gameplay/content/stories/iceKing/iceKingContent';
import {
  ICE_SANCTUM_NODES,
  ICE_SANCTUM_STORY,
  ICE_SANCTUM_STORY_ID,
} from '../../../gameplay/content/stories/iceKing/iceSanctumStory';
import type {
  IceSanctumProgressStore,
  IceSanctumStoryRepository,
} from '../../../city/iceKing/iceSanctumPorts';

const CLAIM_SEQUENCE_FLAG = 'rewardClaimSequence';
type StoragePort = Pick<Storage, 'getItem' | 'setItem'>;

function isEnding(value: unknown): value is IceSanctumEnding {
  return value === 'accept' || value === 'reject';
}

function completeNode(ending: IceSanctumEnding): string {
  return ending === 'accept' ? ICE_SANCTUM_NODES.acceptComplete : ICE_SANCTUM_NODES.rejectComplete;
}

function pendingNode(ending: IceSanctumEnding): string {
  return ending === 'accept' ? ICE_SANCTUM_NODES.acceptPending : ICE_SANCTUM_NODES.rejectPending;
}

export function createLocalStorageIceSanctumProgressStore(options: {
  storage?: StoragePort | null;
  getResidentId?: () => string;
} = {}): IceSanctumProgressStore {
  const storage = (): StoragePort | null => {
    if (options.storage !== undefined) return options.storage;
    try { return typeof localStorage === 'undefined' ? null : localStorage; }
    catch { return null; }
  };
  const residentId = (): string => {
    if (options.getResidentId) return options.getResidentId() || 'visitor';
    try { return storage()?.getItem('minicityUser') || 'visitor'; }
    catch { return 'visitor'; }
  };
  const storyKey = (resident: string): string => `minicityStory.${ICE_SANCTUM_STORY_ID}.v1:${resident}`;
  const legacyKey = (resident: string): string => `${ICE_SANCTUM_CHOICE_STORAGE_PREFIX}${resident}`;

  function readState(resident: string): StoryState | null {
    const target = storage();
    if (!target) return null;
    const raw = target.getItem(storyKey(resident));
    if (raw) {
      try {
        const value = JSON.parse(raw) as Partial<StoryState>;
        if (value.storyId !== ICE_SANCTUM_STORY_ID || typeof value.nodeId !== 'string' || !ICE_SANCTUM_STORY.nodes[value.nodeId]) return null;
        return {
          ...createInitialStoryState(ICE_SANCTUM_STORY),
          nodeId: value.nodeId,
          flags: readFlags(value.flags),
          ending: isEnding(value.ending) ? value.ending : undefined,
          visitCount: Number.isInteger(value.visitCount) && value.visitCount! >= 0 ? value.visitCount! : 0,
          nodeEnteredGameDay: Number.isInteger(value.nodeEnteredGameDay) ? value.nodeEnteredGameDay : undefined,
          activeGuide: readGuide(value.activeGuide),
          updatedAt: typeof value.updatedAt === 'number' ? value.updatedAt : Date.now(),
        };
      } catch { return null; }
    }
    const legacyEnding = target.getItem(legacyKey(resident));
    if (!isEnding(legacyEnding)) return null;
    return { ...createInitialStoryState(ICE_SANCTUM_STORY), nodeId: completeNode(legacyEnding), ending: legacyEnding };
  }

  function readFlags(value: unknown): Record<string, StoryFlagValue> {
    if (!value || typeof value !== 'object') return {};
    return Object.fromEntries(Object.entries(value).filter((entry): entry is [string, StoryFlagValue] =>
      typeof entry[1] === 'boolean' || typeof entry[1] === 'number' || typeof entry[1] === 'string'));
  }

  function readGuide(value: unknown): StoryGuide | undefined {
    if (!value || typeof value !== 'object') return undefined;
    const guide = value as Partial<StoryGuide>;
    return typeof guide.title === 'string' && typeof guide.objective === 'string'
      ? { title: guide.title, objective: guide.objective, visibleWhen: guide.visibleWhen }
      : undefined;
  }

  function openSession(): IceSanctumStoryRepository {
    const resident = residentId();
    const repeatNode = readState(resident)?.nodeId;
    let resetRepeatCompletion = resident === ICE_KING_REPEATABLE_RESIDENT_ID
      && (repeatNode === ICE_SANCTUM_NODES.acceptComplete || repeatNode === ICE_SANCTUM_NODES.rejectComplete);

    const repository: IceSanctumStoryRepository = {
      get(storyId) {
        if (storyId !== ICE_SANCTUM_STORY_ID || resetRepeatCompletion) return null;
        return readState(resident);
      },
      update(storyId, patch) {
        if (storyId !== ICE_SANCTUM_STORY_ID || !ICE_SANCTUM_STORY.nodes[patch.nodeId]) return null;
        const current = repository.get(storyId) ?? createInitialStoryState(ICE_SANCTUM_STORY);
        const next: StoryState = {
          ...current,
          nodeId: patch.nodeId,
          flags: patch.flags ?? current.flags,
          ending: patch.ending ?? current.ending,
          visitCount: current.visitCount + (patch.visit ? 1 : 0),
          nodeEnteredGameDay: patch.nodeEnteredGameDay ?? current.nodeEnteredGameDay,
          activeGuide: patch.activeGuide === null ? undefined : patch.activeGuide ?? current.activeGuide,
          updatedAt: Date.now(),
        };
        const target = storage();
        if (!target) throw new Error('Ice sanctum progress storage is unavailable');
        target.setItem(storyKey(resident), JSON.stringify(next));
        resetRepeatCompletion = false;
        return next;
      },
      pendingReward() {
        const state = repository.get(ICE_SANCTUM_STORY_ID);
        const ending = state?.nodeId === ICE_SANCTUM_NODES.acceptPending
          ? 'accept'
          : state?.nodeId === ICE_SANCTUM_NODES.rejectPending ? 'reject' : null;
        const claimSequence = state?.flags[CLAIM_SEQUENCE_FLAG];
        return ending && typeof claimSequence === 'number' && Number.isSafeInteger(claimSequence) && claimSequence > 0
          ? { ending, claimSequence }
          : null;
      },
      prepareReward(ending, claimSequence) {
        const current = repository.get(ICE_SANCTUM_STORY_ID) ?? createInitialStoryState(ICE_SANCTUM_STORY);
        repository.update(ICE_SANCTUM_STORY_ID, {
          nodeId: pendingNode(ending),
          flags: { ...current.flags, [CLAIM_SEQUENCE_FLAG]: claimSequence },
          ending,
        });
      },
    };
    return repository;
  }

  return {
    hasCompleted() {
      const resident = residentId();
      if (resident === ICE_KING_REPEATABLE_RESIDENT_ID) return false;
      try {
        const nodeId = readState(resident)?.nodeId;
        return nodeId === ICE_SANCTUM_NODES.acceptComplete || nodeId === ICE_SANCTUM_NODES.rejectComplete;
      } catch { return false; }
    },
    openSession,
  };
}
