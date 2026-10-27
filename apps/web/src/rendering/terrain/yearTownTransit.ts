import * as THREE from 'three';
import { PALETTE } from '../../city/data/cityConfig';
import { terrainHeight } from '../../city/data/terrain/heightfield/terrainHeight';
import {
  BRIDGE_CORRIDOR_HALF,
  BRIDGE_LENGTH,
  BRIDGE_TOWERS,
  bridgeDeckProfileY,
  bridgePointAt,
  projectOnBridge,
  RING_LENGTH,
  ringBeamYAt,
  ringPointAt,
  ringStationSpeedFactor,
} from '../../city/data/year-towns/transit';

// 年份群岛跨海交通渲染（T4a，设计 docs/year-towns-design.md §5）：
// 星门大桥（箱梁桥面/护栏/桥塔斜拉索/桥墩）+ 群岛环线轨道梁/桥墩 +
// 巡游列车（干线电车 ×1 桥上往返、磁悬车 ×1 环线绕圈）。
//
// 数据契约（transit.ts 头注释）：底高与走线一律取自 data/year-towns/transit.ts
// （bridgePointAt / bridgeDeckProfileY / ringPointAt / ringBeamYAt / BRIDGE_TOWERS），
// 本文件零走线坐标、零高度分支重写；桥墩/塔基落底用唯一权威采样器
// terrainHeight（AGENTS.md 依赖方向：rendering 消费 data）。
//
// 性能（红线：不得每帧重建）：
// - 桥体 + 环线梁墩塔索全部合并进「一个」顶点色 BufferGeometry（构建期
//   一次性发射，1 draw call），此后只读；
// - 列车为各自合并后的静态几何，巡游只改 position/rotation（矩阵级更新，
//   零几何分配、零 draw call 增量）；
// - 单 WebGL 上下文 / 现有灯光体系不变，不新增任何光源与 Water 实例。
//
// 视觉（对齐 archipelagoIsles 的 CG 片头折面语汇）：non-indexed 逐面顶点色
// + flatShading + ±6% 明度抖动。层间防共面（AGENTS.md ≥0.004）：桥面步道
// 顶 = 纵断面 +0.075（对步道床/岛台面/滩面均保持 ≥0.025 净间隔；桥面分层
// 内部 0.004 工艺缝）。月台面板与乘车交互归 T4b，本模块不渲染。

const DECK_GIRDER_H = 0.6;
const DECK_GIRDER_TOP = 0.046; // 相对纵断面：桥面箱梁顶
const DECK_WALKWAY_H = 0.025;
const DECK_WALKWAY_TOP = 0.075; // 步道面（护栏/列车轨面基准）
const DECK_SECTION_STEP = 1.4;
const TRACK_HALF_W = 0.9; // 中央电车轨 1.8（设计 §5.1 桥面分配）
const TRACK_STRIP_H = 0.04;
const TRACK_STRIP_BOTTOM = DECK_WALKWAY_TOP + 0.004;
const TRAM_TRACK_LIFT = TRACK_STRIP_BOTTOM + TRACK_STRIP_H; // 轨条顶
const RAIL_EDGE_INSET = 0.18;
const RAIL_H = 0.34;
const RAIL_BAR_H = 0.09;
const PIER_SPACING = 8.5;
const PIER_SIZE = 0.8;
const PIER_EMBED = 0.8;
const TOWER_TOP_Y = 12.6;
const TOWER_LEG_OFFSET = 3.3;
const TOWER_LEG_SIZE = 0.95;
const TOWER_BEAM_Y = 11.2;
const TOWER_CABLE_TOP_Y = 11.4;
const TOWER_CABLE_OFFSETS = [-14, -10, -6.5, -3.2, 3.2, 6.5, 10, 14] as const;
const TOWER_BEACON_H = 0.5;
const RING_BEAM_HALF_W = 0.85;
const RING_BEAM_DEPTH = 0.42;
const RING_SECTION_STEP = 2.4;
const RING_PIER_SPACING = 13;
const RING_PIER_SIZE = 0.62;
const RING_PIER_EMBED = 0.7;
const TRAM_SPEED = 6.2;
const MAGLEV_SPEED = 13.5;
const MAGLEV_HOVER_LIFT = 0.12;
const MAX_FRAME_DT = 0.12;

