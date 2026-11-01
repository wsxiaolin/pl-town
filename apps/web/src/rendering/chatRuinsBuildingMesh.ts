// 第一聊天室遗迹（chatruins）：S001 会沉的城的场景建筑，单独建模。
// 半埋入坡地的门楣：两根石柱 + 微倾横梁 +「真·第一聊天室」木牌匾额，
// 向南三级下沉台阶暗示地层剖面（剧情本体是逐层发掘）。
// 材质走 stdMat 体系接入天气/资源池；匾额文字用一次性 CanvasTexture。
import * as THREE from 'three';
import type { MeshHelpers } from './meshFactory';
import type { BuildingDefinition, BuildingEntity } from '../city/buildingEntity';

export interface ChatRuinsOptions {
  platformHeight: number;
  makeMaterial: MeshHelpers['stdMat'];
  makeMesh: MeshHelpers['mk'];
  addPart: MeshHelpers['part'];
}

const STONE = 0x9a988e;
const STONE_WARM = 0xa8a396;
const WOOD = 0x8a6a48;
const WOOD_DARK = 0x6a4f34;

/** 一次性木牌匾额纹理（仅客户端，canvas 随材质释放）。 */
function lintelSignTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 96;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#8a6a48';
  ctx.fillRect(0, 0, 256, 96);
  ctx.strokeStyle = '#5a4028';
  ctx.lineWidth = 6;
  ctx.strokeRect(5, 5, 246, 86);
  ctx.fillStyle = '#f2e3c0';
  ctx.textAlign = 'center';
  ctx.font = 'bold 34px "Noto Serif SC", serif';
  ctx.fillText('真·第一聊天室', 128, 44);
  ctx.font = '20px "Noto Serif SC", serif';
  ctx.fillText('（鸽叽与黑纸勿进）', 128, 76);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

export function buildChatRuins(options: ChatRuinsOptions, definition: BuildingDefinition): BuildingEntity {
  const { addPart, makeMaterial, makeMesh, platformHeight: PLH } = options;
  const g = new THREE.Group();

  // 半埋体块：遗迹主体沉入坡地，只露出顶部一线（地层剖面的"已沉没"部分）。
  const bodyMat = makeMaterial({ color: STONE, roughness: 0.88, tex: 'ruin', rx: 1, ry: 1 });
  bodyMat.emissive = new THREE.Color(0x4a4a52);
  bodyMat.emissiveIntensity = 0;
  const body = makeMesh(new THREE.BoxGeometry(2.4, 0.9, 2.0), bodyMat);
  body.position.y = PLH - 0.1; // 大半沉入：下缘低于地面，露头 ~0.35。
  body.castShadow = body.receiveShadow = true;
  g.add(body);

  // 门楣：两根石柱 + 微倾横梁（岁月感），立在南侧入口。
  addPart(g, new THREE.BoxGeometry(0.26, 1.15, 0.26), { color: STONE_WARM, roughness: 0.85, tex: 'stone', rx: 1, ry: 1 }, [-0.62, PLH + 0.575, 0.62]);
  addPart(g, new THREE.BoxGeometry(0.26, 1.08, 0.26), { color: STONE_WARM, roughness: 0.85, tex: 'stone', rx: 1, ry: 1 }, [0.62, PLH + 0.54, 0.62]);
  const lintel = addPart(g, new THREE.BoxGeometry(1.72, 0.26, 0.34), { color: STONE_WARM, roughness: 0.82, tex: 'stone', rx: 1, ry: 1 }, [0, PLH + 1.28, 0.62]);
  lintel.rotation.z = 0.018;

  // 木牌匾额：挂在横梁前面（门牌原文只陈列不解释）。
  const signMat = new THREE.MeshStandardMaterial({ map: lintelSignTexture(), roughness: 0.85 });
  const sign = new THREE.Mesh(new THREE.BoxGeometry(1.0, 0.44, 0.05), signMat);
  sign.position.set(0, PLH + 0.92, 0.8);
  sign.castShadow = true;
  g.add(sign);

  // 地层台阶：三级下沉台阶向南（"一级一级往下沉的地层"）。
  addPart(g, new THREE.BoxGeometry(1.3, 0.14, 0.42), { color: 0x918e82, roughness: 0.9, tex: 'ruin', rx: 1, ry: 1 }, [0, PLH + 0.07, 1.06]);
  addPart(g, new THREE.BoxGeometry(1.3, 0.14, 0.42), { color: 0x8a877c, roughness: 0.9, tex: 'ruin', rx: 1, ry: 1 }, [0, PLH - 0.04, 1.42]);
  addPart(g, new THREE.BoxGeometry(1.3, 0.14, 0.42), { color: 0x838075, roughness: 0.9, tex: 'ruin', rx: 1, ry: 1 }, [0, PLH - 0.15, 1.78]);

  // 散落碎石（考古现场感）。
  addPart(g, new THREE.BoxGeometry(0.34, 0.2, 0.3), { color: STONE, roughness: 0.9, tex: 'ruin', rx: 1, ry: 1 }, [-0.95, PLH + 0.08, 0.15]);
  addPart(g, new THREE.BoxGeometry(0.26, 0.16, 0.26), { color: 0x8f8c80, roughness: 0.9, tex: 'ruin', rx: 1, ry: 1 }, [0.98, PLH + 0.06, -0.35]);

  // 入口标记（非 storyLocked：蓝色圆盘，同其他可访问建筑惯例）。
  addPart(g, new THREE.CylinderGeometry(0.13, 0.13, 0.04, 16), { color: 0x4a90d9, emissive: 0x2a60a9, emissiveIntensity: 0.28 }, [0, PLH + 0.045, 0.62], false);

  g.position.set(definition.x, 0, definition.z);
  g.traverse((object) => { if (object instanceof THREE.Mesh) object.userData.buildingId = definition.id; });
  return { ...definition, group: g, body, bodyMat, labelEl: null, labelY: PLH + 1.9 };
}
