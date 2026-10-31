// 南洋年份群岛水面（T3，设计 §6.1）：把既有唯一 Water 实例（westBeach
// 消费的那一个）的几何从「西海条带」扩为南海覆盖多边形——南带 + 西臂。
//
// 与 westBeach.createShoreRibbonGeometry 的关系：西海条带保留原网格原样
// （uv.x 沿条带横向 0→1 驱动 shoreBlend 浅水渐变，改细分会动既有观感），
// 本模块产出的南海片与它在同一 BufferGeometry 内合并（mergeGeometries），
// 共享同一个 Water 材质/镜像 pass/昼夜接线——**禁止新建第二个 Water**
// （反射 pass 翻倍 = 性能红线，AGENTS.md）。
//
// uv 约定：南海片 uv.x 恒 0 → vShoreDist = ribbonDepth(96) = 深海色，
// 与西海条带西缘（uv.x=0）逐像素同色——因此南海片与条带/自身的搭接
// （按设计做 ≤4u 防裂缝搭叠）在同色同层(y=0.06)下不可见，无 z-fighting
// 观感差异；浅水渐变仍专属西海滩（surf strip 不动）。
//
// 区域公式与 city/data/terrain/sea-archipelago.ts 同源（waterGuard 数据）：
// - 南带：x∈[配置 bandXMin,bandXMax]，z ∈ [南陆缘−12, 配置 bandZMax]；北缘 z<168 时沿南陆缘
//   两侧分东西两瓣（陆缘凸起处留陆地），z≥168 合并为整带；
// - 西臂：x∈[配置 armXMin, 西陆缘+2]，z∈[配置 armZMin,armZMax]；z≤112 段东缘与西海条带
//   西缘 (shorelineX−96) 对接并 ≤4u 搭叠（max 保证永不留缝）。
import * as THREE from 'three';
import { shorelineX } from '../../city/data/cityConfig';
import { SOUTH_SEA, SOUTH_SEA_COAST_TUCK, southLandEdgeZ, westLandEdgeX } from '../../city/data/terrain/sea-archipelago';

/** 行距（世界单位）：南缘贴陆缘的下沉带曲率按 2u 分辨率跟随。 */
const ROW_STEP = 2;
/** 西海条带西缘的防裂缝搭叠宽度（uv 同色 → 不可见）。 */
const STRIP_OVERLAP = 4;
/** 南带北缘的南陆缘贴边（下沉带内收，水面从淹住的下沉海岸开始）。 */
const ARC_SIN_CLAMP = 1;

const SOUTH_BAND_MIN_Z = Math.min(
  134,
  ...Array.from({ length: 64 }, (_, index) => {
    const x = THREE.MathUtils.lerp(SOUTH_SEA.bandXMin, SOUTH_SEA.bandXMax, index / 63);
    return southLandEdgeZ(x) - SOUTH_SEA_COAST_TUCK;
  }),
);

/** 南带东瓣西缘（z<168 时沿南陆缘东侧；z≥168 整带西缘配置边界）。 */
function bandEastLobeWestX(z: number): number {
  if (z >= 168) return SOUTH_SEA.bandXMin;
  const t = Math.min(ARC_SIN_CLAMP, Math.max(-ARC_SIN_CLAMP, (150 - z) / 18));
  return 47 * Math.asin(t);
}

/** 南带东瓣东缘（z<168 时沿南陆缘西侧回落，clip 到配置边界）。 */
function bandEastLobeEastX(z: number): number {
  if (z >= 168) return SOUTH_SEA.bandXMax;
  const t = Math.min(ARC_SIN_CLAMP, Math.max(-ARC_SIN_CLAMP, (150 - z) / 18));
  return Math.min(SOUTH_SEA.bandXMax, 47 * (Math.PI - Math.asin(t)));
}

/** 南带西瓣东缘（z∈[150,168] 西南陆缘凸起以西的水域；168 处与东瓣拼接）。 */
function bandWestLobeEastX(z: number): number {
  const t = Math.min(ARC_SIN_CLAMP, Math.max(-ARC_SIN_CLAMP, (150 - z) / 18));
  return 47 * (-Math.PI - Math.asin(t));
}

/** 西臂东缘：贴西陆缘内收 2（z≤112 与西海条带西缘对接，永不留缝）。 */
function westArmEastX(z: number): number {
  const tuckX = westLandEdgeX(z) + 2;
  if (z > 112) return tuckX;
  const stripWest = shorelineX(z) - 96;
  return Math.max(Math.min(tuckX, stripWest - STRIP_OVERLAP), stripWest);
}

type SheetSpec = {
  /** 西缘（x 较小侧）。 */
  innerX: (z: number) => number;
  /** 东缘（x 较大侧）。 */
  outerX: (z: number) => number;
  minZ: number;
  maxZ: number;
  columns: number;
};

