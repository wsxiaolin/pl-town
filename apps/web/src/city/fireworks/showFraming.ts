// 观景取景计算（纯模块）：按「下一幕真正要放的设计」算出相机注视点与
// 正交缩放，让开爆高度 24–90、发射角 0–18° 尽量都留在画面内。
//
// 为什么需要动态取景：相机俯角约 49.6°（CAMERA_OFFSET=(24,40,24)），纵向
// 世界位移在屏幕上被放大，固定 zoom 无法同时兼顾「船要看得见」和
// 「90 高 + 18° 斜射的爆点不出画」。实测固定 zoom 时：按典型设计取景
// （zoom≈45）极端设计会溢出 1.5 屏宽；要让极端设计入画则 zoom 要 ≈90，
// 船只剩 1.8% 屏宽。因此每幕按当前设计重新取景。
//
// 约束：cameraController 每帧把 target.y 归到地形高度，所以这里只解
// targetX/targetZ 与 zoom，并显式调用 terrainHeight 复算同一个注视高度。
import { CAMERA_OFFSET } from '../data/cityConfig';
import { terrainHeight } from '../data/terrain/heightfield/terrainHeight';
import {
  BASE_BURST_RADIUS,
  burstRadius,
  planShell,
  shellPosition,
  type ShellPlan,
} from './fireworksPhysics';
import type { FireworkDesign } from './fireworksDesign';
import {
  buildFireworkMortars,
  type FireworkMortar,
} from './fireworksMortars';

export type ShowOrigin = {
  x: number;
  z: number;
  mortar: FireworkMortar;
  plan: ShellPlan;
};

export type ShowFraming = {
  targetX: number;
  targetZ: number;
  /** 正交半高。 */
  zoom: number;
  /** 本幕的实际发射点（与引擎 launch 使用同一炮口）。 */
  origins: ShowOrigin[];
};

type Vec = { x: number; y: number; z: number };

/** 画面四周留白系数。 */
const MARGIN = 1.08;
const MIN_ZOOM = 18;
const MAX_ZOOM = 150;
/**
 * 注视点活动范围：镜头不必为了极高/极斜的爆点漂到离海域很远的海面，
 * 否则画面里只剩空海。超出范围时靠放大 zoom 把锚点收回画面。
 */
const TARGET_X_RANGE: readonly [number, number] = [-140, -40];
const TARGET_Z_RANGE: readonly [number, number] = [-42, 12];
/**
 * 屏底 HUD（幕次 / 曲目 / 退出按钮）占用的纵向空间，单位是 NDC（整屏 -1..1）。
 * 约等于 12% 屏高；内容下沿不得低于 -1 + BOTTOM_RESERVE。
 */
const BOTTOM_RESERVE = 0.24;
/** 爆裂云采样：球心 + 六轴向极值，近似包围球。 */
const EDGE_AXES: ReadonlyArray<readonly [number, number, number]> = [
  [0, 0, 0], [1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1],
];
/** 甲板半尺寸（含栏杆留白），用于把船体框进画面。 */
const BARGE_CORNERS: ReadonlyArray<readonly [number, number]> = [
  [-2.6, -1.6], [2.6, -1.6], [-2.6, 1.6], [2.6, 1.6],
];

const dot = (a: Vec, b: Vec): number => a.x * b.x + a.y * b.y + a.z * b.z;
const scale = (a: Vec, k: number): Vec => ({ x: a.x * k, y: a.y * k, z: a.z * k });
const cross = (a: Vec, b: Vec): Vec => ({
  x: a.y * b.z - a.z * b.y,
  y: a.z * b.x - a.x * b.z,
  z: a.x * b.y - a.y * b.x,
});
const normalize = (a: Vec): Vec => {
  const length = Math.hypot(a.x, a.y, a.z) || 1;
  return { x: a.x / length, y: a.y / length, z: a.z / length };
};

