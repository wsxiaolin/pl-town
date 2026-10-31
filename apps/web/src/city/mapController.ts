import * as THREE from 'three';
import type { BuildingEntity } from './buildingEntity';
import { currentBuildId } from './bootGate';
import { ATLAS_REGION_IDS, createAtlasShotStore } from './mapShotCache';
import { terrainHeight } from './data/terrain/heightfield/terrainHeight';
import type { YearTownMarker } from './data/year-towns/towns';
import { TRANSIT_MAP_OVERLAY } from './data/year-towns/transit';

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
  /** T3a 年份群岛：海图页 8 镇标记（label/tagline/主题色/落位）。 */
  getTownMarkers: () => readonly YearTownMarker[];
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

/** The atlas pages: the main city, 星语北城, and the year-town archipelago sea
 *  chart. The two city pages share the same span (world units per page edge) so
 *  they read at the same scale — the frame only slides north to center the
 *  district. The sea chart is a deliberate exception (设计 §5.3)：span 190 把
 *  8 镇滩域整框收纳并居中，页纸按「海图·比例异于城图」独立读图。 */
type MapRegionId = 'main' | 'north' | 'archipelago';

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
  /** World-space half-space(s) applied to the capture renderer so a page only
   *  paints its own district. Both pages share span 48, so each square frame
   *  necessarily reaches across the boundary; clipping cuts the foreign side
   *  per fragment. This is deliberate instead of toggling object.visible by an
   *  anchor's world z: lights keep working (hiding them rendered a page near
   *  black), and whole-city InstancedMesh decor batches — anchored at the
   *  origin but spread across both districts — are clipped instance by
   *  instance. The main page also keeps its historic z <= 44 cut (far-south
   *  decorations that would otherwise poke into the frame). */
  clipPlanes: THREE.Plane[];
};

// The boundary between the two city pages runs between the ring walkway's outer
// edge (RING_ROAD_RADII.outer = 39) and the north gate (z = -40.8): the
// central avenue's first north-district node sits at z = -40.
const NORTH_REGION_GATE_Z = -40;
// Both city pages share span 48 — a 96×96 world frame, so the map reads at one
// scale and only slides. The main page centres on (0,0) → z∈[-48,48]; the
// north page centres on the district (0,-64) → z∈[-112,-16]. The north frame
// therefore reaches ~28 world units south of the gate into the main city
// (ground; buildings at z=-33…-21) while the district's own ground only spans
// z∈[-44,-86.5] (NORTH_DISTRICT_AREA.ground). `clipPlanes` cuts each frame at
// the z=-40 gate so neither capture is contaminated by the other district.
// Sea chart boundary (T3a): the main page keeps its historic z <= 44 cut, so
// the archipelago page picks up z >= 45 (contains) / z >= 44 (clip) — the
// southern meadow, south sea, and the 8 islands all live on the third page.
const ARCHIPELAGO_GATE_Z = 45;
const MAP_REGIONS: Record<MapRegionId, MapRegion> = Object.freeze({
  main: Object.freeze({
    id: 'main',
    title: '物实小城 · 主城',
    alt: '物实小城主城全景地图',
    centerX: 0,
    centerZ: 0,
    span: 48,
    contains: (_x: number, z: number) => z >= NORTH_REGION_GATE_Z,
    clipPlanes: [
      new THREE.Plane(new THREE.Vector3(0, 0, 1), 40), // keep z >= -40
      new THREE.Plane(new THREE.Vector3(0, 0, -1), 44), // keep z <= 44
    ],
  }),
  north: Object.freeze({
    id: 'north',
    title: '物实小城 · 星语北城',
    alt: '星语北城全景地图',
    centerX: 0,
    centerZ: -64,
    span: 48,
    contains: (_x: number, z: number) => z < NORTH_REGION_GATE_Z,
    clipPlanes: [
      new THREE.Plane(new THREE.Vector3(0, 0, -1), -40), // keep z <= -40
    ],
  }),
  // 南洋年份群岛海图（设计 §5.3）：当前两城、起源村与环线包络约为
  // x∈[-274,150]、z∈[98,326]。视域取中心 x=-62、半幅 220，完整收纳岛岸、
  // 站点和轨道，并给两侧镇名标签保留画框内边距。
  archipelago: Object.freeze({
    id: 'archipelago',
    title: '物实小城 · 群岛海图',
    alt: '南洋年份群岛海图',
    centerX: -62,
    centerZ: 150,
    span: 220,
    contains: (_x: number, z: number) => z >= ARCHIPELAGO_GATE_Z,
    clipPlanes: [
      new THREE.Plane(new THREE.Vector3(0, 0, 1), 44), // keep z >= 44
    ],
  }),
} satisfies { main: MapRegion; north: MapRegion; archipelago: MapRegion });

