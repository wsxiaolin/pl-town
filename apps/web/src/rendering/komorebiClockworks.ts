// 木漏时光（komorebi）钟表工房：外观移植自外部单文件 Three.js 作品
// 《木漏时光.html》（github.com/XinyuWang250428/gpt6-Astra_3.js，外部只读
// 参考）。原作是 14×14 木基座上的全木布谷鸟钟工房：大钟盘、齿轮列、
// 水车溪流、两级瀑布、棕榈花园。本文件按 SCALE 倍缩放移植约 50% 的
// 代表性结构（基座/钟屋/陡瓦屋顶/钟盘/布谷鸟/钟摆/齿轮/水系/花园），
// 材质换用 stdMat 体系以接入天气与资源池；时针/分针按本地真实时间
// 走，钟摆、水车、齿轮、布谷鸟与音乐桶经 group.userData.komorebiAnim
// 暴露，由 cityWorldAssembly 的装饰更新链每帧驱动（updateKomorebiClockworks）。
import * as THREE from 'three';
import type { MaterialParameters, MeshHelpers } from './meshFactory';
import type { BuildingDefinition, BuildingEntity } from '../city/buildingEntity';

export interface KomorebiBuildingOptions {
  platformHeight: number;
  makeMaterial: MeshHelpers['stdMat'];
  makeMesh: MeshHelpers['mk'];
  addPart: MeshHelpers['part'];
}

interface KomorebiGear {
  g: THREE.Group;
  ratio: number;
  phase: number;
}

interface KomorebiAnim {
  wheel: THREE.Group;
  gears: KomorebiGear[];
  pendulum: THREE.Group;
  minuteHand: THREE.Group;
  hourHand: THREE.Group;
  birdDoors: Array<{ g: THREE.Group; side: number }>;
  cuckoo: THREE.Group;
  musicBarrel: THREE.Group;
  sprigs: THREE.Group[];
}

/** 原作 14×14 基座 → 本城地块尺度（北城作品街坊排间空地）。 */
const SCALE = 0.62;
/** 原作基座脚底 y=-0.90，抬升后底面落在世界 y≈0.05（地块层之上）。 */
const LIFT = 0.90 * SCALE + 0.05;

// 原作四种木料 + 瓦色（MeshToon → stdMat 近似，roughness 偏高保木感）。
const WALNUT = 0x765337;
const DARK = 0x503c2c;
const CHERRY = 0xb77b50;
const MAPLE = 0xd4ad72;
const BIRCH = 0xe4c797;
const SHINGLES = [0xb98251, 0xad774d, 0xc18b59];

const wood = (color: number, rx = 2, ry = 2): MaterialParameters => ({ color, roughness: 0.72, tex: 'wood', rx, ry });
const woodPlain = (color: number): MaterialParameters => ({ color, roughness: 0.7 });
const amberPane: MaterialParameters = { color: 0xd5ab65, roughness: 0.35, emissive: 0xe4a750, emissiveIntensity: 0.32, tex: 'glass', rx: 1, ry: 1 };

const WATER_MAT = new THREE.MeshStandardMaterial({
  color: 0x3a8a70, roughness: 0.14, metalness: 0.05,
  transparent: true, opacity: 0.72, depthWrite: false, side: THREE.DoubleSide,
});
const FALL_MAT = new THREE.MeshStandardMaterial({
  color: 0x9fd8c8, roughness: 0.1, metalness: 0,
  transparent: true, opacity: 0.5, depthWrite: false, side: THREE.DoubleSide,
});
const leafMatCache = new Map<number, THREE.MeshStandardMaterial>();
function leafMat(color: number): THREE.MeshStandardMaterial {
  let m = leafMatCache.get(color);
  if (!m) {
    m = new THREE.MeshStandardMaterial({ color, roughness: 0.85, side: THREE.DoubleSide });
    leafMatCache.set(color, m);
  }
  return m;
}

function smooth(a: number, b: number, v: number): number {
  return THREE.MathUtils.smoothstep(v, a, b);
}

type PartTarget = THREE.Group;
type MatLike = MaterialParameters | THREE.Material;
type Vec3 = [number, number, number];

