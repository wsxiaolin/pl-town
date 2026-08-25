import type { IceKingRewardId } from '../../gameplay/content/stories/iceKing/iceKingContent';
import { playCatDeathCGAfterBlackout, stopCatDeathCG } from '../../adapters/ui/iceKing/catDeathCGController';
import { createCatCafeIceWallFeature } from './catCafeIceWallInteraction';
import {
  createIceSanctumExperience,
  type IceSanctumExperienceOptions,
} from './createIceSanctumExperience';

type IceKingProgressionPort = {
  isOnline(): boolean;
  getProgress(): { inventory: Readonly<Record<string, number | undefined>> };
  consumeItem(itemId: string, count: number): Promise<boolean>;
  nextRewardClaimSequence(rewardId: IceKingRewardId): number | null;
  claimReward(rewardId: string, requestedSequence?: number): Promise<boolean>;
};

export type IceKingFeatureExperienceOptions = Omit<
  IceSanctumExperienceOptions,
  'nextRewardClaimSequence' | 'claimReward' | 'onEnterUnavailable' | 'onProgressFailure' | 'onRewardFailure'
> & {
  progression: IceKingProgressionPort;
  awardAchievement: (achievementId: string, achievementName: string) => void | Promise<void>;
  showToast: (message: string) => void;
};

export function createIceKingFeatureExperience(options: IceKingFeatureExperienceOptions) {
  const sanctum = createIceSanctumExperience({
    ...options,
    nextRewardClaimSequence: options.progression.nextRewardClaimSequence,
    claimReward: (rewardId, claimSequence) => options.progression.claimReward(rewardId, claimSequence),
    onEnterUnavailable: () => options.showToast('城市仍在准备，请稍后再试'),
    onProgressFailure: () => options.showToast('皇冠剧情进度保存失败，请检查浏览器存储设置'),
    onRewardFailure: () => options.showToast('奖励领取失败，可以再次进入皇冠建筑重试'),
  });
  const dialogs = options.dialogs();
  if (!dialogs) {
    sanctum.dispose();
    throw new Error('Ice King feature requires the city dialog controller');
  }
  const iceWall = createCatCafeIceWallFeature({
    dialogs,
    progression: options.progression,
    awardAchievement: options.awardAchievement,
    showToast: options.showToast,
    startCatDeathCG: async () => (await playCatDeathCGAfterBlackout())?.finished ?? null,
    stopCatDeathCG,
  });
  return {
    sanctum,
    iceWall,
    dispose() {
      sanctum.dispose();
      iceWall.dispose();
    },
  };
}
