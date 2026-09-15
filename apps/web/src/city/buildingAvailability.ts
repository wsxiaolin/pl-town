import type { BuildingEntity, ResidenceEntity } from './buildingEntity';
import { isBuildingDestroyed } from './buildingDamage';

export function storyLockedBuildingIds(definitions: ReadonlyArray<{ id: string; storyLocked?: boolean }>): ReadonlySet<string> {
  return new Set(definitions.filter((building) => building.storyLocked).map((building) => building.id));
}

export function createBuildingAvailability(options: {
  storyLockedIds: ReadonlySet<string>;
  getResidences: () => readonly ResidenceEntity[];
}) {
  function isStoryLocked(building: Pick<BuildingEntity, 'id'>): boolean {
    return options.storyLockedIds.has(building.id);
  }

  function isBuildingUnavailable(building: Pick<BuildingEntity, 'id' | 'group'>): boolean {
    return isStoryLocked(building) || isBuildingDestroyed(building);
  }

  function isResidenceUnavailable(residenceId: string): boolean {
    const residence = options.getResidences().find((item) => item.id === residenceId);
    return !residence || isBuildingDestroyed(residence);
  }

  return { isStoryLocked, isBuildingUnavailable, isResidenceUnavailable };
}
