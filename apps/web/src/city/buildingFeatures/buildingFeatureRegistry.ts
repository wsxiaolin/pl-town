import type { BuildingEntity } from '../buildingEntity';

export interface BuildingFeature {
  id: string;
  interact?(building: BuildingEntity): boolean;
  handleDialogueAction?(action: string, sourceId: string): boolean;
}

export function createBuildingFeatureRegistry() {
  const features = new Map<string, BuildingFeature>();

  function register(feature: BuildingFeature): () => void {
    if (features.has(feature.id)) throw new Error(`Building feature already registered: ${feature.id}`);
    features.set(feature.id, feature);
    return () => { if (features.get(feature.id) === feature) features.delete(feature.id); };
  }

  function interact(building: BuildingEntity): boolean {
    return (building.featureIds ?? []).some((featureId) => features.get(featureId)?.interact?.(building) === true);
  }

  function handleDialogueAction(action: string, sourceId: string): boolean {
    return Array.from(features.values()).some((feature) => feature.handleDialogueAction?.(action, sourceId) === true);
  }

  return { register, interact, handleDialogueAction };
}

export type BuildingFeatureRegistry = ReturnType<typeof createBuildingFeatureRegistry>;
