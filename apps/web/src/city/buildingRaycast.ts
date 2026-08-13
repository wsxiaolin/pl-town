import type * as THREE from 'three';

export type RaycastBuilding = { id: string };
export type RaycastHit = { object: THREE.Object3D };

export function findBuildingFromRaycastHits<T extends RaycastBuilding>(options: {
  hits: readonly RaycastHit[];
  buildings: readonly T[];
  readUserData: (object: THREE.Object3D, key: string) => unknown;
  isUnavailable?: (building: T) => boolean;
}): T | null {
  for (const hit of options.hits) {
    const buildingId = options.readUserData(hit.object, 'buildingId');
    if (typeof buildingId !== 'string') continue;
    const building = options.buildings.find(item => item.id === buildingId);
    if (building && !options.isUnavailable?.(building)) return building;
  }
  return null;
}
