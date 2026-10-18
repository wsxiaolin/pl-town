// Higher-detail props shared by the residence archetypes: trees, picket fences,
// rooftop water tanks / AC units / skylights, porch columns and balustrades.
// These are deliberately small helper functions so each archetype can dress a
// lot without growing into a monolith.
import type * as THREE from 'three';
import type { MaterialParameters } from '../meshFactory';
import type { ResidenceKit } from './residenceKit';

const GREEN_DARK = 0x3f6f3c;
const GREEN_MID = 0x4f8447;
const GREEN_LIGHT = 0x629a55;

function foliageMat(color: number): MaterialParameters {
  return { color, roughness: 0.94, tex: 'grass', rx: 1, ry: 1 };
}

/** Broadleaf tree: tapered trunk and three offset canopy blobs. */
export function tree(group: THREE.Group, kit: ResidenceKit, x: number, z: number, y: number, scale: number, variant: number): void {
  kit.cyl(group, 0.05 * scale, 0.075 * scale, 0.44 * scale, 7, { color: 0x6b4f38, roughness: 0.9, tex: 'wood', rx: 1, ry: 1 }, [x, y + 0.22 * scale, z]);
  const spread = 0.05 * scale;
  if (variant % 3 === 0) {
    // Conifer: stacked blobs narrowing upward.
    kit.ico(group, 0.26 * scale, 0, foliageMat(GREEN_DARK), [x, y + 0.55 * scale, z], [1, 0.9, 1]);
    kit.ico(group, 0.2 * scale, 0, foliageMat(GREEN_MID), [x, y + 0.76 * scale, z], [1, 1, 1]);
    kit.ico(group, 0.13 * scale, 0, foliageMat(GREEN_LIGHT), [x, y + 0.94 * scale, z], [1, 1.1, 1]);
  } else {
    kit.ico(group, 0.28 * scale, 0, foliageMat(GREEN_MID), [x, y + 0.62 * scale, z], [1.1, 0.92, 1.05]);
    kit.ico(group, 0.2 * scale, 0, foliageMat(GREEN_DARK), [x - spread, y + 0.5 * scale, z + spread], [1, 0.9, 1]);
    kit.ico(group, 0.17 * scale, 0, foliageMat(GREEN_LIGHT), [x + spread, y + 0.72 * scale, z - spread], [1, 0.95, 1]);
  }
}

/** Low picket fence running along x at a fixed z. */
export function picketFence(
  group: THREE.Group,
  kit: ResidenceKit,
  opts: { x: number; z: number; width: number; y: number; color?: number; pickets?: number },
): void {
  const { x, z, width, y, color = 0xe8e4d8, pickets = 6 } = opts;
  const post: MaterialParameters = { color, roughness: 0.8, tex: 'wood', rx: 1, ry: 1 };
  kit.box(group, width, 0.03, 0.03, post, [x, y + 0.18, z], false);
  kit.box(group, width, 0.03, 0.03, post, [x, y + 0.31, z], false);
  const step = width / (pickets - 1);
  for (let index = 0; index < pickets; index += 1) {
    const px = x - width / 2 + index * step;
    kit.box(group, 0.035, 0.36, 0.028, post, [px, y + 0.18, z], false);
    const tip = kit.box(group, 0.05, 0.05, 0.03, post, [px, y + 0.375, z], false);
    tip.rotation.z = Math.PI / 4;
  }
  [-1, 1].forEach((side) => {
    kit.box(group, 0.07, 0.46, 0.07, post, [x + side * width / 2, y + 0.23, z], false);
  });
}

