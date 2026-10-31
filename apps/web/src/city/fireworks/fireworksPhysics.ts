// 烟花物理模型（纯模块，不依赖 DOM / Three.js）。
// 设计台预览与 3D 引擎共用：升空弹道、引信时长、开爆半径、星体解析运动。
// 单位约定：高度/半径为世界单位，发射药与开爆药为克，弹径为毫米，
// 时间为秒，角度为度。
import {
  PATTERN_RADIUS_SCALE,
  recommendedBreakCharge,
  recommendedLiftCharge,
  type BurstSeed,
  type FireworkDesign,
  type Vec3,
} from './fireworksDesign';

export const FIREWORK_GRAVITY = 9.8;
export const SHELL_START_Y = 1.2;
/** 观景海域的恒定海风（世界单位/秒），影响升空与星体漂移。 */
export const FIREWORK_WIND: Readonly<Vec3> = Object.freeze({ x: -1.1, y: 0, z: 0.55 });
export const BASE_BURST_RADIUS = 7.0;

const DEG = Math.PI / 180;

export type ShellPlan = {
  /** 炮口世界高度。 */
  startY: number;
  /** 竖直初速（不含海风）。 */
  vy: number;
  /** 水平初速（发射角造成，不含海风）。 */
  vx: number;
  vz: number;
  /** 理论最高点。 */
  apexHeight: number;
  /** 引信时长（开爆时刻）。 */
  fuseTime: number;
  /** 实际开爆高度。 */
  burstHeight: number;
  /** 目标高度是否可达。 */
  reachable: boolean;
  /** 开爆时水平偏移（含海风）。 */
  driftX: number;
  driftZ: number;
  /** 推荐发射药（克）。 */
  recommendedLift: number;
};

export type CraftReport = {
  plan: ShellPlan;
  radius: number;
  recommendedLift: number;
  recommendedBreak: number;
  shellMassKg: number;
  liftRatio: number;
  breakRatio: number;
  warnings: string[];
};

/** 升空弹道：忽略空气阻力（弹体质量大、上升段短），只受重力与海风。 */
export function planShell(design: FireworkDesign, heading = 0, startY = SHELL_START_Y): ShellPlan {
  const angle = design.launchAngle * DEG;
  const recommendedLift = recommendedLiftCharge(design.caliber);
  const liftRatio = design.liftCharge / recommendedLift;
  const required = Math.sqrt(2 * FIREWORK_GRAVITY * design.height);
  const v0 = required * Math.sqrt(liftRatio);
  const vy = v0 * Math.cos(angle);
  const horizontalSpeed = v0 * Math.sin(angle);
  const vx = horizontalSpeed * Math.cos(heading);
  const vz = horizontalSpeed * Math.sin(heading);
  const apexHeight = startY + (vy * vy) / (2 * FIREWORK_GRAVITY);
  const targetRise = design.height - startY;
  const disc = vy * vy - 2 * FIREWORK_GRAVITY * targetRise;
  const reachable = disc >= 0;
  const fuseTime = reachable
    ? (vy - Math.sqrt(disc)) / FIREWORK_GRAVITY
    : vy / FIREWORK_GRAVITY;
  const burstHeight = startY + vy * fuseTime - 0.5 * FIREWORK_GRAVITY * fuseTime * fuseTime;
  return {
    startY,
    vy,
    vx,
    vz,
    apexHeight,
    fuseTime,
    burstHeight,
    reachable,
    driftX: (vx + FIREWORK_WIND.x) * fuseTime,
    driftZ: (vz + FIREWORK_WIND.z) * fuseTime,
    recommendedLift,
  };
}

/** 升空壳在 `age` 秒时的位置（相对发射点，仅 x/z 偏移 + 绝对高度）。 */
export function shellPosition(plan: ShellPlan, origin: { x: number; z: number }, age: number): Vec3 {
  return {
    x: origin.x + (plan.vx + FIREWORK_WIND.x) * age,
    y: Math.max(0.2, plan.startY + plan.vy * age - 0.5 * FIREWORK_GRAVITY * age * age),
    z: origin.z + (plan.vz + FIREWORK_WIND.z) * age,
  };
}

/** 开爆半径：弹径决定基准，开爆药按平方根缩放（药量翻倍只扩大约 41%）。 */
export function burstRadius(design: FireworkDesign): number {
  const reference = recommendedBreakCharge(design.caliber);
  const caliberScale = Math.pow(design.caliber / 150, 0.35);
  const chargeScale = Math.sqrt(design.breakCharge / reference);
  const patternScale = design.shape === 'pattern' ? PATTERN_RADIUS_SCALE : 1;
  return BASE_BURST_RADIUS * caliberScale * chargeScale * patternScale;
}

