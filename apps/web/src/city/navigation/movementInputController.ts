export type MovementVector = { x: number; z: number };

export type MovementInputControllerOptions = {
  document: Document;
  window: Window;
  signal: AbortSignal;
  onManualStart: () => void;
};

const JOYSTICK_RADIUS = 42;

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
  let active = false;
  let locked = false;

  const touchCapable = options.window.navigator.maxTouchPoints > 0
    || options.window.matchMedia('(any-pointer: coarse)').matches;
  options.document.body.classList.toggle('touch-movement-enabled', touchCapable);

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
    joystick.x = 0;
    joystick.z = 0;
    stick?.style.removeProperty('transform');
    zone?.classList.remove('active');
    active = keys.size > 0;
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

  zone?.addEventListener('pointerdown', (event) => {
    if (event.pointerType === 'mouse' || pointerId !== null) return;
    event.preventDefault();
    event.stopPropagation();
    pointerId = event.pointerId;
    const target = event.currentTarget as HTMLElement;
    target.setPointerCapture(event.pointerId);
    const bounds = target.getBoundingClientRect();
    centerX = event.clientX;
    centerY = event.clientY;
    base?.style.setProperty('left', `${centerX - bounds.left}px`);
    base?.style.setProperty('top', `${centerY - bounds.top}px`);
    target.classList.add('active');
    beginManualMovement();
    updateStick(event.clientX, event.clientY);
  }, { signal: options.signal });

  zone?.addEventListener('pointermove', (event) => {
    if (event.pointerId !== pointerId) return;
    event.preventDefault();
    updateStick(event.clientX, event.clientY);
  }, { signal: options.signal });

  for (const type of ['pointerup', 'pointercancel', 'lostpointercapture'] as const) {
    zone?.addEventListener(type, (event) => {
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
