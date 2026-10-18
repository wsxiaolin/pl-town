import * as THREE from 'three';
import type { BuildingEntity } from './buildingEntity';

type Labelled = { group: THREE.Object3D; labelEl?: HTMLElement | null; labelY?: number };

type LabelScreenState = { x: number; y: number; visible: boolean; opacity: string };
const labelScreenStates = new WeakMap<HTMLElement, LabelScreenState>();
const labelViewProjection = new THREE.Matrix4();
const cameraWorldPosition = new THREE.Vector3();
// Labels touched by the last update. Bounded by the city's label count, so a
// strong set is fine; it lets the FP→overhead switch clear transient styles
// explicitly instead of relying on "not writing keeps the previous value".
const labelElements = new Set<HTMLElement>();
let previousFirstPersonActive = false;

// ===== First-person label declutter =====
// 眼高 1.55m 的透视相机贴着街道平视时，全城屋顶标签被透视压缩到屏幕
// 上半部，叠成一团且互相抢点击。第一人称模式启用后：
//   1. 超过 FP_LABEL_MAX_DISTANCE 的标签不显示（远处文字读不清，只添乱）；
//   2. FP_LABEL_FADE_START → MAX 距离段随距离淡出，避免生硬闪断；
//   3. 屏内标签按相机距离由近及远放置，与已放置标签的中心间距小于
//      FP_LABEL_SEPARATION_* 的后来者隐藏（近处优先、保主舍次）。
// 俯视（正交）相机视角天然稀疏，维持原全量投影行为不变。
const FP_LABEL_MAX_DISTANCE = 45;
const FP_LABEL_FADE_START = 33;
const FP_LABEL_SEPARATION_X = 84;
const FP_LABEL_SEPARATION_Y = 52;
const FP_LABEL_FADE_RANGE = FP_LABEL_MAX_DISTANCE - FP_LABEL_FADE_START;

type DeclutterCandidate = { element: HTMLElement; x: number; y: number; distance: number };

function labelState(element: HTMLElement): LabelScreenState {
  let state = labelScreenStates.get(element);
  if (!state) {
    state = { x: 0, y: 0, visible: false, opacity: '' };
    labelScreenStates.set(element, state);
  }
  return state;
}

function hideLabel(element: HTMLElement): void {
  const previous = labelScreenStates.get(element);
  if (!previous || previous.visible) element.style.visibility = 'hidden';
  if (previous) previous.visible = false;
  else labelScreenStates.set(element, { x: 0, y: 0, visible: false, opacity: '' });
}

/** Leaving first person restores the overhead projection: clear every inline
 *  hide/fade style the declutter pass may have left, including labels that are
 *  currently offscreen and would otherwise keep a stale opacity. The regular
 *  overhead pass runs immediately after and re-hides offscreen/locked labels. */
function resetFirstPersonLabelStyles(): void {
  for (const element of labelElements) {
    element.style.visibility = '';
    element.style.opacity = '';
    labelScreenStates.delete(element);
  }
  labelElements.clear();
}

function showLabel(element: HTMLElement, state: LabelScreenState, x: number, y: number, opacity: number): void {
  if (!state.visible) element.style.visibility = '';
  state.visible = true;
  if (state.x !== x || state.y !== y) {
    element.style.transform = `translate3d(${x}px,${y}px,0) translate(-50%,-50%)`;
    state.x = x;
    state.y = y;
  }
  const opacityText = opacity >= 1 ? '' : opacity.toFixed(2);
  if (state.opacity !== opacityText) {
    element.style.opacity = opacityText;
    state.opacity = opacityText;
  }
}

export function updateCityLabels(options: {
  camera: THREE.Camera;
  buildings: readonly BuildingEntity[];
  residences: readonly Labelled[];
  isStoryLocked: (building: BuildingEntity) => boolean;
  worldPosition: THREE.Vector3;
  /** 第一人称模式：启用距离裁剪 + 屏幕防重叠（缺省 false = 俯视全量投影）。 */
  firstPersonActive?: boolean;
}): void {
  const viewportWidth = window.innerWidth;
  const viewportHeight = window.innerHeight;
  const camera = options.camera;
  const firstPersonActive = options.firstPersonActive === true;
  if (previousFirstPersonActive && !firstPersonActive) resetFirstPersonLabelStyles();
  previousFirstPersonActive = firstPersonActive;
  labelViewProjection.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse);
  camera.getWorldPosition(cameraWorldPosition);
  const candidates: DeclutterCandidate[] = [];

  const applyLabel = (entry: Labelled, labelY: number): void => {
    const element = entry.labelEl;
    if (!element) return;
    labelElements.add(element);
    const worldPosition = options.worldPosition;
    worldPosition.copy(entry.group.position);
    worldPosition.y = entry.group.position.y + labelY;
    const distance = cameraWorldPosition.distanceTo(worldPosition);
    worldPosition.applyMatrix4(labelViewProjection);
    const inView = worldPosition.z >= -1 && worldPosition.z <= 1
      && worldPosition.x >= -1.1 && worldPosition.x <= 1.1
      && worldPosition.y >= -1.1 && worldPosition.y <= 1.1;
    if (firstPersonActive) {
      if (!inView || distance > FP_LABEL_MAX_DISTANCE) {
        hideLabel(element);
        return;
      }
      candidates.push({
        element,
        x: (worldPosition.x * 0.5 + 0.5) * viewportWidth,
        y: (-worldPosition.y * 0.5 + 0.5) * viewportHeight,
        distance,
      });
      return;
    }
    if (!inView) {
      hideLabel(element);
      return;
    }
    showLabel(
      element,
      labelState(element),
      (worldPosition.x * 0.5 + 0.5) * viewportWidth,
      (-worldPosition.y * 0.5 + 0.5) * viewportHeight,
      1,
    );
  };

  for (const building of options.buildings) {
    if (!options.isStoryLocked(building)) {
      applyLabel(building, building.labelY ?? 0);
    }
  }
  for (const residence of options.residences) {
    if (residence.labelEl) applyLabel(residence, 2.45);
  }

  if (!firstPersonActive) return;

  candidates.sort((a, b) => a.distance - b.distance);
  const placed: Array<{ x: number; y: number }> = [];
  for (const candidate of candidates) {
    let overlapped = false;
    for (const slot of placed) {
      if (Math.abs(slot.x - candidate.x) < FP_LABEL_SEPARATION_X
        && Math.abs(slot.y - candidate.y) < FP_LABEL_SEPARATION_Y) {
        overlapped = true;
        break;
      }
    }
    if (overlapped) {
      hideLabel(candidate.element);
      continue;
    }
    const fade = Math.min(1, (FP_LABEL_MAX_DISTANCE - candidate.distance) / FP_LABEL_FADE_RANGE);
    showLabel(candidate.element, labelState(candidate.element), candidate.x, candidate.y, fade);
    placed.push({ x: candidate.x, y: candidate.y });
  }
}
