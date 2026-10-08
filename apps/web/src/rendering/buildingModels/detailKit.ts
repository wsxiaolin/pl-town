// Shared detail-part kit for refined building models. Every maker builds real
// 3D geometry (frames, glass, slabs, rails) that protrudes from or sits on the
// host wall with explicit depth separations — no coplanar faces, per the
// z-fighting rules in AGENTS.md. Units face +Z locally; `facing` rotates the
// unit's sub-group so callers just pass wall-plane coordinates.
import * as THREE from 'three';
import type { BuilderContext } from './builderContext';

export type Facing = 'front' | 'back' | 'left' | 'right';

const FACING_ROTATION: Record<Facing, number> = {
  front: 0,
  right: Math.PI / 2,
  back: Math.PI,
  left: -Math.PI / 2,
};

export type WindowOptions = {
  x: number;
  y: number;
  z: number;
  facing?: Facing;
  w?: number;
  h?: number;
  frameColor?: number;
  lit?: boolean;
  sill?: boolean;
  mullions?: boolean;
};

export type WindowRowOptions = WindowOptions & { count: number; spacing: number };

export type DoorOptions = {
  x: number;
  y: number;
  z: number;
  facing?: Facing;
  w?: number;
  h?: number;
  color?: number;
  frameColor?: number;
  step?: boolean;
  canopyColor?: number;
  lit?: boolean;
};

export type AwningOptions = {
  x: number;
  y: number;
  z: number;
  facing?: Facing;
  width: number;
  depth?: number;
  colorA: number;
  colorB?: number;
  stripes?: number;
  tilt?: number;
};

export type GableRoofOptions = {
  width: number;
  depth: number;
  height: number;
  y: number;
  color?: number;
  tex?: string;
  overhang?: number;
  ridge?: 'x' | 'z';
};

export type PyramidRoofOptions = {
  width: number;
  depth: number;
  height: number;
  y: number;
  color?: number;
  tex?: string;
};

export type ChimneyOptions = {
  x: number;
  z: number;
  y: number;
  height?: number;
  size?: number;
  color?: number;
};

export type RailingOptions = {
  x: number;
  y: number;
  z: number;
  facing?: Facing;
  width: number;
  height?: number;
  posts?: number;
  color?: number;
};

export type WallSignOptions = {
  x: number;
  y: number;
  z: number;
  facing?: Facing;
  w?: number;
  h?: number;
  color?: number;
  accentColor?: number;
};

export type StepsOptions = {
  x: number;
  y: number;
  z: number;
  facing?: Facing;
  width?: number;
  count?: number;
  depth?: number;
  height?: number;
  color?: number;
};

export type LanternOptions = {
  x: number;
  y: number;
  z: number;
  cageColor?: number;
  glowColor?: number;
  intensity?: number;
};

export type BuildingDetailKit = {
  glassMaterial(): THREE.MeshStandardMaterial;
  litGlassMaterial(): THREE.MeshStandardMaterial;
  window(group: THREE.Group, opts: WindowOptions): void;
  windowRow(group: THREE.Group, opts: WindowRowOptions): void;
  door(group: THREE.Group, opts: DoorOptions): void;
  awning(group: THREE.Group, opts: AwningOptions): void;
  gableRoof(group: THREE.Group, opts: GableRoofOptions): void;
  pyramidRoof(group: THREE.Group, opts: PyramidRoofOptions): void;
  chimney(group: THREE.Group, opts: ChimneyOptions): void;
  railing(group: THREE.Group, opts: RailingOptions): void;
  wallSign(group: THREE.Group, opts: WallSignOptions): void;
  steps(group: THREE.Group, opts: StepsOptions): void;
  lantern(group: THREE.Group, opts: LanternOptions): void;
  flagpole(group: THREE.Group, x: number, z: number, height?: number, flagColor?: number): void;
  barrel(group: THREE.Group, x: number, y: number, z: number, radius?: number, color?: number): void;
  crate(group: THREE.Group, x: number, y: number, z: number, size?: number, color?: number): void;
  entryDisc(group: THREE.Group, y?: number): void;
};

