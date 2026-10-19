import * as THREE from 'three';
import { YEAR_TOWNS, type YearTownSpec } from '../../city/data/year-towns/towns';
import { TRANSIT_STATIONS } from '../../city/data/year-towns/transit';
import { terrainHeight } from '../../city/data/terrain/heightfield/terrainHeight';
import { YEAR_TOWN_BUILDING_EXTRAS } from '../../city/data/year-towns/gen-buildings';

// yearTownDecor —— 各镇年代感主题装置（T6，设计 docs/year-towns-design.md §4
// 「氛围道具」列）：每镇标志性装置 + 镇内地标（XL）夜间信标。
//
// 契约：
// - 落位只走两条「结构零冲突带」：①进镇迎宾带（s ≤ −(rBuild+1)，大街建筑
//   的 s 下界 ≈ −rBuild+3.5，环带 1 的外缘 ≈ rBuild−0.7+size/2，均触不到）；
//   ②2019 手工带（逐项核过 ORIGIN_VILLAGE_LAYOUT 四矩形与两站泊位）。
//   绝不进大街走廊（|lateral| < 2.3 的对景视廊）。
// - 主题色每镇 ≤3 常量（设计 §4「色彩 ≤3」），夜间灯效一律 emissive 材质，
//   不加真实光源（单 WebGL 上下文与现有灯光体系红线，设计 §5）。
// - XL 信标高度按建筑建成后的 Box3 实测（浮空光柱 = 通用对景语言，短 XL
//   也成立），脉冲/旗摆/喷泉为矩阵与材质级更新（无 gsap，reduced 兼容）。
// - 数据唯一事实源：towns.ts / transit.ts / gen-buildings（本文件零坐标
//   重写，2019 手工点除外——与生成器 ORIGIN_VILLAGE_LAYOUT 同源核过）。

type PropKind =
  | 'bonfire' | 'flagpole' | 'streetlamp' | 'board' | 'stringlights' | 'bench'
  | 'fountain' | 'palm' | 'billboard' | 'neonsign' | 'awning' | 'catsign'
  | 'lanternpost' | 'windflag' | 'lighthouse' | 'antenna' | 'glowpad';

/** 每镇装置表：s = 沿街轴（站台→镇心为 +，负值靠站台）；lat = 横向（± 街两侧）。 */
const TOWN_PROPS: Readonly<Record<number, readonly { kind: PropKind; s: number; lat: number; tint?: number; flip?: boolean }[]>> = {
  2019: [], // 手工带：村口篝火 + 双旗杆（绝对方位见 ORIGIN_DECOR）
  2020: [
    { kind: 'streetlamp', s: -8.4, lat: -2.0 },
    { kind: 'streetlamp', s: -8.4, lat: 2.0 },
    { kind: 'board', s: -7.2, lat: -3.1 },
    { kind: 'streetlamp', s: -10.2, lat: -2.0, flip: true },
    { kind: 'streetlamp', s: -10.2, lat: 2.0, flip: true },
  ],
  2021: [
    { kind: 'stringlights', s: -9.0, lat: -2.4 },
    { kind: 'stringlights', s: -9.0, lat: 2.4, flip: true },
    { kind: 'bench', s: -7.6, lat: -2.2 },
    { kind: 'bench', s: -7.6, lat: 2.2, flip: true },
    { kind: 'stringlights', s: -11.4, lat: -2.2, flip: true },
  ],
  2022: [
    { kind: 'fountain', s: -10.4, lat: -3.4 },
    { kind: 'palm', s: -12.2, lat: 2.6 },
    { kind: 'palm', s: -12.2, lat: -3.6, flip: true },
    { kind: 'billboard', s: -9.4, lat: 3.2, flip: true },
    { kind: 'streetlamp', s: -16.0, lat: -2.0 },
    { kind: 'streetlamp', s: -16.0, lat: 2.0 },
    { kind: 'streetlamp', s: -13.6, lat: -2.0, flip: true },
    { kind: 'streetlamp', s: -13.6, lat: 2.0, flip: true },
  ],
  2023: [
    { kind: 'neonsign', s: -9.2, lat: -3.2, tint: 0xff6f9c },
    { kind: 'neonsign', s: -9.2, lat: 3.2, tint: 0x7ce8d8, flip: true },
    { kind: 'awning', s: -10.6, lat: -2.6, tint: 0xb59a7a },
    { kind: 'awning', s: -10.6, lat: 2.6, tint: 0x8c6f52, flip: true },
    { kind: 'neonsign', s: -13.4, lat: -2.8, tint: 0xffc873, flip: true },
  ],
  2024: [
    { kind: 'catsign', s: -8.6, lat: -3.0 },
    { kind: 'lanternpost', s: -7.4, lat: 2.4 },
    { kind: 'lanternpost', s: -7.4, lat: -2.4, flip: true },
    { kind: 'lanternpost', s: -10.2, lat: 2.8, flip: true },
    { kind: 'catsign', s: -12.0, lat: 2.8, flip: true },
  ],
  2025: [
    { kind: 'windflag', s: -8.6, lat: -2.2, tint: 0x2a3038 },
    { kind: 'windflag', s: -8.6, lat: 2.2, tint: 0x2a3038, flip: true },
    { kind: 'lighthouse', s: -12.4, lat: -3.6 },
    { kind: 'windflag', s: -11.4, lat: 2.8, tint: 0x3b6fe0, flip: true },
  ],
  2026: [
    { kind: 'antenna', s: -9.0, lat: -2.8 },
    { kind: 'antenna', s: -9.0, lat: 2.8, flip: true },
    { kind: 'glowpad', s: -11.2, lat: 0 },
    { kind: 'antenna', s: -11.6, lat: 0, tint: 0x6fa8ff },
  ],
};

