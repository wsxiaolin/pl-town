// 星语北城建筑集：黑洞热门作品 Top 100 城市化的 12 栋新建筑。
// 一栋作品建筑一个 builder，与主城视觉语言一致（浅色体量、蓝金点缀、
// 程序化几何、贴地 Y 层差 ≥0.004）。作品对应关系见仓库外
// design/building-specs.md；配置文件在 city/data/buildings/north_*.ts。
import * as THREE from 'three';
import type { MaterialParameters } from './meshFactory';
import type { BuildingDefinition, BuildingEntity } from '../city/buildingEntity';

export interface NorthBuildingOptions {
  platformHeight: number;
  makeMaterial: (parameters: MaterialParameters) => THREE.MeshStandardMaterial;
  makeMesh: (geometry: THREE.BufferGeometry, material: THREE.Material) => THREE.Mesh;
  addPart: (
    group: THREE.Group | null,
    geometry: THREE.BufferGeometry,
    material: THREE.Material | MaterialParameters,
    position: [number, number, number],
    shadow?: boolean,
  ) => THREE.Mesh;
}

const BLUE = 0x3b6fe0;
const GOLD = 0xe8a838;

type Builder = (options: NorthBuildingOptions, definition: BuildingDefinition) => BuildingEntity;

function finish(
  options: NorthBuildingOptions,
  definition: BuildingDefinition,
  group: THREE.Group,
  body: THREE.Mesh | undefined,
  bodyMat: THREE.MeshStandardMaterial | undefined,
  labelY: number,
  footprint?: { width: number; depth: number },
): BuildingEntity {
  group.position.set(definition.x, 0, definition.z);
  group.userData.navigationFootprint = footprint;
  group.traverse((child) => {
    if ((child as THREE.Mesh).isMesh) child.userData.buildingId = definition.id;
  });
  return { ...definition, group, body, bodyMat, labelEl: null, labelY };
}

// ── 聊天广场：真·第一聊天室（黑洞 #5，评论数全榜第一的广场）──────────
const buildChatPlaza: Builder = (options, cfg) => {
  const { makeMaterial, addPart } = options;
  const g = new THREE.Group();
  const floor = makeMaterial({ color: 0xe8e7e4, roughness: 0.9, tex: 'pavement', rx: 3, ry: 3 });
  const plaza = addPart(g, new THREE.BoxGeometry(6.2, 0.16, 5.4), floor, [0, 0.08, 0]);
  const body = plaza;
  // 四角凉柱 + 平顶
  [-2.4, 2.4].forEach((x) => [-1.9, 1.9].forEach((z) =>
    addPart(g, new THREE.CylinderGeometry(0.11, 0.13, 2.1, 10), { color: 0xf8f7f5, roughness: 0.5, tex: 'stone', rx: 1, ry: 1 }, [x, 1.05, z])));
  addPart(g, new THREE.BoxGeometry(5.6, 0.14, 4.6), { color: 0xeae9e6, roughness: 0.7, tex: 'rooftile', rx: 3, ry: 2 }, [0, 2.16, 0]);
  addPart(g, new THREE.BoxGeometry(6.0, 0.1, 5.0), { color: 0xf8f7f5, roughness: 0.5 }, [0, 2.27, 0]);
  // 中央灯柱
  addPart(g, new THREE.CylinderGeometry(0.06, 0.09, 1.5, 10), { color: 0xcdccca, roughness: 0.6, tex: 'metal', rx: 1, ry: 1 }, [0, 0.95, 0]);
  addPart(g, new THREE.SphereGeometry(0.16, 12, 12), { color: 0xf8f7f5, roughness: 0.15, emissive: 0xeef0ff, emissiveIntensity: 0.5 }, [0, 1.78, 0], false);
  // 长椅与小桌
  ([[-1.4, -1.1], [1.4, -1.1], [-1.4, 1.1], [1.4, 1.1]] as Array<[number, number]>).forEach(([x, z]) => {
    addPart(g, new THREE.BoxGeometry(1.2, 0.09, 0.42), { color: 0x9b6b3f, roughness: 0.72, tex: 'wood', rx: 2, ry: 1 }, [x, 0.42, z]);
    addPart(g, new THREE.BoxGeometry(1.06, 0.3, 0.3), { color: 0xd8d7d2, roughness: 0.8 }, [x, 0.25, z]);
  });
  addPart(g, new THREE.CylinderGeometry(0.32, 0.32, 0.05, 16), { color: 0x9b6b3f, roughness: 0.7, tex: 'wood', rx: 2, ry: 1 }, [0, 0.44, 0]);
  return finish(options, cfg, g, body, undefined, 2.7, { width: 6.2, depth: 5.4 });
};