const WALKWAY_COLOR = new THREE.Color(0xbdb8ae);
const TRACK_COLOR = new THREE.Color(0x474c52);
const GIRDER_COLOR = new THREE.Color(0xa8a29a);
const RAIL_COLOR = new THREE.Color(0x8b939c);
const PIER_COLOR = new THREE.Color(0x9aa0a5);
const TOWER_COLOR = new THREE.Color(0xefece4);
const CABLE_COLOR = new THREE.Color(0x6f7681);
const BEACON_COLOR = new THREE.Color(PALETTE.GOLD);
const RING_BEAM_COLOR = new THREE.Color(0xe8e4dc);
const TRAIN_BODY_COLOR = new THREE.Color(0xf4f0e8);
const TRAIN_BAND_COLOR = new THREE.Color(PALETTE.BLUE);
const TRAIN_WINDOW_COLOR = new THREE.Color(0x3f4750);
const TRAIN_ROOF_COLOR = new THREE.Color(0xd9d4cc);

/** 顶点色低多边形几何发射器（桥/环线/列车共用；确定性抖动，无 Math.random）。 */
class FacetMeshBuilder {
  private readonly positions: number[] = [];
  private readonly colors: number[] = [];
  private facetCount = 0;

  private jitter(): number {
    this.facetCount += 1;
    const noise = Math.sin(this.facetCount * 12.9898) * 43758.5453;
    return 1 + (noise - Math.floor(noise) - 0.5) * 0.12;
  }

  /** 单色四边形（外向逆时针），逐面 ±6% 明度抖动。 */
  quad(
    ax: number, ay: number, az: number,
    bx: number, by: number, bz: number,
    cx: number, cy: number, cz: number,
    dx: number, dy: number, dz: number,
    color: THREE.Color,
  ): void {
    const k = this.jitter();
    const r = color.r * k, g = color.g * k, b = color.b * k;
    const push = (x: number, y: number, z: number): void => {
      this.positions.push(x, y, z);
      this.colors.push(r, g, b);
    };
    push(ax, ay, az); push(bx, by, bz); push(cx, cy, cz);
    push(ax, ay, az); push(cx, cy, cz); push(dx, dy, dz);
  }

  /**
   * 任意朝向箱梁（轴向 A→B，横截面 w×h 以轴心对称；端面不发射——连续
   * 结构体端面恒被邻段遮蔽）。坐标系：side = cross(轴, up) 归一（近水平轴
   * 时恒水平）、up2 = cross(轴, side)（近水平轴时恒 +y）；竖直轴退化为
   * 世界 x/z 正交对。四侧面按外向绕序发射（FrontSide 单面材质可正确剔除）。
   */
  beam(
    ax: number, ay: number, az: number,
    bx: number, by: number, bz: number,
    w: number, h: number,
    color: THREE.Color,
  ): void {
    const abx = bx - ax, aby = by - ay, abz = bz - az;
    const len = Math.hypot(abx, aby, abz);
    if (len < 1e-6) return;
    const kx = abx / len, ky = aby / len, kz = abz / len;
    let sx: number, sy: number, sz: number;
    if (Math.abs(ky) > 0.9) {
      sx = 1; sy = 0; sz = 0;
    } else {
      const sl = Math.hypot(kz, kx);
      sx = kz / sl; sy = 0; sz = -kx / sl; // cross(k, up)（y 分量恒 0）
    }
    const ux = ky * sz, uy = kz * sx - kx * sz, uz = -ky * sx; // cross(k, s)
    const hw = w / 2, hh = h / 2;
    const corner = (px: number, py: number, pz: number, ds: number, du: number): [number, number, number] =>
      [px + sx * hw * ds + ux * hh * du, py + sy * hw * ds + uy * hh * du, pz + sz * hw * ds + uz * hh * du];
    // A⁺⁻ 记号 = A 端 +side/−up 角。外向绕序（+side/−side/+up/−up）。
    const aL = corner(ax, ay, az, -1, -1), aR = corner(ax, ay, az, 1, -1);
    const aU = corner(ax, ay, az, 1, 1), aV = corner(ax, ay, az, -1, 1);
    const bL = corner(bx, by, bz, -1, -1), bR = corner(bx, by, bz, 1, -1);
    const bU = corner(bx, by, bz, 1, 1), bV = corner(bx, by, bz, -1, 1);
    this.quad(aR[0], aR[1], aR[2], aU[0], aU[1], aU[2], bU[0], bU[1], bU[2], bR[0], bR[1], bR[2], color);
    this.quad(aL[0], aL[1], aL[2], bL[0], bL[1], bL[2], bV[0], bV[1], bV[2], aV[0], aV[1], aV[2], color);
    this.quad(aV[0], aV[1], aV[2], bV[0], bV[1], bV[2], bU[0], bU[1], bU[2], aU[0], aU[1], aU[2], color);
    this.quad(aL[0], aL[1], aL[2], aR[0], aR[1], aR[2], bR[0], bR[1], bR[2], bL[0], bL[1], bL[2], color);
  }

