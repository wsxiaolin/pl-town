import assert from 'node:assert/strict';
import test from 'node:test';
import { TRANSIT_STATION_IDS, SCENE_INTEREST_POINT_IDS } from '../../src/gameplay/world/sceneInteractions';
import { yearTownById } from '../../src/city/data/year-towns/towns';
import { SOUTH_TRAIL_NODES } from '../../src/city/data/terrain/heightfield/worldReliefField';
import {
  BRIDGE_CORRIDOR_HALF,
  BRIDGE_TOWERS,
  BRIDGE_WALK_NODES,
  TRANSIT_MAP_OVERLAY,
  TRANSIT_STATIONS,
  bridgeDeckProfileY,
  buildTransitRoadGraph,
  projectOnBridge,
} from '../../src/city/data/year-towns/transit';

// 年份群岛跨海交通审计（T4a2）：把 transit.ts「唯一事实源」的关键不变量
// 固化成回归——两表一致性（站牌交互 ID ↔ 站点表）、桥/环线几何不变量
// （走线连续、纵断面分段单调、桥塔在走廊内）与海图页 overlay 投影契约。
// 任何改走线、挪站、调纵断面的 PR 都必须先过这里（worldTerrainAudit 同款
// 模式：坐标事实的漂移在这里变红，不在 dev 冒烟里猜）。

test('两表一致性：TRANSIT_STATION_IDS ↔ TRANSIT_STATIONS 站 id 全等', () => {
  const tableIds = new Set(TRANSIT_STATIONS.map((station) => station.id));
  // 站牌注册表里每个 id 都有站点（正向）。
  for (const id of TRANSIT_STATION_IDS) {
    assert.ok(tableIds.has(id), `站牌 ${id} 已注册但站点表缺失`);
  }
  // 站点表里每个站都有站牌（反向，防孤儿站）。
  assert.equal(tableIds.size, TRANSIT_STATION_IDS.length, '站点表存在未注册站牌的站');
  // 站牌交互路由：全部已进 SCENE_INTEREST_POINT_IDS（点站牌走既有路由）。
  const interestIds = new Set<string>(SCENE_INTEREST_POINT_IDS);
  for (const id of TRANSIT_STATION_IDS) {
    assert.ok(interestIds.has(id), `站牌 ${id} 未注册进 SCENE_INTEREST_POINT_IDS`);
  }
});

test('桥走线连续：B 链段长 > 0 且 z 严格递增（南→北不折返）', () => {
  assert.ok(BRIDGE_WALK_NODES.length >= 5, '桥走线节点数异常');
  for (let i = 0; i + 1 < BRIDGE_WALK_NODES.length; i += 1) {
    const a = BRIDGE_WALK_NODES[i]!;
    const b = BRIDGE_WALK_NODES[i + 1]!;
    const len = Math.hypot(b.x - a.x, b.z - a.z);
    assert.ok(len > 1e-6, `桥走线第 ${i} 段退化（长度 ${len}）`);
    assert.ok(b.z > a.z, `桥走线第 ${i} 段 z 折返（${a.z} → ${b.z}）`);
  }
});

test('桥走线首端衔接 S4：B1 引桥段 ≤2.1u，路网首节点挂 S4（挂接点不漂移）', () => {
  const s4 = SOUTH_TRAIL_NODES[SOUTH_TRAIL_NODES.length - 1]!;
  const b1 = BRIDGE_WALK_NODES[0]!;
  // B1 是桥走廊自身起点（S4 北 2u，S4→B1 为引桥段），不与 S4 全等；
  // 真正的全等挂接点是路网图 roadNodes[0]——图工厂显式前置 S4（见下）。
  const approach = Math.hypot(b1.x - s4.x, b1.z - s4.z);
  assert.ok(approach <= 2.1, `B1 (${b1.x},${b1.z}) 距 S4 (${s4.x},${s4.z}) ${approach.toFixed(2)} 超出引桥段上限 2.1`);
  // 路网图 = 走线（buildTransitRoadGraph 桥段节点与 BRIDGE_WALK_NODES 全等）。
  const graph = buildTransitRoadGraph();
  assert.equal(graph.roadNodes[0]![0], s4.x, '路网首节点应为 S4（步道/桥共享节点）');
  assert.equal(graph.roadNodes[0]![1], s4.z, '路网首节点应为 S4（步道/桥共享节点）');
  for (let i = 1; i < BRIDGE_WALK_NODES.length; i += 1) {
    const node = graph.roadNodes[i]!;
    const walk = BRIDGE_WALK_NODES[i - 1]!;
    assert.ok(node[0] === walk.x && node[1] === walk.z, `路网桥段节点 ${i} 与走线漂移`);
  }
});