/** Rooftop water tank on a steel frame, with a small access ladder. */
export function waterTank(group: THREE.Group, kit: ResidenceKit, x: number, z: number, y: number, color: number): void {
  const steel: MaterialParameters = { color: 0x6f6a62, roughness: 0.55, metalness: 0.3, tex: 'metal', rx: 1, ry: 1 };
  [-1, 1].forEach((sx) => {
    [-1, 1].forEach((sz) => {
      kit.box(group, 0.035, 0.22, 0.035, steel, [x + sx * 0.14, y + 0.11, z + sz * 0.14], false);
    });
  });
  kit.box(group, 0.38, 0.03, 0.38, steel, [x, y + 0.23, z], false);
  kit.cyl(group, 0.19, 0.19, 0.44, 12, { color, roughness: 0.66, metalness: 0.15, tex: 'metal', rx: 1, ry: 1 }, [x, y + 0.46, z]);
  kit.cyl(group, 0.015, 0.19, 0.12, 12, { color, roughness: 0.66, metalness: 0.15, tex: 'metal', rx: 1, ry: 1 }, [x, y + 0.74, z], false);
  // Ladder up the tank side.
  [-1, 1].forEach((sx) => {
    kit.box(group, 0.018, 0.42, 0.018, steel, [x + 0.21, y + 0.42, z + sx * 0.05], false);
  });
  for (let r = 0; r < 4; r += 1) {
    kit.box(group, 0.018, 0.016, 0.1, steel, [x + 0.21, y + 0.26 + r * 0.1, z], false);
  }
}

/** Wall-mounted air-conditioning unit with a fan grille. */
export function acUnit(group: THREE.Group, kit: ResidenceKit, x: number, y: number, z: number): void {
  kit.box(group, 0.28, 0.18, 0.16, { color: 0xd7d5cf, roughness: 0.7, tex: 'metal', rx: 1, ry: 1 }, [x, y, z], false);
  kit.cyl(group, 0.055, 0.055, 0.02, 10, { color: 0x8f9296, roughness: 0.5, metalness: 0.3 }, [x, y, z + 0.085], false).rotation.x = Math.PI / 2;
}

/** Sloped skylight sitting on a roof plane. */
export function skylight(group: THREE.Group, kit: ResidenceKit, x: number, z: number, y: number, w: number, d: number): void {
  const mat: MaterialParameters = { color: 0xcfe0eb, emissive: 0x395062, emissiveIntensity: 0.06, roughness: 0.12, metalness: 0.2, tex: 'window_reflection', rx: 1, ry: 1 };
  kit.box(group, w, 0.05, d, { color: 0x5a6168, roughness: 0.5, metalness: 0.35, tex: 'metal', rx: 1, ry: 1 }, [x, y + 0.02, z], false);
  const pane = kit.box(group, w * 0.82, 0.03, d * 0.78, mat, [x, y + 0.06, z], false);
  pane.rotation.x = -0.18;
  kit.box(group, w, 0.03, 0.03, { color: 0x5a6168, roughness: 0.5, metalness: 0.35 }, [x, y + 0.085, z - d / 2], false);
}

/** Simple TV aerial: mast plus two crossbars. */
export function antenna(group: THREE.Group, kit: ResidenceKit, x: number, z: number, y: number, height: number): void {
  const mat: MaterialParameters = { color: 0x9a9c9e, roughness: 0.5, metalness: 0.5, tex: 'metal', rx: 1, ry: 1 };
  kit.cyl(group, 0.012, 0.016, height, 6, mat, [x, y + height / 2, z], false);
  [0.55, 0.75, 0.9].forEach((t, index) => {
    const w = 0.34 - index * 0.08;
    kit.box(group, w, 0.012, 0.012, mat, [x, y + height * t, z], false);
  });
}

/** Turned balustrade for porches and balconies. */
export function balustrade(
  group: THREE.Group,
  kit: ResidenceKit,
  opts: { x: number; z: number; y: number; width: number; color?: number; facing?: 'front' | 'left' | 'right' | 'back' },
): void {
  const { x, z, y, width, color = 0xe7e2d6, facing = 'front' } = opts;
  const inner = kit.sub(group, x, y, z, facing);
  const mat: MaterialParameters = { color, roughness: 0.72, tex: 'stone', rx: 1, ry: 1 };
  kit.box(inner, width, 0.05, 0.08, mat, [0, 0.34, 0], false);
  kit.box(inner, width, 0.045, 0.07, mat, [0, 0.05, 0], false);
  const count = Math.max(4, Math.round(width / 0.12));
  for (let index = 0; index <= count; index += 1) {
    const px = -width / 2 + (width * index) / count;
    kit.cyl(inner, 0.022, 0.026, 0.28, 6, mat, [px, 0.19, 0], false);
  }
  [-1, 1].forEach((side) => {
    kit.box(inner, 0.09, 0.42, 0.13, mat, [side * width / 2, 0.21, 0], false);
  });
}

