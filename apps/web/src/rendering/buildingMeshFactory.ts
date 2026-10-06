// Building meshes are intentionally kept together as a visual catalog.
// This module has no scene, DOM, storage, or gameplay responsibilities.
// Per-shape refined builders live in `buildingModels/` modules; this file only
// assembles the builder table and hosts the special-cased 科特维酒馆 (tavern),
// whose facade-decal look was tuned by review #181/#209 and stays decal-based.
import * as THREE from 'three';
import { buildWushiRestaurant } from './wushiRestaurant';
import { buildWildMushroomRestaurant } from './wildMushroomRestaurant';
import { buildIceKingCrownBuilding } from './iceKing/iceKingCrownBuilding';
import { createNorthDistrictBuilders, buildMartStore } from './northDistrictBuildings';
import type { MeshHelpers } from './meshFactory';
import type { BuildingDefinition, BuildingEntity } from '../city/buildingEntity';
import { createBuilderContext } from './buildingModels/builderContext';
import { createDetailKit } from './buildingModels/detailKit';
import { createCivicBuilders } from './buildingModels/civicBuildings';
import { createTowerBuilders } from './buildingModels/towerBuildings';
import { createCommerceBuilders } from './buildingModels/commerceBuildings';
import { createWorkBuilders } from './buildingModels/workBuildings';

type Palette = Record<string, number>;
type ShapeBuilder = (cfg: BuildingDefinition) => BuildingEntity;

export interface BuildingMeshFactoryOptions {
  palette: Palette;
  platformHeight: number;
  makeMaterial: MeshHelpers['stdMat'];
  makeMesh: MeshHelpers['mk'];
  addPart: MeshHelpers['part'];
}

