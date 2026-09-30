import assert from 'node:assert/strict';
import test from 'node:test';
import { pickBootReason } from '../../src/city/bootGate';

const base = {
  forced: null,
  knownBuild: '1.0.0+abc',
  precacheDone: true,
  knownServerVersion: 'fp-a',
  buildId: '1.0.0+abc',
  serverVersion: 'fp-a',
};

test('forced modes always win, whatever the local markers say', () => {
  assert.deepEqual(pickBootReason({ ...base, forced: 'heavy', serverVersion: 'fp-b' }), { mode: 'heavy', reason: 'forced' });
  assert.deepEqual(pickBootReason({ ...base, forced: 'light', knownBuild: 'old', precacheDone: false }), { mode: 'light', reason: 'cached' });
});

test('first visit: no markers at all → heavy, no probe needed', () => {
  assert.deepEqual(
    pickBootReason({ ...base, knownBuild: null, precacheDone: false, knownServerVersion: null, serverVersion: null }),
    { mode: 'heavy', reason: 'first-visit' },
  );
});

test('precache marker lost (storage cleared) → heavy even with matching build', () => {
  assert.deepEqual(pickBootReason({ ...base, precacheDone: false, serverVersion: 'fp-b' }), { mode: 'heavy', reason: 'precache-missing' });
});

test('build change → heavy without caring about the server', () => {
  assert.deepEqual(pickBootReason({ ...base, buildId: '1.1.0+def', serverVersion: 'fp-b' }), { mode: 'heavy', reason: 'build-changed' });
  assert.deepEqual(pickBootReason({ ...base, buildId: '1.1.0+def', serverVersion: null }), { mode: 'heavy', reason: 'build-changed' });
});

test('server fingerprint change on a healthy device → heavy', () => {
  assert.deepEqual(pickBootReason({ ...base, serverVersion: 'fp-b' }), { mode: 'heavy', reason: 'server-changed' });
});

test('server change is ignored while another heavy reason already applies', () => {
  assert.deepEqual(
    pickBootReason({ ...base, precacheDone: false, knownServerVersion: null, serverVersion: 'fp-b' }),
    { mode: 'heavy', reason: 'precache-missing' },
  );
});

test('everything equal → light', () => {
  assert.deepEqual(pickBootReason(base), { mode: 'light', reason: 'cached' });
});

test('a never-seen server version cannot trigger server-changed (first probe)', () => {
  // knownServerVersion null = no prior observation: stay light, persist later.
  assert.deepEqual(pickBootReason({ ...base, knownServerVersion: null, serverVersion: 'fp-b' }), { mode: 'light', reason: 'cached' });
});