  build(): THREE.BufferGeometry {
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(this.positions, 3));
    geometry.setAttribute('color', new THREE.Float32BufferAttribute(this.colors, 3));
    geometry.computeVertexNormals();
    geometry.computeBoundingBox();
    geometry.computeBoundingSphere();
    return geometry;
  }
}

/** 中心线采样点的右向法向（世界 y 向上：right = heading × up，(−tz, tx)）。 */
function rightNormalOf(tx: number, tz: number): { rx: number; rz: number } {
  return { rx: -tz, rz: tx };
}

function buildBridge(builder: FacetMeshBuilder): void {
  const sections = Math.ceil(BRIDGE_LENGTH / DECK_SECTION_STEP);
  const profile = (z: number): number => bridgeDeckProfileY(z);
  const towerS = BRIDGE_TOWERS.map((tower) => projectOnBridge(tower.x, tower.z).s);

  for (let i = 0; i < sections; i += 1) {
    const s0 = (i * BRIDGE_LENGTH) / sections;
    const s1 = ((i + 1) * BRIDGE_LENGTH) / sections;
    const p0 = bridgePointAt(s0);
    const p1 = bridgePointAt(s1);
    const n0 = rightNormalOf(p0.tx, p0.tz);
    const n1 = rightNormalOf(p1.tx, p1.tz);
    // 桥面分层（自下而上）：箱梁 → 步道板（0.004 工艺缝）→ 中央轨条。
    const deckW = BRIDGE_CORRIDOR_HALF * 2;
    builder.beam(p0.x, profile(p0.z) + DECK_GIRDER_TOP - DECK_GIRDER_H / 2, p0.z,
      p1.x, profile(p1.z) + DECK_GIRDER_TOP - DECK_GIRDER_H / 2, p1.z, deckW, DECK_GIRDER_H, GIRDER_COLOR);
    builder.beam(p0.x, profile(p0.z) + DECK_WALKWAY_TOP - DECK_WALKWAY_H / 2, p0.z,
      p1.x, profile(p1.z) + DECK_WALKWAY_TOP - DECK_WALKWAY_H / 2, p1.z, deckW, DECK_WALKWAY_H, WALKWAY_COLOR);
    builder.beam(p0.x, profile(p0.z) + TRACK_STRIP_BOTTOM + TRACK_STRIP_H / 2, p0.z,
      p1.x, profile(p1.z) + TRACK_STRIP_BOTTOM + TRACK_STRIP_H / 2, p1.z, TRACK_HALF_W * 2, TRACK_STRIP_H, TRACK_COLOR);
    // 两侧护栏：矮墙 + 帽条（帽条宽一档、顶面间隔 0.004，读作扶手压顶）。
    for (const side of [-1, 1]) {
      const e0 = BRIDGE_CORRIDOR_HALF - RAIL_EDGE_INSET;
      const edge0x = p0.x + n0.rx * side * e0, edge0z = p0.z + n0.rz * side * e0;
      const edge1x = p1.x + n1.rx * side * e0, edge1z = p1.z + n1.rz * side * e0;
      const y0 = profile(p0.z) + DECK_WALKWAY_TOP, y1 = profile(p1.z) + DECK_WALKWAY_TOP;
      builder.beam(edge0x, y0 + RAIL_H / 2, edge0z, edge1x, y1 + RAIL_H / 2, edge1z, 0.1, RAIL_H, RAIL_COLOR);
      builder.beam(edge0x, y0 + RAIL_H + 0.004 + RAIL_BAR_H / 2, edge0z,
        edge1x, y1 + RAIL_H + 0.004 + RAIL_BAR_H / 2, edge1z, 0.16, RAIL_BAR_H, RAIL_COLOR);
    }
    // 桥墩：等距落底 terrainHeight（唯一采样器），近塔让位、贴地段跳过。
    const pierEvery = Math.max(1, Math.round(PIER_SPACING / (BRIDGE_LENGTH / sections)));
    if (i % pierEvery === 0) {
      const sm = (s0 + s1) / 2;
      const nearTower = towerS.some((ts) => Math.abs(ts - sm) < 4.2);
      const pm = bridgePointAt(sm);
      const ground = terrainHeight(pm.x, pm.z);
      const girderBottom = profile(pm.z) + DECK_GIRDER_TOP - DECK_GIRDER_H;
      if (!nearTower && ground < girderBottom - 1.2) {
        builder.beam(pm.x, (ground - PIER_EMBED + girderBottom) / 2, pm.z, pm.x, girderBottom, pm.z,
          PIER_SIZE, PIER_SIZE, PIER_COLOR);
      }
    }
  }

  // 桥塔（门形双柱 + 斜拉索扇 + 星门金顶）：塔位/朝向全部来自 transit.ts。
  for (const tower of BRIDGE_TOWERS) {
    const { s } = projectOnBridge(tower.x, tower.z);
    const base = bridgePointAt(s);
    const n = rightNormalOf(base.tx, base.tz);
    const legAx = base.x + n.rx * -TOWER_LEG_OFFSET, legAz = base.z + n.rz * -TOWER_LEG_OFFSET;
    const legBx = base.x + n.rx * TOWER_LEG_OFFSET, legBz = base.z + n.rz * TOWER_LEG_OFFSET;
    for (const legX of [legAx, legBx]) {
      const legZ = legX === legAx ? legAz : legBz;
      // 塔柱自水面下 0.5 起步（海上段藏基），至塔顶。
      builder.beam(legX, -0.5, legZ, legX, TOWER_TOP_Y, legZ, TOWER_LEG_SIZE, TOWER_LEG_SIZE, TOWER_COLOR);
      builder.beam(legX, TOWER_TOP_Y, legZ, legX, TOWER_TOP_Y + TOWER_BEACON_H, legZ, 0.5, 0.5, BEACON_COLOR);
    }
    builder.beam(legAx, TOWER_BEAM_Y + 0.35, legAz, legBx, TOWER_BEAM_Y + 0.35, legBz, 0.6, 0.7, TOWER_COLOR);
    // 斜拉索扇：桥面两侧锚点（沿桥 ±3.2..±14）汇于塔顶区。
    for (const offset of TOWER_CABLE_OFFSETS) {
      const anchor = bridgePointAt(s + offset);
      const an = rightNormalOf(anchor.tx, anchor.tz);
      for (const side of [-1, 1]) {
        const deckX = anchor.x + an.rx * side * (BRIDGE_CORRIDOR_HALF - 0.35);
        const deckZ = anchor.z + an.rz * side * (BRIDGE_CORRIDOR_HALF - 0.35);
        const deckY = profile(anchor.z) + DECK_WALKWAY_TOP + 0.12;
        const topX = base.x + n.rx * side * TOWER_LEG_OFFSET * 0.35;
        const topZ = base.z + n.rz * side * TOWER_LEG_OFFSET * 0.35;
        builder.beam(deckX, deckY, deckZ, topX, TOWER_CABLE_TOP_Y, topZ, 0.09, 0.09, CABLE_COLOR);
      }
    }
  }
}

