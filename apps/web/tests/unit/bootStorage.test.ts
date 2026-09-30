import assert from 'node:assert/strict';
import test from 'node:test';
import { markBootComplete, pickBootReason, readBootMarkers, type BootStorage } from '../../src/city/bootGate';

// markBootComplete reads __MINICITY_BUILD_ID__ (vite define) — absent in node,
// the declare falls back to undefined → currentBuildId() would throw. The
// unit under test is the marker STATE MACHINE, so shim the define via a
// throwaway global before import would be cleaner, but the module caches it
// at call time — provide it through globalThis instead of the declare.
(globalThis as { __MINICITY_BUILD_ID__?: string }).__MINICITY_BUILD_ID__ ??= '0.1.0+test';

function fakeStorage(): BootStorage & { dump(): Map<string, string> } {
  const store = new Map<string, string>();
  return {
    get: (k) => store.get(k) ?? null,
    set: (k, v) => { store.set(k, v); },
    remove: (k) => { store.delete(k); },
    dump: () => store,
  };
}

test('markBootComplete writes build+precache and the known fingerprint', () => {
  const storage = fakeStorage();
  markBootComplete('fp-new', storage);
  const markers = readBootMarkers(storage);
  assert.equal(markers.precacheDone, true);
  assert.equal(markers.knownBuild, '0.1.0+test');
  assert.equal(markers.knownServerVersion, 'fp-new');
});

test('markBootComplete with an unknown fingerprint clears a stale one (unknown ≠ stale)', () => {
  const storage = fakeStorage();
  markBootComplete('fp-old', storage);
  markBootComplete(null, storage);
  // Cleared, not left armed: the next visit routes through the
  // "never seen" branch instead of re-triggering server-changed forever.
  assert.equal(readBootMarkers(storage).knownServerVersion, null);
});

test('the full invariant cycle: heavy completes → light; degraded never marks', () => {
  const storage = fakeStorage();
  // First visit (no markers) → heavy.
  let decision = pickBootReason({ ...readBootMarkers(storage), forced: null, buildId: '0.1.0+test', serverVersion: null });
  assert.equal(decision.reason, 'first-visit');
  // A degraded boot writes nothing — still heavy next visit.
  decision = pickBootReason({ ...readBootMarkers(storage), forced: null, buildId: '0.1.0+test', serverVersion: 'fp-1' });
  assert.equal(decision.reason, 'first-visit');
  // Completing marks + probing → light on every later visit.
  markBootComplete('fp-1', storage);
  decision = pickBootReason({ ...readBootMarkers(storage), forced: null, buildId: '0.1.0+test', serverVersion: 'fp-1' });
  assert.equal(decision.mode, 'light');
  // Server fingerprint rotates → heavy again.
  decision = pickBootReason({ ...readBootMarkers(storage), forced: null, buildId: '0.1.0+test', serverVersion: 'fp-2' });
  assert.equal(decision.reason, 'server-changed');
  assert.equal(decision.mode, 'heavy');
});
