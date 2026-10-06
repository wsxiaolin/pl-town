// Refined tower-family buildings: tech tower, dark tower, glass skyscraper,
// screen wall, elevator shaft, greenhouse, pagoda, television tower.
// Footprints and overall heights match the original diorama builders in
// `buildingMeshFactory` so plot clips, collision boxes and label heights stay
// valid; the facades gain real window frames, doors, canopies and roof details.
import * as THREE from 'three';
import type { BuildingDefinition, BuildingEntity } from '../../city/buildingEntity';
import type { BuilderContext } from './builderContext';
import type { BuildingDetailKit } from './detailKit';

type ShapeBuilder = (cfg: BuildingDefinition) => BuildingEntity;

export function createTowerBuilders(ctx: BuilderContext, kit: BuildingDetailKit): Record<string, ShapeBuilder> {
  const { P, PLH, mk, part, tagMeshes } = ctx;

  // 03 TECHHALF — elegant office tower with glass crown and strip glazing
  function buildTower(cfg: BuildingDefinition): BuildingEntity {
    const g = new THREE.Group();
    const bw = 1.85, bh = 4.6;
    part(g, new THREE.BoxGeometry(2.55, PLH, 2.55), { color: P.BUILDING_BASE, roughness: 0.8, tex: 'stone', rx: 1, ry: 1 }, [0, PLH / 2, 0]);
    const bodyMat = ctx.mkBodyMat('wall', 1, 3);
    const body = mk(new THREE.BoxGeometry(bw, bh, bw), bodyMat);
    // Separate the dark wall from its foundation edge to prevent a flickering seam.
    body.position.y = PLH + bh / 2 + 0.012;
    body.castShadow = body.receiveShadow = true;
    g.add(body);
    const top = PLH + bh;
    // Floor ledge slabs divide the shaft into ~4 floors; they read as spandrel
    // bands where they cross the window strips (orthogonal, never coplanar).
    [1.15, 2.3, 3.45].forEach((ly) =>
      part(g, new THREE.BoxGeometry(bw + 0.18, 0.06, bw + 0.18), { color: 0xe8e7e4, roughness: 0.5, tex: 'stone', rx: 1, ry: 1 }, [0, PLH + ly, 0]));
    // Two tall vertical window strips per face, mullioned, serving all floors.
    const stripY = [PLH + 1.0, PLH + 3.1];
    ([[ 'front', bw / 2 ], [ 'back', -bw / 2 ]] as const).forEach(([face, wz]) => {
      [-0.55, 0.55].forEach((ox) =>
        stripY.forEach((wy) =>
          kit.window(g, { facing: face, x: ox, y: wy, z: wz, w: 0.24, h: 1.5, mullions: true, sill: false })));
    });
    ([[ 'left', -bw / 2 ], [ 'right', bw / 2 ]] as const).forEach(([face, wx]) => {
      [-0.55, 0.55].forEach((oz) =>
        stripY.forEach((wy) =>
          kit.window(g, { facing: face, x: wx, y: wy, z: oz, w: 0.24, h: 1.5, mullions: true, sill: false })));
    });
    // Entrance: framed door under a slate canopy, with wide stone steps.
    kit.door(g, { x: 0, y: PLH, z: bw / 2 + 0.01, w: 0.5, h: 0.8, color: 0x5a4634, frameColor: 0x3a3a3e, canopyColor: 0x4a5a6a, step: false });
    kit.steps(g, { x: 0, y: PLH, z: bw / 2 + 0.06, width: 1.0, count: 2 });
    // Glass crown, cap slab, antenna and glowing tip (original silhouette).
    part(g, new THREE.BoxGeometry(bw + 0.2, 0.12, bw + 0.2), { color: P.ROOF_RIM, roughness: 0.4, tex: 'rooftile', rx: 2, ry: 2 }, [0, top + 0.06, 0]);
    part(g, new THREE.BoxGeometry(1.1, 0.72, 1.1), { color: 0xf9f8f6, roughness: 0.06, tex: 'glass', rx: 1, ry: 1 }, [0, top + 0.12 + 0.36, 0]);
    // Roof slab raised so its bottom clears the glass box top (top+0.12+0.72) —
    // coplanar faces there caused the lighthouse-edge flicker.
    part(g, new THREE.BoxGeometry(1.22, 0.08, 1.22), { color: P.ROOF_RIM, roughness: 0.4, tex: 'metal', rx: 1, ry: 1 }, [0, top + 0.12 + 0.72 + 0.12, 0]);
    part(g, new THREE.CylinderGeometry(0.022, 0.022, 0.7, 8), { color: 0xd0cfcc, roughness: 0.5, tex: 'metal', rx: 1, ry: 1 }, [0, top + 0.12 + 0.72 + 0.16 + 0.35, 0]);
    const tipY = top + 0.12 + 0.72 + 0.16 + 0.35 + 0.35 + 0.07;
    part(g, new THREE.SphereGeometry(0.07, 12, 12), { color: P.BLUE, emissive: P.BLUE, emissiveIntensity: 0.4 }, [0, tipY, 0], false);
    kit.entryDisc(g, PLH);
    g.position.set(cfg.x, 0, cfg.z);
    tagMeshes(g, cfg.id);
    return { ...cfg, group: g, body, bodyMat, labelEl: null, labelY: tipY + 0.5, skipFacadeDecal: true };
  }

  // 04 BLACKHOLE — dark tower with lit slit windows, rune bands and iron door
  function buildDarkTower(cfg: BuildingDefinition): BuildingEntity {
    const g = new THREE.Group();
    const bw = 1.7, bh = 4.0;
    part(g, new THREE.BoxGeometry(2.4, PLH, 2.4), { color: 0x3a3a3e, roughness: 0.8, tex: 'darkwall', rx: 1, ry: 1 }, [0, PLH / 2, 0]);
    const bodyMat = ctx.stdMat({ color: P.DARK_TOWER, roughness: 0.15, metalness: 0.3, tex: 'darkwall', rx: 1, ry: 3 });
    bodyMat.emissive = new THREE.Color(0x1a1a2e);
    bodyMat.emissiveIntensity = 0;
    const body = mk(new THREE.BoxGeometry(bw, bh, bw), bodyMat);
    // Separate the dark wall from its foundation edge to prevent a flickering seam.
    body.position.y = PLH + bh / 2 + 0.012;
    body.castShadow = body.receiveShadow = true;
    g.add(body);
    const top = PLH + bh;
    // Narrow lit slit windows (warm light seeping out) on three faces x three
    // floors; rows sit clear of the aura ring and the rune bands below.
    const slitY = [PLH + 1.05, PLH + 2.15, PLH + 3.25];
    ([[ 'left', -bw / 2 ], [ 'right', bw / 2 ]] as const).forEach(([face, wx]) =>
      slitY.forEach((wy) =>
        kit.window(g, { facing: face, x: wx, y: wy, z: 0, w: 0.14, h: 0.5, frameColor: 0x2a2a30, lit: true, sill: false })));
    // Front face: a slit pair flanks the door, single slits above it.
    [-0.55, 0.55].forEach((ox) =>
      kit.window(g, { facing: 'front', x: ox, y: PLH + 1.05, z: bw / 2, w: 0.14, h: 0.5, frameColor: 0x2a2a30, lit: true, sill: false }));
    [PLH + 2.15, PLH + 3.25].forEach((wy) =>
      kit.window(g, { facing: 'front', x: 0, y: wy, z: bw / 2, w: 0.14, h: 0.5, frameColor: 0x2a2a30, lit: true, sill: false }));
    // Iron-banded door with the warm glow seam at its threshold.
    kit.door(g, { x: 0, y: PLH, z: bw / 2 + 0.01, w: 0.46, h: 0.85, color: 0x241a12, frameColor: 0x2a2a30, lit: true });
    [0.28, 0.62].forEach((oy) =>
      part(g, new THREE.BoxGeometry(0.6, 0.055, 0.05), { color: 0x4a4a4d, roughness: 0.4, tex: 'metal', rx: 1, ry: 1 }, [0, PLH + oy, bw / 2 + 0.05]));
    // Horizontal rune bands: dark-metal slabs with violet glints, set between
    // the window rows so they never cross the lit glass.
    [1.62, 2.72].forEach((by) => {
      part(g, new THREE.BoxGeometry(bw + 0.06, 0.07, bw + 0.06), { color: 0x2a2a30, roughness: 0.4, metalness: 0.5, tex: 'metal', rx: 2, ry: 1 }, [0, PLH + by, 0]);
      [-0.5, 0, 0.5].forEach((gx) =>
        part(g, new THREE.BoxGeometry(0.12, 0.028, 0.02), { color: 0x6b4fe8, emissive: 0x6b4fe8, emissiveIntensity: 0.55, roughness: 0.4 }, [gx, PLH + by, bw / 2 + 0.035], false));
    });
    // Six-segment cone roof, purple aura ring and dark orb (original silhouette).
    part(g, new THREE.ConeGeometry(1.0, 1.4, 6), { color: 0x2a2a30, roughness: 0.2, tex: 'darkwall', rx: 2, ry: 1 }, [0, top + 0.7, 0]);
    part(g, new THREE.TorusGeometry(0.9, 0.04, 8, 24), { color: 0x6b4fe8, emissive: 0x6b4fe8, emissiveIntensity: 0.3 }, [0, PLH + bh * 0.35, 0], false).rotation.x = Math.PI / 2;
    part(g, new THREE.SphereGeometry(0.15, 12, 12), { color: 0x1a1a2e, emissive: 0x4b3fe8, emissiveIntensity: 0.15 }, [0, top + 1.4 + 0.15, 0], false);
    kit.entryDisc(g, PLH);
    g.position.set(cfg.x, 0, cfg.z);
    tagMeshes(g, cfg.id);
    return { ...cfg, group: g, body, bodyMat, labelEl: null, labelY: top + 1.4 + 0.5, skipFacadeDecal: true };
  }

  // 08 CATCAFE — very tall glass skyscraper with corner mullions and cat totem
  function buildSkyscraper(cfg: BuildingDefinition): BuildingEntity {
    const g = new THREE.Group();
    const bw = 1.3, bh = 6.5;
    part(g, new THREE.BoxGeometry(2.0, PLH, 2.0), { color: P.BUILDING_BASE, roughness: 0.8, tex: 'stone', rx: 1, ry: 1 }, [0, PLH / 2, 0]);
    const bodyMat = ctx.mkBodyMat('glass', 1, 4);
    const body = mk(new THREE.BoxGeometry(bw, bh, bw), bodyMat);
    body.position.y = PLH + bh / 2;
    body.castShadow = body.receiveShadow = true;
    g.add(body);
    const top = PLH + bh;
    // Floor banding (horizontal lines every ~1 unit).
    for (let i = 1; i < 7; i++) {
      part(g, new THREE.BoxGeometry(bw + 0.04, 0.06, bw + 0.04), { color: 0xe8e7e4, roughness: 0.4, tex: 'metal', rx: 1, ry: 1 }, [0, PLH + i * 0.95, 0]);
    }
    // Full-height corner mullion strips frame the glass volume; their outer
    // faces stop just short of the floor-band depth so no faces are coplanar.
    ([[ -1, -1 ], [ 1, -1 ], [ -1, 1 ], [ 1, 1 ]] as const).forEach(([sx, sz]) =>
      part(g, new THREE.BoxGeometry(0.09, bh, 0.09), { color: 0xe8e7e4, roughness: 0.35, metalness: 0.4, tex: 'metal', rx: 1, ry: 4 }, [sx * (bw / 2 - 0.03), PLH + bh / 2, sz * (bw / 2 - 0.03)]));
    // Punched windows on front and back; one row glows warm for the evening.
    kit.windowRow(g, { facing: 'front', x: 0, y: PLH + 2.4, z: bw / 2, count: 3, spacing: 0.36, w: 0.28, h: 0.42, lit: true, sill: false });
    kit.windowRow(g, { facing: 'front', x: 0, y: PLH + 4.3, z: bw / 2, count: 3, spacing: 0.36, w: 0.28, h: 0.42, sill: false });
    kit.windowRow(g, { facing: 'back', x: 0, y: PLH + 1.45, z: -bw / 2, count: 3, spacing: 0.36, w: 0.28, h: 0.42, sill: false });
    kit.windowRow(g, { facing: 'back', x: 0, y: PLH + 3.35, z: -bw / 2, count: 3, spacing: 0.36, w: 0.28, h: 0.42, sill: false });
    // Entrance: glass canopy on slim posts over the door, with steps.
    kit.door(g, { x: 0, y: PLH, z: bw / 2 + 0.01, w: 0.44, h: 0.72, color: 0x5a4634, step: false });
    const canopy = part(g, new THREE.BoxGeometry(1.0, 0.035, 0.3), kit.glassMaterial(), [0, PLH + 1.06, bw / 2 + 0.13], false);
    canopy.rotation.x = 0.18;
    [-0.42, 0.42].forEach((px) =>
      part(g, new THREE.CylinderGeometry(0.022, 0.022, 1.02, 8), { color: 0xd0cfcc, roughness: 0.4, metalness: 0.5, tex: 'metal', rx: 1, ry: 1 }, [px, PLH + 0.51, bw / 2 + 0.22]));
    kit.steps(g, { x: 0, y: PLH, z: bw / 2 + 0.06, width: 0.9, count: 2 });
    // Rooftop cat totem and wind chimes (original signature).
    part(g, new THREE.BoxGeometry(bw + 0.1, 0.1, bw + 0.1), { color: P.ROOF_RIM, roughness: 0.4, tex: 'metal', rx: 1, ry: 1 }, [0, top + 0.05, 0]);
    part(g, new THREE.SphereGeometry(0.15, 10, 10), { color: 0xe8a838, emissive: 0xe8a838, emissiveIntensity: 0.12 }, [0, top + 0.1 + 0.15, 0]);
    part(g, new THREE.ConeGeometry(0.06, 0.12, 4), { color: 0xe8a838, emissive: 0xe8a838, emissiveIntensity: 0.12 }, [-0.07, top + 0.1 + 0.3, 0]);
    part(g, new THREE.ConeGeometry(0.06, 0.12, 4), { color: 0xe8a838, emissive: 0xe8a838, emissiveIntensity: 0.12 }, [0.07, top + 0.1 + 0.3, 0]);
    part(g, new THREE.CylinderGeometry(0.02, 0.02, 0.3, 6), { color: 0xd4d3d0, roughness: 0.5 }, [-0.5, top + 0.1 + 0.15, 0]);
    part(g, new THREE.CylinderGeometry(0.02, 0.02, 0.25, 6), { color: 0xd4d3d0, roughness: 0.5 }, [0.5, top + 0.1 + 0.12, 0]);
    kit.entryDisc(g, PLH);
    g.position.set(cfg.x, 0, cfg.z);
    tagMeshes(g, cfg.id);
    return { ...cfg, group: g, body, bodyMat, labelEl: null, labelY: top + 0.5, skipFacadeDecal: true };
  }

  // 12 SCREEN — media wall with glowing screen, rear truss and service door
  function buildScreen(cfg: BuildingDefinition): BuildingEntity {
    const g = new THREE.Group();
    const bw = 2.8, bh = 3.2;
    part(g, new THREE.BoxGeometry(3.4, 0.25, 1.0), { color: P.BUILDING_BASE, roughness: 0.8, tex: 'stone', rx: 2, ry: 1 }, [0, 0.125, 0]);
    const bodyMat = ctx.mkBodyMat('wall', 2, 2);
    const body = mk(new THREE.BoxGeometry(bw, bh, 0.6), bodyMat);
    body.position.y = 0.25 + bh / 2;
    body.castShadow = body.receiveShadow = true;
    g.add(body);
    const top = 0.25 + bh;
    part(g, new THREE.BoxGeometry(bw + 0.3, 0.12, 1.0), { color: P.ROOF_RIM, roughness: 0.4, tex: 'rooftile', rx: 3, ry: 1 }, [0, top + 0.06, 0]);
    // Glowing screen on the front face — layers stepped outward with clear gaps
    // so no coplanar faces z-fight (screen -> frame -> glow lines). The render
    // orders mirror RENDER_ORDER.buildingSurface/overlay from ../layers (values
    // inlined because this module's import set is fixed).
    const screenMat = ctx.stdMat({ color: P.BLUE, emissive: P.BLUE, emissiveIntensity: 0.25, roughness: 0.1 });
    const screen = part(g, new THREE.BoxGeometry(bw * 0.8, bh * 0.7, 0.08), screenMat, [0, 0.25 + bh * 0.5, 0.46], false);
    screen.renderOrder = 8;
    const screenFrame = part(g, new THREE.BoxGeometry(bw * 0.85, bh * 0.75, 0.08), { color: 0x2a2a30, roughness: 0.3 }, [0, 0.25 + bh * 0.5, 0.33], false);
    screenFrame.renderOrder = 8;
    for (let i = 0; i < 4; i++) {
      const glowLine = part(g, new THREE.BoxGeometry(bw * 0.6, 0.03, 0.04), { color: 0xa8c8f8, emissive: 0xa8c8f8, emissiveIntensity: 0.2, depthWrite: false }, [0, 0.25 + bh * 0.3 + i * 0.4, 0.54], false);
      glowLine.renderOrder = 10;
    }
    // Side pillars rise just past the roofline with stone caps.
    [-1, 1].forEach((s) => {
      part(g, new THREE.BoxGeometry(0.22, bh + 0.12, 0.72), { color: 0xe8e7e4, roughness: 0.45, tex: 'stone', rx: 1, ry: 2 }, [s * (bw / 2 + 0.05), 0.25 + (bh + 0.12) / 2, 0]);
      part(g, new THREE.BoxGeometry(0.3, 0.06, 0.8), { color: P.ROOF_RIM, roughness: 0.4, tex: 'stone', rx: 1, ry: 1 }, [s * (bw / 2 + 0.05), 0.25 + bh + 0.15, 0]);
    });
    // Rear diagonal truss braces form a V against the back face, kept clear of
    // the ladder (centre) and the service door (right).
    part(g, new THREE.BoxGeometry(0.08, 3.0, 0.06), { color: 0x8a8a8e, roughness: 0.4, metalness: 0.4, tex: 'metal', rx: 1, ry: 3 }, [-0.72, 1.8, -0.34]).rotation.z = 0.38;
    part(g, new THREE.BoxGeometry(0.08, 3.0, 0.06), { color: 0x8a8a8e, roughness: 0.4, metalness: 0.4, tex: 'metal', rx: 1, ry: 3 }, [0.72, 1.8, -0.34]).rotation.z = -0.38;
    // Maintenance ladder up the centre of the back face.
    [-0.13, 0.13].forEach((rx) =>
      part(g, new THREE.BoxGeometry(0.035, 1.75, 0.03), { color: 0x8a8a8e, roughness: 0.45, metalness: 0.4, tex: 'metal', rx: 1, ry: 2 }, [rx, 1.4, -0.315]));
    for (let i = 0; i < 5; i++) {
      part(g, new THREE.BoxGeometry(0.26, 0.035, 0.03), { color: 0x9a9a9e, roughness: 0.45, metalness: 0.4, tex: 'metal', rx: 1, ry: 1 }, [0, 0.6 + i * 0.4, -0.315]);
    }
    // Service door with a low stone threshold slab on the plinth.
    kit.door(g, { x: 1.05, y: 0.25, z: -0.31, facing: 'back', w: 0.44, h: 0.85, color: 0x4a5a6a, frameColor: 0x2a2a30, step: false });
    part(g, new THREE.BoxGeometry(0.56, 0.06, 0.16), { color: 0xd9d7d2, roughness: 0.75, tex: 'stone', rx: 1, ry: 1 }, [1.05, 0.28, -0.38]);
    // Antenna on top (original signature).
    part(g, new THREE.CylinderGeometry(0.03, 0.03, 0.5, 6), { color: 0xd0cfcc, roughness: 0.5 }, [0, top + 0.12 + 0.25, 0]);
    part(g, new THREE.SphereGeometry(0.06, 8, 8), { color: P.GOLD, emissive: P.GOLD, emissiveIntensity: 0.3 }, [0, top + 0.12 + 0.5, 0], false);
    kit.entryDisc(g, 0.25);
    g.position.set(cfg.x, 0, cfg.z);
    tagMeshes(g, cfg.id);
    return { ...cfg, group: g, body, bodyMat, labelEl: null, labelY: top + 0.12 + 0.5 + 0.5, skipFacadeDecal: true };
  }

  // 13 ELEVATOR — metal shaft with floor seams and rooftop cable housing
  function buildShaft(cfg: BuildingDefinition): BuildingEntity {
    const g = new THREE.Group();
    const bw = 1.3, bh = 3.8;
    part(g, new THREE.BoxGeometry(2.0, PLH, 1.8), { color: P.BUILDING_BASE, roughness: 0.8, tex: 'stone', rx: 1, ry: 1 }, [0, PLH / 2, 0]);
    const bodyMat = ctx.mkBodyMat('metal', 1, 3);
    const body = mk(new THREE.BoxGeometry(bw, bh, bw), bodyMat);
    body.position.y = PLH + bh / 2;
    body.castShadow = body.receiveShadow = true;
    g.add(body);
    const top = PLH + bh;
    part(g, new THREE.BoxGeometry(bw + 0.15, 0.1, bw + 0.15), { color: P.ROOF_RIM, roughness: 0.3, tex: 'metal', rx: 1, ry: 1 }, [0, top + 0.05, 0]);
    // Elevator door (split design) with a lintel bar over it.
    part(g, new THREE.BoxGeometry(bw * 0.7, 1.6, 0.04), { color: 0x4a6fa8, roughness: 0.1, metalness: 0.6, tex: 'metal', rx: 1, ry: 2 }, [0, PLH + 0.8, bw / 2 + 0.02], false);
    part(g, new THREE.BoxGeometry(0.02, 1.6, 0.04), { color: 0x2a2a30, roughness: 0.3, tex: 'metal', rx: 1, ry: 1 }, [0, PLH + 0.8, bw / 2 + 0.03], false);
    part(g, new THREE.BoxGeometry(bw * 0.7 + 0.14, 0.05, 0.06), { color: 0x8a8a8e, roughness: 0.35, metalness: 0.5, tex: 'metal', rx: 1, ry: 1 }, [0, PLH + 1.62, bw / 2 + 0.02]);
    // Button panel and glowing floor indicator (original signature).
    part(g, new THREE.BoxGeometry(0.15, 0.4, 0.03), { color: 0x2a2a30, roughness: 0.3, tex: 'metal', rx: 1, ry: 1 }, [bw / 2 - 0.1, PLH + 1.2, bw / 2 + 0.02], false);
    part(g, new THREE.BoxGeometry(0.1, 0.08, 0.02), { color: 0xa8c8f8, emissive: 0xa8c8f8, emissiveIntensity: 0.3 }, [0, PLH + bh - 0.4, bw / 2 + 0.02], false);
    // Floor seams: thin darker slabs at three heights, clear of the windows.
    [1.1, 2.2, 3.3].forEach((sy) =>
      part(g, new THREE.BoxGeometry(bw + 0.03, 0.035, bw + 0.03), { color: 0xb0afac, roughness: 0.35, metalness: 0.45, tex: 'metal', rx: 1, ry: 1 }, [0, PLH + sy, 0]));
    // Narrow window column on the right face, between the seams.
    [0.9, 1.9, 2.9].forEach((wy) =>
      kit.window(g, { facing: 'right', x: bw / 2, y: PLH + wy, z: 0, w: 0.18, h: 0.34, frameColor: 0x6a6a6e, sill: false }));
    // Rooftop cable housing with an insulator stub, off-centre so the top
    // indicator sphere stays clear of it.
    part(g, new THREE.BoxGeometry(0.5, 0.34, 0.42), { color: 0x8a8a8e, roughness: 0.4, metalness: 0.5, tex: 'metal', rx: 1, ry: 1 }, [0.32, top + 0.27, -0.15]);
    part(g, new THREE.CylinderGeometry(0.03, 0.03, 0.18, 8), { color: 0xd0cfcc, roughness: 0.4, tex: 'metal', rx: 1, ry: 1 }, [0.32, top + 0.53, -0.15]);
    kit.steps(g, { x: 0, y: PLH, z: bw / 2, width: 0.9, count: 2, depth: 0.12 });
    part(g, new THREE.SphereGeometry(0.06, 8, 8), { color: P.BLUE, emissive: P.BLUE, emissiveIntensity: 0.4 }, [0, top + 0.1 + 0.06, 0], false);
    kit.entryDisc(g, PLH);
    g.position.set(cfg.x, 0, cfg.z);
    tagMeshes(g, cfg.id);
    return { ...cfg, group: g, body, bodyMat, labelEl: null, labelY: top + 0.5, skipFacadeDecal: true };
  }

  // 18 GREENHOUSE — glass hall on a brick knee wall with dome vents
  function buildGreenhouse(cfg: BuildingDefinition): BuildingEntity {
    const g = new THREE.Group();
    const bw = 2.4, bh = 1.8;
    part(g, new THREE.BoxGeometry(3.0, 0.2, 2.4), { color: P.BUILDING_BASE, roughness: 0.8, tex: 'stone', rx: 2, ry: 1 }, [0, 0.1, 0]);
    const bodyMat = ctx.mkBodyMat('glass', 2, 1);
    const body = mk(new THREE.BoxGeometry(bw, bh, bw), bodyMat);
    body.position.y = 0.2 + bh / 2;
    body.castShadow = body.receiveShadow = true;
    g.add(body);
    // Domed glass roof (original silhouette).
    part(g, new THREE.SphereGeometry(bw / 2, 20, 10, 0, Math.PI * 2, 0, Math.PI / 2), { color: 0xe0f0d8, roughness: 0.05, transparent: true, opacity: 0.85, tex: 'glass', rx: 2, ry: 1 }, [0, 0.2 + bh, 0]);
    // Brick knee wall around the glass base; it also covers the body/plinth
    // seam. Its long sides stay within the plinth, short sides overhang 0.02.
    part(g, new THREE.BoxGeometry(2.5, 0.25, 2.44), { color: 0x9a5a48, roughness: 0.85, tex: 'brick', rx: 3, ry: 1 }, [0, 0.325, 0]);
    // Small vent slits pierce the knee wall, embedded 0.01 and proud 0.02.
    [-0.7, 0.7].forEach((ox) => {
      part(g, new THREE.BoxGeometry(0.2, 0.1, 0.03), { color: 0x3a3a3a, roughness: 0.6, tex: 'metal', rx: 1, ry: 1 }, [ox, 0.325, 1.225], false);
      part(g, new THREE.BoxGeometry(0.2, 0.1, 0.03), { color: 0x3a3a3a, roughness: 0.6, tex: 'metal', rx: 1, ry: 1 }, [ox, 0.325, -1.225], false);
    });
    [-0.7, 0.7].forEach((oz) => {
      part(g, new THREE.BoxGeometry(0.03, 0.1, 0.2), { color: 0x3a3a3a, roughness: 0.6, tex: 'metal', rx: 1, ry: 1 }, [1.255, 0.325, oz], false);
      part(g, new THREE.BoxGeometry(0.03, 0.1, 0.2), { color: 0x3a3a3a, roughness: 0.6, tex: 'metal', rx: 1, ry: 1 }, [-1.255, 0.325, oz], false);
    });
    // Thin vertical mullion bars rhythm the glass walls (every ~0.6), rooted in
    // the knee wall top and stopping at the dome base.
    [-0.9, -0.3, 0.3, 0.9].forEach((ox) => {
      part(g, new THREE.BoxGeometry(0.03, 1.55, 0.035), { color: 0xd8dad6, roughness: 0.4, metalness: 0.3, tex: 'metal', rx: 1, ry: 2 }, [ox, 1.22, 1.215]);
      part(g, new THREE.BoxGeometry(0.03, 1.55, 0.035), { color: 0xd8dad6, roughness: 0.4, metalness: 0.3, tex: 'metal', rx: 1, ry: 2 }, [ox, 1.22, -1.215]);
    });
    [-0.9, -0.3, 0.3, 0.9].forEach((oz) => {
      part(g, new THREE.BoxGeometry(0.035, 1.55, 0.03), { color: 0xd8dad6, roughness: 0.4, metalness: 0.3, tex: 'metal', rx: 1, ry: 2 }, [1.215, 1.22, oz]);
      part(g, new THREE.BoxGeometry(0.035, 1.55, 0.03), { color: 0xd8dad6, roughness: 0.4, metalness: 0.3, tex: 'metal', rx: 1, ry: 2 }, [-1.215, 1.22, oz]);
    });
    // Service door on the east wall (surface-mounted over the knee wall) with a
    // stepping-stone pad in front.
    kit.door(g, { x: 1.26, y: 0.2, z: 0, facing: 'right', w: 0.4, h: 0.66, color: 0x4a5a3a, frameColor: 0x3a3a2c, step: false });
    [-0.16, 0.16].forEach((pz) =>
      part(g, new THREE.BoxGeometry(0.19, 0.035, 0.28), { color: 0xd9d7d2, roughness: 0.8, tex: 'stone', rx: 1, ry: 1 }, [1.405, 0.2175, pz]));
    // Roof vent openers propped on the dome flanks.
    ([[ -1, 0.45 ], [ 1, -0.45 ]] as const).forEach(([sx, tilt]) =>
      part(g, new THREE.BoxGeometry(0.2, 0.03, 0.14), { color: 0x8a8a8e, roughness: 0.4, metalness: 0.5, tex: 'metal', rx: 1, ry: 1 }, [sx * 0.55, 3.09, 0], false).rotation.z = tilt);
    // Plants inside (original arrangement).
    part(g, new THREE.SphereGeometry(0.35, 10, 10), { color: 0x6a9a4a, roughness: 0.9 }, [-0.5, 0.2 + 0.3, 0.3], false);
    part(g, new THREE.SphereGeometry(0.28, 10, 10), { color: 0x5a8a3a, roughness: 0.9 }, [0.5, 0.2 + 0.25, -0.3], false);
    part(g, new THREE.CylinderGeometry(0.04, 0.04, 0.5, 6), { color: 0x8a6a3a, roughness: 0.8, tex: 'wood', rx: 1, ry: 1 }, [0, 0.2 + 0.25, 0], false);
    part(g, new THREE.SphereGeometry(0.2, 10, 10), { color: 0x7aaa5a, roughness: 0.9 }, [0, 0.2 + 0.5, 0], false);
    part(g, new THREE.SphereGeometry(0.15, 10, 10), { color: 0xe85858, roughness: 0.8 }, [0.3, 0.2 + 0.6, 0.1], false);
    kit.entryDisc(g, 0.2);
    g.position.set(cfg.x, 0, cfg.z);
    tagMeshes(g, cfg.id);
    return { ...cfg, group: g, body, bodyMat, labelEl: null, labelY: 0.2 + bh + bw / 2 + 0.3, skipFacadeDecal: true };
  }

  // 16 PAGODA — three red-roofed tiers with corner columns and lanterns
  function buildPagoda(cfg: BuildingDefinition): BuildingEntity {
    const g = new THREE.Group();
    const tiers = 3, bw = 1.6, tierH = 0.6;
    // Wooden tier bodies (the original painted facade texture is not in this
    // module's allowed texture set).
    const bodyMat = ctx.mkBodyMat('wood', 1, 1);
    let body: THREE.Mesh | undefined;
    let y = PLH;
    for (let i = 0; i < tiers; i++) {
      const w = bw * (1 - i * 0.18);
      const tierBody = mk(new THREE.BoxGeometry(w, tierH, w), bodyMat);
      tierBody.position.y = y + tierH / 2;
      tierBody.castShadow = tierBody.receiveShadow = true;
      g.add(tierBody);
      if (!body) body = tierBody;
      // Corner columns frame each tier body, proud of the walls by 0.02.
      ([[ -1, -1 ], [ 1, -1 ], [ -1, 1 ], [ 1, 1 ]] as const).forEach(([sx, sz]) =>
        part(g, new THREE.BoxGeometry(0.08, tierH, 0.08), { color: 0x8a4a3a, roughness: 0.6, tex: 'wood', rx: 1, ry: 1 }, [sx * (w / 2 - 0.02), y + tierH / 2, sz * (w / 2 - 0.02)]));
      const roofW = w + 0.6;
      const roof = part(g, new THREE.ConeGeometry(roofW * 0.72, 0.22, 4), { color: 0xc45a4a, roughness: 0.4, tex: 'pagoda_tile', rx: 2, ry: 1 }, [0, y + tierH + 0.11, 0]);
      roof.rotation.y = Math.PI / 4;
      y += tierH + 0.2;
    }
    // Railing along two sides of the first-tier roof, posts bedded into the
    // tile slope (the pyramid face sits at ~PLH+0.62 along the railing line).
    kit.railing(g, { facing: 'front', x: 0, y: PLH + 0.61, z: 1.0, width: 2.0, height: 0.16, posts: 3, color: 0x8a4a3a });
    kit.railing(g, { facing: 'right', x: 1.0, y: PLH + 0.61, z: 0, width: 2.0, height: 0.16, posts: 3, color: 0x8a4a3a });
    // Ground-floor entrance flanked by hanging lanterns.
    kit.door(g, { x: 0, y: PLH, z: bw / 2 + 0.01, w: 0.4, h: 0.72, color: 0x6a3a2a, frameColor: 0x4a2c23 });
    kit.lantern(g, { x: -0.55, y: PLH + 0.9, z: 0.88 });
    kit.lantern(g, { x: 0.55, y: PLH + 0.9, z: 0.88 });
    // Gold finial with a two-bead chain stacked above it.
    part(g, new THREE.ConeGeometry(0.08, 0.35, 6), { color: P.GOLD, emissive: P.GOLD, emissiveIntensity: 0.2 }, [0, y, 0], false);
    part(g, new THREE.ConeGeometry(0.05, 0.12, 6), { color: P.GOLD, emissive: P.GOLD, emissiveIntensity: 0.25 }, [0, y + 0.22, 0], false);
    part(g, new THREE.ConeGeometry(0.035, 0.1, 6), { color: P.GOLD, emissive: P.GOLD, emissiveIntensity: 0.25 }, [0, y + 0.32, 0], false);
    kit.entryDisc(g, PLH);
    g.position.set(cfg.x, 0, cfg.z);
    tagMeshes(g, cfg.id);
    return { ...cfg, group: g, body, bodyMat, labelEl: null, labelY: y + 0.5, skipFacadeDecal: true };
  }

  // Neighborhood landmark — broadcast tower with observation deck and dishes
  function buildTelevisionTower(cfg: BuildingDefinition): BuildingEntity {
    const g = new THREE.Group();
    const baseY = 0.22;
    part(g, new THREE.CylinderGeometry(2.15, 2.35, baseY, 32), { color: 0xc8d0d4, roughness: 0.72, tex: 'stone', rx: 2, ry: 2 }, [0, baseY / 2, 0]);
    const bodyMat = ctx.mkBodyMat('metal', 1, 4);
    const body = mk(new THREE.CylinderGeometry(0.38, 0.74, 5.25, 16), bodyMat);
    body.position.y = baseY + 2.625 + 0.012;
    body.castShadow = body.receiveShadow = true;
    g.add(body);
    const deckY = baseY + 3.25;
    part(g, new THREE.CylinderGeometry(1.33, 1.33, 0.16, 24), { color: 0x4f6570, roughness: 0.38, metalness: 0.42, tex: 'metal', rx: 2, ry: 1 }, [0, deckY, 0]);
    part(g, new THREE.CylinderGeometry(1.05, 1.1, 0.55, 24), { color: 0x9fc6df, roughness: 0.12, metalness: 0.38, tex: 'glass', rx: 2, ry: 1, emissive: 0x6a9fc8, emissiveIntensity: 0.08 }, [0, deckY + 0.34, 0]);
    part(g, new THREE.CylinderGeometry(1.17, 1.17, 0.12, 24), { color: 0x3f5560, roughness: 0.35, metalness: 0.48, tex: 'metal', rx: 2, ry: 1 }, [0, deckY + 0.67, 0]);
    // Ring of six small windows around the observation cabin, flat frames
    // floating a hair off the curved glazing.
    for (let i = 0; i < 6; i++) {
      const angle = (i / 6) * Math.PI * 2;
      const facing = Math.abs(Math.sin(angle)) > Math.abs(Math.cos(angle))
        ? (Math.sin(angle) > 0 ? 'right' : 'left')
        : (Math.cos(angle) > 0 ? 'front' : 'back');
      kit.window(g, { facing, x: Math.sin(angle) * 1.08, y: deckY + 0.36, z: Math.cos(angle) * 1.08, w: 0.2, h: 0.26, frameColor: 0x3f5560, sill: false });
    }
    const antennaBase = baseY + 5.25;
    part(g, new THREE.CylinderGeometry(0.12, 0.24, 1.55, 12), { color: 0x607985, roughness: 0.28, metalness: 0.65, tex: 'metal', rx: 1, ry: 2 }, [0, antennaBase + 0.775, 0]);
    // Two extra antenna platform discs along the mast (clear of the dishes).
    [0.63, 1.08].forEach((ah) =>
      part(g, new THREE.CylinderGeometry(0.3, 0.3, 0.04, 12), { color: 0x4f6570, roughness: 0.38, metalness: 0.42, tex: 'metal', rx: 2, ry: 1 }, [0, antennaBase + ah, 0]));
    part(g, new THREE.ConeGeometry(0.12, 0.62, 10), { color: 0xe5eef2, roughness: 0.2, metalness: 0.55, tex: 'metal', rx: 1, ry: 1 }, [0, antennaBase + 1.55 + 0.31, 0]);
    [-1, 1].forEach((side) => {
      const dish = part(g, new THREE.SphereGeometry(0.38, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2), { color: 0xe1e9ec, roughness: 0.2, metalness: 0.52, tex: 'metal', rx: 1, ry: 1 }, [side * 0.66, antennaBase + 0.42, 0]);
      dish.rotation.z = side * Math.PI / 2;
      part(g, new THREE.CylinderGeometry(0.025, 0.025, 0.42, 6), { color: 0x455a64, roughness: 0.34, metalness: 0.5, tex: 'metal', rx: 1, ry: 1 }, [side * 0.9, antennaBase + 0.42, 0]).rotation.z = side * Math.PI / 2;
    });
    part(g, new THREE.SphereGeometry(0.1, 12, 12), { color: 0xe85858, emissive: 0xe85858, emissiveIntensity: 0.5, roughness: 0.18 }, [0, antennaBase + 2.18, 0], false);
    // Base entrance: a porch block beds into the tapered shaft, carrying the
    // door and a short flight of steps.
    part(g, new THREE.BoxGeometry(0.72, 1.05, 0.43), { color: 0x9fb3bd, roughness: 0.5, tex: 'stone', rx: 1, ry: 1 }, [0, baseY + 0.525, 0.715]);
    part(g, new THREE.BoxGeometry(0.84, 0.07, 0.5), { color: 0x4f6570, roughness: 0.4, metalness: 0.3, tex: 'metal', rx: 1, ry: 1 }, [0, baseY + 1.085, 0.72]);
    kit.door(g, { x: 0, y: baseY, z: 0.94, w: 0.42, h: 0.72, color: 0x4a5a6a, frameColor: 0x2f3a40, step: false });
    kit.steps(g, { x: 0, y: baseY, z: 0.99, width: 0.85, count: 2 });
    kit.entryDisc(g, baseY);
    g.position.set(cfg.x, 0, cfg.z);
    tagMeshes(g, cfg.id);
    return { ...cfg, group: g, body, bodyMat, labelEl: null, labelY: antennaBase + 2.7, skipFacadeDecal: true };
  }

  const builders: Record<string, ShapeBuilder> = {
    tower: buildTower,
    darktower: buildDarkTower,
    skyscraper: buildSkyscraper,
    screen: buildScreen,
    shaft: buildShaft,
    greenhouse: buildGreenhouse,
    pagoda: buildPagoda,
    television_tower: buildTelevisionTower,
  };
  return builders;
}
