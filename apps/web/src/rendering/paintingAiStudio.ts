// 「绘画+AI」画室：白盒子画廊 + 门前大画布（画着小城剪影）+ 调色盘 + 大铅笔
// + 屋顶悬浮 AI 像素块。纯几何建造器：无 DOM、无场景副作用，只经 helpers 造网格。
import * as THREE from 'three';
import type { MeshHelpers } from './meshFactory';
import type { BuildingDefinition, BuildingEntity } from '../city/buildingEntity';

type StudioHelpers = {
  platformHeight: number;
  makeMaterial: MeshHelpers['stdMat'];
  makeMesh: MeshHelpers['mk'];
  addPart: MeshHelpers['part'];
};

export function buildPaintingAiStudio(
  { platformHeight: PLH, makeMaterial: stdMat, makeMesh: mk, addPart: part }: StudioHelpers,
  cfg: BuildingDefinition,
): BuildingEntity {
  const g = new THREE.Group();
  const width = 2.4, depth = 2.2, height = 1.7;
  // 台基与画廊主体
  part(g, new THREE.BoxGeometry(width + 0.7, PLH, depth + 0.7), { color: 0xeae9e6, roughness: 0.85, tex: 'stone', rx: 2, ry: 2 }, [0, PLH / 2, 0]);
  const bodyMat = stdMat({ color: 0xffffff, roughness: 0.35, tex: 'wall', rx: 2, ry: 1 });
  bodyMat.emissive = new THREE.Color(0x3b6fe0);
  bodyMat.emissiveIntensity = 0;
  const body = mk(new THREE.BoxGeometry(width, height, depth), bodyMat);
  body.position.y = PLH + height / 2 + 0.012;
  body.castShadow = body.receiveShadow = true;
  g.add(body);
  const top = PLH + height;
  // 屋檐与天窗（天窗顶板与玻璃盒顶保留错位，避免远镜头共面闪烁）
  part(g, new THREE.BoxGeometry(width + 0.34, 0.14, depth + 0.34), { color: 0xf8f7f5, roughness: 0.4, tex: 'rooftile', rx: 2, ry: 2 }, [0, top + 0.07, 0]);
  part(g, new THREE.BoxGeometry(0.9, 0.5, 0.9), { color: 0xdfe8f6, roughness: 0.1, tex: 'glass', rx: 1, ry: 1 }, [0.35, top + 0.14 + 0.25, -0.3]);
  part(g, new THREE.BoxGeometry(1.02, 0.08, 1.02), { color: 0xf8f7f5, roughness: 0.4, tex: 'metal', rx: 1, ry: 1 }, [0.35, top + 0.14 + 0.58, -0.3]);
  // 门与门前大画布：画框 → 画纸 → 小城剪影 → 落款太阳，z 逐层错开
  const frontZ = depth / 2 + 0.05;
  part(g, new THREE.BoxGeometry(0.5, 0.95, 0.06), { color: 0x35404e, roughness: 0.6, tex: 'wood', rx: 1, ry: 2 }, [-0.7, PLH + 0.48, frontZ], false);
  part(g, new THREE.BoxGeometry(1.06, 0.78, 0.05), { color: 0xc4a86d, roughness: 0.7, tex: 'wood', rx: 1, ry: 1 }, [0.42, PLH + 1.08, frontZ + 0.02], false);
  part(g, new THREE.BoxGeometry(0.94, 0.66, 0.055), { color: 0xf6efdd, roughness: 0.9 }, [0.42, PLH + 1.08, frontZ + 0.045], false);
  const paintZ = frontZ + 0.09;
  const ink = { color: 0x33518f, roughness: 0.55 };
  part(g, new THREE.BoxGeometry(0.16, 0.2, 0.02), ink, [0.2, PLH + 0.98, paintZ], false);
  part(g, new THREE.ConeGeometry(0.1, 0.12, 4), ink, [0.2, PLH + 1.14, paintZ], false).rotation.y = Math.PI / 4;
  part(g, new THREE.BoxGeometry(0.11, 0.32, 0.02), ink, [0.42, PLH + 1.03, paintZ], false);
  part(g, new THREE.BoxGeometry(0.18, 0.15, 0.02), ink, [0.63, PLH + 0.955, paintZ], false);
  part(g, new THREE.CylinderGeometry(0.045, 0.045, 0.02, 12), ink, [0.63, PLH + 1.06, paintZ], false).rotation.x = Math.PI / 2;
  part(g, new THREE.CylinderGeometry(0.04, 0.04, 0.02, 12), { color: 0xe8a838, emissive: 0xe8a838, emissiveIntensity: 0.3, roughness: 0.5 }, [0.72, PLH + 1.26, paintZ], false).rotation.x = Math.PI / 2;
  // 门前调色盘招牌与颜料点
  part(g, new THREE.CylinderGeometry(0.28, 0.28, 0.04, 18), { color: 0xb98d5a, roughness: 0.7, tex: 'wood', rx: 1, ry: 1 }, [1.1, PLH + 0.52, depth / 2 + 0.28], false).rotation.x = Math.PI / 2 - 0.12;
  [0xd96f5a, 0x3b6fe0, 0xe8c14c].forEach((color, i) => {
    part(g, new THREE.CylinderGeometry(0.045, 0.045, 0.045, 10), { color, roughness: 0.5 }, [1.0 + i * 0.11, PLH + 0.56 + i * 0.015, depth / 2 + 0.29 - i * 0.008], false).rotation.x = Math.PI / 2 - 0.12;
  });
  // 靠在侧墙的大铅笔：笔杆 → 削木 → 铅芯
  part(g, new THREE.CylinderGeometry(0.055, 0.055, 1.45, 10), { color: 0xe8b64c, roughness: 0.6, tex: 'wood', rx: 1, ry: 3 }, [1.52, PLH + 0.6, 0.85]).rotation.z = -0.2;
  part(g, new THREE.ConeGeometry(0.055, 0.2, 10), { color: 0xe2cdb0, roughness: 0.8 }, [1.375, PLH - 0.11, 0.955]).rotation.z = -0.2;
  part(g, new THREE.ConeGeometry(0.022, 0.09, 10), { color: 0x2a3038, roughness: 0.5 }, [1.328, PLH - 0.2, 0.973]).rotation.z = -0.2;
  // 屋顶悬浮的 AI 像素块
  const pixels: Array<[number, number, number, number]> = [
    [-0.85, top + 0.66, -0.2, 0.14],
    [0.05, top + 0.92, 0.15, 0.1],
    [0.78, top + 0.74, -0.38, 0.08],
  ];
  for (const [x, y, z, s] of pixels) {
    part(g, new THREE.BoxGeometry(s, s, s), { color: 0x3b6fe0, emissive: 0x3b6fe0, emissiveIntensity: 0.55, roughness: 0.3 }, [x, y, z], false);
  }
  // 入口标记盘
  part(g, new THREE.CylinderGeometry(0.14, 0.14, 0.05, 20), { color: 0x3b6fe0, emissive: 0x3b6fe0, emissiveIntensity: 0.28 }, [0, PLH + 0.05, 0], false);
  g.position.set(cfg.x, 0, cfg.z);
  tagMeshes(g, cfg.id);
  return { ...cfg, group: g, body, bodyMat, labelEl: null, labelY: top + 1.6 };
}

function tagMeshes(group: THREE.Object3D, id: string): void {
  group.traverse((child) => {
    if ('isMesh' in child && child.isMesh) child.userData.buildingId = id;
  });
}