/** Porch column with base and capital. */
export function porchColumn(
  group: THREE.Group,
  kit: ResidenceKit,
  opts: { x: number; z: number; y: number; height: number; color?: number },
): void {
  const { x, z, y, height, color = 0xe7e2d6 } = opts;
  const mat: MaterialParameters = { color, roughness: 0.7, tex: 'wood', rx: 1, ry: 1 };
  kit.cyl(group, 0.045, 0.055, height, 8, mat, [x, y + height / 2, z]);
  kit.box(group, 0.13, 0.045, 0.13, mat, [x, y + height - 0.02, z], false);
  kit.box(group, 0.13, 0.045, 0.13, mat, [x, y + 0.02, z], false);
}

/** Small house-number plaque beside a door. */
export function houseNumber(group: THREE.Group, kit: ResidenceKit, x: number, y: number, z: number, color: number): void {
  kit.box(group, 0.11, 0.08, 0.02, { color: 0xf2efe6, roughness: 0.6 }, [x, y, z], false);
  kit.box(group, 0.025, 0.045, 0.012, { color, roughness: 0.5, metalness: 0.3 }, [x - 0.022, y, z + 0.014], false);
  kit.box(group, 0.025, 0.045, 0.012, { color, roughness: 0.5, metalness: 0.3 }, [x + 0.022, y, z + 0.014], false);
}

/** Timber doghouse with a dark arched opening and a food bowl. */
export function doghouse(
  group: THREE.Group,
  kit: ResidenceKit,
  x: number,
  z: number,
  y: number,
  color: number,
): void {
  const wood: MaterialParameters = { color, roughness: 0.86, tex: 'wood', rx: 1, ry: 1 };
  const dark: MaterialParameters = { color: 0x3a3029, roughness: 0.95 };
  const g = kit.sub(group, x, y, z, 'front');
  kit.box(g, 0.34, 0.26, 0.3, wood, [0, 0.13, 0], false);
  kit.gableRoof(g, { y: 0.26, run: 0.34, span: 0.38, height: 0.13, color: 0x6f4a3a, tex: 'residence_shingle', axis: 'x' });
  kit.box(g, 0.15, 0.16, 0.012, dark, [0, 0.09, 0.153], false);
  // Round arch above the rectangular opening.
  const arch = kit.cyl(g, 0.075, 0.075, 0.014, 10, dark, [0, 0.17, 0.152], false);
  arch.rotation.x = Math.PI / 2;
  kit.box(g, 0.12, 0.03, 0.02, { color: 0xf2efe6, roughness: 0.6 }, [0, 0.235, 0.156], false);
  // Bowl by the door.
  kit.cyl(group, 0.05, 0.038, 0.035, 10, { color: 0x8f9296, roughness: 0.4, metalness: 0.3 }, [x + 0.2, y + 0.02, z + 0.18], false);
  kit.cyl(group, 0.036, 0.036, 0.012, 10, { color: 0x7a4a33, roughness: 0.9 }, [x + 0.2, y + 0.032, z + 0.18], false);
}

