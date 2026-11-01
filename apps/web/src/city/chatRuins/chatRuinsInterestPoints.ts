import * as THREE from 'three';
import { CHATRUINS_AREA } from '../data/cityConfig';
import type { SceneInterestPointEntity, SceneInterestPointOptions } from '../../rendering/sceneInterestPoints';

/**
 * S001 会沉的城 · 第一聊天室遗迹兴趣点组（发掘点①-⑤ + 涂鸦墙）。
 *
 * 显隐语义（与 echo 剧情共用 setActiveStoryPoints 通道，见 rendering/sceneInterestPoints.ts）：
 *  - 底座（碎石堆 / 矮墙 / 地基石）常显——遗迹「一直在那里」是叙事前提；
 *    未开始剧情时五个发掘点与涂鸦墙静静躺在坡地上。
 *  - investigationMarker（黄锥脉动）与 hitbox 仅在对应层成为当前 worldInteraction
 *    时出现（storyActivationVisual）——「灰显的层够不到，『够不到』就是最好的提示」。
 *  - 地基石（⑤）夜间 20:00-23:00 泛暖光（程序化 emissive 呼吸，零资产）；
 *    8-19 开国日涂鸦墙上方挂小旗（当日显示，零资产）。
 */
export interface ChatRuinsInterestPointsResult {
  entities: readonly SceneInterestPointEntity[];
  update: (elapsedSeconds: number) => void;
  dispose: () => void;
}

const DIG_POINT_IDS = ['chatruins-dig-1', 'chatruins-dig-2', 'chatruins-dig-3', 'chatruins-dig-4', 'chatruins-dig-5'] as const;

/** 北京小时（Asia/Shanghai 固定 +8，与控制器同口径）。 */
function beijingHour(): number {
  return Number(new Date(Date.now() + 8 * 60 * 60 * 1000).toISOString().slice(11, 13));
}

