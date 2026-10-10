import * as THREE from 'three';

/**
 * First-person walk mode: swaps the 2.5D orthographic city camera for a
 * perspective camera at eye height, steered with pointer-lock mouse look
 * (drag-look fallback when the browser refuses the lock) and the existing
 * movement input (keyboard + touch joystick). World position stays owned by
 * the shared cursor character so collision, multiplayer sync and the
 * return to the overhead view all keep working.
 *
 * Feel: eased acceleration/deceleration, a soft head-bob while walking,
 * sprint FOV widening and a stand-up eye rise when entering — the little
 * touches that make it read as an anime stroll rather than a floating drone.
 */

const EYE_HEIGHT = 1.55;
const LOOK_SENSITIVITY = 0.0023;
const PITCH_LIMIT = 1.32;
const RUN_MULTIPLIER = 1.6;
const BASE_FOV = 72;
const RUN_FOV = 78;
const FOV_EASE = 6;
const ACCELERATION = 13;
const EYE_RISE_SECONDS = 1.1;
const BOB_FREQUENCY = 5.4;
const BOB_AMPLITUDE = 0.038;
const BOB_ROLL = 0.0035;
const IDLE_BREATH_AMPLITUDE = 0.006;

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
  /** Per-frame hook while the mode is active (world styling, sky drift…). */
  onFrame?: (delta: number) => void;
};

export function createFirstPersonController(options: FirstPersonControllerOptions) {
  const camera = new THREE.PerspectiveCamera(BASE_FOV, options.window.innerWidth / Math.max(1, options.window.innerHeight), 0.1, 300);
  camera.rotation.order = 'YXZ';
  const moveTarget = new THREE.Vector3();
  let active = false;
  let yaw = 0;
  let pitch = -0.05;
  let pointerLocked = false;
  let pointerLockAttempted = false;
  let dragging = false;
  let dragPointerId: number | null = null;
  let previousCursorVisible = true;

  // Movement feel state.
  let velocityForward = 0;
  let velocityStrafe = 0;
  let walkPhase = 0;
  let idleTime = 0;
  let eyeRise = 1;
  let currentFov = BASE_FOV;
  let runHeld = false;

  const runKeys = new Set<string>();

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
    // Stand up into the mode: the eye rises from a low crouch over ~1 s.
    eyeRise = 0;
    walkPhase = 0;
    idleTime = 0;
    velocityForward = 0;
    velocityStrafe = 0;
    currentFov = BASE_FOV;
    camera.fov = BASE_FOV;
    camera.updateProjectionMatrix();
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
    if (!active) return;
    active = false;
    options.document.body.classList.remove('first-person-active');
    const cursor = options.getCursor();
    if (cursor) cursor.visible = previousCursorVisible;
    // app 生命周期 abort（销毁）时补上退出的核心 teardown：onExit 负责
    // toon world / toon sky / fog 的释放（gradientMap、天空 dome 等），
    // 原实现漏掉会泄漏到销毁后的 renderer（审查 🟡）。toast 与
    // exitPointerLock 在销毁路径上无意义，故不复用完整 exit()。
    options.onExit();
    options.onStateChange?.(false);
  }, { once: true });

  function update(delta: number): void {
    const cursor = options.getCursor();
    if (!active || !cursor) return;

    // Ease into the standing eye height on entry.
    if (eyeRise < 1) eyeRise = Math.min(1, eyeRise + delta / EYE_RISE_SECONDS);
    const eyeHeight = EYE_HEIGHT * (0.72 + 0.28 * (1 - Math.pow(1 - eyeRise, 3)));

    let speedFraction = 0;
    if (!options.isBlocked()) {
      // The shared movement controller reports iso-rotated world vectors;
      // undo that 45° rotation to recover raw screen axes, then re-project
      // them onto the first-person heading.
      const iso = options.getIsoMovement();
      const screenX = (iso.x - iso.z) * Math.SQRT1_2;
      const screenY = (iso.x + iso.z) * Math.SQRT1_2;
      let forward = -screenY;
      let strafe = screenX;
      const length = Math.hypot(forward, strafe);
      if (length > 0.001) {
        forward /= length;
        strafe /= length;
        speedFraction = Math.min(length, 1);
      } else {
        forward = 0;
        strafe = 0;
      }

      runHeld = runKeys.size > 0;
      // Acceleration toward the commanded velocity, deceleration when released.
      const targetForward = forward * speedFraction * (runHeld ? RUN_MULTIPLIER : 1);
      const targetStrafe = strafe * speedFraction * (runHeld ? RUN_MULTIPLIER : 1);
      const blend = 1 - Math.exp(-ACCELERATION * delta);
      velocityForward += (targetForward - velocityForward) * blend;
      velocityStrafe += (targetStrafe - velocityStrafe) * blend;

      const stepX = -Math.sin(yaw) * velocityForward + Math.cos(yaw) * velocityStrafe;
      const stepZ = -Math.cos(yaw) * velocityForward - Math.sin(yaw) * velocityStrafe;
      const step = options.walkSpeed * delta;
      if (Math.abs(stepX) > 1e-6 || Math.abs(stepZ) > 1e-6) {
        moveTarget.set(cursor.position.x + stepX * step, 0, cursor.position.z + stepZ * step);
        const resolved = options.resolveMovement(cursor.position, moveTarget);
        if (resolved.x !== cursor.position.x || resolved.z !== cursor.position.z) {
          cursor.position.x = resolved.x;
          cursor.position.z = resolved.z;
          cursor.rotation.y = Math.atan2(stepX, stepZ);
          options.sendPosition(cursor.position.x, cursor.position.z, cursor.rotation.y);
        }
      }
    } else {
      // Dialogs/cinematics own the input — glide to a stop.
      const blend = 1 - Math.exp(-ACCELERATION * delta);
      velocityForward += (0 - velocityForward) * blend;
      velocityStrafe += (0 - velocityStrafe) * blend;
    }

    // Head bob: driven by actual horizontal speed so gliding along a wall
    // (collision-clamped) naturally keeps the rhythm.
    const horizontalSpeed = Math.hypot(velocityForward, velocityStrafe);
    const moveNorm = Math.min(1, horizontalSpeed / RUN_MULTIPLIER);
    if (moveNorm > 0.08) {
      walkPhase += delta * BOB_FREQUENCY * Math.max(0.4, horizontalSpeed);
      idleTime = 0;
    } else {
      idleTime += delta;
    }
    const bobY = Math.sin(walkPhase * 2) * BOB_AMPLITUDE * moveNorm;
    const bobRoll = Math.sin(walkPhase) * BOB_ROLL * moveNorm;
    // Gentle breathing while standing still.
    const breathY = Math.sin(idleTime * 1.7) * IDLE_BREATH_AMPLITUDE;

    camera.position.set(cursor.position.x, eyeHeight + bobY + breathY, cursor.position.z);
    camera.rotation.set(pitch, yaw, bobRoll);

    // Sprint widens the view a touch — a chase-cam energy without changing speed feel.
    const targetFov = runHeld && moveNorm > 0.1 ? RUN_FOV : BASE_FOV;
    if (Math.abs(currentFov - targetFov) > 0.05) {
      currentFov += (targetFov - currentFov) * Math.min(1, FOV_EASE * delta);
      camera.fov = currentFov;
      camera.updateProjectionMatrix();
    }

    options.onFrame?.(delta);
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
