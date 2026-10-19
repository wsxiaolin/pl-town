// 学校（school）：一座围合式小型校园。
// 后侧教学主楼（两层窗、柱廊门廊、屋顶钟楼）+ 西体育馆（筒拱顶）
// + 东教学楼（四坡顶）+ 中央庭院（草坪、步道、花池、长椅、旗杆）
// + 校门（门柱、铁艺栏杆、匾额）。
//
// 所有体量都落在 7.9 × 4.3 的基座上（含屋檐的总包围盒 ≤ 7.9 × 4.4，
// 两侧仍留 0.05 的街区边距）。基座顶面 0.30，建筑/铺装/绿植统一起到
// 0.32 以上；平面细节之间保持 ≥ 0.005 的 Y 差，避免远镜头 z-fighting。
import * as THREE from 'three';
import type { MeshHelpers } from './meshFactory';
import type { BuildingDefinition, BuildingEntity } from '../city/buildingEntity';

export interface SchoolCampusOptions {
  platformHeight: number;
  makeMaterial: MeshHelpers['stdMat'];
  makeMesh: MeshHelpers['mk'];
  addPart: MeshHelpers['part'];
}

const CREAM = 0xeee6d4;
const BRICK = 0xa6533f;
const ROOF = 0x5a4a44;
const STONE = 0xd6d1c6;
const TRIM = 0xf7f4ec;
const GLASS = 0x9cc2dd;
const HEDGE = 0x4d7a3e;
const GRASS = 0x8aa96b;
const GOLD = 0xd9a441;
const IRON = 0x41464d;
const RED = 0xb23a32;

/**
 * 矩形底的四坡屋顶。用显式顶点而不是「圆锥旋转 + 压扁」：后者会被
 * Box3 当成旋转后的包围盒，把校园碰撞/占地放大近 1 米。
 * 三角形按外向法线绕序排列，否则 FrontSide 材质会把屋顶整个裁掉。
 */
function pyramidGeometry(width: number, depth: number, height: number): THREE.BufferGeometry {
  const hw = width / 2;
  const hd = depth / 2;
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute([
    -hw, 0, -hd,
    hw, 0, -hd,
    hw, 0, hd,
    -hw, 0, hd,
    0, height, 0,
  ], 3));
  geometry.setIndex([
    0, 3, 2, 0, 1, 2,
    0, 4, 1, 1, 4, 2, 2, 4, 3, 3, 4, 0,
  ]);
  const flat = geometry.toNonIndexed();
  flat.computeVertexNormals();
  return flat;
}

