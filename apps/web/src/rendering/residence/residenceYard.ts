// Front-yard dressing for lots that actually have setback space (the courtyard
// archetype). Props stay inside the footprint, sit on the raised plinth top and
// are chosen deterministically from the lot variant so every courtyard reads
// differently without any extra state.
import type * as THREE from 'three';
import type { ResidenceKit } from './residenceKit';
import type { ResidenceFamily } from './residenceFamilies';
import { bicycle, birdbath, doghouse, gardenTrellis, houseNumber, tree } from './residenceProps';

export type YardContext = {
  group: THREE.Group;
  kit: ResidenceKit;
  width: number;
  depth: number;
  family: ResidenceFamily;
  variant: number;
  /** Top of the plinth: the walkable courtyard floor. */
  groundY: number;
  /** Local z of the house front wall; the yard spans from here to `depth / 2`. */
  frontZ: number;
};

function flowerBed(group: THREE.Group, kit: ResidenceKit, x: number, z: number, w: number, y: number, flower: number): void {
  kit.box(group, w, 0.06, 0.2, { color: 0x6b4f3a, roughness: 0.95, tex: 'stone', rx: 1, ry: 1 }, [x, y + 0.03, z], false);
  [-0.32, -0.1, 0.12, 0.34].forEach((t, index) => {
    const bx = x + t * w;
    kit.box(group, w * 0.12, 0.09, 0.11, { color: 0x5f8a4a, roughness: 0.92, tex: 'grass', rx: 1, ry: 1 }, [bx, y + 0.08, z], false);
    kit.box(group, w * 0.08, 0.07, 0.08, { color: flower + (index % 2) * 0x000a05, roughness: 0.75 }, [bx, y + 0.14, z + (index % 2 ? 0.02 : -0.02)], false);
  });
}

function pottedPlant(group: THREE.Group, kit: ResidenceKit, x: number, z: number, y: number, scale: number): void {
  kit.box(group, 0.16 * scale, 0.15 * scale, 0.16 * scale, { color: 0xa9674a, roughness: 0.85, tex: 'stone', rx: 1, ry: 1 }, [x, y + 0.075 * scale, z], false);
  kit.box(group, 0.2 * scale, 0.16 * scale, 0.2 * scale, { color: 0x4f7f45, roughness: 0.92, tex: 'grass', rx: 1, ry: 1 }, [x, y + 0.23 * scale, z], false);
  kit.box(group, 0.12 * scale, 0.14 * scale, 0.12 * scale, { color: 0x629254, roughness: 0.92, tex: 'grass', rx: 1, ry: 1 }, [x + 0.03 * scale, y + 0.35 * scale, z - 0.02 * scale], false);
}

function bench(group: THREE.Group, kit: ResidenceKit, x: number, z: number, y: number): void {
  const wood = { color: 0x8a5a3c, roughness: 0.8, tex: 'wood', rx: 1, ry: 1 };
  kit.box(group, 0.46, 0.04, 0.16, wood, [x, y + 0.2, z], false);
  kit.box(group, 0.46, 0.18, 0.035, wood, [x, y + 0.31, z - 0.07], false);
  [-0.18, 0.18].forEach((dx) => {
    kit.box(group, 0.03, 0.2, 0.13, { color: 0x5a4636, roughness: 0.8, tex: 'metal', rx: 1, ry: 1 }, [x + dx, y + 0.1, z], false);
  });
}

function shrub(group: THREE.Group, kit: ResidenceKit, x: number, z: number, y: number, scale: number): void {
  kit.box(group, 0.22 * scale, 0.18 * scale, 0.22 * scale, { color: 0x4f7f45, roughness: 0.93, tex: 'grass', rx: 1, ry: 1 }, [x, y + 0.1 * scale, z], false);
  kit.box(group, 0.16 * scale, 0.14 * scale, 0.16 * scale, { color: 0x5f9550, roughness: 0.93, tex: 'grass', rx: 1, ry: 1 }, [x + 0.08 * scale, y + 0.2 * scale, z + 0.04 * scale], false);
  kit.box(group, 0.13 * scale, 0.12 * scale, 0.13 * scale, { color: 0x477a3f, roughness: 0.93, tex: 'grass', rx: 1, ry: 1 }, [x - 0.07 * scale, y + 0.19 * scale, z - 0.05 * scale], false);
}

