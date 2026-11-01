// 小城动物园（zoo）：S014 动物园怪谈的场景建筑，单独建模。
// 园区外壳 = 门楼（双柱 + 横梁 + 半截彩带 + 小旗）+ 东侧售票亭 +
// 西侧园长办公室（夜间窗口常亮）+ 连接两翼的矮栏与园区铺装。
// 五个展区、园史馆、留言点等是后续切片的兴趣点，不在本建筑网格内。
// 全部为程序化几何；不使用任何栅格贴图资源。
import * as THREE from 'three';
import type { MeshHelpers } from './meshFactory';
import type { BuildingDefinition, BuildingEntity } from '../city/buildingEntity';

export interface ZooOptions {
  platformHeight: number;
  makeMaterial: MeshHelpers['stdMat'];
  makeMesh: MeshHelpers['mk'];
  addPart: MeshHelpers['part'];
}

const STONE = 0xd8d2c4;
const STONE_DARK = 0xb7b0a1;
const WALL = 0xefe6d2;
const ROOF = 0x6a5a4a;
const WOOD = 0x8a6a48;
const IRON = 0x4d545c;
const GRASS = 0x9ab878;
const RED = 0xc2473c;
const LAMP = 0xffd36e;

export function buildZoo(options: ZooOptions, definition: BuildingDefinition): BuildingEntity {
  const { addPart, makeMaterial, makeMesh, platformHeight: PLH } = options;
  const outer = new THREE.Group();
  const g = new THREE.Group();
  outer.add(g);

  // 园区铺装整体落在环城道路内圈以内，避开南侧保留花海与南门步道。
  const F = PLH + 0.02;
  addPart(g, new THREE.BoxGeometry(8.0, PLH, 3.0), { color: STONE, roughness: 0.92, tex: 'stone', rx: 4, ry: 2 }, [0, PLH / 2, 1.1]);
  addPart(g, new THREE.BoxGeometry(7.4, 0.02, 2.4), { color: GRASS, roughness: 0.96, tex: 'ground4', rx: 4, ry: 2 }, [0, F + 0.01, 1.1], false);
  addPart(g, new THREE.BoxGeometry(1.2, 0.03, 2.4), { color: 0xe4dfd2, roughness: 0.9, tex: 'ground5', rx: 1, ry: 2 }, [0, F + 0.025, 1.1], false);

  // ── 门楼：两根石柱 + 门楣 + 半截彩带 ──────────────────
  addPart(g, new THREE.BoxGeometry(0.42, 1.9, 0.42), { color: STONE_DARK, roughness: 0.88, tex: 'stone', rx: 1, ry: 2 }, [-2.45, F + 0.95, 0]);
  addPart(g, new THREE.BoxGeometry(0.42, 1.9, 0.42), { color: STONE_DARK, roughness: 0.88, tex: 'stone', rx: 1, ry: 2 }, [2.45, F + 0.95, 0]);
  addPart(g, new THREE.BoxGeometry(5.3, 0.34, 0.46), { color: STONE, roughness: 0.86, tex: 'stone', rx: 2, ry: 1 }, [0, F + 1.98, 0]);
  addPart(g, new THREE.BoxGeometry(3.0, 0.62, 0.1), { color: 0x7a5f40, roughness: 0.82, tex: 'wood', rx: 1, ry: 1 }, [0, F + 2.45, 0.02]);
  // 门楣下方蓝色小灯。
  addPart(g, new THREE.CylinderGeometry(0.08, 0.08, 0.08, 12), { color: 0x3b6fe0, emissive: 0x2a5bbf, emissiveIntensity: 0.4 }, [0, F + 2.08, 0.26], false);
  // 半截彩带：从门楣垂下一段，微斜（重新开园第一天的痕迹）。
  const ribbon = addPart(g, new THREE.BoxGeometry(0.16, 1.15, 0.04), { color: RED, roughness: 0.7 }, [0.95, F + 1.36, 0.26], false);
  ribbon.rotation.z = 0.12;
  // 两侧小旗。
  [-1.65, 1.65].forEach((x, i) => {
    addPart(g, new THREE.CylinderGeometry(0.025, 0.025, 1.0, 6), { color: IRON, roughness: 0.6 }, [x, F + 2.6, 0]);
    addPart(g, new THREE.BoxGeometry(0.42, 0.28, 0.02), { color: i === 0 ? 0x4a90d9 : 0xe8a838, roughness: 0.72 }, [x + 0.23, F + 2.92, 0], false);
  });

  // ── 售票亭（东侧）：亭身 + 售票窗 + 浅坡顶 + 雨棚 ─────
  addPart(g, new THREE.BoxGeometry(1.9, 1.4, 1.5), { color: WALL, roughness: 0.8, tex: 'wall', rx: 2, ry: 1 }, [3.0, F + 0.7, 0.75]);
  addPart(g, new THREE.BoxGeometry(0.92, 0.52, 0.06), { color: 0x9cc2dd, roughness: 0.35, metalness: 0.1 }, [3.0, F + 0.92, 1.53], false);
  addPart(g, new THREE.BoxGeometry(2.2, 0.14, 1.8), { color: ROOF, roughness: 0.85, tex: 'rooftile', rx: 2, ry: 1 }, [3.0, F + 1.47, 0.75]);
  addPart(g, new THREE.BoxGeometry(2.3, 0.08, 0.5), { color: 0x6a4f34, roughness: 0.84, tex: 'wood', rx: 2, ry: 1 }, [3.0, F + 1.33, 1.42], false);
  // 亭前小柜台与入场转杆。
  addPart(g, new THREE.BoxGeometry(1.3, 0.08, 0.42), { color: WOOD, roughness: 0.82, tex: 'wood' }, [3.0, F + 0.82, 1.68]);
  addPart(g, new THREE.CylinderGeometry(0.035, 0.035, 1.0, 8), { color: IRON, roughness: 0.5, metalness: 0.3 }, [2.15, F + 0.5, 1.25]);

  // ── 园长办公室（西侧）：小屋 + 夜间窗口 + 门 ───────────
  const officeMat = makeMaterial({ color: WALL, roughness: 0.8, tex: 'wall', rx: 3, ry: 2 });
  const officeBody = makeMesh(new THREE.BoxGeometry(2.1, 1.85, 1.55), officeMat);
  officeBody.position.set(-3.0, F + 0.925, 0.75);
  officeBody.castShadow = officeBody.receiveShadow = true;
  g.add(officeBody);
  addPart(g, new THREE.BoxGeometry(2.45, 0.16, 1.9), { color: ROOF, roughness: 0.86, tex: 'rooftile', rx: 2, ry: 1 }, [-3.0, F + 1.93, 0.75]);
  // 亮着的办公室窗口（守则第六条：那盏灯必须亮着）。
  addPart(g, new THREE.BoxGeometry(0.78, 0.62, 0.06), { color: LAMP, emissive: 0xffb347, emissiveIntensity: 0.55 }, [-3.0, F + 1.15, 1.55], false);
  addPart(g, new THREE.BoxGeometry(0.44, 0.9, 0.06), { color: 0x6a4f34, roughness: 0.8, tex: 'wood' }, [-1.95, F + 0.45, 1.54], false);
  // 窗口下的代理园长铭牌。
  addPart(g, new THREE.BoxGeometry(0.64, 0.22, 0.04), { color: 0xd9d2c2, roughness: 0.8 }, [-3.0, F + 0.72, 1.56], false);

  // ── 两翼矮栏：把门楼、售票亭、办公室连成园区边界 ───────
  const fence = (x: number, width: number) => {
    addPart(g, new THREE.BoxGeometry(width, 0.08, 0.08), { color: IRON, roughness: 0.6 }, [x, F + 0.62, 0.1], false);
    addPart(g, new THREE.BoxGeometry(width, 0.08, 0.08), { color: IRON, roughness: 0.6 }, [x, F + 0.28, 0.1], false);
    for (let i = 0; i < 4; i += 1) {
      addPart(g, new THREE.BoxGeometry(0.06, 0.72, 0.06), { color: IRON, roughness: 0.6 }, [x - width / 2 + (width * (i + 0.5)) / 4, F + 0.36, 0.1], false);
    }
  };
  fence(-1.15, 1.9);
  fence(1.15, 1.9);

  // 入口标记（蓝色圆盘，非 storyLocked 的可访问建筑惯例）。
  addPart(g, new THREE.CylinderGeometry(0.13, 0.13, 0.04, 16), { color: 0x4a90d9, emissive: 0x2a60a9, emissiveIntensity: 0.28 }, [0, F + 0.045, 0.55], false);

  outer.position.set(definition.x, 0, definition.z);
  g.traverse((object) => { if (object instanceof THREE.Mesh) object.userData.buildingId = definition.id; });
  return {
    ...definition,
    group: outer,
    body: officeBody,
    bodyMat: officeMat,
    labelEl: null,
    labelY: PLH + 3.2,
    skipFacadeDecal: true,
  };
}