// ── 鸽子广场：鸽子协会聊天室（黑洞 #6）─────────────────────────────
const buildPigeonSquare: Builder = (options, cfg) => {
  const { addPart } = options;
  const g = new THREE.Group();
  addPart(g, new THREE.CylinderGeometry(3.1, 3.3, 0.16, 28), { color: 0xe8e7e4, roughness: 0.9, tex: 'pavement', rx: 2, ry: 2 }, [0, 0.08, 0]);
  // 栖鸽树
  addPart(g, new THREE.CylinderGeometry(0.14, 0.2, 1.7, 10), { color: 0x6a4a2a, roughness: 0.85, tex: 'wood', rx: 1, ry: 1 }, [0, 0.98, 0]);
  addPart(g, new THREE.SphereGeometry(1.05, 14, 12), { color: 0x4a7a3a, roughness: 0.95, tex: 'grass', rx: 2, ry: 1 }, [0, 2.2, 0]);
  addPart(g, new THREE.SphereGeometry(0.72, 12, 10), { color: 0x568a44, roughness: 0.95, tex: 'grass', rx: 1, ry: 1 }, [0.62, 1.72, 0.4]);
  // 鸟笼穹顶（细环 + 半透明罩）
  for (let i = 0; i < 4; i++) {
    const r = 1.9 - i * 0.45;
    addPart(g, new THREE.TorusGeometry(r, 0.035, 8, 28), { color: 0xb5b2ac, roughness: 0.4, metalness: 0.5 }, [0, 2.55 + i * 0.28, 0], false).rotation.x = Math.PI / 2;
  }
  addPart(g, new THREE.CylinderGeometry(0.05, 0.05, 1.1, 8), { color: 0xb5b2ac, roughness: 0.4, metalness: 0.5 }, [0, 3.05, 0], false);
  addPart(g, new THREE.SphereGeometry(0.12, 10, 10), { color: GOLD, roughness: 0.3, metalness: 0.4 }, [0, 3.66, 0], false);
  // 栖木上的鸽子（圆润的小白鸟）
  const pigeon = (x: number, y: number, z: number, ry: number) => {
    const p = new THREE.Group();
    addPart(p, new THREE.SphereGeometry(0.11, 10, 8), { color: 0xf4f2ee, roughness: 0.6 }, [0, 0, 0], false);
    addPart(p, new THREE.SphereGeometry(0.062, 8, 8), { color: 0xf4f2ee, roughness: 0.6 }, [0, 0.1, 0.1], false);
    addPart(p, new THREE.ConeGeometry(0.026, 0.07, 6), { color: GOLD, roughness: 0.4 }, [0, 0.1, 0.165], false);
    p.position.set(x, y, z); p.rotation.y = ry; g.add(p);
  };
  pigeon(0.95, 2.62, -0.5, 2.4); pigeon(-0.85, 2.68, 0.55, -1.1);
  pigeon(0.35, 3.12, 0.72, 0.5); pigeon(-0.42, 3.16, -0.68, 3.6);
  // 地面食盆
  addPart(g, new THREE.CylinderGeometry(0.3, 0.34, 0.1, 14), { color: 0xc8c7c2, roughness: 0.6 }, [1.6, 0.2, 1.1]);
  pigeon(1.6, 0.32, 1.1, 1.9);
  return finish(options, cfg, g, undefined, undefined, 4.0, { width: 6.0, depth: 6.0 });
};

// ── 恒星馆：恒星的一生（黑洞 #51）──────────────────────────────────
const buildStellarHall: Builder = (options, cfg) => {
  const { addPart } = options;
  const g = new THREE.Group();
  addPart(g, new THREE.BoxGeometry(4.6, 0.18, 3.8), { color: 0xe4e3e0, roughness: 0.85, tex: 'stone', rx: 2, ry: 2 }, [0, 0.09, 0]);
  // 圆柱厅身 + 穹顶
  const wallMat = { color: 0xf0efe9, roughness: 0.55, tex: 'wall', rx: 3, ry: 1 };
  addPart(g, new THREE.CylinderGeometry(1.55, 1.65, 1.5, 24), wallMat, [0, 0.93, 0]);
  addPart(g, new THREE.SphereGeometry(1.55, 24, 14, 0, Math.PI * 2, 0, Math.PI / 2), { color: 0x3b6fe0, roughness: 0.12, metalness: 0.3, tex: 'mallglass', rx: 1, ry: 1 }, [0, 1.68, 0]);
  // 穹顶上的浑天环（恒星轨道意象）
  const ring = addPart(g, new THREE.TorusGeometry(0.85, 0.045, 8, 32), { color: GOLD, roughness: 0.3, metalness: 0.5 }, [0, 3.06, 0], false);
  ring.rotation.x = Math.PI / 2.6;
  const ring2 = addPart(g, new THREE.TorusGeometry(0.85, 0.045, 8, 32), { color: 0xb5b2ac, roughness: 0.3, metalness: 0.5 }, [0, 3.06, 0], false);
  ring2.rotation.x = Math.PI / 1.7; ring2.rotation.z = 0.5;
  addPart(g, new THREE.OctahedronGeometry(0.16), { color: GOLD, roughness: 0.25, metalness: 0.4, emissive: 0xe8a838, emissiveIntensity: 0.25 }, [0, 3.5, 0], false);
  // 门廊
  addPart(g, new THREE.BoxGeometry(1.3, 0.95, 0.5), { color: 0xf8f7f5, roughness: 0.5, tex: 'stone', rx: 1, ry: 1 }, [0, 0.65, 1.75]);
  addPart(g, new THREE.BoxGeometry(0.9, 0.8, 0.08), { color: 0x9ac7dc, roughness: 0.1, metalness: 0.2, tex: 'glass', rx: 1, ry: 1 }, [0, 0.6, 2.02], false);
  // 星点窗
  [-0.9, 0.9].forEach((x) => addPart(g, new THREE.BoxGeometry(0.4, 0.55, 0.06), { color: 0x9ac7dc, roughness: 0.1, tex: 'glass', rx: 1, ry: 1 }, [x, 1.1, x > 0 ? 1.28 : -1.28], false));
  return finish(options, cfg, g, undefined, undefined, 3.9, { width: 4.6, depth: 3.8 });
};