function buildRingLoop(builder: FacetMeshBuilder): void {
  const sections = Math.ceil(RING_LENGTH / RING_SECTION_STEP);
  for (let i = 0; i < sections; i += 1) {
    const s0 = (i * RING_LENGTH) / sections;
    const s1 = ((i + 1) * RING_LENGTH) / sections;
    const p0 = ringPointAt(s0);
    const p1 = ringPointAt(s1);
    // 轨道梁（顶面 = ringBeamYAt，磁悬车贴顶悬停巡游）。
    builder.beam(p0.x, ringBeamYAt(p0.x, p0.z) - RING_BEAM_DEPTH / 2, p0.z,
      p1.x, ringBeamYAt(p1.x, p1.z) - RING_BEAM_DEPTH / 2, p1.z,
      RING_BEAM_HALF_W * 2, RING_BEAM_DEPTH, RING_BEAM_COLOR);
    // 桥墩：等距落底 terrainHeight；梁高越陆（滩/台面）段自动缩短。
    const pierEvery = Math.max(1, Math.round(RING_PIER_SPACING / (RING_LENGTH / sections)));
    if (i % pierEvery === 0) {
      const sm = (s0 + s1) / 2;
      const pm = ringPointAt(sm);
      const ground = terrainHeight(pm.x, pm.z);
      const beamBottom = ringBeamYAt(pm.x, pm.z) - RING_BEAM_DEPTH;
      if (ground < beamBottom - 0.8) {
        builder.beam(pm.x, (ground - RING_PIER_EMBED + beamBottom) / 2, pm.z, pm.x, beamBottom, pm.z,
          RING_PIER_SIZE, RING_PIER_SIZE, PIER_COLOR);
      }
    }
  }
}

