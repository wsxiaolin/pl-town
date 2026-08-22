import * as THREE from 'three';
import type { BuildingEntity } from './buildingEntity';

type MapContent = { name: string; slogan: string };

type Cursor = { position: THREE.Vector3; visible: boolean };

type MapSearchResult = {
  building: BuildingEntity;
  name: string;
  slogan: string;
  score: number;
};

export type MapControllerOptions = {
  document: Document;
  getScene: () => THREE.Scene | null;
  getBuildings: () => readonly BuildingEntity[];
  getCursor: () => Cursor | null;
  getStats: () => { achievements?: readonly string[] };
  getCamera: () => THREE.Camera | null;
  getBuildingContent: (buildingId: string) => MapContent | undefined;
  isStoryLocked: (building: BuildingEntity) => boolean;
  getBuildingRoadEntry: (position: THREE.Vector3) => { x: number; z: number } | null;
  setCameraTarget: (x: number, z: number, instant: boolean) => void;
  movePlayerTo: (target: THREE.Vector3) => void;
  clearPlayerPath: () => void;
  renderMapHouseTags: () => void;
  openResidence: (buildingId: string) => void;
};

// Map compass convention: the on-screen isometric view is captured by a camera
// at CAMERA_OFFSET=(+x,+y,+z) looking at the origin, which makes screen-up
// (North) point toward world (-x,-z) and screen-right (East) point toward
// world (+x,-z). The full-screen top-down map is therefore rendered with the
// world -z axis pointing UP and +x pointing RIGHT, so North/South/East/West on
// the map line up with the on-screen compass as closely as the 45° isometric
// tilt allows.
const MAP_SHOT = 1024;
const MAP_SHOT_SPAN = 48;
const MAP_SHOT_CENTER_X = 0;
const MAP_SHOT_CENTER_Z = 0;
const MAX_SEARCH_RESULTS = 6;

