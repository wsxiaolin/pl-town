// 世界地面（farGround）全域地形网格——可信地形改造 R1（方案 D7 / §8）。
//
// 取代旧 PlaneGeometry(220,220) y=0 平面：非均匀格点张量产网格，全部
// 顶点 y = SURFACE_Y.base + terrainHeight(x,z)，1 个 mesh 单 draw call
// 承载全部地面高度（staticMeshBatcher 对单实例几何不合批）。
//
// 密度分划（方案 §8 预算：台地内 4u、裙坡及场域 2u、远缘 3u）——
// 段边界精确对齐台地/场域界线（x: -75 台地西缘 / 42 步道槽东界 / 78
// 台地东缘 / 88 走廊端；z: -104 河谷北缘封口带 / -86 河谷域界 / 78
// 台地南缘），段内均匀。张量积结构（x/z 各自独立分划）→ 全域
// watertight，无 T-junction；台地内 4u 是纯平坦区（terrainHeight ≡ 0，
// 被 district 铺装覆盖），密度损失零视觉。
//
// 预算实测：x 77 段 × z 66 段 = 10,164 三角（≤16k）/ 5,226 顶点
// （方案估算带 4~6k 内）。
//
// 边界衔接与共面安全（GOAL z-fighting 红线）：
// - 北 z=-110 / 东 x=110 / 南 z=110：域缘场值渐灭归 0（河谷北缘封口
//   RIVER_NORTH_CLOSE_Z、草甸外缘 profile 落回），与 mountainRanges
//   APRON_LOBES（y=0，缘线外相接不重叠）平顺衔接；
// - 西缘海域：海床下切低于外海底面（-0.4）的部分被不透明海面
//   （0.06，覆盖至岸线 -43.2±wobble）遮盖——与现状岛基 -0.6 穿透外
//   海底的同款既有语义，无新增可见面；
// - 台地内顶点 y=0 与 district(0.018)/northDistrict(0.026)/plaza
//   (0.036) 等铺装层差 ≥ 0.014（3.5× 红线 0.004），层差体系原样保留。
import * as THREE from 'three';
import { SURFACE_Y } from '../layers';
import { terrainHeight } from '../../city/data/terrain/heightfield/terrainHeight';

/** 世界地面边长（与旧 farGround PlaneGeometry(220,220) 域一致）。 */
const WORLD_GROUND_SIZE = 220;
const WORLD_GROUND_HALF = WORLD_GROUND_SIZE / 2;

/** x 向分划：[from, to, 段内目标格距]。 */
const X_BANDS: ReadonlyArray<readonly [number, number, number]> = [
  [-WORLD_GROUND_HALF, -89, 3], // 远缘西：渐深 fBm 海床（海面下不可见）
  [-89, -75, 2], // 西侧滩涂缓坡 + 岛基保护区（场域）
  [-75, 0, 4], // 台地西段（平坦）
  [0, 42, 2], // 出城步道切槽走廊（融合坡横向精度）
  [42, 78, 4], // 台地东段（平坦）
  [78, 88, 4], // 观星走廊（台地延伸，平坦）
  [88, WORLD_GROUND_HALF, 2], // 东缘：南草甸东翼 + 东北瓣东段（场域）
];

/** z 向分划：[from, to, 段内目标格距]。 */
const Z_BANDS: ReadonlyArray<readonly [number, number, number]> = [
  [-WORLD_GROUND_HALF, -104, 3], // 北缘渐灭带（远缘）
  [-104, -86, 2], // 河谷主体 + 东北草甸瓣（场域）
  [-86, 78, 4], // 台地主体（平坦）
  [78, 96, 2], // 南裙坡 + 步道出口 + 草甸主段（场域）
  [96, WORLD_GROUND_HALF, 3], // 草甸外缘落回带（远缘）
];

function axisLines(bands: ReadonlyArray<readonly [number, number, number]>): number[] {
  const lines: number[] = [bands[0]![0]!];
  for (const [from, to, cell] of bands) {
    const span = to - from;
    const segments = Math.max(1, Math.round(span / cell));
    for (let i = 1; i <= segments; i += 1) lines.push(from + (span * i) / segments);
  }
  return lines;
}

/**
 * 非均匀格点全域地形网格（indexed；法线由网格计算 computeVertexNormals，
 * 平滑着色与草甸折面观感衔接靠 ground6 噪声纹理兜底）。
 * 顶点数 5,226 / 三角面 10,164（方案 §8 预算 ≤16k 内）。
 */
export function createWorldGroundGeometry(): THREE.BufferGeometry {
  const xs = axisLines(X_BANDS);
  const zs = axisLines(Z_BANDS);
  const nx = xs.length;
  const nz = zs.length;

  const positions = new Float32Array(nx * nz * 3);
  const uvs = new Float32Array(nx * nz * 2);
  for (let j = 0; j < nz; j += 1) {
    const z = zs[j]!;
    for (let i = 0; i < nx; i += 1) {
      const x = xs[i]!;
      const vertex = j * nx + i;
      positions[vertex * 3] = x;
      // 唯一权威采样器落位（GOAL 硬性要求）：台地内恒 base 层 0。
      positions[vertex * 3 + 1] = SURFACE_Y.base + terrainHeight(x, z);
      positions[vertex * 3 + 2] = z;
      // UV 对齐旧 PlaneGeometry rotateX(-π/2) 的展开（v = (HALF−z)/SIZE），
      // rx/ry=24 的纹理密度与旧地面逐像素一致。
      uvs[vertex * 2] = (x + WORLD_GROUND_HALF) / WORLD_GROUND_SIZE;
      uvs[vertex * 2 + 1] = (WORLD_GROUND_HALF - z) / WORLD_GROUND_SIZE;
    }
  }

  const quadCount = (nx - 1) * (nz - 1);
  const indices = nx * nz > 0xffff ? new Uint32Array(quadCount * 6) : new Uint16Array(quadCount * 6);
  let k = 0;
  for (let j = 0; j + 1 < nz; j += 1) {
    for (let i = 0; i + 1 < nx; i += 1) {
      const a = j * nx + i;
      const b = a + 1;
      const c = a + nx;
      const d = c + 1;
      // 绕向保证法线朝 +Y（俯视可见）。
      indices[k++] = a;
      indices[k++] = c;
      indices[k++] = d;
      indices[k++] = a;
      indices[k++] = d;
      indices[k++] = b;
    }
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
  geometry.setIndex(new THREE.BufferAttribute(indices, 1));
  geometry.computeVertexNormals();
  return geometry;
}