export function createDetailKit(ctx: BuilderContext): BuildingDetailKit {
  const { P, part, stdMat } = ctx;

  let sharedGlass: THREE.MeshStandardMaterial | null = null;
  let sharedLitGlass: THREE.MeshStandardMaterial | null = null;

  function glassMaterial(): THREE.MeshStandardMaterial {
    if (!sharedGlass) {
      sharedGlass = stdMat({ color: 0x9fb8c8, roughness: 0.12, metalness: 0.35, transparent: true, opacity: 0.7, tex: 'glass', rx: 1, ry: 1 });
    }
    return sharedGlass;
  }

  function litGlassMaterial(): THREE.MeshStandardMaterial {
    if (!sharedLitGlass) {
      sharedLitGlass = stdMat({ color: 0xd9b26a, emissive: 0xc79b45, emissiveIntensity: 0.45, roughness: 0.24, tex: 'glass', rx: 1, ry: 1 });
    }
    return sharedLitGlass;
  }

  function oriented(group: THREE.Group, x: number, y: number, z: number, facing: Facing): THREE.Group {
    const sub = new THREE.Group();
    sub.position.set(x, y, z);
    sub.rotation.y = FACING_ROTATION[facing];
    group.add(sub);
    return sub;
  }

  function window(group: THREE.Group, opts: WindowOptions): void {
    const { x, y, z, facing = 'front', w = 0.34, h = 0.42, frameColor = 0xf0efec, lit = false, sill = true, mullions = false } = opts;
    const sub = oriented(group, x, y, z, facing);
    part(sub, ctx.rbox(w, h, 0.05), { color: frameColor, roughness: 0.5, tex: 'wood', rx: 1, ry: 1 }, [0, 0, 0.025]);
    part(sub, ctx.rbox(w - 0.06, h - 0.06, 0.02), lit ? litGlassMaterial() : glassMaterial(), [0, 0, 0.012], false);
    if (mullions) {
      part(sub, ctx.rbox(0.024, h - 0.06, 0.056), { color: frameColor, roughness: 0.5 }, [0, 0, 0.028], false);
      part(sub, ctx.rbox(w - 0.06, 0.024, 0.056), { color: frameColor, roughness: 0.5 }, [0, 0, 0.028], false);
    }
    if (sill) {
      part(sub, ctx.rbox(w + 0.08, 0.05, 0.1), { color: 0xd9d7d2, roughness: 0.7, tex: 'stone', rx: 1, ry: 1 }, [0, -h / 2 - 0.026, 0.04]);
    }
  }

  function windowRow(group: THREE.Group, opts: WindowRowOptions): void {
    const { count, spacing, x, ...rest } = opts;
    for (let i = 0; i < count; i++) {
      const offset = (i - (count - 1) / 2) * spacing;
      window(group, { ...rest, x: x + offset });
    }
  }

  function door(group: THREE.Group, opts: DoorOptions): void {
    const {
      x, y, z, facing = 'front', w = 0.44, h = 0.68,
      color = 0x6a4a38, frameColor = 0x4a3a2c, step = true, canopyColor, lit = false,
    } = opts;
    const sub = oriented(group, x, y, z, facing);
    part(sub, ctx.rbox(w, h, 0.045), { color, roughness: 0.6, tex: 'wood', rx: 1, ry: 2 }, [0, h / 2, 0.02], false);
    part(sub, ctx.rbox(0.05, h + 0.06, 0.06), { color: frameColor, roughness: 0.6, tex: 'wood', rx: 1, ry: 1 }, [-w / 2 - 0.025, h / 2, 0.025], false);
    part(sub, ctx.rbox(0.05, h + 0.06, 0.06), { color: frameColor, roughness: 0.6, tex: 'wood', rx: 1, ry: 1 }, [w / 2 + 0.025, h / 2, 0.025], false);
    part(sub, ctx.rbox(w + 0.15, 0.06, 0.06), { color: frameColor, roughness: 0.6, tex: 'wood', rx: 1, ry: 1 }, [0, h + 0.03, 0.025], false);
    part(sub, new THREE.SphereGeometry(0.022, 8, 8), { color: 0xd8b25a, roughness: 0.3, metalness: 0.6 }, [w / 2 - 0.06, h * 0.46, 0.055], false);
    if (lit) {
      part(sub, ctx.rbox(w - 0.12, 0.03, 0.02), { color: 0xd78535, emissive: 0xd78535, emissiveIntensity: 0.7, roughness: 0.5 }, [0, 0.025, 0.05], false);
    }
    if (step) {
      part(sub, ctx.rbox(w + 0.24, 0.06, 0.22), { color: 0xd9d7d2, roughness: 0.75, tex: 'stone', rx: 1, ry: 1 }, [0, 0.03, 0.11]);
    }
    if (canopyColor !== undefined) {
      const canopy = part(sub, ctx.rbox(w + 0.3, 0.04, 0.28), { color: canopyColor, roughness: 0.6, tex: 'fabric', rx: 1, ry: 1 }, [0, h + 0.12, 0.13], false);
      canopy.rotation.x = -0.3;
    }
  }

  function awning(group: THREE.Group, opts: AwningOptions): void {
    const { x, y, z, facing = 'front', width, depth = 0.34, colorA, colorB = 0xf5f4f1, stripes = 4, tilt = -0.32 } = opts;
    const sub = oriented(group, x, y, z, facing);
    const stripeWidth = width / stripes;
    for (let i = 0; i < stripes; i++) {
      const stripe = part(
        sub,
        ctx.rbox(stripeWidth - 0.012, 0.05, depth),
        { color: i % 2 === 0 ? colorA : colorB, roughness: 0.55, tex: 'fabric', rx: 1, ry: 1 },
        [-width / 2 + stripeWidth / 2 + i * stripeWidth, 0, depth * 0.42],
        false,
      );
      stripe.rotation.x = tilt;
    }
  }

  function gableRoof(group: THREE.Group, opts: GableRoofOptions): void {
    const { width, depth, height, y, color = 0x9a5a40, tex = 'rooftile', overhang = 0.16, ridge = 'x' } = opts;
    const shape = new THREE.Shape();
    const halfW = width / 2;
    shape.moveTo(-halfW, 0);
    shape.lineTo(halfW, 0);
    shape.lineTo(0, height);
    shape.closePath();
    const span = depth + overhang * 2;
    const geometry = new THREE.ExtrudeGeometry(shape, { depth: span, bevelEnabled: false });
    geometry.translate(0, 0, -span / 2);
    const roof = ctx.mk(geometry, stdMat({ color, roughness: 0.75, tex, rx: 2, ry: 2 }));
    roof.position.y = y - 0.02;
    roof.rotation.y = ridge === 'x' ? Math.PI / 2 : 0;
    roof.castShadow = roof.receiveShadow = true;
    group.add(roof);
    const capLength = ridge === 'x' ? span : width + 0.06;
    const cap = part(group, ctx.rbox(0.09, 0.05, capLength), { color: 0x4a3a2c, roughness: 0.6, tex: 'wood', rx: 1, ry: 1 }, [0, y + height - 0.005, 0], false);
    if (ridge === 'x') cap.rotation.y = Math.PI / 2;
  }

  function pyramidRoof(group: THREE.Group, opts: PyramidRoofOptions): void {
    const { width, depth, height, y, color = 0x9a5a40, tex = 'rooftile' } = opts;
    const roof = part(group, new THREE.ConeGeometry(Math.SQRT1_2, height, 4), { color, roughness: 0.7, tex, rx: 2, ry: 1 }, [0, y - 0.02 + height / 2, 0]);
    roof.rotation.y = Math.PI / 4;
    roof.scale.set(width, 1, depth);
  }

  function chimney(group: THREE.Group, opts: ChimneyOptions): void {
    const { x, z, y, height = 0.55, size = 0.18, color = 0x8a5a48 } = opts;
    part(group, ctx.rbox(size, height, size), { color, roughness: 0.8, tex: 'brick', rx: 1, ry: 1 }, [x, y + height / 2, z]);
    part(group, ctx.rbox(size + 0.07, 0.05, size + 0.07), { color: 0x4a3a32, roughness: 0.7, tex: 'stone', rx: 1, ry: 1 }, [x, y + height + 0.025, z]);
  }

  function railing(group: THREE.Group, opts: RailingOptions): void {
    const { x, y, z, facing = 'front', width, height = 0.16, posts = 4, color = 0x503728 } = opts;
    const sub = oriented(group, x, y, z, facing);
    part(sub, ctx.rbox(width, 0.035, 0.035), { color, roughness: 0.7, tex: 'wood', rx: 1, ry: 1 }, [0, height, 0]);
    part(sub, ctx.rbox(width, 0.028, 0.028), { color, roughness: 0.7, tex: 'wood', rx: 1, ry: 1 }, [0, 0.035, 0], false);
    for (let i = 0; i <= posts; i++) {
      const offset = -width / 2 + (width * i) / posts;
      part(sub, ctx.rbox(0.03, height, 0.03), { color, roughness: 0.7, tex: 'wood', rx: 1, ry: 1 }, [offset, height / 2, 0]);
    }
  }

  function wallSign(group: THREE.Group, opts: WallSignOptions): void {
    const { x, y, z, facing = 'front', w = 0.8, h = 0.3, color = 0x3a4a5c, accentColor = 0xe8c56a } = opts;
    const sub = oriented(group, x, y, z, facing);
    part(sub, ctx.rbox(w, h, 0.05), { color, roughness: 0.45, tex: 'wood', rx: 1, ry: 1 }, [0, 0, 0.03], false);
    part(sub, ctx.rbox(w * 0.72, 0.05, 0.056), { color: accentColor, roughness: 0.4, emissive: accentColor, emissiveIntensity: 0.12 }, [0, 0, 0.032], false);
  }

  function steps(group: THREE.Group, opts: StepsOptions): void {
    const { x, y, z, facing = 'front', width = 0.9, count = 2, depth = 0.15, height = 0.055, color = 0xd9d7d2 } = opts;
    const sub = oriented(group, x, y, z, facing);
    for (let i = 0; i < count; i++) {
      part(sub, ctx.rbox(width - i * 0.06, height, depth * (count - i)), { color, roughness: 0.75, tex: 'stone', rx: 1, ry: 1 }, [0, height / 2 + i * height, depth * (count - i) / 2 - depth / 2 + 0.06]);
    }
  }

  function lantern(group: THREE.Group, opts: LanternOptions): void {
    const { x, y, z, cageColor = 0x2f2f31, glowColor = 0xf0a83f, intensity = 1.0 } = opts;
    part(group, ctx.rbox(0.13, 0.2, 0.13), { color: cageColor, roughness: 0.5, tex: 'metal', rx: 1, ry: 1 }, [x, y, z], false);
    part(group, ctx.rbox(0.075, 0.13, 0.075), { color: glowColor, emissive: glowColor, emissiveIntensity: intensity, roughness: 0.4 }, [x, y, z], false);
  }

  function flagpole(group: THREE.Group, x: number, z: number, height = 2.2, flagColor = P.BLUE): void {
    part(group, new THREE.CylinderGeometry(0.025, 0.025, height, 8), { color: 0xd0cfcc, roughness: 0.5, metalness: 0.3, tex: 'metal', rx: 1, ry: 2 }, [x, height / 2, z]);
    part(group, ctx.rbox(0.42, 0.26, 0.02), { color: flagColor, emissive: flagColor, emissiveIntensity: 0.16, roughness: 0.55 }, [x + 0.23, height - 0.22, z], false);
  }

  function barrel(group: THREE.Group, x: number, y: number, z: number, radius = 0.3, color = 0x8a5c39): void {
    part(group, new THREE.CylinderGeometry(radius, radius * 0.92, radius * 1.3, 14), { color, roughness: 0.85, tex: 'wood', rx: 1, ry: 1 }, [x, y + radius * 0.65, z]);
    part(group, new THREE.TorusGeometry(radius * 0.97, 0.03, 6, 14), { color: 0x4b3526, roughness: 0.6, tex: 'metal', rx: 1, ry: 1 }, [x, y + radius * 0.65, z], false).rotation.x = Math.PI / 2;
  }

  function crate(group: THREE.Group, x: number, y: number, z: number, size = 0.36, color = 0xb8956b): void {
    part(group, ctx.rbox(size, size, size), { color, roughness: 0.75, tex: 'wood', rx: 1, ry: 1 }, [x, y + size / 2, z]);
    part(group, ctx.rbox(size + 0.02, 0.035, size + 0.02), { color: 0x8a6a48, roughness: 0.75, tex: 'wood', rx: 1, ry: 1 }, [x, y + size - 0.01, z], false);
  }

  function entryDisc(group: THREE.Group, y = ctx.PLH): void {
    // Keep the marker clear of the platform top (0.3) — coplanar depth flickers.
    part(group, new THREE.CylinderGeometry(0.14, 0.14, 0.05, 20), { color: P.BLUE, emissive: P.BLUE, emissiveIntensity: 0.28 }, [0, y + 0.05, 0], false);
  }

  return {
    glassMaterial,
    litGlassMaterial,
    window,
    windowRow,
    door,
    awning,
    gableRoof,
    pyramidRoof,
    chimney,
    railing,
    wallSign,
    steps,
    lantern,
    flagpole,
    barrel,
    crate,
    entryDisc,
  };
}
