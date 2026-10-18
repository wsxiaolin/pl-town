// Reusable detail geometry for resident houses. Every helper builds real 3D
// parts (frames, glass, slabs, rails, roof prisms) that protrude from or rest on
// the host wall with explicit separations — no coplanar faces, per the
// z-fighting rules in AGENTS.md. Units face +Z locally; `facing` rotates a
// sub-group so callers reason in wall-plane coordinates.
import * as THREE from 'three';
import type { MaterialParameters, MeshHelpers } from '../meshFactory';

export type ResidencePart = MeshHelpers['part'];

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
  mullions?: boolean;
  sill?: boolean;
  /** Side shutters around the pane (two solid leaves). */
  shutters?: boolean;
  shutterColor?: number;
  /** Planter box with a few blooms under the sill. */
  flowerBox?: boolean;
  flowerColor?: number;
  /** Stone header/lintel above the pane. */
  header?: boolean;
  /** Tint used for the printed reflection pane (unlit windows). */
  reflectionTint?: number;
  /** Warm curtain strips visible behind the glass. */
  curtain?: boolean;
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

export type StorefrontOptions = {
  x: number;
  y: number;
  z: number;
  facing?: Facing;
  w?: number;
  h?: number;
  awningColor?: number;
  awningColor2?: number;
  signColor?: number;
  glassColor?: number;
};

export type GableRoofOptions = {
  x?: number;
  z?: number;
  y: number;
  run: number;
  span: number;
  height: number;
  color: number;
  tex?: string;
  overhang?: number;
  axis?: 'x' | 'z';
};

export type HipRoofOptions = {
  x?: number;
  z?: number;
  y: number;
  width: number;
  depth: number;
  height: number;
  color: number;
  tex?: string;
};

export type FlatRoofOptions = {
  x?: number;
  z?: number;
  y: number;
  width: number;
  depth: number;
  parapetColor: number;
  parapetHeight?: number;
};

export type ChimneyOptions = {
  x: number;
  z: number;
  y: number;
  height?: number;
  size?: number;
  color?: number;
  /** Tall clay chimney pots on top. */
  pots?: boolean;
};

