import assert from 'node:assert/strict';
import test from 'node:test';
import {
  DEV_SPEED_MULTIPLIER,
  isDevPortalRequested,
  resolvePlayerSpeed,
} from '../../src/city/devPortal';

function withSearch(search: string, run: () => void): void {
  const scope = globalThis as { window?: unknown };
  const original = scope.window;
  scope.window = { location: { search } };
  try {
    run();
  } finally {
    scope.window = original;
  }
}

test('dev portal helpers stay inert for normal visitors', () => {
  withSearch('', () => {
    assert.equal(isDevPortalRequested(), false);
    assert.equal(resolvePlayerSpeed(4.2), 4.2);
  });
});

test('?dev enables the doubled local movement speed', () => {
  withSearch('?dev=1', () => {
    assert.equal(isDevPortalRequested(), true);
    assert.equal(resolvePlayerSpeed(4.2), 4.2 * DEV_SPEED_MULTIPLIER);
  });
});