test('桥面纵断面：分段单调（升-冠平-降-岛平）且断点连续', () => {
  const breakpoints = [98, 112, 150, 193];
  // 断点左右极限一致（closed-form 连续，容差 1e-9）。
  for (const z of breakpoints) {
    const left = bridgeDeckProfileY(z - 1e-6);
    const right = bridgeDeckProfileY(z + 1e-6);
    assert.ok(Math.abs(left - right) < 1e-6, `纵断面在 z=${z} 跳变（${left} → ${right}）`);
  }
  const step = 0.5;
  // S4→冠：单调不降。
  for (let z = 98; z < 112; z += step) {
    assert.ok(bridgeDeckProfileY(z + step) >= bridgeDeckProfileY(z) - 1e-9, `纵断面在升段 z=${z} 回落`);
  }
  // 冠段恒平。
  for (let z = 112; z < 150; z += step) {
    assert.equal(bridgeDeckProfileY(z + step), bridgeDeckProfileY(z), `纵断面冠段 z=${z} 起伏`);
  }
  // 冠→岛台：单调不升。
  for (let z = 150; z < 193; z += step) {
    assert.ok(bridgeDeckProfileY(z + step) <= bridgeDeckProfileY(z) + 1e-9, `纵断面在降段 z=${z} 回升`);
  }
  // 岛台段恒平且 = 起源村 topY（落台无缝）。
  const originTopY = yearTownById('island-2019')!.topY;
  assert.ok(Math.abs(bridgeDeckProfileY(197) - originTopY) < 1e-6, '桥末段未落在起源村台面高');
});

test('桥塔在走廊内（塔基贴走线，不悬在桥面外）', () => {
  for (const tower of BRIDGE_TOWERS) {
    const { dist } = projectOnBridge(tower.x, tower.z);
    assert.ok(
      dist <= BRIDGE_CORRIDOR_HALF,
      `桥塔 (${tower.x},${tower.z}) 距走线 ${dist.toFixed(2)} 超出走廊半宽 ${BRIDGE_CORRIDOR_HALF}`,
    );
  }
});

test('环线闭环：首尾闭合且段长 > 0', () => {
  const loop = TRANSIT_MAP_OVERLAY.ringLoop;
  assert.ok(loop.length >= 10, '环线折线节点数异常');
  const first = loop[0]!;
  const last = loop[loop.length - 1]!;
  assert.ok(Math.abs(first.x - last.x) < 1e-9 && Math.abs(first.z - last.z) < 1e-9, '环线未闭环（首尾不等）');
  for (let i = 0; i + 1 < loop.length; i += 1) {
    const a = loop[i]!;
    const b = loop[i + 1]!;
    const len = Math.hypot(b.x - a.x, b.z - a.z);
    assert.ok(len > 1e-6, `环线第 ${i} 段退化（长度 ${len}）`);
  }
});

