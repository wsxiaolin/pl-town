// 学校（school）：由单栋小学堂重建为一座完整校园。
// 中轴教学主楼（两层窗、柱廊门廊、山花、屋顶钟楼）+ 两翼（体育馆 / 教学楼）
// + 围合庭院（花池、长椅）+ 校门（门柱、铁艺栏杆、匾额、旗杆、路灯）。
// 基座 7.8 × 4.0（含门柱帽与屋檐的总包围盒 ≤ 8.0 × 4.3），落在街区
// 人行道以内；坐标写在返回的 group 上。
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

/** 矩形底的四坡屋顶。用显式顶点而不是「圆锥旋转 + 压扁」：后者会被
 *  Box3 当成旋转后的包围盒，把校园碰撞/占地在 X 向放大近 1 米。 */
function pyramidGeometry(width: number, depth: number, height: number): THREE.BufferGeometry {
  const halfWidth = width / 2;
  const halfDepth = depth / 2;
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute([
    -halfWidth, 0, -halfDepth,
    halfWidth, 0, -halfDepth,
    halfWidth, 0, halfDepth,
    -halfWidth, 0, halfDepth,
    0, height, 0,
  ], 3));
  geometry.setIndex([
    0, 1, 4, 1, 2, 4, 2, 3, 4, 3, 0, 4,
    0, 3, 2, 0, 2, 1,
  ]);
  // 共享顶点会把四面插值成一张「圆顶」；转成非索引几何让每个坡面有独立法线。
  const flat = geometry.toNonIndexed();
  flat.computeVertexNormals();
  return flat;
}