/** Step-through bicycle parked against a fence. */
export function bicycle(
  group: THREE.Group,
  kit: ResidenceKit,
  x: number,
  z: number,
  y: number,
  frameColor: number,
): void {
  const g = kit.sub(group, x, y, z, 'front');
  const frame: MaterialParameters = { color: frameColor, roughness: 0.45, metalness: 0.35, tex: 'metal', rx: 1, ry: 1 };
  const rubber: MaterialParameters = { color: 0x2c2b29, roughness: 0.9 };
  const steel: MaterialParameters = { color: 0x9a9c9e, roughness: 0.4, metalness: 0.55, tex: 'metal', rx: 1, ry: 1 };
  // Wheels lie in the XY plane; the rim + hub read at street distance.
  [-0.18, 0.18].forEach((wx) => {
    const tyre = kit.cyl(g, 0.115, 0.115, 0.022, 12, rubber, [wx, 0.115, 0], false);
    tyre.rotation.x = Math.PI / 2;
    const rim = kit.cyl(g, 0.086, 0.086, 0.026, 12, steel, [wx, 0.115, 0], false);
    rim.rotation.x = Math.PI / 2;
    const hub = kit.cyl(g, 0.018, 0.018, 0.05, 8, steel, [wx, 0.115, 0], false);
    hub.rotation.x = Math.PI / 2;
  });
  kit.box(g, 0.24, 0.02, 0.02, frame, [0, 0.225, 0], false);
  const down = kit.box(g, 0.3, 0.02, 0.02, frame, [0.015, 0.16, 0], false);
  down.rotation.z = -0.32;
  kit.box(g, 0.02, 0.14, 0.02, frame, [0.1, 0.205, 0], false);
  kit.box(g, 0.02, 0.13, 0.02, frame, [-0.13, 0.2, 0], false);
  kit.box(g, 0.12, 0.025, 0.06, { color: 0x4a3a2c, roughness: 0.8, tex: 'wood', rx: 1, ry: 1 }, [0.1, 0.285, 0], false);
  kit.box(g, 0.03, 0.03, 0.18, steel, [-0.135, 0.29, 0], false);
  kit.box(g, 0.012, 0.16, 0.012, steel, [0.02, 0.13, 0.035], false);
  kit.box(g, 0.05, 0.018, 0.09, steel, [0.02, 0.045, 0.035], false);
  // Wicker basket on the handlebar.
  kit.box(g, 0.12, 0.1, 0.12, { color: 0xa9834f, roughness: 0.85, tex: 'wood', rx: 1, ry: 1 }, [-0.145, 0.29, 0], false);
}

/** Stone birdbath with a reflective water disc. */
export function birdbath(
  group: THREE.Group,
  kit: ResidenceKit,
  x: number,
  z: number,
  y: number,
  stone: number,
  scale = 1,
): void {
  const mat: MaterialParameters = { color: stone, roughness: 0.82, tex: 'stone', rx: 1, ry: 1 };
  const g = kit.sub(group, x, y, z, 'front');
  g.scale.setScalar(scale);
  kit.cyl(g, 0.07, 0.1, 0.06, 10, mat, [0, 0.03, 0], false);
  kit.cyl(g, 0.04, 0.045, 0.22, 8, mat, [0, 0.15, 0], false);
  kit.cyl(g, 0.17, 0.1, 0.06, 12, mat, [0, 0.29, 0], false);
  kit.cyl(g, 0.135, 0.135, 0.015, 12, { color: 0x5b7d86, roughness: 0.16, metalness: 0.2, tex: 'glass', rx: 1, ry: 1 }, [0, 0.315, 0], false);
}

/** Lattice garden trellis with climbing vines and blooms. */
export function gardenTrellis(
  group: THREE.Group,
  kit: ResidenceKit,
  x: number,
  z: number,
  y: number,
  width: number,
  color: number,
): void {
  const wood: MaterialParameters = { color, roughness: 0.86, tex: 'wood', rx: 1, ry: 1 };
  const g = kit.sub(group, x, y, z, 'front');
  const h = 0.52;
  [-1, 1].forEach((side) => {
    kit.box(g, 0.035, h, 0.035, wood, [side * (width / 2 - 0.02), h / 2, 0], false);
  });
  for (let i = 0; i <= 4; i += 1) {
    kit.box(g, width, 0.02, 0.02, wood, [0, 0.1 + i * 0.1, 0], false);
  }
  for (let i = 0; i < 5; i += 1) {
    const px = -width / 2 + 0.06 + i * ((width - 0.12) / 4);
    kit.box(g, 0.02, h - 0.1, 0.02, wood, [px, h / 2, 0.004], false);
  }
  // Vine clumps and flowers climbing the lattice.
  const vine: MaterialParameters = { color: 0x4f7f45, roughness: 0.93, tex: 'grass', rx: 1, ry: 1 };
  [-0.28, -0.1, 0.12, 0.3].forEach((t, index) => {
    const vy = 0.16 + (index % 3) * 0.12;
    kit.box(g, 0.11, 0.09, 0.05, vine, [t * width, vy, 0.02], false);
    kit.box(g, 0.045, 0.045, 0.045, { color: index % 2 === 0 ? 0xd06a5a : 0xe0b05a, roughness: 0.72 }, [t * width + 0.02, vy + 0.03, 0.04], false);
  });
}

