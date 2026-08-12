import * as THREE from 'three';

type Building = {
  id: string;
  label?: string;
  icon?: string;
  group: THREE.Object3D;
};

type MapContent = { name: string; slogan: string };

type Cursor = { position: THREE.Vector3; visible: boolean };

export type MapControllerOptions = {
  document: Document;
  getScene: () => THREE.Scene | null;
  getBuildings: () => readonly Building[];
  getCursor: () => Cursor | null;
  getStats: () => { achievements?: readonly string[] };
  getCamera: () => THREE.Camera | null;
  getBuildingContent: (buildingId: string) => MapContent | undefined;
  isStoryLocked: (building: Building) => boolean;
  getBuildingRoadEntry: (position: THREE.Vector3) => { x: number; z: number } | null;
  setCameraTarget: (x: number, z: number, instant: boolean) => void;
  movePlayerTo: (target: THREE.Vector3) => void;
  clearPlayerPath: () => void;
  renderMapHouseTags: () => void;
  openResidence: (buildingId: string) => void;
};

const MAP_SHOT = 1024;
const MAP_SHOT_SPAN = 64;
const MAP_SHOT_CENTER_X = 16;

export function createMapController(options: MapControllerOptions) {
  let open = false;
  let shotData: string | null = null;
  let shotRenderer: THREE.WebGLRenderer | null = null;
  let shotCamera: THREE.OrthographicCamera | null = null;
  let iconsBuilt = false;
  let tipBuilding: Building | null = null;

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
    }
  }

  function captureShot(): void {
    const scene = options.getScene();
    if (!scene) return;
    if (!shotCamera) {
      shotCamera = new THREE.OrthographicCamera(
        -MAP_SHOT_SPAN,
        MAP_SHOT_SPAN,
        MAP_SHOT_SPAN,
        -MAP_SHOT_SPAN,
        0.1,
        130,
      );
      shotCamera.position.set(MAP_SHOT_CENTER_X, 90, 0);
      shotCamera.up.set(0, 0, 1);
      shotCamera.lookAt(MAP_SHOT_CENTER_X, 0, 0);
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
    const left = ((cursor.position.x - MAP_SHOT_CENTER_X + MAP_SHOT_SPAN) / (2 * MAP_SHOT_SPAN)) * 100;
    const top = ((MAP_SHOT_SPAN - cursor.position.z) / (2 * MAP_SHOT_SPAN)) * 100;
    marker.style.left = `${clamp(left, 0, 100)}%`;
    marker.style.top = `${clamp(top, 0, 100)}%`;
  }

  function renderIcons(): void {
    const wrap = options.document.getElementById('mapIcons');
    if (!wrap || iconsBuilt) return;
    iconsBuilt = true;
    options.getBuildings().filter((building) => !options.isStoryLocked(building)).forEach((building) => {
      const icon = options.document.createElement('button');
      icon.type = 'button';
      icon.className = 'map-icon';
      icon.dataset.buildingId = building.id;
      icon.title = building.label ?? building.id;
      icon.innerHTML = building.icon ?? '';
      icon.style.left = `${((building.group.position.x - MAP_SHOT_CENTER_X + MAP_SHOT_SPAN) / (2 * MAP_SHOT_SPAN)) * 100}%`;
      icon.style.top = `${((MAP_SHOT_SPAN - building.group.position.z) / (2 * MAP_SHOT_SPAN)) * 100}%`;
      icon.addEventListener('click', () => openTip(building));
      wrap.appendChild(icon);
    });
    options.renderMapHouseTags();
  }

  function canTeleport(): boolean {
    return (options.getStats().achievements ?? []).includes('walker_100');
  }

  function openTip(building: Building): void {
    tipBuilding = building;
    const content = options.getBuildingContent(building.id);
    options.document.getElementById('mapTipTitle')!.textContent = content?.name ?? building.label ?? building.id;
    options.document.getElementById('mapTipSlogan')!.textContent = content?.slogan ?? '这座小城的一角。';
    const unlocked = canTeleport();
    const teleport = options.document.getElementById('mapTipTele') as HTMLButtonElement | null;
    teleport && (teleport.disabled = !unlocked);
    options.document.getElementById('mapTipLock')?.classList.toggle('hidden', unlocked);
    options.document.getElementById('mapTip')?.classList.add('open');
  }

  function closeTip(): void {
    tipBuilding = null;
    options.document.getElementById('mapTip')?.classList.remove('open');
  }

  function teleport(building: Building): void {
    const cursor = options.getCursor();
    if (!cursor) return;
    const entry = options.getBuildingRoadEntry(building.group.position);
    if (!entry) {
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
    open = false;
    options.document.getElementById('mapIcons')?.replaceChildren();
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