export type GutterOptions = {
  x?: number;
  z?: number;
  y: number;
  length: number;
  axis?: 'x' | 'z';
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

export type BalconyOptions = {
  x: number;
  y: number;
  z: number;
  facing?: Facing;
  width: number;
  depth?: number;
  color?: number;
  railColor?: number;
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

export type DormerOptions = {
  x: number;
  y: number;
  z: number;
  facing?: Facing;
  width?: number;
  height?: number;
  depth?: number;
  wallColor?: number;
  wallTex?: string;
  roofColor?: number;
  lit?: boolean;
};

export type PorchOptions = {
  x: number;
  z: number;
  y: number;
  width: number;
  depth: number;
  roofColor: number;
  roofTex?: string;
  postColor?: number;
  rise?: number;
};

export type QuoinOptions = {
  width: number;
  depth: number;
  y: number;
  height: number;
  color: number;
  tex?: string;
  blocks?: number;
};

export type BandOptions = {
  width: number;
  depth: number;
  y: number;
  color: number;
  tex?: string;
  height?: number;
  protrude?: number;
};

export type WainscotOptions = {
  width: number;
  depth: number;
  y: number;
  height: number;
  color: number;
  tex?: string;
};

export type PilasterOptions = {
  x: number;
  z: number;
  y: number;
  height: number;
  color: number;
  tex?: string;
  width?: number;
  depth?: number;
};

export type DownspoutOptions = {
  x: number;
  z: number;
  y: number;
  height: number;
  color?: number;
};

export type ResidenceKit = {
  plainGlass: MaterialParameters;
  litGlass: MaterialParameters;
  sub(group: THREE.Group, x: number, y: number, z: number, facing: Facing): THREE.Group;
  box(
    group: THREE.Group,
    w: number,
    h: number,
    d: number,
    material: MaterialParameters,
    position: [number, number, number],
    cast?: boolean,
  ): THREE.Mesh;
  /** Cylinder primitive for pots, columns, tanks and tree trunks. */
  cyl(
    group: THREE.Group,
    radiusTop: number,
    radiusBottom: number,
    height: number,
    segments: number,
    material: MaterialParameters,
    position: [number, number, number],
    cast?: boolean,
  ): THREE.Mesh;
  /** Icosahedron primitive used for organically-shaped foliage. */
  ico(
    group: THREE.Group,
    radius: number,
    detail: number,
    material: MaterialParameters,
    position: [number, number, number],
    scale?: [number, number, number],
    cast?: boolean,
  ): THREE.Mesh;
  body(group: THREE.Group, w: number, h: number, d: number, material: MaterialParameters, y: number): THREE.Mesh;
  window(group: THREE.Group, opts: WindowOptions): void;
  windowRow(group: THREE.Group, opts: WindowRowOptions): void;
  door(group: THREE.Group, opts: DoorOptions): void;
  storefront(group: THREE.Group, opts: StorefrontOptions): void;
  gableRoof(group: THREE.Group, opts: GableRoofOptions): void;
  hipRoof(group: THREE.Group, opts: HipRoofOptions): void;
  flatRoof(group: THREE.Group, opts: FlatRoofOptions): void;
  chimney(group: THREE.Group, opts: ChimneyOptions): void;
  gutterLine(group: THREE.Group, opts: GutterOptions): void;
  railing(group: THREE.Group, opts: RailingOptions): void;
  balcony(group: THREE.Group, opts: BalconyOptions): void;
  awning(group: THREE.Group, opts: AwningOptions): void;
  dormer(group: THREE.Group, opts: DormerOptions): void;
  porch(group: THREE.Group, opts: PorchOptions): void;
  steps(group: THREE.Group, opts: { x: number; y: number; z: number; facing?: Facing; width?: number; count?: number; color?: number }): void;
  quoins(group: THREE.Group, opts: QuoinOptions): void;
  beltCourse(group: THREE.Group, opts: BandOptions): void;
  cornice(group: THREE.Group, opts: BandOptions): void;
  wainscot(group: THREE.Group, opts: WainscotOptions): void;
  pilaster(group: THREE.Group, opts: PilasterOptions): void;
  downspouts(group: THREE.Group, opts: DownspoutOptions[]): void;
};

export type ResidenceKitOptions = {
  part: ResidencePart;
  isNight: boolean;
};

export function createResidenceKit({ part, isNight }: ResidenceKitOptions): ResidenceKit {
  const plainGlass: MaterialParameters = {
    color: 0xa9cae5,
    emissive: 0x7ea8d5,
    emissiveIntensity: isNight ? 0.16 : 0.028,
    roughness: 0.18,
    metalness: 0.1,
    tex: 'glass',
    rx: 1,
    ry: 1,
  };
  const litGlass: MaterialParameters = {
    color: 0xf4dfae,
    emissive: 0xf0b45c,
    emissiveIntensity: isNight ? 0.85 : 0.06,
    roughness: 0.2,
    metalness: 0.05,
    tex: 'glass',
    rx: 1,
    ry: 1,
  };
  // Printed reflection (sky + neighbour rooflines) so unlit panes read as glass
  // with a world behind them rather than a flat blue rectangle. Kept opaque so
  // the city batcher can instance every pane instead of issuing one draw call
  // per transparent window.
  const reflectionGlass: MaterialParameters = {
    color: 0xcfe0eb,
    emissive: 0x395062,
    emissiveIntensity: isNight ? 0.1 : 0.05,
    roughness: 0.14,
    metalness: 0.18,
    tex: 'window_reflection',
    rx: 1,
    ry: 1,
  };
  // Tinted panes are cached by colour so repeated windows reuse one material
  // instead of allocating (and defeating the batcher with) fresh parameters.
  const tintedGlass = new Map<number, MaterialParameters>();
  const glassFor = (lit?: boolean, tint?: number): MaterialParameters => {
    if (lit) return litGlass;
    if (tint === undefined) return reflectionGlass;
    let material = tintedGlass.get(tint);
    if (!material) {
      material = { ...reflectionGlass, color: tint };
      tintedGlass.set(tint, material);
    }
    return material;
  };

  function darken(color: number, amount: number): number {
    const r = Math.round(((color >> 16) & 0xff) * (1 - amount));
    const g = Math.round(((color >> 8) & 0xff) * (1 - amount));
    const b = Math.round((color & 0xff) * (1 - amount));
    return (r << 16) | (g << 8) | b;
  }

  // Lightweight provenance tags consumed by the residence visual smoke test and
  // useful when debugging a single lot from the console.
  function tag(group: THREE.Group, name: string): void {
    const flags = (group.userData.residenceFeatures ??= []) as string[];
    if (!flags.includes(name)) flags.push(name);
  }

  function sub(group: THREE.Group, x: number, y: number, z: number, facing: Facing): THREE.Group {
    const inner = new THREE.Group();
    inner.position.set(x, y, z);
    inner.rotation.y = FACING_ROTATION[facing];
    group.add(inner);
    return inner;
  }

  function box(
    group: THREE.Group,
    w: number,
    h: number,
    d: number,
    material: MaterialParameters,
    position: [number, number, number],
    cast = true,
  ): THREE.Mesh {
    return part(group, new THREE.BoxGeometry(w, h, d), material, position, cast);
  }

  function body(group: THREE.Group, w: number, h: number, d: number, material: MaterialParameters, y: number): THREE.Mesh {
    const mesh = box(group, w, h, d, material, [0, y, 0]);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    return mesh;
  }

  function cyl(
    group: THREE.Group,
    radiusTop: number,
    radiusBottom: number,
    height: number,
    segments: number,
    material: MaterialParameters,
    position: [number, number, number],
    cast = true,
  ): THREE.Mesh {
    return part(group, new THREE.CylinderGeometry(radiusTop, radiusBottom, height, segments), material, position, cast);
  }

  function ico(
    group: THREE.Group,
    radius: number,
    detail: number,
    material: MaterialParameters,
    position: [number, number, number],
    scale: [number, number, number] = [1, 1, 1],
    cast = true,
  ): THREE.Mesh {
    const mesh = part(group, new THREE.IcosahedronGeometry(radius, detail), material, position, cast);
    mesh.scale.set(scale[0], scale[1], scale[2]);
    return mesh;
  }

  function window(group: THREE.Group, opts: WindowOptions): void {
    const {
      x, y, z, facing = 'front', w = 0.32, h = 0.38, frameColor = 0xf0efec,
      lit = false, mullions = false, sill = true, shutters = false, shutterColor = 0x4f5a52,
      flowerBox = false, flowerColor = 0xd06a5a, header = true, reflectionTint, curtain = false,
    } = opts;
    const inner = sub(group, x, y, z, facing);
    tag(group, 'windows');
    if (!lit) tag(group, 'window-reflection');
    const frameMat: MaterialParameters = { color: frameColor, roughness: 0.55, tex: 'wood', rx: 1, ry: 1 };
    // The glass itself carries the printed sky/neighbour reflection.
    box(inner, w, h, 0.02, glassFor(lit, reflectionTint), [0, 0, 0.03], false);
    if (curtain) {
      tag(group, 'curtain');
      // Printed valance and side drapes, sitting just in front of the pane.
      const curtainMat: MaterialParameters = { color: lit ? 0xd8b98a : 0x9aa6ae, roughness: 0.92, tex: 'fabric', rx: 1, ry: 1 };
      box(inner, w * 0.9, h * 0.16, 0.012, curtainMat, [0, h / 2 - h * 0.1, 0.043], false);
      box(inner, w * 0.12, h * 0.62, 0.012, curtainMat, [-w * 0.4, -h * 0.08, 0.043], false);
      box(inner, w * 0.12, h * 0.62, 0.012, curtainMat, [w * 0.4, -h * 0.08, 0.043], false);
    }
    // Open frame: four solid bars around the pane.
    const ft = 0.05;
    box(inner, w + ft * 2, ft, 0.05, frameMat, [0, h / 2 + ft / 2, 0.026], false);
    box(inner, w + ft * 2, ft, 0.05, frameMat, [0, -h / 2 - ft / 2, 0.026], false);
    box(inner, ft, h, 0.05, frameMat, [-w / 2 - ft / 2, 0, 0.026], false);
    box(inner, ft, h, 0.05, frameMat, [w / 2 + ft / 2, 0, 0.026], false);
    if (mullions) {
      box(inner, 0.022, h, 0.03, frameMat, [0, 0, 0.04], false);
      box(inner, w, 0.022, 0.03, frameMat, [0, 0, 0.04], false);
    }
    if (sill) {
      box(inner, w + 0.14, 0.045, 0.11, { color: 0xd9d7d2, roughness: 0.7, tex: 'stone', rx: 1, ry: 1 }, [0, -h / 2 - 0.06, 0.045]);
    }
    if (header) {
      box(inner, w + 0.16, 0.05, 0.065, { color: 0xd9d7d2, roughness: 0.72, tex: 'stone', rx: 1, ry: 1 }, [0, h / 2 + 0.055, 0.04], false);
    }
    if (shutters) {
      tag(group, 'shutters');
      const shutterMat: MaterialParameters = { color: shutterColor, roughness: 0.7, tex: 'wood', rx: 1, ry: 2 };
      const sw = w * 0.34;
      [-1, 1].forEach((side) => {
        const sx = side * (w / 2 + ft + sw / 2 + 0.01);
        box(inner, sw, h, 0.035, shutterMat, [sx, 0, 0.02], false);
        // Routed louver slats give the shutters depth instead of a flat plank.
        for (let slat = 0; slat < 3; slat += 1) {
          const sy = -h * 0.28 + slat * h * 0.28;
          box(inner, sw * 0.82, 0.018, 0.014, { ...shutterMat, color: darken(shutterColor, 0.16) }, [sx, sy, 0.044], false);
        }
      });
    }
    if (flowerBox) {
      tag(group, 'flower-box');
      box(inner, w * 0.86, 0.09, 0.11, { color: 0x8a5a3c, roughness: 0.82, tex: 'wood', rx: 1, ry: 1 }, [0, -h / 2 - 0.135, 0.085], false);
      const bloomMat: MaterialParameters = { color: flowerColor, roughness: 0.7 };
      [-w * 0.28, -w * 0.1, w * 0.1, w * 0.28].forEach((bx, index) => {
        box(inner, 0.055, 0.06, 0.05, bloomMat, [bx, -h / 2 - 0.075, 0.09 + (index % 2) * 0.012], false);
      });
      box(inner, w * 0.78, 0.04, 0.04, { color: 0x5f8a4a, roughness: 0.9, tex: 'grass', rx: 1, ry: 1 }, [0, -h / 2 - 0.09, 0.1], false);
    }
  }

  function windowRow(group: THREE.Group, opts: WindowRowOptions): void {
    const { count, spacing, x, ...rest } = opts;
    for (let index = 0; index < count; index += 1) {
      const offset = (index - (count - 1) / 2) * spacing;
      window(group, { ...rest, x: x + offset });
    }
  }

  function door(group: THREE.Group, opts: DoorOptions): void {
    const {
      x, y, z, facing = 'front', w = 0.42, h = 0.62,
      color = 0x6a4a38, frameColor = 0x4a3a2c, step = true, canopyColor, lit = false,
    } = opts;
    const inner = sub(group, x, y, z, facing);
    box(inner, w, h, 0.045, { color, roughness: 0.62, tex: 'wood', rx: 1, ry: 2 }, [0, h / 2, 0.02], false);
    tag(group, 'doors');
    box(inner, 0.05, h + 0.06, 0.06, { color: frameColor, roughness: 0.6, tex: 'wood', rx: 1, ry: 1 }, [-w / 2 - 0.025, h / 2, 0.026], false);
    box(inner, 0.05, h + 0.06, 0.06, { color: frameColor, roughness: 0.6, tex: 'wood', rx: 1, ry: 1 }, [w / 2 + 0.025, h / 2, 0.026], false);
    box(inner, w + 0.15, 0.06, 0.06, { color: frameColor, roughness: 0.6, tex: 'wood', rx: 1, ry: 1 }, [0, h + 0.03, 0.026], false);
    box(inner, 0.022, 0.022, 0.03, { color: 0xd8b25a, roughness: 0.3, metalness: 0.6 }, [w / 2 - 0.07, h * 0.48, 0.052], false);
    if (lit) box(inner, w - 0.14, 0.03, 0.02, { color: 0xd78535, emissive: 0xd78535, emissiveIntensity: 0.6, roughness: 0.5 }, [0, 0.025, 0.05], false);
    if (h >= 0.6) {
      // Glazed transom inside the top rail, with two muntins.
      tag(group, 'transom');
      box(inner, w - 0.1, 0.11, 0.018, glassFor(lit), [0, h - 0.09, 0.054], false);
      box(inner, 0.018, 0.11, 0.022, { color: frameColor, roughness: 0.6, tex: 'wood', rx: 1, ry: 1 }, [-w * 0.18, h - 0.09, 0.058], false);
      box(inner, 0.018, 0.11, 0.022, { color: frameColor, roughness: 0.6, tex: 'wood', rx: 1, ry: 1 }, [w * 0.18, h - 0.09, 0.058], false);
    }
    // Brass kick plate at the base of the leaf.
    box(inner, w - 0.1, 0.06, 0.012, { color: 0xb08a45, roughness: 0.32, metalness: 0.55 }, [0, 0.055, 0.052], false);
    if (step) box(inner, w + 0.26, 0.06, 0.22, { color: 0xd9d7d2, roughness: 0.75, tex: 'stone', rx: 1, ry: 1 }, [0, 0.03, 0.11]);
    if (canopyColor !== undefined) {
      tag(group, 'canopy');
      const canopy = box(inner, w + 0.32, 0.04, 0.3, { color: canopyColor, roughness: 0.6, tex: 'fabric', rx: 1, ry: 1 }, [0, h + 0.14, 0.14], false);
      canopy.rotation.x = -0.28;
    }
    // Wall lantern beside the door, warm at night.
    box(inner, 0.03, 0.03, 0.09, { color: 0x4a3a2c, roughness: 0.6, metalness: 0.3 }, [w / 2 + 0.1, h + 0.14, 0.05], false);
    box(inner, 0.06, 0.1, 0.06, { color: 0xffe1a0, emissive: 0xffc86a, emissiveIntensity: lit || isNight ? 0.8 : 0.16, roughness: 0.45 }, [w / 2 + 0.1, h + 0.06, 0.07], false);
  }

  function storefront(group: THREE.Group, opts: StorefrontOptions): void {
    const {
      x, y, z, facing = 'front', w = 1.2, h = 0.62,
      awningColor = 0xc45a4a, awningColor2 = 0xf3efe6, signColor = 0x3a4a5c, glassColor = 0x8fb6d0,
    } = opts;
    const inner = sub(group, x, y, z, facing);
    tag(group, 'storefront');
    box(inner, w, h, 0.05, { color: glassColor, emissive: 0x6f9cc4, emissiveIntensity: isNight ? 0.3 : 0.03, roughness: 0.14, tex: 'glass', rx: 1, ry: 1 }, [0, h / 2, 0.03], false);
    box(inner, w + 0.1, 0.07, 0.08, { color: 0x4a3a2c, roughness: 0.6, tex: 'wood', rx: 1, ry: 1 }, [0, h + 0.035, 0.03], false);
    box(inner, 0.05, h, 0.07, { color: 0x4a3a2c, roughness: 0.6, tex: 'wood', rx: 1, ry: 1 }, [-w / 2 - 0.02, h / 2, 0.03], false);
    box(inner, 0.05, h, 0.07, { color: 0x4a3a2c, roughness: 0.6, tex: 'wood', rx: 1, ry: 1 }, [w / 2 + 0.02, h / 2, 0.03], false);
    box(inner, 0.05, h, 0.07, { color: 0x4a3a2c, roughness: 0.6, tex: 'wood', rx: 1, ry: 1 }, [0, h / 2, 0.03], false);
    // Striped awning above the glass.
    const stripes = 6;
    const stripeWidth = (w + 0.18) / stripes;
    for (let index = 0; index < stripes; index += 1) {
      const stripe = box(inner, stripeWidth - 0.01, 0.045, 0.3, { color: index % 2 === 0 ? awningColor : awningColor2, roughness: 0.55, tex: 'fabric', rx: 1, ry: 1 }, [(stripes > 1 ? (index - (stripes - 1) / 2) : 0) * stripeWidth, h + 0.12, 0.15], false);
      stripe.rotation.x = -0.32;
    }
    // Signboard on the rim above the awning.
    box(inner, w * 0.74, 0.16, 0.05, { color: signColor, roughness: 0.45, tex: 'wood', rx: 1, ry: 1 }, [0, h + 0.32, 0.04], false);
    box(inner, w * 0.56, 0.05, 0.056, { color: 0xe8c56a, emissive: 0xe8c56a, emissiveIntensity: 0.14, roughness: 0.4 }, [0, h + 0.32, 0.042], false);
  }

  function gableRoof(group: THREE.Group, opts: GableRoofOptions): void {
    tag(group, 'gable-roof');
    const { x = 0, z = 0, y, run, span, height, color, tex = 'rooftile', overhang = 0.14, axis = 'z' } = opts;
    const halfSpan = span / 2 + overhang;
    const shape = new THREE.Shape();
    shape.moveTo(-halfSpan, 0);
    shape.lineTo(halfSpan, 0);
    shape.lineTo(0, height);
    shape.closePath();
    const length = run + overhang * 2;
    const geometry = new THREE.ExtrudeGeometry(shape, { depth: length, bevelEnabled: false });
    geometry.translate(0, 0, -length / 2);
    const roof = part(group, geometry, { color, roughness: 0.74, tex, rx: 2, ry: 2 }, [x, y - 0.02, z]);
    roof.rotation.y = axis === 'x' ? Math.PI / 2 : 0;
    roof.castShadow = roof.receiveShadow = true;
    const capLength = axis === 'x' ? span + overhang * 2 : run + overhang * 2;
    const cap = box(group, 0.08, 0.05, capLength, { color: 0x4a3a2c, roughness: 0.6, tex: 'wood', rx: 1, ry: 1 }, [x, y + height - 0.01, z], false);
    if (axis === 'z') cap.rotation.y = Math.PI / 2;
  }

  function hipRoof(group: THREE.Group, opts: HipRoofOptions): void {
    tag(group, 'hip-roof');
    const { x = 0, z = 0, y, width, depth, height, color, tex = 'rooftile' } = opts;
    const roof = part(group, new THREE.ConeGeometry(Math.SQRT1_2, height, 4), { color, roughness: 0.72, tex, rx: 2, ry: 1 }, [x, y - 0.02 + height / 2, z]);
    roof.rotation.y = Math.PI / 4;
    roof.scale.set(width, 1, depth);
    roof.castShadow = roof.receiveShadow = true;
  }

  function flatRoof(group: THREE.Group, opts: FlatRoofOptions): void {
    tag(group, 'flat-roof');
    const { x = 0, z = 0, y, width, depth, parapetColor, parapetHeight = 0.18 } = opts;
    box(group, width + 0.16, 0.08, depth + 0.16, { color: 0xd4d2cc, roughness: 0.8, tex: 'concrete_worn', rx: 1, ry: 1 }, [x, y + 0.04, z]);
    const rim = 0.07;
    box(group, width + 0.2, parapetHeight, rim, { color: parapetColor, roughness: 0.7, tex: 'stone', rx: 1, ry: 1 }, [x, y + 0.08 + parapetHeight / 2, z - depth / 2 - 0.02], false);
    box(group, width + 0.2, parapetHeight, rim, { color: parapetColor, roughness: 0.7, tex: 'stone', rx: 1, ry: 1 }, [x, y + 0.08 + parapetHeight / 2, z + depth / 2 + 0.02], false);
    box(group, rim, parapetHeight, depth + 0.2, { color: parapetColor, roughness: 0.7, tex: 'stone', rx: 1, ry: 1 }, [x - width / 2 - 0.02, y + 0.08 + parapetHeight / 2, z], false);
    box(group, rim, parapetHeight, depth + 0.2, { color: parapetColor, roughness: 0.7, tex: 'stone', rx: 1, ry: 1 }, [x + width / 2 + 0.02, y + 0.08 + parapetHeight / 2, z], false);
  }

  function chimney(group: THREE.Group, opts: ChimneyOptions): void {
    tag(group, 'chimney');
    const { x, z, y, height = 0.5, size = 0.16, color = 0x8a5a48, pots = true } = opts;
    box(group, size, height, size, { color, roughness: 0.82, tex: 'brick', rx: 1, ry: 1 }, [x, y + height / 2, z]);
    box(group, size + 0.07, 0.05, size + 0.07, { color: 0x4a3a32, roughness: 0.7, tex: 'stone', rx: 1, ry: 1 }, [x, y + height + 0.025, z], false);
    if (pots) {
      const potMat: MaterialParameters = { color: 0x9a5c48, roughness: 0.85, tex: 'brick', rx: 1, ry: 1 };
      const potRadius = size * 0.24;
      const offsets = [-size * 0.18, size * 0.18];
      offsets.forEach((dx) => {
        cyl(group, potRadius, potRadius * 1.15, 0.13, 8, potMat, [x + dx, y + height + 0.11, z], false);
        cyl(group, potRadius * 0.72, potRadius * 0.72, 0.02, 8, { color: 0x2c2420, roughness: 0.95 }, [x + dx, y + height + 0.185, z], false);
      });
    }
  }

  // Horizontal eave gutter; callers add downspouts at the wall corners.
  function gutterLine(group: THREE.Group, opts: GutterOptions): void {
    tag(group, 'gutter');
    const { x = 0, z = 0, y, length, axis = 'x', color = 0x5a6168 } = opts;
    const mat: MaterialParameters = { color, roughness: 0.5, metalness: 0.35, tex: 'metal', rx: 1, ry: 1 };
    if (axis === 'x') {
      box(group, length, 0.055, 0.07, mat, [x, y, z], false);
    } else {
      box(group, 0.07, 0.055, length, mat, [x, y, z], false);
    }
  }

  function railing(group: THREE.Group, opts: RailingOptions): void {
    tag(group, 'railing');
    const { x, y, z, facing = 'front', width, height = 0.17, posts = 4, color = 0x503728 } = opts;
    const inner = sub(group, x, y, z, facing);
    box(inner, width, 0.035, 0.035, { color, roughness: 0.7, tex: 'wood', rx: 1, ry: 1 }, [0, height, 0]);
    box(inner, width, 0.026, 0.026, { color, roughness: 0.7, tex: 'wood', rx: 1, ry: 1 }, [0, 0.032, 0], false);
    for (let index = 0; index <= posts; index += 1) {
      const offset = -width / 2 + (width * index) / posts;
      box(inner, 0.028, height, 0.028, { color, roughness: 0.7, tex: 'wood', rx: 1, ry: 1 }, [offset, height / 2, 0]);
    }
  }

  function balcony(group: THREE.Group, opts: BalconyOptions): void {
    tag(group, 'balcony');
    const { x, y, z, facing = 'front', width, depth = 0.34, color = 0xcfcac0, railColor = 0x503728 } = opts;
    const inner = sub(group, x, y, z, facing);
    box(inner, width, 0.06, depth, { color, roughness: 0.78, tex: 'stone', rx: 1, ry: 1 }, [0, 0, depth / 2]);
    box(inner, width, 0.032, 0.032, { color: railColor, roughness: 0.7, tex: 'wood', rx: 1, ry: 1 }, [0, 0.2, depth], false);
    for (let index = 0; index <= 4; index += 1) {
      const offset = -width / 2 + (width * index) / 4;
      box(inner, 0.026, 0.2, 0.026, { color: railColor, roughness: 0.7, tex: 'wood', rx: 1, ry: 1 }, [offset, 0.1, depth]);
    }
    box(inner, 0.032, 0.2, depth, { color: railColor, roughness: 0.7, tex: 'wood', rx: 1, ry: 1 }, [-width / 2, 0.1, depth / 2], false);
    box(inner, 0.032, 0.2, depth, { color: railColor, roughness: 0.7, tex: 'wood', rx: 1, ry: 1 }, [width / 2, 0.1, depth / 2], false);
    if (width >= 0.62) {
      // Terracotta planter tucked into one end of the balcony.
      const px = -width / 2 + 0.16;
      box(inner, 0.16, 0.12, 0.14, { color: 0xb4664a, roughness: 0.82, tex: 'brick', rx: 1, ry: 1 }, [px, 0.12, depth * 0.55], false);
      box(inner, 0.15, 0.05, 0.13, { color: 0x5f8a4a, roughness: 0.9, tex: 'grass', rx: 1, ry: 1 }, [px, 0.2, depth * 0.55], false);
      [-0.045, 0.0, 0.045].forEach((dx, index) => {
        box(inner, 0.04, 0.05, 0.04, { color: index === 1 ? 0xe0b05a : 0xd06a5a, roughness: 0.7 }, [px + dx, 0.245, depth * 0.55], false);
      });
    }
  }

  function awning(group: THREE.Group, opts: AwningOptions): void {
    tag(group, 'awning');
    const { x, y, z, facing = 'front', width, depth = 0.32, colorA, colorB = 0xf5f4f1, stripes = 4, tilt = -0.32 } = opts;
    const inner = sub(group, x, y, z, facing);
    const stripeWidth = width / stripes;
    for (let index = 0; index < stripes; index += 1) {
      const stripe = box(inner, stripeWidth - 0.012, 0.045, depth, { color: index % 2 === 0 ? colorA : colorB, roughness: 0.55, tex: 'fabric', rx: 1, ry: 1 }, [-width / 2 + stripeWidth / 2 + index * stripeWidth, 0, depth * 0.42], false);
      stripe.rotation.x = tilt;
    }
  }

  function dormer(group: THREE.Group, opts: DormerOptions): void {
    tag(group, 'dormer');
    const { x, y, z, facing = 'front', width = 0.42, height = 0.34, depth = 0.4, wallColor = 0xf0ebdf, wallTex = 'residence_plaster', roofColor = 0x6a6f76, lit = false } = opts;
    const inner = sub(group, x, y, z, facing);
    box(inner, width, height, depth, { color: wallColor, roughness: 0.7, tex: wallTex, rx: 1, ry: 1 }, [0, height / 2, depth / 2]);
    box(inner, width * 0.6, height * 0.66, 0.03, glassFor(lit), [0, height / 2, depth + 0.015], false);
    const roof = box(inner, width + 0.14, 0.07, depth + 0.12, { color: roofColor, roughness: 0.72, tex: 'residence_shingle', rx: 1, ry: 1 }, [0, height + 0.02, depth / 2], false);
    roof.rotation.x = -0.12;
  }

  function porch(group: THREE.Group, opts: PorchOptions): void {
    tag(group, 'porch');
    const { x, z, y, width, depth, roofColor, roofTex = 'rooftile', postColor = 0xe7e2d6, rise = 0.32 } = opts;
    [-width / 2 + 0.1, width / 2 - 0.1].forEach((px) => {
      box(group, 0.09, rise, 0.09, { color: postColor, roughness: 0.7, tex: 'wood', rx: 1, ry: 1 }, [x + px, y + rise / 2, z + depth / 2 - 0.08]);
      // Potted shrub at the foot of each porch post.
      box(group, 0.12, 0.13, 0.12, { color: 0xa9614a, roughness: 0.84, tex: 'brick', rx: 1, ry: 1 }, [x + px, y + 0.065, z + depth / 2 - 0.26], false);
      box(group, 0.16, 0.12, 0.16, { color: 0x4f7d42, roughness: 0.9, tex: 'grass', rx: 1, ry: 1 }, [x + px, y + 0.19, z + depth / 2 - 0.26], false);
    });
    box(group, width, 0.06, depth, { color: 0xd8d4ca, roughness: 0.78, tex: 'stone', rx: 1, ry: 1 }, [x, y, z + depth / 2], false);
    const roof = box(group, width + 0.12, 0.08, depth + 0.16, { color: roofColor, roughness: 0.72, tex: roofTex, rx: 1, ry: 1 }, [x, y + rise + 0.04, z + depth / 2], false);
    roof.rotation.x = -0.14;
  }

  function steps(group: THREE.Group, opts: { x: number; y: number; z: number; facing?: Facing; width?: number; count?: number; color?: number }): void {
    tag(group, 'steps');
    const { x, y, z, facing = 'front', width = 0.8, count = 2, color = 0xd9d7d2 } = opts;
    const inner = sub(group, x, y, z, facing);
    for (let index = 0; index < count; index += 1) {
      box(inner, width - index * 0.08, 0.05, 0.14 * (count - index), { color, roughness: 0.75, tex: 'stone', rx: 1, ry: 1 }, [0, 0.025 + index * 0.05, 0.07 * (count - index)]);
    }
  }

  // Corner quoin blocks: alternating tall/short stones wrapping each vertical
  // corner. Centred on the corner so half sits inside the wall (no coplanar faces).
  function quoins(group: THREE.Group, opts: QuoinOptions): void {
    tag(group, 'quoins');
    const { width, depth, y, height, color, tex = 'stone', blocks = 4 } = opts;
    const step = height / blocks;
    const mat: MaterialParameters = { color, roughness: 0.76, tex, rx: 1, ry: 1 };
    for (let index = 0; index < blocks; index += 1) {
      const large = index % 2 === 0;
      const size = large ? 0.16 : 0.11;
      const cy = y + step * (index + 0.5);
      [-1, 1].forEach((sx) => {
        [-1, 1].forEach((sz) => {
          box(group, size, step * 0.86, size, mat, [sx * (width / 2), cy, sz * (depth / 2)], false);
        });
      });
    }
  }

  // Horizontal band wrapping all four walls (belt course, foundation, cornice).
  function beltCourse(group: THREE.Group, opts: BandOptions): void {
    tag(group, 'belt-course');
    const { width, depth, y, color, tex = 'stone', height = 0.05, protrude = 0.03 } = opts;
    const mat: MaterialParameters = { color, roughness: 0.74, tex, rx: 1, ry: 1 };
    const inset = 0.008;
    box(group, width + protrude * 2, height, protrude, mat, [0, y, depth / 2 + protrude / 2 - inset], false);
    box(group, width + protrude * 2, height, protrude, mat, [0, y, -depth / 2 - protrude / 2 + inset], false);
    box(group, protrude, height, depth, mat, [width / 2 + protrude / 2 - inset, y, 0], false);
    box(group, protrude, height, depth, mat, [-width / 2 - protrude / 2 + inset, y, 0], false);
  }

  function cornice(group: THREE.Group, opts: BandOptions): void {
    tag(group, 'cornice');
    beltCourse(group, { ...opts, height: opts.height ?? 0.07, protrude: opts.protrude ?? 0.065 });
  }

  // Lower-storey cladding band (wainscot / plinth cap) proud of the wall.
  function wainscot(group: THREE.Group, opts: WainscotOptions): void {
    tag(group, 'wainscot');
    const { width, depth, y, height, color, tex = 'wood' } = opts;
    const mat: MaterialParameters = { color, roughness: 0.78, tex, rx: 1, ry: 2 };
    const t = 0.02;
    box(group, width * 0.98, height, t, mat, [0, y + height / 2, depth / 2 + t / 2 - 0.007], false);
    box(group, width * 0.98, height, t, mat, [0, y + height / 2, -depth / 2 - t / 2 + 0.007], false);
    box(group, t, height, depth * 0.98, mat, [width / 2 + t / 2 - 0.007, y + height / 2, 0], false);
    box(group, t, height, depth * 0.98, mat, [-width / 2 - t / 2 + 0.007, y + height / 2, 0], false);
  }

  function pilaster(group: THREE.Group, opts: PilasterOptions): void {
    tag(group, 'pilaster');
    const { x, z, y, height, color, tex = 'stone', width = 0.08, depth = 0.06 } = opts;
    const mat: MaterialParameters = { color, roughness: 0.72, tex, rx: 1, ry: 1 };
    box(group, width, height, depth, mat, [x, y + height / 2, z], false);
    box(group, width + 0.035, 0.05, depth + 0.02, mat, [x, y + height - 0.025, z], false);
    box(group, width + 0.035, 0.05, depth + 0.02, mat, [x, y + 0.025, z], false);
  }

  function downspouts(group: THREE.Group, opts: DownspoutOptions[]): void {
    tag(group, 'downspouts');
    opts.forEach(({ x, z, y, height, color = 0x5a6168 }) => {
      const mat: MaterialParameters = { color, roughness: 0.55, metalness: 0.32, tex: 'metal', rx: 1, ry: 1 };
      box(group, 0.04, height, 0.04, mat, [x, y + height / 2, z], false);
      box(group, 0.04, 0.05, 0.15, mat, [x, y + 0.025, z + 0.055], false);
    });
  }

  return {
    plainGlass,
    litGlass,
    sub,
    box,
    body,
    cyl,
    ico,
    window,
    windowRow,
    door,
    storefront,
    gableRoof,
    hipRoof,
    flatRoof,
    chimney,
    gutterLine,
    railing,
    balcony,
    awning,
    dormer,
    porch,
    steps,
    quoins,
    beltCourse,
    cornice,
    wainscot,
    pilaster,
    downspouts,
  };
}
