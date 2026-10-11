// Refined work-family buildings: factory (writing club / research / arena),
// clocktower, and film city studio. Footprints and overall heights match the
// original diorama builders so plot clips, collision boxes and label heights
// stay valid; every added detail protrudes from or embeds into the host wall
// with explicit depth separations (no coplanar faces).
import * as THREE from 'three';
import type { BuildingDefinition, BuildingEntity } from '../../city/buildingEntity';
import type { BuilderContext } from './builderContext';
import type { BuildingDetailKit } from './detailKit';

type ShapeBuilder = (cfg: BuildingDefinition) => BuildingEntity;

export function createWorkBuilders(ctx: BuilderContext, kit: BuildingDetailKit): Record<string, ShapeBuilder> {
  const { P, PLH, mk, part, tagMeshes, rbox } = ctx;

  // 21 FACTORY — workshop hall with clerestory band, loading dock and pipes
  function buildFactory(cfg: BuildingDefinition): BuildingEntity {
    const g = new THREE.Group();
    const bw = 3.0, bh = 1.8;
    const baseY = 0.2;
    part(g, rbox(3.6, baseY, 2.6), { color: P.BUILDING_BASE, roughness: 0.85, tex: 'stone', rx: 2, ry: 2 }, [0, baseY / 2, 0]);
    const bodyMat = ctx.mkBodyMat('metal', 2, 1);
    const body = mk(rbox(bw, bh, bw), bodyMat);
    body.position.y = baseY + bh / 2;
    body.castShadow = body.receiveShadow = true;
    g.add(body);
    const top = baseY + bh;
    const frontZ = bw / 2;
    // Flat corrugated roof (kept) with two exhaust vents standing on the slab.
    part(g, rbox(bw + 0.2, 0.08, bw + 0.2), { color: 0xb0afaa, roughness: 0.6, tex: 'metal', rx: 3, ry: 3 }, [0, top + 0.04, 0]);
    ([[ -0.8, -0.7 ], [ 0.4, 0.6 ]] as const).forEach(([vx, vz]) => {
      part(g, new THREE.CylinderGeometry(0.09, 0.12, 0.22, 8), { color: 0x8a8a8e, roughness: 0.45, metalness: 0.35, tex: 'metal', rx: 1, ry: 1 }, [vx, top + 0.19, vz]);
      part(g, new THREE.CylinderGeometry(0.12, 0.12, 0.035, 8), { color: 0x6e747c, roughness: 0.45, metalness: 0.35, tex: 'metal', rx: 1, ry: 1 }, [vx, top + 0.305, vz]);
    });
    // Brick chimney + smoke (kept). The chimney is sunk 0.03 so its bottom cap
    // hides inside the roof slab instead of sharing its underside plane.
    part(g, new THREE.CylinderGeometry(0.18, 0.22, 1.8, 12), { color: 0xc4a86d, roughness: 0.7, tex: 'brick', rx: 2, ry: 1 }, [bw / 2 - 0.4, top + 0.87, 0]);
    part(g, new THREE.SphereGeometry(0.15, 10, 10), { color: 0xd0cfcc, transparent: true, opacity: 0.4, roughness: 1 }, [bw / 2 - 0.4, top + 1.92, 0], false);
    part(g, new THREE.SphereGeometry(0.1, 10, 10), { color: 0xd0cfcc, transparent: true, opacity: 0.3, roughness: 1 }, [bw / 2 - 0.4, top + 2.07, 0], false);
    // Clerestory band: five small windows angled out toward the sky, just
    // under the roof on the front and back. One tilted sub-group per face so
    // the whole row shares the rake.
    const clerestoryBand = (wallZ: number, yaw: number): void => {
      const band = new THREE.Group();
      band.position.set(0, top - 0.14, wallZ);
      band.rotation.y = yaw;
      const tilt = new THREE.Group();
      tilt.rotation.x = 0.3;
      band.add(tilt);
      part(tilt, rbox(2.9, 0.05, 0.08), { color: 0x565c64, roughness: 0.5, tex: 'metal', rx: 2, ry: 1 }, [0, 0.16, 0.02]);
      [-1.1, -0.55, 0, 0.55, 1.1].forEach((wx) => {
        part(tilt, rbox(0.32, 0.2, 0.035), { color: 0x565c64, roughness: 0.5, tex: 'metal', rx: 1, ry: 1 }, [wx, 0, 0.02]);
        part(tilt, rbox(0.27, 0.15, 0.012), { color: 0xa8c8f8, roughness: 0.15, metalness: 0.25, tex: 'glass', rx: 1, ry: 1 }, [wx, 0, 0.041], false);
      });
      g.add(band);
    };
    clerestoryBand(frontZ, 0);
    clerestoryBand(-frontZ, Math.PI);
    // Loading dock: roller shutter door with slats, bay ledge and crates.
    part(g, rbox(0.7, 0.9, 0.06), { color: 0x6a7680, roughness: 0.35, metalness: 0.45, tex: 'metal', rx: 1, ry: 3 }, [0.55, baseY + 0.45, frontZ + 0.01]);
    [0.18, 0.45, 0.72].forEach((sy) =>
      part(g, rbox(0.72, 0.02, 0.015), { color: 0x565c64, roughness: 0.4, metalness: 0.4, tex: 'metal', rx: 1, ry: 1 }, [0.55, baseY + sy, frontZ + 0.045], false));
    part(g, rbox(1.15, 0.09, 0.3), { color: 0x9a988e, roughness: 0.85, tex: 'stone', rx: 1, ry: 1 }, [0.55, baseY + 0.045, frontZ + 0.15]);
    kit.crate(g, 0.3, baseY + 0.09, frontZ + 0.14, 0.26);
    kit.crate(g, 0.82, baseY + 0.09, frontZ + 0.15, 0.3);
    // Personnel door with a small canopy on the front-left.
    kit.door(g, { x: -1.0, y: baseY, z: frontZ, w: 0.42, h: 0.7, color: 0x5a6a78, frameColor: 0x3e464e, step: false, canopyColor: 0x8a4a3a });
    kit.window(g, { facing: 'front', x: -1.0, y: baseY + 1.35, z: frontZ, w: 0.34, h: 0.38, sill: false });
    // Back wall and right side get plain window rows.
    kit.windowRow(g, { facing: 'back', x: 0, y: baseY + 0.85, z: -frontZ, count: 3, spacing: 0.8, w: 0.34, h: 0.42, sill: false });
    [-0.6, 0.6].forEach((oz) =>
      kit.window(g, { facing: 'right', x: frontZ, y: baseY + 0.85, z: oz, w: 0.34, h: 0.42, sill: false }));
    // Two vertical pipes with handwheel valves on the left wall.
    ([[ -0.5, 1.3 ], [ 0.1, 1.45 ]] as const).forEach(([pz, wy]) => {
      part(g, new THREE.CylinderGeometry(0.045, 0.045, 1.35, 8), { color: 0x8a8a8e, roughness: 0.4, metalness: 0.3, tex: 'metal', rx: 1, ry: 2 }, [-frontZ - 0.06, baseY + 0.675, pz]);
      part(g, new THREE.TorusGeometry(0.07, 0.018, 6, 14), { color: 0x6e747c, roughness: 0.4, metalness: 0.5, tex: 'metal', rx: 1, ry: 1 }, [-frontZ - 0.1, wy, pz], false).rotation.x = Math.PI / 2;
    });
    kit.entryDisc(g, baseY);
    g.position.set(cfg.x, 0, cfg.z);
    tagMeshes(g, cfg.id);
    return { ...cfg, group: g, body, bodyMat, labelEl: null, labelY: top + 1.5, skipFacadeDecal: true };
  }

  // 19 CLOCKTOWER — brick tower with belfry openings, quoins and clock faces
  function buildClockTower(cfg: BuildingDefinition): BuildingEntity {
    const g = new THREE.Group();
    const bw = 1.5, bh = 4.0;
    part(g, rbox(2.2, PLH, 2.2), { color: P.BUILDING_BASE, roughness: 0.8, tex: 'stone', rx: 1, ry: 1 }, [0, PLH / 2, 0]);
    const bodyMat = ctx.mkBodyMat('brick', 1, 3);
    const body = mk(rbox(bw, bh, bw), bodyMat);
    body.position.y = PLH + bh / 2;
    body.castShadow = body.receiveShadow = true;
    g.add(body);
    const top = PLH + bh;
    const wallZ = bw / 2;
    // Belfry: two arched dark openings per face just below the roof. Each is
    // a proud dark inset with a half-cylinder roundel capping the head.
    const openingDark = { color: 0x1c1c20, roughness: 0.95 };
    const belfryOpening = (px: number, pz: number, alongX: boolean): void => {
      part(g, rbox(alongX ? 0.26 : 0.05, 0.38, alongX ? 0.05 : 0.26), openingDark, [px, top - 0.36, pz], false);
      const arch = alongX
        ? part(g, new THREE.CylinderGeometry(0.13, 0.13, 0.05, 12, 1, false, Math.PI / 2, Math.PI), openingDark, [px, top - 0.17, pz + Math.sign(pz) * 0.015], false)
        : part(g, new THREE.CylinderGeometry(0.13, 0.13, 0.05, 12, 1, false, 0, Math.PI), openingDark, [px + Math.sign(px) * 0.015, top - 0.17, pz], false);
      if (alongX) arch.rotation.x = Math.PI / 2;
      else arch.rotation.z = Math.PI / 2;
    };
    [-0.32, 0.32].forEach((ox) => {
      belfryOpening(ox, wallZ + 0.01, true);
      belfryOpening(ox, -wallZ - 0.01, true);
      belfryOpening(wallZ + 0.01, ox, false);
      belfryOpening(-wallZ - 0.01, ox, false);
    });
    // Corner quoins: alternating light stone strips up the two front corners.
    const quoinMat = { color: 0xe8e6e0, roughness: 0.55, tex: 'stone', rx: 1, ry: 1 };
    [-1, 1].forEach((sx) => {
      for (let i = 0; i < 4; i++) {
        const qy = PLH + 0.5 + i * 0.78;
        if (i % 2 === 0) part(g, rbox(0.18, 0.36, 0.06), quoinMat, [sx * 0.65, qy, wallZ + 0.01]);
        else part(g, rbox(0.06, 0.36, 0.18), quoinMat, [sx * (wallZ + 0.01), qy, 0.65]);
      }
    });
    // Entrance: framed door with a tiny canopy and two stone steps.
    kit.door(g, { x: 0, y: PLH, z: wallZ, w: 0.46, h: 0.78, color: 0x5a4634, frameColor: 0x3a2c20, step: false, canopyColor: 0x6a4a3a });
    kit.steps(g, { x: 0, y: PLH, z: wallZ + 0.03, width: 1.0, count: 2 });
    // Narrow side windows, one per side per floor.
    [1.15, 2.35].forEach((oy) => {
      kit.window(g, { facing: 'left', x: -wallZ, y: PLH + oy, z: 0, w: 0.24, h: 0.5, sill: false });
      kit.window(g, { facing: 'right', x: wallZ, y: PLH + oy, z: 0, w: 0.24, h: 0.5, sill: false });
    });
    // Clock faces (kept, nudged down to clear the belfry openings).
    const clockFaces: Array<{ position: [number, number, number]; rotation: number }> = [
      { position: [0, top - 0.9, wallZ + 0.04], rotation: 0 },
      { position: [0, top - 0.9, -wallZ - 0.04], rotation: Math.PI },
      { position: [wallZ + 0.04, top - 0.9, 0], rotation: Math.PI / 2 },
      { position: [-wallZ - 0.04, top - 0.9, 0], rotation: -Math.PI / 2 },
    ];
    clockFaces.forEach(({ position, rotation }) => {
      const face = new THREE.Group();
      const disc = part(face, new THREE.CylinderGeometry(0.3, 0.3, 0.04, 20), { color: 0xf8f4e8, roughness: 0.3, emissive: 0xf8f4e8, emissiveIntensity: 0.05 }, [0, 0, 0], false);
      disc.rotation.x = Math.PI / 2;
      part(face, rbox(0.02, 0.28, 0.02), { color: 0x2a2a2a, roughness: 0.4 }, [0, 0.05, 0.02], false);
      part(face, rbox(0.22, 0.02, 0.02), { color: 0x2a2a2a, roughness: 0.4 }, [0, 0.1, 0.02], false);
      face.position.set(...position);
      face.rotation.y = rotation;
      g.add(face);
    });
    // Pyramidal roof + weather vane (kept).
    part(g, new THREE.ConeGeometry(1.1, 0.8, 4), { color: 0x8a5a3a, roughness: 0.5, tex: 'rooftile', rx: 2, ry: 1 }, [0, top + 0.4, 0]).rotation.y = Math.PI / 4;
    part(g, new THREE.CylinderGeometry(0.02, 0.02, 0.3, 6), { color: 0xd0cfcc, roughness: 0.5, tex: 'metal', rx: 1, ry: 1 }, [0, top + 0.95, 0], false);
    kit.entryDisc(g, PLH);
    g.position.set(cfg.x, 0, cfg.z);
    tagMeshes(g, cfg.id);
    return { ...cfg, group: g, body, bodyMat, labelEl: null, labelY: top + 1.3, skipFacadeDecal: true };
  }

  // FILM CITY — studio hangar with marquee sign, backlot and spotlights
  function buildFilmCity(cfg: BuildingDefinition): BuildingEntity {
    const g = new THREE.Group();
    const width = 5.8, depth = 4.2, height = 2.2;
    part(g, rbox(width + 0.8, PLH, depth + 0.8), { color: P.BUILDING_BASE, roughness: 0.8, tex: 'stone', rx: 2, ry: 2 }, [0, PLH / 2, 0]);
    const bodyMat = ctx.mkBodyMat('wall', 2, 1);
    const body = mk(rbox(width, height, depth), bodyMat);
    body.position.y = PLH + height / 2 + 0.012;
    body.castShadow = body.receiveShadow = true;
    g.add(body);
    const top = PLH + height;
    const frontZ = depth / 2;
    part(g, rbox(width + 0.3, 0.16, depth + 0.3), { color: P.ROOF_RIM, roughness: 0.4, tex: 'rooftile', rx: 2, ry: 2 }, [0, top + 0.08, 0]);
    // Tall roof sign posts + emissive main sign (kept), now with a marquee
    // bulb row along the sign's top edge.
    part(g, rbox(0.18, 2.5, 0.18), { color: P.MALL_FRAME, roughness: 0.35, metalness: 0.25 }, [-2.1, top + 1.25, 0]);
    part(g, rbox(0.18, 2.5, 0.18), { color: P.MALL_FRAME, roughness: 0.35, metalness: 0.25 }, [2.1, top + 1.25, 0]);
    part(g, rbox(4.5, 1.1, 0.16), { color: P.MALL_SIGN, emissive: P.MALL_SIGN, emissiveIntensity: 0.12, roughness: 0.35 }, [0, top + 1.45, frontZ + 0.1], false);
    for (let i = 0; i < 6; i++) {
      part(g, new THREE.SphereGeometry(0.04, 8, 8), { color: 0xf0c060, emissive: 0xf0c060, emissiveIntensity: 0.7, roughness: 0.3 }, [-1.875 + i * 0.75, top + 2.04, frontZ + 0.21], false);
    }
    // Blue accent bar, plaza tiles, red carpet and backlot sign (kept).
    part(g, rbox(1.5, 0.12, 0.12), { color: P.BLUE, emissive: P.BLUE, emissiveIntensity: 0.28 }, [0, PLH + 0.06, frontZ + 1.1], false);
    for (const x of [-2.2, -1.1, 0, 1.1, 2.2]) part(g, rbox(0.75, 0.05, 0.75), { color: x % 2 ? P.PARCHMENT : P.BLUE, roughness: 0.5 }, [x, PLH + 0.04, frontZ + 0.75], false);
    part(g, rbox(3.2, 0.05, 4.8), { color: 0x8f2f35, roughness: 0.65 }, [0, PLH + 0.035, -4.6], false);
    [-1.7, 1.7].forEach((x) => part(g, new THREE.CylinderGeometry(0.09, 0.11, 1.8, 10), { color: P.MALL_FRAME, roughness: 0.4, metalness: 0.25 }, [x, PLH + 0.9, -5.8]));
    part(g, rbox(3.8, 0.28, 0.3), { color: P.MALL_SIGN, emissive: P.MALL_SIGN, emissiveIntensity: 0.16 }, [0, PLH + 1.8, -5.8], false);
    // Hangar entrance: two overlapping sliding panels under a rail bar. The
    // second panel rides 0.045 in front of the first so the overlap never
    // shares a depth boundary.
    part(g, rbox(1.3, 1.6, 0.07), { color: 0x7a8794, roughness: 0.35, metalness: 0.45, tex: 'metal', rx: 1, ry: 2 }, [-0.33, PLH + 0.8, frontZ + 0.02]);
    part(g, rbox(1.3, 1.6, 0.07), { color: 0x6d7986, roughness: 0.35, metalness: 0.45, tex: 'metal', rx: 1, ry: 2 }, [0.33, PLH + 0.8, frontZ + 0.065]);
    part(g, rbox(3.2, 0.07, 0.07), { color: 0x3a3f45, roughness: 0.4, metalness: 0.5, tex: 'metal', rx: 2, ry: 1 }, [0, PLH + 1.665, frontZ + 0.05]);
    // Strip windows along the sides, plus front and back window rows.
    [-1.3, 0, 1.3].forEach((oz) => {
      kit.window(g, { facing: 'left', x: -width / 2, y: PLH + 1.25, z: oz, w: 0.8, h: 0.3, sill: false });
      kit.window(g, { facing: 'right', x: width / 2, y: PLH + 1.25, z: oz, w: 0.8, h: 0.3, sill: false });
    });
    kit.window(g, { facing: 'front', x: -2.2, y: PLH + 1.25, z: frontZ, w: 0.5, h: 0.5 });
    kit.window(g, { facing: 'front', x: 2.2, y: PLH + 1.25, z: frontZ, w: 0.5, h: 0.5 });
    kit.windowRow(g, { facing: 'back', x: 0, y: PLH + 1.25, z: -frontZ, count: 3, spacing: 1.3, w: 0.5, h: 0.45, sill: false });
    // Two roof vents standing on the parapet rim.
    ([[ -1.7, -0.9 ], [ 1.5, 0.9 ]] as const).forEach(([vx, vz]) => {
      part(g, new THREE.CylinderGeometry(0.1, 0.13, 0.18, 8), { color: 0x8a8a8e, roughness: 0.45, metalness: 0.35, tex: 'metal', rx: 1, ry: 1 }, [vx, top + 0.25, vz]);
      part(g, new THREE.CylinderGeometry(0.13, 0.13, 0.03, 8), { color: 0x6e747c, roughness: 0.45, metalness: 0.35, tex: 'metal', rx: 1, ry: 1 }, [vx, top + 0.355, vz]);
    });
    // Spotlight tripods on the plaza, aimed back at the studio front.
    const spotlight = (px: number, pz: number): void => {
      const base = new THREE.Group();
      base.position.set(px, PLH, pz);
      [0, (Math.PI * 2) / 3, (Math.PI * 4) / 3].forEach((a) => {
        const leg = new THREE.Group();
        leg.rotation.y = a;
        const rod = part(leg, new THREE.CylinderGeometry(0.018, 0.018, 1.0, 6), { color: 0x3a3f45, roughness: 0.5, metalness: 0.4, tex: 'metal', rx: 1, ry: 2 }, [0, 0.47, 0.13]);
        rod.rotation.x = -0.36;
        base.add(leg);
      });
      const yaw = new THREE.Group();
      yaw.position.y = 1.02;
      yaw.rotation.y = Math.atan2(-px, -pz);
      const pitch = new THREE.Group();
      pitch.rotation.x = 0.38;
      part(pitch, rbox(0.24, 0.2, 0.32), { color: 0x2a2e33, roughness: 0.45, metalness: 0.4, tex: 'metal', rx: 1, ry: 1 }, [0, 0, 0.06]);
      part(pitch, new THREE.CylinderGeometry(0.07, 0.07, 0.05, 10), { color: 0xf5e9c8, emissive: 0xf0d890, emissiveIntensity: 0.55, roughness: 0.3 }, [0, 0, 0.24], false).rotation.x = Math.PI / 2;
      yaw.add(pitch);
      base.add(yaw);
      g.add(base);
    };
    spotlight(-3.8, 3.1);
    spotlight(3.8, 2.6);
    kit.entryDisc(g, PLH);
    g.position.set(cfg.x, 0, cfg.z);
    tagMeshes(g, cfg.id);
    return { ...cfg, group: g, body, bodyMat, labelEl: null, labelY: top + 2.2, skipFacadeDecal: true };
  }

  const builders: Record<string, ShapeBuilder> = {
    factory: buildFactory,
    clocktower: buildClockTower,
    film_city: buildFilmCity,
  };
  return builders;
}