// ── 黑洞观测台：人落入黑洞（黑洞 #98）──────────────────────────────
const buildSingularity: Builder = (options, cfg) => {
  const { addPart } = options;
  const g = new THREE.Group();
  addPart(g, new THREE.CylinderGeometry(2.4, 2.6, 0.16, 24), { color: 0xd9d8d4, roughness: 0.85, tex: 'pavement', rx: 2, ry: 2 }, [0, 0.08, 0]);
  // 深色塔身
  const tower = addPart(g, new THREE.CylinderGeometry(0.95, 1.15, 2.6, 18), { color: 0x4a4a52, roughness: 0.25, metalness: 0.35, tex: 'darktower', rx: 2, ry: 1 }, [0, 1.46, 0]);
  addPart(g, new THREE.CylinderGeometry(1.02, 1.02, 0.1, 18), { color: 0x3a3a42, roughness: 0.3 }, [0, 2.82, 0]);
  // 吸积盘：倾斜金色光环
  const disk = addPart(g, new THREE.TorusGeometry(1.35, 0.09, 10, 36), { color: GOLD, roughness: 0.28, metalness: 0.45, emissive: 0xe8a838, emissiveIntensity: 0.4 }, [0, 3.0, 0], false);
  disk.rotation.x = Math.PI / 2.35;
  addPart(g, new THREE.TorusGeometry(1.02, 0.05, 8, 32), { color: 0xd8b56a, roughness: 0.3, metalness: 0.4, emissive: 0xe8a838, emissiveIntensity: 0.22 }, [0, 3.0, 0], false).rotation.x = Math.PI / 2.35;
  // 奇点
  addPart(g, new THREE.SphereGeometry(0.22, 14, 14), { color: 0x24242c, roughness: 0.1, metalness: 0.2 }, [0, 3.42, 0], false);
  // 观测环廊
  [0, Math.PI / 2, Math.PI, Math.PI * 1.5].forEach((a) =>
    addPart(g, new THREE.BoxGeometry(0.14, 0.5, 0.14), { color: 0xb5b2ac, roughness: 0.5, tex: 'metal', rx: 1, ry: 1 }, [Math.cos(a) * 2.0, 0.42, Math.sin(a) * 2.0]));
  return finish(options, cfg, g, tower, undefined, 3.9, { width: 4.4, depth: 4.4 });
};

