import * as THREE from 'three';

type CameraHandle = {
  updateProjection: (zoom: number) => void;
  setTarget: (x: number, z: number, instant?: boolean) => void;
};

type PlayerHandle = {
  moveTo: (target: THREE.Vector3) => boolean;
};

type MarkerHandle = {
  show: (target: THREE.Vector3) => void;
  hide: () => void;
};

export function createCityViewControls(options: {
  defaultZoom: number;
  createCamera: (zoom: number) => THREE.OrthographicCamera;
  getCameraController: () => CameraHandle | null;
  getPlayerController: () => PlayerHandle | null;
  getNavigationTargetMarker: () => MarkerHandle | null;
}) {
  let cameraZoom = options.defaultZoom;
  let preIceCameraZoom = options.defaultZoom;
  let playerPath: THREE.Vector3[] = [];
  let filmCityCinematicActive = false;
  const cameraTarget = new THREE.Vector3(0, 0, 0);

  function updateProjection(zoom = cameraZoom) {
    options.getCameraController()?.updateProjection(zoom);
  }

  function setZoom(zoom: number) {
    cameraZoom = zoom;
  }

  function applyZoom(zoom: number) {
    cameraZoom = zoom;
    updateProjection(zoom);
  }

  return {
    cameraTarget,
    getZoom: () => cameraZoom,
    setZoom,
    applyZoom,
    updateProjection,
    setTarget(x: number, z: number, instant?: boolean) {
      options.getCameraController()?.setTarget(x, z, instant);
    },
    createCamera() {
      cameraZoom = options.defaultZoom;
      return options.createCamera(cameraZoom);
    },
    applyInitialView() {
      updateProjection(cameraZoom);
      options.getCameraController()?.setTarget(0, 0, true);
    },
    getPlayerPath: () => playerPath,
    setPlayerPath(path: THREE.Vector3[]) {
      playerPath = path;
    },
    clearPlayerPath() {
      playerPath = [];
    },
    selectNavigationTarget(target: THREE.Vector3) {
      if (options.getPlayerController()?.moveTo(target)) options.getNavigationTargetMarker()?.show(target);
    },
    clearNavigationTarget() {
      options.getNavigationTargetMarker()?.hide();
    },
    isCinematic: () => filmCityCinematicActive,
    setCinematic(active: boolean) {
      filmCityCinematicActive = active;
    },
    snapshot() {
      return { x: cameraTarget.x, z: cameraTarget.z, zoom: cameraZoom };
    },
    restoreSnapshot(snapshot: { x: number; z: number; zoom: number }) {
      applyZoom(snapshot.zoom);
      options.getCameraController()?.setTarget(snapshot.x, snapshot.z, true);
    },
    captureIceZoom() {
      preIceCameraZoom = cameraZoom;
    },
    restoreIceZoom() {
      applyZoom(preIceCameraZoom);
    },
  };
}

export type CityViewControls = ReturnType<typeof createCityViewControls>;
