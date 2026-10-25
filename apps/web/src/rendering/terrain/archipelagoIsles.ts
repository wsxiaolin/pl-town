import * as THREE from 'three';
import { YEAR_ISLAND_SPECS, islandShapeScaleAt, type YearDistrictSpec } from '../../city/data/year-towns/towns';
import { islandSurfaceYAt, ISLAND_SKIRT_BOTTOM, ISLAND_SKIRT_W } from '../../city/data/terrain/heightfield/islandField';

// 南洋年份群岛渲染：2 座大城 + 启源站，共 3 座 flat-top 岛台（台面平台 + 滩坡 + 水下裙）+ 沙线盘。
// 配置契约见 city/data/year-towns/towns.ts 与设计文档 §3/§6.2；
// 「配置在 data、渲染在 rendering」分层见 terrain/README.md。
//
// 视觉基准与明澜外海同族（CG 片头折面平影体块、柔和粉彩、无 scene.fog）：
// - 岛体 = 径向高度场网格（环 × 圆周），顶点 y 直接采样权威采样器
//   islandSurfaceYAt（图与地形永远一致，唯一采样器 DoD）；
// - non-indexed 三角形直接发射 + computeVertexNormals：每三角形独立法线
//   = 干净折面；
// - 逐面顶点色按绝对高度分带（水下岩青 → 湿沙 → 干沙 → 镇主题台面色），
//   逐面 ±6% 明度抖动 + 朝北/东坡面轻微冷色偏移（明澜屿同款）；
// - 沙线盘：半径 beachR + 1.5、y = 0.085（高过水面 0.06 的 0.025 间隔
//   ≥ AGENTS.md 的 0.004 防共面要求），从水线穿越环到滩缘读作沙滩台。
//
// LOD 说明（施工修订 #2）：明澜屿代码现实为单级网格（无运行时 LOD），本
// 渲染器保持同构——8 岛各为独立 Object3D，正交视锥窗口外整岛剔除（远镇
// 出窗即零像素成本，设计 §12 的 LOD 目标由视锥剔除等价达成）。

const SAND_RIM_Y = 0.085;
const SAND_RIM_MARGIN = 1.5;
const WATER_LINE_Y = 0.06;

// 分带阈值（绝对高度）。
const WET_ROCK_MAX_Y = 0.02;
const WET_SAND_MAX_Y = 0.28;

const ROCK_TEAL = new THREE.Color(0x41707c);
const WET_SAND = new THREE.Color(0xc9b482);
const DRY_SAND = new THREE.Color(0xdac795);
const SAND_RIM_COLOR = 0xd6c290;

// 环半径表（相对量：0..1 → 0..beachR+ISLAND_SKIRT_W）。台面缘（ρ=plateauR）
// 与水线穿越环各给一环，折面分带才干净。
function ringRadii(town: YearDistrictSpec): number[] {
  const outer = town.beachR + ISLAND_SKIRT_W;
  const radii = [
    0,
    town.plateauR * 0.45,
    town.plateauR * 0.8,
    town.plateauR * 0.95,
    town.plateauR,
    town.plateauR + (town.beachR - town.plateauR) * 0.34,
    town.plateauR + (town.beachR - town.plateauR) * 0.67,
    town.beachR,
    town.beachR + ISLAND_SKIRT_W * 0.45,
    outer,
  ];
  return radii.filter((value, index) => index === 0 || value > radii[index - 1]!);
}

type BuildContext = {
  group: THREE.Group;
  geometries: Set<THREE.BufferGeometry>;
  materials: Set<THREE.Material>;
};

/** 确定性逐面抖动（[1−0.06, 1+0.06]）：同环段永远同值。 */
function facetJitter(seed: number): number {
  let hash = Math.imul(seed ^ 0x9e3779b9, 0x85ebca6b) >>> 0;
  hash = Math.imul(hash ^ (hash >>> 13), 0xc2b2ae35) >>> 0;
  return 1 + (((hash >>> 8) & 0xff) / 255 - 0.5) * 0.12;
}

