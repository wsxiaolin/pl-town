import assert from 'node:assert/strict';
import test from 'node:test';
import { YEAR_DISTRICTS } from '../../src/city/data/year-towns/towns';
import { islandSurfaceYAt } from '../../src/city/data/terrain/heightfield/islandField';

// 街廓平整审计：登记街廓是建筑落位的合法区域，必须整块落在岛台面上
// （islandSurfaceYAt === district.topY）。2u 网格采样、块缘内收 0.8u——
// 建筑允许贴着街廓边线布置，所以有效可建区按 0.8u 内收校验。
// 该审计同时守卫未来的地形改动：给台面加山丘/山脊时必须同步扩大阶地，
// 否则此处先红。

test('登记街廓整块落在平整台面上', () => {
  const problems: string[] = [];
  for (const district of YEAR_DISTRICTS) {
    const blocks = district.grid?.blocks ?? [];
    for (const block of blocks) {
      const inset = 0.8;
      const x0 = block.x0 + inset;
      const x1 = block.x1 - inset;
      const z0 = block.z0 + inset;
      const z1 = block.z1 - inset;
      if (x1 < x0 || z1 < z0) {
        problems.push(`${district.id} 街廓 [${block.x0},${block.x1}]×[${block.z0},${block.z1}] 内收后为空`);
        continue;
      }
      for (let z = z0; z <= z1 + 1e-9; z += 2) {
        for (let x = x0; x <= x1 + 1e-9; x += 2) {
          const sx = Math.min(x, x1);
          const sz = Math.min(z, z1);
          const surface = islandSurfaceYAt(sx, sz);
          if (surface === null) {
            problems.push(`${district.id} 街廓点 (${sx},${sz}) 不在任何岛台足印内`);
          } else if (Math.abs(surface - district.topY) > 1e-6) {
            problems.push(`${district.id} 街廓点 (${sx},${sz}) 高度 ${surface.toFixed(3)} ≠ 台面 ${district.topY}`);
          }
        }
      }
    }
  }
  assert.deepEqual(problems, [], problems.join('\n'));
});
