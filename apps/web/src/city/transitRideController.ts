import type { Object3D } from 'three';
import type { CityDialogController, StoryDialogModel } from '../adapters/ui/cityDialogController';
import type { TransitStationId } from '../gameplay/world/sceneInteractions';
import {
  TRANSIT_STATIONS,
  buildTransitRoute,
  ringStationSpeedFactor,
  stationById,
  type TransitRoute,
  type TransitStationSpec,
} from './data/year-towns/transit';
import { transitGroundY } from './data/terrain/heightfield/transitGround';

// transitRideController —— 年份群岛乘车控制器（T4b-c3，docs/t4b-ride-plan.md
// §2 新增③；站表见 docs/year-towns-design.md §5.2）。
//
// 契约：
// - interact：站牌 interact → openStory 目地面板（10 站全列、当前站标记、
//   带镇作品数摘要）→ 选目的地 → dismissNpc（静默收起，不触发 onClose 结算，
//   与 paintingAiStudio 同款）→ startRide。乘 X 关闭面板则什么都不发生。
// - update：沿 buildTransitRoute 弧长推进 s，速度 v = 18 ×
//   ringStationSpeedFactor(x, z)（站周 4u 内减速到 0.35，≥14u 全速）；
//   cursor 逐帧贴走线（含段间 y 插值），朝向取段切向（atan2 口径同
//   playerController 路径行走）。到站落点 = (platformX, transitGroundY(
//   platformX, platformZ), platformZ)——c1 探针已核验 10 站该值恒等 baseY。
// - 防重复派发：riding / panel 任一在途时 interact 不再开新面板、
//   startRide 不再发车（返回 false）。
// - onManualStart 取消：外部（c4 接线 MiniCityApp 的 movementInput
//   onManualStart）调 cancel() 即中途下车，cursor 停在当前走线点。
// - 走线/站表唯一事实源：city/data/year-towns/transit.ts（本文件零坐标
//   重写）；落点 y 取 transitGroundY（高度场收口 c1 产物）。
// - 零渲染副作用：不建第二个 WebGL 上下文、不碰场景树（站牌 mesh 归
//   transitStationSigns，镜头跟随复用 playerController.updateCamera 对
//   cursor 的每帧 setCameraTarget）。
// - frameLoop 挂法：updateTransitRide（c4 接线，updateMovement 之后）；
//   乘车期间每帧 clearPlayerPath，防止点击寻路与推进抢 cursor。
//
// 调试面（c4 ⑧ debugApi._mini.transit 消费）：interact / startRide /
// state / history；c5 单测消费：update + state + history + cancel。

/** 干线巡航速度（方案 §2③：v = 18 × 站周减速因子）。 */
export const TRANSIT_RIDE_SPEED = 18;

/** 帧时长上限（对齐 yearTownTransit.MAX_FRAME_DT，掉帧时防跳站）。 */
const MAX_RIDE_FRAME_DT = 0.12;

/** history 滚动窗口（debugApi 只看最近几程，防无限增长）。 */
const RIDE_HISTORY_LIMIT = 8;

export type TransitRidePort = Pick<CityDialogController, 'openStory' | 'dismissNpc'>;

export interface TransitRideControllerOptions {
  getCursorChar: () => Object3D | null;
  getDialogs: () => TransitRidePort | null;
  /** 乘车期间停掉点击寻路（MiniCityApp 接 view.clearPlayerPath，防抢 cursor）。 */
  clearPlayerPath?: () => void;
  showToast?: (message: string) => void;
}

export interface TransitRideArrival {
  readonly x: number;
  readonly y: number;
  readonly z: number;
}

/** 一程乘车记录（到站后写入 history，c6 冒烟断言落点用）。 */
export interface TransitRideRecord {
  readonly fromId: string;
  readonly toId: string;
  /** 行程弧长（走线单位）。 */
  readonly distance: number;
  /** 行程耗时（秒）。 */
  readonly seconds: number;
  readonly arrival: TransitRideArrival;
  readonly arrivedAtMs: number;
}

export type TransitRidePhase = 'idle' | 'panel' | 'riding';