/** 干线电车（沿 +X 建造，y=0 为轨条顶）：三段体 + 通长窗带 + 主题饰带 + 受电杆。 */
function buildTram(builder: FacetMeshBuilder): void {
  builder.beam(-3.1, 0.16, 0, 3.1, 0.16, 0, 1.45, 0.18, TRACK_COLOR); // 底盘
  builder.beam(-3.1, 0.76, 0, 3.1, 0.76, 0, 1.42, 0.98, TRAIN_BODY_COLOR); // 车体
  builder.beam(-3.05, 1.33, 0, 3.05, 1.33, 0, 1.48, 0.56, TRAIN_WINDOW_COLOR); // 窗带
  builder.beam(-3.12, 0.66, 0, 3.12, 0.66, 0, 1.5, 0.16, TRAIN_BAND_COLOR); // 饰带
  builder.beam(-3.1, 1.66, 0, 3.1, 1.66, 0, 1.28, 0.1, TRAIN_ROOF_COLOR); // 顶
  builder.beam(0, 1.71, 0, 0, 2.02, 0, 0.08, 0.08, RAIL_COLOR); // 受电杆
  builder.beam(-0.5, 2.02, 0, 0.5, 2.02, 0, 0.06, 0.06, RAIL_COLOR);
}

/** 磁悬车（沿 +X 建造，y=0 为梁顶悬停面）：阶梯鼻锥 + 玻璃舱盖 + 主题带。 */
function buildMaglev(builder: FacetMeshBuilder): void {
  builder.beam(-2.6, 0.44, 0, 2.6, 0.44, 0, 1.36, 0.68, TRAIN_BODY_COLOR); // 主体
  builder.beam(-2.4, 0.87, 0, 2.4, 0.87, 0, 1.1, 0.18, TRAIN_WINDOW_COLOR); // 舱盖
  builder.beam(2.6, 0.4, 0, 3.6, 0.4, 0, 1.36, 0.6, TRAIN_BODY_COLOR); // 前鼻一级
  builder.beam(3.6, 0.3, 0, 4.25, 0.3, 0, 1.3, 0.4, TRAIN_BODY_COLOR); // 前鼻二级
  builder.beam(-3.6, 0.4, 0, -2.6, 0.4, 0, 1.36, 0.6, TRAIN_BODY_COLOR); // 尾鼻
  builder.beam(-2.62, 0.42, 0, 2.62, 0.42, 0, 1.4, 0.12, TRAIN_BAND_COLOR); // 主题带
}

export type YearTownTransit = {
  object: THREE.Group;
  update(elapsedSeconds?: number): void;
  /** 玩家乘车的专用车辆；与背景巡游车辆分离，过场期间不会被巡游更新覆盖。 */
  setRideVehicle(line: 'stargate' | 'ring', x: number, y: number, z: number, tx: number, tz: number): void;
  endRide(): void;
  dispose(): void;
};