export function buildSchoolCampus(options: SchoolCampusOptions, definition: BuildingDefinition): BuildingEntity {
  const { addPart, makeMaterial, makeMesh } = options;
  const group = new THREE.Group();

  // 基座顶面 0.14；建筑/铺装/绿篱统一起到 0.146，避免与基座顶面共面。
  const BASE = 0.146;
  const MAIN_W = 6.6;
  const MAIN_H = 1.8;
  const MAIN_D = 1.4;
  const MAIN_Z = -1.2;

  // ── 校园基座与庭院铺装 ────────────────────────────────
  addPart(group, new THREE.BoxGeometry(7.8, 0.14, 4.0), { color: STONE, roughness: 0.92, tex: 'stone', rx: 4, ry: 2 }, [0, 0.07, 0]);
  addPart(group, new THREE.BoxGeometry(3.6, 0.024, 1.4), { color: 0xe4dfd2, roughness: 0.9, tex: 'pavement', rx: 3, ry: 1 }, [0, BASE + 0.012, 0.2], false);
  addPart(group, new THREE.BoxGeometry(1.0, 0.024, 2.5), { color: 0xece7da, roughness: 0.88, tex: 'pavement', rx: 1, ry: 2 }, [0, BASE + 0.016, 0.75], false);

  // ── 教学主楼 ────────────────────────────────────────
  const bodyMat = makeMaterial({ color: CREAM, roughness: 0.76, tex: 'wall', rx: 5, ry: 2 });
  const body = makeMesh(new THREE.BoxGeometry(MAIN_W, MAIN_H, MAIN_D), bodyMat);
  body.position.set(0, BASE + MAIN_H / 2, MAIN_Z);
  body.castShadow = body.receiveShadow = true;
  group.add(body);
  const mainTop = BASE + MAIN_H;

  // 檐口 + 四坡屋顶（矩形底，显式顶点，包围盒不外扩）。
  addPart(group, new THREE.BoxGeometry(7.0, 0.12, 1.8), { color: ROOF, roughness: 0.62, tex: 'rooftile', rx: 4, ry: 2 }, [0, mainTop + 0.06, MAIN_Z]);
  addPart(group, pyramidGeometry(7.0, 1.68, 0.62), { color: ROOF, roughness: 0.6, tex: 'rooftile', rx: 3, ry: 2 }, [0, mainTop + 0.08, MAIN_Z]);
  addPart(group, new THREE.BoxGeometry(7.05, 0.08, 0.2), { color: 0x4a3c37, roughness: 0.6 }, [0, mainTop + 0.12, MAIN_Z], false);

  // 主楼窗：两层，立面四组 + 两端山墙各两组。
  const windowFront = (x: number, y: number) => {
    addPart(group, new THREE.BoxGeometry(0.54, 0.6, 0.03), { color: TRIM, roughness: 0.7 }, [x, y, MAIN_Z + MAIN_D / 2 + 0.02], false);
    addPart(group, new THREE.BoxGeometry(0.44, 0.5, 0.02), { color: GLASS, roughness: 0.14, metalness: 0.18, tex: 'glass', rx: 1, ry: 1 }, [x, y, MAIN_Z + MAIN_D / 2 + 0.036], false);
    addPart(group, new THREE.BoxGeometry(0.02, 0.5, 0.02), { color: TRIM, roughness: 0.7 }, [x, y, MAIN_Z + MAIN_D / 2 + 0.048], false);
  };
  const windowSide = (x: number, y: number, z: number) => {
    addPart(group, new THREE.BoxGeometry(0.03, 0.6, 0.54), { color: TRIM, roughness: 0.7 }, [x, y, z], false);
    addPart(group, new THREE.BoxGeometry(0.02, 0.5, 0.44), { color: GLASS, roughness: 0.14, metalness: 0.18, tex: 'glass', rx: 1, ry: 1 }, [x + Math.sign(x) * 0.012, y, z], false);
  };
  for (const y of [BASE + 0.62, BASE + 1.3]) {
    for (const x of [-2.8, -2.0, 2.0, 2.8]) windowFront(x, y);
    for (const z of [-1.7, -0.8]) {
      windowSide(MAIN_W / 2 + 0.015, y, z);
      windowSide(-MAIN_W / 2 - 0.015, y, z);
    }
  }

  // 门廊：台阶、四柱、檐部、山花。
  addPart(group, new THREE.BoxGeometry(3.2, 0.07, 0.34), { color: STONE, roughness: 0.85, tex: 'stone', rx: 2, ry: 1 }, [0, BASE + 0.035, 0.06], false);
  addPart(group, new THREE.BoxGeometry(2.9, 0.07, 0.34), { color: STONE, roughness: 0.85, tex: 'stone', rx: 2, ry: 1 }, [0, BASE + 0.105, -0.12], false);
  for (const x of [-1.0, -0.36, 0.36, 1.0]) {
    addPart(group, new THREE.CylinderGeometry(0.065, 0.075, 1.2, 10), { color: TRIM, roughness: 0.5 }, [x, BASE + 0.74, -0.06]);
  }
  addPart(group, new THREE.BoxGeometry(2.9, 0.14, 0.6), { color: TRIM, roughness: 0.6, tex: 'stone', rx: 2, ry: 1 }, [0, BASE + 1.41, -0.2]);
  const pediment = addPart(group, new THREE.ConeGeometry(2.05, 0.44, 4), { color: TRIM, roughness: 0.62, tex: 'stone', rx: 2, ry: 1 }, [0, BASE + 1.56, -0.2]);
  pediment.rotation.y = Math.PI / 4;
  pediment.scale.z = 0.19;

  // 大门与门楣气窗。
  addPart(group, new THREE.BoxGeometry(1.05, 1.22, 0.05), { color: 0x6b4a35, roughness: 0.7, tex: 'wood', rx: 1, ry: 2 }, [0, BASE + 0.75, MAIN_Z + MAIN_D / 2 + 0.03], false);
  addPart(group, new THREE.BoxGeometry(0.84, 1.02, 0.03), { color: 0x3f2d22, roughness: 0.65, tex: 'wood', rx: 1, ry: 2 }, [0, BASE + 0.72, MAIN_Z + MAIN_D / 2 + 0.045], false);
  addPart(group, new THREE.BoxGeometry(0.7, 0.18, 0.04), { color: GLASS, roughness: 0.12, metalness: 0.2, tex: 'glass', rx: 1, ry: 1 }, [0, BASE + 1.46, MAIN_Z + MAIN_D / 2 + 0.04], false);
  addPart(group, new THREE.CylinderGeometry(0.14, 0.14, 0.05, 20), { color: 0x3b6fe0, emissive: 0x3b6fe0, emissiveIntensity: 0.28 }, [0, BASE + 0.025, 0.16], false);

  // ── 屋顶钟楼 ────────────────────────────────────────
  addPart(group, new THREE.BoxGeometry(0.66, 0.8, 0.66), { color: CREAM, roughness: 0.72, tex: 'wall', rx: 1, ry: 2 }, [0, mainTop + 0.52, MAIN_Z]);
  const clockMat = { color: 0xf8f4e8, roughness: 0.32, emissive: 0xf8f4e8, emissiveIntensity: 0.05 };
  const clockFaces: Array<[number, number, number, number]> = [
    [0, mainTop + 0.62, MAIN_Z + 0.35, 0],
    [0, mainTop + 0.62, MAIN_Z - 0.35, Math.PI],
    [0.35, mainTop + 0.62, MAIN_Z, Math.PI / 2],
    [-0.35, mainTop + 0.62, MAIN_Z, -Math.PI / 2],
  ];
  clockFaces.forEach(([x, y, z, rotation]) => {
    const face = addPart(group, new THREE.CylinderGeometry(0.2, 0.2, 0.04, 18), clockMat, [x, y, z], false);
    face.rotation.x = Math.PI / 2;
    face.rotation.y = rotation;
  });
  addPart(group, new THREE.BoxGeometry(0.025, 0.14, 0.025), { color: 0x2a2a2a, roughness: 0.4 }, [0, mainTop + 0.68, MAIN_Z + 0.39], false);
  addPart(group, new THREE.BoxGeometry(0.12, 0.025, 0.025), { color: 0x2a2a2a, roughness: 0.4 }, [0.05, mainTop + 0.62, MAIN_Z + 0.39], false);
  const cap = addPart(group, new THREE.ConeGeometry(0.5, 0.36, 4), { color: ROOF, roughness: 0.55, tex: 'rooftile', rx: 1, ry: 1 }, [0, mainTop + 1.1, MAIN_Z]);
  cap.rotation.y = Math.PI / 4;
  addPart(group, new THREE.SphereGeometry(0.05, 8, 8), { color: GOLD, emissive: GOLD, emissiveIntensity: 0.25 }, [0, mainTop + 1.31, MAIN_Z], false);

  // ── 两翼：西体育馆（筒拱顶）、东教学楼（四坡顶） ──────
  const wingZ = 0.2;
  addPart(group, new THREE.BoxGeometry(1.5, 1.15, 1.4), { color: BRICK, roughness: 0.82, tex: 'schoolbrick', rx: 2, ry: 1 }, [-2.55, BASE + 0.575, wingZ]);
  addPart(group, new THREE.BoxGeometry(1.6, 0.12, 1.5), { color: TRIM, roughness: 0.7, tex: 'stone', rx: 1, ry: 1 }, [-2.55, BASE + 1.15, wingZ], false);
  const barrel = addPart(group, new THREE.CylinderGeometry(0.72, 0.72, 1.5, 16), { color: 0xa9a6a0, roughness: 0.45, metalness: 0.25, tex: 'metal', rx: 2, ry: 1 }, [-2.55, BASE + 1.15, wingZ]);
  barrel.rotation.z = Math.PI / 2;
  for (const x of [-3.05, -2.05]) {
    addPart(group, new THREE.BoxGeometry(0.34, 0.48, 0.03), { color: GLASS, roughness: 0.16, metalness: 0.2, tex: 'glass', rx: 1, ry: 1 }, [x, BASE + 0.82, wingZ + 0.72], false);
  }
  addPart(group, new THREE.BoxGeometry(0.5, 0.78, 0.04), { color: 0x5d3f2c, roughness: 0.7, tex: 'wood', rx: 1, ry: 1 }, [-2.55, BASE + 0.39, wingZ + 0.72], false);

  addPart(group, new THREE.BoxGeometry(1.5, 1.25, 1.4), { color: BRICK, roughness: 0.82, tex: 'schoolbrick', rx: 2, ry: 1 }, [2.55, BASE + 0.625, wingZ]);
  addPart(group, new THREE.BoxGeometry(1.72, 0.1, 1.6), { color: ROOF, roughness: 0.6, tex: 'rooftile', rx: 2, ry: 2 }, [2.55, BASE + 1.3, wingZ]);
  addPart(group, pyramidGeometry(1.72, 1.58, 0.4), { color: ROOF, roughness: 0.6, tex: 'rooftile', rx: 2, ry: 1 }, [2.55, BASE + 1.35, wingZ]);
  for (const y of [BASE + 0.55, BASE + 1.02]) {
    for (const x of [2.1, 3.0]) {
      addPart(group, new THREE.BoxGeometry(0.42, 0.46, 0.03), { color: TRIM, roughness: 0.7 }, [x, y, wingZ + 0.72], false);
      addPart(group, new THREE.BoxGeometry(0.34, 0.38, 0.02), { color: GLASS, roughness: 0.14, metalness: 0.18, tex: 'glass', rx: 1, ry: 1 }, [x, y, wingZ + 0.736], false);
    }
    for (const z of [-0.25, 0.65]) {
      addPart(group, new THREE.BoxGeometry(0.03, 0.46, 0.42), { color: TRIM, roughness: 0.7 }, [3.31, y, z], false);
      addPart(group, new THREE.BoxGeometry(0.02, 0.38, 0.34), { color: GLASS, roughness: 0.14, metalness: 0.18, tex: 'glass', rx: 1, ry: 1 }, [3.322, y, z], false);
    }
  }
  addPart(group, new THREE.BoxGeometry(0.48, 0.82, 0.04), { color: 0x5d3f2c, roughness: 0.7, tex: 'wood', rx: 1, ry: 1 }, [2.55, BASE + 0.41, wingZ + 0.72], false);

  // ── 庭院：花池与长椅 ────────────────────────────────
  for (const x of [-1.55, 1.55]) {
    addPart(group, new THREE.BoxGeometry(0.3, 0.2, 1.24), { color: STONE, roughness: 0.85, tex: 'stone', rx: 1, ry: 2 }, [x, BASE + 0.1, wingZ], false);
    addPart(group, new THREE.BoxGeometry(0.24, 0.1, 1.16), { color: HEDGE, roughness: 0.9, tex: 'grass', rx: 1, ry: 2 }, [x, BASE + 0.22, wingZ], false);
  }
  for (const x of [-1.15, 1.15]) {
    addPart(group, new THREE.BoxGeometry(0.22, 0.06, 0.62), { color: 0x8a6a45, roughness: 0.75, tex: 'wood', rx: 1, ry: 1 }, [x, BASE + 0.27, wingZ], false);
    addPart(group, new THREE.BoxGeometry(0.06, 0.34, 0.62), { color: 0x8a6a45, roughness: 0.75, tex: 'wood', rx: 1, ry: 1 }, [x + Math.sign(x) * 0.09, BASE + 0.47, wingZ], false);
    for (const z of [wingZ - 0.22, wingZ + 0.22]) {
      addPart(group, new THREE.BoxGeometry(0.16, 0.24, 0.05), { color: IRON, roughness: 0.5, metalness: 0.3 }, [x, BASE + 0.12, z], false);
    }
  }

  // ── 前庭：校门、旗杆、路灯、绿篱 ────────────────────
  const gateZ = 1.9;
  for (const x of [-1.6, 1.6]) {
    addPart(group, new THREE.BoxGeometry(0.34, 1.2, 0.34), { color: BRICK, roughness: 0.82, tex: 'schoolbrick', rx: 1, ry: 2 }, [x, BASE + 0.6, gateZ]);
    addPart(group, new THREE.BoxGeometry(0.44, 0.08, 0.44), { color: TRIM, roughness: 0.6, tex: 'stone', rx: 1, ry: 1 }, [x, BASE + 1.24, gateZ], false);
  }
  addPart(group, new THREE.BoxGeometry(3.34, 0.12, 0.12), { color: IRON, roughness: 0.45, metalness: 0.35 }, [0, BASE + 1.26, gateZ], false);
  addPart(group, new THREE.BoxGeometry(2.0, 0.24, 0.05), { color: TRIM, roughness: 0.55, tex: 'stone', rx: 2, ry: 1 }, [0, BASE + 1.26, gateZ + 0.1], false);
  addPart(group, new THREE.BoxGeometry(2.04, 0.04, 0.06), { color: GOLD, roughness: 0.4, metalness: 0.3 }, [0, BASE + 1.4, gateZ + 0.11], false);

  for (const side of [-1, 1]) {
    for (const x of [1.95, 2.4, 2.85, 3.3, 3.66]) {
      addPart(group, new THREE.BoxGeometry(0.05, 0.5, 0.05), { color: IRON, roughness: 0.45, metalness: 0.35 }, [side * x, BASE + 0.25, gateZ], false);
    }
    addPart(group, new THREE.BoxGeometry(1.94, 0.04, 0.05), { color: IRON, roughness: 0.45, metalness: 0.35 }, [side * 2.8, BASE + 0.44, gateZ], false);
    addPart(group, new THREE.BoxGeometry(1.94, 0.04, 0.05), { color: IRON, roughness: 0.45, metalness: 0.35 }, [side * 2.8, BASE + 0.18, gateZ], false);
  }

  addPart(group, new THREE.CylinderGeometry(0.025, 0.03, 2.2, 10), { color: 0xcfcecb, roughness: 0.45, metalness: 0.3, tex: 'metal', rx: 1, ry: 2 }, [-1.0, BASE + 1.1, 1.55]);
  addPart(group, new THREE.BoxGeometry(0.56, 0.32, 0.02), { color: RED, roughness: 0.62, tex: 'fabric', rx: 1, ry: 1 }, [-0.72, BASE + 1.92, 1.55], false);
  addPart(group, new THREE.SphereGeometry(0.04, 8, 8), { color: GOLD, emissive: GOLD, emissiveIntensity: 0.3 }, [-1.0, BASE + 2.22, 1.55], false);

  for (const x of [-2.5, 2.5]) {
    addPart(group, new THREE.CylinderGeometry(0.03, 0.04, 1.1, 8), { color: IRON, roughness: 0.5, metalness: 0.3 }, [x, BASE + 0.55, 1.75], false);
    addPart(group, new THREE.SphereGeometry(0.09, 10, 8), { color: 0xffd27f, emissive: 0xffd27f, emissiveIntensity: 0.5, roughness: 0.4 }, [x, BASE + 1.16, 1.75], false);
  }

  addPart(group, new THREE.BoxGeometry(7.4, 0.22, 0.2), { color: HEDGE, roughness: 0.92, tex: 'grass', rx: 4, ry: 1 }, [0, BASE + 0.11, -1.92], false);
  for (const x of [-3.76, 3.76]) {
    addPart(group, new THREE.BoxGeometry(0.2, 0.22, 3.3), { color: HEDGE, roughness: 0.92, tex: 'grass', rx: 1, ry: 3 }, [x, BASE + 0.11, 0.0], false);
  }

  // 校园树：树干 + 两层树冠。
  const tree = (x: number, z: number, scale: number) => {
    addPart(group, new THREE.CylinderGeometry(0.055, 0.075, 0.72, 8), { color: 0x6d4c33, roughness: 0.9, tex: 'wood', rx: 1, ry: 1 }, [x, BASE + 0.36, z]);
    addPart(group, new THREE.SphereGeometry(0.34, 10, 8), { color: GRASS, roughness: 0.92, tex: 'grass', rx: 1, ry: 1 }, [x, BASE + 0.92, z], false).scale.setScalar(scale);
    addPart(group, new THREE.SphereGeometry(0.24, 9, 7), { color: 0x5f8c4a, roughness: 0.92 }, [x + 0.1 * scale, BASE + 1.12, z - 0.06], false).scale.setScalar(scale);
  };
  tree(-3.45, 1.45, 1.05);
  tree(3.45, 1.45, 1.05);
  tree(-3.6, -0.5, 0.9);
  tree(3.6, -0.5, 0.9);

  group.position.set(definition.x, 0, definition.z);
  group.traverse((child) => {
    if ((child as THREE.Mesh).isMesh) (child as THREE.Mesh).userData.buildingId = definition.id;
  });

  return {
    ...definition,
    group,
    body,
    bodyMat,
    labelEl: null,
    labelY: mainTop + 1.6,
    skipFacadeDecal: true,
  };
}