function regionAt(x: number, z: number): MapRegion {
  // Archipelago first: the main page's contains (z >= -40) also matches the
  // islands, but the sea chart is the page the player actually stands on.
  if (MAP_REGIONS.archipelago.contains(x, z)) return MAP_REGIONS.archipelago;
  return MAP_REGIONS.north.contains(x, z) ? MAP_REGIONS.north : MAP_REGIONS.main;
}

export function createMapController(options: MapControllerOptions) {
  const view = options.document.defaultView ?? window;
  let open = false;
  let activeRegion: MapRegion = MAP_REGIONS.main;
  const shotData: Record<MapRegionId, string | null> = { main: null, north: null, archipelago: null };
  // 跨会话图纸缓存（空间换时间）：三次「弃置 WebGL 上下文 + 全景渲染 + PNG
  // 编码」的重活，刷新后不必重付——持久化到 IndexedDB，下次进入先水合再补抓。
  const shotStore = createAtlasShotStore();
  let shotsPreloaded = false;
  let shotsPreloadSettled = false;
  let destroyed = false;
  let shotRenderer: THREE.WebGLRenderer | null = null;
  let shotCamera: THREE.OrthographicCamera | null = null;
  let shotRefreshFrame: number | null = null;
  let iconsBuilt = false;
  let tipBuilding: BuildingEntity | null = null;
  /** 海图页镇名 tip 的当前镇（与 tipBuilding 互斥：同用 #mapTip 面板）。 */
  let tipTown: YearTownMarker | null = null;
  let markerLeft = Number.NaN;
  let markerTop = Number.NaN;
  let searchResults: MapSearchResult[] = [];
  let activeSearchIndex = -1;
  let confirmedBuildingId: string | null = null;

  /** 缓存指纹：构建身份 + 节日主题 + 建筑可用性普查。跨会话的任何场景/
   *  主题漂移都会改变指纹，过期图纸永远水合不进来；运行期失效则直接清库。 */
  function atlasFingerprint(): string {
    const buildings = options.getBuildings();
    let available = 0;
    for (const building of buildings) {
      if (!options.isBuildingUnavailable(building)) available += 1;
    }
    const theme = options.document.body?.dataset.cityTheme ?? 'default';
    return `${currentBuildId()}:${theme}:${buildings.length}:${available}`;
  }

  function persistAtlasShots(): void {
    const shots: Partial<Record<MapRegionId, string>> = {};
    for (const id of ATLAS_REGION_IDS) {
      if (shotData[id]) shots[id] = shotData[id]!;
    }
    shotStore.save(atlasFingerprint(), shots);
  }

  function toggle(): void {
    open = !open;
    options.document.getElementById('mapToggle')?.classList.toggle('active', open);
    const overlay = options.document.getElementById('mapOverlay');
    if (open) {
      // 在哪里打开就显示哪里的：主城、星语北城与群岛海图各成一页图，翻页
      // 跟随玩家脚下——环城步道以北（z < -40）开北城页，南域（z ≥ 45，
      // 南草甸/岛台）开海图页。
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
    // slides to the page's center; the two city pages share the span so they
    // never change scale between them (the sea chart is the deliberate
    // exception, see MAP_REGIONS.archipelago).
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
    try {
      shotRenderer = new THREE.WebGLRenderer({ canvas, antialias: true, preserveDrawingBuffer: true });
      shotRenderer.setSize(MAP_SHOT, MAP_SHOT, false);
      shotRenderer.setPixelRatio(1);
      shotRenderer.toneMapping = THREE.ACESFilmicToneMapping;
      shotRenderer.toneMappingExposure = 1;
      if (THREE.SRGBColorSpace) shotRenderer.outputColorSpace = THREE.SRGBColorSpace;
      // Cut the frame at the district boundary on the capture renderer only;
      // the live renderer keeps drawing the whole city. A fragment is clipped
      // when it sits on the negative side of any plane (three keeps
      // distanceToPoint >= 0), so the north page paints z <= -40 and the main
      // page z >= -40 (plus its historic z <= 44 cut). Clipping runs in the
      // shaders, so lights are untouched and whole-city InstancedMesh decor
      // batches are cut instance by instance.
      shotRenderer.clippingPlanes = region.clipPlanes;
      shotRenderer.render(scene, shotCamera);
      shotData[region.id] = shotRenderer.domElement.toDataURL('image/png');
      persistAtlasShots();
    } catch {
      // Software GL (SwiftShader) can refuse the extra capture context, and
      // toDataURL can fail on a lost context. Leave the page uncached so the
      // on-demand capture retries when the map next opens, and never let a
      // failed shot throw out of the boot preload or leak a half-built
      // renderer.
      shotData[region.id] = null;
    } finally {
      shotRenderer?.dispose();
      shotRenderer?.forceContextLoss();
      shotRenderer = null;
    }
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
    // 先水合上一会话的图纸（指纹一致才接受）：地图首开即刻有图，不用等
    // 空闲抓取落地。随后的空闲抓取照常执行并回写缓存，保持既有测试时序。
    void shotStore.load(atlasFingerprint()).then((shots) => {
      if (destroyed) return;
      for (const id of ATLAS_REGION_IDS) {
        if (!shotData[id] && shots[id]) shotData[id] = shots[id]!;
      }
    }).catch(() => { /* cache is best-effort */ });
    const capture = () => {
      // Only latch the one-shot flag once the city scene actually exists: if
      // the idle callback / fallback timer fires during boot before the scene
      // is ready, leave it unlatched so the on-demand capture path still owns
      // the retry instead of a preload that silently did nothing.
      if (destroyed || !options.getScene()) return;
      shotsPreloaded = true;
      if (!shotData.main) captureShot(MAP_REGIONS.main);
      if (!shotData.north) captureShot(MAP_REGIONS.north);
      if (!shotData.archipelago) captureShot(MAP_REGIONS.archipelago);
      // The one-shot attempt has finished, whether or not a capture succeeded.
      // Tests use this to distinguish "preload failed (page left uncached)" from
      // "preload still pending", so a genuine SwiftShader capture failure does
      // not leave unrelated specs waiting out the timeout.
      shotsPreloadSettled = true;
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
    // 镇标记只依赖 towns 常量、不随建筑列表加载，先于 buildings 空表早退渲染
    // （boot 抢跑开图也能看到 8 镇圆标）。
    renderTownIcons(wrap);
    // 交通层同样只吃 transit 常量（T4a2），与镇标记同一早退口径。
    renderTransitOverlay(wrap);
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

  /** 海图页专属的 8 镇标记（T3a）＋镇名常显标签（T6R-b5，设计 §5.3「8 镇名
   *  标注」）：建筑图标按 region.contains 过滤即可（主城/北城建筑都不落在
   *  z≥45 的海图域内），但镇表全在 z≥62——主城页的 contains（z≥−40）也会
   *  误收，故镇标记按页白名单渲染而非 contains 过滤。镇名标签与图标同锚
   *  （同一镇心投影百分比，勿偏移出岛），纯读图标注，交互仍由图标承担。 */
  function renderTownIcons(wrap: HTMLElement): void {
    const towns = activeRegion.id === 'archipelago' ? options.getTownMarkers() : [];
    const visibleIds = new Set(towns.map((town) => town.id));
    wrap.querySelectorAll<HTMLButtonElement>('.map-town-icon').forEach((icon) => {
      const townId = icon.dataset.townId;
      if (!townId || !visibleIds.has(townId)) {
        icon.remove();
        return;
      }
    });
    wrap.querySelectorAll<HTMLElement>('.map-town-label').forEach((label) => {
      const townId = label.dataset.townId;
      if (!townId || !visibleIds.has(townId)) {
        label.remove();
        return;
      }
    });
    towns.forEach((town) => {
      const iconSelector = `.map-town-icon[data-town-id="${CSS.escape(town.id)}"]`;
      if (options.document.querySelector(iconSelector)) return;
      const icon = options.document.createElement('button');
      icon.type = 'button';
      icon.className = 'map-town-icon';
      icon.dataset.townId = town.id;
      icon.title = town.label;
      icon.setAttribute('aria-pressed', 'false');
      // 镇主题色直接作圆标填充（towns.ts theme.iconColor，CSS 只管描边/选中态）。
      icon.style.backgroundColor = town.iconColor;
      const leftPct = ((town.x - activeRegion.centerX + activeRegion.span) / (2 * activeRegion.span)) * 100;
      const topPct = ((town.z - activeRegion.centerZ + activeRegion.span) / (2 * activeRegion.span)) * 100;
      icon.style.left = `${leftPct}%`;
      icon.style.top = `${topPct}%`;
      icon.addEventListener('click', () => openTownTip(town));
      wrap.appendChild(icon);
      // 镇名常显标签（T6R-b5）：文本「年份·镇名」（towns.ts label，地图统一
      // 口径）；与图标同锚百分比防偏移出岛。纯读图（aria-hidden + CSS
      // pointer-events 关闭）；东西两端的近页缘镇翻转对齐防画框裁剪
      // （admin 世界图 world-marker-label--left 同款先例）。
      const label = options.document.createElement('span');
      label.className = 'map-town-label';
      label.dataset.townId = town.id;
      label.setAttribute('aria-hidden', 'true');
      label.textContent = town.label;
      if (leftPct <= 18) label.classList.add('map-town-label--w');
      else if (leftPct >= 90) label.classList.add('map-town-label--e');
      label.style.left = `${leftPct}%`;
      label.style.top = `${topPct}%`;
      wrap.appendChild(label);
    });
  }

  /** 海图页交通层（T4a2，设计 §5.3）：TRANSIT_MAP_OVERLAY 的站点圆点 +
   *  线路描线（星门线实线 = 电车、环线虚线 = 磁悬浮），投影公式与镇标记
   *  同源（页中心 + span 归一化百分比）。站圆点是镇标记的小一档变体；
   *  线路为铺在图纸上的 SVG 折线（viewBox 0 0 100 100 = 页面百分比坐标，
   *  页纸 aspect-ratio 1/1 → 无拉伸变形）。乘车交互（点站圆点出面板）
   *  归 T4b——本层暂只读图，站圆点 pointer-events 由 CSS 关闭。 */
  function renderTransitOverlay(wrap: HTMLElement): void {
    const onSeaChart = activeRegion.id === 'archipelago';
    wrap.querySelector('.map-transit-lines')?.remove();
    wrap.querySelectorAll('.map-transit-station').forEach((dot) => dot.remove());
    if (!onSeaChart) return;
    const region = activeRegion;
    const paperX = (x: number): number => ((x - region.centerX + region.span) / (2 * region.span)) * 100;
    const paperZ = (z: number): number => ((z - region.centerZ + region.span) / (2 * region.span)) * 100;

    const svg = options.document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('class', 'map-transit-lines');
    svg.setAttribute('viewBox', '0 0 100 100');
    svg.setAttribute('preserveAspectRatio', 'none');
    const toPoints = (line: readonly { x: number; z: number }[]): string =>
      line.map((node) => `${paperX(node.x).toFixed(3)},${paperZ(node.z).toFixed(3)}`).join(' ');
    for (const [className, line] of [
      ['map-transit-stargate', TRANSIT_MAP_OVERLAY.stargateLine],
      ['map-transit-ring', TRANSIT_MAP_OVERLAY.ringLoop],
    ] as const) {
      const polyline = options.document.createElementNS('http://www.w3.org/2000/svg', 'polyline');
      polyline.setAttribute('class', className);
      polyline.setAttribute('points', toPoints(line));
      svg.appendChild(polyline);
    }
    wrap.appendChild(svg);

    for (const station of TRANSIT_MAP_OVERLAY.stations) {
      const dot = options.document.createElement('div');
      dot.className = 'map-transit-station';
      dot.dataset.stationId = station.id;
      dot.title = station.label;
      dot.style.left = `${paperX(station.x).toFixed(3)}%`;
      dot.style.top = `${paperZ(station.z).toFixed(3)}%`;
      wrap.appendChild(dot);
    }
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
    tipTown = null;
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
    options.document.querySelectorAll('.map-icon.is-selected, .map-town-icon.is-selected').forEach((icon) => icon.classList.remove('is-selected'));
    options.document.querySelector(iconSelector)?.classList.add('is-selected');
  }

  /** 海图页镇名 tip（T3a）：与建筑 tip 共用 #mapTip 面板与传送解锁门槛
   *  （参观 5 座建筑解锁传送），镇标记与建筑图标互斥选中。 */
  function openTownTip(town: YearTownMarker): void {
    // 镇标记只渲染在海图页；若跨页唤起（防御），先翻页再定位选中图标。
    if (open) setRegion(MAP_REGIONS.archipelago);
    closeSearchResults();
    tipBuilding = null;
    confirmedBuildingId = null;
    tipTown = town;
    const iconSelector = `.map-town-icon[data-town-id="${CSS.escape(town.id)}"]`;
    if (!iconsBuilt || !options.document.querySelector(iconSelector)) renderIcons();
    options.document.getElementById('mapTipTitle')!.textContent = town.label;
    options.document.getElementById('mapTipSlogan')!.textContent = town.tagline;
    const unlocked = canTeleport();
    const teleport = options.document.getElementById('mapTipTele') as HTMLButtonElement | null;
    teleport && (teleport.disabled = !unlocked);
    options.document.getElementById('mapTipLock')?.classList.toggle('hidden', unlocked);
    options.document.getElementById('mapTip')?.classList.add('open');
    options.document.querySelectorAll('.map-icon.is-selected, .map-town-icon.is-selected').forEach((icon) => icon.classList.remove('is-selected'));
    options.document.querySelector(iconSelector)?.classList.add('is-selected');
  }

  function closeTip(): void {
    tipBuilding = null;
    tipTown = null;
    options.document.getElementById('mapTip')?.classList.remove('open');
    options.document.querySelectorAll('.map-icon.is-selected, .map-town-icon.is-selected').forEach((icon) => icon.classList.remove('is-selected'));
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

  /** 镇传送（T3a）：复用建筑传送的 clearPlayerPath + setCameraTarget 机制；
   *  岛上无路网入口（T4 桥/站接线前的唯一抵达方式），落点直取镇中心并
   *  用权威采样器 terrainHeight 落到岛台面（playerController 每帧也会以
   *  同一采样器复核 y，此处先行落对避免一帧下坠观感）。 */
  function teleportTown(town: YearTownMarker): void {
    const cursor = options.getCursor();
    if (!cursor) return;
    options.clearPlayerPath();
    cursor.position.set(town.x, terrainHeight(town.x, town.z), town.z);
    options.setCameraTarget(town.x, town.z, true);
  }

  function teleportToTown(townId: string): boolean {
    const town = options.getTownMarkers().find((item) => item.id === townId);
    if (!town) return false;
    teleportTown(town);
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
      if (!canTeleport()) return;
      const town = tipTown;
      if (town) {
        closeTip();
        if (open) toggle();
        teleportTown(town);
        return;
      }
      if (!tipBuilding) return;
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
    // Theme flips and scene edits invalidate EVERY atlas page — the stale
    // capture must never resurface when the player crosses the district.
    shotData.main = null;
    shotData.north = null;
    shotData.archipelago = null;
    // 跨会话缓存同清：本会话内的场景/主题漂移意味着持久化图纸已过期，
    // 留着会让下次启动水合到旧画面（下次抓取成功后会重新写入）。
    shotStore.clear();
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
    shotData.archipelago = null;
    shotsPreloaded = false;
    shotsPreloadSettled = false;
    destroyed = true;
    iconsBuilt = false;
    tipBuilding = null;
    tipTown = null;
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
    teleportToTown,
    isOpen: () => open,
    areIconsBuilt: () => iconsBuilt,
    shotsReady: () => ({ main: Boolean(shotData.main), north: Boolean(shotData.north), archipelago: Boolean(shotData.archipelago) }),
    /** True once the boot preload attempt has run to completion — success or
     *  failure. Lets tests wait for the attempt to settle without assuming it
     *  produced both pages (a software-GL capture may legitimately fail). */
    shotsPreloadSettled: () => shotsPreloadSettled,
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