// ── 双星园：双星系统能有宜居行星（黑洞 #90）────────────────────────
const buildBinaryGarden: Builder = (options, cfg) => {
  const { addPart } = options;
  const g = new THREE.Group();
  // 草丘
  addPart(g, new THREE.CylinderGeometry(2.6, 2.9, 0.22, 26), { color: 0xc8d8a8, roughness: 0.95, tex: 'grass', rx: 2, ry: 2 }, [0, 0.11, 0]);
  // 双星柱：金星 + 蓝星
  addPart(g, new THREE.CylinderGeometry(0.07, 0.1, 1.9, 10), { color: 0xcdccca, roughness: 0.5, tex: 'metal', rx: 1, ry: 1 }, [-0.55, 1.17, 0]);
  addPart(g, new THREE.SphereGeometry(0.34, 14, 14), { color: GOLD, roughness: 0.3, metalness: 0.3, emissive: 0xe8a838, emissiveIntensity: 0.3 }, [-0.55, 2.28, 0], false);
  addPart(g, new THREE.CylinderGeometry(0.07, 0.1, 1.4, 10), { color: 0xcdccca, roughness: 0.5, tex: 'metal', rx: 1, ry: 1 }, [0.62, 0.92, 0.2]);
  addPart(g, new THREE.SphereGeometry(0.26, 14, 14), { color: BLUE, roughness: 0.25, metalness: 0.2, emissive: 0x3b6fe0, emissiveIntensity: 0.3 }, [0.62, 1.76, 0.2], false);
  // 共同质心轨道环（双星绕行意象）
  const orbit = addPart(g, new THREE.TorusGeometry(1.5, 0.04, 8, 40), { color: 0xb5b2ac, roughness: 0.3, metalness: 0.5 }, [0, 1.3, 0], false);
  orbit.rotation.x = Math.PI / 2;
  const orbit2 = addPart(g, new THREE.TorusGeometry(1.5, 0.028, 8, 40), { color: 0xd8d7d2, roughness: 0.3, metalness: 0.4 }, [0, 1.3, 0], false);
  orbit2.rotation.x = Math.PI / 2; orbit2.rotation.z = 0.22;
  // 宜居小行星（轨道上的一颗绿色小星）
  addPart(g, new THREE.SphereGeometry(0.12, 10, 10), { color: 0x6aa860, roughness: 0.5 }, [1.5, 1.3, 0], false);
  // 丘下灌木
  ([[-1.6, 0.9], [1.7, -0.8], [-1.2, -1.5], [0.9, 1.6]] as Array<[number, number]>).forEach(([x, z]) =>
    addPart(g, new THREE.SphereGeometry(0.28, 10, 8), { color: 0x568a44, roughness: 0.95, tex: 'grass', rx: 1, ry: 1 }, [x, 0.34, z], false));
  return finish(options, cfg, g, undefined, undefined, 3.0, { width: 4.8, depth: 4.8 });
};

// ── 玛雅台地：玛雅文明（黑洞 #99）──────────────────────────────────
const buildZiggurat: Builder = (options, cfg) => {
  const { addPart } = options;
  const g = new THREE.Group();
  const sand = { color: 0xd8c9a8, roughness: 0.9, tex: 'stone', rx: 3, ry: 3 };
  addPart(g, new THREE.BoxGeometry(4.6, 0.16, 4.2), { color: 0xcfc0a0, roughness: 0.9, tex: 'stone', rx: 2, ry: 2 }, [0, 0.08, 0]);
  // 三层阶梯金字塔
  addPart(g, new THREE.BoxGeometry(3.9, 0.62, 3.5), sand, [0, 0.47, 0]);
  addPart(g, new THREE.BoxGeometry(2.9, 0.62, 2.6), sand, [0, 1.09, 0]);
  addPart(g, new THREE.BoxGeometry(1.9, 0.62, 1.7), sand, [0, 1.71, 0]);
  // 顶部神殿
  addPart(g, new THREE.BoxGeometry(1.2, 0.8, 1.05), { color: 0xcbb98f, roughness: 0.85, tex: 'stone', rx: 2, ry: 2 }, [0, 2.42, 0]);
  addPart(g, new THREE.BoxGeometry(1.42, 0.1, 1.26), { color: 0xb5a37c, roughness: 0.8 }, [0, 2.87, 0]);
  addPart(g, new THREE.CylinderGeometry(0.05, 0.05, 0.5, 8), { color: 0x9b8a68, roughness: 0.7 }, [0, 3.14, 0], false);
  addPart(g, new THREE.SphereGeometry(0.09, 10, 10), { color: GOLD, roughness: 0.3, metalness: 0.4 }, [0, 3.44, 0], false);
  // 正面阶梯
  for (let i = 0; i < 5; i++) addPart(g, new THREE.BoxGeometry(0.85, 0.12, 0.4), { color: 0xc4b28a, roughness: 0.88 }, [0, 0.2 + i * 0.31, 1.55 + (4 - i) * 0.19]);
  // 转角石柱
  ([[-2.1, 1.85], [2.1, 1.85]] as Array<[number, number]>).forEach(([x, z]) => {
    addPart(g, new THREE.BoxGeometry(0.3, 0.85, 0.3), sand, [x, 0.58, z]);
    addPart(g, new THREE.BoxGeometry(0.38, 0.1, 0.38), { color: 0xb5a37c, roughness: 0.8 }, [x, 1.05, z]);
  });
  // 棕榈
  ([[-2.4, -1.7], [2.4, -1.7]] as Array<[number, number]>).forEach(([x, z]) => {
    addPart(g, new THREE.CylinderGeometry(0.07, 0.11, 1.3, 8), { color: 0x8a6a42, roughness: 0.85, tex: 'wood', rx: 1, ry: 1 }, [x, 0.81, z]);
    [0, 1, 2, 3, 4].forEach((k) => {
      const leaf = addPart(g, new THREE.BoxGeometry(0.7, 0.045, 0.16), { color: 0x4a8a4a, roughness: 0.9 }, [x, 1.48, z], false);
      leaf.rotation.y = (k / 5) * Math.PI * 2; leaf.rotation.z = 0.35;
    });
  });
  return finish(options, cfg, g, undefined, undefined, 3.8, { width: 4.6, depth: 4.2 });
};

