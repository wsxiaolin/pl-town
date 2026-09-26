import type { BuildingEntity, ResidenceEntity } from './buildingEntity';
import { isBuildingDestroyed } from './buildingDamage';

export function storyLockedBuildingIds(definitions: ReadonlyArray<{ id: string; storyLocked?: boolean }>): ReadonlySet<string> {
  return new Set(definitions.filter((building) => building.storyLocked).map((building) => building.id));
}

export function createBuildingAvailability(options: {
  storyLockedIds: ReadonlySet<string>;
  getResidences: () => readonly ResidenceEntity[];
  isConstructionPending: (buildingId: string) => boolean;
}) {
  // Mutated in place so the stable closures below (captured by value into the
  // interaction, raycast, label and map layers) observe server-driven global
  // unlocks without any rewiring.
  const baseStoryLockedIds = new Set(options.storyLockedIds);
  const storyLockedIds = new Set(baseStoryLockedIds);

  function isStoryLocked(building: Pick<BuildingEntity, 'id'>): boolean {
    return storyLockedIds.has(building.id);
  }

  function isBuildingUnavailable(building: Pick<BuildingEntity, 'id' | 'group'>): boolean {
    return options.isConstructionPending(building.id) || isStoryLocked(building) || isBuildingDestroyed(building);
  }

  function isResidenceUnavailable(residenceId: string): boolean {
    const residence = options.getResidences().find((item) => item.id === residenceId);
    return !residence || isBuildingDestroyed(residence);
  }

  // The catalog's `globallyUnlockedBuildings` is authoritative: a story-locked
  // building is unlocked exactly while it appears there, so an admin turning the
  // global unlock back off re-locks it for connected residents. Only ids in the
  // original story-locked set are ever affected.
  function applyGloballyUnlocked(globallyUnlockedIds: readonly string[]): void {
    const unlocked = new Set(globallyUnlockedIds);
    storyLockedIds.clear();
    for (const id of baseStoryLockedIds) {
      if (!unlocked.has(id)) storyLockedIds.add(id);
    }
  }

  return { isStoryLocked, isBuildingUnavailable, isResidenceUnavailable, applyGloballyUnlocked };
}
