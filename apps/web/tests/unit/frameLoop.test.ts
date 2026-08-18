import assert from 'node:assert/strict';
import test from 'node:test';
import { createFrameIntervalGate, FRAME_TASK_INTERVALS } from '../../src/city/frameLoop';

test('frame interval gates run immediately and throttle repeated work', () => {
  const gate = createFrameIntervalGate(50);
  assert.equal(gate.isDue(0), true);
  assert.equal(gate.isDue(49.9), false);
  assert.equal(gate.isDue(50), true);
  assert.equal(gate.isDue(75), false);
  assert.equal(gate.isDue(100), true);
});

test('non-render frame tasks use bounded update rates', () => {
  assert.equal(Math.round(1000 / FRAME_TASK_INTERVALS.labels), 30);
  assert.equal(Math.round(1000 / FRAME_TASK_INTERVALS.npcAvoidance), 20);
  assert.equal(Math.round(1000 / FRAME_TASK_INTERVALS.mapMarker), 15);
});
