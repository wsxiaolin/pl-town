import * as THREE from 'three';
import type { CityDialogController } from '../../adapters/ui/cityDialogController';
import { createLocalStorageIceSanctumProgressStore } from '../../adapters/storage/iceKing/LocalStorageIceSanctumStoryRepository';
import {
  createIceSanctumPresentationController,
  type IceSanctumCameraFocusOptions,
} from '../../adapters/ui/iceKing/iceSanctumPresentationController';
import type { IceKingRewardId, IceSanctumReturnWeather } from '../../gameplay/content/stories/iceKing/iceKingContent';
import { createIceSanctumScene } from '../../rendering/iceKing/iceSanctumScene';
import { createIceSanctumController } from './iceSanctumController';
import type { IceSanctumCursor, IceSanctumDialogPort } from './iceSanctumPorts';

export type IceSanctumExperienceOptions = {
  scene: THREE.Scene;
  makeMaterial: (parameters: Record<string, unknown>) => THREE.Material;
  makeCharacter: (head: number, body: number) => THREE.Group;
  getCursor: () => IceSanctumCursor | null;
  dialogs: () => CityDialogController | null;
  nextRewardClaimSequence: (rewardId: IceKingRewardId) => number | null;
  claimReward: (rewardId: IceKingRewardId, claimSequence: number) => Promise<boolean>;
  onEnter: () => void;
  onEnterUnavailable: () => void;
  onProgressFailure: () => void;
  onRewardFailure: () => void;
  onReturn: (weather: IceSanctumReturnWeather) => void;
  setCameraTarget: (x: number, z: number, instant?: boolean) => void;
  focusCamera: (x: number, z: number, focusOptions?: IceSanctumCameraFocusOptions) => void;
  stopCameraFocus: () => void;
};

export function createIceSanctumExperience(options: IceSanctumExperienceOptions) {
  const scene = createIceSanctumScene(options);
  const presentation = createIceSanctumPresentationController({
    getCursor: options.getCursor,
    getNpcWorldPosition: scene.npcWorldPosition,
    setCameraTarget: options.setCameraTarget,
    focusCamera: options.focusCamera,
    stopCameraFocus: options.stopCameraFocus,
  });
  const dialogs = (): IceSanctumDialogPort | null => {
    const controller = options.dialogs();
    return controller ? {
      openStory: (story) => controller.openStory(story),
      close: () => controller.closeNpc(),
    } : null;
  };
  return createIceSanctumController({
    scene,
    presentation,
    progress: createLocalStorageIceSanctumProgressStore(),
    getCursor: options.getCursor,
    dialogs,
    nextRewardClaimSequence: options.nextRewardClaimSequence,
    claimReward: options.claimReward,
    onEnter: options.onEnter,
    onEnterUnavailable: options.onEnterUnavailable,
    onProgressFailure: options.onProgressFailure,
    onRewardFailure: options.onRewardFailure,
    onReturn: options.onReturn,
  });
}
