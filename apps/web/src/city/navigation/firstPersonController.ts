import * as THREE from 'three';

/**
 * First-person walk mode: swaps the 2.5D orthographic city camera for a
 * perspective camera at eye height, steered with pointer-lock mouse look
 * (drag-look fallback when the browser refuses the lock) and the existing
 * movement input (keyboard + touch joystick). World position stays owned by
 * the shared cursor character so collision, multiplayer sync and the
 * return to the overhead view all keep working.
 */

const EYE_HEIGHT = 1.55;
const LOOK_SENSITIVITY = 0.0023;
const PITCH_LIMIT = 1.32;
const RUN_MULTIPLIER = 1.6;

type CursorLike = THREE.Object3D & { visible: boolean; rotation: THREE.Euler };

export type FirstPersonControllerOptions = {
  document: Document;
  window: Window;
  signal: AbortSignal;
  canvas: HTMLElement;
  getCursor: () => CursorLike | null;
  /** Shared movement input (keyboard + joystick), already rotated into iso world space. */
  getIsoMovement: () => { x: number; z: number };
  resolveMovement: (from: THREE.Vector3, target: THREE.Vector3, result?: THREE.Vector3) => THREE.Vector3;
  walkSpeed: number;
  sendPosition: (x: number, z: number, rotationY: number) => void;
  /** Clear walk paths / pending interactions when the mode takes over. */
  onEnter: () => void;
  /** Re-focus the overhead camera on the player when leaving the mode. */
  onExit: () => void;
  /** Interact with whatever building the crosshair points at. */
  interactInFront: () => void;
  /** True while dialogs, panels, cinematics or interiors own the input. */
  isBlocked: () => boolean;
  showToast: (message: string) => void;
  onStateChange?: (active: boolean) => void;
};

