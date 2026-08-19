import * as THREE from 'three';
import type { BuildingEntity } from './buildingEntity';

type Labelled = { group: THREE.Object3D; labelEl?: HTMLElement | null; labelY?: number };

type LabelScreenState = { x: number; y: number; visible: boolean };
const labelScreenStates = new WeakMap<HTMLElement, LabelScreenState>();
const labelViewProjection = new THREE.Matrix4();

function projectLabel(
  entry: Labelled,
  labelY: number,
  worldPosition: THREE.Vector3,
  viewportWidth: number,
  viewportHeight: number,
): void {
  const element = entry.labelEl;
  if (!element) return;
  worldPosition.copy(entry.group.position);
  worldPosition.y = entry.group.position.y + labelY;
  worldPosition.applyMatrix4(labelViewProjection);
  const visible = worldPosition.z >= -1 && worldPosition.z <= 1
    && worldPosition.x >= -1.1 && worldPosition.x <= 1.1
    && worldPosition.y >= -1.1 && worldPosition.y <= 1.1;
  const previous = labelScreenStates.get(element);
  if (!visible) {
    if (!previous || previous.visible) element.style.visibility = 'hidden';
    if (previous) previous.visible = false;
    else labelScreenStates.set(element, { x: 0, y: 0, visible: false });
    return;
  }
  const x = (worldPosition.x * 0.5 + 0.5) * viewportWidth;
  const y = (-worldPosition.y * 0.5 + 0.5) * viewportHeight;
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
}

export function updateCityLabels(options: {
  camera: THREE.Camera;
  buildings: readonly BuildingEntity[];
  residences: readonly Labelled[];
  isStoryLocked: (building: BuildingEntity) => boolean;
  worldPosition: THREE.Vector3;
}): void {
  const viewportWidth = window.innerWidth;
  const viewportHeight = window.innerHeight;
  labelViewProjection.multiplyMatrices(options.camera.projectionMatrix, options.camera.matrixWorldInverse);
  for (const building of options.buildings) {
    if (!options.isStoryLocked(building)) {
      projectLabel(building, building.labelY ?? 0, options.worldPosition, viewportWidth, viewportHeight);
    }
  }
  for (const residence of options.residences) {
    if (residence.labelEl) projectLabel(residence, 2.45, options.worldPosition, viewportWidth, viewportHeight);
  }
}
