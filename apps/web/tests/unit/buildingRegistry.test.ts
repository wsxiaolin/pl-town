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

  // 测试依赖仓库布局：模型目录不存在说明 cwd 不对（应经
  // `npm run test:unit -w @minicity/web` 从 apps/web 运行），
  // 直接失败并指明路径，比逐个报“模型缺失”更可诊断。
  const modelsDir = join(process.cwd(), 'src', 'assets', 'models');
  assert.ok(
    existsSync(modelsDir),
    `models dir not found at ${modelsDir}; run via \`npm run test:unit -w @minicity/web\` (cwd must be apps/web)`,
  );
  for (const config of BUILDING_REGISTRY) {
    if (!config.glbFile) continue;
    assert.ok(
      existsSync(join(modelsDir, config.glbFile)),
      `building ${config.id} references missing model ${config.glbFile}`,
    );
  }
});
