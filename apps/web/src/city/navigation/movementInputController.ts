export type MovementVector = { x: number; z: number };

export type MovementInputControllerOptions = {
  document: Document;
  window: Window;
  signal: AbortSignal;
  onManualStart: () => void;
  getCameraForward?: () => MovementVector;
};

const ZERO: MovementVector = { x: 0, z: 0 };
const JOYSTICK_RADIUS = 42;

const DEFAULT_CAMERA_FORWARD: MovementVector = { x: -Math.SQRT1_2, z: -Math.SQRT1_2 };

export function screenVectorToWorld(
  screenX: number,
  screenY: number,
  cameraForward: MovementVector = DEFAULT_CAMERA_FORWARD,
): MovementVector {
  const forwardLength = Math.hypot(cameraForward.x, cameraForward.z);
  const forwardX = forwardLength > 0.001 ? cameraForward.x / forwardLength : DEFAULT_CAMERA_FORWARD.x;
  const forwardZ = forwardLength > 0.001 ? cameraForward.z / forwardLength : DEFAULT_CAMERA_FORWARD.z;
  const rightX = -forwardZ;
  const rightZ = forwardX;
  const worldX = rightX * screenX - forwardX * screenY;
  const worldZ = rightZ * screenX - forwardZ * screenY;
  const length = Math.hypot(worldX, worldZ);
  if (length <= 0.001) return ZERO;
  const scale = length > 1 ? 1 / length : 1;
  return { x: worldX * scale, z: worldZ * scale };
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
  let joystickScreen = ZERO;
  let pointerId: number | null = null;
  let centerX = 0;
  let centerY = 0;
  let active = false;

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
    joystickScreen = { x: x / JOYSTICK_RADIUS, z: y / JOYSTICK_RADIUS };
    if (distance < 5) joystickScreen = ZERO;
  };

  const finishPointer = () => {
    pointerId = null;
    joystickScreen = ZERO;
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
    let screenX = 0;
    let screenY = 0;
    if (keys.has('KeyA') || keys.has('ArrowLeft')) screenX -= 1;
    if (keys.has('KeyD') || keys.has('ArrowRight')) screenX += 1;
    if (keys.has('KeyW') || keys.has('ArrowUp')) screenY -= 1;
    if (keys.has('KeyS') || keys.has('ArrowDown')) screenY += 1;
    const cameraForward = options.getCameraForward?.() ?? DEFAULT_CAMERA_FORWARD;
    const keyboard = screenVectorToWorld(screenX, screenY, cameraForward);
    const joystick = screenVectorToWorld(joystickScreen.x, joystickScreen.z, cameraForward);
    const combined = { x: keyboard.x + joystick.x, z: keyboard.z + joystick.z };
    const length = Math.hypot(combined.x, combined.z);
    return length > 1 ? { x: combined.x / length, z: combined.z / length } : combined;
  }

  return { getMovement };
}
