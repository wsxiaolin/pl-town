import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';
import { BUILDING_REGISTRY } from '../../src/city/data/buildings/_registry';

// The registry is the single source of truth for building placement and the
// GLB models the renderer swaps in. A duplicated id silently drops a building
// from the map, and a typo'd glbFile swaps in a 404 that used to abort every
// later model. Both are cheap to pin here.

// Locate the assets directory independently of the invocation cwd: fast path
// assumes the `npm run test:unit -w @minicity/web` layout (cwd = apps/web),
// then falls back to `git rev-parse --show-toplevel`. The fallback matters
// because Playwright (before the testIgnore fix in a follow-up PR) imports
// `tests/unit/**` files with the repo root as cwd inside shard jobs — a
// cwd-only resolution produces a failing "missing model" assertion buried in
// shard logs even though the run stays green.
function repoRoot(): string {
  const cwd = process.cwd();
  // Fast path: cwd is already apps/web (the `test:unit -w` layout).
  if (existsSync(join(cwd, 'src', 'assets', 'models'))) return join(cwd, '..', '..');
  try {
    return execFileSync('git', ['rev-parse', '--show-toplevel'], { encoding: 'utf8' }).trim();
  } catch {
    return cwd; // let the assertion below emit a diagnostic
  }
}

test('building registry keeps unique ids and resolvable GLB assets', () => {
  assert.ok(BUILDING_REGISTRY.length > 0);

  const ids = new Set<string>();
  for (const config of BUILDING_REGISTRY) {
    assert.ok(config.id, 'every building config needs an id');
    assert.ok(!ids.has(config.id), `duplicate building id: ${config.id}`);
    ids.add(config.id);
  }

  // 模型目录定位解耦 cwd：找不到布局时直接失败并指明路径，
  // 比逐个报“模型缺失”更可诊断。
  const modelsDir = join(repoRoot(), 'apps', 'web', 'src', 'assets', 'models');
  assert.ok(
    existsSync(modelsDir),
    `models dir not found at ${modelsDir}; run via \`npm run test:unit -w @minicity/web\` (cwd must be apps/web) or from the repository root`,
  );
  for (const config of BUILDING_REGISTRY) {
    if (!config.glbFile) continue;
    assert.ok(
      existsSync(join(modelsDir, config.glbFile)),
      `building ${config.id} references missing model ${config.glbFile}`,
    );
  }
});
