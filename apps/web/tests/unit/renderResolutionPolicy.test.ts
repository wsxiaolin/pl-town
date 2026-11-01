import assert from 'node:assert/strict';
import test from 'node:test';
import {
  clampResolutionForViewport,
  isMobileViewport,
  MOBILE_RESOLUTION_CEILING,
  MOBILE_VIEWPORT_MAX_WIDTH,
} from '../../src/rendering/renderResolutionPolicy';

test('mobile viewports clamp preset and adaptive ratios to the ceiling', () => {
  assert.equal(clampResolutionForViewport(3.75, 412), MOBILE_RESOLUTION_CEILING);
  assert.equal(clampResolutionForViewport(4, 680), MOBILE_RESOLUTION_CEILING);
  assert.equal(clampResolutionForViewport(1.5, 412), 1.5, 'already-below-ceiling values pass through');
});

test('desktop viewports are never clamped', () => {
  assert.equal(clampResolutionForViewport(4, 1920), 4);
  assert.equal(clampResolutionForViewport(2.5, 1024), 2.5);
  assert.equal(clampResolutionForViewport(3.75, 681), 3.75, 'one pixel past the breakpoint is already desktop');
});

test('mobile viewport boundary matches the shared breakpoint', () => {
  assert.equal(MOBILE_VIEWPORT_MAX_WIDTH, 680);
  assert.equal(isMobileViewport(680), true, 'width equal to the breakpoint counts as mobile');
  assert.equal(isMobileViewport(681), false);
});
