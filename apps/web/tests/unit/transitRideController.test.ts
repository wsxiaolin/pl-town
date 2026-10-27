import assert from 'node:assert/strict';
import test from 'node:test';
import type { Object3D } from 'three';
import { createTransitRideController, TRANSIT_RIDE_SPEED, type TransitRideController } from '../../src/city/transitRideController';
import {
  TRANSIT_STATIONS,
  buildTransitRoute,
  ringStationSpeedFactor,
  stationById,
} from '../../src/city/data/year-towns/transit';
import { transitGroundY } from '../../src/city/data/terrain/heightfield/transitGround';
import type { TransitStationId } from '../../src/gameplay/world/sceneInteractions';

// 乘车控制器单测（T4b-c5，docs/t4b-ride-plan.md §4）：把 transitRideController
// 的四条核心行为固化成回归——弧长推进单调（s 逐帧严格递增、永不越走线长）、
// 站周减速语义（ringStationSpeedFactor 泊位处恒 0.35 → v=6.3，远离泊位全速
// 18）、到站落点精确链（cursor = (platformX, transitGroundY(platform),
// platformZ) 且 transitGroundY(月台)=baseY，10 站全等 <1e-6）、取消语义
// （onManualStart 中断乘车：不落点、不记账，取消后可重新派发）。
// 数值口径均经 npx tsx 探针核实（c3 交接探针 + 本棒复测：10 站 delta=0、
// 18*0.35===6.3 与远区 speed===18 皆为精确浮点相等），勿放宽也勿拍脑收紧。

/** Object3D 结构子集测试替身：控制器只消费 position.set / rotation.y。 */
interface FakeCursorPosition {
  x: number;
  y: number;
  z: number;
  set(x: number, y: number, z: number): void;
}

interface FakeCursor {
  readonly position: FakeCursorPosition;
  readonly rotation: { y: number };
  visible: boolean;
}

function makeFakeCursor(): FakeCursor {
  const position: FakeCursorPosition = {
    x: 0,
    y: 0,
    z: 0,
    set(x: number, y: number, z: number): void {
      this.x = x;
      this.y = y;
      this.z = z;
    },
  };
  return { position, rotation: { y: 0 }, visible: true };
}

/** 乘车测试台：假 cursor + 空对话框端口（startRide 直发，不开目的地面板）。 */
function makeRideHarness(): { cursor: FakeCursor; controller: TransitRideController; vehicles: { line: string; x: number; z: number }[] } {
  const cursor = makeFakeCursor();
  cursor.visible = true;
  const vehicles: { line: string; x: number; z: number }[] = [];
  const controller = createTransitRideController({
    getCursorChar: () => cursor as unknown as Object3D,
    getDialogs: () => null,
    setRideVehicle: (line, x, _y, z) => { vehicles.push({ line, x, z }); },
    endRide: () => undefined,
  });
  return { cursor, controller, vehicles };
}

/** 帧数上限保险：全程乘车 @dt=1/60 实测 1520 帧，上限放宽到 5000。 */
const FRAME_CAP = 5000;

test('弧长推进单调：s 逐帧严格递增且不越走线长，走完回 idle 并记账一程', () => {
  const { controller } = makeRideHarness();
  assert.equal(controller.startRide('station-stargate', 'station-2022'), true, '合法行程应派发成功');
  const length = controller.state().length;
  assert.ok(length !== null && length > 0, '在途 state 应带走线长');
  // 混线行程（星门线→枢纽街→环线，switchS=125.7）：单调性必须全程成立。
  let prev = 0; // startRide 后 s = 0
  let frames = 0;
  while (controller.isRiding()) {
    frames += 1;
    assert.ok(frames <= FRAME_CAP, `乘车帧数超上限（疑似不推进/死循环，已 ${frames} 帧）`);
    controller.update(1 / 60);
    const snap = controller.state();
    if (snap.phase === 'riding') {
      assert.ok(snap.s! > prev, `第 ${frames} 帧弧长未推进（s ${prev} → ${snap.s}）`);
      assert.ok(snap.s! <= length!, `第 ${frames} 帧弧长越界（s=${snap.s} > 走线长 ${length}）`);
      prev = snap.s!;
    }
  }
  assert.ok(frames > 0, '至少推进过一帧');
  assert.equal(controller.state().phase, 'idle', '走完后应回 idle');
  assert.equal(controller.history().length, 1, '走完应记账恰好一程');
});

