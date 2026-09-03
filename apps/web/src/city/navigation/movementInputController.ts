export type MovementVector = { x: number; z: number };

export type MovementInputControllerOptions = {
  document: Document;
  window: Window;
  signal: AbortSignal;
  onManualStart: () => void;
};

const JOYSTICK_RADIUS = 42;
const DRAG_REVEAL_DISTANCE = 12;

export function screenVectorToWorld(
  screenX: number,
  screenY: number,
  result: MovementVector = { x: 0, z: 0 },
): MovementVector {
  const worldX = (screenX + screenY) * Math.SQRT1_2;
  const worldZ = (screenY - screenX) * Math.SQRT1_2;
  const lengthSquared = worldX * worldX + worldZ * worldZ;
  if (lengthSquared <= 0.001 ** 2) {
    result.x = 0;
    result.z = 0;
    return result;
  }
  const scale = lengthSquared > 1 ? 1 / Math.sqrt(lengthSquared) : 1;
  result.x = worldX * scale;
  result.z = worldZ * scale;
  return result;
}

function isEditable(target: EventTarget | null): boolean {
  const element = target instanceof HTMLElement ? target : null;
  return Boolean(element?.closest('input, textarea, select, button, [contenteditable="true"]'));
}

export function createMovementInputController(options: MovementInputControllerOptions) {
  const keys = new Set<string>();
  const zone = options.document.getElementById('movementControl');
  const base = options.document.getElementById('movementControlBase');
  const stick = options.document.getElementById('movementControlStick');
  const joystick: MovementVector = { x: 0, z: 0 };
  const keyboard: MovementVector = { x: 0, z: 0 };
  const movement: MovementVector = { x: 0, z: 0 };
  let pointerId: number | null = null;
  let centerX = 0;
  let centerY = 0;
  let startX = 0;
  let startY = 0;
  let pending = false;
  let active = false;
  let locked = false;

  const touchCapable = options.window.navigator.maxTouchPoints > 0
    || options.window.matchMedia('(any-pointer: coarse)').matches;
  options.document.body.classList.toggle('touch-movement-enabled', touchCapable);

  const isTouchPointer = (event: PointerEvent) => event.pointerType === 'touch' || event.pointerType === 'pen';

  const zoneContains = (clientX: number, clientY: number) => {
    if (!zone) return false;
    const bounds = zone.getBoundingClientRect();
    return clientX >= bounds.left && clientX <= bounds.right
      && clientY >= bounds.top && clientY <= bounds.bottom;
  };

  const beginManualMovement = () => {
    if (active) return;
    active = true;
    options.onManualStart();
  };

  const updateStick = (clientX: number, clientY: number) => {
    const dx = clientX - centerX;
    const dy = clientY - centerY;
    const distance = Math.hypot(dx, dy);
    const scale = distance > JOYSTICK_RADIUS ? JOYSTICK_RADIUS / distance : 1;
    const x = dx * scale;
    const y = dy * scale;
    stick?.style.setProperty('transform', `translate(${x}px, ${y}px)`);
    screenVectorToWorld(x / JOYSTICK_RADIUS, y / JOYSTICK_RADIUS, joystick);
    if (distance < 5) { joystick.x = 0; joystick.z = 0; }
  };

  const finishPointer = () => {
    pointerId = null;
    pending = false;
    joystick.x = 0;
    joystick.z = 0;
    stick?.style.removeProperty('transform');
    zone?.classList.remove('active');
    active = keys.size > 0;
  };

  const revealJoystick = (clientX: number, clientY: number) => {
    pending = false;
    if (!zone) return;
    const bounds = zone.getBoundingClientRect();
    centerX = startX;
    centerY = startY;
    base?.style.setProperty('left', `${centerX - bounds.left}px`);
    base?.style.setProperty('top', `${centerY - bounds.top}px`);
    zone.classList.add('active');
    beginManualMovement();
    updateStick(clientX, clientY);
  };

  options.window.addEventListener('keydown', (event) => {
    if (isEditable(event.target) || event.altKey || event.ctrlKey || event.metaKey) return;
    const key = event.code;
    if (!['KeyW', 'KeyA', 'KeyS', 'KeyD', 'ArrowUp', 'ArrowLeft', 'ArrowDown', 'ArrowRight'].includes(key)) return;
    event.preventDefault();
    if (!keys.has(key)) beginManualMovement();
    keys.add(key);
  }, { signal: options.signal });

  options.window.addEventListener('keyup', (event) => {
    keys.delete(event.code);
    active = keys.size > 0 || pointerId !== null;
  }, { signal: options.signal });

  options.window.addEventListener('blur', () => {
    keys.clear();
    finishPointer();
  }, { signal: options.signal });

  options.window.addEventListener('pointerdown', (event) => {
    if (!isTouchPointer(event) || pointerId !== null || locked) return;
    if (!zoneContains(event.clientX, event.clientY)) return;
    pointerId = event.pointerId;
    startX = event.clientX;
    startY = event.clientY;
    pending = true;
  }, { signal: options.signal });

  options.window.addEventListener('pointermove', (event) => {
    if (event.pointerId !== pointerId) return;
    if (pending) {
      if (options.document.body.classList.contains('camera-pan-active')) {
        pointerId = null;
        pending = false;
        return;
      }
      if (Math.hypot(event.clientX - startX, event.clientY - startY) < DRAG_REVEAL_DISTANCE) return;
      event.preventDefault();
      revealJoystick(event.clientX, event.clientY);
      return;
    }
    event.preventDefault();
    updateStick(event.clientX, event.clientY);
  }, { passive: false, signal: options.signal });

  for (const type of ['pointerup', 'pointercancel'] as const) {
    options.window.addEventListener(type, (event) => {
      if (event.pointerId === pointerId) finishPointer();
    }, { signal: options.signal });
  }

  options.signal.addEventListener('abort', () => {
    options.document.body.classList.remove('touch-movement-enabled');
    keys.clear();
    finishPointer();
  }, { once: true });

  function getMovement(): MovementVector {
    if (locked) { movement.x = 0; movement.z = 0; return movement; }
    let screenX = 0;
    let screenY = 0;
    if (keys.has('KeyA') || keys.has('ArrowLeft')) screenX -= 1;
    if (keys.has('KeyD') || keys.has('ArrowRight')) screenX += 1;
    if (keys.has('KeyW') || keys.has('ArrowUp')) screenY -= 1;
    if (keys.has('KeyS') || keys.has('ArrowDown')) screenY += 1;
    screenVectorToWorld(screenX, screenY, keyboard);
    const combinedX = keyboard.x + joystick.x;
    const combinedZ = keyboard.z + joystick.z;
    const lengthSquared = combinedX * combinedX + combinedZ * combinedZ;
    const scale = lengthSquared > 1 ? 1 / Math.sqrt(lengthSquared) : 1;
    movement.x = combinedX * scale;
    movement.z = combinedZ * scale;
    return movement;
  }

  return { getMovement, setLocked: (value: boolean) => { locked = value; if (value) { keys.clear(); finishPointer(); } } };
}
