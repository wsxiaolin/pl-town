// transitGround —— 交通件地面采样器（T4b 乘车交互，docs/t4b-ride-plan.md
// §2 新增①）——月台/桥走廊可步行的统一地面 y 事实源，纯计算模块。
//
// 契约：
// - 优先级：月台场 > 桥走廊 > 自然地形（与 worldReliefAt 岛分支同口径，
//   T4b 换序）。月台是乘车落点的精确基准面（到站落点断言 baseY <1e-6）；
//   星门月台叠在桥头走廊上，桥优先会把 baseY 压偏 0.1054，故月台场压过
//   桥走廊（影响域仅星门月台，其余站台的月台与桥走廊不相交）。
// - 聚合方式：以 terrainHeight 为底层自然场，叠 transitField 的月台/桥
//   走廊 blend。岛足印内 terrainHeight 已按同一函数融过桥/台（月台/桥
//   节点在中心线上、blend 权重恒 1 → 重采样幂等）；岛足印外的走廊/
//   月台段（草甸路堤 + 恒海区 z≥145 无 farGround 网格）由此补齐——
//   桥中段 y=桥面纵断面（deck≈2.06），走桥不再沉海（T4a 遗留缺陷）。
// - 防环：本模块只 import terrainHeight 与 transitField（数据层内单向
//   聚合）；worldReliefField / terrainHeight 禁止反向依赖本文件。
// - 月台/走廊域外与 terrainHeight 全等——主城台地（恒 0）、步道、草甸
//   全部落点零回归。
//
// 消费方向：navigation/roadNavigation（groundPoint / resolveMovement）、
// navigation/playerController（每帧 y 赋值）、city/transitRideController
// （到站落点 y，T4b-c3 接线）。
import { terrainHeight } from './terrainHeight';
import { bridgeDeckBlendAt, stationPadBlendAt } from './transitField';

/**
 * 交通件地面高：优先级 月台场 > 桥走廊 > 自然地形。月台中心恒站 baseY
 * （月台板上的落点），桥走廊内恒桥面纵断面（海上段即桥面），两域外与
 * terrainHeight 全等。全域连续、纯函数、确定性。
 */
export function transitGroundY(x: number, z: number): number {
  const natural = terrainHeight(x, z);
  const padY = stationPadBlendAt(x, z, natural);
  if (padY !== null) return padY;
  const deckY = bridgeDeckBlendAt(x, z, natural);
  if (deckY !== null) return deckY;
  return natural;
}
