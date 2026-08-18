import assert from 'node:assert/strict';
import test from 'node:test';
import { selectDefaultRenderSettings } from '../../src/rendering/createRenderer';

test('default render settings keep desktop quality within a balanced pixel budget', () => {
  const settings = selectDefaultRenderSettings({ viewportWidth: 1920, pixelRatio: 2, deviceMemory: 8, hardwareConcurrency: 8 });
  assert.equal(settings.resolution, 1.5);
  assert.equal(settings.antialias, true);
  assert.equal(settings.anisotropy, 8);
});

test('desktop-mode tablets still receive the constrained initial preset', () => {
  const settings = selectDefaultRenderSettings({ viewportWidth: 1024, pixelRatio: 2, deviceMemory: 4, hardwareConcurrency: 4 });
  assert.equal(settings.resolution, 1);
  assert.equal(settings.antialias, false);
  assert.equal(settings.anisotropy, 4);
});