/** Steel fire escape on a side wall: two landings, stair stringer and a drop ladder. */
export function fireEscape(
  group: THREE.Group,
  kit: ResidenceKit,
  opts: { x: number; z: number; baseY: number; length: number; facing?: 'left' | 'right'; floors?: number },
): void {
  const { x, z, baseY, length, facing = 'right', floors = 2 } = opts;
  const flags = (group.userData.residenceFeatures ??= []) as string[];
  if (!flags.includes('fire-escape')) flags.push('fire-escape');
  const inner = kit.sub(group, x, baseY, z, facing);
  const steel: MaterialParameters = { color: 0x454b50, roughness: 0.55, metalness: 0.4, tex: 'metal', rx: 1, ry: 1 };
  const deck: MaterialParameters = { color: 0x50565b, roughness: 0.7, metalness: 0.3, tex: 'metal', rx: 1, ry: 1 };
  const rail = 0.22;
  const out = 0.24;
  const levels = Array.from({ length: floors }, (_, index) => 0.78 + index * 0.64);
  levels.forEach((level, floor) => {
    kit.box(inner, length, 0.035, out, deck, [0, level, out / 2], false);
    // Front rail and two side rails.
    kit.box(inner, length, 0.024, 0.024, steel, [0, level + rail, out], false);
    [-1, 1].forEach((side) => {
      kit.box(inner, 0.024, rail, 0.024, steel, [side * (length / 2 - 0.02), level + rail / 2, out], false);
      kit.box(inner, 0.024, 0.024, out, steel, [side * (length / 2 - 0.02), level + rail, out / 2], false);
    });
    for (let post = 0; post <= 4; post += 1) {
      const px = -length / 2 + (length * post) / 4;
      kit.box(inner, 0.016, rail, 0.016, steel, [px, level + rail / 2, out], false);
    }
    // Angled wall braces under the landing.
    [-1, 1].forEach((side) => {
      const brace = kit.box(inner, 0.3, 0.018, 0.018, steel, [side * (length / 2 - 0.12), level - 0.14, out * 0.5], false);
      brace.rotation.z = side * 0.6;
    });
    // Stringer up to the next landing.
    if (floor < floors - 1) {
      const rise = levels[floor + 1]! - level;
      const run = 0.34;
      const angle = Math.atan2(rise, run);
      const stringer = kit.box(inner, Math.hypot(rise, run), 0.028, 0.02, steel, [0.02, level + rise / 2, out * 0.7], false);
      stringer.rotation.z = -angle;
      for (let step = 1; step < 5; step += 1) {
        const t = step / 5;
        kit.box(inner, 0.09, 0.018, out * 0.7, deck, [0.02 - run / 2 + run * t, level + rise * t, out * 0.65], false);
      }
      const hand = kit.box(inner, Math.hypot(rise, run), 0.02, 0.02, steel, [0.02, level + rise / 2 + rail, out * 0.7], false);
      hand.rotation.z = -angle;
    }
  });
  // Drop ladder from the lowest landing.
  const ladderX = length / 2 - 0.08;
  const dropTop = levels[0]! - 0.02;
  [-1, 1].forEach((side) => {
    kit.box(inner, 0.018, dropTop, 0.018, steel, [ladderX, dropTop / 2, out * 0.45 + side * 0.03], false);
  });
  for (let rung = 0; rung < 5; rung += 1) {
    kit.box(inner, 0.014, 0.014, 0.06, steel, [ladderX, 0.12 + rung * 0.14, out * 0.45], false);
  }
}