export function buildKomorebiWorkshop(options: KomorebiBuildingOptions, definition: BuildingDefinition): BuildingEntity {
  const { addPart } = options;
  const outer = new THREE.Group();
  const g: PartTarget = new THREE.Group();
  g.scale.setScalar(SCALE);
  g.position.y = LIFT;
  outer.add(g);

  const anim: KomorebiAnim = {
    wheel: new THREE.Group(), gears: [], pendulum: new THREE.Group(),
    minuteHand: new THREE.Group(), hourHand: new THREE.Group(),
    birdDoors: [], cuckoo: new THREE.Group(), musicBarrel: new THREE.Group(), sprigs: [],
  };

  // ── 局部造型辅助（原作坐标，y 向上；parent 缺省为根组 g）──────────
  const box = (x: number, y: number, z: number, w: number, h: number, d: number, mat: MatLike, parent: PartTarget = g, shadow = true) =>
    addPart(parent, new THREE.BoxGeometry(w, h, d), mat, [x, y, z], shadow);
  const cyl = (x: number, y: number, z: number, rt: number, rb: number, h: number, mat: MatLike, parent: PartTarget = g, n = 12, shadow = true) =>
    addPart(parent, new THREE.CylinderGeometry(rt, rb, h, n), mat, [x, y, z], shadow);
  const ball = (x: number, y: number, z: number, r: number, mat: MatLike, parent: PartTarget = g, n = 1, shadow = true) =>
    addPart(parent, new THREE.IcosahedronGeometry(r, n), mat, [x, y, z], shadow);
  const torus = (x: number, y: number, z: number, r: number, t: number, mat: MatLike, parent: PartTarget = g, rx = 0, ry = 0, n = 32, shadow = true) => {
    const o = addPart(parent, new THREE.TorusGeometry(r, t, 6, n), mat, [x, y, z], shadow);
    o.rotation.set(rx, ry, 0);
    return o;
  };
  /** 圆片，默认面向 +z（原作 disc）。 */
  const disc = (x: number, y: number, z: number, r: number, depth: number, mat: MatLike, parent: PartTarget = g, n = 40, shadow = true) => {
    const o = cyl(x, y, z, r, r, depth, mat, parent, n, shadow);
    o.rotation.x = Math.PI / 2;
    return o;
  };
  const beam = (a: Vec3, b: Vec3, r: number, mat: MatLike, parent: PartTarget = g, n = 8, shadow = true) => {
    const av = new THREE.Vector3(...a);
    const bv = new THREE.Vector3(...b);
    const o = cyl((av.x + bv.x) / 2, (av.y + bv.y) / 2, (av.z + bv.z) / 2, r, r, av.distanceTo(bv), mat, parent, n, shadow);
    o.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), bv.clone().sub(av).normalize());
    return o;
  };
  const tube = (points: Vec3[], mat: MatLike, r = 0.02, parent: PartTarget = g, segMul = 5, shadow = true) => {
    const curve = new THREE.CatmullRomCurve3(points.map((p) => new THREE.Vector3(...p)));
    return addPart(parent, new THREE.TubeGeometry(curve, Math.max(8, points.length * segMul), r, 6, false), mat, [0, 0, 0], shadow);
  };
  /** 原作 ribbon：沿路径的宽带水面/瀑布。 */
  const ribbon = (path: Vec3[], width: number, mat: THREE.Material = WATER_MAT) => {
    const verts: number[] = [];
    const uv: number[] = [];
    const idx: number[] = [];
    const up = new THREE.Vector3(0, 1, 0);
    const at = (n: number) => path[n]!;
    for (let i = 0; i < path.length; i++) {
      const q = new THREE.Vector3(...at(i));
      const before = new THREE.Vector3(...at(Math.max(0, i - 1)));
      const after = new THREE.Vector3(...at(Math.min(path.length - 1, i + 1)));
      const side = after.sub(before).cross(up).normalize();
      if (side.length() < 0.1) side.set(1, 0, 0);
      side.multiplyScalar(width / 2);
      verts.push(...q.clone().sub(side).toArray(), ...q.clone().add(side).toArray());
      uv.push(0, i / (path.length - 1), 1, i / (path.length - 1));
      if (i < path.length - 1) {
        const k = i * 2;
        idx.push(k, k + 2, k + 1, k + 1, k + 2, k + 3);
      }
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3));
    geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    geo.setIndex(idx);
    geo.computeVertexNormals();
    return addPart(g, geo, mat, [0, 0, 0], false);
  };
  /** 原作 leaf：两枚四边形拼成的叶片平面。 */
  const leaf = (a: Vec3, b: Vec3, w: number, color: number, parent: PartTarget = g) => {
    const av = new THREE.Vector3(...a);
    const bv = new THREE.Vector3(...b);
    const m = av.clone().lerp(bv, 0.49);
    const side = bv.clone().sub(av).cross(new THREE.Vector3(0, 1, 0)).normalize().multiplyScalar(w);
    if (side.length() < 0.001) side.set(w, 0, 0);
    const vs = [
      ...av.toArray(), ...m.clone().add(side).toArray(), ...m.clone().add(new THREE.Vector3(0, w * 0.23, 0)).toArray(),
      ...bv.toArray(), ...m.clone().sub(side).toArray(),
    ];
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(vs, 3));
    geo.setAttribute('uv', new THREE.Float32BufferAttribute([0, 0, 1, 0.5, 0.5, 0.5, 0.5, 1, 0, 0.5], 2));
    geo.setIndex([0, 1, 2, 1, 3, 2, 0, 2, 4, 4, 2, 3]);
    geo.computeVertexNormals();
    return addPart(parent, geo, leafMat(color), [0, 0, 0], false);
  };
  /** 原作 carvedLeaf（简化）：垂直浮雕叶片，只保留叶形挤出体。 */
  const carvedLeaf = (x: number, y: number, z: number, s = 0.4, angle = 0, mat: MaterialParameters = woodPlain(MAPLE), parent: PartTarget = g, shadow = true) => {
    const shape = new THREE.Shape();
    shape.moveTo(0, -s * 0.55);
    shape.bezierCurveTo(-s * 0.62, -s * 0.1, -s * 0.42, s * 0.34, 0, s * 0.70);
    shape.bezierCurveTo(s * 0.42, s * 0.34, s * 0.62, -s * 0.1, 0, -s * 0.55);
    const o = addPart(parent, new THREE.ExtrudeGeometry(shape, { depth: 0.025, bevelEnabled: true, bevelSize: 0.012, bevelThickness: 0.012, bevelSegments: 1, curveSegments: 5 }), mat, [x, y, z], shadow);
    o.rotation.z = angle;
    return o;
  };
  const triangle = (a: Vec3, b: Vec3, c: Vec3, mat: MatLike) => {
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute([...a, ...b, ...c], 3));
    geo.computeVertexNormals();
    return addPart(g, geo, mat, [0, 0, 0], false);
  };

  // ── 基座：三层实木平台 + 边框横梁 + 四角短足 ─────────────────────
  box(0, -0.48, 0, 14, 0.76, 14, wood(WALNUT, 4, 4));
  box(0, -0.10, 0, 14.08, 0.11, 14.08, wood(CHERRY, 5, 5));
  box(0, 0.04, 0, 14.04, 0.16, 14.04, wood(MAPLE, 6, 6));
  box(0, 0.23, 6.9, 14.03, 0.18, 0.20, wood(WALNUT, 5, 1));
  box(0, 0.23, -6.9, 14.03, 0.18, 0.20, wood(WALNUT, 5, 1));
  box(6.9, 0.23, 0, 0.20, 0.18, 13.6, wood(WALNUT, 1, 5));
  box(-6.9, 0.23, 0, 0.20, 0.18, 13.6, wood(WALNUT, 1, 5));
  for (const [fx, fz] of [[-6.45, -6.45], [6.45, -6.45], [-6.45, 6.45], [6.45, 6.45]] as const) {
    cyl(fx, -0.88, fz, 0.28, 0.32, 0.13, woodPlain(DARK), g, 12, false);
  }

  // ── 钟屋骨架：四柱 + 两层环梁 + 斜撑 + 地板（cx=-0.65）────────────
  const cx = -0.65;
  const front = 1.13;
  const back = -2.42;
  box(cx, 0.43, -0.67, 5.38, 0.26, 4.36, wood(WALNUT, 3, 3));
  for (const px of [-3.05, 1.75]) {
    for (const pz of [front, back]) {
      box(px, 3.96, pz, 0.27, 6.76, 0.28, wood(WALNUT, 1, 6));
      box(px, 0.79, pz, 0.43, 0.28, 0.44, woodPlain(CHERRY));
    }
  }
  for (const by of [1.16, 7.41]) {
    box(cx, by, front, 5.10, 0.22, 0.25, wood(CHERRY, 4, 1));
    box(cx, by, back, 5.10, 0.22, 0.25, wood(CHERRY, 4, 1));
    for (const px of [-3.05, 1.75]) box(px, by, -0.65, 0.23, 0.22, 3.83, wood(CHERRY, 1, 4));
  }
  for (const px of [-3.05, 1.75]) {
    const inward = px < 0 ? 1 : -1;
    beam([px, 2.67, front], [px + inward * 0.78, 3.71, front], 0.09, woodPlain(MAPLE), g, 8, false);
  }

  // ── 墙板：背墙两段（中留检修口）+ 敞开小盖板 + 左侧板 ────────────
  box(-2.4, 5.65, back, 1.5, 3.4, 0.13, wood(CHERRY, 2, 4));
  box(1.2, 5.65, back, 1.3, 3.4, 0.13, wood(CHERRY, 2, 4));
  const hatch = new THREE.Group();
  hatch.position.set(-1.96, 5.51, -2.54);
  hatch.rotation.y = 1.05;
  g.add(hatch);
  addPart(hatch, new THREE.BoxGeometry(2.1, 2.77, 0.10), wood(MAPLE, 2, 4), [0.7, 0, 0]);
  addPart(hatch, new THREE.BoxGeometry(2.12, 0.13, 0.11), woodPlain(WALNUT), [0.7, -0.98, -0.072], false);
  addPart(hatch, new THREE.BoxGeometry(2.12, 0.13, 0.11), woodPlain(WALNUT), [0.7, 0.98, -0.072], false);
  box(-3.042, 5.5, -1.34, 0.12, 3.2, 2.1, wood(MAPLE, 1, 4));

  // ── 前阳台：栏杆 + 宝瓶柱 + 雕叶饰带 ────────────────────────────
  box(cx, 3.89, 1.58, 5.6, 0.11, 1.05, wood(MAPLE, 5, 2));
  box(cx, 3.75, 2.11, 5.62, 0.24, 0.15, wood(WALNUT, 5, 1));
  box(cx, 4.55, 2.13, 5.69, 0.105, 0.15, wood(MAPLE, 5, 1));
  for (let i = 0; i < 6; i++) {
    const bx = cx - 2.1 + i * 0.85;
    cyl(bx, 4.22, 2.13, 0.035, 0.043, 0.56, woodPlain(CHERRY), g, 8, false);
  }
  for (const ex of [-3.36, 2.04]) box(ex, 4.23, 2.13, 0.13, 0.79, 0.13, woodPlain(WALNUT), g, false);
  for (let i = 0; i < 3; i++) carvedLeaf(cx - 2.0 + i * 2.0, 3.74, 2.207, 0.15, i % 2 ? 0.6 : -0.6, woodPlain(MAPLE), g, false);

  // ── 琥珀木格窗（前上两扇 + 左侧一扇）────────────────────────────
  const woodWindow = (x: number, y: number, z: number, w: number, h: number, ry: number) => {
    const wg = new THREE.Group();
    wg.position.set(x, y, z);
    wg.rotation.y = ry;
    g.add(wg);
    addPart(wg, new THREE.BoxGeometry(w + 0.13, h + 0.13, 0.08), woodPlain(WALNUT), [0, 0, 0], false);
    addPart(wg, new THREE.BoxGeometry(w, h, 0.018), amberPane, [0, 0, 0.046], false);
    addPart(wg, new THREE.BoxGeometry(0.028, h, 0.025), woodPlain(CHERRY), [0, 0, 0.067], false);
    addPart(wg, new THREE.BoxGeometry(w + 0.28, 0.087, 0.34), woodPlain(MAPLE), [0, -h / 2 - 0.08, 0.14], false);
  };
  woodWindow(cx - 1.10, 8.48, 1.33, 0.43, 0.57, 0);
  woodWindow(cx + 1.10, 8.48, 1.33, 0.43, 0.57, 0);
  woodWindow(-3.14, 5.47, -1.40, 0.71, 0.88, -Math.PI / 2);

  // ── 陡屋面：两侧整坡瓦面板 + 人字山墙 + 脊梁 + 雕叶脊饰 ─────────
  const gableShape = new THREE.Shape();
  gableShape.moveTo(-3.19, 7.43);
  gableShape.lineTo(1.89, 7.43);
  gableShape.lineTo(cx, 10.03);
  gableShape.closePath();
  const portalHole = new THREE.Path();
  portalHole.moveTo(cx - 0.51, 7.77);
  portalHole.lineTo(cx - 0.51, 8.86);
  portalHole.lineTo(cx + 0.51, 8.86);
  portalHole.lineTo(cx + 0.51, 7.77);
  portalHole.closePath();
  gableShape.holes.push(portalHole);
  addPart(g, new THREE.ExtrudeGeometry(gableShape, { depth: 0.055, bevelEnabled: false }), wood(CHERRY, 3, 3), [0, 0, 1.22]);
  triangle([-3.19, 7.43, -2.60], [cx, 10.03, -2.60], [1.89, 7.43, -2.60], wood(CHERRY, 3, 3));
  const slopeAngle = Math.atan(0.97);
  // 坡面板：每侧一整块。原移植为每侧 9 排叠瓦 box——所有板中心精确落在
  // 同一条坡线上且旋转同角，相邻板的上/下表面严格共面，整片屋顶大面积
  // z-fighting（远观闪烁）。城市视距下叠瓦细节本不可辨，故简化为单板：
  // 坡长盖至原叠瓦外缘（s≈6.19），SHINGLES 中间色 + 坡向重复木纹近似原观感。
  for (const side of [-1, 1]) {
    const slopeLen = 6.2;
    const panel = box(
      cx + side * Math.cos(slopeAngle) * slopeLen / 2,
      10.18 - Math.sin(slopeAngle) * slopeLen / 2,
      -0.645, slopeLen, 0.09, 4.66, wood(SHINGLES[1]!, 3, 8),
    );
    panel.rotation.z = -side * slopeAngle;
    beam([cx + side * 3.02, 7.32, 1.85], [cx + side * 3.02, 7.32, -3.1], 0.075, woodPlain(WALNUT), g, 8, false);
    for (const ez of [1.88, -3.17]) beam([cx, 10.24, ez], [cx + side * 3.09, 7.25, ez], 0.11, wood(WALNUT, 1, 2));
  }
  beam([cx, 10.26, -3.20], [cx, 10.26, 1.96], 0.13, wood(WALNUT, 1, 8), g, 10);
  for (const rz of [-2.4, -1.1, 0.4]) carvedLeaf(cx, 10.5, rz, 0.32, 0, woodPlain(MAPLE), g, false);
  carvedLeaf(cx, 10.49, 1.7, 0.5, 0, woodPlain(BIRCH), g, false);

  // ── 老虎窗（阳坡）与后坡小钟塔 ──────────────────────────────────
  const dormer = new THREE.Group();
  dormer.position.set(-2.23, 8.45, -0.38);
  dormer.rotation.y = -Math.PI / 2;
  g.add(dormer);
  addPart(dormer, new THREE.BoxGeometry(0.94, 0.78, 0.64), wood(CHERRY, 1, 2), [0, 0.37, 0]);
  for (const side of [-1, 1]) {
    const r = addPart(dormer, new THREE.BoxGeometry(0.81, 0.075, 0.89), wood(WALNUT, 1, 2), [side * 0.29, 1.01, 0]);
    r.rotation.z = -side * 0.70;
  }
  disc(0, 0.43, 0.338, 0.27, 0.035, woodPlain(WALNUT), dormer, 20, false);
  disc(0, 0.43, 0.365, 0.205, 0.021, amberPane, dormer, 20, false);
  const belfry = new THREE.Group();
  belfry.position.set(0.47, 9.0, -2.33);
  g.add(belfry);
  addPart(belfry, new THREE.BoxGeometry(0.61, 0.15, 0.60), wood(WALNUT, 1, 1), [0, 0.11, 0]);
  for (const px of [-0.22, 0.22]) for (const pz of [-0.21, 0.21]) {
    addPart(belfry, new THREE.BoxGeometry(0.065, 0.69, 0.065), wood(MAPLE, 1, 3), [px, 0.46, pz], false);
  }
  cyl(0, 1.02, 0, 0.04, 0.48, 0.52, wood(WALNUT, 1, 2), belfry, 4);
  ball(0, 1.42, 0, 0.056, woodPlain(BIRCH), belfry, 1, false);

  // ── 大钟盘：双层木盘 + 刻度 + 罗马数字 + 真实时间指针 ────────────
  const dialX = cx;
  const dialY = 5.94;
  const dialZ = 1.305;
  disc(dialX, dialY, dialZ, 1.62, 0.20, wood(WALNUT, 2, 2), g, 48);
  disc(dialX, dialY, dialZ + 0.13, 1.48, 0.11, wood(WALNUT, 2, 2), g, 48);
  torus(dialX, dialY, dialZ + 0.17, 1.54, 0.055, wood(CHERRY, 2, 1), g, 0, 0, 64);
  for (let j = 0; j < 12; j++) {
    const a = j * Math.PI / 6;
    // 刻度前缘与瓦盘面保持 ~0.03 间隙（z-fighting 安全距；0.203 时仅
    // 0.0115，×SCALE 0.62 后远观贴近深度缓冲精度）。
    const tick = box(dialX + Math.sin(a) * 1.30, dialY + Math.cos(a) * 1.30, dialZ + 0.215, 0.037, 0.125, 0.013, woodPlain(BIRCH), g, false);
    tick.rotation.z = -a;
  }
  // 罗马数字镶嵌：四个基准位（XII/III/VI/IX）。
  const romans = ['XII', 'III', 'VI', 'IX'];
  const roman = (text: string, x: number, y: number, z: number) => {
    const total = text.length * 0.083;
    for (let i = 0; i < text.length; i++) {
      const xx = x - total / 2 + i * 0.083 + 0.041;
      const s = text[i];
      if (s === 'I') box(xx, y, z, 0.021, 0.17, 0.014, woodPlain(BIRCH), g, false);
      else if (s === 'V') {
        beam([xx - 0.033, y + 0.082, z], [xx, y - 0.086, z], 0.010, woodPlain(BIRCH), g, 4, false);
        beam([xx, y - 0.086, z], [xx + 0.033, y + 0.082, z], 0.010, woodPlain(BIRCH), g, 4, false);
      } else {
        beam([xx - 0.032, y - 0.083, z], [xx + 0.032, y + 0.083, z], 0.010, woodPlain(BIRCH), g, 4, false);
        beam([xx + 0.032, y - 0.083, z], [xx - 0.032, y + 0.083, z], 0.010, woodPlain(BIRCH), g, 4, false);
      }
    }
  };
  for (let j = 0; j < 12; j++) {
    const a = j * Math.PI / 6;
    if (j % 3 !== 0) continue;
    roman(romans[j / 3]!, dialX + Math.sin(a) * 1.08, dialY + Math.cos(a) * 1.08, dialZ + 0.231);
  }
  const clockHand = (length: number, w: number, mat: MaterialParameters, z: number) => {
    const shape = new THREE.Shape();
    shape.moveTo(0, length);
    shape.lineTo(-w, length * 0.78);
    shape.lineTo(-w * 0.38, 0.13);
    shape.lineTo(-w * 0.54, -0.20);
    shape.lineTo(w * 0.54, -0.20);
    shape.lineTo(w, length * 0.78);
    shape.closePath();
    const group = new THREE.Group();
    group.position.set(dialX, dialY, z);
    g.add(group);
    addPart(group, new THREE.ExtrudeGeometry(shape, { depth: 0.022, bevelEnabled: true, bevelSize: 0.008, bevelThickness: 0.008, bevelSegments: 1 }), mat, [0, 0, 0], false);
    carvedLeaf(0, length * 0.58, 0.03, w * 1.3, 0, mat, group, false);
    return group;
  };
  anim.minuteHand = clockHand(1.04, 0.063, woodPlain(BIRCH), dialZ + 0.246);
  anim.hourHand = clockHand(0.71, 0.085, woodPlain(CHERRY), dialZ + 0.29);
  disc(dialX, dialY, dialZ + 0.36, 0.111, 0.11, wood(CHERRY, 1, 1), g, 16, false);

  // ── 布谷鸟门：钟盘上方的报时小门 + 双开木翼门 + 木布谷鸟 ─────────
  const doorY = 8.31;
  box(cx, doorY, 0.68, 1.02, 1.03, 0.07, woodPlain(DARK));
  for (const s of [-1, 1]) box(cx + s * 0.53, doorY, 1.38, 0.083, 1.10, 0.12, wood(WALNUT, 1, 2));
  triangle([cx - 0.60, 8.82, 1.40], [cx + 0.60, 8.82, 1.40], [cx, 9.30, 1.40], wood(BIRCH, 1, 1));
  carvedLeaf(cx, 9.13, 1.49, 0.18, 0, woodPlain(CHERRY), g, false);
  for (const s of [-1, 1]) {
    const doorGroup = new THREE.Group();
    doorGroup.position.set(cx + s * 0.485, doorY, 1.50);
    g.add(doorGroup);
    addPart(doorGroup, new THREE.BoxGeometry(0.475, 0.98, 0.065), wood(MAPLE, 1, 2), [-s * 0.238, 0, 0]);
    for (const by of [-0.33, 0.33]) addPart(doorGroup, new THREE.BoxGeometry(0.448, 0.055, 0.022), woodPlain(WALNUT), [-s * 0.238, by, 0.057], false);
    for (const by of [-0.34, 0.34]) cyl(0, by, 0, 0.047, 0.047, 0.17, wood(CHERRY, 1, 1), doorGroup, 10, false);
    anim.birdDoors.push({ g: doorGroup, side: s });
  }
  const cuckoo = new THREE.Group();
  cuckoo.position.set(cx, doorY - 0.03, 0.88);
  g.add(cuckoo);
  anim.cuckoo = cuckoo;
  addPart(cuckoo, new THREE.BoxGeometry(0.36, 0.063, 0.75), wood(WALNUT, 1, 2), [0, -0.23, -0.04], false);
  const birdBody = addPart(cuckoo, new THREE.IcosahedronGeometry(0.20, 2), wood(CHERRY, 1, 1), [0, -0.04, 0.06]);
  birdBody.scale.set(0.80, 1, 1.25);
  const birdHead = addPart(cuckoo, new THREE.IcosahedronGeometry(0.143, 2), wood(MAPLE, 1, 1), [0, 0.20, 0.20]);
  const birdBeak = addPart(cuckoo, new THREE.ConeGeometry(0.05, 0.16, 4), wood(WALNUT, 1, 1), [0, 0.19, 0.36], false);
  birdBeak.rotation.x = Math.PI / 2;
  leaf([0.13, 0.135, 0.22], [0.26, 0.07, 0.30], 0.15, 0x9a7a52, cuckoo);
  leaf([-0.13, 0.135, 0.22], [-0.26, 0.07, 0.30], 0.15, 0x9a7a52, cuckoo);
  leaf([0, 0.09, -0.06], [0, -0.02, -0.20], 0.24, 0xe4c797, cuckoo).rotation.x = 1.4;

  // ── 钟摆：雕花摆杆 + 叶形摆锤（每帧摆动）────────────────────────
  const pendulum = new THREE.Group();
  pendulum.position.set(cx, 3.63, 1.73);
  g.add(pendulum);
  anim.pendulum = pendulum;
  box(0, -1.07, 0, 0.075, 2.18, 0.086, wood(WALNUT, 1, 5), pendulum);
  disc(0, -2.17, 0, 0.45, 0.13, wood(CHERRY, 1, 1), pendulum, 40);
  carvedLeaf(0, -2.14, 0.095, 0.41, 0, woodPlain(MAPLE), pendulum);

  // ── 齿轮列：工坊下层三枚啮合木齿轮（原作 32/20/32 齿）────────────
  const moduleSize = 0.040;
  const toothCounts = [32, 20, 32];
  const directions = [0, 0.25];
  const makeGear = (x: number, y: number, teeth: number, mat: MaterialParameters) => {
    const pitch = teeth * moduleSize / 2;
    const outerR = pitch + 0.032;
    const innerR = pitch - 0.033;
    const shape = new THREE.Shape();
    for (let i = 0; i < teeth; i++) {
      for (let j = 0; j < 4; j++) {
        const a = (i + (j - 1.5) / 4) * Math.PI * 2 / teeth;
        const r = j === 1 || j === 2 ? outerR : innerR;
        const xx = Math.cos(a) * r;
        const yy = Math.sin(a) * r;
        if (i + j === 0) shape.moveTo(xx, yy);
        else shape.lineTo(xx, yy);
      }
    }
    shape.closePath();
    const hole = new THREE.Path();
    hole.absarc(0, 0, pitch * 0.64, 0, Math.PI * 2, true);
    shape.holes.push(hole);
    const gearGroup = new THREE.Group();
    gearGroup.position.set(x, y, -0.60);
    g.add(gearGroup);
    addPart(gearGroup, new THREE.ExtrudeGeometry(shape, { depth: 0.13, bevelEnabled: true, bevelSize: 0.006, bevelThickness: 0.006, bevelSegments: 1, curveSegments: 4 }), mat, [0, 0, -0.065]);
    disc(0, 0, 0, pitch * 0.23, 0.18, wood(WALNUT, 1, 1), gearGroup, 16, false);
    return gearGroup;
  };
  let gx = -4.45;
  let gy = 2.25;
  for (let i = 0; i < toothCounts.length; i++) {
    if (i) {
      const dist = (toothCounts[i - 1]! + toothCounts[i]!) * moduleSize / 2;
      gx += Math.cos(directions[i - 1]!) * dist;
      gy += Math.sin(directions[i - 1]!) * dist;
    }
    const gearGroup = makeGear(gx, gy, toothCounts[i]!, i % 2 ? wood(MAPLE, 1, 1) : wood(CHERRY, 1, 1));
    const ratio = (i % 2 ? -1 : 1) * toothCounts[0]! / toothCounts[i]!;
    const phase = i ? Math.PI / toothCounts[i]! : 0;
    anim.gears.push({ g: gearGroup, ratio, phase });
    beam([gx, gy, -1.67], [gx, gy, -0.24], 0.056, wood(WALNUT, 1, 2), g, 8, false);
    if (i > 0) box(gx, gy, -1.78, 0.28, 0.30, 0.19, wood(MAPLE, 1, 1), g, false);
  }

  // ── 重锤：两枚松果形木锤挂于摆侧 ────────────────────────────────
  const pinecone = (x: number, bottom: number) => {
    for (let y = 3.62; y > bottom + 0.4; y -= 0.18) torus(x, y, 1.11, 0.071, 0.017, wood(CHERRY, 1, 1), g, 0, Math.round(y / 0.18) % 2 ? Math.PI / 2 : 0, 12, false);
    const core = ball(x, bottom, 1.11, 0.20, wood(WALNUT, 1, 1));
    core.scale.y = 1.7;
  };
  pinecone(-1.63, 1.50);
  pinecone(0.28, 2.04);

  // ── 水系：蓄水池 + 导槽 + 溪流 + 汇水池 + 大水车 + 两级瀑布 ───────
  const rx = -4.94;
  const rz = -4.04;
  for (const [lx, lz] of [[rx - 0.91, rz - 0.66], [rx + 0.91, rz + 0.66]] as const) {
    box(lx, 2.66, lz, 0.16, 4.90, 0.16, wood(WALNUT, 1, 5));
  }
  box(rx, 4.94, rz, 2.30, 0.15, 1.71, wood(DARK, 3, 2));
  box(rx, 5.25, rz - 0.83, 2.1, 0.56, 0.12, wood(CHERRY, 4, 1));
  for (const sx of [rx - 1.14, rx + 1.14]) box(sx, 5.25, rz, 0.12, 0.56, 1.60, wood(CHERRY, 1, 3));
  addPart(g, new THREE.PlaneGeometry(2.14, 1.52), WATER_MAT, [rx, 5.36, rz], false).rotation.x = -Math.PI / 2;
  const trough = (a: Vec3, b: Vec3, width = 0.55) => {
    const av = new THREE.Vector3(...a);
    const bv = new THREE.Vector3(...b);
    const tg = new THREE.Group();
    tg.position.copy(av.clone().add(bv).multiplyScalar(0.5));
    tg.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), bv.clone().sub(av).normalize());
    g.add(tg);
    const len = av.distanceTo(bv);
    addPart(tg, new THREE.BoxGeometry(width + 0.17, 0.12, len), wood(WALNUT, 2, 3), [0, -0.095, 0], false);
    for (const s of [-1, 1]) addPart(tg, new THREE.BoxGeometry(0.08, 0.28, len + 0.04), wood(CHERRY, 1, 3), [s * (width / 2 + 0.042), 0.065, 0], false);
    addPart(tg, new THREE.PlaneGeometry(width, len), WATER_MAT, [0, 0.017, 0], false).rotation.x = -Math.PI / 2;
  };
  trough([rx, 5.34, -3.22], [rx, 5.13, -2.15]);
  trough([rx, 4.94, -1.95], [rx - 0.12, 4.71, -0.28]);
  // 溪流：弯谷曲线路径 ribbon + 沿线床板。
  const streamCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(-4.67, 0.40, 0.47), new THREE.Vector3(-4.91, 0.37, 1.45),
    new THREE.Vector3(-4.10, 0.335, 2.40), new THREE.Vector3(-2.50, 0.305, 2.89),
    new THREE.Vector3(-0.83, 0.272, 3.56), new THREE.Vector3(0.85, 0.239, 4.51),
    new THREE.Vector3(2.78, 0.219, 4.30),
  ]);
  const streamPath: Vec3[] = [];
  for (let i = 0; i <= 32; i++) streamPath.push(streamCurve.getPoint(i / 32).toArray() as Vec3);
  ribbon(streamPath, 0.83);
  for (let i = 0; i < 8; i++) {
    const t = i / 7;
    const q = streamCurve.getPoint(t);
    const tangent = streamCurve.getTangent(t);
    const plank = box(q.x, q.y - 0.11, q.z, 1.0, 0.052, 0.17, i % 3 ? wood(DARK, 1, 1) : wood(WALNUT, 1, 1), g, false);
    plank.rotation.y = Math.atan2(tangent.x, tangent.z);
  }
  // 汇水池：椭圆盆 + 池水 + 一圈桶板。
  const px = 3.35;
  const pz = 4.24;
  const poolBed = cyl(px, 0.108, pz, 1.55, 1.55, 0.12, wood(DARK, 2, 2), g, 40);
  poolBed.scale.z = 0.86;
  for (let j = 0; j < 14; j++) {
    if (j >= 6 && j <= 7) continue;
    const a = j / 14 * Math.PI * 2;
    const x = px + Math.cos(a) * 1.55;
    const z = pz + Math.sin(a) * 1.34;
    const plank = box(x, 0.244, z, 0.25, 0.28, 0.095, wood(j % 3 ? CHERRY : WALNUT, 1, 1), g, false);
    plank.rotation.y = -a + Math.PI / 2;
  }
  addPart(g, new THREE.CircleGeometry(1.48, 40), WATER_MAT, [px, 0.222, pz], false).rotation.x = -Math.PI / 2;
  // 隐藏回水管：池底经基座回到蓄水池顶。
  tube([[px, -0.15, pz], [3.7, -0.25, 1.0], [2.7, -0.25, -4.8], [-5.97, -0.25, -4.32]], wood(WALNUT, 1, 6), 0.08);
  // 大水车：双轮辋 + 8 桨叶（每帧转动）。
  const wheel = new THREE.Group();
  wheel.position.set(-4.45, 2.25, 0.10);
  g.add(wheel);
  anim.wheel = wheel;
  const wr = 1.70;
  for (const wz of [-0.34, 0.34]) {
    torus(0, 0, wz, wr, 0.082, wood(WALNUT, 2, 2), wheel, 0, 0, 44);
    disc(0, 0, wz, 0.22, 0.17, wood(CHERRY, 1, 1), wheel, 16, false);
    for (let j = 0; j < 4; j++) {
      const a = j * Math.PI / 2;
      beam([Math.cos(a) * 0.16, Math.sin(a) * 0.16, wz], [Math.cos(a) * (wr - 0.08), Math.sin(a) * (wr - 0.08), wz], 0.075, wood(CHERRY, 1, 1), wheel, 8, false);
    }
  }
  for (let j = 0; j < 8; j++) {
    const a = j * Math.PI / 4;
    const paddle = box(Math.cos(a) * (wr - 0.07), Math.sin(a) * (wr - 0.07), 0, 0.12, 0.36, 0.75, j % 3 ? wood(MAPLE, 1, 1) : wood(CHERRY, 1, 1), wheel);
    paddle.rotation.z = a;
  }
  beam([-4.45, 2.25, -0.84], [-4.45, 2.25, 1.02], 0.11, wood(WALNUT, 1, 2));
  for (const wz of [-0.76, 0.96]) {
    beam([-5.16, 0.29, wz], [-4.45, 2.35, wz], 0.09, wood(WALNUT, 1, 2));
    beam([-3.76, 0.29, wz], [-4.45, 2.35, wz], 0.09, wood(WALNUT, 1, 2));
  }
  box(-4.76, 0.294, 0.36, 1.95, 0.12, 1.44, wood(DARK, 2, 2));
  addPart(g, new THREE.PlaneGeometry(1.86, 1.37), WATER_MAT, [-4.76, 0.401, 0.36], false).rotation.x = -Math.PI / 2;
  // 时钟瀑布：高位木槽 → 一级宽水幕 → 中转盆 → 二级跌水入溪。
  box(-2.48, 7.41, -0.26, 1.22, 0.13, 1.55, wood(WALNUT, 2, 3));
  for (const hz of [-1.02, 0.50]) box(-2.48, 7.65, hz, 1.23, 0.38, 0.10, wood(CHERRY, 2, 1));
  addPart(g, new THREE.PlaneGeometry(1.10, 1.41), WATER_MAT, [-2.48, 7.674, -0.26], false).rotation.x = -Math.PI / 2;
  tube([[3.35, -0.25, 4.24], [-2.83, -0.25, -0.96], [-2.83, 7.76, -0.96], [-2.65, 7.90, -0.68]], wood(WALNUT, 1, 6), 0.071);
  ribbon([[-3.08, 7.674, -0.22], [-3.27, 7.54, -0.22], [-3.45, 7.32, -0.22], [-3.45, 7.097, -0.22]], 0.36);
  trough([-3.45, 7.08, -0.22], [-3.72, 6.98, 0.58], 0.53);
  trough([-3.72, 6.98, 0.58], [-3.72, 6.91, 1.60], 0.53);
  ribbon([[-3.72, 6.927, 1.60], [-3.72, 5.63, 1.93], [-3.72, 4.30, 1.94], [-3.72, 3.05, 1.94]], 0.54, FALL_MAT);
  box(-3.72, 2.87, 1.97, 1.23, 0.14, 1.06, wood(WALNUT, 2, 2));
  for (const [lx2, lz2] of [[-4.34, 1.97], [-3.10, 1.97]] as const) box(lx2, 1.53, lz2, 0.094, 2.67, 0.094, wood(WALNUT, 1, 4));
  addPart(g, new THREE.PlaneGeometry(1.16, 0.98), WATER_MAT, [-3.72, 3.045, 1.97], false).rotation.x = -Math.PI / 2;
  ribbon([[-3.72, 2.997, 2.47], [-3.60, 2.0, 2.55], [-3.50, 1.0, 2.60], [-3.40, 0.35, 2.62]], 0.48, FALL_MAT);

  // ── 音乐柜（简化）：钟屋右侧木音箱（转桶每帧旋转）────────────────
  const cabinet = new THREE.Group();
  cabinet.position.set(1.94, 0, -0.56);
  cabinet.rotation.y = Math.PI / 2;
  g.add(cabinet);
  for (const cu of [-1.25, 1.25]) addPart(cabinet, new THREE.BoxGeometry(0.12, 2.85, 0.21), wood(WALNUT, 1, 4), [cu, 5.71, -0.25]);
  for (const cy2 of [4.31, 5.23, 6.27, 7.12]) addPart(cabinet, new THREE.BoxGeometry(2.67, 0.105, 0.41), wood(CHERRY, 3, 1), [0, cy2, -0.23]);
  for (let j = 0; j < 4; j++) {
    const u = -1.07 + j * 0.5;
    const h = 0.42 + j * 0.12;
    addPart(cabinet, new THREE.BoxGeometry(0.255, h, 0.33), j % 2 ? wood(MAPLE, 1, 1) : wood(BIRCH, 1, 1), [u, 6.34 + h / 2, -0.19], false);
  }
  const musicBarrel = new THREE.Group();
  musicBarrel.position.set(0, 5.66, -0.09);
  cabinet.add(musicBarrel);
  anim.musicBarrel = musicBarrel;
  addPart(musicBarrel, new THREE.CylinderGeometry(0.255, 0.255, 1.90, 24), wood(WALNUT, 3, 2), [0, 0, 0]).rotation.z = Math.PI / 2;
  for (const u of [-1.0, 1.0]) {
    const cheek = addPart(musicBarrel, new THREE.CylinderGeometry(0.34, 0.34, 0.10, 24), wood(CHERRY, 1, 1), [u, 0, 0]);
    cheek.rotation.x = Math.PI / 2;
    cheek.rotation.y = Math.PI / 2;
  }

  // ── 花园：栈桥、拱门、凉棚、长椅、棕榈与苔花 ─────────────────────
  const deck = (x: number, z: number, w: number, d: number, y = 0.29) => {
    box(x, y - 0.035, z, w, 0.14, d, wood(WALNUT, 2, 2));
  };
  deck(4.27, -3.75, 3.04, 2.86, 0.30);
  deck(-3.91, 5.26, 3.30, 1.84, 0.29);
  deck(0.16, 6.02, 4.64, 0.78, 0.29);
  // 拱形木桥（跨溪）。
  const bridge = new THREE.Group();
  bridge.position.set(-1.38, 0, 3.31);
  bridge.rotation.y = -0.48;
  g.add(bridge);
  for (let j = 0; j < 5; j++) {
    const z = -0.96 + j * 0.48;
    const y = 0.50 + Math.sin(j / 4 * Math.PI) * 0.30;
    addPart(bridge, new THREE.BoxGeometry(1.13, 0.075, 0.36), j % 3 ? wood(MAPLE, 1, 1) : wood(CHERRY, 1, 1), [0, y, z]);
  }
  for (const s of [-1, 1]) {
    tube([[s * 0.44, 0.40, -1], [s * 0.44, 0.72, 0], [s * 0.44, 0.40, 1]], wood(WALNUT, 1, 2), 0.063, bridge, 8);
  }
  // 入口木拱门。
  for (const ax of [-2.95, -1.48]) box(ax, 1.02, 5.57, 0.10, 1.37, 0.10, wood(CHERRY, 1, 3));
  tube([[-2.95, 1.65, 5.57], [-2.70, 2.01, 5.57], [-2.22, 2.19, 5.57], [-1.72, 2.01, 5.57], [-1.48, 1.65, 5.57]], wood(WALNUT, 1, 1), 0.065);
  // 凉棚（右后）。
  for (const ax of [3.01, 5.54]) for (const az of [-4.94, -2.55]) {
    box(ax, 1.67, az, 0.14, 2.69, 0.14, wood(WALNUT, 1, 4));
  }
  for (const az of [-4.94, -2.55]) box(4.27, 3.02, az, 3.0, 0.15, 0.19, wood(CHERRY, 3, 1));
  box(4.27, 3.23, -3.75, 2.9, 0.10, 2.9, wood(MAPLE, 3, 3), g, false);
  // 长椅 ×2。
  const bench = (x: number, z: number, ry: number, s = 1) => {
    const bg = new THREE.Group();
    bg.position.set(x, 0.36, z);
    bg.rotation.y = ry;
    bg.scale.setScalar(s);
    g.add(bg);
    addPart(bg, new THREE.BoxGeometry(1.55, 0.066, 0.6), wood(MAPLE, 2, 1), [0, 0.11, 0]);
    for (const lx of [-0.59, 0.59]) addPart(bg, new THREE.BoxGeometry(0.095, 0.44, 0.09), wood(WALNUT, 1, 1), [lx, -0.11, 0], false);
    addPart(bg, new THREE.BoxGeometry(0.076, 0.89, 0.077), wood(CHERRY, 1, 2), [0, 0.44, -0.28], false);
    addPart(bg, new THREE.BoxGeometry(1.54, 0.10, 0.10), wood(WALNUT, 2, 1), [0, 0.75, -0.28]);
  };
  bench(4.19, -4.51, 0, 1.07);
  bench(-4.17, 5.50, 0.10, 0.83);
  // 步道圆盘。
  for (let i = 0; i < 6; i++) {
    const a = -0.35 + i * 0.62;
    const x = cx + Math.cos(a) * 4.4;
    const z = -0.42 + Math.sin(a) * 3.8;
    if (x < -3.4 && z < 2.5) continue;
    cyl(x, 0.259, z, 0.24, 0.24, 0.08, wood(CHERRY, 1, 1), g, 12, false);
  }
  // 椰子棕榈 ×3（弯干 + 放射叶冠）。
  const palm = (x: number, z: number, height: number, lean: number) => {
    const y0 = 0.23;
    const pts: Vec3[] = [];
    for (let j = 0; j <= 6; j++) {
      const t = j / 6;
      pts.push([x + lean * t * t, y0 + height * t, z - 0.15 * t * t]);
    }
    tube(pts, wood(WALNUT, 1, 5), 0.105);
    const crown = new THREE.Group();
    crown.position.set(x + lean, y0 + height, z - 0.15);
    g.add(crown);
    const frondColors = [0x78994f, 0x93a962, 0x698747];
    for (let k = 0; k < 5; k++) {
      const a = k * Math.PI * 2 / 5 + 0.13;
      const len = 1.45 * 0.95;
      const dx = Math.cos(a);
      const dz = Math.sin(a);
      leaf([0, 0, 0], [dx * len, -0.30, dz * len], 0.145, frondColors[k % 3]!, crown);
    }
    ball(0, -0.15, 0, 0.13, woodPlain(0xa79260), crown, 1, false);
    ball(x, 0.30, z, 0.45, leafMat(0x718c49), g, 1, false).scale.y = 0.3;
  };
  palm(4.84, -4.97, 6.35, -0.31);
  palm(5.27, 0.94, 4.48, -0.22);
  palm(-5.40, 4.54, 3.91, 0.16);
  // 苔藓与小花的轻量散点。
  const mossSpots: Array<[number, number, number]> = [
    [-6.05, -5.50, 0.95], [3.72, -3.85, 1.10], [5.65, 2.28, 0.85], [1.43, 5.75, 0.7],
  ];
  for (const [mx, mz, ms] of mossSpots) {
    ball(mx, 0.27, mz, ms * 0.45, leafMat(0x718c49), g, 1, false).scale.y = 0.3;
    beam([mx + 0.3, 0.32, mz + 0.2], [mx + 0.3, 0.52, mz + 0.2], 0.009, leafMat(0x73904d), g, 4, false);
    ball(mx + 0.3, 0.56, mz + 0.2, 0.05, leafMat(0xeebcb0), g, 0, false);
  }
  // 小鸟屋。
  box(2.74, 6.19, -2.10, 0.63, 0.78, 0.59, wood(MAPLE, 1, 1));
  triangle([2.38, 6.58, -1.79], [3.10, 6.58, -1.79], [2.74, 6.92, -1.79], wood(CHERRY, 1, 1));
  // 会摇的草茎 ×2。
  for (const [sx, sz] of [[4.81, 2.64], [-2.0, 4.37]] as const) {
    const sprig = new THREE.Group();
    sprig.position.set(sx, 0.23, sz);
    g.add(sprig);
    beam([0, 0, 0], [0, 0.42, 0], 0.012, leafMat(0x6d894f), sprig, 4, false);
    for (let j = 0; j < 3; j++) {
      const a = j * 2.4;
      leaf([0, 0.10, 0], [Math.cos(a) * 0.35, 0.45 + j * 0.1, Math.sin(a) * 0.35], 0.15, j % 2 ? 0x819b61 : 0x9aaa70, sprig);
    }
    anim.sprigs.push(sprig);
  }

  // ── 完成装配 ────────────────────────────────────────────────────
  outer.position.set(definition.x, 0, definition.z);
  outer.userData.komorebiAnim = anim;
  outer.userData.navigationFootprint = { width: 14 * SCALE, depth: 14 * SCALE };
  outer.traverse((child) => {
    if ((child as THREE.Mesh).isMesh) child.userData.buildingId = definition.id;
  });
  return { ...definition, group: outer, body: undefined, bodyMat: undefined, labelEl: null, labelY: (10.5 + 0.9) * SCALE + 0.6 };
}

