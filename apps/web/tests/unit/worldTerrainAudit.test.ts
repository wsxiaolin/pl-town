import assert from 'node:assert/strict';
import test from 'node:test';
import { LANPING_RANGE } from '../../src/city/data/terrain/range-lanping';
import { CHENXI_RIVER, ESTUARY_PROFILE, ESTUARY_BBOX } from '../../src/city/data/terrain/river-chenxi';
import { MINGLAN_ISLES } from '../../src/city/data/terrain/sea-minglan';
import { CITYSIDE_MEADOW } from '../../src/city/data/terrain/ground-cityside';
import { WORLD_TERRAIN } from '../../src/city/data/terrain/_world';
import { CITY_LIMIT, ECHO_OBSERVATORY_AREA, NORTH_DISTRICT_AREA, shorelineX } from '../../src/city/data/cityConfig';
import { YEAR_ISLAND_SPECS, islandShapeScaleAt } from '../../src/city/data/year-towns/towns';
import { bridgeDeckBlendAt, stationPadBlendAt } from '../../src/city/data/terrain/heightfield/transitField';
import { YEAR_ISLANDS, SOUTH_SEA, SOUTH_SEA_COAST_TUCK, isArchipelagoWaterAt, southLandEdgeZ } from '../../src/city/data/terrain/sea-archipelago';
import { ISLAND_SKIRT_W } from '../../src/city/data/terrain/heightfield/islandField';
import { PLATEAU_MAIN } from '../../src/city/data/terrain/heightfield/plateauField';
import { sampleCitysideMeadowY } from '../../src/rendering/terrain/meadowField';
import { TRAIL_NAV_NODES, SOUTH_TRAIL_NODES, NORTH_TRAIL_NODES, TRAIL_SLOT_HALF, worldReliefAt } from '../../src/city/data/terrain/heightfield/worldReliefField';
import { terrainHeight } from '../../src/city/data/terrain/heightfield/terrainHeight';
import { RIVER_SAMPLES, riverWaterYAt, riverWaterRows } from '../../src/city/data/terrain/heightfield/riverField';

// 世界地形配置的数值审计（v5，2026-10-04）：把 range-lanping.ts /
// sea-minglan.ts 头注释里逐条核对的 keep-out 约束固化成回归测试——
// 任何挪山、改半径、改河线的 PR 都必须先过这里。
//
// 坐标事实的来源（改动须两侧同步）：
// - 星语北城（PR #196）：建筑/路网占 x∈[-33.5,33.5]、z∈[-36,-80]，
//   审计按包围盒外扩 8（x∈[-41,41]、z∈[-88,-33]）。
// - 导航可步行区（WORLD_BOUNDS，R2 随出城步道外扩）：x∈[-50,76]、
//   z∈[-88.2,104]（S4 观景平台 96 + 8 边距）。
// - 观星走廊：x∈[36,88]、z∈[-12,12]。
// - 西海滩既有道具（westBeach.ts / sea-minglan.ts 头注释）：俾斯麦
//   (-61, z -16..8)、希佩尔 (-55, z 16..34)、海鸥群 (x -60..-46,
//   z -15..35)、沙滩 (x -44.4..-33) 与浪花带 (x ≥ -47.4)。

type Box = { x0: number; x1: number; z0: number; z1: number };

const NORTH_DISTRICT_KEEP_OUT: Box = { x0: -41, x1: 41, z0: -88, z1: -33 };
const OBSERVATORY_CORRIDOR: Box = { x0: 36, x1: 88, z0: -12, z1: 12 };
/** 河岸景观带（河心 ± 岸外缘 8.5）；河 x 范围外不适用。 */
const RIVER_SCENERY_Z = [-107.5, -86.5] as const;
const RIVER_X_RANGE = [-60, 66] as const;
/** 晨溪河谷带（mountainRanges RIVER_VALLEY_BOX / cityGround 同源）。 */
const RIVER_VALLEY_BOX: Box = { x0: -62, x1: 68, z0: -110, z1: -86 };

