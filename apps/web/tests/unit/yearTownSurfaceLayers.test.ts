import assert from 'node:assert/strict';
import test from 'node:test';
import { YEAR_TOWN_SURFACE_Y } from '../../src/rendering/terrain/yearTownGroundLayers';

// 年份镇贴地层高审计（AGENTS.md「远镜头 z-fighting」）：所有覆盖层共用一张
// 常量表，任意两层间距 ≥0.004u，避免远镜头共面闪烁。
test('年份镇贴地层高：任意两层间距 ≥0.004u', () => {
  const entries = Object.entries(YEAR_TOWN_SURFACE_Y).sort((a, b) => a[1] - b[1]);
  for (const [, y] of entries) assert.ok(y > 0, '层高必须为正');
  for (let i = 0; i + 1 < entries.length; i += 1) {
    const [nameA, a] = entries[i]!;
    const [nameB, b] = entries[i + 1]!;
    assert.ok(b - a >= 0.004 - 1e-9, `${nameA} → ${nameB} 层距仅 ${(b - a).toFixed(4)}`);
  }
});
