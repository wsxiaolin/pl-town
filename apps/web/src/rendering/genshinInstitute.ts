// 原神研究院（north_genshin_institute）：致敬《原神》启动页的彩蛋体验建筑。
// 外观为程序化的提瓦特风格研究塔：浅色石砌厅身、八角主塔与金色圆穹顶、
// 拱形「传送门」大门（青蓝发光）、门楣七元素圆徽，与本城浅色体量 +
// 蓝金点缀的北城视觉语言一致。启动页全屏体验见 city/genshin/ 目录
// （动态 import 拆分 chunk，闲置时仅预下载源码不运行渲染）。
import * as THREE from 'three';
import type { MaterialParameters } from './meshFactory';
import type { BuildingDefinition, BuildingEntity } from '../city/buildingEntity';

export interface GenshinInstituteOptions {
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

const GOLD = 0xe8a838;
const CYAN = 0x8fd8e8;

export function buildGenshinInstitute(options: GenshinInstituteOptions, cfg: BuildingDefinition): BuildingEntity {
  const { addPart } = options;
  const g = new THREE.Group();
  const width = 3.4, height = 1.7, depth = 2.6;
  const FLOOR = 0.18;

  // ── 台基与台阶 ──
  addPart(g, new THREE.BoxGeometry(width + 0.8, FLOOR, depth + 0.8), { color: 0xe4ddc9, roughness: 0.85, tex: 'stone', rx: 2, ry: 2 }, [0, FLOOR / 2, 0]);
  for (let i = 0; i < 2; i += 1) {
    addPart(g, new THREE.BoxGeometry(1.5, 0.09, 0.3), { color: 0xd8d0ba, roughness: 0.85, tex: 'stone', rx: 1, ry: 1 }, [0, FLOOR - 0.135 - i * 0.09, depth / 2 + 0.45 + i * 0.3]);
  }

  // ── 主厅身（浅色石墙 + 金色檐口）──
  const wallMat = { color: 0xf2ece0, roughness: 0.55, tex: 'wall', rx: 3, ry: 1 };
  const body = addPart(g, new THREE.BoxGeometry(width, height, depth), wallMat, [0, FLOOR + height / 2 + 0.012, 0]);
  addPart(g, new THREE.BoxGeometry(width + 0.2, 0.14, depth + 0.2), { color: GOLD, roughness: 0.35, metalness: 0.4 }, [0, FLOOR + height + 0.07, 0]);

  // ── 拱形「传送门」大门（青蓝发光门洞）──
  const doorW = 1.05, doorH = 1.3;
  addPart(g, new THREE.BoxGeometry(doorW + 0.34, doorH + 0.36, 0.16), { color: 0xe9e2d2, roughness: 0.6, tex: 'stone', rx: 1, ry: 1 }, [0, FLOOR + (doorH + 0.36) / 2 - 0.02, depth / 2 + 0.02]);
  const doorGlow = { color: 0xbfeaf6, roughness: 0.1, emissive: 0x6fd0e8, emissiveIntensity: 0.85, tex: 'glass', rx: 1, ry: 1 };
  addPart(g, new THREE.BoxGeometry(doorW, doorH, 0.06), doorGlow, [0, FLOOR + doorH / 2 + 0.06, depth / 2 + 0.08], false);
  const arch = addPart(g, new THREE.CylinderGeometry(doorW / 2 + 0.08, doorW / 2 + 0.08, 0.1, 16, 1, false, 0, Math.PI), { color: GOLD, roughness: 0.3, metalness: 0.45 }, [0, FLOOR + doorH + 0.1, depth / 2 + 0.09], false);
  arch.rotation.z = Math.PI / 2;
  // 门缝中缝（启动页门缝白光的缩影）
  addPart(g, new THREE.BoxGeometry(0.05, doorH, 0.02), { color: 0xffffff, emissive: 0xffffff, emissiveIntensity: 1.0, roughness: 0.1 }, [0, FLOOR + doorH / 2 + 0.06, depth / 2 + 0.115], false);

  // ── 门楣七元素圆徽（金色环 + 青色圆心）──
  addPart(g, new THREE.TorusGeometry(0.3, 0.05, 8, 24), { color: GOLD, roughness: 0.28, metalness: 0.5, emissive: 0xe8a838, emissiveIntensity: 0.22 }, [0, FLOOR + doorH + 0.62, depth / 2 + 0.1], false);
  addPart(g, new THREE.CylinderGeometry(0.27, 0.27, 0.05, 20), { color: CYAN, roughness: 0.15, emissive: 0x6fd0e8, emissiveIntensity: 0.3 }, [0, FLOOR + doorH + 0.62, depth / 2 + 0.08], false).rotation.x = Math.PI / 2;

  // ── 两侧翼柱（檐口小尖塔柱）──
  [-width / 2 - 0.12, width / 2 + 0.12].forEach((x) => {
    addPart(g, new THREE.BoxGeometry(0.34, 0.4, 0.34), { color: 0xe9e2d2, roughness: 0.6, tex: 'stone', rx: 1, ry: 1 }, [x, FLOOR + height + 0.32, depth / 2 - 0.5]);
    addPart(g, new THREE.CylinderGeometry(0.05, 0.09, 0.5, 8), { color: 0xe9e2d2, roughness: 0.6, tex: 'stone', rx: 1, ry: 1 }, [x, FLOOR + height + 0.75, depth / 2 - 0.5]);
    addPart(g, new THREE.OctahedronGeometry(0.09), { color: GOLD, roughness: 0.25, metalness: 0.45, emissive: 0xe8a838, emissiveIntensity: 0.25 }, [x, FLOOR + height + 1.06, depth / 2 - 0.5], false);
  });

  // ── 拱窗（青蓝暖光）──
  [-1.05, 1.05].forEach((x) => {
    addPart(g, new THREE.BoxGeometry(0.44, 0.62, 0.07), { color: 0xbfe0ff, roughness: 0.1, metalness: 0.15, emissive: 0x8fd0e8, emissiveIntensity: 0.28, tex: 'glass', rx: 1, ry: 1 }, [x, FLOOR + height * 0.62, depth / 2 + 0.03], false);
    const winArch = addPart(g, new THREE.CylinderGeometry(0.22, 0.22, 0.07, 12, 1, false, 0, Math.PI), { color: GOLD, roughness: 0.3, metalness: 0.4 }, [x, FLOOR + height * 0.62 + 0.31, depth / 2 + 0.03], false);
    winArch.rotation.z = Math.PI / 2;
  });

  // ── 中央八角塔 + 金色圆穹顶 ──
  const towerBaseY = FLOOR + height;
  const towerH = 1.15;
  addPart(g, new THREE.CylinderGeometry(0.78, 0.88, towerH, 8), { color: 0xf0e9da, roughness: 0.55, tex: 'wall', rx: 3, ry: 1 }, [0, towerBaseY + towerH / 2 + 0.08, -0.25]);
  addPart(g, new THREE.CylinderGeometry(0.92, 0.92, 0.12, 8), { color: GOLD, roughness: 0.32, metalness: 0.45 }, [0, towerBaseY + towerH + 0.13, -0.25]);
  // 圆穹顶（蓝色玻璃质感，仰望星空的研究穹台）
  addPart(g, new THREE.SphereGeometry(0.82, 20, 12, 0, Math.PI * 2, 0, Math.PI / 2), { color: 0x4a86c8, roughness: 0.12, metalness: 0.25, tex: 'mallglass', rx: 1, ry: 1 }, [0, towerBaseY + towerH + 0.19, -0.25]);
  // 塔身拱窗（四面）
  [0, Math.PI / 2, Math.PI, Math.PI * 1.5].forEach((a) => {
    const wx = Math.sin(a) * 0.72, wz = Math.cos(a) * 0.72 - 0.25;
    const win = addPart(g, new THREE.BoxGeometry(0.26, 0.5, 0.06), { color: 0xbfe0ff, roughness: 0.1, emissive: 0x8fd0e8, emissiveIntensity: 0.32, tex: 'glass', rx: 1, ry: 1 }, [wx, towerBaseY + towerH * 0.55, wz], false);
    win.rotation.y = a;
  });
  // 穹顶尖饰
  addPart(g, new THREE.CylinderGeometry(0.03, 0.05, 0.34, 8), { color: GOLD, roughness: 0.28, metalness: 0.5 }, [0, towerBaseY + towerH + 0.95, -0.25], false);
  addPart(g, new THREE.OctahedronGeometry(0.11), { color: GOLD, roughness: 0.22, metalness: 0.5, emissive: 0xe8a838, emissiveIntensity: 0.35 }, [0, towerBaseY + towerH + 1.2, -0.25], false);

  // ── 门前石灯柱（一对，暖光呼应启动页）──
  [-1.35, 1.35].forEach((x) => {
    addPart(g, new THREE.CylinderGeometry(0.055, 0.075, 0.85, 8), { color: 0xe9e2d2, roughness: 0.6, tex: 'stone', rx: 1, ry: 1 }, [x, FLOOR + 0.42, depth / 2 + 0.75]);
    addPart(g, new THREE.SphereGeometry(0.1, 10, 10), { color: 0xfff2d0, roughness: 0.2, emissive: 0xf6dfae, emissiveIntensity: 0.55 }, [x, FLOOR + 0.92, depth / 2 + 0.75], false);
    addPart(g, new THREE.CylinderGeometry(0.13, 0.13, 0.05, 10), { color: GOLD, roughness: 0.3, metalness: 0.45 }, [x, FLOOR + 1.0, depth / 2 + 0.75], false);
  });

  g.position.set(cfg.x, 0, cfg.z);
  g.userData.navigationFootprint = { width: width + 0.9, depth: depth + 1.5 };
  g.traverse((child) => {
    if ((child as THREE.Mesh).isMesh) child.userData.buildingId = cfg.id;
  });
  return { ...cfg, group: g, body, bodyMat: undefined, labelEl: null, labelY: towerBaseY + towerH + 1.5 };
}