test('乘车过场由车辆驱动：全程可见车辆、玩家作为乘客隐藏，混线在枢纽换车', () => {
  const { cursor, controller, vehicles } = makeRideHarness();
  assert.equal(controller.startRide('station-stargate', 'station-2022'), true);
  assert.deepEqual(vehicles.map((vehicle) => vehicle.line), ['stargate'], '发车第一帧应有电车');
  let frames = 0;
  while (controller.isRiding()) {
    controller.update(1 / 60);
    frames += 1;
    assert.ok(frames <= FRAME_CAP);
    if (controller.isRiding()) assert.equal(cursor.visible, false, '过场期间角色应位于车厢内，不在道路上奔跑');
    const state = controller.state();
    const vehicle = vehicles.at(-1)!;
    if (state.phase === 'riding') {
      const cursorPosition = (cursor as FakeCursor).position;
      assert.ok(Math.hypot(vehicle.x - cursorPosition.x, vehicle.z - cursorPosition.z) < 1e-9, '车辆与乘客应随同一车辆坐标移动');
    }
  }
  assert.ok(vehicles.some((vehicle) => vehicle.line === 'ring'), '跨线后应切换磁悬车');
  assert.equal(cursor.visible, true, '到站应恢复角色');
});

test('站周减速语义：泊位处因子恒 0.35（v=6.3），远离泊位（≥14u）全速 18', () => {
  // 数据层：每座环线泊位上的减速因子精确 0.35（smoothStep01 负参钳 0，
  // 0.35 + 0.65*0 = 0.35 为精确浮点值，探针核实）。
  const berths = TRANSIT_STATIONS.filter((station) => station.line === 'ring');
  assert.ok(berths.length > 0, '环线泊位表为空');
  for (const station of berths) {
    assert.equal(ringStationSpeedFactor(station.x, station.z), 0.35, `站 ${station.id} 泊位减速因子应为 0.35`);
  }
  // 行为层：从环线站发车，起点即泊位 → state.speed = 18 × 0.35 = 6.3（精确）。
  const { controller } = makeRideHarness();
  assert.equal(controller.startRide('station-2025', 'station-2026'), true);
  const start = controller.state();
  assert.equal(start.phase, 'riding');
  assert.equal(start.speed, TRANSIT_RIDE_SPEED * 0.35, '泊位发车速度应为 6.3（18 × 0.35）');
  // 推进到行程中点（两侧泊位各 ~59u，远离全部泊位 ≥14u）→ 全速 18（精确）。
  const length = start.length!;
  let guard = 0;
  while (controller.isRiding() && controller.state().s! < length / 2) {
    guard += 1;
    assert.ok(guard <= FRAME_CAP, '中途推进帧数超上限');
    controller.update(0.12);
  }
  const mid = controller.state();
  assert.equal(mid.phase, 'riding', '中点应仍在途');
  assert.equal(mid.speed, 18, `远离泊位应全速 18（实测 ${mid.speed}）`);
  controller.cancel();
});

test('无效站 id：interact/startRide 均拒绝且不进入乘车态', () => {
  const { controller } = makeRideHarness();
  assert.equal(controller.interact('not-a-station' as TransitStationId), false, '未知站牌不应开面板');
  assert.equal(controller.startRide('not-a-station', 'station-2020'), false, '未知出发站不应派发');
  assert.equal(controller.startRide('station-2020', 'not-a-station'), false, '未知目的站不应派发');
  assert.equal(controller.state().phase, 'idle');
});

