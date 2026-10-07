// 春节主题装饰（theme = spring-festival）：全部程序化单独建模。
// 牌坊 ×2（南门 / 西门环道入口，横跨道路）、灯楼、庙会摊位 ×3、
// 街巷灯笼串 ×13（悬链线 + 共享材质灯笼）、梅树 ×6、西门环道红地毯。
// 坐标避开既有建筑、道路（|距路心| > 1.2+半径）与海滩事件触发半径；
// 贴地物与 SURFACE_Y 各层保持 ≥0.004 层差（沙面 0.07 上的基座 ≥0.11）。
//
// 生命周期：group 默认隐藏，theme 控制器切换 visible；dispose() 移除
// group 并释放自建材质（几何统一经 mk/addPart 进入 ResourcePool 会话级
// 所有权，不手动释放——与 komorebi 同一契约）。
import * as THREE from 'three';
import type { MeshHelpers, MaterialParameters } from './meshFactory';

const RED = 0xa63028;
const RED_DEEP = 0x7c221c;
const GOLD = 0xd9a441;
const WOOD_DARK = 0x54392a;
const ROOF_GREEN = 0x2f5a4a;
const PAPER = 0xf2e3c0;
const PLUM_BARK = 0x6a5140;
const PLUM_BLOSSOM = 0xe8a0b4;

type Vec3 = [number, number, number];

export interface SpringFestivalDecorOptions {
  scene: THREE.Scene;
  helpers: MeshHelpers;
  getIsNight: () => boolean;
}

/** 悬链线：两等高挂点间的下垂曲线采样。 */
function sagCurve(a: Vec3, b: Vec3, sag: number, samples: number): Vec3[] {
  const points: Vec3[] = [];
  for (let i = 0; i <= samples; i += 1) {
    const t = i / samples;
    const x = a[0] + (b[0] - a[0]) * t;
    const y = a[1] + (b[1] - a[1]) * t - Math.sin(t * Math.PI) * sag;
    const z = a[2] + (b[2] - a[2]) * t;
    points.push([x, y, z]);
  }
  return points;
}

