// 城缘草甸（cityside meadow）渲染器 —— 城市地面建模（v7，2026-10-06）。
//
// 配置：city/data/terrain/ground-cityside.ts（CITYSIDE_MEADOW，纯数据）。
// district 方正铺装面（±75）与世界裙板（y=0 平地）之间的两片低多边形
// 起伏草甸：南瓣面向主城开阔展开（起伏 ≤2.9），东北瓣沿晨溪河谷东段
// 起伏（≤1.7）。材质与岚屏岭山体/麓原同源（terrainMaterial 三平面混合，
// aBand 压在草甸带以下），山脚麓原 → 城缘草甸 → 城区绿地完全连续。
//
// 高度场（每片草甸 = 一张矩形网格）：
//   y = -0.08 + relief × h01 × profile × masks
// - h01：双频 fBm 大缓坡（确定性，无 Math.random）；
// - profile：城市侧边缘隆起、外缘落回埋地的"隆起带"曲线（逐条配置的
//   空间形态，见 swellProfile）；
// - masks：可步行区/河谷/河口湾/海域/麓原五重软塌陷——起伏在任何
//   keep-out 区域强制归零（网格脚印虽过界，表面埋在 y<0 之下不可见）。
//
// 装饰（草簇/花丛/灌木）：合并为顶点色单材质几何，与松树同一合批协议
// （cityWorldAssembly 挂接后调 batchStaticMeshes 实例化）。城市内落点
// 只在绿地矩形（四角草坪/北城公园与绿带）内，按 BUILDING_DEFS 脚印、
// 环路环带、主路走廊、路口小广场与树阵做确定性剔除。
//
// 实现约定（对齐 mountainRanges.ts / westBeach.ts）：
// - 工厂不往 scene 添加任何对象；dispose() 释放本模块全部 geometry 与
//   material；纹理归 ResourcePool，不在此释放。
// - 贴地网格 y 基线 -0.08（埋入地表之下），与 SURFACE_Y 各层不存在
//   共面重叠；与 district(0.018)/base(0) 仅几何相交（窄带穿越），无
//   远镜头 z-fighting（AGENTS.md 红线见 layers.ts 头注释）。
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { CITYSIDE_MEADOW } from '../../city/data/terrain/ground-cityside';
import { BUILDING_DEFS } from '../../city/data/buildings';
import { inferPlot } from '../../city/data/buildings/_shapeDefaults';
import { NORTH_DISTRICT_AREA } from '../../city/data/cityConfig';
import { getActiveProceduralTextureLibrary } from '../proceduralTextureLibrary';
import { RENDER_ORDER, SURFACE_Y } from '../layers';
import { hashString, mulberry32 } from './massifGeometry';
import {
  bakeFacetTintAndBand,
  createPlainFacetMaterial,
  createTerrainFacetMaterial,
  terrainChainTint,
  type TerrainShaderUniforms,
} from './terrainMaterial';
// 高度场在 meadowField.ts（纯计算，无 Three.js 网格）：worldTerrainAudit
// 的数值审计与渲染几何共用同一份 sampleCitysideMeadowY。
import {
  MEADOW_GLOBAL_SEED,
  sampleCitysideMeadowY,
} from './meadowField';

export { sampleCitysideMeadowY } from './meadowField';

export type CityGroundOptions = { scene: THREE.Scene };
export type CityGroundHandle = {
  object: THREE.Group;
  dispose(): void;
};

/** 城市内绿地矩形上的装饰落点（确定性剔除后 y 取绿地层高）。 */
type GreenRect = { x0: number; x1: number; z0: number; z1: number; y: number };
const CITY_GREEN_RECTS: readonly GreenRect[] = [
  // 主城四角草坪（createCitySurfaces grassPositions，24×24 @ ±24）。
  { x0: 14, x1: 34, z0: 14, z1: 34, y: SURFACE_Y.landscape },
  { x0: 14, x1: 34, z0: -34, z1: -14, y: SURFACE_Y.landscape },
  { x0: -34, x1: -14, z0: 14, z1: 34, y: SURFACE_Y.landscape },
  { x0: -34, x1: -14, z0: -34, z1: -14, y: SURFACE_Y.landscape },
  // 星语公园与两坊南缘绿带（NORTH_DISTRICT_AREA 铺装配置）。
  {
    x0: NORTH_DISTRICT_AREA.park.minX + 1.5,
    x1: NORTH_DISTRICT_AREA.park.maxX - 1.5,
    z0: NORTH_DISTRICT_AREA.park.minZ + 1.5,
    z1: NORTH_DISTRICT_AREA.park.maxZ - 1.5,
    y: SURFACE_Y.landscape,
  },
  { x0: -28.5, x1: -10.5, z0: -84.4, z1: -80.8, y: SURFACE_Y.landscape },
  { x0: 5.5, x1: 15.5, z0: -84.4, z1: -80.8, y: SURFACE_Y.landscape },
];