export function createFirstPersonController(options: FirstPersonControllerOptions) {
  const camera = new THREE.PerspectiveCamera(72, options.window.innerWidth / Math.max(1, options.window.innerHeight), 0.1, 300);
  camera.rotation.order = 'YXZ';
  const moveTarget = new THREE.Vector3();
  const moveDirection = new THREE.Vector3();
  const runKeys = new Set<string>();
  let active = false;
  let yaw = 0;
  let pitch = -0.05;
  let pointerLocked = false;
  let pointerLockAttempted = false;
  let dragging = false;
  let dragPointerId: number | null = null;
  let previousCursorVisible = true;

  function requestPointerLock(): void {
    pointerLockAttempted = true;
    try {
      const request = (options.canvas as HTMLElement & { requestPointerLock?: () => unknown }).requestPointerLock?.();
      if (request && typeof (request as Promise<void>).then === 'function') {
        (request as Promise<void>).catch(() => { /* drag-look fallback stays available */ });
      }
    } catch { /* drag-look fallback stays available */ }
  }

  function syncFromCursor(): void {
    const cursor = options.getCursor();
    if (!cursor) return;
    // cursor.rotation.y uses atan2(dirX, dirZ); the camera looks along
    // (-sin yaw, -cos yaw), so the equivalent camera yaw is rotation + PI.
    yaw = cursor.rotation.y + Math.PI;
  }

  function enter(): boolean {
    if (active) return true;
    const cursor = options.getCursor();
    if (!cursor || options.isBlocked()) return false;
    active = true;
    previousCursorVisible = cursor.visible;
    cursor.visible = false;
    syncFromCursor();
    pitch = -0.05;
    options.document.body.classList.add('first-person-active');
    options.onEnter();
    options.onStateChange?.(true);
    options.showToast('第一人称：WASD 移动 · 移动鼠标环视 · E 互动 · Esc 退出');
    requestPointerLock();
    return true;
  }

  function exit(): void {
    if (!active) return;
    active = false;
    dragging = false;
    dragPointerId = null;
    options.document.body.classList.remove('first-person-active');
    const cursor = options.getCursor();
    if (cursor) cursor.visible = previousCursorVisible;
    if (options.document.pointerLockElement === options.canvas) options.document.exitPointerLock();
    options.onExit();
    options.onStateChange?.(false);
    options.showToast('已回到上帝视角');
  }

  function toggle(): void {
    if (active) exit();
    else enter();
  }

  function applyLook(dx: number, dy: number): void {
    yaw -= dx * LOOK_SENSITIVITY;
    pitch = Math.min(PITCH_LIMIT, Math.max(-PITCH_LIMIT, pitch - dy * LOOK_SENSITIVITY));
  }

  function handleCanvasClick(): void {
    if (!active) return;
    if (pointerLocked) { options.interactInFront(); return; }
    requestPointerLock();
  }

  options.window.addEventListener('keydown', (event) => {
    if (event.repeat) return;
    if (event.code === 'ShiftLeft' || event.code === 'ShiftRight') { runKeys.add(event.code); return; }
    if (event.code === 'KeyF') {
      const target = event.target instanceof HTMLElement ? event.target : null;
      if (target?.closest('input, textarea, select, button, [contenteditable="true"]')) return;
      if (active || !options.isBlocked()) { event.preventDefault(); toggle(); }
      return;
    }
    if (!active) return;
    const target = event.target instanceof HTMLElement ? event.target : null;
    if (target?.closest('input, textarea, select, button, [contenteditable="true"]')) return;
    if (event.code === 'KeyE' && !options.isBlocked()) {
      event.preventDefault();
      options.interactInFront();
    }
  }, { signal: options.signal });

  options.window.addEventListener('keyup', (event) => {
    runKeys.delete(event.code);
  }, { signal: options.signal });

  options.window.addEventListener('blur', () => {
    runKeys.clear();
  }, { signal: options.signal });

  options.document.addEventListener('pointerlockchange', () => {
    pointerLocked = options.document.pointerLockElement === options.canvas;
    // Esc always leaves the pointer lock first; treat that as leaving the mode.
    if (!pointerLocked && active && pointerLockAttempted) exit();
  }, { signal: options.signal });

  options.document.addEventListener('pointerlockerror', () => {
    pointerLocked = false;
  }, { signal: options.signal });

  // Mouse look while the pointer is locked…
  options.document.addEventListener('mousemove', (event) => {
    if (!active || !pointerLocked) return;
    if (options.isBlocked()) return;
    applyLook(event.movementX, event.movementY);
  }, { signal: options.signal });

  // …and a drag-look fallback (mouse after Esc cooldown, touch devices).
  options.canvas.addEventListener('pointerdown', (event) => {
    if (!active || pointerLocked || dragPointerId !== null) return;
    if (!event.isPrimary) return;
    dragging = true;
    dragPointerId = event.pointerId;
  }, { signal: options.signal });

  options.window.addEventListener('pointermove', (event) => {
    if (!active || !dragging || event.pointerId !== dragPointerId) return;
    if (!event.isPrimary) return;
    applyLook(event.movementX ?? 0, event.movementY ?? 0);
  }, { signal: options.signal });

  for (const type of ['pointerup', 'pointercancel'] as const) {
    options.window.addEventListener(type, (event) => {
      if (event.pointerId === dragPointerId) {
        dragging = false;
        dragPointerId = null;
      }
    }, { signal: options.signal });
  }

  options.window.addEventListener('resize', () => {
    camera.aspect = options.window.innerWidth / Math.max(1, options.window.innerHeight);
    camera.updateProjectionMatrix();
  }, { signal: options.signal });

  options.signal.addEventListener('abort', () => {
    if (active) {
      active = false;
      options.document.body.classList.remove('first-person-active');
      const cursor = options.getCursor();
      if (cursor) cursor.visible = previousCursorVisible;
      options.onStateChange?.(false);
    }
  }, { once: true });

  function update(delta: number): void {
    const cursor = options.getCursor();
    if (!active || !cursor) return;
    if (!options.isBlocked()) {
      // The shared movement controller reports iso-rotated world vectors;
      // undo that 45° rotation to recover raw screen axes, then re-project
      // them onto the first-person heading.
      const iso = options.getIsoMovement();
      const screenX = (iso.x - iso.z) * Math.SQRT1_2;
      const screenY = (iso.x + iso.z) * Math.SQRT1_2;
      const forward = -screenY;
      const strafe = screenX;
      const length = Math.hypot(forward, strafe);
      if (length > 0.001) {
        const scale = Math.min(length, 1);
        const normalizedForward = forward / length;
        const normalizedStrafe = strafe / length;
        const headingX = -Math.sin(yaw) * normalizedForward + Math.cos(yaw) * normalizedStrafe;
        const headingZ = -Math.cos(yaw) * normalizedForward - Math.sin(yaw) * normalizedStrafe;
        const run = runKeys.size > 0 ? RUN_MULTIPLIER : 1;
        const step = options.walkSpeed * run * scale * delta;
        moveTarget.set(cursor.position.x + headingX * step, 0, cursor.position.z + headingZ * step);
        const resolved = options.resolveMovement(cursor.position, moveTarget);
        if (resolved.x !== cursor.position.x || resolved.z !== cursor.position.z) {
          cursor.position.x = resolved.x;
          cursor.position.z = resolved.z;
          cursor.rotation.y = Math.atan2(headingX, headingZ);
          options.sendPosition(cursor.position.x, cursor.position.z, cursor.rotation.y);
        }
      }
    }
    camera.position.set(cursor.position.x, EYE_HEIGHT, cursor.position.z);
    camera.rotation.set(pitch, yaw, 0);
  }

  return {
    getActiveCamera: (): THREE.PerspectiveCamera | null => (active ? camera : null),
    isActive: () => active,
    enter,
    exit,
    toggle,
    update,
    handleCanvasClick,
  };
}

export type FirstPersonController = ReturnType<typeof createFirstPersonController>;
