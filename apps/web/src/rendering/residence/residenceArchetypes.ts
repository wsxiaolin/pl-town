// Resident-house archetypes. Each builder shapes one recognisable massing type
// from real geometry (walls, framed windows, doors, roofs, chimneys, porches,
// balconies, storefronts) inside the existing per-lot footprint, and returns the
// main body mesh used for claiming / damage presentation. Footprints are kept at
// the current sizes so neighbour spacing, navigation obstacles and ground plots
// stay valid; variety comes from massing, roof, openings and detail rather than
// a larger plan.
import type * as THREE from 'three';
import type { MaterialParameters } from '../meshFactory';
import type { ResidenceKit } from './residenceKit';
import type { ResidenceFamily } from './residenceFamilies';
import { articulateFacade } from './residenceFacade';
import { buildYard } from './residenceYard';
import { acUnit, antenna, balustrade, fireEscape, houseNumber, skylight, waterTank } from './residenceProps';

export type ArchetypeContext = {
  group: THREE.Group;
  width: number;
  depth: number;
  family: ResidenceFamily;
  kit: ResidenceKit;
  /** Deterministic 0..n-1 selector for micro-variation within an archetype. */
  variant: number;
  /** Independent 0..3 selector for courtyard/yard dressing. */
  yardVariant: number;
  isNight: boolean;
};

export type ArchetypeBuilder = (ctx: ArchetypeContext) => THREE.Mesh;

const BASE = 0.12;

function wallMat(family: ResidenceFamily, tex: string, rx = 2, ry = 2): MaterialParameters {
  return { color: family.wall, roughness: 0.5, tex, rx, ry };
}

function isLit(variant: number, index: number): boolean {
  return (variant + index * 7) % 4 === 0;
}

function plinth(kit: ResidenceKit, group: THREE.Group, width: number, depth: number, family: ResidenceFamily, extra = 0.34): void {
  kit.box(group, width + extra, BASE, depth + extra, { color: family.plinth, roughness: 0.86, tex: 'stone', rx: 1, ry: 1 }, [0, BASE / 2, 0]);
}

/** One window on a gable side wall so the house reads in the round. */
function sideWindow(
  kit: ResidenceKit,
  group: THREE.Group,
  opts: {
    width: number;
    y: number;
    z?: number;
    w?: number;
    h?: number;
    family: ResidenceFamily;
    lit?: boolean;
    facing?: 'left' | 'right';
    mullions?: boolean;
  },
): void {
  const { width, y, z = 0, w = 0.26, h = 0.32, family, lit = false, facing = 'right', mullions = false } = opts;
  kit.window(group, {
    x: (facing === 'right' ? 1 : -1) * (width / 2),
    y,
    z,
    facing,
    w,
    h,
    frameColor: family.trim,
    lit,
    mullions,
    shutters: false,
    header: true,
  });
}

/** Eave gutters plus a downspout on each front corner. */
function eaveDrainage(
  kit: ResidenceKit,
  group: THREE.Group,
  opts: { width: number; depth: number; top: number; height: number; axis: 'x' | 'z'; family: ResidenceFamily },
): void {
  const { width, depth, top, height, axis, family } = opts;
  const overhang = 0.12;
  const metal = 0x5a6168;
  if (axis === 'z') {
    const run = depth + overhang * 2;
    [-1, 1].forEach((side) => {
      kit.gutterLine(group, { x: side * (width / 2 + overhang), z: 0, y: top - 0.015, length: run, axis: 'z', color: metal });
    });
    [-1, 1].forEach((side) => {
      kit.downspouts(group, [
        { x: side * (width / 2 + 0.02), z: depth / 2 - 0.03, y: BASE + 0.02, height: height - 0.04, color: family.accent },
      ]);
    });
  } else {
    const run = width + overhang * 2;
    [-1, 1].forEach((side) => {
      kit.gutterLine(group, { x: 0, z: side * (depth / 2 + overhang), y: top - 0.015, length: run, axis: 'x', color: metal });
    });
    [-1, 1].forEach((side) => {
      kit.downspouts(group, [
        { x: side * (width / 2 - 0.04), z: depth / 2 + 0.02, y: BASE + 0.02, height: height - 0.04, color: family.accent },
      ]);
    });
  }
}