function buildIslandBody(
  context: BuildContext,
  town: YearDistrictSpec,
  facetMaterial: THREE.Material,
): void {
  const radii = ringRadii(town);
  // 有岛形调制的岛需要更高分段，否则谐波岸线会呈折线。
  const segments = town.shape ? 128 : (town.plateauR >= 40 ? 64 : 32);
  const townColor = new THREE.Color(town.theme.groundColor);
  const positions: number[] = [];
  const colors: number[] = [];
  const emit = (
    ax: number, ay: number, az: number,
    bx: number, by: number, bz: number,
    cx: number, cy: number, cz: number,
    seed: number,
  ): void => {
    positions.push(ax, ay, az, bx, by, bz, cx, cy, cz);
    // 分带采样用面心（三顶点均值）。
    const my = (ay + by + cy) / 3;
    const tint = new THREE.Color();
    if (my < WET_ROCK_MAX_Y) tint.copy(ROCK_TEAL);
    else if (my < WET_SAND_MAX_Y) tint.copy(WET_SAND);
    else if (my < town.topY - 0.25) tint.copy(DRY_SAND);
    else tint.copy(townColor);
    // 逐面明度抖动 + 北/东坡面轻微冷色偏移（法线 z 分量朝 −z 或 x 朝 +x）。
    const jitter = facetJitter(seed);
    const nx = (by - ay) * (cz - az) - (bz - az) * (cy - ay);
    const nz = (bx - ax) * (cy - ay) - (by - ay) * (cx - ax);
    const cool = Math.max(0, Math.min(0.06, (Math.max(0, -nz) + Math.max(0, nx)) * 0.03));
    tint.multiplyScalar(jitter);
    tint.b += cool;
    for (let i = 0; i < 3; i += 1) colors.push(tint.r, tint.g, tint.b);
  };
  const vertexAt = (rho: number, segment: number): [number, number, number] => {
    const angle = (segment / segments) * Math.PI * 2;
    const x = town.x + Math.cos(angle) * rho;
    const z = town.z + Math.sin(angle) * rho;
    return [x, islandSurfaceYAt(x, z) ?? ISLAND_SKIRT_BOTTOM, z];
  };
  // 中心扇面。
  const center: [number, number, number] = [town.x, town.topY, town.z];
  for (let segment = 0; segment < segments; segment += 1) {
    const a = vertexAt(radii[1]!, segment);
    const b = vertexAt(radii[1]!, segment + 1);
    emit(center[0], center[1], center[2], b[0], b[1], b[2], a[0], a[1], a[2], segment);
  }
  // 环间四边形 → 两三角形（绕向朝外）。
  for (let ring = 1; ring < radii.length - 1; ring += 1) {
    for (let segment = 0; segment < segments; segment += 1) {
      const a = vertexAt(radii[ring]!, segment);
      const b = vertexAt(radii[ring]!, segment + 1);
      const c = vertexAt(radii[ring + 1]!, segment);
      const d = vertexAt(radii[ring + 1]!, segment + 1);
      const seed = ring * 131 + segment;
      emit(a[0], a[1], a[2], d[0], d[1], d[2], c[0], c[1], c[2], seed);
      emit(a[0], a[1], a[2], b[0], b[1], b[2], d[0], d[1], d[2], seed + 7);
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  geometry.computeVertexNormals();
  geometry.computeBoundingSphere();
  const mesh = new THREE.Mesh(geometry, facetMaterial);
  mesh.castShadow = false;
  mesh.receiveShadow = false;
  mesh.name = town.id;
  context.group.add(mesh);
  context.geometries.add(geometry);
}

/**
 * 沙线盘几何：平铺在 y = SAND_RIM_Y 的环形带，用于遮住岛体与水面接缝。
 * 岸线非正圆时按 islandShapeScaleAt 逐角度缩放，与岛体/地形同源。
 */
function sandRimGeometry(town: YearDistrictSpec): THREE.BufferGeometry {
  const segments = town.shape ? 128 : (town.plateauR >= 40 ? 64 : 32);
  const baseR = town.beachR + SAND_RIM_MARGIN;
  const positions: number[] = [];
  const indices: number[] = [];

  // 顶点：中心 + 外缘（逐角度调制半径）。
  positions.push(0, 0, 0);
  for (let i = 0; i < segments; i += 1) {
    const theta = (i / segments) * Math.PI * 2;
    const k = islandShapeScaleAt(town.shape, theta);
    positions.push(Math.cos(theta) * baseR * k, 0, Math.sin(theta) * baseR * k);
  }
  for (let i = 0; i < segments; i += 1) {
    const a = 1 + i;
    const b = 1 + ((i + 1) % segments);
    indices.push(0, b, a);
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setIndex(indices);
  geometry.rotateX(-Math.PI / 2);
  return geometry;
}

function buildSandRim(
  context: BuildContext,
  town: YearDistrictSpec,
  rimMaterial: THREE.Material,
): void {
  const geometry = sandRimGeometry(town);
  geometry.computeBoundingSphere();
  const mesh = new THREE.Mesh(geometry, rimMaterial);
  mesh.position.set(town.x, SAND_RIM_Y, town.z);
  mesh.castShadow = false;
  mesh.receiveShadow = false;
  mesh.name = `${town.id}-sand-rim`;
  mesh.renderOrder = 2;
  context.group.add(mesh);
  context.geometries.add(geometry);
}

export type ArchipelagoIsles = {
  object: THREE.Group;
  dispose(): void;
};

export function createArchipelagoIsles(options: { scene: THREE.Scene }): ArchipelagoIsles {
  const object = new THREE.Group();
  object.name = 'year-archipelago';
  const context: BuildContext = {
    group: object,
    geometries: new Set<THREE.BufferGeometry>(),
    materials: new Set<THREE.Material>(),
  };
  const facetMaterial = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    vertexColors: true,
    flatShading: true,
    roughness: 0.96,
    metalness: 0,
  });
  const rimMaterial = new THREE.MeshStandardMaterial({
    color: SAND_RIM_COLOR,
    flatShading: true,
    roughness: 0.98,
    metalness: 0,
  });
  context.materials.add(facetMaterial);
  context.materials.add(rimMaterial);

  for (const town of YEAR_ISLAND_SPECS) {
    buildIslandBody(context, town, facetMaterial);
    buildSandRim(context, town, rimMaterial);
  }

  options.scene.add(object);

  return {
    object,
    dispose() {
      object.parent?.remove(object);
      for (const geometry of context.geometries) geometry.dispose();
      for (const material of context.materials) material.dispose();
      context.geometries.clear();
      context.materials.clear();
    },
  };
}

/** 水线常量导出（审计/后续 T4 栈桥对齐用）。 */
export const ARCHIPELAGO_WATER_LINE_Y = WATER_LINE_Y;
