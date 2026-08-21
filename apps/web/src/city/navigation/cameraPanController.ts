import * as THREE from 'three';

const LONG_PRESS_MS = 420;
const IDLE_RETURN_MS = 3_000;
const PRESS_MOVE_TOLERANCE = 10;
const RETURN_SPEED = 8;
const RETURN_EPSILON = 0.02;

export type CameraPanControllerOptions = {
  canvas: HTMLElement;
  document: Document;
  window: Window;
  signal: AbortSignal;
  getCamera: () => THREE.OrthographicCamera | null;
  getCameraTarget: () => THREE.Vector3;
  getPlayerPosition: () => THREE.Vector3 | null;
  setCameraTarget: (x: number, z: number, instant: boolean) => void;
  stopCameraMotion: () => void;
  isBlocked: () => boolean;
};

export function createCameraPanController(options: CameraPanControllerOptions) {
  const raycaster = new THREE.Raycaster();
  const groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
  const previousGround = new THREE.Vector3();
  const currentGround = new THREE.Vector3();
  let pointerId: number | null = null;
  let startX = 0;
  let startY = 0;
  let previousX = 0;
  let previousY = 0;
  let longPressTimer = 0;
  let idleTimer = 0;
  let dragging = false;
  let detached = false;
  let returning = false;
  let suppressClickUntil = 0;

  function clearLongPressTimer(): void {
    if (longPressTimer) options.window.clearTimeout(longPressTimer);
    longPressTimer = 0;
  }

  function clearIdleTimer(): void {
    if (idleTimer) options.window.clearTimeout(idleTimer);
    idleTimer = 0;
  }

  function setDragging(value: boolean): void {
    dragging = value;
    options.document.body.classList.toggle('camera-pan-active', value);
  }

  function beginReturn(): void {
    idleTimer = 0;
    if (detached && !dragging) returning = true;
  }

  function scheduleReturn(): void {
    clearIdleTimer();
    if (!detached || dragging) return;
    idleTimer = options.window.setTimeout(beginReturn, IDLE_RETURN_MS);
  }

  function groundPoint(clientX: number, clientY: number, result: THREE.Vector3): boolean {
    const camera = options.getCamera();
    if (!camera) return false;
    const rect = options.canvas.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return false;
    camera.updateMatrixWorld();
    raycaster.setFromCamera(new THREE.Vector2(
      ((clientX - rect.left) / rect.width) * 2 - 1,
      -((clientY - rect.top) / rect.height) * 2 + 1,
    ), camera);
    return raycaster.ray.intersectPlane(groundPlane, result) !== null;
  }

  function activateLongPress(): void {
    longPressTimer = 0;
    if (pointerId === null || options.isBlocked()) return;
    options.stopCameraMotion();
    detached = true;
    returning = false;
    clearIdleTimer();
    setDragging(true);
    suppressClickUntil = options.window.performance.now() + 800;
    try { options.canvas.setPointerCapture(pointerId); } catch { /* Pointer may have ended between timer ticks. */ }
  }

  function releasePointerCapture(id: number): void {
    try {
      if (options.canvas.hasPointerCapture(id)) options.canvas.releasePointerCapture(id);
    } catch { /* The browser may already have released capture. */ }
  }

  function finishPointer(releaseCapture: boolean): void {
    const endedPointerId = pointerId;
    clearLongPressTimer();
    pointerId = null;
    if (dragging) {
      suppressClickUntil = options.window.performance.now() + 800;
      setDragging(false);
    }
    if (detached) scheduleReturn();
    if (releaseCapture && endedPointerId !== null) releasePointerCapture(endedPointerId);
  }

  function cancelDetachedView(): void {
    clearLongPressTimer();
    clearIdleTimer();
    if (pointerId !== null) releasePointerCapture(pointerId);
    pointerId = null;
    setDragging(false);
    detached = false;
    returning = false;
  }

  options.canvas.addEventListener('pointerdown', (event) => {
    if (pointerId !== null || !event.isPrimary) {
      finishPointer(true);
      return;
    }
    if (event.button !== 0 || options.isBlocked()) return;
    pointerId = event.pointerId;
    startX = previousX = event.clientX;
    startY = previousY = event.clientY;
    returning = false;
    clearIdleTimer();
    longPressTimer = options.window.setTimeout(activateLongPress, LONG_PRESS_MS);
  }, { signal: options.signal });

  options.canvas.addEventListener('pointermove', (event) => {
    if (event.pointerId !== pointerId) return;
    if (!dragging) {
      if (Math.hypot(event.clientX - startX, event.clientY - startY) > PRESS_MOVE_TOLERANCE) finishPointer(false);
      return;
    }
    event.preventDefault();
    if (groundPoint(previousX, previousY, previousGround) && groundPoint(event.clientX, event.clientY, currentGround)) {
      const target = options.getCameraTarget();
      options.setCameraTarget(
        target.x + previousGround.x - currentGround.x,
        target.z + previousGround.z - currentGround.z,
        true,
      );
    }
    previousX = event.clientX;
    previousY = event.clientY;
  }, { passive: false, signal: options.signal });

  for (const type of ['pointerup', 'pointercancel'] as const) {
    options.canvas.addEventListener(type, (event) => {
      if (event.pointerId === pointerId) finishPointer(true);
    }, { signal: options.signal });
  }
  options.canvas.addEventListener('lostpointercapture', (event) => {
    if (event.pointerId === pointerId) finishPointer(false);
  }, { signal: options.signal });
  options.window.addEventListener('blur', () => finishPointer(true), { signal: options.signal });
  options.signal.addEventListener('abort', cancelDetachedView, { once: true });

  function update(delta: number): void {
    if (!detached) return;
    if (options.isBlocked()) {
      cancelDetachedView();
      return;
    }
    if (!returning) return;
    const player = options.getPlayerPosition();
    if (!player) return;
    const target = options.getCameraTarget();
    const distance = Math.hypot(player.x - target.x, player.z - target.z);
    if (distance <= RETURN_EPSILON) {
      options.setCameraTarget(player.x, player.z, true);
      detached = false;
      returning = false;
      return;
    }
    const amount = 1 - Math.exp(-RETURN_SPEED * delta);
    options.setCameraTarget(
      THREE.MathUtils.lerp(target.x, player.x, amount),
      THREE.MathUtils.lerp(target.z, player.z, amount),
      true,
    );
  }

  function notifyViewInteraction(): void {
    if (!detached || dragging) return;
    returning = false;
    scheduleReturn();
  }

  function consumeSuppressedClick(): boolean {
    if (options.window.performance.now() > suppressClickUntil) return false;
    suppressClickUntil = 0;
    return true;
  }

  return {
    update,
    notifyViewInteraction,
    consumeSuppressedClick,
    isFollowSuspended: () => detached,
  };
}