export function buildSchoolCampus(options: SchoolCampusOptions, definition: BuildingDefinition): BuildingEntity {
  const { addPart, makeMaterial, makeMesh, platformHeight } = options;
  const group = new THREE.Group();

  const SITE_W = 7.9;
  const SITE_D = 4.35;
  const BASE_H = platformHeight;
  const BASE_TOP = BASE_H;
  // 建筑、铺装、绿植都从基座顶面以上 0.02 起，避免与基座顶面共面。
  const F = BASE_TOP + 0.02;

  const MAIN_W = 6.3;
  const MAIN_D = 1.5;
  const MAIN_H = 2.05;
  const MAIN_Z = -1.35;
  const WING_W = 2.0;
  const WING_D = 2.0;
  const WING_H = 1.45;
  const WING_Z = 0.5;
  const WING_X = 2.9;

  const wall = makeMaterial({ color: CREAM, roughness: 0.76, tex: 'wall', rx: 5, ry: 2 });
  const brick = makeMaterial({ color: BRICK, roughness: 0.82, tex: 'schoolbrick', rx: 2, ry: 1 });

  // ── 基座、草坪与中央步道 ──────────────────────────────
  addPart(group, new THREE.BoxGeometry(SITE_W, BASE_H, SITE_D), { color: STONE, roughness: 0.92, tex: 'stone', rx: 4, ry: 2 }, [0, BASE_H / 2, 0]);
  addPart(group, new THREE.BoxGeometry(3.7, 0.02, 2.1), { color: GRASS, roughness: 0.92, tex: 'grass', rx: 3, ry: 2 }, [0, F + 0.01, 0.45], false);
  addPart(group, new THREE.BoxGeometry(1.1, 0.03, 2.1), { color: 0xe4dfd2, roughness: 0.9, tex: 'pavement', rx: 1, ry: 2 }, [0, F + 0.025, 0.45], false);

  // ── 教学主楼 ────────────────────────────────────────
  const body = makeMesh(new THREE.BoxGeometry(MAIN_W, MAIN_H, MAIN_D), wall);
  body.position.set(0, F + MAIN_H / 2, MAIN_Z);
  body.castShadow = body.receiveShadow = true;
  group.add(body);
  const mainTop = F + MAIN_H;

  // 檐口 + 四坡屋顶。屋顶底面比檐口顶面高 0.01，避免两层水平面共面。
  addPart(group, new THREE.BoxGeometry(7.0, 0.12, 1.7), { color: ROOF, roughness: 0.62, tex: 'rooftile', rx: 4, ry: 2 }, [0, mainTop + 0.05, MAIN_Z]);
  addPart(group, pyramidGeometry(6.9, 1.6, 0.55), { color: ROOF, roughness: 0.6, tex: 'rooftile', rx: 3, ry: 2 }, [0, mainTop + 0.12, MAIN_Z]);

  // 屋顶钟楼与四向钟面。
  addPart(group, new THREE.BoxGeometry(0.85, 1.0, 0.85), { color: CREAM, roughness: 0.72, tex: 'wall', rx: 1, ry: 2 }, [0, mainTop + 0.67, MAIN_Z]);
  const clockFace = { color: 0xf8f4e8, roughness: 0.32, emissive: 0xf8f4e8, emissiveIntensity: 0.05 };
  const clockY = mainTop + 0.77;
  const clockFaces: Array<[number, number, number, number]> = [
    [0, clockY, MAIN_Z + 0.44, 0],
    [0, clockY, MAIN_Z - 0.44, Math.PI],
    [0.44, clockY, MAIN_Z, Math.PI / 2],
    [-0.44, clockY, MAIN_Z, -Math.PI / 2],
  ];
  clockFaces.forEach(([x, y, z, rotation]) => {
    const face = addPart(group, new THREE.CylinderGeometry(0.2, 0.2, 0.04, 18), clockFace, [x, y, z], false);
    // 圆盘轴线是局部 +Y：前后盘绕 X 转到 ±Z，侧盘绕 Z 转到 ±X。
    if (rotation === 0 || rotation === Math.PI) face.rotation.x = Math.PI / 2;
    else face.rotation.z = rotation;
  });
  addPart(group, new THREE.BoxGeometry(0.025, 0.14, 0.02), { color: 0x2a2a2a, roughness: 0.4 }, [0, clockY + 0.05, MAIN_Z + 0.475], false);
  addPart(group, new THREE.BoxGeometry(0.12, 0.025, 0.02), { color: 0x2a2a2a, roughness: 0.4 }, [0.05, clockY, MAIN_Z + 0.475], false);
  addPart(group, pyramidGeometry(1.0, 1.0, 0.4), { color: ROOF, roughness: 0.55, tex: 'rooftile', rx: 1, ry: 1 }, [0, mainTop + 1.165, MAIN_Z]);
  addPart(group, new THREE.SphereGeometry(0.05, 8, 8), { color: GOLD, emissive: GOLD, emissiveIntensity: 0.25 }, [0, mainTop + 1.59, MAIN_Z], false);

  // 主楼窗：前/后各两层，侧面各两层。所有窗框都离开墙面 0.01 以上。
  const frontWindow = (x: number, y: number, zFace: number, dir: 1 | -1) => {
    const z = zFace;
    const sign = dir;
    addPart(group, new THREE.BoxGeometry(0.56, 0.66, 0.05), { color: TRIM, roughness: 0.7 }, [x, y, z + sign * 0.035], false);
    addPart(group, new THREE.BoxGeometry(0.46, 0.56, 0.02), { color: GLASS, roughness: 0.14, metalness: 0.18, tex: 'glass', rx: 1, ry: 1 }, [x, y, z + sign * 0.075], false);
    addPart(group, new THREE.BoxGeometry(0.02, 0.56, 0.02), { color: TRIM, roughness: 0.7 }, [x, y, z + sign * 0.09], false);
  };
  const sideWindow = (xFace: number, y: number, z: number, dir: 1 | -1) => {
    addPart(group, new THREE.BoxGeometry(0.05, 0.66, 0.52), { color: TRIM, roughness: 0.7 }, [xFace + dir * 0.035, y, z], false);
    addPart(group, new THREE.BoxGeometry(0.02, 0.56, 0.42), { color: GLASS, roughness: 0.14, metalness: 0.18, tex: 'glass', rx: 1, ry: 1 }, [xFace + dir * 0.075, y, z], false);
    addPart(group, new THREE.BoxGeometry(0.02, 0.56, 0.02), { color: TRIM, roughness: 0.7 }, [xFace + dir * 0.09, y, z], false);
  };
  const frontZ = MAIN_Z + MAIN_D / 2;
  const rearZ = MAIN_Z - MAIN_D / 2;
  for (const y of [F + 0.62, F + 1.55]) {
    for (const x of [-2.35, -1.45, 1.45, 2.35]) {
      frontWindow(x, y, frontZ, 1);
      frontWindow(x, y, rearZ, -1);
    }
    for (const z of [-1.85, -0.95]) {
      sideWindow(MAIN_W / 2, y, z, 1);
      sideWindow(-MAIN_W / 2, y, z, -1);
    }
  }

  // 门廊：台阶、四柱、檐部与浅四坡顶。
  addPart(group, new THREE.BoxGeometry(2.2, 0.08, 0.5), { color: STONE, roughness: 0.85, tex: 'stone', rx: 2, ry: 1 }, [0, F + 0.04, -0.05], false);
  addPart(group, new THREE.BoxGeometry(2.0, 0.08, 0.35), { color: STONE, roughness: 0.85, tex: 'stone', rx: 2, ry: 1 }, [0, F + 0.07, -0.225], false);
  for (const x of [-0.85, -0.3, 0.3, 0.85]) {
    addPart(group, new THREE.CylinderGeometry(0.06, 0.07, 1.34, 10), { color: TRIM, roughness: 0.5 }, [x, F + 0.66, -0.25]);
  }
  addPart(group, new THREE.BoxGeometry(2.2, 0.1, 0.55), { color: TRIM, roughness: 0.6, tex: 'stone', rx: 2, ry: 1 }, [0, F + 1.37, -0.29]);
  addPart(group, pyramidGeometry(2.3, 0.65, 0.22), { color: ROOF, roughness: 0.6, tex: 'rooftile', rx: 2, ry: 1 }, [0, F + 1.41, -0.29]);
  addPart(group, new THREE.BoxGeometry(1.0, 0.12, 0.03), { color: GOLD, roughness: 0.4, metalness: 0.3 }, [0, F + 1.40, 0.005], false);

  // 大门与门楣气窗。
  addPart(group, new THREE.BoxGeometry(1.25, 1.45, 0.05), { color: 0x6b4a35, roughness: 0.7, tex: 'wood', rx: 1, ry: 2 }, [0, F + 0.725, frontZ + 0.035], false);
  addPart(group, new THREE.BoxGeometry(1.05, 1.25, 0.03), { color: 0x3f2d22, roughness: 0.65, tex: 'wood', rx: 1, ry: 2 }, [0, F + 0.66, frontZ + 0.0725], false);
  addPart(group, new THREE.BoxGeometry(0.85, 0.2, 0.04), { color: GLASS, roughness: 0.12, metalness: 0.2, tex: 'glass', rx: 1, ry: 1 }, [0, F + 1.35, frontZ + 0.065], false);

  // ── 西体育馆：砖墙 + 筒拱屋顶 ────────────────────────
  addPart(group, new THREE.BoxGeometry(WING_W, WING_H, WING_D), { color: BRICK, roughness: 0.82, tex: 'schoolbrick', rx: 2, ry: 1 }, [-WING_X, F + WING_H / 2, WING_Z]);
  addPart(group, new THREE.BoxGeometry(WING_W + 0.04, 0.12, WING_D + 0.04), { color: TRIM, roughness: 0.7, tex: 'stone', rx: 1, ry: 1 }, [-WING_X, F + WING_H - 0.08, WING_Z], false);
  const barrel = addPart(group, new THREE.CylinderGeometry(0.55, 0.55, 2.0, 18), { color: 0xa9a6a0, roughness: 0.45, metalness: 0.25, tex: 'metal', rx: 2, ry: 1 }, [-WING_X, F + WING_H, WING_Z]);
  barrel.rotation.x = Math.PI / 2;

  const gymFrontZ = WING_Z + WING_D / 2;
  addPart(group, new THREE.BoxGeometry(0.72, 1.02, 0.04), { color: 0x5d3f2c, roughness: 0.7, tex: 'wood', rx: 1, ry: 1 }, [-WING_X, F + 0.51, gymFrontZ + 0.03], false);
  for (const x of [-3.45, -2.35]) {
    addPart(group, new THREE.BoxGeometry(0.38, 0.52, 0.04), { color: TRIM, roughness: 0.7 }, [x, F + 0.86, gymFrontZ + 0.03], false);
    addPart(group, new THREE.BoxGeometry(0.3, 0.42, 0.02), { color: GLASS, roughness: 0.14, metalness: 0.18, tex: 'glass', rx: 1, ry: 1 }, [x, F + 0.86, gymFrontZ + 0.065], false);
  }
  for (const z of [-0.15, 0.8]) {
    addPart(group, new THREE.BoxGeometry(0.04, 0.52, 0.38), { color: TRIM, roughness: 0.7 }, [-WING_X - WING_W / 2 - 0.03, F + 0.86, z], false);
    addPart(group, new THREE.BoxGeometry(0.02, 0.42, 0.3), { color: GLASS, roughness: 0.14, metalness: 0.18, tex: 'glass', rx: 1, ry: 1 }, [-WING_X - WING_W / 2 - 0.045, F + 0.86, z], false);
  }

  // ── 东教学楼：砖墙 + 四坡顶 ─────────────────────────
  addPart(group, new THREE.BoxGeometry(WING_W, 2.0, WING_D), brick, [WING_X, F + 1.0, WING_Z]);
  addPart(group, new THREE.BoxGeometry(WING_W + 0.04, 0.12, WING_D + 0.04), { color: TRIM, roughness: 0.7, tex: 'stone', rx: 1, ry: 1 }, [WING_X, F + 1.92, WING_Z], false);
  addPart(group, new THREE.BoxGeometry(2.1, 0.12, 2.0), { color: ROOF, roughness: 0.6, tex: 'rooftile', rx: 2, ry: 2 }, [WING_X, F + 1.99, 0.55]);
  addPart(group, pyramidGeometry(2.05, 1.9, 0.38), { color: ROOF, roughness: 0.6, tex: 'rooftile', rx: 2, ry: 1 }, [WING_X, F + 2.04, 0.55]);

  const classFrontZ = WING_Z + WING_D / 2;
  addPart(group, new THREE.BoxGeometry(0.55, 1.05, 0.04), { color: 0x5d3f2c, roughness: 0.7, tex: 'wood', rx: 1, ry: 1 }, [WING_X, F + 0.525, classFrontZ + 0.03], false);
  for (const y of [F + 0.7, F + 1.6]) {
    for (const x of [2.35, 3.45]) {
      addPart(group, new THREE.BoxGeometry(0.42, 0.52, 0.04), { color: TRIM, roughness: 0.7 }, [x, y, classFrontZ + 0.03], false);
      addPart(group, new THREE.BoxGeometry(0.34, 0.42, 0.02), { color: GLASS, roughness: 0.14, metalness: 0.18, tex: 'glass', rx: 1, ry: 1 }, [x, y, classFrontZ + 0.065], false);
    }
    for (const z of [-0.25, 0.85]) {
      addPart(group, new THREE.BoxGeometry(0.04, 0.52, 0.42), { color: TRIM, roughness: 0.7 }, [WING_X + WING_W / 2 + 0.03, y, z], false);
      addPart(group, new THREE.BoxGeometry(0.02, 0.42, 0.34), { color: GLASS, roughness: 0.14, metalness: 0.18, tex: 'glass', rx: 1, ry: 1 }, [WING_X + WING_W / 2 + 0.045, y, z], false);
    }
  }

  // ── 庭院：花池、长椅、旗杆 ──────────────────────────
  for (const x of [-1.6, 1.6]) {
    addPart(group, new THREE.BoxGeometry(0.45, 0.22, 1.0), { color: STONE, roughness: 0.85, tex: 'stone', rx: 1, ry: 2 }, [x, F + 0.12, -0.05], false);
    addPart(group, new THREE.BoxGeometry(0.36, 0.12, 1.0), { color: HEDGE, roughness: 0.9, tex: 'grass', rx: 1, ry: 2 }, [x, F + 0.3, -0.05], false);
  }
  for (const x of [-1.05, 1.05]) {
    addPart(group, new THREE.BoxGeometry(0.24, 0.06, 0.6), { color: 0x8a6a45, roughness: 0.75, tex: 'wood', rx: 1, ry: 1 }, [x, F + 0.29, 0.95], false);
    addPart(group, new THREE.BoxGeometry(0.05, 0.28, 0.6), { color: 0x8a6a45, roughness: 0.75, tex: 'wood', rx: 1, ry: 1 }, [x + Math.sign(x) * 0.1, F + 0.42, 0.95], false);
    for (const z of [0.73, 1.17]) {
      addPart(group, new THREE.BoxGeometry(0.18, 0.28, 0.05), { color: IRON, roughness: 0.5, metalness: 0.3 }, [x, F + 0.13, z], false);
    }
  }

  addPart(group, new THREE.CylinderGeometry(0.025, 0.03, 2.2, 10), { color: 0xcfcecb, roughness: 0.45, metalness: 0.3, tex: 'metal', rx: 1, ry: 2 }, [-0.95, F + 1.1, 1.35]);
  addPart(group, new THREE.BoxGeometry(0.56, 0.32, 0.02), { color: RED, roughness: 0.62, tex: 'fabric', rx: 1, ry: 1 }, [-0.65, F + 1.92, 1.35], false);
  addPart(group, new THREE.SphereGeometry(0.04, 8, 8), { color: GOLD, emissive: GOLD, emissiveIntensity: 0.3 }, [-0.95, F + 2.22, 1.35], false);

  // ── 校门与铁艺栏杆 ──────────────────────────────────
  const gateZ = 2.02;
  for (const x of [-2.1, 2.1]) {
    addPart(group, new THREE.BoxGeometry(0.3, 1.3, 0.3), { color: BRICK, roughness: 0.82, tex: 'schoolbrick', rx: 1, ry: 2 }, [x, F + 0.65, gateZ]);
    addPart(group, new THREE.BoxGeometry(0.4, 0.08, 0.34), { color: TRIM, roughness: 0.6, tex: 'stone', rx: 1, ry: 1 }, [x, F + 1.28, gateZ], false);
    addPart(group, new THREE.SphereGeometry(0.075, 10, 8), { color: 0xffd27f, emissive: 0xffd27f, emissiveIntensity: 0.45, roughness: 0.4 }, [x, F + 1.36, gateZ], false);
  }
  addPart(group, new THREE.BoxGeometry(4.2, 0.12, 0.12), { color: IRON, roughness: 0.45, metalness: 0.35 }, [0, F + 1.33, gateZ], false);
  addPart(group, new THREE.BoxGeometry(2.6, 0.3, 0.06), { color: TRIM, roughness: 0.55, tex: 'stone', rx: 2, ry: 1 }, [0, F + 1.36, gateZ + 0.08], false);
  addPart(group, new THREE.BoxGeometry(2.2, 0.06, 0.02), { color: GOLD, roughness: 0.4, metalness: 0.3 }, [0, F + 1.47, gateZ + 0.125], false);

  for (const side of [-1, 1]) {
    for (const x of [2.45, 2.95, 3.45, 3.85]) {
      addPart(group, new THREE.BoxGeometry(0.05, 0.65, 0.05), { color: IRON, roughness: 0.45, metalness: 0.35 }, [side * x, F + 0.325, gateZ], false);
    }
    addPart(group, new THREE.BoxGeometry(1.4, 0.04, 0.05), { color: IRON, roughness: 0.45, metalness: 0.35 }, [side * 3.15, F + 0.24, gateZ], false);
    addPart(group, new THREE.BoxGeometry(1.4, 0.04, 0.05), { color: IRON, roughness: 0.45, metalness: 0.35 }, [side * 3.15, F + 0.52, gateZ], false);
  }

  // ── 校园树 ──────────────────────────────────────────
  const tree = (x: number, z: number, scale: number) => {
    addPart(group, new THREE.CylinderGeometry(0.055, 0.075, 0.72, 8), { color: 0x6d4c33, roughness: 0.9, tex: 'wood', rx: 1, ry: 1 }, [x, F + 0.37, z]);
    addPart(group, new THREE.SphereGeometry(0.32, 10, 8), { color: GRASS, roughness: 0.92, tex: 'grass', rx: 1, ry: 1 }, [x, F + 0.9, z], false).scale.setScalar(scale);
    addPart(group, new THREE.SphereGeometry(0.22, 9, 7), { color: 0x5f8c4a, roughness: 0.92 }, [x + 0.09 * scale, F + 1.08, z - 0.05], false).scale.setScalar(scale);
  };
  tree(-3.5, -1.8, 1.0);
  tree(3.5, -1.8, 1.0);
  tree(-1.55, 1.1, 0.8);
  tree(1.55, 1.1, 0.8);

  group.position.set(definition.x, 0, definition.z);
  group.traverse((child) => {
    if ((child as THREE.Mesh).isMesh) (child as THREE.Mesh).userData.buildingId = definition.id;
  });

  return {
    ...definition,
    group,
    body,
    bodyMat: wall,
    labelEl: null,
    labelY: mainTop + 2.8,
    skipFacadeDecal: true,
  };
}