// ── 导航可步行区：单一真值（review #218）────────────────────────────────
// NAVIGABLE_AREA 曾是手写常量（z 上界 42），与 roadNavigation 运行时由
// CITY_LIMIT + 观星/北城路网节点动态推导的 WORLD_BOUNDS（z 上界 50）是
// 两份真值，南侧 8 个单位的漏洞可让越界地形通过审计。这里按
// roadNavigation.ts 的同一公式从纯数据配置推导，并对文档快照断言——
// 任一侧漂移（改公式、改节点、改 CITY_LIMIT）都会让快照断言变红。
// R2（2026-10-11）：出城步道并入推导（roadNavigation.meadowTrail 的
// roadNodes = heightfield TRAIL_NAV_NODES（双走廊 S4 z=96 / N4 z=-114）——运行时
// WORLD_BOUNDS 已随步道外扩到 z1=104，快照同步，恢复「快照一致」效力。
const EXTRA_ROAD_NODES = [
  ...ECHO_OBSERVATORY_AREA.roadNodes,
  ...NORTH_DISTRICT_AREA.roadNodes,
  ...TRAIL_NAV_NODES.map(({ x, z }) => [x, z] as [number, number]),
];
const NAVIGABLE_AREA: Box = {
  x0: Math.min(-CITY_LIMIT, ...EXTRA_ROAD_NODES.map(([x]) => x)) - 8,
  x1: Math.max(CITY_LIMIT, ...EXTRA_ROAD_NODES.map(([x]) => x)) + 8,
  z0: Math.min(-CITY_LIMIT, ...EXTRA_ROAD_NODES.map(([, z]) => z)) - 8,
  z1: Math.max(CITY_LIMIT, ...EXTRA_ROAD_NODES.map(([, z]) => z)) + 8,
};
/** 城区导航区（旧快照盒，z ≤ 50）：出城步道把可步行区扩入南草甸是方案
 * §5.3 的有意变更（观景可达）；台地平坦/草甸 keep-out 等城区语义断言
 * 继续以本盒为准（方案 §9.2：新导航区草甸段「允许」起伏——那正是坡度
 * 判定的辖区，不属于「城区可走区地面平」的审计目标）。 */
const CITY_NAVIGABLE_AREA: Box = { x0: -50, x1: 76, z0: -88.2, z1: 50 };
test('NAVIGABLE_AREA 与 roadNavigation 运行时边界快照一致', () => {
  // v9 北线步道（N4 z=-113, x=74）：可步行外框北扩入晨溪谷地（sin「山可探索」）。
  // 外框只是绕行边界，山体墙由 roadNavigation.mountainSurfaceBlocked 逐点阻挡
  // （与渲染山体网格共享 LANPING_ALPINE_FIELD 高度场，见 roadNavigation.test.ts）。
  const snapshot = { x0: -50, x1: 82, z0: -121, z1: 104 };
  for (const key of ['x0', 'x1', 'z0', 'z1'] as const) {
    assert.ok(
      Math.abs(NAVIGABLE_AREA[key] - snapshot[key]) < 1e-6,
      `导航边界快照漂移：${key} = ${NAVIGABLE_AREA[key]}（快照 ${snapshot[key]}）。`
      + '若 roadNavigation 公式或 cityConfig 路网节点（含出城步道 TRAIL_NAV_NODES）'
      + '有意变更，请同步复核山体/草甸各审计与 cityGround 的步道切槽剔除',
    );
  }
});