/** 坡顶小屋：单层坡屋顶，带窗台的木框窗，小门廊与踏步，四坡/双坡随地块变化。 */
const buildCottage: ArchetypeBuilder = ({ group, width, depth, family, kit, variant, isNight }) => {
  plinth(kit, group, width, depth, family);
  const height = 0.9 + (variant % 3) * 0.06;
  const body = kit.body(group, width, height, depth, wallMat(family, family.wallTex), BASE + height / 2);
  const top = BASE + height;
  const axis = variant % 4 === 2 ? 'x' : 'z';
  if (variant % 4 === 3) {
    kit.hipRoof(group, { y: top, width, depth, height: 0.5, color: family.roof, tex: family.roofTex });
  } else {
    kit.gableRoof(group, {
      y: top,
      run: axis === 'z' ? depth : width,
      span: axis === 'z' ? width : depth,
      height: 0.42 + (variant % 2) * 0.06,
      color: family.roof,
      tex: family.roofTex,
      overhang: 0.12,
      axis,
    });
  }
  const windowCount = 2;
  kit.windowRow(group, {
    x: 0,
    y: BASE + 0.54,
    z: depth / 2,
    facing: 'front',
    count: windowCount,
    spacing: Math.min(0.72, width - 0.4),
    w: 0.3,
    h: 0.34,
    frameColor: family.trim,
    mullions: variant % 2 === 1,
    lit: isLit(variant, 0),
    shutters: variant % 2 === 1,
    shutterColor: family.accent,
    flowerBox: variant % 3 === 1,
    curtain: variant % 4 === 2,
  });
  kit.door(group, {
    x: variant % 2 === 0 ? 0 : width * 0.28,
    y: BASE,
    z: depth / 2,
    facing: 'front',
    w: 0.4,
    h: 0.58,
    color: family.accent,
    frameColor: family.trim,
    canopyColor: variant % 3 === 0 ? family.accent : undefined,
    lit: isNight && variant % 2 === 0,
  });
  if (variant % 3 !== 2) kit.chimney(group, { x: width * 0.3, z: -depth * 0.22, y: top + 0.18, height: 0.42, color: family.accent });
  eaveDrainage(kit, group, { width, depth, top, height, axis, family });
  if (variant % 2 === 0) skylight(group, kit, width * 0.2, -depth * 0.12, top + 0.2, 0.26, 0.3);
  houseNumber(group, kit, width * 0.22, BASE + 0.46, depth / 2 + 0.03, family.accent);
  articulateFacade({ group, kit, width, depth, height, base: BASE, family, variant });
  return body;
};

/** 阁楼小屋：单层主体 + 高坡屋顶 + 老虎窗，屋檐下开排气小窗。 */
const buildAttic: ArchetypeBuilder = ({ group, width, depth, family, kit, variant, isNight }) => {
  plinth(kit, group, width, depth, family);
  const height = 0.84;
  const body = kit.body(group, width, height, depth, wallMat(family, family.wallTex), BASE + height / 2);
  const top = BASE + height;
  const roofAxis: 'x' | 'z' = variant % 4 === 3 ? 'x' : 'z';
  if (roofAxis === 'x') {
    kit.gableRoof(group, { y: top, run: width, span: depth, height: 0.58, color: family.roof, tex: family.roofTex, overhang: 0.12, axis: 'x' });
  } else {
    kit.gableRoof(group, { y: top, run: depth, span: width, height: 0.62, color: family.roof, tex: family.roofTex, overhang: 0.12, axis: 'z' });
  }
  kit.dormer(group, {
    x: variant % 2 === 0 ? -0.34 : 0.34,
    y: top + 0.06,
    z: depth / 2 - 0.34,
    facing: 'front',
    width: 0.4,
    height: 0.32,
    depth: 0.42,
    wallColor: family.wall,
    wallTex: family.upperTex,
    roofColor: family.roof,
    lit: isLit(variant, 1),
  });
  kit.windowRow(group, {
    x: 0,
    y: BASE + 0.5,
    z: depth / 2,
    facing: 'front',
    count: 2,
    spacing: Math.min(0.72, width - 0.42),
    w: 0.28,
    h: 0.32,
    frameColor: family.trim,
    lit: isLit(variant, 0),
    shutters: variant % 3 === 0,
    shutterColor: family.accent,
    flowerBox: variant % 2 === 1,
    curtain: variant % 4 === 1,
  });
  kit.door(group, {
    x: variant % 2 === 0 ? width * 0.24 : -width * 0.24,
    y: BASE,
    z: depth / 2,
    facing: 'front',
    w: 0.38,
    h: 0.56,
    color: family.accent,
    frameColor: family.trim,
    lit: isNight,
  });
  kit.chimney(group, { x: -width * 0.28, z: -depth * 0.2, y: top + 0.3, height: 0.44, color: family.accent });
  eaveDrainage(kit, group, { width, depth, top, height, axis: roofAxis, family });
  if (variant === 2) skylight(group, kit, width * 0.2, depth * 0.06, top + 0.26, 0.24, 0.28);
  houseNumber(group, kit, -width * 0.22, BASE + 0.44, depth / 2 + 0.03, family.accent);
  articulateFacade({ group, kit, width, depth, height, base: BASE, family, variant });
  return body;
};