export function createYearTownTransit(options: { scene: THREE.Scene; reduced?: boolean }): YearTownTransit {
  const object = new THREE.Group();
  object.name = 'year-town-transit';
  const geometries: THREE.BufferGeometry[] = [];
  const materials: THREE.Material[] = [];

  const structureBuilder = new FacetMeshBuilder();
  buildBridge(structureBuilder);
  buildRingLoop(structureBuilder);
  const structureGeometry = structureBuilder.build();
  const structureMaterial = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    vertexColors: true,
    flatShading: true,
    roughness: 0.94,
    metalness: 0,
  });
  const structureMesh = new THREE.Mesh(structureGeometry, structureMaterial);
  structureMesh.name = 'year-town-transit-structures';
  object.add(structureMesh);
  geometries.push(structureGeometry);
  materials.push(structureMaterial);

  const trainMaterial = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    vertexColors: true,
    flatShading: true,
    roughness: 0.55,
    metalness: 0.15,
  });
  materials.push(trainMaterial);

  const tramBuilder = new FacetMeshBuilder();
  buildTram(tramBuilder);
  const tramGeometry = tramBuilder.build();
  const tram = new THREE.Mesh(tramGeometry, trainMaterial);
  tram.name = 'transit-tram';
  object.add(tram);
  geometries.push(tramGeometry);

  const maglevBuilder = new FacetMeshBuilder();
  buildMaglev(maglevBuilder);
  const maglevGeometry = maglevBuilder.build();
  const maglev = new THREE.Mesh(maglevGeometry, trainMaterial);
  maglev.name = 'transit-maglev';
  object.add(maglev);
  geometries.push(maglevGeometry);

  const rideTram = new THREE.Mesh(tramGeometry, trainMaterial);
  rideTram.name = 'transit-ride-tram';
  rideTram.visible = false;
  object.add(rideTram);
  const rideMaglev = new THREE.Mesh(maglevGeometry, trainMaterial);
  rideMaglev.name = 'transit-ride-maglev';
  rideMaglev.visible = false;
  object.add(rideMaglev);

  options.scene.add(object);

  let lastElapsed = 0;
  let maglevS = 0;

  function placeTram(s: number, forward: boolean): void {
    const p = bridgePointAt(s);
    const dir = forward ? 1 : -1;
    tram.position.set(p.x, bridgeDeckProfileY(p.z) + TRAM_TRACK_LIFT, p.z);
    tram.rotation.y = -Math.atan2(p.tz * dir, p.tx * dir);
  }

  function advanceMaglev(dt: number): void {
    const p = ringPointAt(maglevS);
    maglevS = (maglevS + dt * MAGLEV_SPEED * ringStationSpeedFactor(p.x, p.z)) % RING_LENGTH;
    const q = ringPointAt(maglevS);
    maglev.position.set(q.x, ringBeamYAt(q.x, q.z) + MAGLEV_HOVER_LIFT, q.z);
    maglev.rotation.y = -Math.atan2(q.tz, q.tx);
  }

  placeTram(0, true);
  advanceMaglev(0);
  // reduced（系统减动效）：列车停泊在起始泊位，不做巡游。
  const animate = !options.reduced;

  return {
    object,
    setRideVehicle(line, x, y, z, tx, tz) {
      const vehicle = line === 'stargate' ? rideTram : rideMaglev;
      rideTram.visible = line === 'stargate';
      rideMaglev.visible = line === 'ring';
      vehicle.position.set(x, y + (line === 'stargate' ? TRAM_TRACK_LIFT : MAGLEV_HOVER_LIFT), z);
      vehicle.rotation.y = -Math.atan2(tz, tx);
    },
    endRide() {
      rideTram.visible = false;
      rideMaglev.visible = false;
    },
    update(elapsedSeconds?: number): void {
      const elapsed = Math.max(0, elapsedSeconds ?? 0);
      const dt = Math.min(MAX_FRAME_DT, Math.max(0, elapsed - lastElapsed));
      lastElapsed = elapsed;
      if (!animate) return;
      // 电车三角波往返（B1 ↔ 北广场端点）；磁悬车按站周降速因子绕环线。
      const cycle = (BRIDGE_LENGTH * 2) / TRAM_SPEED;
      const phase = (((elapsed % cycle) + cycle) % cycle) / cycle * 2;
      const forward = phase < 1;
      placeTram((forward ? phase : 2 - phase) * BRIDGE_LENGTH, forward);
      advanceMaglev(dt);
    },
    dispose(): void {
      object.parent?.remove(object);
      for (const geometry of geometries) geometry.dispose();
      for (const material of materials) material.dispose();
      geometries.length = 0;
      materials.length = 0;
    },
  };
}