export interface TransitRideState {
  readonly phase: TransitRidePhase;
  readonly panelStationId: string | null;
  readonly fromId: string | null;
  readonly toId: string | null;
  readonly s: number | null;
  readonly length: number | null;
  /** 当前帧速度（已乘站周减速因子）。 */
  readonly speed: number | null;
  readonly x: number | null;
  readonly y: number | null;
  readonly z: number | null;
}

export interface TransitRideController {
  /** 站牌 interact 入口：开目的地面板。返回是否由本控制器处理。 */
  interact(id: TransitStationId): boolean;
  /** 直接发车（debugApi / 单测入口）。返回是否成功派发。 */
  startRide(fromId: string, toId: string): boolean;
  /** 逐帧推进（frameLoop.updateTransitRide，delta 为秒）。 */
  update(deltaSeconds: number): void;
  isRiding(): boolean;
  /** 中途下车（c4 接 movementInput.onManualStart）。 */
  cancel(): void;
  state(): TransitRideState;
  history(): readonly TransitRideRecord[];
}

interface RideState {
  readonly route: TransitRoute;
  readonly fromId: TransitStationId;
  readonly toId: TransitStationId;
  readonly startedAtMs: number;
  s: number;
}

export interface TransitRouteSample {
  x: number;
  y: number;
  z: number;
  /** 单位切向（沿前进方向）。 */
  tx: number;
  tz: number;
}

const LINE_ROLE: Record<TransitStationSpec['line'], string> = {
  stargate: '星门线 · 干线电车',
  ring: '群岛环线 · 磁悬浮',
};

/** 弧长采样：二分定位段，线性插值 x/y/z，切向取段方向（纯函数、确定性）。 */
export function sampleTransitRoute(route: TransitRoute, s: number, out: TransitRouteSample): TransitRouteSample {
  const points = route.points;
  const last = points[points.length - 1];
  if (!last) {
    out.x = 0; out.y = 0; out.z = 0; out.tx = 0; out.tz = 1;
    return out;
  }
  const clamped = Math.min(Math.max(s, 0), route.length);
  let lo = 0;
  let hi = points.length - 1;
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if ((points[mid] ?? last).s <= clamped) lo = mid;
    else hi = mid;
  }
  const a = points[lo] ?? last;
  const b = points[hi] ?? last;
  const span = b.s - a.s;
  const t = span > 1e-9 ? Math.min(1, Math.max(0, (clamped - a.s) / span)) : 0;
  out.x = a.x + (b.x - a.x) * t;
  out.y = a.y + (b.y - a.y) * t;
  out.z = a.z + (b.z - a.z) * t;
  const dx = b.x - a.x;
  const dz = b.z - a.z;
  const length = Math.hypot(dx, dz);
  if (length > 1e-9) {
    out.tx = dx / length;
    out.tz = dz / length;
  } else {
    out.tx = 0;
    out.tz = 1;
  }
  return out;
}

const destinationOptionText = (station: TransitStationSpec): string =>
  `${station.name}（${station.works} 篇作品）`;

