import * as THREE from 'three';

type Labelled = { group: THREE.Object3D; labelEl?: HTMLElement; labelY?: number };

export function updateCityLabels(options: {
  camera: THREE.Camera;
  buildings: readonly Labelled[];
  residences: readonly Labelled[];
  isStoryLocked: (building: Labelled) => boolean;
  worldPosition: THREE.Vector3;
}): void {
  const project = (entry: Labelled, labelY: number) => {
    if (!entry.labelEl) return;
    options.worldPosition.copy(entry.group.position);
    options.worldPosition.y = entry.group.position.y + labelY;
    options.worldPosition.project(options.camera);
    entry.labelEl.style.transform = `translate3d(${(options.worldPosition.x * 0.5 + 0.5) * window.innerWidth}px,${((-options.worldPosition.y) * 0.5 + 0.5) * window.innerHeight}px,0) translate(-50%,-50%)`;
  };
  options.buildings.filter((building) => !options.isStoryLocked(building)).forEach((building) => project(building, building.labelY ?? 0));
  options.residences.forEach((residence) => project(residence, 2.45));
}
