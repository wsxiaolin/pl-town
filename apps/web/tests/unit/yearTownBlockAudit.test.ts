import assert from 'node:assert/strict';
import test from 'node:test';
import { YEAR_DISTRICTS, YEAR_ISLAND_SPECS } from '../../src/city/data/year-towns/towns';
import { islandSurfaceYAt } from '../../src/city/data/terrain/heightfield/islandField';

// 街廓平整审计：登记街廓是建筑落位的合法区域，必须整块落在岛台面上
// （islandSurfaceYAt === district.topY）。含起源村（island-2019 只在
// YEAR_ISLAND_SPECS，不在 YEAR_DISTRICTS）。采样按块缘内收 0.8u、步进
// 2u 且显式包含四条内收边界（CodeRabbit：纯步进循环会漏采末端 1.4u）。
// 该审计同时守卫未来的地形改动：给台面加山丘/山脊时必须同步扩大阶地，
// 否则此处先红。

test('登记街廓整块落在平整台面上', () => {
  const problems: string[] = [];
  // 起源村只在 YEAR_ISLAND_SPECS；两城在 YEAR_DISTRICTS（其 ISLAND_SPECS
  // 孪生条目无 grid，blocks ?? [] 自然跳过）。
  const areas = [...YEAR_ISLAND_SPECS, ...YEAR_DISTRICTS.filter((d) => !YEAR_ISLAND_SPECS.some((s) => s.id === d.id))];
  for (const area of areas) {
    const blocks = area.grid?.blocks ?? [];
    for (const block of blocks) {
      const inset = 0.8;
      const x0 = block.x0 + inset;
      const x1 = block.x1 - inset;
      const z0 = block.z0 + inset;
      const z1 = block.z1 - inset;
      if (x1 < x0 || z1 < z0) {
        problems.push(`${area.id} 街廓 [${block.x0},${block.x1}]×[${block.z0},${block.z1}] 内收后为空`);
        continue;
      }
      const xSteps = Math.max(1, Math.ceil((x1 - x0) / 2));
      const zSteps = Math.max(1, Math.ceil((z1 - z0) / 2));
      for (let zi = 0; zi <= zSteps; zi += 1) {
        for (let xi = 0; xi <= xSteps; xi += 1) {
          const sx = x0 + ((x1 - x0) * xi) / xSteps;
          const sz = z0 + ((z1 - z0) * zi) / zSteps;
          const surface = islandSurfaceYAt(sx, sz);
          if (surface === null) {
            problems.push(`${area.id} 街廓点 (${sx.toFixed(1)},${sz.toFixed(1)}) 不在任何岛台足印内`);
          } else if (Math.abs(surface - area.topY) > 1e-6) {
            problems.push(`${area.id} 街廓点 (${sx.toFixed(1)},${sz.toFixed(1)}) 高度 ${surface.toFixed(3)} ≠ 台面 ${area.topY}`);
          }
        }
      }
    }
  }
  assert.deepEqual(problems, [], problems.join('\n'));
});