/** 双层公寓：两层住宅，规则窗阵 + 阳台 + 门廊雨棚。 */
const buildTownhouse: ArchetypeBuilder = ({ group, width, depth, family, kit, variant, isNight }) => {
  plinth(kit, group, width, depth, family);
  const height = 1.62 + (variant % 2) * 0.12;
  const body = kit.body(group, width, height, depth, wallMat(family, family.wallTex), BASE + height / 2);
  const top = BASE + height;
  const cols = width > 1.4 ? 2 : 1;
  const spacing = cols > 1 ? Math.min(0.66, width - 0.46) : 0;
  kit.windowRow(group, { x: 0, y: BASE + 0.62, z: depth / 2, facing: 'front', count: cols, spacing, w: 0.3, h: 0.4, frameColor: family.trim, mullions: true, lit: isLit(variant, 0), shutters: variant % 2 === 1, shutterColor: family.accent, flowerBox: variant % 2 === 0, curtain: variant % 4 === 0 });
  kit.windowRow(group, { x: 0, y: BASE + 1.24, z: depth / 2, facing: 'front', count: cols, spacing, w: 0.3, h: 0.4, frameColor: family.trim, mullions: variant % 2 === 0, lit: isLit(variant, 1), shutters: variant % 3 === 0, shutterColor: family.accent, curtain: variant % 4 === 2 });
  kit.windowRow(group, { x: 0, y: BASE + 1.24, z: -depth / 2, facing: 'back', count: cols, spacing, w: 0.26, h: 0.36, frameColor: family.trim, lit: isLit(variant, 2) });
  if (variant % 2 === 0) {
    kit.awning(group, { x: 0, y: top - 0.18, z: depth / 2, facing: 'front', width: width * 0.78, depth: 0.34, colorA: family.accent, colorB: family.trim, stripes: 4 });
  }
  if (variant === 3) {
    kit.balcony(group, { x: 0, y: BASE + 1.0, z: depth / 2, facing: 'front', width: width * 0.66, depth: 0.3, color: family.trim, railColor: family.accent });
    [-0.22, 0.22].forEach((px) => {
      kit.cyl(group, 0.05, 0.06, 0.11, 8, { color: 0xa9674a, roughness: 0.85, tex: 'stone', rx: 1, ry: 1 }, [px, BASE + 1.085, depth / 2 + 0.16], false);
      kit.ico(group, 0.08, 0, { color: 0x4f8447, roughness: 0.94, tex: 'grass', rx: 1, ry: 1 }, [px, BASE + 1.18, depth / 2 + 0.16], [1, 1.1, 1], false);
    });
  }
  kit.door(group, {
    x: variant % 2 === 0 ? width * 0.24 : 0,
    y: BASE,
    z: depth / 2,
    facing: 'front',
    w: 0.4,
    h: 0.72,
    color: family.accent,
    frameColor: family.trim,
    canopyColor: family.accent,
    lit: isNight,
  });
  if (variant % 3 === 1) {
    kit.flatRoof(group, { y: top, width, depth, parapetColor: family.accent, parapetHeight: 0.2 });
  } else {
    kit.gableRoof(group, { y: top, run: depth, span: width, height: 0.34, color: family.roof, tex: family.roofTex, overhang: 0.12, axis: 'z' });
    kit.chimney(group, { x: width * 0.28, z: -depth * 0.24, y: top + 0.1, height: 0.4, color: family.accent });
    eaveDrainage(kit, group, { width, depth, top, height, axis: 'z', family });
  }
  if (variant % 2 === 1) acUnit(group, kit, -width * 0.38, BASE + 1.02, depth / 2 + 0.085);
  houseNumber(group, kit, width * 0.18, BASE + 0.5, depth / 2 + 0.03, family.accent);
  articulateFacade({ group, kit, width, depth, height, base: BASE, family, variant });
  return body;
};

