import assert from 'node:assert/strict';
import test from 'node:test';
import { combineAbortSignals } from '../../src/core/abortable';

// The House of Commons panels crashed on HuaweiBrowser/HarmonyOS Chromium
// engines older than 116 with "AbortSignal.any is not a function". The
// fallback must compose aborts manually on exactly those engines, while the
// native path stays in charge wherever it exists.
test('combineAbortSignals composes aborts on engines without AbortSignal.any', (context) => {
  const descriptor = Object.getOwnPropertyDescriptor(AbortSignal, 'any');
  assert.ok(descriptor, 'this engine should have AbortSignal.any to simulate its absence');
  context.after(() => Object.defineProperty(AbortSignal, 'any', descriptor));
  Reflect.deleteProperty(AbortSignal, 'any');
  assert.equal(typeof (AbortSignal as { any?: unknown }).any, 'undefined');

  const first = new AbortController();
  const second = new AbortController();
  const combined = combineAbortSignals([first.signal, second.signal]);
  assert.equal(combined.aborted, false);
  second.abort('timeout');
  assert.equal(combined.aborted, true);
  assert.equal(combined.reason, 'timeout');

  const preAborted = combineAbortSignals([first.signal, AbortSignal.abort('early')]);
  assert.equal(preAborted.aborted, true);
  assert.equal(preAborted.reason, 'early');
});

test('combineAbortSignals keeps delegating to the native AbortSignal.any', () => {
  assert.equal(typeof (AbortSignal as { any?: unknown }).any, 'function');
  const first = new AbortController();
  const second = new AbortController();
  const combined = combineAbortSignals([first.signal, second.signal]);
  first.abort();
  assert.equal(combined.aborted, true);
});
