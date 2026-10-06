// Refined civic buildings: bulletin board, laws pavilion, library, ruins,
// resident-ID altar, stats observatory, senate/commons temple, academy.
// Footprints and overall heights match the original diorama builders so plot
// clips, collision boxes and label heights stay valid.
import * as THREE from 'three';
import type { BuildingDefinition, BuildingEntity } from '../../city/buildingEntity';
import type { BuilderContext } from './builderContext';
import type { BuildingDetailKit } from './detailKit';

type ShapeBuilder = (cfg: BuildingDefinition) => BuildingEntity;

export function createCivicBuilders(ctx: BuilderContext, kit: BuildingDetailKit): Record<string, ShapeBuilder> {
  const { P, PLH, mk, part, tagMeshes } = ctx;

  // 02 BULLETIN — posting board with shingled canopy and pinned notes
  function buildBoard(cfg: BuildingDefinition): BuildingEntity {
    const g = new THREE.Group();
    part(g, new THREE.BoxGeometry(2.0, 0.15, 0.7), { color: P.BUILDING_BASE, roughness: 0.8, tex: 'stone', rx: 1, ry: 1 }, [0, 0.075, 0]);
    const boardMat = ctx.stdMat({ color: P.PARCHMENT, roughness: 0.85, tex: 'wood', rx: 1, ry: 1 });
    boardMat.emissive = new THREE.Color(P.BLUE);
    boardMat.emissiveIntensity = 0;
    [-0.6, 0.6].forEach((cx) =>
      part(g, new THREE.BoxGeometry(0.1, 1.6, 0.1), { color: 0xc4a86d, roughness: 0.7, tex: 'wood', rx: 1, ry: 2 }, [cx, 0.95, 0]));
    const board = mk(new THREE.BoxGeometry(1.5, 1.0, 0.08), boardMat);
    board.position.y = 1.25;
    board.castShadow = true;
    g.add(board);
    // Timber frame around the board + pinned notes at layered depths.
    ([[ -0.78, 1.25, 0.04, 1.08 ], [ 0.78, 1.25, 0.04, 1.08 ]] as const).forEach(([fx, fy, fw, fh]) =>
      part(g, new THREE.BoxGeometry(fw, fh, 0.1), { color: 0x8a6a48, roughness: 0.7, tex: 'wood', rx: 1, ry: 1 }, [fx, fy, 0.02]));
    part(g, new THREE.BoxGeometry(1.6, 0.05, 0.1), { color: 0x8a6a48, roughness: 0.7, tex: 'wood', rx: 1, ry: 1 }, [0, 1.77, 0.02]);
    part(g, new THREE.BoxGeometry(1.6, 0.05, 0.1), { color: 0x8a6a48, roughness: 0.7, tex: 'wood', rx: 1, ry: 1 }, [0, 0.73, 0.02]);
    part(g, new THREE.BoxGeometry(0.4, 0.3, 0.02), { color: 0xf8f4e8, roughness: 0.9 }, [-0.3, 1.35, 0.075]);
    part(g, new THREE.BoxGeometry(0.35, 0.25, 0.02), { color: 0xf5f0e0, roughness: 0.9 }, [0.25, 1.2, 0.075]);
    part(g, new THREE.BoxGeometry(0.3, 0.22, 0.02), { color: 0xefe6cc, roughness: 0.9 }, [-0.05, 0.98, 0.075]);
    // Shingled canopy over the board.
    kit.gableRoof(g, { width: 0.62, depth: 1.78, height: 0.24, y: 1.82, color: 0xb8956b, overhang: 0.02, ridge: 'x' });
    // Flower box along the base.
    part(g, new THREE.BoxGeometry(1.5, 0.14, 0.2), { color: 0x8a6a48, roughness: 0.75, tex: 'wood', rx: 1, ry: 1 }, [0, 0.24, 0.32]);
    [-0.45, -0.15, 0.15, 0.45].forEach((fx, i) =>
      part(g, new THREE.SphereGeometry(0.06, 8, 8), { color: i % 2 ? 0xe8a838 : 0xe85858, roughness: 0.8 }, [fx, 0.35, 0.32], false));
    kit.entryDisc(g, 0.15);
    g.position.set(cfg.x, 0, cfg.z);
    tagMeshes(g, cfg.id);
    return { ...cfg, group: g, body: board, bodyMat: boardMat, labelEl: null, labelY: 2.2, skipFacadeDecal: true };
  }

  // 05 LAWS — stone pavilion with pilasters, colonnade porch and flared cone roof
  function buildPavilion(cfg: BuildingDefinition): BuildingEntity {
    const g = new THREE.Group();
    const bw = 2.4, bh = 2.3;
    part(g, new THREE.BoxGeometry(3.1, 0.25, 3.1), { color: P.BUILDING_BASE, roughness: 0.8, tex: 'stone', rx: 2, ry: 2 }, [0, 0.125, 0]);
    const bodyMat = ctx.mkBodyMat('stone', 1, 1);
    const body = mk(new THREE.BoxGeometry(bw, bh, bw), bodyMat);
    body.position.y = 0.25 + bh / 2;
    body.castShadow = body.receiveShadow = true;
    g.add(body);
    // Corner pilasters frame each face.
    ([[ -1, -1 ], [ 1, -1 ], [ -1, 1 ], [ 1, 1 ]] as const).forEach(([sx, sz]) =>
      part(g, new THREE.BoxGeometry(0.16, bh, 0.16), { color: 0xe8e6e0, roughness: 0.45, tex: 'stone', rx: 1, ry: 2 }, [sx * (bw / 2 - 0.08), 0.25 + bh / 2, sz * (bw / 2 - 0.08)]));
    const frontZ = bw / 2;
    // Portico: two columns, lintel, wide steps up to a bronze double door.
    [-0.62, 0.62].forEach((cx) =>
      part(g, new THREE.CylinderGeometry(0.07, 0.085, bh * 0.72, 10), { color: 0xf8f7f5, roughness: 0.3, tex: 'stone', rx: 1, ry: 2 }, [cx, 0.25 + bh * 0.36, frontZ + 0.14]));
    part(g, new THREE.BoxGeometry(1.5, 0.09, 0.34), { color: 0xf0efec, roughness: 0.35, tex: 'stone', rx: 1, ry: 1 }, [0, 0.25 + bh * 0.72 + 0.045, frontZ + 0.14]);
    kit.door(g, { x: 0, y: 0.25, z: frontZ + 0.01, w: 0.5, h: 0.78, color: 0x7a5c38, frameColor: 0x4a3a2c, canopyColor: undefined });
    kit.steps(g, { x: 0, y: 0.25, z: frontZ + 0.16, width: 1.1, count: 2 });
    // Tall windows on the front between pilaster and door, and on both sides.
    kit.windowRow(g, { facing: 'front', x: -1.0, y: 0.25 + bh * 0.62, z: frontZ, count: 1, spacing: 0, w: 0.3, h: 0.55, mullions: true });
    kit.windowRow(g, { facing: 'front', x: 1.0, y: 0.25 + bh * 0.62, z: frontZ, count: 1, spacing: 0, w: 0.3, h: 0.55, mullions: true });
    [-1.0, 0, 1.0].forEach((ox) => {
      kit.window(g, { facing: 'left', x: -frontZ, y: 0.25 + bh * 0.62, z: ox * (bw / 2 - 0.35), w: 0.3, h: 0.5 });
      kit.window(g, { facing: 'right', x: frontZ, y: 0.25 + bh * 0.62, z: ox * (bw / 2 - 0.35), w: 0.3, h: 0.5 });
    });
    // Entablature + the original flared cone roof and finial.
    const bodyTop = 0.25 + bh;
    part(g, new THREE.BoxGeometry(bw + 0.2, 0.1, bw + 0.2), { color: P.ROOF_RIM, roughness: 0.5, tex: 'rooftile', rx: 2, ry: 2 }, [0, bodyTop + 0.05, 0]);
    const coneH = 1.05;
    part(g, new THREE.CylinderGeometry(0.08, 1.38, coneH, 24), { color: 0xf0efec, roughness: 0.35, tex: 'rooftile', rx: 3, ry: 1 }, [0, bodyTop + 0.1 + coneH / 2, 0]);
    part(g, new THREE.SphereGeometry(0.1, 12, 12), { color: P.BLUE, emissive: P.BLUE, emissiveIntensity: 0.3 }, [0, bodyTop + 0.1 + coneH + 0.1, 0], false);
    kit.lantern(g, { x: -0.9, y: 0.25 + 1.15, z: frontZ + 0.22 });
    kit.lantern(g, { x: 0.9, y: 0.25 + 1.15, z: frontZ + 0.22 });
    kit.entryDisc(g, 0.25);
    g.position.set(cfg.x, 0, cfg.z);
    tagMeshes(g, cfg.id);
    return { ...cfg, group: g, body, bodyMat, labelEl: null, labelY: bodyTop + 0.1 + coneH + 0.6, skipFacadeDecal: true };
  }

  // 06 LIBRARY — brick hall with colonnade, arched windows and dome reading room
  function buildLibrary(cfg: BuildingDefinition): BuildingEntity {
    const g = new THREE.Group();
    const bw = 3.0, bh = 2.0;
    part(g, new THREE.BoxGeometry(3.6, 0.25, 2.8), { color: P.BUILDING_BASE, roughness: 0.8, tex: 'stone', rx: 2, ry: 2 }, [0, 0.125, 0]);
    const bodyMat = ctx.mkBodyMat('brick', 2, 1);
    const body = mk(new THREE.BoxGeometry(bw, bh, bw), bodyMat);
    body.position.y = 0.25 + bh / 2;
    body.castShadow = body.receiveShadow = true;
    g.add(body);
    const frontZ = bw / 2;
    // Columned portico with tall windows between the columns.
    [-0.9, -0.3, 0.3, 0.9].forEach((cx) =>
      part(g, new THREE.CylinderGeometry(0.08, 0.09, bh * 0.9, 10), { color: 0xf8f7f5, roughness: 0.3, tex: 'stone', rx: 1, ry: 2 }, [cx, 0.25 + bh * 0.45, frontZ + 0.15]));
    [-0.6, 0.6].forEach((cx) =>
      kit.window(g, { facing: 'front', x: cx, y: 0.25 + bh * 0.52, z: frontZ, w: 0.3, h: 0.72, mullions: true }));
    kit.door(g, { x: 0, y: 0.25, z: frontZ + 0.01, w: 0.52, h: 0.8, color: 0x5a4634 });
    kit.steps(g, { x: 0, y: 0.25, z: frontZ + 0.18, width: 1.3, count: 2 });
    // Side elevations: two rows of windows each.
    [-1, 1].forEach((side) => {
      kit.windowRow(g, { facing: side < 0 ? 'left' : 'right', x: side * frontZ, y: 0.25 + bh * 0.62, z: 0, count: 3, spacing: 0.8, w: 0.3, h: 0.5 });
      kit.windowRow(g, { facing: side < 0 ? 'left' : 'right', x: side * frontZ, y: 0.25 + bh * 0.24, z: 0, count: 3, spacing: 0.8, w: 0.3, h: 0.38 });
    });
    const top = 0.25 + bh;
    part(g, new THREE.BoxGeometry(bw + 0.2, 0.1, bw + 0.2), { color: P.ROOF_RIM, roughness: 0.4, tex: 'rooftile', rx: 3, ry: 3 }, [0, top + 0.05, 0]);
    // Triangular pediment (three-sided cone, as before).
    const ped = mk(new THREE.ConeGeometry(1.55, 0.55, 3), ctx.stdMat({ color: 0xf5f4f1, roughness: 0.2, tex: 'stone', rx: 2, ry: 1 }));
    ped.rotation.y = Math.PI / 6;
    ped.position.y = top + 0.1 + 0.275;
    g.add(ped);
    // Round reading-room drum with clerestory windows + dome.
    part(g, new THREE.CylinderGeometry(0.5, 0.5, 0.7, 16), { color: 0xf0efec, roughness: 0.15, tex: 'stone', rx: 2, ry: 1 }, [0, top + 0.1 + 0.35, 0]);
    for (let i = 0; i < 4; i++) {
      const angle = (i / 4) * Math.PI * 2;
      kit.window(g, { x: Math.sin(angle) * 0.5, y: top + 0.45, z: Math.cos(angle) * 0.5, facing: Math.abs(Math.sin(angle)) > Math.abs(Math.cos(angle)) ? (Math.sin(angle) > 0 ? 'right' : 'left') : (Math.cos(angle) > 0 ? 'front' : 'back'), w: 0.16, h: 0.2, sill: false });
    }
    part(g, new THREE.SphereGeometry(0.5, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2), { color: 0xeeedea, roughness: 0.1, tex: 'rooftile', rx: 2, ry: 1 }, [0, top + 0.1 + 0.7, 0]);
    kit.entryDisc(g, 0.25);
    g.position.set(cfg.x, 0, cfg.z);
    tagMeshes(g, cfg.id);
    return { ...cfg, group: g, body, bodyMat, labelEl: null, labelY: top + 0.1 + 0.7 + 0.9, skipFacadeDecal: true };
  }

  // 07 LITREVIEW — collapsed archive: broken walls, dark window sockets, rubble
  function buildRuins(cfg: BuildingDefinition): BuildingEntity {
    const g = new THREE.Group();
    const bw = 2.2, bh = 1.6;
    part(g, new THREE.BoxGeometry(2.7, 0.22, 2.3), { color: 0x9a988e, roughness: 0.9, tex: 'ruin', rx: 2, ry: 2 }, [0, 0.11, 0]);
    const bodyMat = ctx.stdMat({ color: P.RUIN_GREY, roughness: 0.85, tex: 'ruin', rx: 1, ry: 1 });
    bodyMat.emissive = new THREE.Color(P.BLUE);
    bodyMat.emissiveIntensity = 0;
    const body = mk(new THREE.BoxGeometry(bw, bh, bw), bodyMat);
    body.position.y = 0.22 + bh / 2;
    body.castShadow = body.receiveShadow = true;
    g.add(body);
    const top = 0.22 + bh;
    // Jagged broken top — uneven blocks (kept from the original).
    part(g, new THREE.BoxGeometry(0.6, 0.4, 0.6), { color: P.RUIN_GREY, roughness: 0.85, tex: 'ruin', rx: 1, ry: 1 }, [-0.6, top + 0.2, 0]);
    part(g, new THREE.BoxGeometry(0.4, 0.25, 0.4), { color: 0xa5a29a, roughness: 0.85, tex: 'ruin', rx: 1, ry: 1 }, [0.1, top + 0.12, 0.3]);
    part(g, new THREE.BoxGeometry(0.35, 0.15, 0.35), { color: 0x9a988e, roughness: 0.85, tex: 'ruin', rx: 1, ry: 1 }, [0.7, top + 0.07, -0.2]);
    // Empty window sockets: recessed dark boxes read as blown-out openings.
    const socket = { color: 0x1c1c20, roughness: 0.95 };
    part(g, new THREE.BoxGeometry(0.4, 0.5, 0.06), socket, [-0.55, 0.22 + bh * 0.55, bw / 2 - 0.02], false);
    part(g, new THREE.BoxGeometry(0.4, 0.5, 0.06), socket, [0.55, 0.22 + bh * 0.55, bw / 2 - 0.02], false);
    part(g, new THREE.BoxGeometry(0.06, 0.5, 0.4), socket, [bw / 2 - 0.02, 0.22 + bh * 0.55, 0.3], false);
    // Cracked lintel beam across the front.
    part(g, new THREE.BoxGeometry(1.7, 0.1, 0.09), { color: 0x84826f, roughness: 0.9, tex: 'ruin', rx: 1, ry: 1 }, [0, 0.22 + bh * 0.82, bw / 2 + 0.02]);
    // Faded sign board.
    part(g, new THREE.BoxGeometry(0.8, 0.4, 0.04), { color: 0xc8c2b0, roughness: 0.9, tex: 'wood', rx: 1, ry: 1 }, [0, 0.22 + bh * 0.6, bw / 2 + 0.056]);
    // Rubble pile and overgrown vines.
    part(g, new THREE.BoxGeometry(0.3, 0.18, 0.26), { color: 0x9a988e, roughness: 0.95, tex: 'ruin', rx: 1, ry: 1 }, [1.05, 0.31, 0.7]);
    part(g, new THREE.BoxGeometry(0.22, 0.14, 0.2), { color: 0xa5a29a, roughness: 0.95, tex: 'ruin', rx: 1, ry: 1 }, [-1.0, 0.29, -0.6]);
    part(g, new THREE.SphereGeometry(0.18, 8, 8), { color: 0x8a8870, roughness: 0.95 }, [-0.8, 0.52, 0.8], false);
    part(g, new THREE.SphereGeometry(0.15, 8, 8), { color: 0x7a7860, roughness: 0.95 }, [0.9, 0.42, -0.6], false);
    if (!cfg.storyLocked) {
      part(g, new THREE.CylinderGeometry(0.12, 0.12, 0.04, 16), { color: 0x7a7a82, emissive: 0x4a4a52, emissiveIntensity: 0.1 }, [0, 0.265, 0], false);
    }
    g.position.set(cfg.x, 0, cfg.z);
    tagMeshes(g, cfg.id);
    return { ...cfg, group: g, body, bodyMat, labelEl: null, labelY: top + 0.6, skipFacadeDecal: true };
  }

  // 14 RESIDENTID — stone altar with corner pillars, arch, and steps
  function buildAltar(cfg: BuildingDefinition): BuildingEntity {
    const g = new THREE.Group();
    const bw = 2.0, bh = 1.2;
    part(g, new THREE.BoxGeometry(2.6, 0.2, 1.8), { color: 0xd4d3d0, roughness: 0.85, tex: 'stone', rx: 2, ry: 2 }, [0, 0.1, 0]);
    const bodyMat = ctx.stdMat({ color: 0xe8e7e4, roughness: 0.6, tex: 'stone', rx: 1, ry: 1 });
    bodyMat.emissive = new THREE.Color(P.BLUE);
    bodyMat.emissiveIntensity = 0;
    const body = mk(new THREE.BoxGeometry(bw, bh, bw), bodyMat);
    body.position.y = 0.2 + bh / 2;
    body.castShadow = body.receiveShadow = true;
    g.add(body);
    const top = 0.2 + bh;
    // Stone table slab, certificate, and wax seal.
    part(g, new THREE.BoxGeometry(bw + 0.4, 0.12, bw + 0.4), { color: 0xf0efec, roughness: 0.5, tex: 'stone', rx: 2, ry: 2 }, [0, top + 0.06, 0]);
    part(g, new THREE.BoxGeometry(1.2, 0.04, 0.8), { color: 0xf8f4e8, roughness: 0.9 }, [0, top + 0.14, 0], false);
    part(g, new THREE.CylinderGeometry(0.08, 0.08, 0.03, 12), { color: P.GOLD, emissive: P.GOLD, emissiveIntensity: 0.2 }, [0, top + 0.16, 0], false);
    // Corner pillars carry a name-plaque arch.
    ([[ -0.8, -0.8 ], [ -0.8, 0.8 ], [ 0.8, -0.8 ], [ 0.8, 0.8 ]] as const).forEach(([cx, cz]) =>
      part(g, new THREE.CylinderGeometry(0.07, 0.08, bh, 8), { color: 0xdedde0, roughness: 0.5 }, [cx, 0.2 + bh / 2, cz]));
    part(g, new THREE.BoxGeometry(1.6, 0.08, 0.1), { color: 0xe8e7e4, roughness: 0.5 }, [0, top + 0.5, 0]);
    part(g, new THREE.CylinderGeometry(0.04, 0.04, 0.5, 6), { color: 0xd0cfcc, roughness: 0.5 }, [-0.7, top + 0.3, 0]);
    part(g, new THREE.CylinderGeometry(0.04, 0.04, 0.5, 6), { color: 0xd0cfcc, roughness: 0.5 }, [0.7, top + 0.3, 0]);
    // Bronze plaque under the arch, facing the approach.
    kit.wallSign(g, { x: 0, y: top + 0.24, z: bw / 2 + 0.02, w: 0.9, h: 0.26, color: 0x8a6a3a, accentColor: 0xd8b25a });
    // Side niches glow faintly.
    [-1, 1].forEach((side) =>
      part(g, new THREE.BoxGeometry(0.05, 0.4, 0.26), { color: 0x3d5a78, emissive: 0x4a6fa8, emissiveIntensity: 0.18, roughness: 0.4 }, [side * (bw / 2 - 0.005), 0.2 + bh * 0.5, 0], false));
    // Quill pen on the slab.
    part(g, new THREE.CylinderGeometry(0.02, 0.02, 0.4, 6), { color: 0xe8e7e4, roughness: 0.5 }, [0.3, top + 0.32, 0.2], false);
    kit.steps(g, { x: 0, y: 0.2, z: bw / 2 + 0.05, width: 1.0, count: 2 });
    kit.entryDisc(g, 0.2);
    g.position.set(cfg.x, 0, cfg.z);
    tagMeshes(g, cfg.id);
    return { ...cfg, group: g, body, bodyMat, labelEl: null, labelY: top + 0.8, skipFacadeDecal: true };
  }

  // 15 STATS — octagonal observatory with slit dome and telescope
  function buildObservatory(cfg: BuildingDefinition): BuildingEntity {
    const g = new THREE.Group();
    part(g, new THREE.CylinderGeometry(1.65, 1.65, 0.22, 8), { color: P.BUILDING_BASE, roughness: 0.8, tex: 'stone', rx: 2, ry: 1 }, [0, 0.11, 0]);
    const bodyMat = ctx.mkBodyMat('stone', 2, 1);
    const body = mk(new THREE.CylinderGeometry(1.1, 1.22, 2.1, 8), bodyMat);
    body.position.y = 0.22 + 1.05;
    body.castShadow = body.receiveShadow = true;
    g.add(body);
    part(g, new THREE.CylinderGeometry(1.28, 1.28, 0.09, 24), { color: P.ROOF_RIM, roughness: 0.5, tex: 'rooftile', rx: 3, ry: 1 }, [0, 0.22 + 1.05, 0]);
    const bodyTop = 0.22 + 2.1;
    part(g, new THREE.CylinderGeometry(1.3, 1.3, 0.1, 24), { color: P.ROOF_RIM, roughness: 0.4, tex: 'rooftile', rx: 3, ry: 1 }, [0, bodyTop + 0.05, 0]);
    const glowMat = ctx.stdMat({ color: P.BLUE, emissive: P.BLUE, emissiveIntensity: 0.2, roughness: 0.2 });
    part(g, new THREE.CylinderGeometry(1.12, 1.12, 0.06, 24), glowMat, [0, bodyTop + 0.13, 0], false);
    const domeY = bodyTop + 0.16;
    // Slit aperture: a dark inset box cut into the dome's flank, with the
    // telescope tube poking out at an angle.
    part(g, new THREE.BoxGeometry(0.16, 0.9, 0.5), { color: 0x232830, roughness: 0.6 }, [0, domeY + 0.55, 0.86], false);
    const telescope = part(g, new THREE.CylinderGeometry(0.09, 0.12, 1.1, 10), { color: 0xd8dee2, roughness: 0.25, metalness: 0.5, tex: 'metal', rx: 1, ry: 1 }, [0, domeY + 0.75, 1.05], false);
    telescope.rotation.x = Math.PI / 3.4;
    // Drum windows around the base band.
    for (let i = 0; i < 5; i++) {
      const angle = (i / 5) * Math.PI * 2 + Math.PI / 5;
      const wx = Math.sin(angle) * 1.18;
      const wz = Math.cos(angle) * 1.18;
      const facing = Math.abs(Math.sin(angle)) > Math.abs(Math.cos(angle))
        ? (Math.sin(angle) > 0 ? 'right' : 'left')
        : (Math.cos(angle) > 0 ? 'front' : 'back');
      kit.window(g, { facing, x: wx, y: 0.22 + 1.3, z: wz, w: 0.24, h: 0.36, sill: false });
    }
    // Service door on the front facet.
    kit.door(g, { x: 0, y: 0.22, z: 1.19, facing: 'front', w: 0.4, h: 0.62, color: 0x4a5a6a });
    part(g, new THREE.SphereGeometry(1.1, 20, 10, 0, Math.PI * 2, 0, Math.PI / 2), { color: 0xf8f7f5, roughness: 0.06, metalness: 0.05, tex: 'metal', rx: 2, ry: 1 }, [0, domeY, 0]);
    kit.entryDisc(g, 0.22);
    g.position.set(cfg.x, 0, cfg.z);
    tagMeshes(g, cfg.id);
    return { ...cfg, group: g, body, bodyMat, glowMat, labelEl: null, labelY: domeY + 1.6, skipFacadeDecal: true };
  }

  // 20/21 TEMPLE — colonnaded hall with pediment, red tile roof and bronze doors
  function buildTemple(cfg: BuildingDefinition): BuildingEntity {
    const g = new THREE.Group();
    const bw = 2.8, bh = 1.8;
    part(g, new THREE.BoxGeometry(3.6, 0.25, 2.8), { color: P.BUILDING_BASE, roughness: 0.8, tex: 'stone', rx: 2, ry: 2 }, [0, 0.125, 0]);
    const bodyMat = ctx.mkBodyMat('stone', 2, 1);
    const body = mk(new THREE.BoxGeometry(bw, bh, bw), bodyMat);
    body.position.y = 0.25 + bh / 2;
    body.castShadow = body.receiveShadow = true;
    g.add(body);
    const top = 0.25 + bh;
    part(g, new THREE.BoxGeometry(bw + 0.2, 0.1, bw + 0.2), { color: P.ROOF_RIM, roughness: 0.5, tex: 'stone', rx: 3, ry: 3 }, [0, top + 0.05, 0]);
    // Peristyle columns front and back.
    [-1.1, -0.55, 0.55, 1.1].forEach((cx) => {
      part(g, new THREE.CylinderGeometry(0.08, 0.09, bh * 0.95, 12), { color: 0xf8f7f5, roughness: 0.3, tex: 'stone', rx: 1, ry: 2 }, [cx, 0.25 + bh * 0.475, bw / 2 + 0.15]);
      part(g, new THREE.CylinderGeometry(0.08, 0.09, bh * 0.95, 12), { color: 0xf8f7f5, roughness: 0.3, tex: 'stone', rx: 1, ry: 2 }, [cx, 0.25 + bh * 0.475, -bw / 2 - 0.15]);
    });
    // Triple steps up to bronze double doors.
    kit.steps(g, { x: 0, y: 0.25, z: bw / 2 + 0.42, width: 2.2, count: 3, depth: 0.16 });
    kit.door(g, { x: 0, y: 0.25 + 0.165, z: bw / 2 + 0.01, w: 0.56, h: 0.86, color: 0x8a6a3a, frameColor: 0x5a4a30, lit: true });
    // frieze windows between the door and the cornice.
    [-1.1, 0, 1.1].forEach((ox) =>
      kit.window(g, { facing: 'front', x: ox, y: 0.25 + bh * 0.62, z: bw / 2, w: 0.3, h: 0.42, sill: false }));
    // Pediment + red tile pyramid roof (original silhouette).
    const ped = mk(new THREE.ConeGeometry(1.5, 0.5, 3), ctx.stdMat({ color: 0xf5f4f1, roughness: 0.2, tex: 'stone', rx: 2, ry: 1 }));
    ped.rotation.y = Math.PI / 6;
    ped.position.y = top + 0.1 + 0.25;
    g.add(ped);
    const roof = part(g, new THREE.ConeGeometry(1.8, 0.4, 4), { color: 0xc45a4a, roughness: 0.4, tex: 'pagoda_tile', rx: 2, ry: 1 }, [0, top + 0.1 + 0.5 + 0.2, 0]);
    roof.rotation.y = Math.PI / 4;
    // Corner acroteria finish the roofline.
    ([[ -1.2, -1.2 ], [ 1.2, -1.2 ], [ -1.2, 1.2 ], [ 1.2, 1.2 ]] as const).forEach(([sx, sz]) =>
      part(g, new THREE.SphereGeometry(0.07, 8, 8), { color: 0xf0efec, roughness: 0.3 }, [sx, top + 0.12, sz], false));
    kit.entryDisc(g, 0.25);
    g.position.set(cfg.x, 0, cfg.z);
    tagMeshes(g, cfg.id);
    return { ...cfg, group: g, body, bodyMat, labelEl: null, labelY: top + 1.3, skipFacadeDecal: true };
  }

  // 09 ACADEMY(书院) — courtyard hall with gate tower and lantern-lit galleries
  function buildAcademy(cfg: BuildingDefinition): BuildingEntity {
    const g = new THREE.Group();
    const baseY = 0.22;
    part(g, new THREE.BoxGeometry(3.8, 0.18, 2.45), { color: 0xd8c9a8, roughness: 0.9, tex: 'stone', rx: 2, ry: 2 }, [0, 0.09, 0]);
    const bodyMat = ctx.mkBodyMat('academybrick', 2, 1);
    const body = mk(new THREE.BoxGeometry(2.7, 1.55, 1.55), bodyMat);
    body.position.set(0, baseY + 0.775, 0.15);
    body.castShadow = body.receiveShadow = true;
    g.add(body);
    part(g, new THREE.BoxGeometry(3.1, 0.12, 1.95), { color: 0x6a4635, roughness: 0.65, tex: 'wood', rx: 2, ry: 1 }, [0, 1.96, 0.15]);
    part(g, new THREE.BoxGeometry(3.45, 0.1, 0.18), { color: 0x3e3029, roughness: 0.6, tex: 'wood', rx: 1, ry: 1 }, [0, 2.07, 0.15]);
    // Gate tower with framed door and lantern pair.
    part(g, new THREE.BoxGeometry(0.75, 2.35, 0.55), { color: 0xa66f4e, roughness: 0.75, tex: 'academybrick', rx: 1, ry: 1 }, [0, 1.18, 1.0]);
    part(g, new THREE.ConeGeometry(0.58, 0.42, 4), { color: 0x4d382c, roughness: 0.6, tex: 'rooftile', rx: 1, ry: 1 }, [0, 2.56, 1.0]).rotation.y = Math.PI / 4;
    kit.door(g, { x: 0, y: baseY, z: 1.29, w: 0.4, h: 0.82, color: 0x4a2c23, frameColor: 0x35221a });
    kit.lantern(g, { x: -0.5, y: baseY + 1.5, z: 1.32 });
    kit.lantern(g, { x: 0.5, y: baseY + 1.5, z: 1.32 });
    // Covered side galleries with a colonnade of posts.
    [-1.45, 1.45].forEach((x) => {
      part(g, new THREE.BoxGeometry(0.45, 1.05, 1.75), { color: 0xb67b58, roughness: 0.75, tex: 'academybrick', rx: 1, ry: 1 }, [x, 0.75, 0.15]);
      part(g, new THREE.BoxGeometry(0.62, 0.12, 1.95), { color: 0x5a4030, roughness: 0.6, tex: 'wood', rx: 1, ry: 1 }, [x, 1.34, 0.15]);
      [-0.6, 0, 0.6].forEach((oz) =>
        part(g, new THREE.CylinderGeometry(0.035, 0.035, 0.62, 6), { color: 0x5a4030, roughness: 0.6, tex: 'wood', rx: 1, ry: 1 }, [x + (x > 0 ? 0.26 : -0.26), 1.03, 0.15 + oz], false));
    });
    // Hall windows: mullioned row on the front face.
    kit.windowRow(g, { facing: 'front', x: 0, y: 1.0, z: 0.925, count: 5, spacing: 0.525, w: 0.3, h: 0.38, sill: false });
    for (let i = 0; i < 5; i++) {
      const x = -1.05 + i * 0.525;
      part(g, new THREE.BoxGeometry(0.3, 0.38, 0.03), { color: 0xc7d8d4, roughness: 0.2, metalness: 0.1, tex: 'glass', rx: 1, ry: 1 }, [x, 1.0, 0.94], false);
    }
    part(g, new THREE.BoxGeometry(1.0, 0.18, 0.08), { color: 0xd6b56b, emissive: 0x8c6b31, emissiveIntensity: 0.15, roughness: 0.4, tex: 'wood', rx: 1, ry: 1 }, [0, 2.1, 1.31], false);
    kit.entryDisc(g, 0.18);
    g.position.set(cfg.x, 0, cfg.z);
    tagMeshes(g, cfg.id);
    return { ...cfg, group: g, body, bodyMat, labelEl: null, labelY: 2.65, skipFacadeDecal: true };
  }

  const builders: Record<string, ShapeBuilder> = {
    board: buildBoard,
    pavilion: buildPavilion,
    library: buildLibrary,
    ruins: buildRuins,
    altar: buildAltar,
    observatory: buildObservatory,
    temple: buildTemple,
    academy: buildAcademy,
  };
  return builders;
}