function laundry(group: THREE.Group, kit: ResidenceKit, x: number, z: number, w: number, y: number, cloth: number): void {
  const post = { color: 0x6d5a45, roughness: 0.85, tex: 'wood', rx: 1, ry: 1 };
  kit.box(group, 0.03, 0.5, 0.03, post, [x - w / 2, y + 0.25, z], false);
  kit.box(group, 0.03, 0.5, 0.03, post, [x + w / 2, y + 0.25, z], false);
  kit.box(group, w, 0.014, 0.014, { color: 0xd8d2c4, roughness: 0.8 }, [x, y + 0.47, z], false);
  kit.box(group, w * 0.22, 0.2, 0.015, { color: cloth, roughness: 0.9, tex: 'fabric', rx: 1, ry: 1 }, [x - w * 0.24, y + 0.36, z], false);
  kit.box(group, w * 0.18, 0.16, 0.015, { color: 0xf2efe6, roughness: 0.9, tex: 'fabric', rx: 1, ry: 1 }, [x + w * 0.2, y + 0.38, z], false);
}

function well(group: THREE.Group, kit: ResidenceKit, x: number, z: number, y: number, family: ResidenceFamily): void {
  kit.box(group, 0.3, 0.2, 0.3, { color: family.plinth, roughness: 0.85, tex: 'stone', rx: 1, ry: 1 }, [x, y + 0.1, z], false);
  kit.box(group, 0.34, 0.04, 0.34, { color: family.trim, roughness: 0.8, tex: 'stone', rx: 1, ry: 1 }, [x, y + 0.22, z], false);
  [-1, 1].forEach((sx) => {
    kit.box(group, 0.03, 0.22, 0.03, { color: 0x6d5a45, roughness: 0.85, tex: 'wood', rx: 1, ry: 1 }, [x + sx * 0.11, y + 0.35, z], false);
  });
  const roofMat = { color: family.roof, roughness: 0.75, tex: family.roofTex, rx: 1, ry: 1 };
  const left = kit.box(group, 0.2, 0.035, 0.24, roofMat, [x - 0.09, y + 0.47, z], false);
  left.rotation.z = 0.42;
  const right = kit.box(group, 0.2, 0.035, 0.24, roofMat, [x + 0.09, y + 0.47, z], false);
  right.rotation.z = -0.42;
}

function mailbox(group: THREE.Group, kit: ResidenceKit, x: number, z: number, y: number, color: number): void {
  kit.box(group, 0.035, 0.34, 0.035, { color: 0x6d5a45, roughness: 0.85, tex: 'wood', rx: 1, ry: 1 }, [x, y + 0.17, z], false);
  kit.box(group, 0.12, 0.1, 0.17, { color, roughness: 0.55, metalness: 0.25, tex: 'metal', rx: 1, ry: 1 }, [x, y + 0.38, z], false);
}

function waterBarrel(group: THREE.Group, kit: ResidenceKit, x: number, z: number, y: number, family: ResidenceFamily): void {
  const hoop: { color: number; roughness: number; metalness: number; tex: string; rx: number; ry: number } =
    { color: 0x5a6168, roughness: 0.5, metalness: 0.35, tex: 'metal', rx: 1, ry: 1 };
  kit.cyl(group, 0.11, 0.13, 0.24, 10, { color: family.accent, roughness: 0.85, tex: 'wood', rx: 1, ry: 1 }, [x, y + 0.12, z], false);
  kit.cyl(group, 0.135, 0.135, 0.02, 10, hoop, [x, y + 0.05, z], false);
  kit.cyl(group, 0.125, 0.125, 0.02, 10, hoop, [x, y + 0.19, z], false);
  kit.cyl(group, 0.1, 0.1, 0.015, 10, { color: 0x3f5a66, roughness: 0.2, metalness: 0.2 }, [x, y + 0.245, z], false);
}