const OFFSET: Vec = { x: CAMERA_OFFSET.x, y: CAMERA_OFFSET.y, z: CAMERA_OFFSET.z };
/** 相机基向量：正交相机 + 固定偏移，与 cameraController 完全一致。 */
const FORWARD = normalize(scale(OFFSET, -1));
const RIGHT = normalize(cross(FORWARD, { x: 0, y: 1, z: 0 }));
const UP = normalize(cross(RIGHT, FORWARD));

/** 观景秀给同一幕不同成员的高度抖动上限（与引擎 launch 的 targetYJitter 一致）。 */
export const SHOW_TARGET_Y_JITTER = 3;

/**
 * 本幕发射点：从九根炮管里按 seed 选出互不重复的 count 根，尽量分散在
 * 三艘船上（成员同幕各自独立升空，不会从同一根管里叠着出来）。
 */
export function planShowOrigins(
  designs: readonly FireworkDesign[],
  actSeed: number,
): ShowOrigin[] {
  const mortars = buildFireworkMortars();
  const offset = Math.abs(Math.floor(actSeed)) % mortars.length;
  return designs.map((design, index) => {
    const mortar = mortars[(offset + Math.floor((index * mortars.length) / designs.length)) % mortars.length]!;
    const height = Math.min(90, design.height + SHOW_TARGET_Y_JITTER);
    return {
      x: mortar.x,
      z: mortar.z,
      mortar,
      plan: planShell({ ...design, height }, mortar.heading, mortar.y),
    };
  });
}

/**
 * 画面里必须出现的采样点：本幕实际用到的炮口与船体、升空段端点、爆裂云外沿。
 * 升空段是两点间的直线（正交投影下仍留在端点凸包内），故只取爆点即可。
 */
function collectAnchors(designs: readonly FireworkDesign[], origins: readonly ShowOrigin[]): Vec[] {
  const anchors: Vec[] = [];
  const usedBarges = new Set<string>();
  for (const origin of origins) {
    anchors.push({ x: origin.mortar.x, y: origin.mortar.y - 1.1, z: origin.mortar.z });
    anchors.push({ x: origin.mortar.x, y: origin.mortar.y + 2.6, z: origin.mortar.z });
    // 甲板四角：船体本身也要在画面里，取样略大于 4.8×2.7 的甲板。
    const bargeKey = `${origin.mortar.x.toFixed(1)}:${origin.mortar.z.toFixed(1)}`;
    if (!usedBarges.has(bargeKey)) {
      usedBarges.add(bargeKey);
      for (const [dx, dz] of BARGE_CORNERS) {
        anchors.push({ x: origin.mortar.x + dx, y: 0.16, z: origin.mortar.z + dz });
        anchors.push({ x: origin.mortar.x + dx, y: origin.mortar.y + 2.2, z: origin.mortar.z + dz });
      }
    }
  }
  for (let i = 0; i < designs.length; i += 1) {
    const origin = origins[i]!;
    const radius = Math.max(BASE_BURST_RADIUS * 0.6, burstRadius(designs[i]!));
    const burst = shellPosition(origin.plan, origin.mortar, origin.plan.fuseTime);
    for (const [ax, ay, az] of EDGE_AXES) {
      anchors.push({ x: burst.x + ax * radius, y: burst.y + ay * radius, z: burst.z + az * radius });
    }
  }
  return anchors;
}

/**
 * 计算本幕取景。aspect = 视口宽/高。注视点固定在地形高度（cameraController
 * 每帧把 target.y 归到地形），只沿地面平移 targetX/targetZ，并用最小 zoom
 * 包住全部锚点；纵向留出底部 HUD 的位置。
 */