export function createMapController(options: MapControllerOptions) {
  let open = false;
  let shotData: string | null = null;
  let shotRenderer: THREE.WebGLRenderer | null = null;
  let shotCamera: THREE.OrthographicCamera | null = null;
  let iconsBuilt = false;
  let tipBuilding: BuildingEntity | null = null;
  let markerLeft = Number.NaN;
  let markerTop = Number.NaN;
  let searchResults: MapSearchResult[] = [];
  let activeSearchIndex = -1;

  function toggle(): void {
    open = !open;
    options.document.getElementById('mapToggle')?.classList.toggle('active', open);
    const overlay = options.document.getElementById('mapOverlay');
    if (open) {
      overlay?.classList.add('show');
      updateImage();
    } else {
      overlay?.classList.remove('show');
      closeTip();
      resetSearch();
    }
  }

  function captureShot(): void {
    const scene = options.getScene();
    if (!scene) return;
    if (!shotCamera) {
      // Top-down with world +x to the right and world -z pointing up, matching
      // the on-screen isometric compass (North = -z, East = +x).
      shotCamera = new THREE.OrthographicCamera(
        -MAP_SHOT_SPAN,
        MAP_SHOT_SPAN,
        MAP_SHOT_SPAN,
        -MAP_SHOT_SPAN,
        0.1,
        130,
      );
      shotCamera.position.set(MAP_SHOT_CENTER_X, 90, MAP_SHOT_CENTER_Z);
      shotCamera.up.set(0, 0, -1);
      shotCamera.lookAt(MAP_SHOT_CENTER_X, 0, MAP_SHOT_CENTER_Z);
      shotCamera.updateProjectionMatrix();
    }
    const canvas = options.document.createElement('canvas');
    canvas.width = MAP_SHOT;
    canvas.height = MAP_SHOT;
    shotRenderer = new THREE.WebGLRenderer({ canvas, antialias: true, preserveDrawingBuffer: true });
    shotRenderer.setSize(MAP_SHOT, MAP_SHOT, false);
    shotRenderer.setPixelRatio(1);
    shotRenderer.toneMapping = THREE.ACESFilmicToneMapping;
    shotRenderer.toneMappingExposure = 1;
    if (THREE.SRGBColorSpace) shotRenderer.outputColorSpace = THREE.SRGBColorSpace;

    const hidden: THREE.Object3D[] = [];
    scene.traverse((object) => {
      const position = new THREE.Vector3();
      object.getWorldPosition(position);
      if (position.z >= 44 && object.visible) {
        hidden.push(object);
        object.visible = false;
      }
    });
    shotRenderer.render(scene, shotCamera);
    hidden.forEach((object) => { object.visible = true; });
    shotData = shotRenderer.domElement.toDataURL('image/png');
    shotRenderer.dispose();
    shotRenderer.forceContextLoss();
    shotRenderer = null;
  }

  function updateImage(): void {
    const image = options.document.getElementById('mapImage') as HTMLImageElement | null;
    if (!image) return;
    renderIcons();
    if (!shotData) captureShot();
    if (shotData && image.src !== shotData) image.src = shotData;
    updateMarker();
  }

  function updateMarker(): void {
    const marker = options.document.getElementById('mapMarker') as HTMLElement | null;
    const cursor = options.getCursor();
    if (!marker || !cursor) return;
    // North (-z) at top, East (+x) at right — matches the captured map image.
    const left = ((cursor.position.x - MAP_SHOT_CENTER_X + MAP_SHOT_SPAN) / (2 * MAP_SHOT_SPAN)) * 100;
    const top = ((cursor.position.z - MAP_SHOT_CENTER_Z + MAP_SHOT_SPAN) / (2 * MAP_SHOT_SPAN)) * 100;
    const nextLeft = clamp(left, 0, 100);
    const nextTop = clamp(top, 0, 100);
    if (nextLeft !== markerLeft) {
      marker.style.left = `${nextLeft}%`;
      markerLeft = nextLeft;
    }
    if (nextTop !== markerTop) {
      marker.style.top = `${nextTop}%`;
      markerTop = nextTop;
    }
  }

  function renderIcons(): void {
    const wrap = options.document.getElementById('mapIcons');
    if (!wrap) return;
    if (iconsBuilt) {
      wrap.querySelectorAll<HTMLButtonElement>('.map-icon').forEach((icon) => {
        const building = options.getBuildings().find((item) => item.id === icon.dataset.buildingId);
        icon.hidden = !building || options.isStoryLocked(building);
      });
      return;
    }
    iconsBuilt = true;
    options.getBuildings().filter((building) => !options.isStoryLocked(building)).forEach((building) => {
      const icon = options.document.createElement('button');
      icon.type = 'button';
      icon.className = 'map-icon';
      icon.dataset.buildingId = building.id;
      icon.hidden = options.isStoryLocked(building);
      icon.title = building.label ?? building.id;
      icon.innerHTML = building.icon ?? '';
      icon.style.left = `${((building.group.position.x - MAP_SHOT_CENTER_X + MAP_SHOT_SPAN) / (2 * MAP_SHOT_SPAN)) * 100}%`;
      icon.style.top = `${((building.group.position.z - MAP_SHOT_CENTER_Z + MAP_SHOT_SPAN) / (2 * MAP_SHOT_SPAN)) * 100}%`;
      icon.addEventListener('click', () => openTip(building));
      wrap.appendChild(icon);
    });
    options.renderMapHouseTags();
  }

  function canTeleport(): boolean {
    return (options.getStats().achievements ?? []).includes('walker_100');
  }

  function openTip(building: BuildingEntity): void {
    if (options.isStoryLocked(building)) return;
    closeSearchResults();
    tipBuilding = building;
    const content = options.getBuildingContent(building.id);
    options.document.getElementById('mapTipTitle')!.textContent = content?.name ?? building.label ?? building.id;
    options.document.getElementById('mapTipSlogan')!.textContent = content?.slogan ?? '这座小城的一角。';
    const unlocked = canTeleport();
    const teleport = options.document.getElementById('mapTipTele') as HTMLButtonElement | null;
    teleport && (teleport.disabled = !unlocked);
    options.document.getElementById('mapTipLock')?.classList.toggle('hidden', unlocked);
    options.document.getElementById('mapTip')?.classList.add('open');
    options.document.querySelectorAll('.map-icon.is-selected').forEach((icon) => icon.classList.remove('is-selected'));
    options.document.querySelector(`.map-icon[data-building-id="${CSS.escape(building.id)}"]`)?.classList.add('is-selected');
  }

  function closeTip(): void {
    tipBuilding = null;
    options.document.getElementById('mapTip')?.classList.remove('open');
    options.document.querySelectorAll('.map-icon.is-selected').forEach((icon) => icon.classList.remove('is-selected'));
  }

  function findSearchResults(query: string): MapSearchResult[] {
    const terms = query.trim().split(/\s+/).map(normalizeSearchText).filter(Boolean);
    if (terms.length === 0) return [];
    return options.getBuildings()
      .filter((building) => !options.isStoryLocked(building))
      .map((building) => {
        const content = options.getBuildingContent(building.id);
        const name = content?.name ?? building.label ?? building.id;
        const slogan = content?.slogan ?? '';
        const fields = [name, building.label ?? '', building.num, building.id, slogan];
        const termScores = terms.map((term) => Math.max(...fields.map((field, index) => (
          scoreSearchText(term, normalizeSearchText(field)) - index * 18
        ))));
        return {
          building,
          name,
          slogan,
          score: termScores.every((score) => score >= 0) ? termScores.reduce((sum, score) => sum + score, 0) : -1,
        };
      })
      .filter((result) => result.score >= 0)
      .sort((left, right) => right.score - left.score || left.name.localeCompare(right.name, 'zh-CN'))
      .slice(0, MAX_SEARCH_RESULTS);
  }

  function renderSearchResults(): void {
    const input = options.document.getElementById('mapSearchInput') as HTMLInputElement | null;
    const results = options.document.getElementById('mapSearchResults');
    if (!input || !results) return;
    const query = input.value.trim();
    searchResults = findSearchResults(query);
    activeSearchIndex = searchResults.length > 0 ? 0 : -1;
    results.replaceChildren();
    if (!query) {
      closeSearchResults();
      return;
    }
    if (searchResults.length === 0) {
      const empty = options.document.createElement('div');
      empty.className = 'map-search-empty';
      empty.textContent = '没有找到建筑';
      results.appendChild(empty);
    } else {
      searchResults.forEach((result, index) => {
        const item = options.document.createElement('button');
        item.type = 'button';
        item.className = 'map-search-result';
        item.id = `mapSearchResult-${index}`;
        item.dataset.buildingId = result.building.id;
        item.setAttribute('role', 'option');
        const name = options.document.createElement('span');
        name.className = 'map-search-result-name';
        name.textContent = result.name;
        const meta = options.document.createElement('span');
        meta.className = 'map-search-result-meta';
        meta.textContent = [result.building.num, result.building.id].filter(Boolean).join(' · ');
        item.append(name, meta);
        item.addEventListener('pointerdown', (event) => event.preventDefault());
        item.addEventListener('click', () => selectSearchResult(index));
        results.appendChild(item);
      });
    }
    results.hidden = false;
    input.setAttribute('aria-expanded', 'true');
    updateActiveSearchResult();
  }

  function updateActiveSearchResult(): void {
    const input = options.document.getElementById('mapSearchInput') as HTMLInputElement | null;
    const items = options.document.querySelectorAll<HTMLElement>('.map-search-result');
    items.forEach((item, index) => {
      const active = index === activeSearchIndex;
      item.classList.toggle('is-active', active);
      item.setAttribute('aria-selected', String(active));
    });
    if (!input) return;
    if (activeSearchIndex >= 0) input.setAttribute('aria-activedescendant', `mapSearchResult-${activeSearchIndex}`);
    else input.removeAttribute('aria-activedescendant');
  }

  function selectSearchResult(index: number): void {
    const result = searchResults[index];
    if (!result) return;
    const input = options.document.getElementById('mapSearchInput') as HTMLInputElement | null;
    if (input) {
      input.value = result.name;
      input.blur();
    }
    openTip(result.building);
  }

  function closeSearchResults(): void {
    const input = options.document.getElementById('mapSearchInput') as HTMLInputElement | null;
    const results = options.document.getElementById('mapSearchResults');
    if (results) results.hidden = true;
    input?.setAttribute('aria-expanded', 'false');
    input?.removeAttribute('aria-activedescendant');
    activeSearchIndex = -1;
  }

  function resetSearch(): void {
    const input = options.document.getElementById('mapSearchInput') as HTMLInputElement | null;
    if (input) input.value = '';
    searchResults = [];
    options.document.getElementById('mapSearchResults')?.replaceChildren();
    closeSearchResults();
  }

  function teleport(building: BuildingEntity): void {
    const cursor = options.getCursor();
    if (!cursor) return;
    const entry = options.getBuildingRoadEntry(building.group.position);
    if (!entry || !Number.isFinite(entry.x) || !Number.isFinite(entry.z)) {
      options.movePlayerTo(building.group.position);
      return;
    }
    options.clearPlayerPath();
    cursor.position.set(entry.x, 0, entry.z);
    options.setCameraTarget(entry.x, entry.z, true);
  }

  function teleportToBuilding(buildingId: string): boolean {
    const building = options.getBuildings().find((item) => item.id === buildingId && !options.isStoryLocked(item));
    if (!building) return false;
    teleport(building);
    return true;
  }

  function setup(signal: AbortSignal): void {
    options.document.getElementById('mapToggle')?.addEventListener('click', toggle, { signal });
    options.document.getElementById('mapClose')?.addEventListener('click', () => { if (open) toggle(); }, { signal });
    options.document.getElementById('mapOverlay')?.addEventListener('click', (event) => {
      if ((event.target as HTMLElement).id === 'mapOverlay' && open) toggle();
    }, { signal });
    options.document.getElementById('mapTipClose')?.addEventListener('click', closeTip, { signal });
    const searchInput = options.document.getElementById('mapSearchInput') as HTMLInputElement | null;
    searchInput?.addEventListener('input', renderSearchResults, { signal });
    searchInput?.addEventListener('focus', () => {
      if (searchInput.value.trim()) renderSearchResults();
    }, { signal });
    searchInput?.addEventListener('blur', closeSearchResults, { signal });
    searchInput?.addEventListener('keydown', (event) => {
      if (event.key === 'ArrowDown' && searchResults.length > 0) {
        event.preventDefault();
        activeSearchIndex = (activeSearchIndex + 1) % searchResults.length;
        updateActiveSearchResult();
      } else if (event.key === 'ArrowUp' && searchResults.length > 0) {
        event.preventDefault();
        activeSearchIndex = (activeSearchIndex - 1 + searchResults.length) % searchResults.length;
        updateActiveSearchResult();
      } else if (event.key === 'Enter' && activeSearchIndex >= 0) {
        event.preventDefault();
        selectSearchResult(activeSearchIndex);
      } else if (event.key === 'Escape') {
        event.stopPropagation();
        closeSearchResults();
      }
    }, { signal });
    options.document.getElementById('mapTipTele')?.addEventListener('click', () => {
      if (!tipBuilding || !canTeleport()) return;
      const building = tipBuilding;
      closeTip();
      if (open) toggle();
      teleport(building);
    }, { signal });
  }

  function invalidateShot(): void {
    shotData = null;
    if (open) updateImage();
  }

  function destroy(): void {
    shotRenderer?.dispose();
    shotRenderer?.forceContextLoss();
    shotRenderer = null;
    shotCamera = null;
    shotData = null;
    iconsBuilt = false;
    tipBuilding = null;
    searchResults = [];
    activeSearchIndex = -1;
    open = false;
    options.document.getElementById('mapIcons')?.replaceChildren();
    options.document.getElementById('mapSearchResults')?.replaceChildren();
  }

  return {
    setup,
    toggle,
    updateImage,
    updateMarker,
    invalidateShot,
    openTip,
    closeTip,
    teleportToBuilding,
    isOpen: () => open,
    areIconsBuilt: () => iconsBuilt,
    shotSpan: MAP_SHOT_SPAN,
    destroy,
  };
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function normalizeSearchText(value: string): string {
  return value.normalize('NFKC').toLocaleLowerCase().replace(/[\s\-_.·/\\()[\]（）【】]+/g, '');
}

function scoreSearchText(query: string, target: string): number {
  if (!query || !target) return -1;
  if (target === query) return 1000;
  if (target.startsWith(query)) return 850 - (target.length - query.length);
  const containedAt = target.indexOf(query);
  if (containedAt >= 0) return 680 - containedAt * 8 - (target.length - query.length);

  let queryIndex = 0;
  let firstIndex = -1;
  let previousIndex = -1;
  let gaps = 0;
  for (let targetIndex = 0; targetIndex < target.length && queryIndex < query.length; targetIndex += 1) {
    if (target[targetIndex] !== query[queryIndex]) continue;
    if (firstIndex < 0) firstIndex = targetIndex;
    if (previousIndex >= 0) gaps += targetIndex - previousIndex - 1;
    previousIndex = targetIndex;
    queryIndex += 1;
  }
  if (queryIndex === query.length) return 480 - firstIndex * 8 - gaps * 12 - (target.length - query.length);

  const maxDistance = query.length >= 5 ? 2 : query.length >= 3 ? 1 : 0;
  if (maxDistance > 0 && Math.abs(target.length - query.length) <= maxDistance) {
    const distance = editDistance(query, target);
    if (distance <= maxDistance) return 300 - distance * 60 - Math.abs(target.length - query.length) * 10;
  }
  return -1;
}

function editDistance(left: string, right: string): number {
  let previous = Array.from({ length: right.length + 1 }, (_, index) => index);
  for (let leftIndex = 1; leftIndex <= left.length; leftIndex += 1) {
    const current = [leftIndex];
    for (let rightIndex = 1; rightIndex <= right.length; rightIndex += 1) {
      current[rightIndex] = Math.min(
        current[rightIndex - 1]! + 1,
        previous[rightIndex]! + 1,
        previous[rightIndex - 1]! + (left[leftIndex - 1] === right[rightIndex - 1] ? 0 : 1),
      );
    }
    previous = current;
  }
  return previous[right.length]!;
}
