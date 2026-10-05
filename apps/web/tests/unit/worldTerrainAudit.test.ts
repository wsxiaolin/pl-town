import assert from 'node:assert/strict';
import test from 'node:test';
import { LANPING_RANGE } from '../../src/city/data/terrain/range-lanping';
import { CHENXI_RIVER, ESTUARY_PROFILE, ESTUARY_BBOX } from '../../src/city/data/terrain/river-chenxi';
import { MINGLAN_ISLES } from '../../src/city/data/terrain/sea-minglan';

// 世界地形配置的数值审计（v5，2026-10-04）：把 range-lanping.ts /
// sea-minglan.ts 头注释里逐条核对的 keep-out 约束固化成回归测试——
// 任何挪山、改半径、改河线的 PR 都必须先过这里。
//
// 坐标事实的来源（改动须两侧同步）：
// - 星语北城（PR #196）：建筑/路网占 x∈[-33.5,33.5]、z∈[-36,-80]，
//   审计按包围盒外扩 8（x∈[-41,41]、z∈[-88,-33]）。
// - 导航可步行区（WORLD_BOUNDS）：x∈[-50,84]、z∈[-88,42]。
// - 观星走廊：x∈[36,88]、z∈[-12,12]。
// - 西海滩既有道具（westBeach.ts / sea-minglan.ts 头注释）：俾斯麦
//   (-61, z -16..8)、希佩尔 (-55, z 16..34)、海鸥群 (x -60..-46,
//   z -15..35)、沙滩 (x -44.4..-33) 与浪花带 (x ≥ -47.4)。

type Box = { x0: number; x1: number; z0: number; z1: number };

const NORTH_DISTRICT_KEEP_OUT: Box = { x0: -41, x1: 41, z0: -88, z1: -33 };
const NAVIGABLE_AREA: Box = { x0: -50, x1: 84, z0: -88, z1: 42 };
const OBSERVATORY_CORRIDOR: Box = { x0: 36, x1: 88, z0: -12, z1: 12 };
/** 河岸景观带（河心 ± 岸外缘 8.5）；河 x 范围外不适用。 */
const RIVER_SCENERY_Z = [-107.5, -86.5] as const;
const RIVER_X_RANGE = [-60, 66] as const;

function boxesOverlap(a: Box, b: Box): boolean {
  return !(a.x1 < b.x0 || a.x0 > b.x1 || a.z1 < b.z0 || a.z0 > b.z1);
}

test('岚屏岭山体/崖壁全部按包围盒脱开星语北城 keep-out', () => {
  for (const feature of LANPING_RANGE) {
    if (feature.kind !== 'mountain' && feature.kind !== 'cliff') continue;
    const r = Math.max(feature.width ?? 0, feature.depth ?? 0) / 2;
    const box: Box = { x0: feature.x - r, x1: feature.x + r, z0: feature.z - r, z1: feature.z + r };
    assert.ok(
      !boxesOverlap(box, NORTH_DISTRICT_KEEP_OUT),
      `${feature.id} 包围盒 ${JSON.stringify(box)} 进入星语北城 keep-out`,
    );
  }
});

test('大型山体（h ≥ 10）不进导航可步行区（观星崖等小地形物豁免）', () => {
  for (const feature of LANPING_RANGE) {
    if (feature.kind !== 'mountain' && feature.kind !== 'cliff') continue;
    if ((feature.height ?? 0) < 10) continue; // 小型阻挡物由 navigationBlocking 声明绕行
    const r = Math.max(feature.width ?? 0, feature.depth ?? 0) / 2;
    const box: Box = { x0: feature.x - r, x1: feature.x + r, z0: feature.z - r, z1: feature.z + r };
    assert.ok(!boxesOverlap(box, NAVIGABLE_AREA), `${feature.id} 包围盒进入导航可步行区`);
  }
});

test('岚屏岭山体/崖壁全部按包围盒脱开观星走廊', () => {
  for (const feature of LANPING_RANGE) {
    if (feature.kind !== 'mountain' && feature.kind !== 'cliff') continue;
    const r = Math.max(feature.width ?? 0, feature.depth ?? 0) / 2;
    const box: Box = { x0: feature.x - r, x1: feature.x + r, z0: feature.z - r, z1: feature.z + r };
    assert.ok(!boxesOverlap(box, OBSERVATORY_CORRIDOR), `${feature.id} 包围盒进入观星走廊`);
  }
});

