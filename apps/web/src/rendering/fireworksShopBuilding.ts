// 烟花铺（fireworks_shop）：海滩南侧的节庆小店，单独建模。
// 木板瓦屋顶 + 悬檐红灯笼 + 「烟花」匾额 + 柜台上的纸筒烟花架。
// 材质走 stdMat 体系接入天气/资源池；匾额文字用一次性 CanvasTexture。
import * as THREE from 'three';
import type { MeshHelpers } from './meshFactory';
import type { BuildingDefinition, BuildingEntity } from '../city/buildingEntity';

export interface FireworksShopOptions {
  platformHeight: number;
  makeMaterial: MeshHelpers['stdMat'];
  makeMesh: MeshHelpers['mk'];
  addPart: MeshHelpers['part'];
}

const RED = 0x8c2f2a;
const RED_DEEP = 0x6d2320;
const WOOD = 0x7a5539;
const WOOD_DARK = 0x5a3f2c;
const GOLD = 0xd9a441;
const ROOF = 0x3c3a3f;
const PAPER = 0xf2e3c0;

/** 一次性文字匾额纹理（仅客户端，canvas 泄漏随材质释放）。 */
function textPlateTexture(text: string): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 64;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#8c2f2a';
  ctx.fillRect(0, 0, 128, 64);
  ctx.strokeStyle = '#d9a441';
  ctx.lineWidth = 5;
  ctx.strokeRect(5, 5, 118, 54);
  ctx.fillStyle = '#f6d98d';
  ctx.font = 'bold 34px "Noto Serif SC", serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, 64, 35);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