test('步道走廊净空：双走廊折线 ± 槽半宽不被大型山体包围盒侵入', () => {
  const corridors = [SOUTH_TRAIL_NODES, NORTH_TRAIL_NODES];
  for (const nodes of corridors) {
    for (let i = 0; i + 1 < nodes.length; i += 1) {
      const a = nodes[i]!; const b = nodes[i + 1]!;
      // 段包围盒 = 端点盒 ∪ 槽半宽外扩（折线段无斜率外延歧义，端点覆盖足够）
      const seg: Box = {
        x0: Math.min(a.x, b.x) - TRAIL_SLOT_HALF, x1: Math.max(a.x, b.x) + TRAIL_SLOT_HALF,
        z0: Math.min(a.z, b.z) - TRAIL_SLOT_HALF, z1: Math.max(a.z, b.z) + TRAIL_SLOT_HALF,
      };
      for (const feature of LANPING_RANGE) {
        if (feature.kind !== 'mountain') continue;
        if ((feature.height ?? 0) < 10) continue;
        const r = Math.max(feature.width ?? 0, feature.depth ?? 0) / 2;
        const box: Box = { x0: feature.x - r, x1: feature.x + r, z0: feature.z - r, z1: feature.z + r };
        assert.ok(
          !boxesInteriorOverlap(seg, box),
          `${feature.id} 包围盒 ${JSON.stringify(box)} 侵入步道段 (${a.x},${a.z})→(${b.x},${b.z})`,
        );
      }
    }
  }
});

function boxesOverlap(a: Box, b: Box): boolean {
  return !(a.x1 < b.x0 || a.x0 > b.x1 || a.z1 < b.z0 || a.z0 > b.z1);
}

