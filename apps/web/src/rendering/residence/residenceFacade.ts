// Per-lot wall articulation. Families fix the base material, and each lot's
// variant picks a different facade treatment (quoins, belt course, wainscot,
// pilasters, downspouts) so neighbouring houses of the same family still read as
// individually built. All parts protrude from or bite into the wall with an
// explicit inset, so nothing is coplanar with the wall surface.
import type * as THREE from 'three';
import type { ResidenceKit } from './residenceKit';
import type { ResidenceFamily } from './residenceFamilies';

export type FacadeContext = {
  group: THREE.Group;
  kit: ResidenceKit;
  width: number;
  depth: number;
  height: number;
  /** Y of the wall base (top of the plinth). */
  base: number;
  family: ResidenceFamily;
  variant: number;
  /** Ground floor is a shopfront, so skip the lower cladding band. */
  storefront?: boolean;
};

export function articulateFacade(ctx: FacadeContext): void {
  const { group, kit, width, depth, height, base, family, variant, storefront = false } = ctx;
  const top = base + height;
  const frontZ = depth / 2;
  const cornice = { width, depth, y: top - 0.045, color: family.trim, tex: 'stone' as const };

  // A foundation cap is always present so every house meets the ground cleanly.
  kit.beltCourse(group, {
    width,
    depth,
    y: base + 0.03,
    color: family.plinth,
    tex: 'stone',
    height: 0.05,
    protrude: 0.028,
  });

  switch (((variant % 4) + 4) % 4) {
    case 0: {
      // Smooth render: just a cornice and a storey belt.
      kit.cornice(group, cornice);
      if (height > 1.2) {
        kit.beltCourse(group, {
          width,
          depth,
          y: base + height * 0.52,
          color: family.trim,
          tex: 'stone',
          height: 0.04,
          protrude: 0.026,
        });
      }
      break;
    }
    case 1: {
      // Masonry: alternating corner quoins plus a cornice.
      kit.quoins(group, {
        width,
        depth,
        y: base + 0.06,
        height: height - 0.08,
        color: family.trim,
        tex: 'stone',
        blocks: Math.min(5, Math.max(3, Math.round(height / 0.32))),
      });
      kit.cornice(group, cornice);
      break;
    }
    case 2: {
      // Clad lower storey with pilasters flanking the entrance.
      if (!storefront) {
        kit.wainscot(group, {
          width,
          depth,
          y: base + 0.06,
          height: height * 0.32,
          color: family.accent,
          tex: family.wallTex,
        });
      }
      const pilasterHeight = Math.min(height * 0.5, height - 0.08);
      const pilasterX = storefront ? width * 0.48 : width * 0.34;
      [-1, 1].forEach((side) => {
        kit.pilaster(group, {
          x: side * pilasterX,
          z: frontZ,
          y: base + 0.06,
          height: pilasterHeight,
          color: family.trim,
          tex: 'stone',
        });
      });
      kit.cornice(group, cornice);
      break;
    }
    default: {
      // Boarded house: belt course, cornice and metal downspouts on the corners.
      kit.beltCourse(group, {
        width,
        depth,
        y: base + height * 0.64,
        color: family.trim,
        tex: 'stone',
        height: 0.045,
        protrude: 0.03,
      });
      kit.cornice(group, cornice);
      kit.downspouts(group, [
        { x: -width / 2 - 0.045, z: frontZ - 0.05, y: base + 0.05, height: height - 0.1, color: family.accent },
        { x: width / 2 + 0.045, z: frontZ - 0.05, y: base + 0.05, height: height - 0.1, color: family.accent },
      ]);
      break;
    }
  }

  // Side-wall openings so the house reads in the round, not just from the front.
  const sideZ = -depth * 0.08;
  kit.window(group, {
    x: width / 2,
    y: base + height * 0.55,
    z: sideZ,
    facing: 'right',
    w: 0.24,
    h: 0.3,
    frameColor: family.trim,
    lit: variant % 3 === 0,
    header: true,
  });
  if (height > 1.4) {
    kit.window(group, {
      x: width / 2,
      y: base + height * 0.82,
      z: sideZ,
      facing: 'right',
      w: 0.22,
      h: 0.28,
      frameColor: family.trim,
      lit: variant % 3 === 1,
      header: true,
    });
  }
}