// ── 纪念碑：物理实验室API事件纪念碑（黑洞 #1）───────────────────────
const buildMonolith: Builder = (options, cfg) => {
  const { addPart } = options;
  const g = new THREE.Group();
  addPart(g, new THREE.BoxGeometry(2.6, 0.14, 2.2), { color: 0xd5d4d0, roughness: 0.85, tex: 'pavement', rx: 2, ry: 2 }, [0, 0.07, 0]);
  addPart(g, new THREE.BoxGeometry(1.7, 0.12, 1.4), { color: 0xc8c7c2, roughness: 0.8 }, [0, 0.19, 0]);
  // 深色碑体
  const slab = addPart(g, new THREE.BoxGeometry(0.85, 3.1, 0.4), { color: 0x3a3a44, roughness: 0.2, metalness: 0.3, tex: 'darktower', rx: 1, ry: 1 }, [0, 1.79, 0]);
  addPart(g, new THREE.BoxGeometry(0.95, 0.09, 0.5), { color: 0x2e2e38, roughness: 0.25 }, [0, 3.38, 0]);
  // 碑身数据纹（蓝色电路刻线，API 意象）
  [0.85, 1.55, 2.25, 2.95].forEach((y) =>
    addPart(g, new THREE.BoxGeometry(0.6, 0.045, 0.42), { color: BLUE, emissive: BLUE, emissiveIntensity: 0.5, roughness: 0.2 }, [0, y, 0], false));
  [-0.22, 0.22].forEach((x) => addPart(g, new THREE.BoxGeometry(0.05, 2.4, 0.05), { color: BLUE, emissive: BLUE, emissiveIntensity: 0.4, roughness: 0.2 }, [x, 1.79, 0.215], false));
  // 碑前铭牌
  addPart(g, new THREE.BoxGeometry(0.5, 0.34, 0.07), { color: 0xe8d5a8, roughness: 0.7 }, [0, 0.42, 0.62], false);
  return finish(options, cfg, g, slab, undefined, 3.9, { width: 2.6, depth: 2.2 });
};

// ── 解忧杂货店：解忧杂货店(解忧咨询室)（黑洞 #40）───────────────────
const buildWorryStore: Builder = (options, cfg) => {
  const { addPart } = options;
  const g = new THREE.Group();
  const width = 2.4, height = 2.5, depth = 2.1;
  addPart(g, new THREE.BoxGeometry(width + 0.5, 0.18, depth + 0.5), { color: 0xd6c9b9, roughness: 0.82, tex: 'pavement', rx: 2, ry: 2 }, [0, 0.09, 0]);
  const bodyMat = { color: 0xefe6d4, roughness: 0.65, tex: 'wall', rx: 2, ry: 1 };
  const body = addPart(g, new THREE.BoxGeometry(width, height, depth), bodyMat, [0, 0.18 + height / 2 + 0.012, 0]);
  addPart(g, new THREE.BoxGeometry(width + 0.24, 0.14, depth + 0.24), { color: 0x8a5a4a, roughness: 0.6, tex: 'rooftile', rx: 3, ry: 2 }, [0, 0.18 + height + 0.082, 0]);
  // 条纹雨棚
  [-0.75, -0.25, 0.25, 0.75].forEach((x, i) =>
    addPart(g, new THREE.BoxGeometry(0.5, 0.07, 0.62), { color: i % 2 === 0 ? 0xe8a838 : 0xf4eee0, roughness: 0.5 }, [x, 1.62, depth / 2 + 0.28]));
  // 门与暖窗（深夜亮着的咨询室）
  addPart(g, new THREE.BoxGeometry(0.72, 1.35, 0.08), { color: 0x9b6b3f, roughness: 0.7, tex: 'wood', rx: 1, ry: 1 }, [-0.62, 0.94, depth / 2 + 0.03]);
  addPart(g, new THREE.BoxGeometry(0.8, 0.78, 0.07), { color: 0xf6dfae, roughness: 0.12, emissive: 0xf1c46d, emissiveIntensity: 0.32, tex: 'glass', rx: 1, ry: 1 }, [0.55, 1.12, depth / 2 + 0.03], false);
  // 投信口（烦恼投递）
  addPart(g, new THREE.BoxGeometry(0.4, 0.09, 0.1), { color: 0x3a3a44, roughness: 0.4 }, [0.55, 1.62, depth / 2 + 0.05], false);
  // 门头灯笼
  addPart(g, new THREE.CylinderGeometry(0.028, 0.028, 0.34, 8), { color: 0x9b6b3f, roughness: 0.7 }, [-1.02, 1.98, depth / 2 + 0.12], false);
  addPart(g, new THREE.SphereGeometry(0.13, 10, 10), { color: 0xf6dfae, roughness: 0.2, emissive: 0xf1c46d, emissiveIntensity: 0.45 }, [-1.02, 1.76, depth / 2 + 0.12], false);
  // 侧墙小窗
  addPart(g, new THREE.BoxGeometry(0.07, 0.6, 0.5), { color: 0x9ac7dc, roughness: 0.1, tex: 'glass', rx: 1, ry: 1 }, [-width / 2 - 0.02, 1.35, -0.2], false);
  return finish(options, cfg, g, body, undefined, 0.18 + height + 0.9, { width: width + 0.3, depth: depth + 0.3 });
};