test('站点落位：滩环站泊位不出所属镇滩环，星门站镇守主城南桥头（设计 §5.2 站点表）', () => {
  const s4 = SOUTH_TRAIL_NODES[SOUTH_TRAIL_NODES.length - 1]!;
  for (const station of TRANSIT_STATIONS) {
    const town = yearTownById(station.townId);
    assert.ok(town, `站 ${station.id} 指向未知镇 ${station.townId}`);
    if (station.line === 'ring' || station.id === 'station-2019-bridge') {
      // 滩环不变量：环线各站＋起源村桥站，泊位都在所属镇滩环内。
      const dist = Math.hypot(station.x - town!.x, station.z - town!.z);
      assert.ok(
        dist <= town!.beachR,
        `站 ${station.id} 距 ${station.townId} 中心 ${dist.toFixed(1)} 超出滩环 ${town!.beachR}`,
      );
    } else if (station.id === 'station-stargate') {
      // 星门站＝星门线起点、主城南桥头广场（接 S4），刻意在所有镇滩环之外
      // （设计 §5.2 站点表）——落位语义＝桥头：距 S4 观景平台 ≤6（实际 ≈5.39）。
      const dist = Math.hypot(station.x - s4.x, station.z - s4.z);
      assert.ok(
        dist <= 6,
        `星门站 (${station.x},${station.z}) 距 S4 桥头 (${s4.x},${s4.z}) ${dist.toFixed(2)} 超出桥头广场半径 6`,
      );
    } else {
      assert.fail(`站 ${station.id} 落位规则未归类（滩环/桥头二选一）`);
    }
  }
});

test('海图 overlay 契约：9 圆点/星门线=桥走线/环线闭环同源', () => {
  const dots = TRANSIT_MAP_OVERLAY.stations;
  assert.equal(dots.length, 9, '海图站圆点应为 9 个（10 泊位合并起源村两泊位）');
  const dotIds = new Set(dots.map((dot) => dot.id));
  assert.equal(dotIds.size, dots.length, '海图站圆点 id 重复');
  const stationById = new Map<string, (typeof TRANSIT_STATIONS)[number]>(TRANSIT_STATIONS.map((station) => [station.id, station]));
  for (const dot of dots) {
    if (dot.id === 'station-2019') {
      // 枢纽合并点：村主街上两泊位（桥站 197 / 环线站 212）之间，x 与
      // 起源村中心同轴（设计 §5.2「合并起源村两泊位 → 枢纽一点」）。
      const bridge = stationById.get('station-2019-bridge')!;
      const ring = stationById.get('station-2019-ring')!;
      assert.equal(dot.x, bridge.x, '枢纽圆点应在村主街轴上（x 与桥站同轴）');
      assert.ok(dot.z > Math.min(bridge.z, ring.z) && dot.z < Math.max(bridge.z, ring.z), '枢纽圆点应在两泊位之间');
      continue;
    }
    const station = stationById.get(dot.id);
    assert.ok(station, `海图圆点 ${dot.id} 无对应站点`);
    assert.ok(Math.abs(dot.x - station!.x) < 1e-9 && Math.abs(dot.z - station!.z) < 1e-9, `圆点 ${dot.id} 与站点坐标漂移`);
  }
  // 线路描线同源：星门线 = 桥走线、环线 = 闭环折线（mapController 只投影不改形）。
  assert.equal(TRANSIT_MAP_OVERLAY.stargateLine.length, BRIDGE_WALK_NODES.length, '星门线节点数与桥走线不一致');
  for (let i = 0; i < BRIDGE_WALK_NODES.length; i += 1) {
    const a = TRANSIT_MAP_OVERLAY.stargateLine[i]!;
    const b = BRIDGE_WALK_NODES[i]!;
    assert.ok(Math.abs(a.x - b.x) < 1e-9 && Math.abs(a.z - b.z) < 1e-9, `星门线第 ${i} 点与桥走线漂移`);
  }
  const ringLoop = TRANSIT_MAP_OVERLAY.ringLoop;
  const first = ringLoop[0]!;
  const last = ringLoop[ringLoop.length - 1]!;
  assert.ok(Math.abs(first.x - last.x) < 1e-9 && Math.abs(first.z - last.z) < 1e-9, 'overlay 环线未闭环');
});