/** 平顶小高层：三层公寓，密窗阵 + 女儿墙 + 入口雨棚与屋顶设备箱。 */
const buildWalkup: ArchetypeBuilder = ({ group, width, depth, family, kit, variant, isNight }) => {
  plinth(kit, group, width, depth, family);
  const height = 2.16 + (variant % 2) * 0.12;
  const body = kit.body(group, width, height, depth, wallMat(family, family.upperTex), BASE + height / 2);
  const top = BASE + height;
  const cols = width > 1.4 ? 2 : 1;
  const spacing = cols > 1 ? Math.min(0.62, width - 0.44) : 0;
  for (let row = 0; row < 3; row += 1) {
    kit.windowRow(group, {
      x: 0,
      y: BASE + 0.52 + row * 0.66,
      z: depth / 2,
      facing: 'front',
      count: cols,
      spacing,
      w: 0.28,
      h: 0.36,
      frameColor: family.trim,
      mullions: row === 1,
      lit: isLit(variant, row),
      shutters: row === 0 && variant % 2 === 1,
      shutterColor: family.accent,
      flowerBox: row === 1 && variant % 3 === 0,
      curtain: row === 2 && variant % 4 === 1,
    });
  }
  kit.windowRow(group, { x: 0, y: BASE + 1.18, z: -depth / 2, facing: 'back', count: cols, spacing, w: 0.24, h: 0.32, frameColor: family.trim, lit: isLit(variant, 3) });
  kit.door(group, { x: 0, y: BASE, z: depth / 2, facing: 'front', w: 0.4, h: 0.66, color: family.accent, frameColor: family.trim, canopyColor: family.accent, lit: isNight });
  if (variant % 2 === 0) {
    kit.balcony(group, { x: 0, y: BASE + 1.0, z: depth / 2, facing: 'front', width: width * 0.62, depth: 0.28, color: family.trim, railColor: family.accent });
    [-0.2, 0.2].forEach((px) => {
      kit.cyl(group, 0.045, 0.055, 0.1, 8, { color: 0xa9674a, roughness: 0.85, tex: 'stone', rx: 1, ry: 1 }, [px, BASE + 1.08, depth / 2 + 0.15], false);
      kit.ico(group, 0.07, 0, { color: 0x5f9550, roughness: 0.94, tex: 'grass', rx: 1, ry: 1 }, [px, BASE + 1.17, depth / 2 + 0.15], [1, 1.1, 1], false);
    });
  }
  kit.flatRoof(group, { y: top, width, depth, parapetColor: family.accent, parapetHeight: 0.24 });
  kit.box(group, 0.3, 0.22, 0.3, { color: 0xb9bcbe, roughness: 0.6, tex: 'metal', rx: 1, ry: 1 }, [width * 0.24, top + 0.12, -depth * 0.2]);
  if (variant % 2 === 0) kit.box(group, 0.16, 0.3, 0.16, { color: 0x8f9296, roughness: 0.7, tex: 'metal', rx: 1, ry: 1 }, [-width * 0.26, top + 0.16, depth * 0.18]);
  if (variant % 2 === 0) waterTank(group, kit, -width * 0.23, -depth * 0.16, top + 0.06, family.plinth);
  if (variant === 1) antenna(group, kit, width * 0.3, depth * 0.24, top + 0.06, 0.62);
  if (variant === 3) {
    // Stair bulkhead + two wall-mounted AC units.
    kit.box(group, width * 0.44, 0.34, depth * 0.34, { color: family.upperTex === family.wallTex ? family.wall : family.plinth, roughness: 0.75, tex: family.upperTex, rx: 1, ry: 1 }, [0, top + 0.25, depth * 0.08]);
    kit.box(group, 0.16, 0.24, 0.02, { color: family.accent, roughness: 0.65, tex: 'wood', rx: 1, ry: 1 }, [0, top + 0.16, depth * 0.08 + depth * 0.17 + 0.01], false);
    acUnit(group, kit, width / 2 - 0.14, BASE + 1.18, depth / 2 + 0.085);
    acUnit(group, kit, -width / 2 + 0.14, BASE + 1.84, depth / 2 + 0.085);
  }
  houseNumber(group, kit, width * 0.16, BASE + 0.5, depth / 2 + 0.03, family.accent);
  articulateFacade({ group, kit, width, depth, height, base: BASE, family, variant });
  return body;
};

