// 观景海域的烟花发射船（低多边形单独建模）：木甲板 + 浮筒 + 炮管架 +
// 灯笼 + 货箱 + 旗杆。烟花引擎在开爆前从这里点火，让「烟花从哪来」
// 在画面里成立。所有几何与材质由本模块自建并在 dispose 释放。
import * as THREE from 'three';
import { FIREWORK_LAUNCH_ZONE } from '../city/fireworks/fireworksConstants';
import {
  FIREWORK_BARGES,
  FIREWORK_TUBE_Z,
  buildFireworkMortars,
  pickFireworkMortar,
  type FireworkMortar,
} from '../city/fireworks/fireworksMortars';

const WOOD = 0x7a5539;
const WOOD_DARK = 0x54392a;
const IRON = 0x3f464f;
const RED = 0xa63028;
const GOLD = 0xd9a441;
const PAPER = 0xf2e3c0;

export type FireworksBarge = {
  group: THREE.Group;
  /** 从 (x,z) 选择最近的炮口（世界坐标）与朝向角。 */
  pickMortar: (x: number, z: number) => FireworkMortar;
  update: (elapsed: number) => void;
  dispose: () => void;
};

type Mortar = { x: number; z: number; y: number; heading: number };

export function createFireworksBarges(scene: THREE.Scene): FireworksBarge {
  const group = new THREE.Group();
  group.name = 'fireworks-launch-barges';
  scene.add(group);

  const materials: THREE.Material[] = [];
  const geometries: THREE.BufferGeometry[] = [];
  const mat = (params: THREE.MeshStandardMaterialParameters): THREE.MeshStandardMaterial => {
    const material = new THREE.MeshStandardMaterial(params);
    materials.push(material);
    return material;
  };
  const geo = <T extends THREE.BufferGeometry>(geometry: T): T => {
    geometries.push(geometry);
    return geometry;
  };
  const mesh = (geometry: THREE.BufferGeometry, material: THREE.Material, parent: THREE.Object3D, position: [number, number, number], rotation?: [number, number, number]): THREE.Mesh => {
    const object = new THREE.Mesh(geometry, material);
    object.position.set(...position);
    if (rotation) object.rotation.set(...rotation);
    object.castShadow = true;
    object.receiveShadow = true;
    parent.add(object);
    return object;
  };

  const deckMat = mat({ color: WOOD, roughness: 0.88 });
  const deckDarkMat = mat({ color: WOOD_DARK, roughness: 0.92 });
  const ironMat = mat({ color: IRON, roughness: 0.55, metalness: 0.35 });
  const redMat = mat({ color: RED, roughness: 0.75 });
  const goldMat = mat({ color: GOLD, roughness: 0.45, metalness: 0.25 });
  const paperMat = mat({ color: PAPER, roughness: 0.8 });
  const lanternMat = mat({ color: 0xd23c30, emissive: 0xc23a28, emissiveIntensity: 0.65, roughness: 0.5 });
  const flagMat = mat({ color: 0xb43a2e, roughness: 0.85, side: THREE.DoubleSide });

  const deckGeometry = geo(new THREE.BoxGeometry(4.8, 0.24, 2.7));
  const pontoonGeometry = geo(new THREE.CylinderGeometry(0.3, 0.3, 4.4, 10));
  const postGeometry = geo(new THREE.BoxGeometry(0.08, 0.5, 0.08));
  const railGeometry = geo(new THREE.BoxGeometry(4.4, 0.06, 0.05));
  const mortarGeometry = geo(new THREE.CylinderGeometry(0.15, 0.2, 1.05, 10));
  const baseGeometry = geo(new THREE.BoxGeometry(0.62, 0.08, 0.62));
  const crateGeometry = geo(new THREE.BoxGeometry(0.55, 0.4, 0.4));
  const lanternGeometry = geo(new THREE.SphereGeometry(0.19, 10, 8));
  const poleGeometry = geo(new THREE.CylinderGeometry(0.035, 0.045, 2.3, 6));
  const flagGeometry = geo(new THREE.PlaneGeometry(0.8, 0.45, 4, 2));
  const fuseGeometry = geo(new THREE.TorusGeometry(0.16, 0.02, 6, 14));

  const mortars: FireworkMortar[] = buildFireworkMortars(FIREWORK_BARGES);
  const flags: THREE.Mesh[] = [];
  const waterline = FIREWORK_LAUNCH_ZONE.waterY;

  for (const { x: bx, z: bz, yaw } of FIREWORK_BARGES) {
    const boat = new THREE.Group();
    boat.position.set(bx, 0, bz);
    boat.rotation.y = yaw;
    group.add(boat);

    // 浮筒与甲板（甲板比水面高 0.38，远离共面 z-fighting）。
    [-0.95, 0.95].forEach((z) => {
      mesh(pontoonGeometry, deckDarkMat, boat, [0, waterline + 0.02, z], [0, 0, Math.PI / 2]);
    });
    mesh(deckGeometry, deckMat, boat, [0, waterline + 0.24, 0]);
    for (let i = -2; i <= 2; i += 1) {
      mesh(geo(new THREE.BoxGeometry(4.82, 0.02, 0.07)), deckDarkMat, boat, [0, waterline + 0.37, i * 0.52]);
    }

    // 栏杆：四角立柱 + 前后横杆；西侧留出炮口。
    const corners: Array<[number, number]> = [[-2.2, -1.2], [-2.2, 1.2], [2.2, -1.2], [2.2, 1.2]];
    corners.forEach(([px, pz]) => {
      mesh(postGeometry, deckMat, boat, [px, waterline + 0.62, pz]);
    });
    [-1.2, 1.2].forEach((pz) => {
      mesh(railGeometry, deckMat, boat, [0, waterline + 0.84, pz]);
    });

    // 发射架：三根炮管朝向海面（-x 方向略上扬）。
    const rack = new THREE.Group();
    rack.position.set(-0.9, waterline + 0.4, 0);
    boat.add(rack);
    for (let i = 0; i < FIREWORK_TUBE_Z.length; i += 1) {
      const pz = FIREWORK_TUBE_Z[i]!;
      mesh(baseGeometry, ironMat, rack, [-0.05, 0, pz]);
      const tube = mesh(mortarGeometry, ironMat, rack, [-0.42, 0.48, pz], [0, 0, 0.16]);
      tube.castShadow = true;
      mesh(geo(new THREE.TorusGeometry(0.16, 0.025, 6, 12)), goldMat, rack, [-0.58, 0.98, pz], [Math.PI / 2, 0, 0.16]);
    }

    // 货箱与引信盘。
    mesh(crateGeometry, deckMat, boat, [1.2, waterline + 0.55, 0.55]);
    mesh(crateGeometry, deckDarkMat, boat, [1.55, waterline + 0.55, -0.3]);
    mesh(crateGeometry, redMat, boat, [1.05, waterline + 0.55, -0.65]);
    mesh(fuseGeometry, goldMat, boat, [0.55, waterline + 0.42, 0.9], [Math.PI / 2, 0, 0]);

    // 灯笼杆 + 旗杆。
    [-2.05, 2.05].forEach((px) => {
      mesh(poleGeometry, deckMat, boat, [px, waterline + 1.45, 1.15]);
      const lantern = mesh(lanternGeometry, lanternMat, boat, [px, waterline + 2.5, 1.15]);
      lantern.scale.y = 1.18;
      mesh(geo(new THREE.CylinderGeometry(0.05, 0.05, 0.06, 8)), goldMat, boat, [px, waterline + 2.7, 1.15]);
    });
    mesh(poleGeometry, deckMat, boat, [1.9, waterline + 1.55, -1.05]);
    const flag = mesh(flagGeometry, flagMat, boat, [1.5, waterline + 2.45, -1.05]);
    flag.castShadow = false;
    flags.push(flag);
  }

  return {
    group,
    pickMortar: (x: number, z: number) => pickFireworkMortar(mortars, x, z),
    update: (elapsed: number) => {
      // 旗帜轻摆 + 灯笼呼吸。
      flags.forEach((flag, index) => {
        flag.rotation.y = Math.sin(elapsed * 1.4 + index * 1.7) * 0.22;
        flag.rotation.z = Math.sin(elapsed * 2.1 + index) * 0.06;
      });
      lanternMat.emissiveIntensity = 0.55 + 0.18 * Math.sin(elapsed * 2.2);
    },
    dispose: () => {
      scene.remove(group);
      for (const material of materials) material.dispose();
      for (const geometry of geometries) geometry.dispose();
      materials.length = 0;
      geometries.length = 0;
    },
  };
}