// ── 会员制餐厅：屑天尊的奇妙会员制餐厅（黑洞 #95）────────────────────
const buildBistro: Builder = (options, cfg) => {
  const { addPart } = options;
  const g = new THREE.Group();
  const width = 2.8, height = 1.95, depth = 2.3;
  addPart(g, new THREE.BoxGeometry(width + 0.55, 0.18, depth + 0.55), { color: 0xd6c9b9, roughness: 0.82, tex: 'pavement', rx: 2, ry: 2 }, [0, 0.09, 0]);
  const body = addPart(g, new THREE.BoxGeometry(width, height, depth), { color: 0xb3543e, roughness: 0.55, tex: 'wall', rx: 3, ry: 1 }, [0, 0.18 + height / 2 + 0.012, 0]);
  addPart(g, new THREE.BoxGeometry(width + 0.26, 0.15, depth + 0.26), { color: 0x6a4a3a, roughness: 0.6, tex: 'rooftile', rx: 3, ry: 2 }, [0, 0.18 + height + 0.088, 0]);
  // 拱形门廊 + 双开玻璃门
  addPart(g, new THREE.BoxGeometry(1.15, 1.4, 0.3), { color: 0xf1e8d8, roughness: 0.6 }, [0, 1.03, depth / 2 + 0.02]);
  addPart(g, new THREE.BoxGeometry(0.86, 1.2, 0.09), { color: 0x9ac7dc, roughness: 0.1, metalness: 0.2, tex: 'glass', rx: 1, ry: 1 }, [0, 0.95, depth / 2 + 0.19], false);
  addPart(g, new THREE.CylinderGeometry(0.43, 0.43, 1.16, 16, 1, false, 0, Math.PI), { color: 0xf1e8d8, roughness: 0.6 }, [0, 1.72, depth / 2 + 0.02], false).rotation.z = Math.PI / 2;
  // 会员徽章招牌（金色圆盾）
  addPart(g, new THREE.CylinderGeometry(0.3, 0.3, 0.07, 18), { color: GOLD, roughness: 0.3, metalness: 0.45 }, [0, 2.36, depth / 2 + 0.12], false).rotation.x = Math.PI / 2;
  addPart(g, new THREE.TorusGeometry(0.31, 0.035, 8, 22), { color: 0xb5b2ac, roughness: 0.3, metalness: 0.5 }, [0, 2.36, depth / 2 + 0.155], false);
  // 落地窗 + 桌灯
  [-1.0, 1.0].forEach((x) => addPart(g, new THREE.BoxGeometry(0.72, 0.95, 0.07), { color: 0xf6dfae, roughness: 0.12, emissive: 0xf1c46d, emissiveIntensity: 0.22, tex: 'glass', rx: 1, ry: 1 }, [x, 1.05, depth / 2 + 0.03], false));
  // 烟囱与遮阳篷
  addPart(g, new THREE.BoxGeometry(0.34, 0.66, 0.34), { color: 0x9b6b3f, roughness: 0.7, tex: 'stone', rx: 1, ry: 1 }, [width / 2 - 0.45, 0.18 + height + 0.4, -0.4]);
  [0, 1, 2, 3].forEach((k) => addPart(g, new THREE.BoxGeometry(0.42, 0.055, 0.5), { color: k % 2 === 0 ? 0xb3543e : 0xf4eee0, roughness: 0.5 }, [-0.95 + k * 0.42, 1.78, depth / 2 + 0.26]));
  return finish(options, cfg, g, body, undefined, 0.18 + height + 0.95, { width: width + 0.3, depth: depth + 0.3 });
};

