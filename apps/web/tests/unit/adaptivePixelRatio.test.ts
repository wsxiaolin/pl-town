import assert from 'node:assert/strict';
import test from 'node:test';
import { createAdaptivePixelRatioController } from '../../src/rendering/adaptivePixelRatio';

test('sustained slow frames lower pixel ratio to the configured floor', () => {
  const controller = createAdaptivePixelRatioController({
    initialRatio: 2,
    minRatio: 1,
    slowFrames: 3,
    fastFrames: 4,
  });

  assert.equal(controller.sample(30), null);
  assert.equal(controller.sample(30), null);
  assert.equal(controller.sample(30), 1.75);
  assert.equal(controller.sample(30), null);
  assert.equal(controller.sample(30), null);
  assert.equal(controller.sample(30), 1.5);
  for (let index = 0; index < 6; index += 1) controller.sample(30);
  assert.equal(controller.sample(30), null);
});

test('stable fast frames recover gradually to the initial ceiling', () => {
  const controller = createAdaptivePixelRatioController({
    initialRatio: 1.5,
    minRatio: 1,
    slowFrames: 2,
    fastFrames: 3,
  });

  controller.sample(30);
  assert.equal(controller.sample(30), 1.25);
  assert.equal(controller.sample(16), null);
  assert.equal(controller.sample(16), null);
  assert.equal(controller.sample(16), 1.5);
  for (let index = 0; index < 3; index += 1) assert.equal(controller.sample(16), null);
});

test('long stalls reset cadence samples without lowering quality', () => {
  const controller = createAdaptivePixelRatioController({ initialRatio: 2, slowFrames: 3 });

  controller.sample(30);
  controller.sample(30);
  assert.equal(controller.sample(1000), null);
  assert.equal(controller.sample(30), null);
  assert.equal(controller.sample(30), null);
  assert.equal(controller.sample(30), 1.75);
});

test('a slow display cadence alone never lowers resolution', () => {
  const controller = createAdaptivePixelRatioController({
    initialRatio: 2,
    minRatio: 1,
    slowFrames: 3,
    fastFrames: 4,
  });

  // 30 Hz panel: 33 ms frames while the render itself costs only 5 ms.
  for (let index = 0; index < 20; index += 1) assert.equal(controller.sample(33, 5), null);
});

test('a frame that misses budget because rendering is slow still degrades', () => {
  const controller = createAdaptivePixelRatioController({
    initialRatio: 2,
    minRatio: 1,
    slowFrames: 3,
    fastFrames: 4,
  });

  // 20 ms of render work inside a 30 ms frame is a real miss, not panel cadence.
  assert.equal(controller.sample(30, 20), null);
  assert.equal(controller.sample(30, 20), null);
  assert.equal(controller.sample(30, 20), 1.75);
});

test('a GPU-bound frame degrades even when the render call returns early', () => {
  const controller = createAdaptivePixelRatioController({
    initialRatio: 2,
    minRatio: 1,
    slowFrames: 3,
    fastFrames: 4,
  });

  // 60 Hz panel (16 ms cadence) that starts missing vsync: the GPU is behind,
  // so frames present at 33-50 ms while renderer.render() still returns in 3 ms.
  for (let index = 0; index < 10; index += 1) assert.equal(controller.sample(16, 3), null);
  assert.equal(controller.sample(33, 3), null);
  assert.equal(controller.sample(33, 3), null);
  assert.equal(controller.sample(50, 3), 1.75);
});

test('a render call that alone exceeds the frame budget degrades', () => {
  const controller = createAdaptivePixelRatioController({
    initialRatio: 2,
    minRatio: 1,
    slowFrames: 2,
    fastFrames: 4,
  });

  assert.equal(controller.sample(20, 26), null);
  assert.equal(controller.sample(20, 26), 1.75);
});

test('a sustained GPU slowdown is not learned as the display cadence', () => {
  const controller = createAdaptivePixelRatioController({
    initialRatio: 1.5,
    minRatio: 1,
    slowFrames: 3,
    fastFrames: 4,
  });

  // 60 Hz panel rendering in 3 ms, then the GPU falls behind and frames creep
  // up to 33 ms while renderer.render() still returns immediately. The longer
  // intervals must keep counting as slow instead of redefining the baseline.
  for (let index = 0; index < 10; index += 1) assert.equal(controller.sample(16, 3), null);
  assert.equal(controller.sample(33, 3), null);
  assert.equal(controller.sample(33, 3), null);
  assert.equal(controller.sample(33, 3), 1.25);
  assert.equal(controller.sample(33, 3), null);
  assert.equal(controller.sample(33, 3), null);
  assert.equal(controller.sample(33, 3), 1);
});
