import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';
import { BUILDING_REGISTRY } from '../../src/city/data/buildings/_registry';

// The registry is the single source of truth for building placement and the
// GLB models the renderer swaps in. A duplicated id silently drops a building
// from the map, and a typo'd glbFile swaps in a 404 that used to abort every
// later model. Both are cheap to pin here.
test('building registry keeps unique ids and resolvable GLB assets', () => {
  assert.ok(BUILDING_REGISTRY.length > 0);

  const ids = new Set<string>();
  for (const config of BUILDING_REGISTRY) {
    assert.ok(config.id, 'every building config needs an id');
    assert.ok(!ids.has(config.id), `duplicate building id: ${config.id}`);
    ids.add(config.id);
  }

  const modelsDir = join(process.cwd(), 'src', 'assets', 'models');
  for (const config of BUILDING_REGISTRY) {
    if (!config.glbFile) continue;
    assert.ok(
      existsSync(join(modelsDir, config.glbFile)),
      `building ${config.id} references missing model ${config.glbFile}`,
    );
  }
});