// ── 不打烊贩卖店：不打烊贩卖店（黑洞 #65）───────────────────────────
const buildNightKiosk: Builder = (options, cfg) => {
  const { addPart } = options;
  const g = new THREE.Group();
  const width = 1.95, height = 1.75, depth = 1.85;
  addPart(g, new THREE.BoxGeometry(width + 0.45, 0.16, depth + 0.45), { color: 0xd6c9b9, roughness: 0.82, tex: 'pavement', rx: 2, ry: 2 }, [0, 0.08, 0]);
  // 玻璃盒体（夜里透着暖光）
  const body = addPart(g, new THREE.BoxGeometry(width, height, depth), { color: 0xf6dfae, roughness: 0.1, metalness: 0.15, emissive: 0xf1c46d, emissiveIntensity: 0.26, tex: 'mallglass', rx: 1, ry: 1 }, [0, 0.16 + height / 2 + 0.012, 0]);
  addPart(g, new THREE.BoxGeometry(width + 0.2, 0.13, depth + 0.2), { color: 0x4a4a52, roughness: 0.35, metalness: 0.4 }, [0, 0.16 + height + 0.077, 0]);
  // 雨棚
  addPart(g, new THREE.BoxGeometry(width + 0.3, 0.06, 0.5), { color: 0xe8a838, roughness: 0.45 }, [0, 1.6, depth / 2 + 0.2]);
  // 柜台与货架
  addPart(g, new THREE.BoxGeometry(width - 0.35, 0.4, 0.32), { color: 0x9b6b3f, roughness: 0.72, tex: 'wood', rx: 2, ry: 1 }, [0, 0.62, depth / 2 - 0.1]);
  [-0.45, 0, 0.45].forEach((x) => addPart(g, new THREE.BoxGeometry(0.28, 0.34, 0.24), { color: 0xd8d7d2, roughness: 0.6 }, [x, 1.05, -depth / 2 + 0.3], false));
  // 屋顶灯箱「24h」意象（不熄的小灯）
  addPart(g, new THREE.BoxGeometry(1.15, 0.36, 0.1), { color: 0xf8f7f5, roughness: 0.3, emissive: 0xf1c46d, emissiveIntensity: 0.4 }, [0, 0.16 + height + 0.32, depth / 2 - 0.15], false);
  [-0.3, 0.3].forEach((x) => addPart(g, new THREE.CylinderGeometry(0.03, 0.03, 0.22, 6), { color: 0x4a4a52, roughness: 0.4 }, [x, 0.16 + height + 0.16, depth / 2 - 0.15], false));
  // 风铃立柱（店门口的泠泠轻响）
  addPart(g, new THREE.CylinderGeometry(0.035, 0.05, 1.85, 8), { color: 0x9b6b3f, roughness: 0.7, tex: 'wood', rx: 1, ry: 1 }, [width / 2 + 0.62, 1.08, depth / 2 + 0.4]);
  addPart(g, new THREE.BoxGeometry(0.3, 0.045, 0.045), { color: 0x9b6b3f, roughness: 0.7 }, [width / 2 + 0.62, 2.05, depth / 2 + 0.4], false);
  [0.1, 0.2, 0.3].forEach((d, i) => addPart(g, new THREE.CylinderGeometry(0.022, 0.022, 0.16 + i * 0.05, 6), { color: i % 2 === 0 ? GOLD : 0xd8d7d2, roughness: 0.3, metalness: 0.4 }, [width / 2 + 0.52 + d, 1.96, depth / 2 + 0.4 + (i - 1) * 0.07], false));
  return finish(options, cfg, g, body, undefined, 0.16 + height + 0.85, { width: width + 0.7, depth: depth + 0.6 });
};

// ── 音乐盒：Never Gonna Give You Up（黑洞 #11）─────────────────────
const buildJukebox: Builder = (options, cfg) => {
  const { addPart } = options;
  const g = new THREE.Group();
  const width = 1.7, height = 2.15, depth = 1.15;
  addPart(g, new THREE.CylinderGeometry(1.35, 1.5, 0.14, 22), { color: 0xe8e7e4, roughness: 0.85, tex: 'pavement', rx: 2, ry: 2 }, [0, 0.07, 0]);
  // 木壳箱体
  const body = addPart(g, new THREE.BoxGeometry(width, height, depth), { color: 0x8a5a3a, roughness: 0.55, tex: 'wood', rx: 2, ry: 1 }, [0, 0.14 + height / 2 + 0.012, 0]);
  // 拱形顶
  addPart(g, new THREE.CylinderGeometry(width / 2, width / 2, depth, 18, 1, false, 0, Math.PI), { color: 0x74492e, roughness: 0.5, tex: 'wood', rx: 2, ry: 1 }, [0, 0.14 + height, 0], false).rotation.z = Math.PI / 2;
  // 彩色声浪拱条（点唱机的音乐彩虹）
  [0, 1, 2, 3].forEach((k) => {
    const r = 0.62 - k * 0.13;
    addPart(g, new THREE.TorusGeometry(r, 0.032, 8, 20, Math.PI), { color: [0xe85858, GOLD, 0x6ac878, BLUE][k], roughness: 0.3, emissive: [0xe85858, GOLD, 0x6ac878, BLUE][k], emissiveIntensity: 0.35 }, [0, 0.14 + height + 0.06, 0], false);
  });
  // 唱片选择窗与投币口
  addPart(g, new THREE.BoxGeometry(0.85, 0.6, 0.07), { color: 0x9ac7dc, roughness: 0.1, metalness: 0.2, tex: 'glass', rx: 1, ry: 1 }, [0, 1.42, depth / 2 + 0.03], false);
  addPart(g, new THREE.BoxGeometry(0.6, 0.4, 0.06), { color: 0xf4eee0, roughness: 0.4, emissive: 0xf1c46d, emissiveIntensity: 0.18 }, [0, 0.72, depth / 2 + 0.03], false);
  addPart(g, new THREE.CylinderGeometry(0.035, 0.035, 0.05, 10), { color: GOLD, roughness: 0.25, metalness: 0.6 }, [0.52, 1.06, depth / 2 + 0.05], false).rotation.x = Math.PI / 2;
  // 底座
  addPart(g, new THREE.BoxGeometry(width + 0.24, 0.12, depth + 0.24), { color: 0x4a4a52, roughness: 0.35 }, [0, 0.2, 0]);
  return finish(options, cfg, g, body, undefined, 0.14 + height + 0.85, { width: width + 0.3, depth: depth + 0.3 });
};