test('到站落点：transitGroundY(月台) = baseY（10 站 <1e-6），全程乘车 cursor 精确落月台三坐标', () => {
  // 数据层审计：10 站月台中心的 transitGroundY 与 baseY 全等（c1 收口后
  // 探针实测 10 站 delta 全为 0，含星门月台；此处锁 <1e-6 契约上限）。
  for (const station of TRANSIT_STATIONS) {
    const y = transitGroundY(station.platformX, station.platformZ);
    assert.ok(
      Math.abs(y - station.baseY) < 1e-6,
      `站 ${station.id} 月台基准面漂移（transitGroundY=${y} vs baseY=${station.baseY}）`,
    );
  }
  // 行为层：完整一程 stargate → 2022（混线，len=356.3），到站 cursor 落
  // (platformX, transitGroundY(platform), platformZ)，三坐标与月台中心吻合。
  const { cursor, controller } = makeRideHarness();
  assert.equal(controller.startRide('station-stargate', 'station-2022'), true);
  let frames = 0;
  while (controller.isRiding()) {
    frames += 1;
    assert.ok(frames <= FRAME_CAP, `乘车帧数超上限（已 ${frames} 帧）`);
    controller.update(1 / 60);
  }
  const dest = stationById('station-2022')!;
  assert.ok(Math.abs(cursor.position.x - dest.platformX) < 1e-6, `落点 x 漂移（${cursor.position.x} vs ${dest.platformX}）`);
  assert.ok(Math.abs(cursor.position.y - dest.baseY) < 1e-6, `落点 y 漂移（${cursor.position.y} vs baseY ${dest.baseY}）`);
  assert.ok(Math.abs(cursor.position.z - dest.platformZ) < 1e-6, `落点 z 漂移（${cursor.position.z} vs ${dest.platformZ}）`);
  // 记账链：一程记录，from/to 正确，distance = 走线弧长，arrival 三坐标
  // 与 cursor 落点一致（同源数值，deepEqual 精确）。
  const history = controller.history();
  assert.equal(history.length, 1, '到站应记账恰好一程');
  const record = history[0]!;
  assert.equal(record.fromId, 'station-stargate');
  assert.equal(record.toId, 'station-2022');
  assert.equal(record.distance, buildTransitRoute('station-stargate', 'station-2022')!.length, '行程弧长应等于走线长');
  assert.deepEqual(record.arrival, { x: dest.platformX, y: dest.baseY, z: dest.platformZ });
  assert.equal(controller.state().phase, 'idle', '到站后应回 idle');
});

test('取消（onManualStart 中断乘车）：立即停乘不落点不记账，cursor 停在当前走线点，取消后可重新派发', () => {
  const { cursor, controller } = makeRideHarness();
  assert.equal(controller.startRide('station-stargate', 'station-2022'), true);
  for (let i = 0; i < 30; i += 1) controller.update(1 / 60);
  const length = controller.state().length!;
  const sBefore = controller.state().s!;
  const posBefore = { x: cursor.position.x, y: cursor.position.y, z: cursor.position.z };
  assert.ok(sBefore > 0 && sBefore < length, `取消前应在中途（s=${sBefore} / ${length}）`);
  controller.cancel(); // MiniCityApp movementInput.onManualStart 接这里
  assert.equal(controller.isRiding(), false, 'cancel 后应立即停乘');
  assert.equal(controller.state().phase, 'idle');
  assert.equal(controller.history().length, 0, '中途下车不应写行程记录');
  // cursor 停在当前走线点：cancel 不瞬移、不落月台（三坐标原地不动）。
  assert.equal(cursor.position.x, posBefore.x, 'cancel 不应移动 cursor.x');
  assert.equal(cursor.position.y, posBefore.y, 'cancel 不应移动 cursor.y');
  assert.equal(cursor.position.z, posBefore.z, 'cancel 不应移动 cursor.z');
  // 重入语义：取消后乘车状态确实清空 → 可重新派发；对照在途时再派发被拒。
  assert.equal(controller.startRide('station-2020', 'station-2026'), true, '取消后应可重新派发');
  assert.equal(controller.state().phase, 'riding');
  assert.equal(controller.startRide('station-2021', 'station-2022'), false, '在途时重复派发应被拒（防重复派发）');
  // 空闲时 cancel 是安全 no-op。
  controller.cancel();
  assert.equal(controller.state().phase, 'idle');
});

test('取消面板态：interact 开目的地面板后 cancel 清空 panelStationId，不留陈旧 state', () => {
  const cursor = makeFakeCursor();
  const controller = createTransitRideController({
    getCursorChar: () => cursor as unknown as Object3D,
    getDialogs: () => ({ openStory: () => undefined, dismissNpc: () => undefined }),
  });
  assert.equal(controller.interact('station-stargate' as TransitStationId), true);
  const opened = controller.state();
  assert.equal(opened.phase, 'panel');
  assert.equal(opened.panelStationId, 'station-stargate');
  controller.cancel();
  const cancelled = controller.state();
  assert.equal(cancelled.phase, 'idle', 'cancel 后面板态应复位为 idle');
  assert.equal(cancelled.panelStationId, null, 'cancel 后不应残留旧站 id');
});