/**
 * 逐帧驱动木漏时光的活件。buildings 传全城建筑列表（内部按 userData
 * 过滤，无模块级状态，constructionScene 隐藏/恢复不会让引用失效）。
 * reduced 为 true 时完全跳过（尊重系统减少动态偏好）。
 */
export function updateKomorebiClockworks(buildings: ReadonlyArray<{ group: THREE.Group }>, elapsed: number, reduced: boolean): void {
  if (reduced) return;
  const t = elapsed;
  // 指针走本地真实时间（全楼共用一次取时，避免每栋楼每帧各建一个 Date）。
  const now = new Date();
  const minutes = now.getMinutes() + now.getSeconds() / 60;
  const hours = (now.getHours() % 12) + minutes / 60;
  for (const building of buildings) {
    const anim = building.group.userData.komorebiAnim as KomorebiAnim | undefined;
    if (!anim) continue;
    // 水车与齿轮列（原作 0.105 rad/s 传动）。
    anim.wheel.rotation.z = t * 0.105;
    for (const gear of anim.gears) gear.g.rotation.z = gear.phase + t * 0.105 * gear.ratio;
    // 钟摆。
    anim.pendulum.rotation.z = Math.sin(t * 1.7) * 0.17;
    anim.minuteHand.rotation.z = -(minutes / 60) * Math.PI * 2;
    anim.hourHand.rotation.z = -(hours / 12) * Math.PI * 2;
    // 布谷鸟报时：32 秒一循环（开门→探头→收工）。
    const cycle = t % 32;
    const open = smooth(18, 20, cycle) * (1 - smooth(28, 30, cycle));
    const out = smooth(20, 22, cycle) * (1 - smooth(26, 28, cycle));
    for (const door of anim.birdDoors) door.g.rotation.y = door.side * open * 1.35;
    anim.cuckoo.position.z = 0.88 + out * 0.91;
    // 音乐柜转桶。
    anim.musicBarrel.rotation.x = t * 0.16;
    // 草茎摇曳。
    for (let i = 0; i < anim.sprigs.length; i++) {
      const sprig = anim.sprigs[i]!;
      sprig.rotation.z = Math.sin(t * 0.7 + i * 1.4) * 0.033;
      sprig.rotation.x = Math.cos(t * 0.51 + i) * 0.024;
    }
  }
}
