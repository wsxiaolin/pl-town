import {
  applyBuildingDestroyedPresentation,
  isBuildingDestroyed,
  readDestroyedIds,
  reapplyBuildingDestroyedPresentation,
  restoreBuildingPresentation,
  writeDestroyedIds,
  type DamageableBuilding,
} from './buildingDamage';

export type BuildingDamageControllerOptions = {
  getBuildings: () => DamageableBuilding[];
  getResidences: () => DamageableBuilding[];
  invalidateMap: (reason: 'availability' | 'scene') => void;
  refreshResidenceLabels: () => void;
  setResidenceVisualVisible?: (id: string, visible: boolean) => void;
  storage?: Pick<Storage, 'getItem' | 'setItem'>;
};

export function createBuildingDamageController(options: BuildingDamageControllerOptions) {
  const storage = options.storage ?? window.localStorage;
  // Construction can temporarily remove damage presentation without repairing
  // the building. Keep its saved state independent of the loaded scene meshes.
  const destroyedIds = new Set(readDestroyedIds(storage));

  function allBuildings(): DamageableBuilding[] {
    return [...options.getBuildings(), ...options.getResidences()];
  }

  function persist(): void {
    writeDestroyedIds([...destroyedIds], storage);
  }

  function updateResidenceVisual(building: DamageableBuilding, visible: boolean): void {
    if (options.getResidences().includes(building)) options.setResidenceVisualVisible?.(building.id, visible);
  }

  function destroyFrom(items: DamageableBuilding[], id: string): boolean {
    const building = items.find(item => item.id === id);
    if (!building || isBuildingDestroyed(building)) return false;
    const destroyed = applyBuildingDestroyedPresentation(building);
    if (destroyed) {
      destroyedIds.add(id);
      updateResidenceVisual(building, false);
      persist();
      options.invalidateMap('scene');
    }
    return destroyed;
  }

  function restoreFrom(items: DamageableBuilding[], id: string): boolean {
    const building = items.find(item => item.id === id);
    if (!building) return false;
    const pending = Boolean(building.group.userData.constructionPending);
    const restored = !pending && restoreBuildingPresentation(building);
    const wasDestroyed = destroyedIds.delete(id);
    if (!restored && !wasDestroyed) return false;
    if (!pending) updateResidenceVisual(building, true);
    persist();
    options.invalidateMap('scene');
    return true;
  }

  function destroyAll(): number {
    return allBuildings().reduce((count, item) => count + (destroyFrom(
      options.getBuildings().includes(item) ? options.getBuildings() : options.getResidences(), item.id,
    ) ? 1 : 0), 0);
  }

  function restoreAll(): number {
    return allBuildings().reduce((count, item) => count + (restoreFrom(
      options.getBuildings().includes(item) ? options.getBuildings() : options.getResidences(), item.id,
    ) ? 1 : 0), 0);
  }

  function applyPersisted(): void {
    let availabilityChanged = false;
    allBuildings().forEach(item => {
      const persistedDestroyed = destroyedIds.has(item.id);
      if (persistedDestroyed && reapplyBuildingDestroyedPresentation(item)) updateResidenceVisual(item, false);
      // Compare with the saved target, not the pre-replay state: model reloads
      // temporarily reset presentation to default before replaying damage, which
      // must not read as an availability change that wipes the atlas cache.
      if (isBuildingDestroyed(item) !== persistedDestroyed) availabilityChanged = true;
    });
    // Replaying the saved state (initial boot, model reload after construction)
    // reaches the same availability it already had. Only a genuine mismatch
    // should invalidate the atlas, otherwise startup discards the cache it just
    // hydrated.
    if (availabilityChanged) options.invalidateMap('availability');
  }

  return {
    destroyBuilding: (id: string) => destroyFrom(options.getBuildings(), id),
    destroyResidence: (id: string) => {
      const result = destroyFrom(options.getResidences(), id);
      if (result) options.refreshResidenceLabels();
      return result;
    },
    destroyAll,
    restoreBuilding: (id: string) => restoreFrom(options.getBuildings(), id),
    restoreResidence: (id: string) => {
      const result = restoreFrom(options.getResidences(), id);
      if (result) options.refreshResidenceLabels();
      return result;
    },
    restoreAll,
    applyPersisted,
  };
}