/** 北京日期键（与控制器 beijingDayKey 同口径）。 */
function beijingDayKey(): string {
  return new Date(Date.now() + 8 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

/** 给 mesh 打场景兴趣点标签（raycast 命中后反查交互 id）。 */
function tag(object: THREE.Object3D, id: string): void {
  object.traverse((child) => {
    if (child instanceof THREE.Mesh) child.userData.sceneInterestPointId = id;
  });
}

/** 添加调查标记（黄锥脉动，storyActivationVisual 显隐）。 */
function addInvestigationMarker(object: THREE.Object3D, options: SceneInterestPointOptions, position: readonly [number, number, number]): THREE.Mesh {
  const marker = options.makeMesh(
    new THREE.ConeGeometry(0.2, 0.36, 4),
    options.materialFor({ color: 0xf2c94c, emissive: 0x8a6500, emissiveIntensity: 0.5, roughness: 0.55 }),
  );
  marker.position.set(...position);
  marker.rotation.x = Math.PI;
  marker.visible = false;
  marker.userData.investigationMarker = true;
  marker.userData.storyActivationVisual = true;
  marker.userData.markerBaseY = position[1];
  object.add(marker);
  return marker;
}

/** 添加交互 hitbox（透明盒，storyActivationVisual 显隐；进 raycastTargets 由激活集合控制）。 */
function addStoryHitbox(object: THREE.Object3D, options: SceneInterestPointOptions, size: readonly [number, number, number], position: readonly [number, number, number]): void {
  const hitbox = options.makeMesh(
    new THREE.BoxGeometry(...size),
    options.materialFor({ color: 0xffffff, transparent: true, opacity: 0 }),
  );
  hitbox.position.set(...position);
  hitbox.visible = false;
  hitbox.userData.storyActivationVisual = true;
  hitbox.userData.storyInteractionTarget = true;
  object.add(hitbox);
}

/** 单个发掘点：灰显碎石底座（常显）+ 出土木签 + 脉动标记与 hitbox（按层激活）。 */
function createDigPoint(options: SceneInterestPointOptions, index: number): SceneInterestPointEntity {
  const id = DIG_POINT_IDS[index]!;
  const [x, z] = CHATRUINS_AREA.digPoints[index]!;
  const yBase = -0.07 * index; // 自北向南逐层下沉：地层剖面语义。
  const object = new THREE.Group();

  // 碎石底座：三块风化岩（Dodecahedron，灰阶交替）。
  const rockMaterials = [0x8f8d84, 0x7d7b73, 0x999789].map((color) => options.materialFor({ color, roughness: 0.95 }));
  const rockSpots: readonly (readonly [number, number, number, number])[] = [
    [0, 0, 0, 0.3], [0.42, 0, 0.18, 0.22], [-0.34, 0, -0.22, 0.26],
  ];
  rockSpots.forEach(([rx, ry, rz, scale], rockIndex) => {
    const rock = options.makeMesh(new THREE.DodecahedronGeometry(scale, 1), rockMaterials[rockIndex % rockMaterials.length]!);
    rock.position.set(rx, yBase + scale * 0.55, rz);
    rock.rotation.set(rockIndex * 1.1, rockIndex * 2.3, rockIndex * 0.7);
    rock.castShadow = true;
    rock.receiveShadow = true;
    object.add(rock);
  });

  // 出土木签：细柱 + 斜顶小牌（考古探方标签的剪影）。
  const stake = options.makeMesh(new THREE.CylinderGeometry(0.028, 0.036, 0.62, 8), options.materialFor({ color: 0x6b5642, roughness: 1 }));
  stake.position.set(0.3, yBase + 0.31, -0.3);
  stake.castShadow = true;
  object.add(stake);
  const plate = options.makeMesh(new THREE.BoxGeometry(0.3, 0.16, 0.03), options.materialFor({ color: 0xd9cbb2, roughness: 0.85 }));
  plate.position.set(0.3, yBase + 0.56, -0.3);
  plate.rotation.z = -0.12;
  object.add(plate);

  // ⑤ 为地基石层：平整基石常显 + 夜间微光材质（dynamicMaterial，update 驱动）。
  if (index === 4) {
    const foundationGlow = new THREE.MeshStandardMaterial({ color: 0xa8a094, roughness: 0.78, emissive: new THREE.Color(0xd9a04a), emissiveIntensity: 0 });
    const foundation = options.makeMesh(new THREE.BoxGeometry(1.35, 0.2, 1.35), foundationGlow);
    foundation.position.set(0, yBase + 0.1, 0);
    foundation.receiveShadow = true;
    foundation.userData.dynamicMaterial = foundationGlow;
    object.add(foundation);
  }

  addStoryHitbox(object, options, [1.35, 1.1, 1.35], [0, yBase + 0.55, 0]);
  addInvestigationMarker(object, options, [0, yBase + 1.28, 0]);
  object.position.set(x, 0, z);
  tag(object, id);
  options.scene.add(object);
  return { id, object, interactionPosition: new THREE.Vector3(x, 0, z) };
}

/** 涂鸦墙：西侧矮墙（常显）+ 计数小牌 + 8-19 开国小旗 + 脉动标记与 hitbox（wall-open 激活）。 */
function createGraffitiWall(options: SceneInterestPointOptions): { entity: SceneInterestPointEntity; flag: THREE.Object3D } {
  const object = new THREE.Group();
  const [x, z] = CHATRUINS_AREA.wall;

  // 矮墙主体：两段石板 + 顶部压条（半塌的院墙剪影）。
  const stone = options.materialFor({ color: 0x93907f, roughness: 0.92 });
  const wallA = options.makeMesh(new THREE.BoxGeometry(1.5, 0.85, 0.28), stone);
  wallA.position.set(-0.7, 0.425, 0);
  wallA.castShadow = true;
  wallA.receiveShadow = true;
  object.add(wallA);
  const wallB = options.makeMesh(new THREE.BoxGeometry(1.05, 0.62, 0.28), stone);
  wallB.position.set(0.62, 0.31, 0.05);
  wallB.rotation.z = 0.05;
  wallB.castShadow = true;
  object.add(wallB);
  const rim = options.makeMesh(new THREE.BoxGeometry(2.6, 0.09, 0.36), options.materialFor({ color: 0xa8a592, roughness: 0.7 }));
  rim.position.set(-0.1, 0.88, 0.02);
  rim.rotation.z = 0.015;
  object.add(rim);

  // 计数小牌：木底白面（具体计数 26532 在对话面板 UI 呈现）。
  const counter = options.makeMesh(new THREE.BoxGeometry(0.52, 0.3, 0.05), options.materialFor({ color: 0xe8e2d2, roughness: 0.6 }));
  counter.position.set(0.1, 0.62, 0.18);
  object.add(counter);

  // 8-19 开国日小旗：旗杆 + 三角旗（当日 visible）。
  const flag = new THREE.Group();
  const pole = options.makeMesh(new THREE.CylinderGeometry(0.018, 0.024, 0.9, 6), options.materialFor({ color: 0x6b5642, roughness: 1 }));
  pole.position.y = 0.45;
  flag.add(pole);
  const banner = options.makeMesh(
    new THREE.BufferGeometry(),
    options.materialFor({ color: 0xd4774f, roughness: 0.7, side: THREE.DoubleSide }),
  );
  banner.geometry.setFromPoints([
    new THREE.Vector3(0, 0.9, 0), new THREE.Vector3(0.34, 0.78, 0), new THREE.Vector3(0, 0.66, 0),
  ]);
  banner.geometry.computeVertexNormals();
  flag.add(banner);
  flag.position.set(1.05, 0, 0.1);
  flag.visible = beijingDayKey().slice(5) === '08-19';
  object.add(flag);

  addStoryHitbox(object, options, [2.7, 1.5, 0.8], [0, 0.7, 0.1]);
  addInvestigationMarker(object, options, [0, 1.5, 0.1]);
  object.position.set(x, 0, z);
  object.rotation.y = Math.PI / 2; // 墙面朝东（面向遗迹中心）。
  tag(object, 'chatruins-wall');
  options.scene.add(object);
  return {
    entity: { id: 'chatruins-wall', object, interactionPosition: new THREE.Vector3(x + 1.1, 0, z) },
    flag,
  };
}

export function createChatRuinsInterestPoints(options: SceneInterestPointOptions): ChatRuinsInterestPointsResult {
  const digEntities = DIG_POINT_IDS.map((_, index) => createDigPoint(options, index));
  const { entity: wallEntity, flag } = createGraffitiWall(options);
  const entities = [...digEntities, wallEntity];

  // 夜间微光材质（⑤地基石）：从实体树里取回 dynamicMaterial。
  let foundationGlow: THREE.MeshStandardMaterial | null = null;
  digEntities[4]!.object.traverse((child) => {
    if (child instanceof THREE.Mesh && child.userData.dynamicMaterial instanceof THREE.MeshStandardMaterial) {
      foundationGlow = child.userData.dynamicMaterial;
    }
  });

  let glowLevel = 0;
  return {
    entities,
    update(elapsedSeconds) {
      if (!foundationGlow) return;
      const hour = beijingHour();
      const target = hour >= 20 && hour < 23 ? 0.24 + Math.sin(elapsedSeconds * 0.9) * 0.1 : 0;
      glowLevel += (target - glowLevel) * 0.05;
      foundationGlow.emissiveIntensity = Math.max(0, glowLevel);
    },
    dispose() {
      foundationGlow?.dispose();
    },
  };
}