// ── 后室之门：后室的奇妙冒险（黑洞 #87）────────────────────────────
const buildBackroomsDoor: Builder = (options, cfg) => {
  const { addPart } = options;
  const g = new THREE.Group();
  addPart(g, new THREE.BoxGeometry(3.0, 0.14, 2.4), { color: 0xd8d3c0, roughness: 0.88, tex: 'pavement', rx: 2, ry: 2 }, [0, 0.07, 0]);
  // 泛黄壁纸墙段（L 形断墙）
  const wallMat = { color: 0xe3d9a8, roughness: 0.85, tex: 'wall', rx: 3, ry: 1 };
  addPart(g, new THREE.BoxGeometry(2.3, 2.45, 0.24), wallMat, [-0.3, 1.28, 0]);
  addPart(g, new THREE.BoxGeometry(0.24, 2.45, 1.1), wallMat, [-1.42, 1.28, -0.55]);
  // 墙脚踢线
  addPart(g, new THREE.BoxGeometry(2.34, 0.16, 0.27), { color: 0xc9bd86, roughness: 0.8 }, [-0.3, 0.23, 0]);
  // 门洞（内嵌深色，向后微退避免共面）
  addPart(g, new THREE.BoxGeometry(0.92, 1.98, 0.1), { color: 0x1c1a16, roughness: 1 }, [0.22, 1.11, -0.012], false);
  // 门框
  const frameMat = { color: 0xb8ac72, roughness: 0.7, tex: 'wood', rx: 1, ry: 1 };
  [-0.28, 0.72].forEach((x) => addPart(g, new THREE.BoxGeometry(0.13, 2.1, 0.3), frameMat, [x, 1.15, 0]));
  addPart(g, new THREE.BoxGeometry(1.13, 0.13, 0.3), frameMat, [0.22, 2.24, 0]);
  // 顶灯（忽明忽暗的日光灯管意象，静态微亮）
  addPart(g, new THREE.BoxGeometry(0.5, 0.07, 0.16), { color: 0xfdf6d8, roughness: 0.2, emissive: 0xfff2b8, emissiveIntensity: 0.55 }, [0.22, 2.5, 0.25], false);
  addPart(g, new THREE.CylinderGeometry(0.02, 0.02, 0.18, 6), { color: 0xb5b2ac, roughness: 0.4, metalness: 0.5 }, [0.22, 2.62, 0.25], false);
  // 「出口」指示牌（反讽：它指向门内）
  const sign = addPart(g, new THREE.BoxGeometry(0.44, 0.2, 0.05), { color: 0x2a4d2a, roughness: 0.4, emissive: 0x3a6f3a, emissiveIntensity: 0.3 }, [0.72, 2.0, 0.14], false);
  sign.rotation.z = -0.08;
  // 潮湿地面的倒影小水洼
  addPart(g, new THREE.CylinderGeometry(0.5, 0.5, 0.025, 16), { color: 0x9ac7dc, roughness: 0.08, metalness: 0.3, emissive: 0x5b92bd, emissiveIntensity: 0.05 }, [0.7, 0.16, 0.75], false);
  return finish(options, cfg, g, undefined, undefined, 2.9, { width: 3.0, depth: 2.4 });
};

/** 星语北城 12 栋建筑的 shape → builder 表（buildingMeshFactory 消费）。 */
export function createNorthDistrictBuilders(options: NorthBuildingOptions): Record<string, (cfg: BuildingDefinition) => BuildingEntity> {
  const wrap = (builder: Builder) => (cfg: BuildingDefinition) => builder(options, cfg);
  return {
    chat_plaza: wrap(buildChatPlaza),
    pigeon_square: wrap(buildPigeonSquare),
    planetarium: wrap(buildStellarHall),
    singularity: wrap(buildSingularity),
    binary_garden: wrap(buildBinaryGarden),
    ziggurat: wrap(buildZiggurat),
    monolith: wrap(buildMonolith),
    worry_store: wrap(buildWorryStore),
    bistro: wrap(buildBistro),
    night_kiosk: wrap(buildNightKiosk),
    jukebox: wrap(buildJukebox),
    backrooms_door: wrap(buildBackroomsDoor),
  };
}
