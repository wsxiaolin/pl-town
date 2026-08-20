import * as THREE from 'three';

type Cursor = THREE.Object3D & { visible: boolean; rotation: THREE.Euler };
type Npc = { mesh: THREE.Object3D & { visible: boolean } };

export function retainPathOnFailedReroute(current: THREE.Vector3[], candidate: THREE.Vector3[]): THREE.Vector3[] {
  return candidate.length > 0 || current.length === 0 ? candidate : current;
}

export type PlayerControllerOptions = {
  getCursor: () => Cursor | null;
  getCamera: () => THREE.Camera | null;
  getCameraTarget: () => THREE.Vector3;
  setCameraTarget: (x: number, z: number, instant: boolean) => void;
  getPlayerPath: () => THREE.Vector3[];
  setPlayerPath: (path: THREE.Vector3[]) => void;
  isDialogOpen: () => boolean;
  isMapOpen: () => boolean;
  buildRoadPath: (from: THREE.Vector3, target: THREE.Vector3) => THREE.Vector3[];
  clamp: (value: number, min: number, max: number) => number;
  playerSpeed: number;
  getNpcs: () => readonly Npc[];
  getEcho: () => any;
  getSpecialInterior?: () => {
    navigation: () => { buildPath: (from: THREE.Vector3, target: THREE.Vector3) => THREE.Vector3[]; clampToWalkable: (point: THREE.Vector3) => THREE.Vector3 } | null;
    isMovementLocked?: () => boolean;
    isCinematic?: () => boolean;
  } | null;
  echoInterior: readonly [number, number];
  onIdle: () => void;
  sendPosition: (cursor: Cursor) => void;
  addDistance: (amount: number) => void;
  getManualMovement: () => { x: number; z: number };
  resolveMovement: (from: THREE.Vector3, target: THREE.Vector3, result?: THREE.Vector3) => THREE.Vector3;
  isInputLocked?: () => boolean;
  isCinematicCameraActive?: () => boolean;
};

