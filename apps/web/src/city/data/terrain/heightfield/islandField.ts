// 年份群岛岛台高度场（T3，设计 §6.2）——纯计算模块，无 Three.js。
// 径向剖面（每岛独立，确定性、无随机）：
//   ρ ≤ plateauR        台面平台（恒 topY，语义同主城台地：镇区/寻路/相机
//                       目标都以 terrainHeight 取地面 y，台面内零起伏）
//   plateauR < ρ ≤ R    滩坡：topY → ISLAND_BEACH_TO（smoothstep，沙滩缓坡
//                       入水；可见沙滩带 = y > 0.06 的上段）
//   R < ρ ≤ R + SKIRT   水下裙：ISLAND_BEACH_TO → −0.7（裙底低于外海底面
//                       −0.4，水面拼接处被裙体遮住，同明澜屿做法）
//   ρ > R + SKIRT       足印外（null，交还自然场）
// 岛屿 mesh（rendering/terrain/archipelagoIsles.ts）按同一函数采样发射顶点，
// 图与地形永远一致（唯一采样器 DoD）；审计（worldTerrainAudit 'islands' 组）
// 与导航/玩家落点（playerController 每帧 cursor.y = terrainHeight）共用。
import { YEAR_ISLAND_SPECS, islandShapeScaleAt } from '../../year-towns/towns';

/** 滩脚（滩坡终点，略低于水面 0.06，水线在滩环中段穿越）。 */
export const ISLAND_BEACH_TO = -0.2;
/** 水下裙底（低于外海底面 −0.4，底缘不可见）。 */
export const ISLAND_SKIRT_BOTTOM = -0.7;
/** 水下裙宽（滩环外缘再外伸的半径量）。 */
export const ISLAND_SKIRT_W = 3;

function smoothStep01(t: number): number {
  const c = Math.min(1, Math.max(0, t));
  return c * c * (3 - 2 * c);
}

/** 岛在某方向上的有效半径倍率（正圆岛恒 1）。 */
function shapeScaleOf(island: { shape?: Parameters<typeof islandShapeScaleAt>[0] }, dx: number, dz: number): number {
  return islandShapeScaleAt(island.shape, Math.atan2(dz, dx));
}

/**
 * 岛面高度（含台面/滩坡/水下裙）。足印（ρ ≤ beachR + ISLAND_SKIRT_W）外
 * 返回 null——调用方保留自然场值。2 城 + 启源站岛足印互不相交且全在
 * 恒海区，与草甸/河谷/台地/海床切割域零重叠（恒海判据，设计 §2）。
 *
 * 岛缘非正圆：大城按 `shape` 谐波调制每个方向的有效半径（海湾/岬角），
 * plateauR / beachR 是该方向的基准半径。所有采样点共用本函数。
 */
export function islandSurfaceYAt(x: number, z: number): number | null {
  for (const town of YEAR_ISLAND_SPECS) {
    const dx = x - town.x;
    const dz = z - town.z;
    // 包围盒快筛（按最大可能半径放大，避免调制后漏检）。
    const outerR = town.beachR + ISLAND_SKIRT_W;
    const maxR = outerR * 1.2;
    if (dx < -maxR || dx > maxR || dz < -maxR || dz > maxR) continue;
    const rho = Math.hypot(dx, dz);
    const k = shapeScaleOf(town, dx, dz);
    const plateau = town.plateauR * k;
    const beach = town.beachR * k;
    if (rho > beach + ISLAND_SKIRT_W) continue;
    if (rho <= plateau) return town.topY;
    if (rho <= beach) {
      const t = smoothStep01((rho - plateau) / Math.max(1e-6, beach - plateau));
      return town.topY + (ISLAND_BEACH_TO - town.topY) * t;
    }
    const t = smoothStep01((rho - beach) / ISLAND_SKIRT_W);
    return ISLAND_BEACH_TO + (ISLAND_SKIRT_BOTTOM - ISLAND_BEACH_TO) * t;
  }
  return null;
}

/** 岛足印判定（含水下裙；审计与 T4 守卫的「岛缘」口径）。 */
export function isInsideIsland(x: number, z: number): boolean {
  return islandSurfaceYAt(x, z) !== null;
}