/** 院落民居：低矮主体后退，前院矮墙 + 院门 + 菜畦，屋顶坡向街面。 */
const buildCourtyard: ArchetypeBuilder = ({ group, width, depth, family, kit, variant, yardVariant, isNight }) => {
  plinth(kit, group, width, depth, family);
  const height = 0.76;
  const houseWidth = width * 0.82;
  const houseDepth = depth * 0.72;
  const bodyZ = -depth * 0.16;
  const frontZ = bodyZ + houseDepth / 2;
  const body = kit.body(group, houseWidth, height, houseDepth, wallMat(family, family.wallTex), BASE + height / 2);
  body.position.z = bodyZ;
  const top = BASE + height;
  if (variant % 4 === 2) {
    kit.hipRoof(group, { y: top, z: bodyZ, width: houseWidth, depth: houseDepth, height: 0.34, color: family.roof, tex: family.roofTex });
  } else {
    kit.gableRoof(group, { y: top, z: bodyZ, run: houseWidth, span: houseDepth, height: 0.36, color: family.roof, tex: family.roofTex, overhang: 0.12, axis: 'x' });
  }
  kit.windowRow(group, { x: 0, y: BASE + 0.42, z: frontZ, facing: 'front', count: 2, spacing: Math.min(0.62, houseWidth - 0.34), w: 0.26, h: 0.3, frameColor: family.trim, lit: isLit(variant, 0), shutters: variant % 2 === 0, shutterColor: family.accent, flowerBox: variant % 3 === 2, curtain: variant % 4 === 1 });
  sideWindow(kit, group, { width: houseWidth, y: BASE + 0.42, z: bodyZ, family, lit: isLit(variant, 2), facing: 'right' });
  sideWindow(kit, group, { width: houseWidth, y: BASE + 0.42, z: bodyZ, family, lit: isLit(variant, 1), facing: 'left' });
  if (variant % 2 === 1) {
    // Small kitchen wing against the right side of the courtyard house.
    const wingW = 0.22;
    const wingH = height * 0.66;
    const wingD = houseDepth * 0.7;
    const wingX = houseWidth / 2 + wingW / 2 + 0.02;
    kit.box(group, wingW, wingH, wingD, wallMat(family, family.wallTex), [wingX, BASE + wingH / 2, bodyZ]);
    const wingRoof = kit.box(group, wingW + 0.08, 0.05, wingD + 0.06, { color: family.roof, roughness: 0.74, tex: family.roofTex, rx: 1, ry: 1 }, [wingX, BASE + wingH + 0.02, bodyZ], false);
    wingRoof.rotation.z = -0.14;
  }
  kit.door(group, { x: 0, y: BASE, z: frontZ, facing: 'front', w: 0.34, h: 0.5, color: family.accent, frameColor: family.trim, step: false, lit: isNight });
  // Front yard boundary wall with a gate gap in the middle.
  const wallMatYard: MaterialParameters = { color: family.plinth, roughness: 0.85, tex: 'stone', rx: 1, ry: 1 };
  const gateHalf = 0.28;
  const sideWidth = (width - gateHalf * 2) / 2;
  if (sideWidth > 0.12) {
    kit.box(group, sideWidth, 0.28, 0.08, wallMatYard, [-gateHalf - sideWidth / 2, BASE + 0.14, depth / 2 - 0.06]);
    kit.box(group, sideWidth, 0.28, 0.08, wallMatYard, [gateHalf + sideWidth / 2, BASE + 0.14, depth / 2 - 0.06]);
  }
  kit.box(group, 0.06, 0.36, 0.06, { color: family.accent, roughness: 0.7, tex: 'wood', rx: 1, ry: 1 }, [-gateHalf, BASE + 0.18, depth / 2 - 0.06]);
  kit.box(group, 0.06, 0.36, 0.06, { color: family.accent, roughness: 0.7, tex: 'wood', rx: 1, ry: 1 }, [gateHalf, BASE + 0.18, depth / 2 - 0.06]);
  // Open timber gate leaf swung inward on the left post.
  const gateBar: MaterialParameters = { color: family.accent, roughness: 0.72, tex: 'wood', rx: 1, ry: 1 };
  [-0.24, -0.19, -0.14].forEach((gx) => {
    kit.box(group, 0.025, 0.3, 0.025, gateBar, [gx, BASE + 0.16, depth / 2 - 0.14], false);
  });
  [-0.27, -0.03].forEach((gx) => {
    kit.box(group, 0.28, 0.025, 0.025, gateBar, [gx, BASE + 0.25, depth / 2 - 0.14], false);
  });
  // House cornice on the two long walls (the body is inset and offset in z,
  // so it is added directly instead of going through articulateFacade).
  const corniceMat: MaterialParameters = { color: family.trim, roughness: 0.74, tex: 'stone', rx: 1, ry: 1 };
  [-1, 1].forEach((side) => {
    kit.box(group, houseWidth + 0.16, 0.06, 0.07, corniceMat, [0, top - 0.02, bodyZ + side * (houseDepth / 2 + 0.02)], false);
  });
  // Eave gutters on the two long walls plus downspouts at the front corners.
  [-1, 1].forEach((side) => {
    kit.gutterLine(group, { x: 0, z: bodyZ + side * (houseDepth / 2 + 0.12), y: top - 0.015, length: houseWidth + 0.24, axis: 'x', color: 0x5a6168 });
  });
  kit.downspouts(group, [
    { x: -houseWidth / 2 + 0.03, z: frontZ - 0.03, y: BASE + 0.02, height: height - 0.04, color: family.accent },
    { x: houseWidth / 2 - 0.03, z: frontZ - 0.03, y: BASE + 0.02, height: height - 0.04, color: family.accent },
  ]);
  // Warm gate lanterns on the two gate posts.
  [-1, 1].forEach((side) => {
    kit.ico(group, 0.05, 0, { color: 0xffd27a, emissive: 0xffb347, emissiveIntensity: isNight ? 0.9 : 0.24, roughness: 0.4 }, [side * gateHalf, BASE + 0.43, depth / 2 - 0.06], [1, 1.2, 1], false);
  });
  buildYard({ group, kit, width, depth, family, variant: yardVariant, groundY: BASE, frontZ });
  return body;
};

