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