export function createTransitRideController(options: TransitRideControllerOptions): TransitRideController {
  const sample: TransitRouteSample = { x: 0, y: 0, z: 0, tx: 0, tz: 1 };
  let ride: RideState | null = null;
  let panelStationId: TransitStationId | null = null;
  const records: TransitRideRecord[] = [];

  function finishRide(): void {
    const current = ride;
    if (!current) return;
    const station = stationById(current.toId);
    ride = null;
    const cursor = options.getCursorChar();
    if (!station || !cursor) return;
    // 到站落点：月台中心，y 取 transitGroundY 精确基准面（= baseY，c1 探针核验）。
    const arrivalY = transitGroundY(station.platformX, station.platformZ);
    cursor.position.set(station.platformX, arrivalY, station.platformZ);
    records.push({
      fromId: current.fromId,
      toId: current.toId,
      distance: current.route.length,
      seconds: (performance.now() - current.startedAtMs) / 1000,
      arrival: { x: station.platformX, y: arrivalY, z: station.platformZ },
      arrivedAtMs: performance.now(),
    });
    if (records.length > RIDE_HISTORY_LIMIT) records.splice(0, records.length - RIDE_HISTORY_LIMIT);
    options.showToast?.(`已抵达${station.name}`);
  }

  function openDestinationPanel(station: TransitStationSpec): void {
    const dialogs = options.getDialogs();
    if (!dialogs) return;
    const story: StoryDialogModel = {
      title: station.name,
      role: LINE_ROLE[station.line],
      text: '站台广播：请选择目的地。列车沿途减速过站，抵达后停靠月台。',
      options: TRANSIT_STATIONS.map((destination) => ({
        text: destination.id === station.id ? `${station.name}（当前站）` : destinationOptionText(destination),
        onPick: () => {
          if (destination.id === station.id) {
            options.showToast?.('你已在本站。');
            return;
          }
          // dismissNpc：静默收面板，不触发 onClose（结算钩子不复用，见契约头注）。
          dialogs.dismissNpc();
          if (panelStationId === station.id) panelStationId = null;
          startRide(station.id, destination.id);
        },
      })),
      onClose: () => {
        if (panelStationId === station.id) panelStationId = null;
      },
    };
    dialogs.openStory(story);
  }

  function startRide(fromId: string, toId: string): boolean {
    if (ride) return false; // 防重复派发：列车已在途
    const route = buildTransitRoute(fromId, toId);
    if (!route) return false; // 未知站 / 同站 / 无走线
    if (!options.getCursorChar()) return false;
    ride = {
      route,
      fromId: route.fromId,
      toId: route.toId,
      startedAtMs: performance.now(),
      s: 0,
    };
    options.clearPlayerPath?.();
    return true;
  }

  return {
    interact(id) {
      const station = stationById(id);
      if (!station) return false;
      if (ride) {
        options.showToast?.('列车行驶中，抵达后再换乘。');
        return true;
      }
      if (panelStationId) return true; // 防重复派发：面板已开（含另一站的直接调用）
      panelStationId = station.id;
      openDestinationPanel(station);
      return true;
    },
    startRide,
    update(deltaSeconds) {
      const current = ride;
      if (!current) return;
      const cursor = options.getCursorChar();
      if (!cursor) {
        ride = null; // 场景已拆除：静默结束，不落点不记账
        return;
      }
      // 乘车期间每帧清点击寻路（onCanvasClick 可能中途设 path，防与推进抢 cursor）。
      options.clearPlayerPath?.();
      const dt = Math.min(Math.max(deltaSeconds, 0), MAX_RIDE_FRAME_DT);
      sampleTransitRoute(current.route, current.s, sample);
      const speed = TRANSIT_RIDE_SPEED * ringStationSpeedFactor(sample.x, sample.z);
      current.s = Math.min(current.s + speed * dt, current.route.length);
      sampleTransitRoute(current.route, current.s, sample);
      cursor.position.set(sample.x, sample.y, sample.z);
      // 朝向口径同 playerController 路径行走：atan2(dx, dz)。
      cursor.rotation.y = Math.atan2(sample.tx, sample.tz);
      if (current.s >= current.route.length) finishRide();
    },
    isRiding: () => ride !== null,
    cancel() {
      ride = null; // 中途下车：cursor 停在当前走线点（无落点、不记账）
      panelStationId = null; // 面板态一并复位，避免 state() 残留旧站
    },
    state() {
      if (ride) {
        sampleTransitRoute(ride.route, ride.s, sample);
        const speed = TRANSIT_RIDE_SPEED * ringStationSpeedFactor(sample.x, sample.z);
        return {
          phase: 'riding' as const,
          panelStationId: panelStationId as TransitStationId | null,
          fromId: ride.fromId as string,
          toId: ride.toId as string,
          s: ride.s,
          length: ride.route.length,
          speed,
          x: sample.x,
          y: sample.y,
          z: sample.z,
        };
      }
      return {
        phase: (panelStationId ? 'panel' : 'idle') as TransitRidePhase,
        panelStationId: panelStationId as TransitStationId | null,
        fromId: null,
        toId: null,
        s: null,
        length: null,
        speed: null,
        x: null,
        y: null,
        z: null,
      };
    },
    history: () => records,
  };
}