/** 工艺卡：把设计参数翻译成居民能理解的物理结果与风险提示。 */
export function craftReport(design: FireworkDesign): CraftReport {
  const plan = planShell(design);
  const recommendedLift = recommendedLiftCharge(design.caliber);
  const recommendedBreak = recommendedBreakCharge(design.caliber);
  const liftRatio = design.liftCharge / recommendedLift;
  const breakRatio = design.breakCharge / recommendedBreak;
  const shellMassKg = 0.9 * Math.pow(design.caliber / 100, 3);
  const warnings: string[] = [];
  if (!plan.reachable) {
    warnings.push(`装药不足：最高只能到 ${plan.burstHeight.toFixed(1)}，低于设计的 ${design.height}`);
  } else if (liftRatio < 0.9) {
    warnings.push('发射药低于推荐值，开爆高度会明显偏低');
  }
  if (liftRatio > 1.35) warnings.push('发射药偏多：升空更快，后坐与膛压偏高');
  if (design.starCount > design.caliber * 3) warnings.push(`星数超过 ${design.caliber}mm 弹径的推荐上限，花形会偏拥挤`);
  if (design.starCount < design.caliber * 0.45) warnings.push('星数偏少，花形会显得稀疏');
  if (breakRatio > 1.8) warnings.push('开爆药偏多：星体初速过高，轮廓容易被拉散');
  if (breakRatio < 0.6) warnings.push('开爆药偏少：开爆半径收得很紧');
  if (design.burnTime <= 2 && (design.shape === 'willow' || design.shape === 'chrysanthemum')) {
    warnings.push('燃烧时间偏短，垂坠效果来不及展开');
  }
  if (design.launchAngle >= 10) warnings.push(`发射角偏大：开爆点水平偏移约 ${Math.hypot(plan.driftX, plan.driftZ).toFixed(1)}`);
  if (design.shape === 'pattern' && design.starCount > 480) warnings.push('拼字星数偏多，字迹会糊成一团');
  return {
    plan,
    radius: burstRadius(design),
    recommendedLift,
    recommendedBreak,
    shellMassKg,
    liftRatio,
    breakRatio,
    warnings,
  };
}

export type StarSample = {
  x: number;
  y: number;
  z: number;
  alpha: number;
  size: number;
  alive: boolean;
  /** 已进入十字分裂后的子星。 */
  child: boolean;
};

type Motion = { x: number; y: number; z: number };

/** 线性阻力 + 重力 + 恒定风的解析积分（相对开爆中心）。 */
function integrateStar(seed: BurstSeed, age: number): Motion {
  const drag = Math.max(0.05, seed.drag);
  const decay = Math.exp(-drag * age);
  const gravity = FIREWORK_GRAVITY * seed.gravity;
  return {
    x: FIREWORK_WIND.x * age + (seed.vx - FIREWORK_WIND.x) * (1 - decay) / drag,
    y: -(gravity / drag) * age + (seed.vy + gravity / drag) * (1 - decay) / drag,
    z: FIREWORK_WIND.z * age + (seed.vz - FIREWORK_WIND.z) * (1 - decay) / drag,
  };
}

function alphaFor(age: number, life: number): number {
  return Math.min(1, Math.max(0, age * 10)) * Math.min(1, Math.max(0, (life - age) / 0.55));
}

/**
 * 星体在 `age` 秒时的状态。十字蕊在中段分裂：父星位置作为子星起点，
 * 子星速度由 `splitV` 预先给定，保证 2D 预览与 3D 引擎完全一致。
 */
export function sampleStar(seed: BurstSeed, age: number, elapsed: number): StarSample {
  if (age < 0) return { x: 0, y: 0, z: 0, alpha: 0, size: 0, alive: false, child: false };
  const splitAt = seed.splitAt && seed.splitAt > 0 ? seed.life * seed.splitAt : Number.POSITIVE_INFINITY;
  if ((seed.splitChild ?? 0) > 0 && age <= splitAt) {
    return { x: 0, y: 0, z: 0, alpha: 0, size: 0, alive: false, child: false };
  }
  let motion: Motion;
  let localAge: number;
  let life: number;
  let size = seed.size;
  let child = false;
  if (seed.splitV && age > splitAt) {
    const parent = integrateStar(seed, splitAt);
    const childLife = Math.min(seed.life - splitAt, 0.9);
    localAge = age - splitAt;
    if (localAge >= childLife) return { x: 0, y: 0, z: 0, alpha: 0, size: 0, alive: false, child: true };
    const childSeed: BurstSeed = {
      ...seed,
      vx: seed.splitV.x,
      vy: seed.splitV.y,
      vz: seed.splitV.z,
      drag: 1.6,
      splitAt: undefined,
      splitV: undefined,
    };
    const offset = integrateStar(childSeed, localAge);
    motion = { x: parent.x + offset.x, y: parent.y + offset.y, z: parent.z + offset.z };
    life = childLife;
    size = seed.size * 0.72;
    child = true;
  } else {
    localAge = age;
    life = seed.life;
    if (age >= life) return { x: 0, y: 0, z: 0, alpha: 0, size: 0, alive: false, child: false };
    motion = integrateStar(seed, age);
  }
  let alpha = alphaFor(localAge, life);
  if (seed.flicker) alpha *= 0.55 + 0.45 * Math.abs(Math.sin(elapsed * 17 + seed.flickerPhase));
  const shrink = 0.8 + 0.2 * Math.min(1, Math.max(0, (life - localAge) / Math.max(0.001, life)) + 0.25);
  return {
    x: motion.x,
    y: motion.y,
    z: motion.z,
    alpha,
    size: size * shrink,
    alive: alpha > 0.01,
    child,
  };
}

/** 供 2D 预览绘制弹道：升空段采样点。 */
export function shellTrajectory(plan: ShellPlan, origin: { x: number; z: number }, samples = 24): Vec3[] {
  const points: Vec3[] = [];
  for (let i = 0; i <= samples; i += 1) {
    points.push(shellPosition(plan, origin, plan.fuseTime * (i / samples)));
  }
  return points;
}