export function createSpringFestivalDecor(options: SpringFestivalDecorOptions) {
  const { scene, helpers, getIsNight } = options;
  const { mk, stdMat } = helpers;
  const addPart = helpers.part;
  const group = new THREE.Group();
  group.name = 'spring-festival-decor';
  group.visible = false;
  scene.add(group);

  // 几何统一经 mk/addPart 进入 ResourcePool（会话级所有权），本模块只在
  // dispose 时释放自建材质并摘除 group。
  const ownedMaterials: THREE.Material[] = [];
  const mat = (parameters: MaterialParameters): THREE.MeshStandardMaterial => {
    const material = stdMat(parameters);
    ownedMaterials.push(material);
    return material;
  };
  const part = (parent: THREE.Group, geometry: THREE.BufferGeometry, materialOrParams: THREE.Material | MaterialParameters, pos: Vec3, shadow = true) =>
    addPart(parent, geometry, materialOrParams, pos, shadow);

  // ── 共享几何 / 材质（灯笼 / 梅花）────────────────────────
  const lanternGeometry = new THREE.SphereGeometry(0.17, 10, 8);
  const lanternCapGeometry = new THREE.CylinderGeometry(0.055, 0.055, 0.06, 8);
  const blossomGeometry = new THREE.IcosahedronGeometry(0.16, 0);
  const lanternMaterial = mat({ color: 0xd23c30, emissive: 0xd23a26, emissiveIntensity: 0.4, roughness: 0.5 });
  const lanternCapMaterial = mat({ color: GOLD, roughness: 0.45, metalness: 0.3 });
  const blossomMaterial = mat({ color: PLUM_BLOSSOM, roughness: 0.8 });

  function addLantern(x: number, y: number, z: number, scale = 1): void {
    const lantern = mk(lanternGeometry, lanternMaterial);
    lantern.position.set(x, y, z);
    lantern.scale.setScalar(scale);
    lantern.scale.y = scale * 1.18;
    group.add(lantern);
    const cap = mk(lanternCapGeometry, lanternCapMaterial);
    cap.position.set(x, y + 0.19 * scale, z);
    group.add(cap);
  }

  // ── 牌坊（跨路门楼）────────────────────────────────────
  function buildPaifang(x: number, z: number, acrossX: boolean): void {
    const g = new THREE.Group();
    group.add(g);
    const halfSpan = 2.7;
    const baseY = 0.1;
    const columnHeight = 4.4;
    // 两根立柱 + 柱身对联条幅（跨 x 时柱子沿 x 分布；跨 z 时沿 z 分布）。
    [-1, 1].forEach((side) => {
      const px = acrossX ? side * halfSpan : 0;
      const pz = acrossX ? 0 : side * halfSpan;
      part(g, new THREE.BoxGeometry(0.9, 0.5, 0.9), { color: 0x8a8a86, roughness: 0.9 }, [px, baseY + 0.25, pz]);
      part(g, new THREE.CylinderGeometry(0.21, 0.24, columnHeight, 10), { color: RED, roughness: 0.75, tex: 'wood' }, [px, baseY + 0.5 + columnHeight / 2, pz]);
      const coupletX = acrossX ? px + side * 0.3 : px + 0.31;
      const coupletZ = acrossX ? pz + 0.31 : pz + side * 0.3;
      part(g, new THREE.BoxGeometry(acrossX ? 0.08 : 0.36, 2.6, acrossX ? 0.36 : 0.08), { color: RED_DEEP, roughness: 0.7 }, [coupletX, baseY + 1.9, coupletZ], false);
      part(g, new THREE.BoxGeometry(acrossX ? 0.02 : 0.3, 2.2, acrossX ? 0.3 : 0.02), { color: GOLD, emissive: GOLD, emissiveIntensity: 0.12, roughness: 0.5 }, [coupletX + (acrossX ? side * 0.05 : 0), baseY + 1.9, coupletZ + (acrossX ? 0 : side * 0.05)], false);
    });
    // 三层横梁 + 绿瓦檐。
    const beamY = baseY + 0.5 + columnHeight;
    const tiers: Array<[number, number, number]> = [
      [halfSpan * 2 + 1.0, 0.34, 0],
      [halfSpan * 2 + 1.9, 0.3, 0.62],
      [halfSpan * 2 + 2.6, 0.28, 1.18],
    ];
    tiers.forEach(([length, thickness, lift]) => {
      part(g, new THREE.BoxGeometry(acrossX ? length : 0.9, thickness, acrossX ? 0.9 : length), { color: RED_DEEP, roughness: 0.78 }, [0, beamY + lift, 0]);
      part(g, new THREE.BoxGeometry(acrossX ? length + 0.5 : 1.3, 0.14, acrossX ? 1.3 : length + 0.5), { color: ROOF_GREEN, roughness: 0.85 }, [0, beamY + lift + 0.26, 0]);
    });
    part(g, new THREE.BoxGeometry(acrossX ? 0.7 : 0.9, 0.5, acrossX ? 0.9 : 0.7), { color: ROOF_GREEN, roughness: 0.85 }, [0, beamY + 1.85, 0]);
    // 中央匾额（金字）。
    part(g, new THREE.BoxGeometry(acrossX ? 0.12 : 1.1, 0.62, acrossX ? 1.1 : 0.12), { color: RED, roughness: 0.6 }, [0, beamY + 0.62, 0], false);
    part(g, new THREE.BoxGeometry(acrossX ? 0.05 : 0.7, 0.42, acrossX ? 0.7 : 0.05), { color: GOLD, emissive: 0xb8842e, emissiveIntensity: 0.3, roughness: 0.45 }, [0, beamY + 0.62, 0], false);
    // 檐下灯笼 ×4。
    [-0.8, 0.8].forEach((offset) => {
      if (acrossX) addLantern(x + offset, beamY - 0.45, z, 0.9);
      else addLantern(x, beamY - 0.45, z + offset, 0.9);
    });
    g.position.set(x, 0, z);
  }
  buildPaifang(0, 23.5, true);
  buildPaifang(-24.5, 0, false);

  // ── 灯楼（八角三层灯塔）───────────────────────────────
  function buildLanternTower(x: number, z: number): void {
    const g = new THREE.Group();
    group.add(g);
    const baseY = 0.11;
    const tiers = [
      { radius: 1.7, height: 1.5, y: baseY },
      { radius: 1.3, height: 1.3, y: baseY + 1.8 },
      { radius: 0.95, height: 1.1, y: baseY + 3.4 },
    ];
    part(g, new THREE.CylinderGeometry(2.0, 2.2, 0.4, 8), { color: 0x8a8a86, roughness: 0.9 }, [0, baseY + 0.2, 0]);
    tiers.forEach((tier, index) => {
      part(g, new THREE.CylinderGeometry(tier.radius, tier.radius * 1.08, tier.height, 8), { color: index % 2 ? RED : RED_DEEP, roughness: 0.75, tex: 'wall', rx: 3, ry: 2 }, [0, tier.y + tier.height / 2 + 0.3, 0]);
      part(g, new THREE.CylinderGeometry(tier.radius + 0.55, tier.radius + 0.4, 0.16, 8), { color: ROOF_GREEN, roughness: 0.85 }, [0, tier.y + tier.height + 0.36, 0]);
      for (let i = 0; i < 8; i += 1) {
        const angle = (i / 8) * Math.PI * 2 + index * 0.3;
        const glowWindow = part(g, new THREE.BoxGeometry(0.3, 0.42, 0.06), { color: 0xffd98c, emissive: 0xd9a441, emissiveIntensity: 0.8, roughness: 0.35, tex: 'glass' }, [Math.cos(angle) * (tier.radius + 0.02), tier.y + tier.height / 2 + 0.35, Math.sin(angle) * (tier.radius + 0.02)], false);
        glowWindow.rotation.y = -angle + Math.PI / 2;
      }
    });
    const topY = tiers[tiers.length - 1]!.y + tiers[tiers.length - 1]!.height + 0.5;
    part(g, new THREE.ConeGeometry(0.55, 0.5, 8), { color: ROOF_GREEN, roughness: 0.85 }, [0, topY + 0.2, 0]);
    part(g, new THREE.SphereGeometry(0.22, 12, 10), { color: GOLD, emissive: 0xb8842e, emissiveIntensity: 0.5, roughness: 0.4, metalness: 0.3 }, [0, topY + 0.62, 0]);
    addLantern(x, topY + 1.05, z, 1.2);
    g.position.set(x, 0, z);
  }
  buildLanternTower(-32, 14);

  // ── 庙会摊位 ×3 ───────────────────────────────────────
  function buildFairStall(x: number, z: number, rotY: number, awningColor: number): void {
    const g = new THREE.Group();
    group.add(g);
    const baseY = 0.1;
    part(g, new THREE.BoxGeometry(2.4, 0.9, 1.2), { color: 0x9a7a52, roughness: 0.88, tex: 'wood', rx: 2, ry: 1 }, [0, baseY + 0.45, 0]);
    part(g, new THREE.BoxGeometry(2.5, 0.06, 1.3), { color: RED_DEEP, roughness: 0.7 }, [0, baseY + 0.93, 0], false);
    ([[-1.05, -0.45], [1.05, -0.45], [-1.05, 0.45], [1.05, 0.45]] as Array<[number, number]>).forEach(([px, pz]) => {
      part(g, new THREE.CylinderGeometry(0.05, 0.06, 2.2, 8), { color: WOOD_DARK, roughness: 0.88, tex: 'wood' }, [px, baseY + 1.1, pz]);
    });
    for (let i = 0; i < 6; i += 1) {
      const stripe = i % 2 ? awningColor : PAPER;
      part(g, new THREE.BoxGeometry(0.42, 0.05, 1.5), { color: stripe, roughness: 0.85 }, [-0.875 + i * 0.35, baseY + 2.26, 0], false);
    }
    part(g, new THREE.BoxGeometry(2.6, 0.08, 0.16), { color: RED_DEEP, roughness: 0.8 }, [0, baseY + 2.32, 0.72], false);
    for (let i = 0; i < 4; i += 1) {
      part(g, new THREE.BoxGeometry(0.22, 0.18, 0.22), { color: i % 2 ? GOLD : PAPER, roughness: 0.7 }, [-0.75 + i * 0.5, baseY + 1.05, 0.15], false);
    }
    addLantern(x + 1.05, baseY + 1.95, z, 0.7);
    g.position.set(x, 0, z);
    g.rotation.y = rotY;
  }
  buildFairStall(-30.5, 3, 0.25, RED);
  buildFairStall(-32.8, -3, -0.2, GOLD);
  buildFairStall(-24.2, 3.2, 0.1, RED);

  // ── 街巷灯笼串：木杆 + 悬链线绳 + 灯笼 ─────────────────
  const stringMaterial = mat({ color: WOOD_DARK, roughness: 0.9 });
  const poleGeometry = new THREE.CylinderGeometry(0.06, 0.08, 3.0, 8);
  const poleCapGeometry = new THREE.SphereGeometry(0.09, 8, 6);
  function buildLanternString(a: Vec3, b: Vec3, lanternCount: number): void {
    [a, b].forEach(([px, , pz]) => {
      const pole = mk(poleGeometry, stringMaterial);
      pole.position.set(px, 1.5, pz);
      group.add(pole);
      const cap = mk(poleCapGeometry, lanternCapMaterial);
      cap.position.set(px, 3.05, pz);
      group.add(cap);
    });
    const points = sagCurve([a[0], 3.02, a[2]], [b[0], 3.02, b[2]], 0.55, 16);
    const curve = new THREE.CatmullRomCurve3(points.map(([x, y, z]) => new THREE.Vector3(x, y, z)));
    const tube = mk(new THREE.TubeGeometry(curve, 18, 0.022, 5, false), stringMaterial);
    group.add(tube);
    for (let i = 1; i <= lanternCount; i += 1) {
      const t = i / (lanternCount + 1);
      const point = curve.getPoint(t);
      addLantern(point.x, point.y - 0.2, point.z, 0.85);
    }
  }
  // 跨街串（a/b 为路缘外的挂点）。
  buildLanternString([-2.6, 3.0, 16], [2.6, 3.0, 16], 5);
  buildLanternString([-2.6, 3.0, -14], [2.6, 3.0, -14], 5);
  buildLanternString([8, 3.0, -2.6], [8, 3.0, 2.6], 5);
  buildLanternString([-8.6, 3.0, -2.6], [-8.6, 3.0, 2.6], 5);
  buildLanternString([3.5, 3.0, -10], [8.6, 3.0, -10], 5);
  buildLanternString([-8.6, 3.0, 10], [-3.5, 3.0, 10], 5);
  buildLanternString([-30, 3.0, -2.6], [-30, 3.0, 2.6], 4);
  buildLanternString([10, 3.0, -19.6], [10, 3.0, -16.4], 3);
  buildLanternString([-10, 3.0, 19.6], [-10, 3.0, 16.4], 3);
  // 广场内串（四面环绕喷泉）。
  buildLanternString([-15, 3.0, 8], [-5.5, 3.0, 8], 6);
  buildLanternString([5.5, 3.0, 8], [15, 3.0, 8], 6);
  buildLanternString([-15, 3.0, -8], [-5.5, 3.0, -8], 6);
  buildLanternString([5.5, 3.0, -8], [15, 3.0, -8], 6);

  // ── 梅树 ×6（弯干 + 粉梅团）────────────────────────────
  const trunkMaterial = mat({ color: PLUM_BARK, roughness: 0.9, tex: 'wood' });
  function buildPlumTree(x: number, z: number, scale: number): void {
    const g = new THREE.Group();
    group.add(g);
    const baseY = 0.075;
    const trunk = mk(new THREE.CylinderGeometry(0.09, 0.16, 1.9, 8), trunkMaterial);
    trunk.position.set(0, baseY + 0.95, 0);
    trunk.rotation.z = 0.09;
    g.add(trunk);
    const branch = mk(new THREE.CylinderGeometry(0.05, 0.08, 1.1, 6), trunkMaterial);
    branch.position.set(0.32, baseY + 2.0, 0.05);
    branch.rotation.z = -0.7;
    g.add(branch);
    const clusters: Vec3[] = [
      [0, baseY + 2.15, 0], [0.62, baseY + 2.35, 0.05], [-0.3, baseY + 2.3, 0.25],
      [0.1, baseY + 2.5, -0.2], [-0.42, baseY + 2.05, -0.1], [0.35, baseY + 1.95, 0.3],
    ];
    (clusters as Array<[number, number, number]>).forEach(([cx, cy, cz]) => {
      const blossom = mk(blossomGeometry, blossomMaterial);
      blossom.position.set(cx, cy, cz);
      blossom.scale.setScalar(0.7 + Math.abs(Math.sin(cx * 12.9 + cz * 7.7)) * 0.8);
      g.add(blossom);
    });
    g.position.set(x, 0, z);
    g.scale.setScalar(scale);
  }
  buildPlumTree(-34.5, -7, 1);
  buildPlumTree(-33.5, 26, 1.1);
  buildPlumTree(41, 12, 0.95);
  buildPlumTree(41, -12, 1.05);
  buildPlumTree(-19, 24, 1);
  buildPlumTree(25.5, 18, 0.9);

  // ── 西门环道红地毯（迎宾道，通往海滩烟花区）─────────────
  const carpet = mk(new THREE.PlaneGeometry(12.5, 3.2), mat({ color: 0x9c2c24, roughness: 0.92 }));
  carpet.rotation.x = -Math.PI / 2;
  carpet.position.set(-30, 0.125, 0);
  carpet.receiveShadow = true;
  carpet.renderOrder = 8;
  group.add(carpet);
  [-1.65, 1.65].forEach((offset) => {
    const trim = mk(new THREE.PlaneGeometry(12.5, 0.14), mat({ color: GOLD, roughness: 0.6, metalness: 0.2 }));
    trim.rotation.x = -Math.PI / 2;
    trim.position.set(-30, 0.132, offset);
    trim.renderOrder = 8;
    group.add(trim);
  });

  // ── 昼夜发光过渡（灯笼/灯杆顶珠自发光）──────────────────
  const glowMaterials = [lanternMaterial, lanternCapMaterial];
  let lastElapsed = 0;
  function update(elapsed: number): void {
    const dt = Math.min(Math.max(elapsed - lastElapsed, 0), 0.1);
    lastElapsed = elapsed;
    const glowTarget = getIsNight() ? 1.0 : 0.4;
    for (const material of glowMaterials) {
      material.emissiveIntensity += (glowTarget - material.emissiveIntensity) * Math.min(1, dt * 2.5);
    }
  }

  function dispose(): void {
    scene.remove(group);
    for (const material of ownedMaterials) material.dispose();
    ownedMaterials.length = 0;
  }

  return { group, update, dispose, setVisible(visible: boolean) { group.visible = visible; } };
}

export type SpringFestivalDecor = ReturnType<typeof createSpringFestivalDecor>;
