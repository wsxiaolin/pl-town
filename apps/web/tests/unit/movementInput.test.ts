import assert from 'node:assert/strict';
import test from 'node:test';
import { createMovementInputController, screenVectorToWorld } from '../../src/city/navigation/movementInputController';
import { retainPathOnFailedReroute } from '../../src/city/navigation/playerController';
import * as THREE from 'three';

class FakeClassList {
  private readonly names = new Set<string>();
  add(name: string) { this.names.add(name); }
  remove(name: string) { this.names.delete(name); }
  contains(name: string) { return this.names.has(name); }
  toggle(name: string, force?: boolean) {
    if (force === undefined) {
      if (this.names.has(name)) this.names.delete(name);
      else this.names.add(name);
      return;
    }
    if (force) this.names.add(name);
    else this.names.delete(name);
  }
}

function createFakePointerEnv(touchCapable: boolean) {
  const listeners = new Map<string, Set<(event: PointerEvent) => void>>();
  const zoneClasses = new FakeClassList();
  const bodyClasses = new FakeClassList();
  const zone = {
    classList: zoneClasses,
    getBoundingClientRect: () => ({ left: 0, top: 500, right: 260, bottom: 768 }),
  };
  const base = { style: { setProperty() {}, removeProperty() {} } };
  const stick = { style: { setProperty() {}, removeProperty() {} } };
  const document = {
    body: { classList: bodyClasses },
    getElementById(id: string) {
      if (id === 'movementControl') return zone;
      if (id === 'movementControlBase') return base;
      if (id === 'movementControlStick') return stick;
      return null;
    },
  };
  const window = {
    navigator: { maxTouchPoints: touchCapable ? 1 : 0 },
    matchMedia: () => ({ matches: false }),
    addEventListener(type: string, handler: (event: PointerEvent) => void) {
      if (!listeners.has(type)) listeners.set(type, new Set());
      listeners.get(type)!.add(handler);
    },
  };
  const dispatch = (type: string, event: Partial<PointerEvent> & { pointerId: number; pointerType: string; clientX: number; clientY: number }) => {
    const payload = { preventDefault() {}, ...event } as PointerEvent;
    for (const handler of listeners.get(type) ?? []) handler(payload);
  };
  return { document, window, zoneClasses, bodyClasses, dispatch };
}

test('screen movement maps to the isometric ground plane', () => {
  const up = screenVectorToWorld(0, -1);
  const right = screenVectorToWorld(1, 0);
  assert.ok(up.x < 0 && up.z < 0);
  assert.ok(right.x > 0 && right.z < 0);
  assert.ok(Math.abs(Math.hypot(up.x, up.z) - 1) < 0.0001);
});

test('diagonal input is normalized and idle input stays zero', () => {
  const diagonal = screenVectorToWorld(1, -1);
  assert.ok(Math.abs(Math.hypot(diagonal.x, diagonal.z) - 1) < 0.0001);
  assert.deepEqual(screenVectorToWorld(0, 0), { x: 0, z: 0 });
});

test('a failed repeated click keeps the active automatic route', () => {
  const active = [new THREE.Vector3(0, 0, -6), new THREE.Vector3(0, 0, -12)];
  assert.equal(retainPathOnFailedReroute(active, []), active);
  const replacement = [new THREE.Vector3(6, 0, 0)];
  assert.equal(retainPathOnFailedReroute(active, replacement), replacement);
});

test('touch devices enable the capture zone without showing the wheel until a drag', () => {
  const env = createFakePointerEnv(true);
  const started: boolean[] = [];
  createMovementInputController({
    document: env.document as unknown as Document,
    window: env.window as unknown as Window,
    signal: new AbortController().signal,
    onManualStart: () => started.push(true),
  });
  assert.equal(env.bodyClasses.contains('touch-movement-enabled'), true);

  env.dispatch('pointerdown', { pointerId: 1, pointerType: 'touch', clientX: 80, clientY: 620 });
  assert.equal(env.zoneClasses.contains('active'), false);
  assert.equal(started.length, 0);

  env.dispatch('pointerup', { pointerId: 1, pointerType: 'touch', clientX: 80, clientY: 620 });
  assert.equal(env.zoneClasses.contains('active'), false);
  assert.equal(started.length, 0);

  env.dispatch('pointerdown', { pointerId: 2, pointerType: 'touch', clientX: 80, clientY: 620 });
  env.dispatch('pointermove', { pointerId: 2, pointerType: 'touch', clientX: 120, clientY: 620 });
  assert.equal(env.zoneClasses.contains('active'), true);
  assert.equal(started.length, 1);
});

test('mouse pointers never reveal the movement wheel', () => {
  const env = createFakePointerEnv(false);
  const started: boolean[] = [];
  createMovementInputController({
    document: env.document as unknown as Document,
    window: env.window as unknown as Window,
    signal: new AbortController().signal,
    onManualStart: () => started.push(true),
  });
  assert.equal(env.bodyClasses.contains('touch-movement-enabled'), false);
  env.dispatch('pointerdown', { pointerId: 1, pointerType: 'mouse', clientX: 80, clientY: 620 });
  env.dispatch('pointermove', { pointerId: 1, pointerType: 'mouse', clientX: 140, clientY: 620 });
  assert.equal(env.zoneClasses.contains('active'), false);
  assert.equal(started.length, 0);
});
