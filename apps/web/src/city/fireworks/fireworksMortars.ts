// 发射船与炮口的世界坐标（纯模块）：渲染（rendering/fireworksBarge.ts）、
// 物理弹道与观景取景（fireworks/showFraming.ts）共用同一张表，避免三处
// 各自维护魔法数字后互相漂移。
import { FIREWORK_LAUNCH_ZONE } from './fireworksConstants';

export type FireworkMortar = {
  /** 炮口世界 x/z。 */
  x: number;
  z: number;
  /** 炮口世界高度。 */
  y: number;
  /** 弹道水平朝向（弧度）。 */
  heading: number;
};

export type FireworkBargePose = { x: number; z: number; yaw: number };

/** 三艘发射船：世界坐标 + 船体偏航角。 */
export const FIREWORK_BARGES: readonly FireworkBargePose[] = Object.freeze([
  Object.freeze({ x: -63.5, z: -17.5, yaw: 0.12 }),
  Object.freeze({ x: -59, z: -11, yaw: -0.08 }),
  Object.freeze({ x: -55, z: -5.5, yaw: 0.06 }),
]);

/** 发射架在船体局部坐标里的 x 偏移（船头方向为 -x）。 */
export const FIREWORK_RACK_LOCAL_X = -1.48;
/** 三根炮管的局部 z 间距。 */
export const FIREWORK_TUBE_Z = Object.freeze([-0.55, 0, 0.55]);
/** 炮口相对水面高度。 */
export const FIREWORK_MUZZLE_Y = FIREWORK_LAUNCH_ZONE.waterY + 1.38;

/** 展开全部炮口（每船三根）；朝向与船体一致（弹道射向海面）。 */
export function buildFireworkMortars(barges: readonly FireworkBargePose[] = FIREWORK_BARGES): FireworkMortar[] {
  const mortars: FireworkMortar[] = [];
  for (const { x: bx, z: bz, yaw } of barges) {
    const cos = Math.cos(yaw);
    const sin = Math.sin(yaw);
    for (const pz of FIREWORK_TUBE_Z) {
      mortars.push({
        x: bx + FIREWORK_RACK_LOCAL_X * cos + pz * sin,
        z: bz - FIREWORK_RACK_LOCAL_X * sin + pz * cos,
        y: FIREWORK_MUZZLE_Y,
        heading: Math.PI - yaw,
      });
    }
  }
  return mortars;
}

/** 选择离 (x,z) 最近的炮口——与引擎 launch 的选择规则完全一致。 */
export function pickFireworkMortar(mortars: readonly FireworkMortar[], x: number, z: number): FireworkMortar {
  let best = mortars[0]!;
  let bestDistance = Number.POSITIVE_INFINITY;
  for (const mortar of mortars) {
    const distance = (mortar.x - x) ** 2 + (mortar.z - z) ** 2;
    if (distance < bestDistance) {
      bestDistance = distance;
      best = mortar;
    }
  }
  return best;
}
