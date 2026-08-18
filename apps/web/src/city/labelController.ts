import * as THREE from 'three';

type Labelled = { group: THREE.Object3D; labelEl?: HTMLElement; labelY?: number };

type LabelScreenState = { x: number; y: number; visible: boolean };
const labelScreenStates = new WeakMap<HTMLElement, LabelScreenState>();

export function updateCityLabels(options: {
  camera: THREE.Camera;
  buildings: readonly Labelled[];
  residences: readonly Labelled[];
  isStoryLocked: (building: Labelled) => boolean;
  worldPosition: THREE.Vector3;
}): void {
  const viewportWidth = window.innerWidth;
  const viewportHeight = window.innerHeight;
  const project = (entry: Labelled, labelY: number) => {
    const element = entry.labelEl;
    if (!element) return;
    options.worldPosition.copy(entry.group.position);
    options.worldPosition.y = entry.group.position.y + labelY;
    options.worldPosition.project(options.camera);
    const visible = options.worldPosition.z >= -1 && options.worldPosition.z <= 1
      && options.worldPosition.x >= -1.1 && options.worldPosition.x <= 1.1
      && options.worldPosition.y >= -1.1 && options.worldPosition.y <= 1.1;
    const previous = labelScreenStates.get(element);
    if (!visible) {
      if (!previous || previous.visible) element.style.visibility = 'hidden';
      if (previous) previous.visible = false;
      else labelScreenStates.set(element, { x: 0, y: 0, visible: false });
      return;
    }
    const x = Math.round((options.worldPosition.x * 0.5 + 0.5) * viewportWidth * 2) / 2;
    const y = Math.round(((-options.worldPosition.y * 0.5 + 0.5) * viewportHeight) * 2) / 2;
    if (!previous || !previous.visible) element.style.visibility = '';
    if (!previous || previous.x !== x || previous.y !== y) {
      element.style.transform = `translate3d(${x}px,${y}px,0) translate(-50%,-50%)`;
    }
    if (previous) {
      previous.x = x;
      previous.y = y;
      previous.visible = true;
    } else {
      labelScreenStates.set(element, { x, y, visible: true });
    }
  };
  options.buildings.forEach((building) => {
    if (!options.isStoryLocked(building)) project(building, building.labelY ?? 0);
  });
  options.residences.forEach((residence) => {
    if (residence.labelEl) project(residence, 2.45);
  });
}