/** 底商住宅：底层沿街铺面（橱窗 + 条纹雨棚 + 招牌）+ 上层住宅。 */
const buildShophouse: ArchetypeBuilder = ({ group, width, depth, family, kit, variant, isNight }) => {
  plinth(kit, group, width, depth, family);
  const groundH = 0.66;
  const upperH = 0.86;
  const body = kit.body(group, width, groundH + upperH, depth, wallMat(family, family.wallTex), BASE + (groundH + upperH) / 2);
  const upperBase = BASE + groundH;
  const top = upperBase + upperH;
  kit.storefront(group, {
    x: 0,
    y: BASE + 0.02,
    z: depth / 2,
    facing: 'front',
    w: width * 0.86,
    h: groundH - 0.12,
    awningColor: family.accent,
    awningColor2: family.trim,
    signColor: family.accent,
  });
  kit.windowRow(group, { x: 0, y: upperBase + 0.42, z: depth / 2, facing: 'front', count: 2, spacing: Math.min(0.68, width - 0.42), w: 0.3, h: 0.4, frameColor: family.trim, mullions: true, lit: isLit(variant, 0), shutters: variant % 2 === 0, shutterColor: family.accent, flowerBox: variant % 3 === 1, curtain: variant % 4 === 3 });
  kit.windowRow(group, { x: 0, y: upperBase + 0.42, z: -depth / 2, facing: 'back', count: 1, spacing: 0, w: 0.28, h: 0.36, frameColor: family.trim, lit: isLit(variant, 1) });
  if (variant % 2 === 0) {
    kit.gableRoof(group, { y: top, run: width, span: depth, height: 0.34, color: family.roof, tex: family.roofTex, overhang: 0.14, axis: 'x' });
    eaveDrainage(kit, group, { width, depth, top, height: groundH + upperH, axis: 'x', family });
  } else {
    kit.flatRoof(group, { y: top, width, depth, parapetColor: family.accent, parapetHeight: 0.18 });
  }
  kit.chimney(group, { x: -width * 0.28, z: -depth * 0.2, y: top + 0.12, height: 0.36, color: family.accent });
  // Perpendicular blade sign over the shop door.
  const bladeX = width * 0.42;
  kit.box(group, 0.032, 0.035, 0.2, { color: 0x4a3a2c, roughness: 0.6, tex: 'metal', rx: 1, ry: 1 }, [bladeX, upperBase + 0.4, depth / 2 + 0.1], false);
  kit.box(group, 0.05, 0.24, 0.28, { color: family.accent, roughness: 0.5, tex: 'wood', rx: 1, ry: 1 }, [bladeX, upperBase + 0.28, depth / 2 + 0.16], false);
  kit.box(group, 0.04, 0.05, 0.2, { color: 0xf0d49a, emissive: 0xf0c060, emissiveIntensity: 0.12, roughness: 0.45 }, [bladeX + 0.03, upperBase + 0.28, depth / 2 + 0.16], false);
  // Warm bulb string under the shopfront awning.
  [-0.42, -0.14, 0.14, 0.42].forEach((bx, index) => {
    kit.ico(group, 0.022, 0, { color: 0xffe1a0, emissive: 0xffc86a, emissiveIntensity: isNight ? 0.95 : 0.22, roughness: 0.4 }, [bx, upperBase - 0.06, depth / 2 + 0.24 + (index % 2) * 0.01], [1, 1, 1], false);
  });
  articulateFacade({ group, kit, width, depth, height: groundH + upperH, base: BASE, family, variant, storefront: true });
  return body;
};