export function frameShowAct(
  designs: readonly FireworkDesign[],
  actSeed: number,
  aspect: number,
): ShowFraming {
  const safeAspect = Math.max(0.2, Math.min(4, Number.isFinite(aspect) ? aspect : 1.6));
  const origins = planShowOrigins(designs, actSeed);
  const anchors = collectAnchors(designs, origins);
  if (anchors.length === 0) {
    return { targetX: -58, targetZ: -12, zoom: MAX_ZOOM, origins };
  }
  // 初始注视点取锚点在地面上的重心。
  let sum = { x: 0, z: 0 };
  for (const anchor of anchors) { sum = { x: sum.x + anchor.x, z: sum.z + anchor.z }; }
  let targetX = sum.x / anchors.length;
  let targetZ = sum.z / anchors.length;
  let zoom = MAX_ZOOM;
  // 两轮：第一轮用重心求包围盒与缩放，第二轮按实际相机（含地形高度与
  // 底部 HUD 留白）重新居中后复算缩放。
  for (let pass = 0; pass < 2; pass += 1) {
    const ground = terrainHeight(targetX, targetZ);
    const camera: Vec = { x: targetX + OFFSET.x, y: ground + OFFSET.y, z: targetZ + OFFSET.z };
    let x0 = Number.POSITIVE_INFINITY, x1 = Number.NEGATIVE_INFINITY;
    let y0 = Number.POSITIVE_INFINITY, y1 = Number.NEGATIVE_INFINITY;
    for (const anchor of anchors) {
      const rel = { x: anchor.x - camera.x, y: anchor.y - camera.y, z: anchor.z - camera.z };
      const px = dot(rel, RIGHT);
      const py = dot(rel, UP);
      x0 = Math.min(x0, px); x1 = Math.max(x1, px);
      y0 = Math.min(y0, py); y1 = Math.max(y1, py);
    }
    const halfWidth = Math.max(0.001, (x1 - x0) / 2);
    const halfHeight = Math.max(0.001, (y1 - y0) / 2);
    // 底部 HUD 占约 14% 屏高：可用区间归一化为 [-1+RESERVE, 1]，半高 (2-RESERVE)/2，
    // 中心在 +RESERVE/2（画面上移，给 HUD 让位）。
    const verticalSpan = (2 - BOTTOM_RESERVE) / 2;
    zoom = Math.min(MAX_ZOOM, Math.max(
      MIN_ZOOM,
      Math.max(halfWidth / safeAspect, halfHeight / verticalSpan) * MARGIN,
    ));
    // 包围盒中心在屏幕上的目标位置（世界单位）：zoom × 归一化中心。
    const desiredPy = zoom * (BOTTOM_RESERVE / 2);
    // 沿地面平移 d 会让锚点相对相机反向平移：解 dot(d, RIGHT) 与 dot(d, UP)。
    const targetRight = (x0 + x1) / 2;
    const targetUp = (y0 + y1) / 2 - desiredPy;
    const det = RIGHT.x * UP.z - RIGHT.z * UP.x;
    if (Math.abs(det) < 1e-6) break;
    targetX += (targetRight * UP.z - targetUp * RIGHT.z) / det;
    targetZ += (RIGHT.x * targetUp - UP.x * targetRight) / det;
  }
  targetX = Math.min(TARGET_X_RANGE[1], Math.max(TARGET_X_RANGE[0], targetX));
  targetZ = Math.min(TARGET_Z_RANGE[1], Math.max(TARGET_Z_RANGE[0], targetZ));
  // 夹取后重新核算 zoom：此时画面可能不再居中，按真实的上下边界
  // （下沿 -1+RESERVE、上沿 +1）而不是对称半高来算，避免无谓地缩小烟花。
  const ground = terrainHeight(targetX, targetZ);
  const camera: Vec = { x: targetX + OFFSET.x, y: ground + OFFSET.y, z: targetZ + OFFSET.z };
  const bottom = -1 + BOTTOM_RESERVE;
  let needed = 0.001;
  for (const anchor of anchors) {
    const rel = { x: anchor.x - camera.x, y: anchor.y - camera.y, z: anchor.z - camera.z };
    const px = dot(rel, RIGHT);
    const py = dot(rel, UP);
    needed = Math.max(needed, Math.abs(px) / safeAspect, py > 0 ? py : py / bottom);
  }
  zoom = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, needed * MARGIN));
  return { targetX, targetZ, zoom, origins };
}