export function buildFireworksShop(options: FireworksShopOptions, definition: BuildingDefinition): BuildingEntity {
  const { addPart, makeMaterial, platformHeight } = options;
  const outer = new THREE.Group();
  const g = new THREE.Group();
  outer.add(g);

  // 海滩沙面 y=0.07，木板基座抬到 0.12（层差 ≥0.004 防远镜头 z-fighting）。
  const baseY = 0.12;
  addPart(g, new THREE.BoxGeometry(6.2, 0.14, 5.2), { color: 0x9a7a52, roughness: 0.9, tex: 'wood', rx: 3, ry: 2 }, [0, baseY, 0]);
  // 木板条缝隙暗示。
  for (let i = -2; i <= 2; i += 1) {
    addPart(g, new THREE.BoxGeometry(6.24, 0.02, 0.08), { color: 0x85643f, roughness: 0.92 }, [0, baseY + 0.075, i * 1.05], false);
  }

  const wallY = baseY + 0.07;
  // 主体墙（双面同色，红木商店）。
  addPart(g, new THREE.BoxGeometry(4.4, 2.9, 3.4), { color: RED, roughness: 0.82, tex: 'wall', rx: 3, ry: 2 }, [0, wallY + 1.45, 0]);
  // 白灰腰线与金饰。
  addPart(g, new THREE.BoxGeometry(4.5, 0.16, 3.5), { color: PAPER, roughness: 0.85 }, [0, wallY + 0.55, 0], false);
  addPart(g, new THREE.BoxGeometry(4.5, 0.1, 3.5), { color: GOLD, roughness: 0.5, metalness: 0.3 }, [0, wallY + 2.62, 0], false);

  // 门与橱窗（面向 +x 侧的步道）。
  addPart(g, new THREE.BoxGeometry(0.06, 1.8, 1.05), { color: RED_DEEP, roughness: 0.7, tex: 'wood', rx: 1, ry: 1 }, [2.21, wallY + 0.97, -0.7], false);
  addPart(g, new THREE.BoxGeometry(0.05, 1.1, 1.5), { color: 0xffd98c, emissive: 0xd9a441, emissiveIntensity: 0.45, roughness: 0.3, tex: 'glass' }, [2.21, wallY + 1.2, 0.85], false);
  // 橱窗里的成品烟花筒。
  for (let i = 0; i < 3; i += 1) {
    addPart(g, new THREE.CylinderGeometry(0.09, 0.09, 0.7, 8), { color: i % 2 ? RED_DEEP : GOLD, roughness: 0.6 }, [2.3, wallY + 0.42, 0.5 + i * 0.38], false).rotation.z = Math.PI / 2;
  }

  // 屋顶：双层出檐 + 正脊，檐角上翘的简笔表达。
  const roofY = wallY + 2.95;
  addPart(g, new THREE.BoxGeometry(5.6, 0.22, 4.5), { color: ROOF, roughness: 0.9 }, [0, roofY + 0.28, 0]);
  addPart(g, new THREE.BoxGeometry(5.0, 0.2, 3.9), { color: 0x4a4850, roughness: 0.9 }, [0, roofY + 0.75, 0]);
  addPart(g, new THREE.BoxGeometry(5.7, 0.16, 0.5), { color: 0x2f2d33, roughness: 0.9 }, [0, roofY + 0.44, 2.05], false);
  addPart(g, new THREE.BoxGeometry(5.7, 0.16, 0.5), { color: 0x2f2d33, roughness: 0.9 }, [0, roofY + 0.44, -2.05], false);
  // 檐角翘起块。
  ([[ -2.72, 2.16, 0.09 ], [ 2.72, 2.16, 0.09 ], [ -2.72, -2.16, -0.09 ], [ 2.72, -2.16, -0.09 ]] as Array<[number, number, number]>).forEach(([x, z, rz]) => {
    const tip = addPart(g, new THREE.BoxGeometry(0.5, 0.1, 0.4), { color: 0x2f2d33, roughness: 0.9 }, [x, roofY + 0.47, z], false);
    tip.rotation.z = rz;
  });

  // 「烟花」匾额（朝向 +x 主入口）。
  const plaqueMats = makeMaterial({ color: 0xffffff, roughness: 0.6 });
  plaqueMats.map = textPlateTexture('烟花鋪');
  plaqueMats.needsUpdate = true;
  const plaque = addPart(g, new THREE.BoxGeometry(0.08, 0.62, 1.5), plaqueMats, [2.32, wallY + 2.35, 0], false);
  plaque.castShadow = false;

  // 檐下红灯笼 ×2（微弱自发光，夜间由主题装饰统一增强）。
  [-1.4, 1.4].forEach((z) => {
    const lantern = addPart(g, new THREE.SphereGeometry(0.26, 12, 10), { color: 0xd23c30, emissive: 0xc23a28, emissiveIntensity: 0.5, roughness: 0.5 }, [2.45, wallY + 2.1, z], false);
    lantern.scale.y = 1.15;
    addPart(g, new THREE.CylinderGeometry(0.07, 0.07, 0.08, 8), { color: GOLD, roughness: 0.5 }, [2.45, wallY + 2.36, z], false);
    addPart(g, new THREE.CylinderGeometry(0.07, 0.07, 0.08, 8), { color: GOLD, roughness: 0.5 }, [2.45, wallY + 1.86, z], false);
    addPart(g, new THREE.CylinderGeometry(0.015, 0.015, 0.3, 6), { color: WOOD_DARK, roughness: 0.8 }, [2.3, wallY + 2.42, z], false);
  });

  // 柜台前正在捆扎的烟花架：锥头火箭 ×5。
  for (let i = 0; i < 5; i += 1) {
    const x = -1.6 + i * 0.55;
    addPart(g, new THREE.CylinderGeometry(0.07, 0.07, 0.85, 8), { color: i % 2 ? RED : GOLD, roughness: 0.55 }, [x, wallY + 1.55, 1.95], false);
    const tip = addPart(g, new THREE.ConeGeometry(0.08, 0.2, 8), { color: RED_DEEP, roughness: 0.5 }, [x, wallY + 2.06, 1.95], false);
    tip.rotation.z = (i - 2) * 0.1;
  }
  // 立柱招牌架（背侧）。
  addPart(g, new THREE.CylinderGeometry(0.06, 0.07, 2.2, 8), { color: WOOD, roughness: 0.85, tex: 'wood' }, [-2.4, wallY + 1.1, -2.0]);
  addPart(g, new THREE.CylinderGeometry(0.06, 0.07, 2.2, 8), { color: WOOD, roughness: 0.85, tex: 'wood' }, [2.4, wallY + 1.1, -2.0]);

  g.position.set(definition.x, 0, definition.z);
  tagMeshes(g, definition.id);
  return { ...definition, group: outer, body: undefined, bodyMat: undefined, labelEl: null, labelY: roofY + 1.5 };
  function tagMeshes(root: THREE.Object3D, id: string): void {
    root.traverse((child) => { child.userData.buildingId = id; });
  }
}