/** 露台洋房：四坡屋顶 + 柱廊门廊 + 凸窗 + 烟囱。 */
const buildVilla: ArchetypeBuilder = ({ group, width, depth, family, kit, variant, isNight }) => {
  plinth(kit, group, width, depth, family, 0.4);
  const height = 0.96;
  const body = kit.body(group, width, height, depth, wallMat(family, family.wallTex), BASE + height / 2);
  const top = BASE + height;
  kit.hipRoof(group, { y: top, width: width + 0.24, depth: depth + 0.1, height: 0.5, color: family.roof, tex: family.roofTex });
  kit.porch(group, { x: 0, z: depth / 2 - 0.06, y: BASE, width: width * 0.62, depth: 0.44, roofColor: family.roof, roofTex: family.roofTex, postColor: family.trim, rise: 0.42 });
  // Bay window protruding from the front wall.
  kit.box(group, 0.56, 0.5, 0.18, { color: family.wall, roughness: 0.5, tex: family.upperTex, rx: 1, ry: 1 }, [0, BASE + 0.56, depth / 2 + 0.07]);
  kit.box(group, 0.44, 0.34, 0.03, { color: 0xcfe0eb, emissive: 0x395062, emissiveIntensity: isNight ? 0.16 : 0.04, roughness: 0.14, metalness: 0.18, tex: 'window_reflection', rx: 1, ry: 1 }, [0, BASE + 0.58, depth / 2 + 0.17], false);
  kit.windowRow(group, { x: 0, y: BASE + 0.56, z: -depth / 2, facing: 'back', count: 2, spacing: Math.min(0.6, width - 0.4), w: 0.26, h: 0.34, frameColor: family.trim, lit: isLit(variant, 0), shutters: variant % 2 === 0, shutterColor: family.accent, flowerBox: variant % 3 === 0 });
  kit.door(group, { x: 0, y: BASE, z: depth / 2 + 0.18, facing: 'front', w: 0.42, h: 0.6, color: family.accent, frameColor: family.trim, step: false, lit: isNight });
  kit.chimney(group, { x: width * 0.3, z: -depth * 0.16, y: top + 0.24, height: 0.44, color: family.accent });
  // Small gable over the bay window.
  kit.gableRoof(group, { y: BASE + 0.81, z: depth / 2 + 0.1, run: 0.62, span: 0.28, height: 0.12, color: family.roof, tex: family.roofTex, overhang: 0.03, axis: 'x' });
  // Porch balustrades flanking the entrance steps.
  balustrade(group, kit, { x: -width * 0.22, z: depth / 2 + 0.34, y: BASE, width: width * 0.22 });
  balustrade(group, kit, { x: width * 0.22, z: depth / 2 + 0.34, y: BASE, width: width * 0.22 });
  // Potted shrubs either side of the door.
  [-1, 1].forEach((side) => {
    const px = side * width * 0.22;
    kit.cyl(group, 0.06, 0.078, 0.14, 8, { color: 0xa9674a, roughness: 0.85, tex: 'stone', rx: 1, ry: 1 }, [px, BASE + 0.07, depth / 2 + 0.28], false);
    kit.ico(group, 0.1, 0, { color: 0x4f8447, roughness: 0.94, tex: 'grass', rx: 1, ry: 1 }, [px, BASE + 0.2, depth / 2 + 0.28], [1, 1.12, 1], false);
  });
  // Hip-roof drainage on all four eaves.
  kit.gutterLine(group, { x: 0, z: (depth + 0.1) / 2, y: top - 0.015, length: width + 0.24, axis: 'x' });
  kit.gutterLine(group, { x: 0, z: -(depth + 0.1) / 2, y: top - 0.015, length: width + 0.24, axis: 'x' });
  kit.gutterLine(group, { x: (width + 0.24) / 2, z: 0, y: top - 0.015, length: depth + 0.1, axis: 'z' });
  kit.gutterLine(group, { x: -(width + 0.24) / 2, z: 0, y: top - 0.015, length: depth + 0.1, axis: 'z' });
  if (variant === 3) {
    // Little lantern cupola on the ridge as a landmark variant.
    kit.box(group, 0.24, 0.18, 0.24, { color: family.wall, roughness: 0.6, tex: family.upperTex, rx: 1, ry: 1 }, [0, top + 0.58, 0]);
    [-1, 1].forEach((side) => {
      kit.box(group, 0.1, 0.06, 0.02, { color: 0x3a434b, emissive: 0xffc86a, emissiveIntensity: isNight ? 0.7 : 0.06, roughness: 0.5 }, [0, top + 0.58, side * 0.13], false);
    });
    kit.hipRoof(group, { y: top + 0.68, width: 0.32, depth: 0.32, height: 0.16, color: family.roof, tex: family.roofTex });
  }
  articulateFacade({ group, kit, width, depth, height, base: BASE, family, variant });
  return body;
};