function buildSheet(spec: SheetSpec): THREE.BufferGeometry {
  const rows = Math.round((spec.maxZ - spec.minZ) / ROW_STEP);
  const positions: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];
  for (let row = 0; row <= rows; row += 1) {
    const z = spec.minZ + ((spec.maxZ - spec.minZ) * row) / rows;
    const inner = spec.innerX(z);
    const outer = spec.outerX(z);
    for (let column = 0; column <= spec.columns; column += 1) {
      const x = THREE.MathUtils.lerp(inner, outer, column / spec.columns);
      // 海面是固定水位的设计锚定（y 由 mesh 位置 SEA_SURFACE_Y 承载）。
      positions.push(x, 0, z);
      // uv.x 恒 0 → vShoreDist = ribbonDepth → 深海色（见文件头）。
      uvs.push(0, row / rows);
    }
  }
  for (let row = 0; row < rows; row += 1) {
    for (let column = 0; column < spec.columns; column += 1) {
      const a = row * (spec.columns + 1) + column;
      const b = a + 1;
      const c = a + spec.columns + 1;
      const d = c + 1;
      indices.push(a, c, d, a, d, b);
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}

/**
 * 南海水面片（南带东瓣 + 西瓣 + 西臂，三个子网格各自规则拓扑）。
 * 返回的几何与西海条带同属性集（position/uv/index/normal），供
 * mergeGeometries 合并进唯一 Water 实例。调用方负责 dispose。
 */
export function createArchipelagoWaterGeometry(): THREE.BufferGeometry {
  const sheets: THREE.BufferGeometry[] = [
    // 西臂：星港/长风/微光一带的西外海，范围由共享配置定义。
    buildSheet({
      innerX: () => SOUTH_SEA.armXMin,
      outerX: westArmEastX,
      minZ: SOUTH_SEA.armZMin,
      maxZ: SOUTH_SEA.armZMax,
      columns: 12,
    }),
    // 南带东瓣：起源村/启明/潮声/盛夏一带，北缘沿南陆缘。
    buildSheet({
      innerX: bandEastLobeWestX,
      outerX: bandEastLobeEastX,
      minZ: SOUTH_BAND_MIN_Z,
      maxZ: SOUTH_SEA.bandZMax,
      columns: 28,
    }),
    // 南带西瓣：回响镇以西、西南陆缘凸起以南的过渡水域（z 150..168，
    // 168 行与东瓣共享 x=−73.8 拼接点，行距同 2u → 顶点重合、水密）。
    buildSheet({
      innerX: () => SOUTH_SEA.bandXMin,
      outerX: bandWestLobeEastX,
      minZ: 150,
      maxZ: 168,
      columns: 4,
    }),
  ];
  const merged = mergeWaterSheets(sheets);
  for (const sheet of sheets) sheet.dispose();
  return merged;
}

/**
 * 合并水面片（同属性集 position/uv/normal/index，westBeach 用于把西海
 * 条带与南海片拼进唯一 Water 实例）。调用方负责 dispose 返回值；输入
 * 几何不被本函数消费，调用方自行处置。
 */
export function mergeWaterSheets(sheets: THREE.BufferGeometry[]): THREE.BufferGeometry {
  const merged = new THREE.BufferGeometry();
  let vertexCount = 0;
  let indexCount = 0;
  for (const sheet of sheets) {
    vertexCount += sheet.getAttribute('position').count;
    indexCount += sheet.getIndex()?.count ?? 0;
  }
  const positions = new Float32Array(vertexCount * 3);
  const uvs = new Float32Array(vertexCount * 2);
  const normals = new Float32Array(vertexCount * 3);
  const indices = vertexCount > 65535 ? new Uint32Array(indexCount) : new Uint16Array(indexCount);
  let vertexCursor = 0;
  let indexCursor = 0;
  for (const sheet of sheets) {
    const position = sheet.getAttribute('position') as THREE.BufferAttribute;
    const uv = sheet.getAttribute('uv') as THREE.BufferAttribute;
    const normal = sheet.getAttribute('normal') as THREE.BufferAttribute;
    const index = sheet.getIndex();
    if (!index) throw new Error('archipelago water sheet requires indexed geometry');
    positions.set(position.array as Float32Array, vertexCursor * 3);
    uvs.set(uv.array as Float32Array, vertexCursor * 2);
    normals.set(normal.array as Float32Array, vertexCursor * 3);
    for (let i = 0; i < index.count; i += 1) {
      indices[indexCursor + i] = index.getX(i) + vertexCursor;
    }
    vertexCursor += position.count;
    indexCursor += index.count;
  }
  merged.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  merged.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
  merged.setAttribute('normal', new THREE.BufferAttribute(normals, 3));
  merged.setIndex(new THREE.BufferAttribute(indices, 1));
  merged.computeBoundingSphere();
  merged.computeBoundingBox();
  return merged;
}

/** 调试/审计用：南海水面北缘（南带贴边线，z = 南陆缘 − TUCK）。 */
export function southSeaCoastZ(x: number): number {
  return southLandEdgeZ(x) - SOUTH_SEA_COAST_TUCK;
}
