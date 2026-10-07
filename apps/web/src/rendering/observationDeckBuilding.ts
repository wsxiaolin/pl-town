// 海边观景台（observation_deck）：西海滩木质栈桥 + 尽头观景平台，单独建模。
// 栈桥自干沙向西伸入海面，桩柱入水，平台上有望远镜、灯柱与顶棚。
// 位于 (x=-39.8, z=-13)，栈桥沿 -x 方向延伸至 x≈-46.5。
import * as THREE from 'three';
import type { MeshHelpers } from './meshFactory';
import type { BuildingDefinition, BuildingEntity } from '../city/buildingEntity';

export interface ObservationDeckOptions {
  platformHeight: number;
  makeMaterial: MeshHelpers['stdMat'];
  makeMesh: MeshHelpers['mk'];
  addPart: MeshHelpers['part'];
}

const WOOD = 0x8a6a45;
const WOOD_DARK = 0x6b4f34;
const WOOD_LIGHT = 0xa8895f;
const IRON = 0x4d545c;
const LANTERN = 0xd23c30;

export function buildObservationDeck(options: ObservationDeckOptions, definition: BuildingDefinition): BuildingEntity {
  const { addPart } = options;
  const outer = new THREE.Group();
  const g = new THREE.Group();
  outer.add(g);

  const DECK_Y = 0.85;          // 桥面高度（沙 0.07 / 海 0.06 之上，远镜头无共面）
  const PIER_HALF_WIDTH = 1.7;  // 栈桥半宽（z 向）
  const PIER_WEST_END = -6.7;   // 相对建筑原点向西延伸
  const PIER_EAST_END = 3.3;

  // ── 桩柱：每 2.2 单位一对，插入沙/水面以下 ──
  for (let x = PIER_EAST_END; x >= PIER_WEST_END; x -= 2.2) {
    [-PIER_HALF_WIDTH + 0.25, PIER_HALF_WIDTH - 0.25].forEach((z) => {
      addPart(g, new THREE.CylinderGeometry(0.11, 0.13, DECK_Y + 0.9, 8), { color: WOOD_DARK, roughness: 0.92, tex: 'wood' }, [x, (DECK_Y + 0.9) / 2 - 0.55, z]);
      // 斜撑。
      const brace = addPart(g, new THREE.CylinderGeometry(0.05, 0.05, 1.15, 6), { color: WOOD_DARK, roughness: 0.92, tex: 'wood' }, [x + 0.32, DECK_Y - 0.42, z], false);
      brace.rotation.z = 0.62;
    });
  }

  // ── 桥面：主走道板 + 横梁 ──
  const pierLength = PIER_EAST_END - PIER_WEST_END;
  const pierCenterX = (PIER_EAST_END + PIER_WEST_END) / 2;
  addPart(g, new THREE.BoxGeometry(pierLength, 0.12, PIER_HALF_WIDTH * 2), { color: WOOD, roughness: 0.88, tex: 'wood', rx: 8, ry: 1 }, [pierCenterX, DECK_Y, 0]);
  // 板缝。
  for (let x = PIER_WEST_END + 0.35; x < PIER_EAST_END; x += 0.7) {
    addPart(g, new THREE.BoxGeometry(0.06, 0.02, PIER_HALF_WIDTH * 2), { color: 0x7a5c3c, roughness: 0.92 }, [x, DECK_Y + 0.065, 0], false);
  }

  // ── 尽头观景平台（加宽）──
  const platformX = PIER_WEST_END - 1.5;
  const platformHalf = 2.6;
  addPart(g, new THREE.BoxGeometry(platformHalf * 2, 0.12, platformHalf * 2), { color: WOOD, roughness: 0.88, tex: 'wood', rx: 4, ry: 4 }, [platformX, DECK_Y, 0]);
  // 平台四角加粗桩。
  ([[-1, -1], [-1, 1], [1, -1], [1, 1]] as Array<[number, number]>).forEach(([sx, sz]) => {
    addPart(g, new THREE.CylinderGeometry(0.14, 0.16, DECK_Y + 1.0, 8), { color: WOOD_DARK, roughness: 0.92, tex: 'wood' }, [platformX + sx * (platformHalf - 0.3), (DECK_Y + 1.0) / 2 - 0.6, sz * (platformHalf - 0.3)]);
  });

  // ── 栏杆（桥两侧 + 平台三边）──
  const rail = (x: number, z: number, length: number, alongX: boolean) => {
    const post = (px: number, pz: number) => addPart(g, new THREE.BoxGeometry(0.07, 0.62, 0.07), { color: WOOD_LIGHT, roughness: 0.85, tex: 'wood' }, [px, DECK_Y + 0.42, pz], false);
    const bar = alongX
      ? addPart(g, new THREE.BoxGeometry(length, 0.06, 0.05), { color: WOOD_LIGHT, roughness: 0.85, tex: 'wood' }, [x, DECK_Y + 0.68, z], false)
      : addPart(g, new THREE.BoxGeometry(0.05, 0.06, length), { color: WOOD_LIGHT, roughness: 0.85, tex: 'wood' }, [x, DECK_Y + 0.68, z], false);
    void post; void bar;
    if (alongX) {
      for (let px = x - length / 2; px <= x + length / 2 + 0.01; px += length) post(px, z);
      addPart(g, new THREE.BoxGeometry(length, 0.035, 0.04), { color: WOOD_LIGHT, roughness: 0.85 }, [x, DECK_Y + 0.3, z], false);
    } else {
      for (let pz = z - length / 2; pz <= z + length / 2 + 0.01; pz += length) post(x, pz);
      addPart(g, new THREE.BoxGeometry(0.04, 0.035, length), { color: WOOD_LIGHT, roughness: 0.85 }, [x, DECK_Y + 0.3, z], false);
    }
  };
  rail(pierCenterX, -PIER_HALF_WIDTH, pierLength, true);
  rail(pierCenterX, PIER_HALF_WIDTH, pierLength, true);
  // 平台边缘（西、南、北；东侧接走道敞开）。
  rail(platformX - platformHalf, 0, platformHalf * 2, false);
  rail(platformX, -platformHalf, platformHalf * 2, true);
  rail(platformX, platformHalf, platformHalf * 2, true);

  // ── 顶棚：四柱 + 格栅顶（仅覆盖平台西部，留出东侧看海）──
  const canopyX = platformX - 0.7;
  ([[-1.15, -1.15], [-1.15, 1.15], [1.15, -1.15], [1.15, 1.15]] as Array<[number, number]>).forEach(([sx, sz]) => {
    addPart(g, new THREE.CylinderGeometry(0.08, 0.09, 2.5, 8), { color: WOOD_DARK, roughness: 0.88, tex: 'wood' }, [canopyX + sx, DECK_Y + 1.25, sz]);
  });
  addPart(g, new THREE.BoxGeometry(3.0, 0.1, 3.0), { color: RED_LANTERN_ROOF, roughness: 0.85 }, [canopyX, DECK_Y + 2.55, 0]);
  for (let i = -1; i <= 1; i += 1) {
    addPart(g, new THREE.BoxGeometry(3.05, 0.04, 0.22), { color: 0xb84a3a, roughness: 0.85 }, [canopyX, DECK_Y + 2.62, i * 0.95], false);
  }
  // 顶棚檐角小灯笼（夜视焦点）。
  ([[-1.4, -1.4], [-1.4, 1.4]] as Array<[number, number]>).forEach(([sx, sz]) => {
    const lantern = addPart(g, new THREE.SphereGeometry(0.2, 10, 8), { color: LANTERN, emissive: 0xc23a28, emissiveIntensity: 0.55, roughness: 0.5 }, [canopyX + sx, DECK_Y + 2.25, sz], false);
    lantern.scale.y = 1.2;
    addPart(g, new THREE.CylinderGeometry(0.05, 0.05, 0.07, 8), { color: 0xd9a441, roughness: 0.5 }, [canopyX + sx, DECK_Y + 2.4, sz], false);
    addPart(g, new THREE.CylinderGeometry(0.05, 0.05, 0.07, 8), { color: 0xd9a441, roughness: 0.5 }, [canopyX + sx, DECK_Y + 2.1, sz], false);
  });

  // ── 观景望远镜（对准西面海域）──
  const tripod = (px: number, pz: number) => {
    [0, 2.1, 4.2].forEach((a) => {
      const leg = addPart(g, new THREE.CylinderGeometry(0.03, 0.03, 0.85, 6), { color: IRON, roughness: 0.55, tex: 'metal' }, [px + Math.cos(a) * 0.16, DECK_Y + 0.42, pz + Math.sin(a) * 0.16], false);
      leg.rotation.z = Math.cos(a) * 0.4;
      leg.rotation.x = -Math.sin(a) * 0.4;
    });
  };
  tripod(platformX + 0.7, -0.9);
  const scope = addPart(g, new THREE.CylinderGeometry(0.09, 0.12, 0.9, 10), { color: IRON, roughness: 0.4, metalness: 0.35, tex: 'metal' }, [platformX + 0.62, DECK_Y + 1.05, -0.9], false);
  scope.rotation.z = Math.PI / 2 - 0.22;
  scope.rotation.y = 0.35;
  addPart(g, new THREE.CylinderGeometry(0.13, 0.09, 0.18, 10), { color: 0x353b42, roughness: 0.4, metalness: 0.35 }, [platformX + 0.22, DECK_Y + 1.14, -0.9], false).rotation.z = Math.PI / 2 - 0.22;

  // ── 入口立牌（东端）──
  addPart(g, new THREE.CylinderGeometry(0.05, 0.06, 1.5, 8), { color: WOOD_DARK, roughness: 0.9, tex: 'wood' }, [PIER_EAST_END - 0.4, DECK_Y + 0.75, PIER_HALF_WIDTH + 0.3]);
  addPart(g, new THREE.BoxGeometry(0.9, 0.5, 0.06), { color: 0x9a7a52, roughness: 0.8, tex: 'wood' }, [PIER_EAST_END - 0.4, DECK_Y + 1.6, PIER_HALF_WIDTH + 0.3], false).rotation.y = 0.5;

  g.position.set(definition.x, 0, definition.z);
  tagMeshes(g, definition.id);
  return { ...definition, group: outer, body: undefined, bodyMat: undefined, labelEl: null, labelY: DECK_Y + 3.3 };
  function tagMeshes(root: THREE.Object3D, id: string): void {
    root.traverse((child) => { child.userData.buildingId = id; });
  }
}

const RED_LANTERN_ROOF = 0xa6402f;
