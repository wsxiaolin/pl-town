import * as THREE from 'three';
import type { BuildingEntity } from './buildingEntity';

type MapContent = { name: string; slogan: string };

type Cursor = { position: THREE.Vector3; visible: boolean };

type MapSearchResult = {
  building: BuildingEntity;
  name: string;
  score: number;
};

export type MapControllerOptions = {
  document: Document;
  getScene: () => THREE.Scene | null;
  getBuildings: () => readonly BuildingEntity[];
  getCursor: () => Cursor | null;
  canTeleport: () => boolean;
  getCamera: () => THREE.Camera | null;
  getBuildingContent: (buildingId: string) => MapContent | undefined;
  isBuildingUnavailable: (building: BuildingEntity) => boolean;
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
const MAX_SEARCH_RESULTS = 6;

/** The two atlas pages: the main city and 星语北城. Both share the same
 *  span (world units per page edge) so the pages read at the same scale —
 *  the frame only slides north to center the district. */
type MapRegionId = 'main' | 'north';

type MapRegion = {
  id: MapRegionId;
  /** Header text of the map paper. */
  title: string;
  /** Accessible description of the captured image. */
  alt: string;
  centerX: number;
  centerZ: number;
  span: number;
  /** Whether a world point belongs on this page (decides icon / house-tag
   *  placement and which page the map opens on for a player standing there). */
  contains: (x: number, z: number) => boolean;
  /** Objects hidden during this page's capture. Both pages share span 48, so
   *  each square frame necessarily overlaps the other district near the
   *  boundary; this rule cuts the foreign side back so a page only paints its
   *  own district. The main page also keeps its historic z >= 44 rule (far-
   *  south decorations that would otherwise poke into the frame). */
  hidesDuringShot: (z: number) => boolean;
};

// The boundary between the two pages runs between the ring walkway's outer
// edge (RING_ROAD_RADII.outer = 39) and the north gate (z = -40.8): the
// central avenue's first north-district node sits at z = -40.
const NORTH_REGION_GATE_Z = -40;
// Both pages share span 48 — a 96×96 world frame, so the map reads at one
// scale and only slides. The main page centres on (0,0) → z∈[-48,48]; the
// north page centres on the district (0,-64) → z∈[-112,-16]. The north frame
// therefore reaches ~28 world units south of the gate into the main city
// (ground; buildings at z=-33…-21) while the district's own ground only spans
// z∈[-44,-86.5] (NORTH_DISTRICT_AREA.ground). `hidesDuringShot` removes that
// main-city band (and, mirrored on the main page, the north strip above the
// gate) so neither capture is contaminated by the other district.
const MAP_REGIONS: Record<MapRegionId, MapRegion> = Object.freeze({
  main: Object.freeze({
    id: 'main',
    title: '物实小城 · 主城',
    alt: '物实小城主城全景地图',
    centerX: 0,
    centerZ: 0,
    span: 48,
    contains: (_x: number, z: number) => z >= NORTH_REGION_GATE_Z,
    hidesDuringShot: (z: number) => z >= 44 || z < NORTH_REGION_GATE_Z,
  }),
  north: Object.freeze({
    id: 'north',
    title: '物实小城 · 星语北城',
    alt: '星语北城全景地图',
    centerX: 0,
    centerZ: -64,
    span: 48,
    contains: (_x: number, z: number) => z < NORTH_REGION_GATE_Z,
    hidesDuringShot: (z: number) => z >= NORTH_REGION_GATE_Z,
  }),
} satisfies { main: MapRegion; north: MapRegion });

function regionAt(x: number, z: number): MapRegion {
  return MAP_REGIONS.north.contains(x, z) ? MAP_REGIONS.north : MAP_REGIONS.main;
}

export function createMapController(options: MapControllerOptions) {
  const view = options.document.defaultView ?? window;
  let open = false;
  let activeRegion: MapRegion = MAP_REGIONS.main;
  const shotData: Record<MapRegionId, string | null> = { main: null, north: null };
  let shotsPreloaded = false;
  let destroyed = false;
  let shotRenderer: THREE.WebGLRenderer | null = null;
  let shotCamera: THREE.OrthographicCamera | null = null;
  let shotRefreshFrame: number | null = null;
  let iconsBuilt = false;
  let tipBuilding: BuildingEntity | null = null;
  let markerLeft = Number.NaN;
  let markerTop = Number.NaN;
  let searchResults: MapSearchResult[] = [];
  let activeSearchIndex = -1;
  let confirmedBuildingId: string | null = null;

  function toggle(): void {
    open = !open;
    options.document.getElementById('mapToggle')?.classList.toggle('active', open);
    const overlay = options.document.getElementById('mapOverlay');
    if (open) {
      // 在哪里打开就显示哪里的：主城与星语北城各成一页图，翻页跟随玩家
      // 脚下——环城步道以北（z < -40）落在北城门内，打开的就是北城页。
      const cursor = options.getCursor();
      if (cursor) activeRegion = regionAt(cursor.position.x, cursor.position.z);
      overlay?.classList.add('show');
      updateImage();
    } else {
      cancelShotRefresh();
      overlay?.classList.remove('show');
      (options.document.getElementById('mapSearchInput') as HTMLInputElement | null)?.blur();
      closeTip();
      resetSearch();
    }
  }

  /** Turn the paper to another atlas page while it is open (search results and
   *  tips may point across the district boundary). */
  function setRegion(region: MapRegion): void {
    if (activeRegion === region) return;
    activeRegion = region;
    if (open) {
      iconsBuilt = false;
      updateImage();
    }
  }

  function captureShot(region: MapRegion): void {
    const scene = options.getScene();
    if (!scene || destroyed) return;
    // Top-down with world +x to the right and world -z pointing up, matching
    // the on-screen isometric compass (North = -z, East = +x). The camera
    // slides to the page's center; both pages share the span, so the
    // projection never changes scale between them.
    if (!shotCamera) {
      shotCamera = new THREE.OrthographicCamera(
        -region.span,
        region.span,
        region.span,
        -region.span,
        0.1,
        130,
      );
    } else {
      shotCamera.left = -region.span;
      shotCamera.right = region.span;
      shotCamera.top = region.span;
      shotCamera.bottom = -region.span;
    }
    shotCamera.position.set(region.centerX, 90, region.centerZ);
    shotCamera.up.set(0, 0, -1);
    shotCamera.lookAt(region.centerX, 0, region.centerZ);
    shotCamera.updateProjectionMatrix();
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
      if (region.hidesDuringShot(position.z) && object.visible) {
        hidden.push(object);
        object.visible = false;
      }
    });
    shotRenderer.render(scene, shotCamera);
    hidden.forEach((object) => { object.visible = true; });
    shotData[region.id] = shotRenderer.domElement.toDataURL('image/png');
    shotRenderer.dispose();
    shotRenderer.forceContextLoss();
    shotRenderer = null;
  }

  /** Boot-time preload: capture both atlas pages while the boot splash still
   *  covers the city, so the first map open never pays the WebGL-context +
   *  render + toDataURL cost on the interaction path. Scheduled off the boot
   *  critical path — an idle callback with a timeout, plus a plain timeout
   *  fallback that also fires when idle queues stall or clocks are frozen
   *  (tests). Re-invalidated pages are NOT re-preloaded: those fall back to
   *  the on-demand capture when the map next opens, exactly like before. */
  function preloadShots(): void {
    if (shotsPreloaded || destroyed) return;
    shotsPreloaded = true;
    const capture = () => {
      if (destroyed) return;
      if (!shotData.main) captureShot(MAP_REGIONS.main);
      if (!shotData.north) captureShot(MAP_REGIONS.north);
    };
    if (typeof view.requestIdleCallback === 'function') {
      view.requestIdleCallback(capture, { timeout: 2_000 });
    }
    view.setTimeout(capture, 2_500);
  }

  function updateImage(): void {
    const image = options.document.getElementById('mapImage') as HTMLImageElement | null;
    if (!image) return;
    renderIcons();
    if (!shotData[activeRegion.id]) captureShot(activeRegion);
    const shot = shotData[activeRegion.id];
    if (shot && image.src !== shot) image.src = shot;
    if (image.alt !== activeRegion.alt) image.alt = activeRegion.alt;
    const title = options.document.getElementById('mapTitle');
    if (title && title.textContent !== activeRegion.title) title.textContent = activeRegion.title;
    updateMarker();
  }

  function updateMarker(): void {
    if (open && !iconsBuilt) renderIcons();
    const marker = options.document.getElementById('mapMarker') as HTMLElement | null;
    const cursor = options.getCursor();
    if (!marker) return;
    // The player can be standing on the other page (e.g. a cross-district
    // search turned the paper). The dot has no meaningful spot there, so hide
    // it instead of clamping it to an edge that implies a position the player
    // never had.
    if (!cursor || !activeRegion.contains(cursor.position.x, cursor.position.z)) {
      if (marker.style.display !== 'none') marker.style.display = 'none';
      return;
    }
    if (marker.style.display === 'none') marker.style.display = '';
    // North (-z) at top, East (+x) at right — matches the captured map image.
    const left = ((cursor.position.x - activeRegion.centerX + activeRegion.span) / (2 * activeRegion.span)) * 100;
    const top = ((cursor.position.z - activeRegion.centerZ + activeRegion.span) / (2 * activeRegion.span)) * 100;
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

  function syncIconState(): void {
    const wrap = options.document.getElementById('mapIcons');
    if (!wrap) return;
    const buildingsById = new Map(options.getBuildings().map((building) => [building.id, building]));
    wrap.querySelectorAll<HTMLButtonElement>('.map-icon').forEach((icon) => {
      const building = buildingsById.get(icon.dataset.buildingId ?? '');
      const available = Boolean(building && !options.isBuildingUnavailable(building));
      const selected = available && building?.id === confirmedBuildingId;
      icon.hidden = !available;
      icon.classList.toggle('is-confirmed', selected);
      icon.setAttribute('aria-pressed', String(selected));
    });
  }

  function renderIcons(): void {
    const wrap = options.document.getElementById('mapIcons');
    if (!wrap) return;
    const buildings = options.getBuildings();
    if (buildings.length === 0) {
      iconsBuilt = false;
      return;
    }

    // Only the active page's buildings get icons; the other district's icons
    // would sit outside the captured frame (clipped by the paper's overflow)
    // and read as noise.
    const availableBuildings = buildings.filter((building) => {
      if (options.isBuildingUnavailable(building)) return false;
      return activeRegion.contains(building.group.position.x, building.group.position.z);
    });
    const availableIds = new Set(availableBuildings.map((building) => building.id));
    const existingIcons = new Map<string, HTMLButtonElement>();
    wrap.querySelectorAll<HTMLButtonElement>('.map-icon').forEach((icon) => {
      const buildingId = icon.dataset.buildingId;
      if (!buildingId || !availableIds.has(buildingId)) {
        icon.remove();
        return;
      }
      existingIcons.set(buildingId, icon);
    });

    availableBuildings.forEach((building) => {
      if (existingIcons.has(building.id)) return;
      const icon = options.document.createElement('button');
      icon.type = 'button';
      icon.className = 'map-icon';
      icon.dataset.buildingId = building.id;
      icon.title = building.label ?? building.id;
      icon.setAttribute('aria-pressed', 'false');
      icon.innerHTML = building.icon ?? '';
      icon.style.left = `${((building.group.position.x - activeRegion.centerX + activeRegion.span) / (2 * activeRegion.span)) * 100}%`;
      icon.style.top = `${((building.group.position.z - activeRegion.centerZ + activeRegion.span) / (2 * activeRegion.span)) * 100}%`;
      icon.addEventListener('click', () => openTip(building));
      wrap.appendChild(icon);
    });

    iconsBuilt = true;
    options.renderMapHouseTags();
    syncIconState();
  }

  function canTeleport(): boolean {
    return options.canTeleport();
  }

  function openTip(building: BuildingEntity): void {
    if (options.isBuildingUnavailable(building)) return;
    // 跨页目标（主城页上搜到北城建筑，或反之）：先翻到目标所在的一页，
    // 让选中图标与后续传送都发生在可见画面里。
    if (open) setRegion(regionAt(building.group.position.x, building.group.position.z));
    closeSearchResults();
    tipBuilding = building;
    confirmedBuildingId = building.id;
    const iconSelector = `.map-icon[data-building-id="${CSS.escape(building.id)}"]`;
    if (!iconsBuilt || !options.document.querySelector(iconSelector)) renderIcons();
    else syncIconState();
    const content = options.getBuildingContent(building.id);
    options.document.getElementById('mapTipTitle')!.textContent = content?.name ?? building.label ?? building.id;
    options.document.getElementById('mapTipSlogan')!.textContent = content?.slogan ?? '这座小城的一角。';
    const unlocked = canTeleport();
    const teleport = options.document.getElementById('mapTipTele') as HTMLButtonElement | null;
    teleport && (teleport.disabled = !unlocked);
    options.document.getElementById('mapTipLock')?.classList.toggle('hidden', unlocked);
    options.document.getElementById('mapTip')?.classList.add('open');
    options.document.querySelectorAll('.map-icon.is-selected').forEach((icon) => icon.classList.remove('is-selected'));
    options.document.querySelector(iconSelector)?.classList.add('is-selected');
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
      .filter((building) => !options.isBuildingUnavailable(building))
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
          score: termScores.every((score) => score >= 0) ? termScores.reduce((sum, score) => sum + score, 0) : -1,
        };
      })
      .filter((result) => result.score >= 0)
      .sort((left, right) => right.score - left.score || left.name.localeCompare(right.name, 'zh-CN'))
      .slice(0, MAX_SEARCH_RESULTS);
  }

  function renderSearchResults(preserveSelection = false): void {
    const input = options.document.getElementById('mapSearchInput') as HTMLInputElement | null;
    const results = options.document.getElementById('mapSearchResults');
    if (!input || !results) return;
    const query = input.value.trim();
    const activeBuildingId = preserveSelection ? searchResults[activeSearchIndex]?.building.id : undefined;
    searchResults = findSearchResults(query);
    const preservedIndex = searchResults.findIndex((result) => result.building.id === activeBuildingId);
    activeSearchIndex = preservedIndex >= 0 ? preservedIndex : searchResults.length > 0 ? 0 : -1;
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
    searchResults = [];
    results?.replaceChildren();
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
    const building = options.getBuildings().find((item) => item.id === buildingId && !options.isBuildingUnavailable(item));
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
    searchInput?.addEventListener('input', () => renderSearchResults(), { signal });
    searchInput?.addEventListener('focus', () => {
      if (searchInput.value.trim()) renderSearchResults();
    }, { signal });
    searchInput?.addEventListener('blur', () => {
      closeSearchResults();
    }, { signal });
    searchInput?.addEventListener('keydown', (event) => {
      if (event.isComposing || event.keyCode === 229) return;
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
        const results = options.document.getElementById('mapSearchResults');
        if (results && !results.hidden) {
          event.stopPropagation();
          closeSearchResults();
        }
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

  function cancelShotRefresh(): void {
    if (shotRefreshFrame !== null) view.cancelAnimationFrame(shotRefreshFrame);
    shotRefreshFrame = null;
  }

  function invalidateShot(reason: 'availability' | 'theme' | 'scene' = 'availability'): void {
    // Theme flips and scene edits invalidate BOTH atlas pages — the stale
    // capture must never resurface when the player crosses the district.
    shotData.main = null;
    shotData.north = null;
    if (tipBuilding && options.isBuildingUnavailable(tipBuilding)) closeTip();
    if (open) {
      // Availability changes update live controls without taking a new snapshot
      // for every city broadcast. Explicit scene/theme changes refresh the
      // visible image once per frame, including multi-building damage batches.
      renderIcons();
      if (options.document.getElementById('mapSearchResults')?.hidden === false) {
        // Rebuild only the options: retain input focus and the active building
        // even when availability changes the result order.
        renderSearchResults(true);
      }
      updateMarker();
      if (reason !== 'availability' && shotRefreshFrame === null) {
        shotRefreshFrame = view.requestAnimationFrame(() => {
          shotRefreshFrame = null;
          if (open) updateImage();
        });
      }
    }
  }

  function destroy(): void {
    cancelShotRefresh();
    shotRenderer?.dispose();
    shotRenderer?.forceContextLoss();
    shotRenderer = null;
    shotCamera = null;
    shotData.main = null;
    shotData.north = null;
    shotsPreloaded = false;
    destroyed = true;
    iconsBuilt = false;
    tipBuilding = null;
    searchResults = [];
    activeSearchIndex = -1;
    confirmedBuildingId = null;
    open = false;
    activeRegion = MAP_REGIONS.main;
    options.document.getElementById('mapIcons')?.replaceChildren();
    options.document.getElementById('mapSearchResults')?.replaceChildren();
  }

  return {
    setup,
    toggle,
    updateImage,
    updateMarker,
    invalidateShot,
    preloadShots,
    openTip,
    closeTip,
    teleportToBuilding,
    isOpen: () => open,
    areIconsBuilt: () => iconsBuilt,
    shotsReady: () => ({ main: Boolean(shotData.main), north: Boolean(shotData.north) }),
    /** Project a world point onto the ACTIVE atlas page as percentages of
     *  the captured image. Returns null when the point belongs to the other
     *  page (its icon would land outside the visible paper). */
    projectToActiveMap: (x: number, z: number) => {
      if (!activeRegion.contains(x, z)) return null;
      return {
        left: ((x - activeRegion.centerX + activeRegion.span) / (2 * activeRegion.span)) * 100,
        top: ((z - activeRegion.centerZ + activeRegion.span) / (2 * activeRegion.span)) * 100,
      };
    },
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