test('山体不压晨溪河岸景观带（河 x 范围内 z 脱开）', () => {
  for (const feature of LANPING_RANGE) {
    if (feature.kind !== 'mountain') continue;
    const r = Math.max(feature.width ?? 0, feature.depth ?? 0) / 2;
    const inRiverX = feature.x + r > RIVER_X_RANGE[0] && feature.x - r < RIVER_X_RANGE[1];
    if (!inRiverX) continue;
    assert.ok(
      feature.z - r >= RIVER_SCENERY_Z[1] || feature.z + r <= RIVER_SCENERY_Z[0],
      `${feature.id} 包围盒（z ${(feature.z - r).toFixed(1)}..${(feature.z + r).toFixed(1)}）压河岸景观带 ${RIVER_SCENERY_Z}`,
    );
  }
});

test('晨溪中心线全程在北城 keep-out 与导航区之外（z ≤ -89.2）', () => {
  const river = CHENXI_RIVER.find((feature) => feature.kind === 'river');
  assert.ok(river?.path?.length, 'river-chenxi 配置缺 path');
  for (const [x, z] of river!.path!) {
    assert.ok(z <= -89.2, `河线点 (${x}, ${z}) 越过导航边距线 z = -89.2`);
  }
});

test('明澜岛屿/岬角与西海滩既有道具保持 ≥12 间距', () => {
  // 道具锚点/范围（sea-minglan.ts 头注释与 westBeach.ts 实测）。
  const props: Array<{ label: string; x0: number; x1: number; z0: number; z1: number }> = [
    { label: '俾斯麦', x0: -62.6, x1: -59.4, z0: -16, z1: 8 },
    { label: '希佩尔', x0: -56.3, x1: -53.7, z0: 16, z1: 34 },
    { label: '海鸥群', x0: -60, x1: -46, z0: -15, z1: 35 },
    { label: '沙滩/浪花带', x0: -47.4, x1: -33, z0: -64, z1: 64 },
  ];
  for (const feature of MINGLAN_ISLES) {
    if (feature.kind !== 'island' && feature.kind !== 'mountain') continue;
    const r = Math.max(feature.width ?? 0, feature.depth ?? 0) / 2;
    // 沙线盘在渲染层再外扩 1.5：清空距按圆（r + 1.5）到道具盒的
    // 欧氏距离计——与 sea-minglan.ts 头注释的核对口径一致。
    const clearanceR = r + 1.5;
    for (const prop of props) {
      const nearestX = Math.max(prop.x0, Math.min(feature.x, prop.x1));
      const nearestZ = Math.max(prop.z0, Math.min(feature.z, prop.z1));
      const distance = Math.hypot(feature.x - nearestX, feature.z - nearestZ) - clearanceR;
      assert.ok(
        distance >= 12,
        `${feature.id}（r+沙线 ${clearanceR.toFixed(1)}）距 ${prop.label} 仅 ${distance.toFixed(1)}（< 12）`,
      );
    }
  }
});

test('河口湾喇叭面不进导航可步行区（z ≥ -89.5 视为越界）', () => {
  for (const [x, z, half] of ESTUARY_PROFILE) {
    assert.ok(z + half <= -89.5, `河口湾采样点 (x ${x}, z ${z}, half ${half}) 北缘 ${(z + half).toFixed(1)} 越过 -89.5`);
  }
});

test('河口湾完整落在西海滩道具清空区之外（沙洲/湾面不压俾斯麦巡航线）', () => {
  // 用 data 层 ESTUARY_BBOX（岸景排除盒，含边缘扰动余量）锁定范围：
  // z1 = -89 → 距导航边 z = -88 留 1 单位；z0 = -106 在西海面 z 边界
  // -112 之内；x 跨 -46..-31.5，横跨可见入海点（x ≈ -42.6）的沙滩带。
  // 俾斯麦最北 z = -16：z 向间距 ≥ 73，远超 12 的清空距。
  assert.ok(ESTUARY_BBOX.z1 <= -89, `河口湾排除盒北缘 ${ESTUARY_BBOX.z1} 必须在导航边 z = -88 之外（含余量）`);
  assert.ok(ESTUARY_BBOX.z0 >= -112, `河口湾排除盒南缘 ${ESTUARY_BBOX.z0} 不得越过西海面 z 边界 -112`);
  assert.ok(ESTUARY_BBOX.x0 < -33 && ESTUARY_BBOX.x1 > -44, '河口湾应横跨可见入海点（x ≈ -42.6）附近的沙滩带');
});
