// Refined commerce & civic-family buildings: treasury bank, kiosk/news stand,
// open-air market, shopping mall, school, academy campus, qipai grand hall and
// the banana palace. Footprints and overall heights match the original diorama
// builders in `buildingMeshFactory` so plot clips, collision boxes and label
// heights stay valid; every added detail protrudes from or embeds into the
// host wall with explicit depth separations (no coplanar faces, per AGENTS.md).
import * as THREE from 'three';
import type { BuildingDefinition, BuildingEntity } from '../../city/buildingEntity';
import type { BuilderContext } from './builderContext';
import type { BuildingDetailKit } from './detailKit';

type ShapeBuilder = (cfg: BuildingDefinition) => BuildingEntity;

export function createCommerceBuilders(ctx: BuilderContext, kit: BuildingDetailKit): Record<string, ShapeBuilder> {
  const { P, PLH, stdMat, mk, part, tagMeshes, rbox } = ctx;

  // 01 ACTIVITY — treasury bank: colonnade, arched windows, bronze doors, gold dome
  function buildBank(cfg: BuildingDefinition): BuildingEntity {
    const g = new THREE.Group();
    const bw = 2.2, bh = 1.8;
    part(g, rbox(2.8, PLH, 2.4), { color: P.BUILDING_BASE, roughness: 0.8, tex: 'stone', rx: 1, ry: 1 }, [0, PLH / 2, 0]);
    const bodyMat = ctx.mkBodyMat('stone', 1, 1);
    const body = mk(rbox(bw, bh, bw), bodyMat);
    // Leave a tiny physical separation from the dark foundation edge.
    body.position.y = PLH + bh / 2 + 0.012;
    body.castShadow = body.receiveShadow = true;
    g.add(body);
    const top = PLH + bh;
    const frontZ = bw / 2;
    // Pediment slab (kept).
    part(g, rbox(bw + 0.2, 0.1, bw + 0.2), { color: P.ROOF_RIM, roughness: 0.5, tex: 'rooftile', rx: 2, ry: 2 }, [0, top + 0.05, 0]);
    // Four front columns (kept); tall mullioned windows fill the gaps between
    // them, each capped by a half-cylinder arch bulging upward.
    [-0.7, -0.23, 0.23, 0.7].forEach((cx) =>
      part(g, new THREE.CylinderGeometry(0.07, 0.08, bh * 0.85, 10), { color: 0xf8f7f5, roughness: 0.3 }, [cx, PLH + bh * 0.425, frontZ + 0.12]));
    [-0.465, 0.465].forEach((wx) => {
      kit.window(g, { facing: 'front', x: wx, y: PLH + bh * 0.55, z: frontZ, w: 0.3, h: 0.85, mullions: true, sill: false });
      const arch = part(g, new THREE.CylinderGeometry(0.15, 0.15, 0.06, 12, 1, false, Math.PI / 2, Math.PI), { color: 0xf0efec, roughness: 0.5 }, [wx, PLH + bh * 0.55 + 0.425, frontZ + 0.03], false);
      arch.rotation.x = Math.PI / 2;
    });
    // Side elevations: two arched windows per side.
    [-1, 1].forEach((side) => {
      [-0.5, 0.5].forEach((oz) =>
        kit.window(g, { facing: side < 0 ? 'left' : 'right', x: side * frontZ, y: PLH + 0.95, z: oz, w: 0.3, h: 0.6 }));
    });
    // Bronze double door (glow seam at the threshold) with wide steps down to
    // a ground apron in front of the plinth.
    kit.door(g, { x: 0, y: PLH, z: frontZ, w: 0.5, h: 0.85, color: 0x8a6a3a, frameColor: 0x5a4630, step: false, lit: true });
    kit.steps(g, { x: 0, y: PLH, z: frontZ + 0.02, width: 1.7, count: 2, depth: 0.14 });
    part(g, rbox(1.9, 0.12, 0.44), { color: 0xd9d7d2, roughness: 0.75, tex: 'stone', rx: 1, ry: 1 }, [0, 0.06, frontZ + 0.3], false);
    // Gold dome + finial (kept silhouette).
    part(g, new THREE.SphereGeometry(0.42, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2), { color: 0xf0efec, roughness: 0.12, tex: 'metal', rx: 2, ry: 1 }, [0, top + 0.1, 0]);
    part(g, new THREE.SphereGeometry(0.07, 10, 10), { color: P.GOLD, emissive: P.GOLD, emissiveIntensity: 0.35 }, [0, top + 0.1 + 0.42 + 0.07, 0], false);
    kit.entryDisc(g, PLH);
    g.position.set(cfg.x, 0, cfg.z);
    tagMeshes(g, cfg.id);
    return { ...cfg, group: g, body, bodyMat, labelEl: null, labelY: top + 0.1 + 0.42 + 0.5, skipFacadeDecal: true };
  }

  // 10/11 KIOSK — news/mutual-aid stand: display window, counter, awning, sign
  function buildKiosk(cfg: BuildingDefinition): BuildingEntity {
    const g = new THREE.Group();
    const bw = 1.6, bh = 1.5;
    const accentColor = cfg.id === 'news' ? 0xd4a838 : 0x6b8fe8;
    part(g, rbox(2.1, 0.2, 1.8), { color: P.BUILDING_BASE, roughness: 0.8, tex: 'stone', rx: 1, ry: 1 }, [0, 0.1, 0]);
    const bodyMat = ctx.mkBodyMat('wood', 1, 1);
    const body = mk(rbox(bw, bh, bw), bodyMat);
    body.position.y = 0.2 + bh / 2;
    body.castShadow = body.receiveShadow = true;
    g.add(body);
    const top = 0.2 + bh;
    const frontZ = bw / 2;
    // Flat roof slab (kept) with a vent box standing on it.
    part(g, rbox(bw + 0.4, 0.08, bw + 0.4), { color: P.ROOF_RIM, roughness: 0.4, tex: 'rooftile', rx: 2, ry: 2 }, [0, top + 0.04, 0]);
    part(g, rbox(0.24, 0.15, 0.2), { color: 0x8a8a8e, roughness: 0.5, tex: 'metal', rx: 1, ry: 1 }, [-0.45, top + 0.145, -0.3]);
    part(g, rbox(0.3, 0.03, 0.26), { color: 0x6e747c, roughness: 0.5, tex: 'metal', rx: 1, ry: 1 }, [-0.45, top + 0.23, -0.3], false);
    // Big display window (kept) — now a real framed, mullioned unit.
    kit.window(g, { facing: 'front', x: 0, y: 0.2 + bh * 0.5, z: frontZ, w: 1.1, h: 0.7, mullions: true, sill: false });
    // Serving counter ledge reaching 0.18 out under the window.
    part(g, rbox(1.2, 0.06, 0.2), { color: 0xc4a86d, roughness: 0.65, tex: 'wood', rx: 1, ry: 1 }, [0, 0.565, frontZ + 0.08]);
    // Striped awning over the counter, back edge tucked into the wall.
    kit.awning(g, { x: 0, y: 1.42, z: frontZ + 0.02, width: 1.9, depth: 0.42, colorA: accentColor, colorB: 0xf5f4f1, stripes: 5, tilt: -0.3 });
    // Sign standing above the roof (kept, rebuilt with an accent bar).
    kit.wallSign(g, { x: 0, y: top + 0.17, z: 0, w: 0.95, h: 0.3, color: accentColor });
    // Small service hatch on the right face.
    kit.door(g, { x: frontZ, y: 0.2, z: -0.25, facing: 'right', w: 0.34, h: 0.62, color: 0x5a4634, step: false });
    // One crate beside the kiosk on the plinth.
    kit.crate(g, 0.88, 0.2, 0.32, 0.3);
    kit.entryDisc(g, 0.2);
    g.position.set(cfg.x, 0, cfg.z);
    tagMeshes(g, cfg.id);
    return { ...cfg, group: g, body, bodyMat, labelEl: null, labelY: top + 0.5, skipFacadeDecal: true };
  }

  // 17 MARKET — open-air stall: back wall with shelves, price boards, lantern
  function buildMarket(cfg: BuildingDefinition): BuildingEntity {
    const g = new THREE.Group();
    const bw = 2.6, bh = 1.6;
    part(g, rbox(3.2, 0.2, 2.2), { color: P.BUILDING_BASE, roughness: 0.8, tex: 'stone', rx: 2, ry: 1 }, [0, 0.1, 0]);
    const bodyMat = ctx.mkBodyMat('wood', 1, 1);
    [-1.1, 1.1].forEach((cx) =>
      part(g, rbox(0.1, bh, 0.1), { color: 0xc4a86d, roughness: 0.6, tex: 'wood', rx: 1, ry: 2 }, [cx, 0.2 + bh / 2, 0]));
    const body = mk(rbox(0.1, bh, 0.1), bodyMat);
    body.position.y = 0.2 + bh / 2;
    body.castShadow = body.receiveShadow = true;
    g.add(body);
    // Back stall wall with two goods shelves (spheres sit on the shelf tops).
    part(g, rbox(2.5, 1.35, 0.08), { color: 0xc4a86d, roughness: 0.65, tex: 'wood', rx: 2, ry: 1 }, [0, 0.875, -0.98]);
    [0.78, 1.18].forEach((sy) =>
      part(g, rbox(2.3, 0.05, 0.28), { color: 0xb8956b, roughness: 0.7, tex: 'wood', rx: 2, ry: 1 }, [0, sy, -0.86]));
    ([[-0.6, 0.88], [0.15, 0.89], [0.65, 1.28]] as const).forEach(([gx, gy], i) =>
      part(g, new THREE.SphereGeometry(0.075, 8, 8), { color: i % 2 ? 0xe8a838 : 0xe85858, roughness: 0.8 }, [gx, gy, -0.86], false));
    // Striped awning rebuilt with the shared kit; it spans the whole stall and
    // tilts gently so the front edge rides just above the corner poles.
    kit.awning(g, { x: 0, y: 0.2 + bh, z: -0.92, width: 2.8, depth: 2.0, colorA: 0xe8a838, colorB: 0xf5f4f1, stripes: 5, tilt: -0.12 });
    // Two corner poles carry the awning's front edge.
    [-1.3, 1.3].forEach((px) =>
      part(g, new THREE.CylinderGeometry(0.04, 0.05, 1.75, 8), { color: 0x8a6a48, roughness: 0.6, tex: 'wood', rx: 1, ry: 1 }, [px, 1.075, 0.92]));
    // Counter (kept) with two tilted price boards.
    part(g, rbox(1.4, 0.55, 0.45), { color: 0xc4a86d, roughness: 0.6, tex: 'wood', rx: 2, ry: 1 }, [0, 0.475, 0.65]);
    [-0.35, 0.35].forEach((px) => {
      const board = part(g, rbox(0.24, 0.16, 0.02), { color: 0xf8f4e8, roughness: 0.85 }, [px, 0.84, 0.6], false);
      board.rotation.x = -0.25;
    });
    // Hanging lamp: cord drops from the awning to a lit lantern.
    part(g, new THREE.CylinderGeometry(0.015, 0.015, 0.3, 6), { color: 0x3a3a3e, roughness: 0.5 }, [0, 1.68, 0.2], false);
    kit.lantern(g, { x: 0, y: 1.45, z: 0.2 });
    // Goods crates (kept).
    part(g, rbox(0.4, 0.35, 0.4), { color: 0xb8956b, roughness: 0.7, tex: 'wood', rx: 1, ry: 1 }, [-0.7, 0.375, 0.5], false);
    part(g, rbox(0.35, 0.3, 0.35), { color: 0xc4a86d, roughness: 0.7, tex: 'wood', rx: 1, ry: 1 }, [0.7, 0.35, -0.4], false);
    part(g, new THREE.SphereGeometry(0.1, 8, 8), { color: 0xe85858, roughness: 0.8 }, [-0.5, 0.75, 0.5], false);
    part(g, new THREE.SphereGeometry(0.08, 8, 8), { color: 0xe8a838, roughness: 0.8 }, [0.5, 0.7, -0.4], false);
    kit.entryDisc(g, 0.2);
    g.position.set(cfg.x, 0, cfg.z);
    tagMeshes(g, cfg.id);
    return { ...cfg, group: g, body, bodyMat, labelEl: null, labelY: 0.2 + bh + 0.5, skipFacadeDecal: true };
  }

  // 22 MALL — glass shopping center: double doors, base cladding, HVAC, pylon
  function buildMall(cfg: BuildingDefinition): BuildingEntity {
    const g = new THREE.Group();
    const bw = 3.6, bd = 2.8, bh = 2.4;
    part(g, rbox(bw + 0.6, 0.25, bd + 0.6), { color: P.BUILDING_BASE, roughness: 0.85, tex: 'pavement', rx: 2, ry: 1 }, [0, 0.125, 0]);
    const bodyMat = stdMat({ color: 0xd8e0e8, roughness: 0.08, metalness: 0.3, tex: 'mallglass', rx: 1, ry: 1 });
    bodyMat.emissive = new THREE.Color(P.BLUE);
    bodyMat.emissiveIntensity = 0;
    const body = mk(rbox(bw, bh, bd), bodyMat);
    body.position.y = 0.25 + bh / 2 + 0.012;
    body.castShadow = body.receiveShadow = true;
    g.add(body);
    const top = 0.25 + bh;
    const frontZ = bd / 2;
    // Dark cladding band around the base of the glass volume; it also covers
    // the body/plinth seam (proud of the glass by 0.03 on every face).
    part(g, rbox(bw + 0.06, 0.35, bd + 0.06), { color: P.MALL_FRAME, roughness: 0.4, metalness: 0.5, tex: 'metal', rx: 2, ry: 1 }, [0, 0.425, 0]);
    // Flat dark parapet roof (kept, lifted clear of the reflective wall).
    const roofLift = 0.025;
    part(g, rbox(bw + 0.15, 0.18, bd + 0.15), { color: P.MALL_FRAME, roughness: 0.4, metalness: 0.5, tex: 'metal', rx: 2, ry: 1 }, [0, top + 0.09 + roofLift, 0]);
    const roofTop = top + 0.18 + roofLift;
    // Rooftop billboard + posts (kept).
    const signLift = 0.02;
    const signY = top + 0.18 + 0.275 + roofLift + signLift;
    part(g, rbox(2.4, 0.55, 0.12), { color: P.MALL_SIGN, emissive: P.MALL_SIGN, emissiveIntensity: 0.22, roughness: 0.3, tex: 'fabric', rx: 2, ry: 1 }, [0, signY, frontZ - 0.3]);
    part(g, rbox(0.1, 0.55, 0.1), { color: 0x6a6a6e, roughness: 0.5, metalness: 0.3, tex: 'metal', rx: 1, ry: 1 }, [-1.0, signY, frontZ - 0.3]);
    part(g, rbox(0.1, 0.55, 0.1), { color: 0x6a6a6e, roughness: 0.5, metalness: 0.3, tex: 'metal', rx: 1, ry: 1 }, [1.0, signY, frontZ - 0.3]);
    // Two rooftop HVAC units with vent pipes, seated into the parapet top and
    // kept clear of the billboard posts.
    ([[-0.85, -0.55], [0.85, -0.55]] as const).forEach(([hx, hz]) => {
      part(g, rbox(0.55, 0.22, 0.45), { color: 0x9a9aa0, roughness: 0.5, tex: 'metal', rx: 1, ry: 1 }, [hx, roofTop + 0.1, hz]);
      part(g, new THREE.CylinderGeometry(0.05, 0.05, 0.28, 8), { color: 0x6e747c, roughness: 0.45, metalness: 0.4, tex: 'metal', rx: 1, ry: 1 }, [hx + 0.32, roofTop + 0.13, hz]);
    });
    // Entrance awning slab + support rods (kept).
    part(g, rbox(2.0, 0.08, 0.9), { color: P.MALL_SIGN, roughness: 0.5, tex: 'fabric', rx: 3, ry: 1 }, [0, 1.25, frontZ + 0.49]);
    part(g, new THREE.CylinderGeometry(0.05, 0.05, 0.9, 8), { color: 0x9a9a9e, roughness: 0.5, metalness: 0.3, tex: 'metal', rx: 1, ry: 1 }, [-0.9, 0.8, frontZ + 0.49], false).rotation.x = Math.PI / 2;
    part(g, new THREE.CylinderGeometry(0.05, 0.05, 0.9, 8), { color: 0x9a9a9e, roughness: 0.5, metalness: 0.3, tex: 'metal', rx: 1, ry: 1 }, [0.9, 0.8, frontZ + 0.49], false).rotation.x = Math.PI / 2;
    // Real double glass doors in a metal frame, all under the awning slab.
    const doorGlass = kit.glassMaterial();
    [-0.3, 0.3].forEach((dx) =>
      part(g, rbox(0.58, 0.9, 0.04), doorGlass, [dx, 0.7, frontZ + 0.07], false));
    part(g, rbox(0.06, 0.94, 0.06), { color: P.MALL_FRAME, roughness: 0.4, metalness: 0.5, tex: 'metal', rx: 1, ry: 1 }, [-0.62, 0.72, frontZ + 0.07], false);
    part(g, rbox(0.06, 0.94, 0.06), { color: P.MALL_FRAME, roughness: 0.4, metalness: 0.5, tex: 'metal', rx: 1, ry: 1 }, [0.62, 0.72, frontZ + 0.07], false);
    part(g, rbox(0.05, 0.9, 0.05), { color: P.MALL_FRAME, roughness: 0.4, metalness: 0.5, tex: 'metal', rx: 1, ry: 1 }, [0, 0.7, frontZ + 0.06], false);
    part(g, rbox(1.32, 0.06, 0.06), { color: P.MALL_FRAME, roughness: 0.4, metalness: 0.5, tex: 'metal', rx: 1, ry: 1 }, [0, 1.17, frontZ + 0.07], false);
    [-0.3, 0.3].forEach((dx) =>
      part(g, rbox(0.3, 0.04, 0.03), { color: 0x9a9a9e, roughness: 0.4, metalness: 0.6, tex: 'metal', rx: 1, ry: 1 }, [dx, 0.95, frontZ + 0.1], false));
    // Side accent windows (kept, lower band).
    for (let i = 0; i < 4; i++) {
      part(g, rbox(0.5, 0.4, 0.02), { color: 0xb8d4f0, roughness: 0.1, metalness: 0.3, tex: 'glass', rx: 1, ry: 1 }, [-1.35 + i * 0.9, 0.25 + bh * 0.55, frontZ + 0.056], false);
    }
    // Side service door on the right face, punching through the cladding.
    kit.door(g, { x: bw / 2, y: 0.25, z: 0.9, facing: 'right', w: 0.4, h: 0.68, color: 0x4a5a6a, frameColor: 0x2a3038, step: false });
    // Accent corner pylon + glowing sphere (kept).
    const pylonX = bw / 2 + 0.2;
    const pylonZ = -bd / 2 + 0.15;
    part(g, rbox(0.3, 2.8, 0.3), { color: P.MALL_FRAME, roughness: 0.4, metalness: 0.5, tex: 'metal', rx: 1, ry: 2 }, [pylonX, 0.25 + 1.4, pylonZ]);
    part(g, new THREE.SphereGeometry(0.12, 12, 12), { color: P.MALL_SIGN, emissive: P.MALL_SIGN, emissiveIntensity: 0.35 }, [pylonX, 0.25 + 2.8 + 0.12, pylonZ], false);
    kit.entryDisc(g, 0.25);
    g.position.set(cfg.x, 0, cfg.z);
    tagMeshes(g, cfg.id);
    return { ...cfg, group: g, body, bodyMat, labelEl: null, labelY: top + 0.18 + 0.55 + 0.5, skipFacadeDecal: true };
  }

  // 23 SCHOOL — brick schoolhouse: rows of framed windows, canopy, clock, gym
  function buildSchool(cfg: BuildingDefinition): BuildingEntity {
    const g = new THREE.Group();
    const bw = 3.0, bh = 1.6;
    const baseY = 0.22;
    part(g, rbox(bw + 0.6, baseY, bw + 0.6), { color: P.BUILDING_BASE, roughness: 0.85, tex: 'pavement', rx: 2, ry: 2 }, [0, baseY / 2, 0]);
    const bodyMat = ctx.mkBodyMat('schoolbrick', 2, 1);
    const body = mk(rbox(bw, bh, bw), bodyMat);
    body.position.y = baseY + bh / 2;
    body.castShadow = body.receiveShadow = true;
    g.add(body);
    const top = baseY + bh;
    const frontZ = bw / 2;
    // Pitched slate roof, ridge and front gable (kept).
    part(g, rbox(bw + 0.2, 0.1, bw + 0.2), { color: P.SCHOOL_ROOF, roughness: 0.5, tex: 'rooftile', rx: 3, ry: 3 }, [0, top + 0.05, 0]);
    part(g, new THREE.CylinderGeometry(0.05, 0.05, bw + 0.2, 8), { color: 0x4a3a2a, roughness: 0.5, tex: 'wood', rx: 2, ry: 1 }, [0, top + 0.125, 0]).rotation.z = Math.PI / 2;
    part(g, new THREE.ConeGeometry(bw / 2 + 0.1, 0.6, 4), { color: P.SCHOOL_ROOF, roughness: 0.5, tex: 'rooftile', rx: 2, ry: 1 }, [0, top + 0.4, frontZ - 0.05]).rotation.y = Math.PI / 4;
    // Entrance: framed door under a slate canopy, with steps and a small
    // clock disc mounted between the upper windows.
    kit.door(g, { x: 0, y: baseY, z: frontZ, w: 0.44, h: 0.85, color: 0x6a4a3a, frameColor: 0x4a3a2a, step: false });
    part(g, rbox(1.2, 0.05, 0.28), { color: P.SCHOOL_ROOF, roughness: 0.55, tex: 'rooftile', rx: 2, ry: 1 }, [0, 1.17, frontZ + 0.155], false);
    kit.steps(g, { x: 0, y: baseY, z: frontZ + 0.01, width: 1.0, count: 2 });
    const clock = part(g, new THREE.CylinderGeometry(0.12, 0.12, 0.04, 16), { color: 0xf8f4e8, roughness: 0.3, emissive: 0xf8f4e8, emissiveIntensity: 0.05 }, [0, 1.52, frontZ + 0.06], false);
    clock.rotation.x = Math.PI / 2;
    part(g, rbox(0.02, 0.09, 0.02), { color: 0x2a2a2a, roughness: 0.4 }, [0, 1.55, frontZ + 0.085], false);
    // Two rows of mullioned classroom windows replace the flat decals; the
    // lower pair is split around the door.
    kit.windowRow(g, { facing: 'front', x: 0, y: 1.45, z: frontZ, count: 4, spacing: 0.68, w: 0.42, h: 0.42, mullions: true, sill: false });
    [-0.85, 0.85].forEach((cx) =>
      kit.windowRow(g, { facing: 'front', x: cx, y: 0.78, z: frontZ, count: 2, spacing: 0.6, w: 0.42, h: 0.42, mullions: true }));
    // Side windows, two per side.
    [-1, 1].forEach((side) => {
      [-0.6, 0.6].forEach((oz) =>
        kit.window(g, { facing: side < 0 ? 'left' : 'right', x: side * frontZ, y: 1.05, z: oz, w: 0.36, h: 0.46, sill: false }));
    });
    // Brick chimney seated into the back roof slope.
    kit.chimney(g, { x: 0.95, z: -0.65, y: top + 0.08, height: 0.5, size: 0.2 });
    // Flagpole in front (kept).
    kit.flagpole(g, 0, frontZ + 1.0, 2.4, P.BLUE);
    // Playground (kept): sandbox, swing set and see-saw, all raised clear of
    // the ground plane.
    part(g, new THREE.CylinderGeometry(0.45, 0.45, 0.08, 12), { color: 0xe2c8a0, roughness: 0.9, tex: 'wood', rx: 1, ry: 1 }, [bw / 2 + 0.9, 0.08, -bw / 2 + 0.5], false);
    part(g, new THREE.CylinderGeometry(0.42, 0.42, 0.05, 12), { color: 0xd8c098, roughness: 0.95, tex: 'wood', rx: 1, ry: 1 }, [bw / 2 + 0.9, 0.11, -bw / 2 + 0.5], false);
    part(g, rbox(1.4, 0.06, 0.06), { color: 0x6a6a6e, roughness: 0.4, metalness: 0.4, tex: 'metal', rx: 2, ry: 1 }, [bw / 2 + 0.9, baseY + 1.2, -bw / 2 + 1.4], false);
    part(g, new THREE.CylinderGeometry(0.04, 0.04, 1.2, 8), { color: 0x6a6a6e, roughness: 0.4, metalness: 0.4, tex: 'metal', rx: 1, ry: 1 }, [bw / 2 + 0.9 - 0.65, baseY + 0.6, -bw / 2 + 1.4], false);
    part(g, new THREE.CylinderGeometry(0.04, 0.04, 1.2, 8), { color: 0x6a6a6e, roughness: 0.4, metalness: 0.4, tex: 'metal', rx: 1, ry: 1 }, [bw / 2 + 0.9 + 0.65, baseY + 0.6, -bw / 2 + 1.4], false);
    part(g, rbox(0.2, 0.3, 0.04), { color: 0xe8a838, roughness: 0.6, tex: 'wood', rx: 1, ry: 1 }, [bw / 2 + 0.9, baseY + 0.45, -bw / 2 + 1.4], false);
    part(g, rbox(1.4, 0.06, 0.18), { color: 0xe85858, roughness: 0.6, tex: 'wood', rx: 2, ry: 1 }, [bw / 2 + 1.8, baseY + 0.25, -bw / 2 + 0.4], false);
    part(g, new THREE.CylinderGeometry(0.08, 0.08, 0.25, 8), { color: 0x6a6a6e, roughness: 0.5, metalness: 0.4, tex: 'metal', rx: 1, ry: 1 }, [bw / 2 + 1.8, baseY + 0.125, -bw / 2 + 0.4], false);
    // Side wing: gym with its barrel roof (kept).
    part(g, rbox(1.4, 1.0, 1.2), { color: P.SCHOOL_BRICK, roughness: 0.4, tex: 'schoolbrick', rx: 1, ry: 1 }, [-bw / 2 - 0.9, baseY + 0.5, -bw / 2 + 0.3]);
    part(g, new THREE.CylinderGeometry(0.7, 0.7, 0.18, 16), { color: 0xc0bfbc, roughness: 0.5, tex: 'metal', rx: 3, ry: 1 }, [-bw / 2 - 0.9, baseY + 1.09, -bw / 2 + 0.3]);
    kit.entryDisc(g, baseY);
    g.position.set(cfg.x, 0, cfg.z);
    tagMeshes(g, cfg.id);
    return { ...cfg, group: g, body, bodyMat, labelEl: null, labelY: top + 0.7, skipFacadeDecal: true };
  }

  // 09 ACADEMY — campus hall with annex wing, window rows and three chimneys
  function buildCampus(cfg: BuildingDefinition): BuildingEntity {
    const g = new THREE.Group();
    const mw = 2.9, mh = 2.1, md = 2.1;
    part(g, rbox(3.6, 0.25, 2.8), { color: P.BUILDING_BASE, roughness: 0.8, tex: 'stone', rx: 2, ry: 2 }, [0, 0.125, 0]);
    const bodyMat = ctx.mkBodyMat('wall', 2, 1);
    const body = mk(rbox(mw, mh, md), bodyMat);
    body.position.y = 0.25 + mh / 2;
    body.castShadow = body.receiveShadow = true;
    g.add(body);
    const mainTop = 0.25 + mh;
    part(g, rbox(mw + 0.18, 0.1, md + 0.18), { color: P.ROOF_RIM, roughness: 0.5, tex: 'rooftile', rx: 3, ry: 3 }, [0, mainTop + 0.05, 0]);
    // Annex wing + roof slab (kept) — kept fully beyond the main facade plane.
    const aw = 1.05, ah = 1.5, ad = 1.85;
    const aX = -(mw / 2 - aw / 2), aZ = md / 2 + 0.036 + ad / 2;
    part(g, rbox(aw, ah, ad), { color: 0xfdfcfa, roughness: 0.1, tex: 'wall', rx: 1, ry: 1 }, [aX, 0.25 + ah / 2, aZ]);
    part(g, rbox(aw + 0.14, 0.08, 1.92), { color: P.ROOF_RIM, roughness: 0.5, tex: 'rooftile', rx: 2, ry: 2 }, [aX, 0.25 + ah + 0.04, md / 2 + 0.036 + 0.96]);
    // Annex entry on its right flank (over the plinth) + two front windows.
    kit.door(g, { x: aX + aw / 2, y: 0.25, z: 1.25, facing: 'right', w: 0.4, h: 0.7, color: 0x5a4634 });
    [-0.25, 0.25].forEach((ox) =>
      kit.window(g, { facing: 'front', x: aX + ox, y: 1.25, z: aZ + ad / 2, w: 0.3, h: 0.42, sill: false }));
    // Main entrance with a fabric canopy and stone steps.
    kit.door(g, { x: 0, y: 0.25, z: md / 2, w: 0.46, h: 0.8, color: 0x6a4a3a, frameColor: 0x4a3a2c, canopyColor: 0x8a4a3a });
    kit.steps(g, { x: 0, y: 0.25, z: md / 2 + 0.02, width: 1.1, count: 2 });
    // Two rows of three windows on the main front, right of the annex.
    kit.windowRow(g, { facing: 'front', x: 0.5, y: 1.5, z: md / 2, count: 3, spacing: 0.65, w: 0.4, h: 0.5 });
    kit.windowRow(g, { facing: 'front', x: 0.5, y: 2.0, z: md / 2, count: 3, spacing: 0.65, w: 0.4, h: 0.5, sill: false });
    // Side elevations: two rows of two each.
    [-1, 1].forEach((side) => {
      [-0.55, 0.55].forEach((oz) => {
        kit.window(g, { facing: side < 0 ? 'left' : 'right', x: side * (mw / 2), y: 1.2, z: oz, w: 0.36, h: 0.5 });
        kit.window(g, { facing: side < 0 ? 'left' : 'right', x: side * (mw / 2), y: 2.0, z: oz, w: 0.36, h: 0.5, sill: false });
      });
    });
    // Three chimney stacks on the main roof (kept, seated into the rim).
    ([[-0.7, 0.22], [0, 0.18], [0.75, 0.26]] as const).forEach(([rx, rh]) =>
      part(g, rbox(0.32, rh, 0.32), { color: 0xf0efec, roughness: 0.3, tex: 'stone', rx: 1, ry: 1 }, [rx, mainTop + 0.08 + rh / 2, -0.5]));
    kit.entryDisc(g, 0.25);
    g.position.set(cfg.x, 0, cfg.z);
    tagMeshes(g, cfg.id);
    return { ...cfg, group: g, body, bodyMat, labelEl: null, labelY: mainTop + 0.7, skipFacadeDecal: true };
  }

  // 31 QIPAI — 棋气派 grand hall: window arcades, corner turrets, royal statues
  function buildQipai(cfg: BuildingDefinition): BuildingEntity {
    const g = new THREE.Group();
    const bw = 6.0, bh = 4.5, bd = 6.0;
    part(g, rbox(bw + 1.0, PLH, bd + 1.0), { color: P.BUILDING_BASE, roughness: 0.8, tex: 'stone', rx: 2, ry: 2 }, [0, PLH / 2, 0]);
    const bodyMat = ctx.mkBodyMat('stone', 2, 2);
    const body = mk(rbox(bw, bh, bd), bodyMat);
    body.position.y = PLH + bh / 2 + 0.012;
    body.castShadow = true;
    body.receiveShadow = true;
    g.add(body);
    const top = PLH + bh;
    part(g, rbox(bw + 0.3, 0.3, bd + 0.3), { color: P.ROOF_RIM, roughness: 0.4, tex: 'rooftile', rx: 3, ry: 3 }, [0, top + 0.15, 0]);
    // Crenellation blocks around the roof rim (kept).
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2;
      part(g, rbox(0.4, 0.25, 0.4), { color: P.ROOF_RIM, roughness: 0.4, tex: 'rooftile', rx: 1, ry: 1 }, [Math.cos(a) * (bw / 2 + 0.15), top + 0.3, Math.sin(a) * (bd / 2 + 0.15)], false);
    }
    // Window arcade: a glazed band divided by stone mullions reads as four
    // tall windows per row while keeping the mesh budget flat. Lower rows glow
    // warm; sills only on the ground row.
    const arcade = (
      facing: 'front' | 'left' | 'right',
      wx: number, wz: number, cy: number, halfSpan: number, h: number,
      sill: boolean, lit: boolean, mids: readonly number[],
    ): void => {
      const sub = new THREE.Group();
      sub.position.set(wx, cy, wz);
      sub.rotation.y = facing === 'front' ? 0 : facing === 'right' ? Math.PI / 2 : -Math.PI / 2;
      g.add(sub);
      part(sub, rbox(halfSpan * 2, h, 0.05), lit ? kit.litGlassMaterial() : kit.glassMaterial(), [0, 0, 0.02], false);
      mids.forEach((mx) =>
        part(sub, rbox(0.1, h + 0.08, 0.1), { color: 0xd8d6d0, roughness: 0.5, tex: 'stone', rx: 1, ry: 1 }, [mx, 0, 0.03], false));
      if (sill) {
        part(sub, rbox(halfSpan * 2 + 0.16, 0.09, 0.14), { color: 0xd9d7d2, roughness: 0.7, tex: 'stone', rx: 1, ry: 1 }, [0, -h / 2 - 0.045, 0.04], false);
      }
    };
    // Two rows of four per side.
    ([['left', -bw / 2], ['right', bw / 2]] as const).forEach(([face, wx]) => {
      arcade(face, wx, 0, PLH + 2.2, 2.4, 1.3, true, true, [-1.2, 0, 1.2]);
      arcade(face, wx, 0, PLH + 3.7, 2.4, 1.3, false, false, [-1.2, 0, 1.2]);
    });
    // Front: full four-bay band up top; below, two two-bay groups flank the
    // grand entrance (their sills double as entrance thresholds).
    arcade('front', 0, bd / 2, PLH + 3.7, 2.4, 1.3, false, false, [-1.2, 0, 1.2]);
    [-1.6, 1.6].forEach((gx) => arcade('front', gx, bd / 2, PLH + 2.2, 0.8, 1.3, true, true, [0]));
    // King statue (kept).
    const kingG = new THREE.Group();
    part(kingG, new THREE.CylinderGeometry(0.35, 0.4, 0.15, 16), { color: 0x2a2a2e, roughness: 0.3, metalness: 0.4 }, [0, 0.075, 0]);
    part(kingG, new THREE.CylinderGeometry(0.22, 0.32, 1.2, 16), { color: 0x2a2a2e, roughness: 0.3, metalness: 0.4 }, [0, 0.15 + 0.6, 0]);
    part(kingG, new THREE.CylinderGeometry(0.3, 0.25, 0.12, 16), { color: 0x2a2a2e, roughness: 0.3, metalness: 0.4 }, [0, 0.15 + 1.2 + 0.06, 0]);
    part(kingG, new THREE.CylinderGeometry(0.18, 0.2, 0.35, 16), { color: 0x2a2a2e, roughness: 0.3, metalness: 0.4 }, [0, 0.15 + 1.2 + 0.12 + 0.175, 0]);
    part(kingG, new THREE.SphereGeometry(0.15, 12, 8), { color: 0xe8a838, roughness: 0.2, metalness: 0.5, emissive: 0xe8a838, emissiveIntensity: 0.1 }, [0, 0.15 + 1.2 + 0.12 + 0.35 + 0.15, 0], false);
    kingG.position.set(-bw / 2 - 0.8, 0, bd / 2 + 0.3);
    kingG.traverse((c: THREE.Object3D) => { if ('isMesh' in c && c.isMesh) c.castShadow = true; });
    g.add(kingG);
    // Queen statue (kept).
    const queenG = new THREE.Group();
    part(queenG, new THREE.CylinderGeometry(0.35, 0.4, 0.15, 16), { color: 0xf8f7f5, roughness: 0.3, metalness: 0.4 }, [0, 0.075, 0]);
    part(queenG, new THREE.CylinderGeometry(0.22, 0.32, 1.2, 16), { color: 0xf8f7f5, roughness: 0.3, metalness: 0.4 }, [0, 0.15 + 0.6, 0]);
    part(queenG, new THREE.CylinderGeometry(0.28, 0.25, 0.12, 16), { color: 0xf8f7f5, roughness: 0.3, metalness: 0.4 }, [0, 0.15 + 1.2 + 0.06, 0]);
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * Math.PI * 2 - Math.PI / 2;
      part(queenG, new THREE.ConeGeometry(0.06, 0.2, 6), { color: 0xf8f7f5, roughness: 0.3, metalness: 0.4 }, [Math.cos(a) * 0.18, 0.15 + 1.2 + 0.12 + 0.1, Math.sin(a) * 0.18], false);
    }
    queenG.position.set(bw / 2 + 0.8, 0, bd / 2 + 0.3);
    queenG.traverse((c: THREE.Object3D) => { if ('isMesh' in c && c.isMesh) c.castShadow = true; });
    g.add(queenG);
    // Grand entrance: stone frame (kept) with a real double door, small canopy
    // and wide steps that end at the plinth edge.
    part(g, rbox(1.8, 0.1, 0.1), { color: P.ROOF_RIM, roughness: 0.4, tex: 'stone', rx: 1, ry: 1 }, [0, PLH + 1.8, bd / 2 + 0.086], false);
    part(g, rbox(0.3, 1.8, 0.1), { color: 0x2a2a2e, roughness: 0.3, tex: 'stone', rx: 1, ry: 1 }, [-0.9, PLH + 0.9, bd / 2 + 0.086], false);
    part(g, rbox(0.3, 1.8, 0.1), { color: 0x2a2a2e, roughness: 0.3, tex: 'stone', rx: 1, ry: 1 }, [0.9, PLH + 0.9, bd / 2 + 0.086], false);
    [-0.31, 0.31].forEach((dx) => {
      part(g, rbox(0.56, 1.5, 0.05), { color: 0x5a4634, roughness: 0.55, tex: 'wood', rx: 1, ry: 2 }, [dx, PLH + 0.75, bd / 2 + 0.05], false);
      part(g, new THREE.SphereGeometry(0.035, 8, 8), { color: P.GOLD, emissive: P.GOLD, emissiveIntensity: 0.2, roughness: 0.3, metalness: 0.6 }, [dx + (dx > 0 ? -0.2 : 0.2), PLH + 0.72, bd / 2 + 0.085], false);
    });
    part(g, rbox(0.06, 1.5, 0.06), { color: 0x2a2a2e, roughness: 0.35, tex: 'metal', rx: 1, ry: 1 }, [0, PLH + 0.75, bd / 2 + 0.055], false);
    part(g, rbox(1.9, 0.07, 0.34), { color: P.ROOF_RIM, roughness: 0.45, tex: 'stone', rx: 1, ry: 1 }, [0, PLH + 1.98, bd / 2 + 0.12], false);
    kit.steps(g, { x: 0, y: PLH, z: bd / 2 + 0.02, width: 2.2, count: 3, depth: 0.15 });
    // Checker floor path (kept).
    for (let r = 0; r < 4; r++) for (let c = 0; c < 4; c++) {
      const cw = 0.4, cx = -1.5 + c * cw + cw / 2, cz = bd / 2 + 0.3 + r * cw + cw / 2;
      part(g, rbox(cw - 0.02, 0.02, cw - 0.02), { color: (r + c) % 2 === 0 ? 0x2a2a2e : 0xf8f7f5, roughness: 0.3 }, [cx, PLH + 0.035, cz], false);
    }
    // Four corner turrets: small boxes with 4-segment cone caps, seated into
    // the roof rim so no base faces are coplanar with it.
    ([[-1, -1], [1, -1], [-1, 1], [1, 1]] as const).forEach(([sx, sz]) => {
      part(g, rbox(0.4, 0.7, 0.4), { color: P.ROOF_RIM, roughness: 0.4, tex: 'rooftile', rx: 1, ry: 1 }, [sx * 2.75, top + 0.63, sz * 2.75]);
      part(g, new THREE.ConeGeometry(0.34, 0.3, 4), { color: 0x4d382c, roughness: 0.55, tex: 'rooftile', rx: 1, ry: 1 }, [sx * 2.75, top + 1.12, sz * 2.75]).rotation.y = Math.PI / 4;
    });
    kit.entryDisc(g, PLH);
    g.position.set(cfg.x, 0, cfg.z);
    tagMeshes(g, cfg.id);
    return { ...cfg, group: g, body, bodyMat, labelEl: null, labelY: top + 0.3 + 0.25 + 0.5, skipFacadeDecal: true };
  }

  // 30 BANANA PALACE — 布拿拉宫 (ported verbatim from the original builder; it
  // is replaced by a GLB at runtime, so no detail changes and no decal skip).
  function buildBanana(cfg: BuildingDefinition): BuildingEntity {
    const g = new THREE.Group();
    const bw = 4.0, bh = 3.5, bd = 4.0;
    part(g, rbox(bw + 0.8, PLH, bd + 0.8), { color: 0xd4c020, roughness: 0.7, tex: 'stone', rx: 1, ry: 1 }, [0, PLH / 2, 0]);
    const bodyMat = stdMat({ color: 0xf5e838, roughness: 0.3, metalness: 0.1 });
    bodyMat.emissive = new THREE.Color(0xe8d528);
    bodyMat.emissiveIntensity = 0;
    const body = mk(new THREE.SphereGeometry(1, 24, 16), bodyMat);
    body.scale.set(bw / 2, bh / 2, bd / 2);
    body.position.y = PLH + bh / 2 + 0.012;
    body.castShadow = true;
    body.receiveShadow = true;
    g.add(body);
    const stem = mk(new THREE.ConeGeometry(0.5, 1.5, 12), stdMat({ color: 0x5a4a00, roughness: 0.6 }));
    stem.position.set(0, PLH + bh + 0.4, 0);
    stem.castShadow = true;
    g.add(stem);
    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * Math.PI * 2;
      const strip = mk(new THREE.SphereGeometry(0.3, 8, 6, 0, Math.PI * 0.6, 0, Math.PI / 2), stdMat({ color: 0xe8d528, roughness: 0.4 }));
      strip.position.set(Math.cos(a) * 1.2, PLH + 0.1, Math.sin(a) * 1.2);
      strip.rotation.y = a + Math.PI / 2;
      strip.scale.set(2, 0.5, 2);
      strip.castShadow = true;
      g.add(strip);
    }
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2;
      const win = mk(new THREE.CircleGeometry(0.18, 16), stdMat({ color: 0x4a6fa8, roughness: 0.2, metalness: 0.3, emissive: 0xa8c8f8, emissiveIntensity: 0.1 }));
      win.position.set(Math.cos(a) * bw / 2 * 0.9, PLH + bh * 0.5, Math.sin(a) * bd / 2 * 0.9);
      win.lookAt(Math.cos(a) * bw, PLH + bh * 0.5, Math.sin(a) * bd);
      g.add(win);
    }
    part(g, rbox(0.6, 0.8, 0.06), { color: 0x8a5a00, roughness: 0.6, tex: 'wood', rx: 1, ry: 1 }, [0, PLH + 0.4, bd / 2 + 0.02], false);
    part(g, new THREE.CylinderGeometry(0.14, 0.14, 0.05, 20), { color: P.BLUE, emissive: P.BLUE, emissiveIntensity: 0.28 }, [0, PLH + 0.05, 0], false);
    g.position.set(cfg.x, 0, cfg.z);
    tagMeshes(g, cfg.id);
    return { ...cfg, group: g, body, bodyMat, labelEl: null, labelY: PLH + bh + 0.4 + 1.5 + 0.5 };
  }

  const builders: Record<string, ShapeBuilder> = {
    bank: buildBank,
    kiosk: buildKiosk,
    market: buildMarket,
    mall: buildMall,
    school: buildSchool,
    campus: buildCampus,
    qipai: buildQipai,
    banana: buildBanana,
  };
  return builders;
}