export function createCityGround(options: CityGroundOptions): CityGroundHandle {
  void options.scene; // 工厂不挂接场景：调用方决定 object 的挂载点
  const object = new THREE.Group();
  object.name = 'cityside-meadow-terrain';

  const textureLibrary = getActiveProceduralTextureLibrary();
  const grassMap = textureLibrary?.repeat('grass', 1, 1) ?? null;
  const stoneMap = textureLibrary?.repeat('stone', 1, 1) ?? null;
  const snowMap = textureLibrary?.repeat('snow_ground', 1, 1) ?? null;
  const hasTerrainTextures = Boolean(grassMap && stoneMap && snowMap);

  const geometries = new Set<THREE.BufferGeometry>();
  const ownedMaterials = new Set<THREE.Material>();
  const track = <T extends THREE.BufferGeometry>(geometry: T): T => {
    geometries.add(geometry);
    return geometry;
  };

  const uniforms: TerrainShaderUniforms = {
    uGrassMap: { value: grassMap },
    uRockMap: { value: stoneMap },
    uSnowMap: { value: snowMap },
    uTexScale: { value: 3.2 },
    uAllRock: { value: 0 },
  };
  // 与山体共用同一 cacheKey 的三平面材质（three 复用同一着色程序）。
  const facetMaterial = hasTerrainTextures
    ? createTerrainFacetMaterial(uniforms)
    : createPlainFacetMaterial();
  ownedMaterials.add(facetMaterial);
  const tintStrength = hasTerrainTextures ? 0.3 : 0.85;

  // ── 草甸起伏网格 ──────────────────────────────────────────────────
  for (const feature of CITYSIDE_MEADOW) {
    const w = feature.width ?? 20;
    const d = feature.depth ?? 20;
    const cell = 2; // ≈2 世界单位一格：大缓坡折面 + 可控顶点数
    const segW = Math.max(2, Math.round(w / cell));
    const segD = Math.max(2, Math.round(d / cell));
    const plane = new THREE.PlaneGeometry(w, d, segW, segD);
    plane.rotateX(-Math.PI / 2);
    plane.translate(feature.x ?? 0, 0, feature.z ?? 0);
    const position = plane.getAttribute('position') as THREE.BufferAttribute;
    for (let index = 0; index < position.count; index += 1) {
      const y = sampleCitysideMeadowY(feature, position.getX(index), position.getZ(index));
      position.setY(index, y);
    }
    position.needsUpdate = true;
    // non-indexed → 逐面法线与逐面顶点色（与山体同一烘焙管线）。
    const geometry = track(plane.toNonIndexed());
    plane.dispose();
    geometry.computeVertexNormals();
    const relief = feature.renderHint?.reliefHeight ?? 2.2;
    // aBand.x = 面心高度占比 ÷ (relief×3)：恒低于草甸/岩壁分界（0.34），
    // 草甸永远走草甸纹理带。
    bakeFacetTintAndBand(
      geometry,
      // 草甸紧邻城区（与远景山链不同）：顶点色调拉到 0.75，草甸读作
      // 鲜绿草地而不是远处山体的雾化灰绿；纹理仍提供细节与色斑。
      { height: relief * 3, snowLine: null, tint: terrainChainTint(feature.renderHint?.color ?? 0x8fae72, 0.75) },
      (hashString(`${feature.id}:bake`) ^ MEADOW_GLOBAL_SEED) >>> 0,
    );
    const mesh = new THREE.Mesh(geometry, facetMaterial);
    mesh.name = `${feature.id}:meadow`;
    mesh.castShadow = false;
    mesh.receiveShadow = true;
    mesh.renderOrder = RENDER_ORDER.base; // 埋地跨界网格，随地表基面排序
    object.add(mesh);
  }

  // ── 装饰（草簇/花丛/灌木）：顶点色单材质，可实例化合批 ────────────
  const propMaterial = new THREE.MeshStandardMaterial({
    vertexColors: true,
    flatShading: true,
    roughness: 0.95,
    metalness: 0,
  });
  ownedMaterials.add(propMaterial);

  function paintPart(part: THREE.BufferGeometry, color: THREE.Color): void {
    const count = part.getAttribute('position').count;
    const colors = new Float32Array(count * 3);
    for (let index = 0; index < count; index += 1) {
      colors[index * 3] = color.r;
      colors[index * 3 + 1] = color.g;
      colors[index * 3 + 2] = color.b;
    }
    part.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  }

  function mergeParts(parts: THREE.BufferGeometry[]): THREE.BufferGeometry {
    // Cone/Cylinder 系带 index，Icosahedron 系（PolyhedronGeometry）不带；
    // 三者混并会被 mergeGeometries 拒绝（静默 null + 控制台报错，
    // 花丛变体渲染成空几何）。统一展开为非索引后合并——装饰几何小，
    // 顶点翻倍可忽略，flatShading 逐面着色也更贴合展开形态。
    const flatParts = parts.map((part) => {
      if (!part.index) return part;
      const flat = part.toNonIndexed();
      part.dispose();
      return flat;
    });
    const merged = mergeGeometries(flatParts, true) ?? new THREE.BufferGeometry();
    flatParts.forEach((part) => part.dispose());
    return track(merged);
  }

  const TUFT_GREENS = [0x7ea75e, 0x8fb96a, 0x6f9c52] as const;
  const BUSH_GREENS = [0x5d8455, 0x6b9160] as const;
  const BLOOM_COLORS = [0xf3ead8, 0xe8c66b, 0xdd8f9c] as const;

  function buildTuft(seed: number): THREE.BufferGeometry {
    const rng = mulberry32(seed);
    const parts: THREE.BufferGeometry[] = [];
    const blades = 4 + Math.floor(rng() * 3);
    for (let index = 0; index < blades; index += 1) {
      const blade = new THREE.ConeGeometry(0.1 + rng() * 0.12, 0.45 + rng() * 0.45, 5);
      blade.translate((rng() - 0.5) * 0.55, 0.24 + rng() * 0.1, (rng() - 0.5) * 0.55);
      paintPart(blade, new THREE.Color(TUFT_GREENS[Math.floor(rng() * TUFT_GREENS.length)]!).multiplyScalar(0.9 + rng() * 0.2));
      parts.push(blade);
    }
    return mergeParts(parts);
  }

  function buildFlowers(seed: number): THREE.BufferGeometry {
    const rng = mulberry32(seed);
    const parts: THREE.BufferGeometry[] = [];
    const bloom = BLOOM_COLORS[Math.floor(rng() * BLOOM_COLORS.length)]!;
    for (let index = 0; index < 3; index += 1) {
      const offsetX = (rng() - 0.5) * 0.5;
      const offsetZ = (rng() - 0.5) * 0.5;
      const blade = new THREE.ConeGeometry(0.09, 0.5 + rng() * 0.3, 5);
      blade.translate(offsetX, 0.26 + rng() * 0.1, offsetZ);
      paintPart(blade, new THREE.Color(TUFT_GREENS[Math.floor(rng() * TUFT_GREENS.length)]!));
      parts.push(blade);
      const head = new THREE.IcosahedronGeometry(0.1 + rng() * 0.05, 0);
      head.translate(offsetX, 0.58 + rng() * 0.16, offsetZ);
      paintPart(head, new THREE.Color(bloom));
      parts.push(head);
    }
    return mergeParts(parts);
  }

  function buildBush(seed: number): THREE.BufferGeometry {
    const rng = mulberry32(seed);
    const parts: THREE.BufferGeometry[] = [];
    const lobes = 2 + Math.floor(rng() * 2);
    for (let index = 0; index < lobes; index += 1) {
      const radius = 0.26 + rng() * 0.14;
      const lobe = new THREE.IcosahedronGeometry(radius, 1);
      lobe.scale(1, 0.68 + rng() * 0.15, 1);
      lobe.translate((rng() - 0.5) * 0.5, radius * 0.62, (rng() - 0.5) * 0.5);
      paintPart(lobe, new THREE.Color(BUSH_GREENS[Math.floor(rng() * BUSH_GREENS.length)]!).multiplyScalar(0.92 + rng() * 0.16));
      parts.push(lobe);
    }
    return mergeParts(parts);
  }

  const propVariants: THREE.BufferGeometry[] = [];
  {
    const baseSeed = (MEADOW_GLOBAL_SEED ^ 0x70726f70) >>> 0; // 'prop'
    for (let index = 0; index < 3; index += 1) propVariants.push(buildTuft((baseSeed + index * 977) >>> 0));
    for (let index = 0; index < 3; index += 1) propVariants.push(buildFlowers((baseSeed + 31 + index * 977) >>> 0));
    for (let index = 0; index < 2; index += 1) propVariants.push(buildBush((baseSeed + 67 + index * 977) >>> 0));
  }

  function pickPropVariant(rng: () => number): THREE.BufferGeometry {
    // 草簇为主（~62%），花丛次之，灌木最少——草地肌理而不是花园。
    const roll = rng();
    if (roll < 0.62) return propVariants[Math.floor(rng() * 3)]!;
    if (roll < 0.86) return propVariants[3 + Math.floor(rng() * 3)]!;
    return propVariants[6 + Math.floor(rng() * 2)]!;
  }

  function addProp(geometry: THREE.BufferGeometry, x: number, y: number, z: number, rng: () => number, name: string): void {
    const prop = new THREE.Mesh(geometry, propMaterial);
    prop.name = name;
    prop.position.set(x, y - 0.015, z);
    prop.scale.setScalar(0.8 + rng() * 0.55);
    prop.rotation.y = rng() * Math.PI * 2;
    prop.castShadow = false;
    prop.receiveShadow = true;
    object.add(prop);
  }

  // 城市绿地剔除：建筑脚印（plot 规格 + 边距）/ 环路环带 / 主路走廊 /
  // 北城大道 / 路口小广场 / 公园树阵。
  const ringInner = 34.5;
  const ringOuter = 41.5;
  const buildingCircles = BUILDING_DEFS.map((definition) => ({
    x: definition.x,
    z: definition.z,
    r: inferPlot(definition.shape).size + 1.6,
  }));
  const parkTrees = NORTH_DISTRICT_AREA.parkTrees;
  const plazaSpots = NORTH_DISTRICT_AREA.plazaSpots;

  function isCityPropSpotClear(x: number, z: number): boolean {
    const r = Math.hypot(x, z);
    if (r > ringInner && r < ringOuter) return false; // 环城路
    if (Math.abs(x) < 3.4) return false; // 南北主轴 + 北城大道
    if (Math.abs(Math.abs(z) - 21.1) < 1.9 && Math.abs(x) < 42) return false; // 主路横段
    if (Math.abs(z) < 2 && Math.abs(x) < 44) return false; // 东西环路臂
    if (Math.abs(Math.abs(z) - 38) < 1.8 && Math.abs(x) < 40) return false; // 环路人行短轴
    for (const circle of buildingCircles) {
      if (Math.hypot(x - circle.x, z - circle.z) < circle.r) return false;
    }
    for (const [px, pz] of plazaSpots) {
      if (Math.hypot(x - px, z - pz) < 2.5) return false;
    }
    for (const [tx, tz] of parkTrees) {
      if (Math.hypot(x - tx, z - tz) < 1.3) return false;
    }
    return true;
  }

  // 绿地矩形散布：每 100×100 ≈ 0.8 组（城区比草甸稀，作肌理点缀）。
  let propIndex = 0;
  for (const rect of CITY_GREEN_RECTS) {
    const rng = mulberry32((hashString(`city-green:${rect.x0}:${rect.z0}`) ^ MEADOW_GLOBAL_SEED) >>> 0);
    const area = (rect.x1 - rect.x0) * (rect.z1 - rect.z0);
    const count = Math.round(area / 100 * 0.8);
    let placed = 0;
    for (let attempt = 0; attempt < count * 6 && placed < count; attempt += 1) {
      const x = rect.x0 + rng() * (rect.x1 - rect.x0);
      const z = rect.z0 + rng() * (rect.z1 - rect.z0);
      if (!isCityPropSpotClear(x, z)) continue;
      addProp(pickPropVariant(rng), x, rect.y, z, rng, `cityside-prop-green-${propIndex}`);
      propIndex += 1;
      placed += 1;
    }
  }

  // 草甸散布：profile×mask 有效区上按 density 落点，贴 sampleCitysideMeadowY。
  for (const feature of CITYSIDE_MEADOW) {
    const rng = mulberry32((hashString(`${feature.id}:props`) ^ MEADOW_GLOBAL_SEED) >>> 0);
    const w = feature.width ?? 20;
    const d = feature.depth ?? 20;
    const density = feature.renderHint?.density ?? 1;
    const count = Math.round(w * d / 100 * density);
    let placed = 0;
    for (let attempt = 0; attempt < count * 6 && placed < count; attempt += 1) {
      const x = (feature.x ?? 0) - w / 2 + 2 + rng() * (w - 4);
      const z = (feature.z ?? 0) - d / 2 + 2 + rng() * (d - 4);
      const y = sampleCitysideMeadowY(feature, x, z);
      if (y < 0.05) continue; // 埋地/边缘过渡带不放装饰
      addProp(pickPropVariant(rng), x, y, z, rng, `${feature.id}-prop-${propIndex}`);
      propIndex += 1;
      placed += 1;
    }
  }

  return {
    object,
    dispose(): void {
      object.removeFromParent();
      for (const geometry of geometries) geometry.dispose();
      geometries.clear();
      for (const material of ownedMaterials) material.dispose();
      ownedMaterials.clear();
    },
  };
}