export function createPlayerController(options: PlayerControllerOptions) {
  let pendingDistance = 0;
  const manualTarget = new THREE.Vector3();
  const resolvedMovement = new THREE.Vector3();

  function moveTo(target: THREE.Vector3): void {
    if (options.isInputLocked?.()) return;
    const cursor = options.getCursor();
    const specialInterior = options.getSpecialInterior?.();
    if (!cursor || options.isDialogOpen() || specialInterior?.isMovementLocked?.()) return;
    cursor.visible = true;
    const echo = options.getEcho();
    const specialNavigation = specialInterior?.navigation();
    if (specialNavigation) {
      options.setPlayerPath(specialNavigation.buildPath(cursor.position, target));
      return;
    }
    if (echo?.isInteriorView()) {
      const navigation = echo.navigation();
      options.setPlayerPath(navigation ? navigation.buildPath(cursor.position, target) : [new THREE.Vector3(
        options.clamp(target.x, options.echoInterior[0] - 14, options.echoInterior[0] + 14),
        0,
        options.clamp(target.z, options.echoInterior[1] - 9.5, options.echoInterior[1] + 9.5),
      )]);
      return;
    }
    const candidate = options.buildRoadPath(cursor.position, target);
    options.setPlayerPath(retainPathOnFailedReroute(options.getPlayerPath(), candidate));
  }

  function updateMovement(delta: number): void {
    if (options.isInputLocked?.()) return;
    const cursor = options.getCursor();
    const specialInterior = options.getSpecialInterior?.();
    if (specialInterior?.isMovementLocked?.()) {
      options.setPlayerPath([]);
      return;
    }
    const manual = options.getManualMovement();
    const path = options.getPlayerPath();
    const echo = options.getEcho();
    const specialNavigation = specialInterior?.navigation();
    if (cursor && manual.x * manual.x + manual.z * manual.z > 0.01 ** 2 && !options.isDialogOpen() && !options.isMapOpen()) {
      options.setPlayerPath([]);
      const step = options.playerSpeed * delta;
      manualTarget.set(cursor.position.x + manual.x * step, 0, cursor.position.z + manual.z * step);
      const navigation = specialNavigation ?? echo?.navigation();
      const resolved = navigation && (specialNavigation || echo?.isInteriorView())
        ? navigation.clampToWalkable(manualTarget)
        : options.resolveMovement(cursor.position, manualTarget, resolvedMovement);
      const travelled = cursor.position.distanceTo(resolved);
      if (travelled > 0.0001) {
        cursor.position.copy(resolved);
        cursor.rotation.y = Math.atan2(manual.x, manual.z);
        options.sendPosition(cursor);
        pendingDistance += travelled;
      }
      flushDistance();
      return;
    }
    if (!cursor || path.length === 0) {
      const navigation = specialNavigation ?? echo?.navigation();
      if (cursor && navigation && (specialNavigation || echo?.isInteriorView())) cursor.position.copy(navigation.clampToWalkable(cursor.position));
      options.onIdle();
      return;
    }
    if (options.isDialogOpen()) {
      options.setPlayerPath([]);
      return;
    }
    const target = path[0];
    if (!target) return;
    const dx = target.x - cursor.position.x;
    const dz = target.z - cursor.position.z;
    const distance = Math.hypot(dx, dz);
    const step = options.playerSpeed * delta;
    if (distance <= step) {
      cursor.position.set(target.x, 0, target.z);
      options.setPlayerPath(path.slice(1));
      return;
    }
    cursor.position.x += (dx / distance) * step;
    cursor.position.z += (dz / distance) * step;
    cursor.position.y = 0;
    for (const npc of options.getNpcs()) {
      if (!npc.mesh.visible) continue;
      const offsetX = cursor.position.x - npc.mesh.position.x;
      const offsetZ = cursor.position.z - npc.mesh.position.z;
      const separationSquared = offsetX * offsetX + offsetZ * offsetZ;
      if (separationSquared > 0 && separationSquared < 0.42 ** 2) {
        const separation = Math.sqrt(separationSquared);
        const push = (0.42 - separation) / separation;
        cursor.position.x += offsetX * push;
        cursor.position.z += offsetZ * push;
      }
    }
    const navigation = specialNavigation ?? echo?.navigation();
    if (navigation && (specialNavigation || echo?.isInteriorView())) cursor.position.copy(navigation.clampToWalkable(cursor.position));
    cursor.rotation.y = Math.atan2(dx, dz);
    options.sendPosition(cursor);
    pendingDistance += Math.min(step, distance);
    flushDistance();
  }

  function flushDistance(): void {
    if (pendingDistance >= 10) {
      const amount = Math.floor(pendingDistance);
      pendingDistance -= amount;
      options.addDistance(amount);
    }
  }

  function updateCamera(): void {
    if (options.isCinematicCameraActive?.()) return;
    const cursor = options.getCursor();
    if (!cursor || options.isMapOpen() || options.isDialogOpen()) return;
    const specialInterior = options.getSpecialInterior?.();
    if (specialInterior?.isCinematic?.()) return;
    if (specialInterior) {
      options.setCameraTarget(cursor.position.x, cursor.position.z, true);
      return;
    }
    const echo = options.getEcho();
    // Reaching the physical cabin doorway always exits immediately. Keep this
    // ahead of every story, legacy-coordinate and interior-boundary check so
    // no stale node, dialog state or pathfinding result can suppress it.
    const atCabinExit = echo?.isInteriorView()
      && Math.abs(cursor.position.x - options.echoInterior[0]) <= 2.4
      && cursor.position.z <= options.echoInterior[1] - 8.75;
    if (atCabinExit) {
      echo.teleportFromCabin();
      return;
    }
    const legacyCabin = Math.abs(cursor.position.x - 110) <= 15 && Math.abs(cursor.position.z) <= 11;
    if (legacyCabin && (echo?.isInteriorView() || echo?.isCabinNode())) {
      if (echo.story.state().nodeId === 'confrontation-active') echo.teleportFromCabin();
      else echo?.teleportToCabin();
      return;
    }
    const navigation = echo?.navigation();
    const inside = navigation
      ? navigation.contains(cursor.position, 0.8)
      : Math.abs(cursor.position.x - options.echoInterior[0]) <= 14.5 && Math.abs(cursor.position.z - options.echoInterior[1]) <= 10.2;
    if (inside && echo?.story.state().nodeId === 'confrontation-active') {
      echo.teleportFromCabin();
      return;
    }
    if (inside && !echo?.isInteriorView()) echo?.setInteriorView(true);
    if (!inside && echo?.isInteriorView()) echo?.setInteriorView(false);
    options.setCameraTarget(cursor.position.x, cursor.position.z, true);
  }

  return { moveTo, updateMovement, updateCamera };
}