/** 2019 手工装置带（与生成器 ORIGIN_VILLAGE_LAYOUT 四矩形 + 桥/环线两泊位逐项核距）。 */
const ORIGIN_DECOR: readonly { kind: PropKind; x: number; z: number; tint?: number }[] = [
  { kind: 'bonfire', x: 100.5, z: 199.8 }, // 距 tower 4.45 / rank1 5.5 / 桥站泊位 4.5
  { kind: 'flagpole', x: 92.3, z: 206.6, tint: 0xe8a838 },
  { kind: 'flagpole', x: 99.7, z: 206.6, tint: 0xe8d5a8 },
];

export type YearTownDecorUpdate = (elapsed: number) => void;

export function createYearTownDecor(options: {
  scene: THREE.Scene;
  /** 建成后的建筑实体（XL 信标实测 Box3 顶面用）。 */
  buildings: readonly { id: string; group: THREE.Object3D }[];
}): { update: YearTownDecorUpdate; dispose(): void } {
  const geometries = new Set<THREE.BufferGeometry>();
  const materials = new Set<THREE.Material>();
  const root = new THREE.Group();
  root.name = 'year-town-decor';
  const animated: { sway?: { object: THREE.Object3D; phase: number }; halo?: { mat: THREE.MeshBasicMaterial; phase: number }; jet?: { object: THREE.Object3D; phase: number } }[] = [];
  const glowSprites: { object: THREE.Object3D; phase: number }[] = [];

  const mat = (parameters: THREE.MeshStandardMaterialParameters): THREE.MeshStandardMaterial => {
    const material = new THREE.MeshStandardMaterial({ flatShading: true, ...parameters });
    materials.add(material);
    return material;
  };
  const basicMat = (parameters: THREE.MeshBasicMaterialParameters): THREE.MeshBasicMaterial => {
    const material = new THREE.MeshBasicMaterial(parameters);
    materials.add(material);
    return material;
  };
  const part = (group: THREE.Object3D, geometry: THREE.BufferGeometry, material: THREE.Material, position: readonly [number, number, number], rotationY?: number) => {
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.set(position[0], position[1], position[2]);
    if (rotationY !== undefined) mesh.rotation.y = rotationY;
    group.add(mesh);
    geometries.add(geometry);
    return mesh;
  };

  // ── 共享材质（装置间共享；dispose 统一回收）────────────────────────────
  const M = {
    wood: mat({ color: 0x8a6a4a, roughness: 0.9 }),
    darkWood: mat({ color: 0x6f5238, roughness: 0.9 }),
    stone: mat({ color: 0xb5b2ac, roughness: 0.95 }),
    metal: mat({ color: 0x8a8a8e, roughness: 0.5, metalness: 0.4 }),
    white: mat({ color: 0xf0efec, roughness: 0.8 }),
    frame: mat({ color: 0x2a3038, roughness: 0.6, metalness: 0.3 }),
    green: mat({ color: 0x4a7a52, roughness: 0.9 }),
    water: mat({ color: 0xc8daff, roughness: 0.3, metalness: 0.1 }),
    glowWarm: mat({ color: 0xffc873, emissive: 0xffb45e, emissiveIntensity: 0.85, roughness: 0.5 }),
    glowBlue: mat({ color: 0x6fa8ff, emissive: 0x4f8fe6, emissiveIntensity: 0.85, roughness: 0.5 }),
    flame: basicMat({ color: 0xffa53c, transparent: true, opacity: 0.85 }),
    beacon: basicMat({ color: 0xffd9a0, transparent: true, opacity: 0.42, depthWrite: false }),
    beaconCore: mat({ color: 0xfff2d8, emissive: 0xffc86e, emissiveIntensity: 1.1, roughness: 0.4 }),
  };

  const flagMats = new Map<number, THREE.MeshStandardMaterial>();
  const flagMat = (tint: number): THREE.MeshStandardMaterial => {
    const cached = flagMats.get(tint);
    if (cached) return cached;
    const created = mat({ color: tint, roughness: 0.8, side: THREE.DoubleSide });
    flagMats.set(tint, created);
    return created;
  };

  // ── 装置几何（全部程序化小件；flatShading 低多边形语言，与岛台同族）────
  function buildBonfire(): THREE.Group {
    const g = new THREE.Group();
    // 石圈
    for (let i = 0; i < 6; i += 1) {
      const a = (i / 6) * Math.PI * 2;
      part(g, new THREE.BoxGeometry(0.34, 0.22, 0.22), M.stone, [Math.cos(a) * 0.62, 0.11, Math.sin(a) * 0.62], -a);
    }
    // 交叉柴堆
    for (let i = 0; i < 3; i += 1) {
      const a = (i / 3) * Math.PI;
      const log = part(g, new THREE.CylinderGeometry(0.09, 0.09, 1.0, 6), M.darkWood, [0, 0.24, 0]);
      log.rotation.z = a;
    }
    // 焰锥（双层）+ 荒原第一盏灯的常明意象
    part(g, new THREE.ConeGeometry(0.34, 0.9, 7), M.flame, [0, 0.85, 0]);
    const inner = part(g, new THREE.ConeGeometry(0.18, 0.55, 6), M.glowWarm, [0, 0.7, 0]);
    inner.rotation.y = 0.4;
    glowSprites.push({ object: inner, phase: 1.7 });
    return g;
  }

  function buildFlagpole(tint: number): THREE.Group {
    const g = new THREE.Group();
    part(g, new THREE.CylinderGeometry(0.06, 0.08, 3.4, 8), M.metal, [0, 1.7, 0]);
    part(g, new THREE.SphereGeometry(0.09, 8, 8), M.white, [0, 3.44, 0]);
    const flag = part(g, new THREE.BoxGeometry(0.9, 0.5, 0.04), flagMat(tint), [0.47, 3.0, 0]);
    animated.push({ sway: { object: flag, phase: 0.6 }, halo: undefined, jet: undefined });
    return g;
  }

  function buildStreetlamp(vintage: boolean): THREE.Group {
    const g = new THREE.Group();
    part(g, new THREE.CylinderGeometry(0.06, 0.09, 2.6, 8), vintage ? M.darkWood : M.metal, [0, 1.3, 0]);
    if (vintage) {
      part(g, new THREE.CylinderGeometry(0.07, 0.07, 0.5, 8), M.darkWood, [0.25, 2.5, 0], 0).rotation.z = Math.PI / 2.5;
      const lantern = part(g, new THREE.BoxGeometry(0.3, 0.34, 0.3), M.glowWarm, [0.5, 2.28, 0]);
      part(g, new THREE.ConeGeometry(0.26, 0.18, 4), M.darkWood, [0.5, 2.54, 0], Math.PI / 4);
      glowSprites.push({ object: lantern, phase: 2.2 });
    } else {
      const lamp = part(g, new THREE.SphereGeometry(0.16, 8, 8), M.glowWarm, [0, 2.68, 0]);
      glowSprites.push({ object: lamp, phase: 2.6 });
    }
    return g;
  }

  function buildBoard(): THREE.Group {
    const g = new THREE.Group();
    part(g, new THREE.BoxGeometry(0.12, 1.7, 0.12), M.wood, [-0.75, 0.85, 0]);
    part(g, new THREE.BoxGeometry(0.12, 1.7, 0.12), M.wood, [0.75, 0.85, 0]);
    part(g, new THREE.BoxGeometry(1.9, 1.0, 0.1), M.white, [0, 1.3, 0]);
    part(g, new THREE.BoxGeometry(1.7, 0.72, 0.04), M.stone, [0, 1.3, 0.08]);
    part(g, new THREE.BoxGeometry(2.1, 0.14, 0.3), M.darkWood, [0, 1.92, 0]);
    return g;
  }

  function buildStringLights(): THREE.Group {
    const g = new THREE.Group();
    part(g, new THREE.CylinderGeometry(0.05, 0.07, 2.3, 8), M.wood, [-1.1, 1.15, 0]);
    part(g, new THREE.CylinderGeometry(0.05, 0.07, 2.3, 8), M.wood, [1.1, 1.15, 0]);
    part(g, new THREE.BoxGeometry(2.3, 0.04, 0.04), M.darkWood, [0, 2.2, 0]);
    for (let i = 0; i < 5; i += 1) {
      const bulb = part(g, new THREE.SphereGeometry(0.075, 6, 6), i % 2 === 0 ? M.glowWarm : M.glowBlue, [-0.88 + i * 0.44, 2.08 - (i % 2) * 0.08, 0]);
      glowSprites.push({ object: bulb, phase: i * 0.9 });
    }
    return g;
  }

  function buildBench(): THREE.Group {
    const g = new THREE.Group();
    part(g, new THREE.BoxGeometry(1.5, 0.09, 0.5), M.wood, [0, 0.5, 0]);
    part(g, new THREE.BoxGeometry(1.5, 0.5, 0.07), M.wood, [0, 0.78, -0.24]);
    part(g, new THREE.BoxGeometry(0.1, 0.5, 0.44), M.darkWood, [-0.65, 0.25, 0]);
    part(g, new THREE.BoxGeometry(0.1, 0.5, 0.44), M.darkWood, [0.65, 0.25, 0]);
    return g;
  }

  function buildFountain(): THREE.Group {
    const g = new THREE.Group();
    part(g, new THREE.CylinderGeometry(1.35, 1.5, 0.45, 12), M.stone, [0, 0.22, 0]);
    part(g, new THREE.CylinderGeometry(1.18, 1.18, 0.1, 12), M.water, [0, 0.47, 0]);
    part(g, new THREE.CylinderGeometry(0.22, 0.3, 0.9, 10), M.stone, [0, 0.9, 0]);
    part(g, new THREE.CylinderGeometry(0.5, 0.5, 0.1, 12), M.water, [0, 1.36, 0]);
    const jet = part(g, new THREE.CylinderGeometry(0.1, 0.24, 1.1, 8), M.water, [0, 1.95, 0]);
    animated.push({ sway: undefined, halo: undefined, jet: { object: jet, phase: 0.0 } });
    return g;
  }

  function buildPalm(): THREE.Group {
    const g = new THREE.Group();
    const trunk = part(g, new THREE.CylinderGeometry(0.12, 0.2, 2.8, 7), M.wood, [0, 1.4, 0]);
    trunk.rotation.z = 0.08;
    for (let i = 0; i < 6; i += 1) {
      const a = (i / 6) * Math.PI * 2;
      const leaf = part(g, new THREE.BoxGeometry(1.3, 0.06, 0.34), M.green, [Math.cos(a) * 0.6, 2.78, Math.sin(a) * 0.6], -a);
      leaf.rotation.z = -0.35;
      leaf.rotation.order = 'YXZ';
      leaf.rotation.x = 0;
    }
    return g;
  }

  function buildBillboard(): THREE.Group {
    const g = new THREE.Group();
    part(g, new THREE.BoxGeometry(0.14, 2.2, 0.14), M.metal, [-0.9, 1.1, 0]);
    part(g, new THREE.BoxGeometry(0.14, 2.2, 0.14), M.metal, [0.9, 1.1, 0]);
    part(g, new THREE.BoxGeometry(2.3, 1.2, 0.14), M.frame, [0, 2.1, 0]);
    part(g, new THREE.BoxGeometry(2.0, 0.92, 0.06), M.glowWarm, [0, 2.1, 0.1]);
    const edge = part(g, new THREE.BoxGeometry(2.34, 0.08, 0.18), M.glowWarm, [0, 2.74, 0]);
    edge.scale.set(1, 1, 1);
    glowSprites.push({ object: edge, phase: 3.1 });
    return g;
  }

  function buildNeonSign(tint: number): THREE.Group {
    const g = new THREE.Group();
    const neon = mat({ color: tint, emissive: tint, emissiveIntensity: 1.25, roughness: 0.4 });
    part(g, new THREE.BoxGeometry(0.1, 2.4, 0.1), M.metal, [-0.7, 1.2, 0]);
    part(g, new THREE.BoxGeometry(0.1, 2.4, 0.1), M.metal, [0.7, 1.2, 0]);
    const panel = part(g, new THREE.BoxGeometry(1.7, 0.5, 0.08), neon, [0, 2.0, 0]);
    const panel2 = part(g, new THREE.BoxGeometry(1.1, 0.3, 0.08), neon, [0, 1.4, 0]);
    glowSprites.push({ object: panel, phase: 4.2 }, { object: panel2, phase: 4.2 });
    return g;
  }

  function buildAwning(tint: number): THREE.Group {
    const g = new THREE.Group();
    part(g, new THREE.CylinderGeometry(0.05, 0.06, 2.0, 7), M.wood, [-0.9, 1.0, 0]);
    part(g, new THREE.CylinderGeometry(0.05, 0.06, 2.0, 7), M.wood, [0.9, 1.0, 0]);
    const cloth = part(g, new THREE.BoxGeometry(2.1, 0.05, 0.9), flagMat(tint), [0, 2.05, 0.1]);
    cloth.rotation.x = -0.35;
    return g;
  }

  function buildCatSign(): THREE.Group {
    const g = new THREE.Group();
    part(g, new THREE.BoxGeometry(0.12, 2.2, 0.12), M.metal, [0, 1.1, 0]);
    const head = part(g, new THREE.BoxGeometry(0.62, 0.5, 0.08), M.glowWarm, [0, 2.3, 0]);
    part(g, new THREE.ConeGeometry(0.14, 0.26, 4), M.glowWarm, [-0.2, 2.68, 0]);
    part(g, new THREE.ConeGeometry(0.14, 0.26, 4), M.glowWarm, [0.2, 2.68, 0]);
    glowSprites.push({ object: head, phase: 5.0 });
    return g;
  }

  function buildLanternPost(): THREE.Group {
    const g = new THREE.Group();
    part(g, new THREE.CylinderGeometry(0.05, 0.07, 1.6, 7), M.darkWood, [0, 0.8, 0]);
    const cube = part(g, new THREE.BoxGeometry(0.24, 0.24, 0.24), M.glowWarm, [0, 1.72, 0]);
    cube.rotation.y = Math.PI / 4;
    glowSprites.push({ object: cube, phase: 5.6 });
    return g;
  }

  function buildWindFlag(tint: number): THREE.Group {
    const g = new THREE.Group();
    part(g, new THREE.CylinderGeometry(0.05, 0.07, 3.0, 8), M.metal, [0, 1.5, 0]);
    const flag = part(g, new THREE.BoxGeometry(1.1, 0.6, 0.035), flagMat(tint), [0.58, 2.6, 0]);
    animated.push({ sway: { object: flag, phase: 1.2 }, halo: undefined, jet: undefined });
    return g;
  }

  function buildLighthouse(): THREE.Group {
    const g = new THREE.Group();
    part(g, new THREE.CylinderGeometry(0.55, 0.85, 3.4, 10), M.white, [0, 1.7, 0]);
    part(g, new THREE.CylinderGeometry(0.6, 0.6, 0.3, 10), M.frame, [0, 0.15, 0]);
    part(g, new THREE.CylinderGeometry(0.6, 0.6, 0.3, 10), M.frame, [0, 1.75, 0]);
    part(g, new THREE.CylinderGeometry(0.62, 0.62, 0.26, 10), M.frame, [0, 3.45, 0]);
    const lantern = part(g, new THREE.CylinderGeometry(0.4, 0.4, 0.5, 8), M.glowWarm, [0, 3.7, 0]);
    part(g, new THREE.ConeGeometry(0.5, 0.4, 8), M.frame, [0, 4.14, 0]);
    // 光束（半透明长锥，灯塔扫海的意象；夜间 emissive 自明）
    const beam = part(g, new THREE.ConeGeometry(0.7, 3.6, 8, 1, true), basicMat({ color: 0xfff0c8, transparent: true, opacity: 0.3, depthWrite: false, side: THREE.DoubleSide }), [1.9, 3.7, 0]);
    beam.rotation.z = Math.PI / 2.18;
    glowSprites.push({ object: lantern, phase: 6.1 }, { object: beam, phase: 6.1 });
    return g;
  }

  function buildAntenna(tint: number): THREE.Group {
    const g = new THREE.Group();
    const mast = part(g, new THREE.CylinderGeometry(0.06, 0.1, 3.6, 7), M.frame, [0, 1.8, 0]);
    mast.rotation.z = 0.05;
    const tip = part(g, new THREE.SphereGeometry(0.1, 8, 8), mat({ color: tint, emissive: tint, emissiveIntensity: 1.1, roughness: 0.4 }), [0.18, 3.62, 0]);
    for (let i = 0; i < 2; i += 1) {
      const dish = part(g, new THREE.ConeGeometry(0.3, 0.18, 8, 1, true), M.metal, [i === 0 ? -0.34 : 0.3, 1.6 + i * 0.8, 0]);
      dish.rotation.z = i === 0 ? Math.PI / 2.6 : -Math.PI / 2.6;
    }
    glowSprites.push({ object: tip, phase: 6.8 });
    return g;
  }

  function buildGlowPad(): THREE.Group {
    const g = new THREE.Group();
    const disc = part(g, new THREE.CylinderGeometry(1.5, 1.5, 0.07, 16), basicMat({ color: 0x6fa8ff, transparent: true, opacity: 0.35, depthWrite: false }), [0, 0.04, 0]);
    const ring = part(g, new THREE.TorusGeometry(1.5, 0.06, 8, 24), M.glowBlue, [0, 0.07, 0]);
    ring.rotation.x = Math.PI / 2;
    glowSprites.push({ object: disc, phase: 7.4 }, { object: ring, phase: 7.4 });
    return g;
  }

  const BUILDERS: Record<PropKind, (tint?: number, flip?: boolean) => THREE.Group> = {
    bonfire: () => buildBonfire(),
    flagpole: (tint) => buildFlagpole(tint ?? 0xe8a838),
    streetlamp: (_t, flip) => buildStreetlamp(!flip),
    board: () => buildBoard(),
    stringlights: (_t, flip) => flip ? buildStringLights() : buildStringLights(),
    bench: () => buildBench(),
    fountain: () => buildFountain(),
    palm: () => buildPalm(),
    billboard: () => buildBillboard(),
    neonsign: (tint) => buildNeonSign(tint ?? 0xff6f9c),
    awning: (tint) => buildAwning(tint ?? 0xb59a7a),
    catsign: () => buildCatSign(),
    lanternpost: () => buildLanternPost(),
    windflag: (tint) => buildWindFlag(tint ?? 0x2a3038),
    lighthouse: () => buildLighthouse(),
    antenna: (tint) => buildAntenna(tint ?? 0x9ecbff),
    glowpad: () => buildGlowPad(),
  };

  function ground(group: THREE.Object3D, x: number, z: number): void {
    group.position.set(x, terrainHeight(x, z), z);
    root.add(group);
  }

  // ── 装置落位（通用镇：迎宾带；2019：手工带）────────────────────────────
  for (const town of YEAR_TOWNS) {
    const entries = TOWN_PROPS[town.year] ?? [];
    if (town.year === 2019) {
      for (const entry of ORIGIN_DECOR) ground(BUILDERS[entry.kind](entry.tint), entry.x, entry.z);
      continue;
    }
    const station = TRANSIT_STATIONS.find((s) => s.id === `station-${town.year}`);
    if (!station) continue;
    const ux = town.x - station.platformX;
    const uz = town.z - station.platformZ;
    const norm = Math.hypot(ux, uz) || 1;
    const uxN = ux / norm, uzN = uz / norm; // 站台 → 镇心
    const pxN = -uzN, pzN = uxN;           // 横向
    const rBuild = town.plateauR - 3.5;
    for (const entry of entries) {
      const builder = BUILDERS[entry.kind];
      const group = builder(entry.tint, entry.flip);
      // 平板校验：装置足印必须留在台面内（外圈装置靠站台侧本来就在台缘内）。
      let s = entry.s;
      if (s > 0) s = Math.min(s, rBuild - 0.4); // 防御性：表内不应出现正值
      const x = town.x + uxN * s + pxN * entry.lat;
      const z = town.z + uzN * s + pzN * entry.lat;
      ground(group, x, z);
      if (entry.flip) group.rotation.y = Math.PI; // 摆件朝向镜像（灯串/招牌面向来客）
    }
  }

  // ── XL 地标信标（实测 Box3 顶面；浮空光柱 + 脉冲光环）──────────────────
  const beaconHalos: { mat: THREE.MeshBasicMaterial; phase: number }[] = [];
  const buildingById = new Map(options.buildings.map((b) => [b.id, b.group]));
  for (const town of YEAR_TOWNS) {
    const xlId = `yt-w${town.year}-01`;
    const group = buildingById.get(xlId);
    if (!group) continue;
    const extras = YEAR_TOWN_BUILDING_EXTRAS[xlId];
    if (!extras || extras.kind !== 'work') continue;
    const box = new THREE.Box3().setFromObject(group);
    const baseY = (group.userData.baseY as number | undefined) ?? 0;
    const topY = box.max.y - (group.position.y - baseY); // 建成时 group 在 baseY−3 入场位
    const beacon = new THREE.Group();
    const column = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.16, 3.4, 8), M.beaconCore);
    column.position.set(0, topY + 2.0, 0);
    geometries.add(column.geometry);
    beacon.add(column);
    const haloMat = basicMat({ color: 0xffd9a0, transparent: true, opacity: 0.5, depthWrite: false, side: THREE.DoubleSide });
    const halo = new THREE.Mesh(new THREE.TorusGeometry(0.55, 0.07, 8, 20), haloMat);
    halo.position.set(0, topY + 3.9, 0);
    halo.rotation.x = Math.PI / 2;
    geometries.add(halo.geometry);
    beacon.add(halo);
    const pillar = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.5, 3.8, 10, 1, true), M.beacon);
    pillar.position.set(0, topY + 1.9, 0);
    geometries.add(pillar.geometry);
    beacon.add(pillar);
    beacon.position.set(group.position.x, 0, group.position.z);
    root.add(beacon);
    beaconHalos.push({ mat: haloMat, phase: (town.year % 4) * 1.6 });
  }

  options.scene.add(root);

  function update(elapsed: number): void {
    const t = elapsed;
    for (const entry of animated) {
      if (entry.sway) entry.sway.object.rotation.y = Math.sin(t * 2.2 + entry.sway.phase) * 0.22;
      if (entry.jet) entry.jet.object.scale.set(1 + Math.sin(t * 3.1) * 0.12, 1 + Math.sin(t * 2.3) * 0.18, 1 + Math.sin(t * 3.1) * 0.12);
    }
    for (const sprite of glowSprites) {
      const phase = Math.sin(t * 1.6 + sprite.phase);
      sprite.object.scale.setScalar(1 + phase * 0.05);
    }
    for (const halo of beaconHalos) {
      halo.mat.opacity = 0.34 + (Math.sin(t * 1.8 + halo.phase) + 1) * 0.14;
    }
  }

  return {
    update,
    dispose(): void {
      root.parent?.remove(root);
      for (const geometry of geometries) geometry.dispose();
      for (const material of materials) material.dispose();
      geometries.clear();
      materials.clear();
      flagMats.clear();
      animated.length = 0;
      glowSprites.length = 0;
      beaconHalos.length = 0;
    },
  };
}