/** 联排小屋：窄高两层，两个单元并排——各自的门与上下叠窗。 */
const buildRowhouse: ArchetypeBuilder = ({ group, width, depth, family, kit, variant, isNight }) => {
  plinth(kit, group, width, depth, family, 0.3);
  const height = 1.72 + (variant % 2) * 0.1;
  const body = kit.body(group, width, height, depth, wallMat(family, family.wallTex), BASE + height / 2);
  const top = BASE + height;
  const unitX = width * 0.25;
  [-1, 1].forEach((side, index) => {
    kit.door(group, { x: side * unitX, y: BASE, z: depth / 2, facing: 'front', w: 0.34, h: 0.6, color: family.accent, frameColor: family.trim, step: true, canopyColor: family.trim, lit: isNight && index === variant % 2 });
    kit.window(group, { x: side * unitX, y: BASE + 1.06, z: depth / 2, facing: 'front', w: 0.28, h: 0.4, frameColor: family.trim, mullions: true, lit: isLit(variant, index), shutters: variant % 2 === 0, shutterColor: family.accent, flowerBox: variant % 3 === 2 });
    kit.window(group, { x: side * unitX, y: BASE + 1.56, z: depth / 2, facing: 'front', w: 0.24, h: 0.3, frameColor: family.trim, lit: isLit(variant, index + 2), curtain: variant % 4 === 0 });
  });
  houseNumber(group, kit, unitX + 0.18, BASE + 0.46, depth / 2 + 0.03, family.accent);
  houseNumber(group, kit, -unitX + 0.18, BASE + 0.46, depth / 2 + 0.03, family.accent);
  if (variant % 4 === 1) {
    kit.hipRoof(group, { y: top, width, depth, height: 0.42, color: family.roof, tex: family.roofTex });
  } else {
    kit.gableRoof(group, { y: top, run: width, span: depth, height: 0.4, color: family.roof, tex: family.roofTex, overhang: 0.12, axis: 'x' });
    eaveDrainage(kit, group, { width, depth, top, height, axis: 'x', family });
  }
  // Party-wall chimney between the two units.
  kit.chimney(group, { x: 0, z: -depth * 0.18, y: top + 0.16, height: 0.4, size: 0.14, color: family.accent });
  articulateFacade({ group, kit, width, depth, height, base: BASE, family, variant });
  return body;
};

export const RESIDENCE_ARCHETYPE_NAMES = [
  '坡顶小屋',
  '阁楼小屋',
  '双层公寓',
  '平顶小高层',
  '院落民居',
  '底商住宅',
  '露台洋房',
  '联排小屋',
] as const;

export const RESIDENCE_ARCHETYPE_COUNT = RESIDENCE_ARCHETYPE_NAMES.length;

export const RESIDENCE_ARCHETYPES: readonly ArchetypeBuilder[] = [
  buildCottage,
  buildAttic,
  buildTownhouse,
  buildWalkup,
  buildCourtyard,
  buildShophouse,
  buildVilla,
  buildRowhouse,
];
