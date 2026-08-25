import {
  ICE_SANCTUM_ACTIONS,
  ICE_SANCTUM_FEATURE_ID,
} from '../../gameplay/content/stories/iceKing/iceKingContent';
import type { BuildingFeature } from '../buildingFeatures/buildingFeatureRegistry';

type IceSanctumEntry = {
  enter(): boolean;
  hasEntered(): boolean;
};

export function createIceKingBuildingFeature(options: {
  getSanctum: () => IceSanctumEntry | null;
  showLocked: () => void;
}): BuildingFeature {
  return {
    id: ICE_SANCTUM_FEATURE_ID,
    interact() {
      const sanctum = options.getSanctum();
      if (!sanctum?.hasEntered()) return false;
      options.showLocked();
      return true;
    },
    handleDialogueAction(action) {
      if (action !== ICE_SANCTUM_ACTIONS.enter) return false;
      options.getSanctum()?.enter();
      return true;
    },
  };
}