/** 正内部相交（接触不算）：仅供「山体 vs 导航区」keep-out（论证见用例注释）。 */
function boxesInteriorOverlap(a: Box, b: Box): boolean {
  return !(a.z1 <= b.z0 || a.z0 >= b.z1 || a.x1 <= b.x0 || a.x0 >= b.x1);
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
    // R2（2026-10-11，方案 §9.2 论证修正）：导航区随出城步道外扩至 z1=104
    // 后，南麓丘二（s-f2，z 152 − r 48 = 104）包围盒北缘与导航边界恰相接
    // （零面积接触）。方案原文「最近为松涛林·南麓盒 z≥125」核对为笔误
    // ——z≥125 是松涛林针叶集群，麓丘链配置契约为 z − r ≥ 100（f2 = 104）。
    // 相接无害的三重依据：①可达域为闭盒 z ≤ 104，山体盒内域 z > 104 不可
    // 达；②massif 在包围盒缘线处高度 ≈ 0（底环贴地渐灭），接触线上无可见
    // 山体；③麓丘 navigationBlocking 已由 roadNavigation.mountainSurfaceBlocked
    // 落实（山面高出可走地面即挡，见 roadNavigation.test.ts）。故本 keep-out 语义
    // 明确为「正内部相交」（boxesInteriorOverlap），边界接触不算进入。
    // v9（2026-10-11）：北线步道把可步行区外框扩入晨溪谷地（z0=-121），
    // 溪谷侧丘/北麓包围盒与「外框」相切或部分重叠属有意布局（sin「山可
    // 探索」——谷地走廊从侧丘间穿过）。大山 vs 步行区的硬契约改为两段：
    // ①城区盒（CITY_NAVIGABLE_AREA，z ≥ -88.2）内无大型山体（本用例）；
    // ②步道走廊本身不被山体包围盒侵入（下一用例「步道走廊净空」）。
    assert.ok(!boxesInteriorOverlap(box, CITY_NAVIGABLE_AREA), `${feature.id} 包围盒 ${JSON.stringify(box)} 进入城区导航可步行区`);
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

test('晨溪连续水面共享地形采样、海内沉没、北步道保持干燥净空', () => {
  const rows = riverWaterRows();
  assert.equal(rows.length, RIVER_SAMPLES.length + 10);
  assert.equal(rows[0]!.extent, 0);
  for (const sample of rows) {
    for (const side of [-1, 0, 1]) {
      const x = sample.x + sample.nx * sample.extent * side;
      const z = sample.z + sample.nz * sample.extent * side;
      assert.ok(Number.isFinite(x) && Number.isFinite(z));
      assert.ok(z <= -89.2);
      if (x <= -45) assert.ok(sample.waterY <= 0.056);
    }
  }
  for (let i = 0; i + 1 < NORTH_TRAIL_NODES.length; i += 1) {
    const a = NORTH_TRAIL_NODES[i]!;
    const b = NORTH_TRAIL_NODES[i + 1]!;
    for (let k = 0; k <= 40; k += 1) {
      const x = a.x + (b.x - a.x) * k / 40;
      const z = a.z + (b.z - a.z) * k / 40;
      assert.equal(riverWaterYAt(x, z), null);
      assert.ok(Number.isFinite(terrainHeight(x, z)));
    }
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

// ── 城缘草甸（v7 城市地面建模）──────────────────────────────────────────

test('城缘草甸包围盒脱开城区导航区/观星走廊/晨溪河谷/河口湾（v7→R2 修订）', () => {
  assert.ok(CITYSIDE_MEADOW.length >= 2, '城缘草甸至少包含南瓣与东北瓣');
  for (const feature of CITYSIDE_MEADOW) {
    assert.equal(feature.kind, 'meadow');
    const w = feature.width ?? 0;
    const d = feature.depth ?? 0;
    const box: Box = { x0: feature.x - w / 2, x1: feature.x + w / 2, z0: feature.z - d / 2, z1: feature.z + d / 2 };
    // R2（方案 §9.2）：导航区已随出城步道扩入南草甸（z1=104，观景可达是
    // 方案目的），keep-out 目标收窄为「城区可走区（旧快照盒 z ≤ 50）不被
    // 草甸包围盒覆盖」——南瓣 z0=56 vs 旧 z1=50，仍脱开。
    assert.ok(!boxesOverlap(box, CITY_NAVIGABLE_AREA), `${feature.id} 包围盒 ${JSON.stringify(box)} 进入城区导航可步行区`);
    assert.ok(!boxesOverlap(box, OBSERVATORY_CORRIDOR), `${feature.id} 包围盒进入观星走廊`);
    assert.ok(!boxesOverlap(box, RIVER_VALLEY_BOX), `${feature.id} 包围盒进入晨溪河谷带`);
    assert.ok(!boxesOverlap(box, ESTUARY_BBOX as unknown as Box), `${feature.id} 包围盒进入河口湾排除盒`);
    assert.ok(box.x0 >= -42, `${feature.id} 西缘 ${box.x0} 不得进入西海滩/海域（岸线 ≈ -43.2）`);
    assert.ok(box.x1 <= 110 && box.z0 >= -110 && box.z1 <= 110, `${feature.id} 外缘必须留在世界地面 ±110 之内`);
  }
});

test('城缘草甸高度场在城区可步行区严格归零（台地平坦，表面零起伏）', () => {
  // 可信地形改造 T2 语义修订（方案 §2.4，论证记录）：
  // 旧断言「y ≤ -0.075 埋地」对应旧场语义（可步行区软塌陷压回埋地基线
  // -0.08）。T2 收编后 sampleCitysideMeadowY = swell × (1 - plateauFlat)
  // ——0 基线正场，台地内严格 0（城区导航盒 ⊂ PLATEAU_MAIN 盒
  // x[-75,78]/z[-90,78]，几何包含可由常量直接验证）。防共面埋地责任
  // 已移至渲染消费端（cityGround.ts：y ≤ 0 区下沉 0.08）。本断言由
  // 「埋地不可见」收紧为「严格归零」——比旧语义更强：任何非零值都是
  // 台地平坦性（治理布局/寻路网格/碰撞的 2D 语义）的破坏。
  // R2（方案 §9.2）：扫描域改城区导航盒（旧快照盒 z ≤ 50）——完整
  // NAVIGABLE_AREA 已随出城步道扩入南草甸（z1=104），草甸段允许起伏，
  // 那是坡度判定（WALKABLE_SLOPE_MAX）的辖区，不属于本审计目标。
  for (let x = CITY_NAVIGABLE_AREA.x0; x <= CITY_NAVIGABLE_AREA.x1; x += 1) {
    for (let z = CITY_NAVIGABLE_AREA.z0; z <= CITY_NAVIGABLE_AREA.z1; z += 1) {
      const y = sampleCitysideMeadowY(CITYSIDE_MEADOW[0]!, x, z);
      assert.ok(
        y === 0,
        `南瓣草甸在城区可步行区 (${x.toFixed(0)}, ${z.toFixed(0)}) 处 y=${y.toFixed(3)} 未严格归零（台地平坦性破坏）`,
      );
    }
  }
});

test('城缘草甸核心区真实隆起（防"全程埋地"式空实现回归）', () => {
  // 南瓣隆起带核心（z 76..96，配置中心附近）必须出现 > 1.2 的草坡；
  // 东北瓣隆起核心（x 82..102, z -97..-104）必须出现 > 0.5 的草坡。
  // R2（方案 §9.2）：采样源改 terrainHeight——场已收编，直接测采样器
  // 才能抓住「聚合接线断裂」（meadow 未进 worldReliefAt）式回归；
  // 阈值承接 v7 现值。步道切槽只切低槽线，不影响核心区峰值断言。
  let southPeak = 0;
  for (let x = -30; x <= 100; x += 2) {
    for (let z = 76; z <= 96; z += 2) {
      southPeak = Math.max(southPeak, terrainHeight(x, z));
    }
  }
  assert.ok(southPeak > 1.2, `南瓣草甸峰值 ${southPeak.toFixed(2)} 过低（应 > 1.2）`);
  let northeastPeak = 0;
  for (let x = 82; x <= 102; x += 2) {
    for (let z = -104; z <= -97; z += 2) {
      northeastPeak = Math.max(northeastPeak, terrainHeight(x, z));
    }
  }
  assert.ok(northeastPeak > 0.5, `东北瓣草甸峰值 ${northeastPeak.toFixed(2)} 过低（应 > 0.5）`);
});

test('WORLD_TERRAIN 聚合包含城缘草甸（新地形必须进世界清单）', () => {
  const ids = new Set(WORLD_TERRAIN.map((feature) => feature.id));
  for (const feature of CITYSIDE_MEADOW) {
    assert.ok(ids.has(feature.id), `${feature.id} 未聚合进 WORLD_TERRAIN`);
  }
});

// ── 年份群岛（T3 'islands' 组，设计 §6.3 审计）─────────────────────────────
// 8 座年份镇（2019 起源村 → 2026 星港）已并入 WORLD_TERRAIN / worldReliefAt
// （岛短路）/ 南海水面守卫（isArchipelagoWaterAt）。本组锁三件事：①恒海
// 判据（岛足印与陆地/自然场永不冲突，台面恒高语义同主城台地）②keep-out
// （岛与岛、岛与主城台地互不侵入）③南海水面与西海条带零重叠。

test('年份群岛恒海判据：3 岛足印（含水下裙）全落恒海区，水面守卫覆盖全部岛缘', () => {
  // 恒海区 = farGround 陆缘公式的恒假区（设计 §2）：南缘 z ≤ 180−18·(1+sin
  // (x/47)) ≤ 180 ⇒ z > 180 恒海；西缘 x ≥ −150+(0.4+12·ss)·(1+sin(z/31)) ≥
  // −149.6 ⇒ x < −150 恒海。足印口径 = 滩环外缘再外伸水下裙（isInsideIsland
  // 的「岛缘」口径）。足印整圆落入恒海区 ⇒ 岛体/滩坡/裙与 farGround 陆网格、
  // 草甸/河谷/海床各自然场零重叠，worldReliefAt 的岛短路永不落在陆地上。
  for (const town of YEAR_ISLAND_SPECS) {
    const outerR = town.beachR + ISLAND_SKIRT_W;
    // 大城体量扩大后足印会越过「z>180 / x<-150」的保守恒海带，但仍在
    // farGround 陆缘 + 下沉带之外；恒海判据以「足印全在水面守卫域内」为准。
    assert.ok(
      town.z > 180 || town.x < -150,
      `${town.label} 岛心未落恒海区（x=${town.x}, z=${town.z}）`,
    );
    // 水侧同口径复核（「先岛后水」的水侧须罩住全部岛）：岛心与足印四向
    // 缘点都在南海水面守卫域内。
    const probes: Array<[number, number]> = [
      [town.x, town.z],
      [town.x - outerR, town.z], [town.x + outerR, town.z],
      [town.x, town.z - outerR], [town.x, town.z + outerR],
    ];
    for (const [x, z] of probes) {
      assert.ok(
        isArchipelagoWaterAt(x, z),
        `${town.label} 岛缘点 (${x.toFixed(1)}, ${z.toFixed(1)}) 不在南海水面守卫域内`,
      );
    }
  }
});

test('年份群岛台面恒高：worldReliefAt 在 3 岛台面内恒等于该岛 topY（语义同主城台地）', () => {
  // 主城台地契约（见 terrainElevation.test：台面内严格 === 0、零起伏）对
  // 年份镇同构：台面内严格 === topY——T5 的镇区布局、T4 的桥/站台落点、
  // 玩家 cursor.y 与相机目标全部直接采样，不允许任何自然场分量（草甸/
  // 河谷/海床切割）漏进岛台。逐镇整圆采样（步 1）+ 岛心处全链 terrainHeight
  // 复核（PLATEAU_BASE_Y 耦合）。
  for (const town of YEAR_ISLAND_SPECS) {
    // 岛缘非正圆：台面范围按该方向的调制半径判定（islandShapeScaleAt）。
    const maxR = town.plateauR * 1.2;
    for (let x = Math.ceil(town.x - maxR); x <= Math.floor(town.x + maxR); x += 1) {
      for (let z = Math.ceil(town.z - maxR); z <= Math.floor(town.z + maxR); z += 1) {
        const dx = x - town.x;
        const dz = z - town.z;
        const k = islandShapeScaleAt(town.shape, Math.atan2(dz, dx));
        if (Math.hypot(dx, dz) > town.plateauR * k) continue;
        // 交通件上盖（月台/桥面）本就高于台面，不属于「台面恒高」口径。
        if (stationPadBlendAt(x, z, town.topY) !== null) continue;
        if (bridgeDeckBlendAt(x, z, town.topY) !== null) continue;
        assert.ok(
          Math.abs(worldReliefAt(x, z) - town.topY) < 1e-9,
          `${town.label} 台面内 (${x}, ${z}) worldReliefAt 应恒为 topY=${town.topY}（语义同主城台地）`,
        );
      }
    }
    assert.ok(
      Math.abs(terrainHeight(town.x, town.z) - town.topY) < 1e-9,
      `${town.label} 岛心 terrainHeight 应为 ${town.topY}`,
    );
  }
});

test('年份群岛 keep-out：3 岛滩足印互不侵入（大城水道 ≥ 13u），不进主城台地', () => {
  // 设计 §3：邻岛中心距 ≥ 57.7、滩环和 ≤ 44 ⇒ 岛间水道 ≥ 13u（T4 环线
  // 桥跨与航道余量）；水下裙（±ISLAND_SKIRT_W=3）不互穿。主城侧：足印
  // 盒与 PLATEAU_MAIN 脱开、镇心距主城中心 ≥ 150（设计 §3 硬约束）。
  for (let i = 0; i < YEAR_ISLAND_SPECS.length; i += 1) {
    for (let j = i + 1; j < YEAR_ISLAND_SPECS.length; j += 1) {
      const a = YEAR_ISLAND_SPECS[i]!;
      const b = YEAR_ISLAND_SPECS[j]!;
      const centerDist = Math.hypot(a.x - b.x, a.z - b.z);
      const channel = centerDist - a.beachR - b.beachR;
      // 启源站紧邻旧港城，保留窄海峡（步行桥/摆渡），其余大城间 ≥13u。
      const narrow = a.id === 'island-2019' || b.id === 'island-2019';
      assert.ok(
        channel >= (narrow ? 8 : 13),
        `${a.label}↔${b.label} 岛间水道 ${channel.toFixed(1)} 过窄`,
      );
      assert.ok(
        centerDist > a.beachR + b.beachR + 2 * ISLAND_SKIRT_W,
        `${a.label}↔${b.label} 水下裙互穿（中心距 ${centerDist.toFixed(1)}）`,
      );
    }
  }
  for (const town of YEAR_ISLAND_SPECS) {
    const outerR = town.beachR + ISLAND_SKIRT_W;
    const disjoint =
      town.x + outerR < PLATEAU_MAIN.x0 || town.x - outerR > PLATEAU_MAIN.x1 ||
      town.z + outerR < PLATEAU_MAIN.z0 || town.z - outerR > PLATEAU_MAIN.z1;
    assert.ok(disjoint, `${town.label} 足印盒侵入主城台地`);
    const centerDist = Math.hypot(town.x, town.z);
    assert.ok(centerDist >= 150, `${town.label} 镇心距主城中心 ${centerDist.toFixed(1)} < 150`);
  }
});

test('南海水面守卫与西海条带零重叠（waterGuard 域口径）', () => {
  // 西海条带（westBeach.ts 现值）：x∈[sX(z)−96, sX(z)]、z∈[−112,112]，是
  // 唯一 Water 几何的一部分（近岸游玩带由既有 westBeach 守卫管辖）。南海
  // 水面（isArchipelagoWaterAt）与之零重叠（设计 §6.1 / sea-archipelago 头
  // 注释契约「z ≤ 112 段与西海条带西缘 sX(z)−96 取小对接，不重叠」）：
  // - 南带 z 向脱开：带内最小 z = 南陆缘−TUCK ≥ 144−12 = 132 > 条带 z 上界 112；
  // - 西臂 x 向让位：z ≤ 112 段东缘 = min(w_edge+2, sX(z)−96) ≤ 条带西缘
  //   （渲染几何 archipelagoWater.ts 同口径对缝至 sX(z)−96，图/守卫两侧
  //   都不把条带内部划进南海管辖——T4 步行守卫不与 westBeach 重复管辖）。
  // 采样条带全域内部（z 步 2、每行 5 点、缘线内缩 0.25 避开零面积搭界），
  // 断言守卫恒 false。
  let bandFloor = Infinity;
  for (let x = SOUTH_SEA.bandXMin; x <= SOUTH_SEA.bandXMax; x += 1) {
    bandFloor = Math.min(bandFloor, southLandEdgeZ(x) - SOUTH_SEA_COAST_TUCK);
  }
  assert.ok(bandFloor > 112, `南带最小 z ${bandFloor.toFixed(1)} 未脱开西海条带 z 上界 112`);
  for (let z = -112; z <= 112; z += 2) {
    const west = shorelineX(z) - 96;
    const east = shorelineX(z);
    for (let k = 0; k <= 4; k += 1) {
      const x = west + 0.25 + (east - west - 0.5) * (k / 4);
      assert.ok(
        !isArchipelagoWaterAt(x, z),
        `南海水面守卫侵入西海条带内部 (x=${x.toFixed(1)}, z=${z})`,
      );
    }
  }
});

test('WORLD_TERRAIN 聚合包含年份群岛 3 岛（新地形必须进世界清单）', () => {
  const ids = new Set(WORLD_TERRAIN.map((feature) => feature.id));
  for (const feature of YEAR_ISLANDS) {
    assert.ok(ids.has(feature.id), `${feature.id} 未聚合进 WORLD_TERRAIN`);
    assert.equal(feature.kind, 'island', `${feature.id} kind 应为 island`);
  }
});