function vegetableRows(group: THREE.Group, kit: ResidenceKit, x: number, z: number, w: number, y: number): void {
  kit.box(group, w, 0.05, 0.1, { color: 0x6b4f3a, roughness: 0.95, tex: 'stone', rx: 1, ry: 1 }, [x, y + 0.025, z], false);
  const rows = 3;
  for (let r = 0; r < rows; r += 1) {
    const rx = x + (r - (rows - 1) / 2) * (w / rows);
    kit.box(group, 0.035, 0.11, 0.07, { color: 0x5f9550, roughness: 0.92, tex: 'grass', rx: 1, ry: 1 }, [rx, y + 0.1, z], false);
  }
}

export function buildYard(ctx: YardContext): void {
  const { group, kit, width, depth, family, variant, groundY, frontZ } = ctx;
  const edgeZ = depth / 2;
  const span = edgeZ - frontZ;
  if (span < 0.2) return;

  const y = groundY;
  // Paved entry path from the door to the street edge.
  const pathWidth = 0.3;
  const tiles = 3;
  const tileLen = span / tiles;
  for (let index = 0; index < tiles; index += 1) {
    const tz = frontZ + (index + 0.5) * tileLen;
    kit.box(
      group,
      pathWidth,
      0.025,
      tileLen - 0.02,
      { color: 0xcfc9bd, roughness: 0.88, tex: 'pavement', rx: 1, ry: 1 },
      [0, y + 0.0125, tz],
      false,
    );
  }

  const midZ = frontZ + span * 0.55;
  const sideX = Math.max(0.26, width * 0.3);
  const flower = variant % 2 === 0 ? 0xd06a5a : 0xd9b64e;

  switch (((variant % 4) + 4) % 4) {
    case 0:
      flowerBed(group, kit, -sideX, midZ, 0.4, y, flower);
      pottedPlant(group, kit, sideX, midZ - 0.05, y, 1);
      tree(group, kit, sideX, frontZ + 0.14, y, 0.72, variant);
      birdbath(group, kit, -sideX * 0.9, edgeZ - 0.2, y, family.plinth);
      houseNumber(group, kit, -0.2, y + 0.42, frontZ + 0.02, family.accent);
      break;
    case 1:
      bench(group, kit, -sideX, midZ, y);
      shrub(group, kit, sideX, midZ, y, 1);
      flowerBed(group, kit, sideX, edgeZ - 0.16, 0.32, y, flower);
      vegetableRows(group, kit, -sideX, edgeZ - 0.16, 0.34, y);
      doghouse(group, kit, sideX, frontZ + 0.42, y, family.accent);
      break;
    case 2:
      laundry(group, kit, 0, edgeZ - 0.12, Math.min(0.9, width * 0.7), y, flower);
      mailbox(group, kit, sideX, midZ, y, family.accent);
      waterBarrel(group, kit, -sideX, midZ, y, family);
      gardenTrellis(group, kit, -sideX, frontZ + 0.42, y, 0.52, family.trim);
      break;
    default:
      well(group, kit, -sideX, midZ, y, family);
      flowerBed(group, kit, sideX, midZ, 0.34, y, flower);
      pottedPlant(group, kit, 0, edgeZ - 0.12, y, 0.8);
      tree(group, kit, sideX, frontZ + 0.14, y, 0.72, variant + 1);
      bicycle(group, kit, -sideX, edgeZ - 0.24, y, family.accent);
      break;
  }
}