export function createBuildingMeshFactory(options: BuildingMeshFactoryOptions) {
  const ctx = createBuilderContext(options);
  const kit = createDetailKit(ctx);
  const { P, PLH, stdMat, mk, part, tagMeshes } = ctx;

  function requireBuilder(table: Record<string, ShapeBuilder>, key: string): ShapeBuilder {
    const builder = table[key];
    if (!builder) throw new Error(`buildingModels: missing builder "${key}"`);
    return builder;
  }

  // 科特维酒馆 — a run-down waystation between death and the dungeon: tavern
  // hall below, freshly renovated guest rooms above, dim oil lamps, a
  // self-playing piano in the corner, and the heavy dungeon door up front.
  function buildTavern(cfg: BuildingDefinition): BuildingEntity {
    const g = new THREE.Group();
    const width = 3.0, depth = 2.55, floorH = 1.85, upperH = 1.45, baseY = 0.2;
    part(g, new THREE.BoxGeometry(width + 0.62, baseY, depth + 0.62), {color:0xa99277, roughness:0.92, tex:'stone', rx:2, ry:2}, [0, baseY / 2, 0]);
    // Ground floor — the tavern hall: aged, mold-stained planks.
    const bodyMat = stdMat({color:0x6b4630, roughness:0.75, tex:'residence_wood', rx:3, ry:2});
    bodyMat.emissive = new THREE.Color(0x2a1a12); bodyMat.emissiveIntensity = 0;
    const body = mk(new THREE.BoxGeometry(width, floorH, depth), bodyMat);
    body.position.y = baseY + floorH / 2 + 0.012; body.castShadow = body.receiveShadow = true; g.add(body);
    const floorTop = baseY + floorH;
    // Second floor — the new guest rooms: lighter, renovated wood, set back.
    const upW = width - 0.36, upD = depth - 0.3;
    part(g, new THREE.BoxGeometry(upW + 0.2, 0.12, upD + 0.2), {color:0x3a291f, roughness:0.8, tex:'wood', rx:2, ry:1}, [0, floorTop + 0.06, 0]);
    const upper = part(g, new THREE.BoxGeometry(upW, upperH, upD), {color:0x8a6a4f, roughness:0.66, tex:'residence_wood', rx:2, ry:1}, [0, floorTop + 0.12 + upperH / 2, 0]);
    upper.castShadow = true;
    const upTop = floorTop + 0.12 + upperH;
    // Balustrade for the guest-room gallery. Each rail's centre sits one
    // half-height (0.15) above the gallery slab top (floorTop + 0.12) plus a
    // 0.002 epsilon: closing the old 0.09 gap without putting the rail's
    // underside coplanar with the slab top, which z-fights at far camera
    // distances (AGENTS.md: same-height surfaces need a Y separation).
    [-1, 1].forEach((s) => part(g, new THREE.BoxGeometry(upW + 0.26, 0.3, 0.06), {color:0x503728, roughness:0.82, tex:'wood', rx:1, ry:1}, [0, floorTop + 0.12 + 0.002 + 0.15, s * (upD / 2 + 0.08)], false));
    [-1, 1].forEach((s) => part(g, new THREE.BoxGeometry(0.06, 0.3, upD + 0.14), {color:0x503728, roughness:0.82, tex:'wood', rx:1, ry:1}, [s * (upW / 2 + 0.08), floorTop + 0.12 + 0.002 + 0.15, 0], false));
    const roof = part(g, new THREE.ConeGeometry(2.1, 1.02, 4), {color:0x47433a, roughness:0.66, tex:'residence_tile', rx:3, ry:1}, [0, upTop + 0.51, 0]);
    roof.rotation.y = Math.PI / 4;
    // Structural beams across the worn facade.
    [-1.16, 1.16].forEach((x) => part(g, new THREE.BoxGeometry(0.13, floorH + 0.04, 0.08), {color:0x33241b, roughness:0.8, tex:'wood', rx:1, ry:2}, [x, baseY + floorH / 2, depth / 2 + 0.045], false));
    part(g, new THREE.BoxGeometry(width + 0.08, 0.11, 0.1), {color:0x33241b, roughness:0.8, tex:'wood', rx:2, ry:1}, [0, baseY + 1.18, depth / 2 + 0.05], false);
    // Windows: tavern hall — dim oil-lamp amber, small and mullioned.
    const lampGlass = {color:0x8f5b23, emissive:0x9a5a1e, emissiveIntensity:0.55, roughness:0.3, tex:'glass', rx:1, ry:1};
    [-0.86, 0.86].forEach((x) => {
      part(g, new THREE.BoxGeometry(0.4, 0.44, 0.035), lampGlass, [x, baseY + 0.72, depth / 2 + 0.05], false);
      part(g, new THREE.BoxGeometry(0.46, 0.05, 0.05), {color:0x33241b, roughness:0.8, tex:'wood', rx:1, ry:1}, [x, baseY + 0.72, depth / 2 + 0.06], false);
      part(g, new THREE.BoxGeometry(0.05, 0.5, 0.05), {color:0x33241b, roughness:0.8, tex:'wood', rx:1, ry:1}, [x, baseY + 0.72, depth / 2 + 0.06], false);
    });
    // Guest-room windows upstairs: a paler, steadier light.
    [-0.72, 0.72].forEach((x) => part(g, new THREE.BoxGeometry(0.36, 0.4, 0.035), {color:0xd9b26a, emissive:0xc79b45, emissiveIntensity:0.4, roughness:0.24, tex:'glass', rx:1, ry:1}, [x, floorTop + 0.12 + upperH / 2, upD / 2 + 0.05], false));
    // The heavy door to the dungeon — dark, iron-banded, warmer light seeping through the gap.
    part(g, new THREE.BoxGeometry(0.56, 1.12, 0.06), {color:0x241811, roughness:0.7, tex:'wood', rx:1, ry:2}, [0, baseY + 0.56, depth / 2 + 0.06], false);
    part(g, new THREE.BoxGeometry(0.6, 0.07, 0.065), {color:0x4a4a4d, roughness:0.4, tex:'metal', rx:1, ry:1}, [0, baseY + 0.86, depth / 2 + 0.065], false);
    part(g, new THREE.BoxGeometry(0.6, 0.07, 0.065), {color:0x4a4a4d, roughness:0.4, tex:'metal', rx:1, ry:1}, [0, baseY + 0.3, depth / 2 + 0.065], false);
    part(g, new THREE.BoxGeometry(0.5, 0.03, 0.075), {color:0xd78535, emissive:0xd78535, emissiveIntensity:0.75, roughness:0.5}, [0, baseY + 0.025, depth / 2 + 0.06], false);
    // Awning — faded red fabric over the entrance.
    part(g, new THREE.BoxGeometry(1.08, 0.14, 0.62), {color:0x63222c, roughness:0.74, tex:'fabric', rx:2, ry:1}, [0, baseY + 1.3, depth / 2 + 0.31], false);
    // Hanging sign: a bracket juts out from the wall, a small plank swings below it.
    part(g, new THREE.BoxGeometry(0.06, 0.06, 0.62), {color:0x33241b, roughness:0.8, tex:'wood', rx:1, ry:1}, [width / 2 - 0.02, floorTop + 0.02, depth / 2 + 0.28], false);
    part(g, new THREE.CylinderGeometry(0.014, 0.014, 0.3, 6), {color:0x4a4a4d, roughness:0.45, tex:'metal', rx:1, ry:1}, [width / 2 - 0.02, floorTop - 0.14, depth / 2 + 0.42], false);
    part(g, new THREE.BoxGeometry(0.34, 0.3, 0.05), {color:0x59422e, roughness:0.85, tex:'wood', rx:1, ry:1}, [width / 2 - 0.02, floorTop - 0.32, depth / 2 + 0.42], false);
    // Wall lanterns — dim oil lamps in dark cages beside the door.
    [-0.52, 0.52].forEach((x) => {
      part(g, new THREE.BoxGeometry(0.14, 0.22, 0.14), {color:0x2f2f31, roughness:0.5, tex:'metal', rx:1, ry:1}, [x, baseY + 1.06, depth / 2 + 0.11], false);
      part(g, new THREE.BoxGeometry(0.08, 0.14, 0.08), {color:0xf0b95c, emissive:0xf0a83f, emissiveIntensity:1.15, roughness:0.4}, [x, baseY + 1.06, depth / 2 + 0.11], false);
    });
    // The old piano by the tavern's front corner — worn shell, keys still bright.
    // Keep every part inside the plinth edge (front face at depth/2 + 0.31):
    // the shell and keys used to cantilever past it over empty air.
    part(g, new THREE.BoxGeometry(0.56, 0.44, 0.42), {color:0x241a12, roughness:0.82, tex:'wood', rx:1, ry:1}, [-1.05, baseY + 0.22, depth / 2 + 0.05], false);
    part(g, new THREE.BoxGeometry(0.72, 0.07, 0.26), {color:0xd9cfae, roughness:0.35, tex:'wall', rx:1, ry:1}, [-1.05, baseY + 0.24, depth / 2 + 0.16], false);
    part(g, new THREE.BoxGeometry(0.34, 0.2, 0.05), {color:0x59422e, roughness:0.85, tex:'wood', rx:1, ry:1}, [-1.05, baseY + 0.56, depth / 2 + 0.12], false);
    // Chimney + aged barrels out back. The barrel stack sits on the plinth
    // (top at baseY), not floating 0.29 above it.
    part(g, new THREE.BoxGeometry(0.17, 1.02, 0.17), {color:0x795445, roughness:0.8, tex:'brick', rx:1, ry:1}, [width * 0.3, upTop + 0.42, -depth * 0.18]);
    part(g, new THREE.CylinderGeometry(0.36, 0.36, 0.12, 16), {color:0x3d2b21, roughness:0.75, tex:'wood', rx:1, ry:1}, [-width / 2 - 0.22, baseY + 0.06, depth / 2 + 0.06], false);
    part(g, new THREE.CylinderGeometry(0.32, 0.32, 0.36, 16), {color:0x8a5c39, roughness:0.85, tex:'wood', rx:1, ry:1}, [-width / 2 - 0.22, baseY + 0.30, depth / 2 + 0.06], false);
    part(g, new THREE.TorusGeometry(0.33, 0.035, 6, 14), {color:0x4b3526, roughness:0.6, tex:'metal', rx:1, ry:1}, [-width / 2 - 0.22, baseY + 0.28, depth / 2 + 0.06], false).rotation.x = Math.PI / 2;
    part(g, new THREE.CylinderGeometry(0.14, 0.14, 0.05, 20), {color:P.BLUE, emissive:P.BLUE, emissiveIntensity:0.28}, [0, baseY + 0.05, 0], false);
    g.position.set(cfg.x, 0, cfg.z); tagMeshes(g, cfg.id);
    return {...cfg, group:g, body, bodyMat, labelEl:null, labelY:upTop + 1.35};
  }

  const civicBuilders = createCivicBuilders(ctx, kit);
  const towerBuilders = createTowerBuilders(ctx, kit);
  const commerceBuilders = createCommerceBuilders(ctx, kit);
  const workBuilders = createWorkBuilders(ctx, kit);

  const builders = {
    ...civicBuilders,
    ...towerBuilders,
    ...commerceBuilders,
    ...workBuilders,
    // 金月店(mall_south)换上 rainy-store 的 24H MART 便利店外观(用户指定;
    // 自动门/橱窗文案契合)。mall_west 保持精细化商场造型。
    mall: (cfg: BuildingDefinition) => cfg.id === 'mall_south'
      ? buildMartStore({ platformHeight: PLH, makeMaterial: stdMat, makeMesh: mk, addPart: part }, cfg)
      : requireBuilder(commerceBuilders, 'mall')(cfg),
    crown: (cfg: BuildingDefinition) => buildIceKingCrownBuilding(cfg, { stdMat, mk, part }),
    // 炸鸡店换上 rainy-store 的 24H MART 便利店外观(用户指定;文案保留炸鸡主题)。
    fried_chicken_shop: (cfg: BuildingDefinition) => buildMartStore({ platformHeight: PLH, makeMaterial: stdMat, makeMesh: mk, addPart: part }, cfg),
    tavern: buildTavern,
    restaurant: (cfg: BuildingDefinition) => buildWushiRestaurant({ platformHeight: PLH, makeMaterial: stdMat, makeMesh: mk, addPart: part }, cfg),
    wild_mushroom_restaurant: (cfg: BuildingDefinition) => buildWildMushroomRestaurant({ platformHeight: PLH, makeMaterial: stdMat, makeMesh: mk, addPart: part }, cfg),
    ...createNorthDistrictBuilders({ platformHeight: PLH, makeMaterial: stdMat, makeMesh: mk, addPart: part }),
  };

  return { builders };
}
