import * as THREE from 'three';
import { RENDER_ORDER, SURFACE_Y } from '../rendering/layers';
import type { MaterialParameters } from '../rendering/meshFactory';
import type { BuildingEntity, BuildingDefinition } from './buildingEntity';
import { BUILDING_PLOT_MAP } from './data/buildingPlots';

type ShapeBuilder = (definition: BuildingDefinition) => BuildingEntity;

export function createBuildingSceneController(options: {
  scene: THREE.Scene;
  definitions: readonly BuildingDefinition[];
  builders: Record<string, ShapeBuilder>;
  addFacade: (group: THREE.Group, facade: string, width: number, height: number, yOffset: number, zPos: number, rotY?: number) => THREE.Object3D | null;
  material: (parameters: MaterialParameters) => THREE.Material;
  addPlot: (plot: THREE.Mesh) => void;
  addBuilding: (building: BuildingEntity) => void;
  isNight: () => boolean;
}) {
  function addPlot(x: number, z: number, shape: string, buildingId: string): void {
    const p = BUILDING_PLOT_MAP[shape] ?? { tex:'ground5', size:3.5, color:0xE4E3E0 };
    const material = options.material({ color: options.isNight() ? Math.floor(p.color * 0.7) : p.color, roughness:0.9, tex:p.tex, rx:Math.max(1,p.size/2), ry:Math.max(1,p.size/2) });
    material.depthWrite = false;
    const plot = new THREE.Mesh(new THREE.PlaneGeometry(p.size, p.size), material);
    plot.userData.buildingId = buildingId;
    plot.rotation.x = -Math.PI / 2;
    plot.position.set(x, SURFACE_Y.buildingPlot + (Math.abs(Math.round(x * 7 + z * 13)) % 8) * 0.0015, z);
    plot.receiveShadow = true;
    plot.renderOrder = RENDER_ORDER.buildingPlot;
    options.scene.add(plot);
    options.addPlot(plot);
  }

  function addBuildings(): void {
    const facadeMap: Record<string, string> = { bank:'facade_bank_plaster', board:'facade_utility_concrete', tower:'facade_tower_glass', darktower:'facade_darktower_glass', pavilion:'facade_temple_stone', library:'facade_library_stone', ruins:'facade_ruin_stone', skyscraper:'facade_tower_glass', campus:'facade_school_cream', kiosk:'facade_kiosk_woodglass', screen:'facade_utility_concrete', shaft:'facade_utility_concrete', altar:'facade_utility_concrete', observatory:'facade_observatory_concrete', market:'facade_market_awning', greenhouse:'facade_greenhouse_glass', clocktower:'facade_clocktower_brick', temple:'facade_temple_stone', factory:'facade_factory_brick', mall:'facade_tower_glass', school:'facade_school_cream', banana:'facade_residence_cream', qipai:'facade_community_brick' };
    options.definitions.filter((definition) => !definition.disabled).forEach((definition) => {
      const builder = options.builders[definition.shape];
      if (!builder) return;
      const building = builder(definition);
      const parameters = (building.body?.geometry as THREE.BoxGeometry | undefined)?.parameters;
      const facade = definition.facade ?? facadeMap[definition.shape];
      if (parameters && facade && parameters.width !== undefined && parameters.height !== undefined && parameters.depth !== undefined) {
        const offset = 0.024;
        options.addFacade(building.group, facade, parameters.width, parameters.height, building.body!.position.y, parameters.depth / 2 + offset);
        const back = options.addFacade(building.group, facade, parameters.width, parameters.height, building.body!.position.y, -(parameters.depth / 2 + offset));
        if (back) back.rotation.y = Math.PI;
        if (parameters.depth > 0.3) {
          const left = options.addFacade(building.group, facade, parameters.depth, parameters.height, building.body!.position.y, 0, 0);
          if (left) { left.position.x = -(parameters.width / 2 + offset); left.rotation.y = -Math.PI / 2; }
          const right = options.addFacade(building.group, facade, parameters.depth, parameters.height, building.body!.position.y, 0, 0);
          if (right) { right.position.x = parameters.width / 2 + offset; right.rotation.y = Math.PI / 2; }
        }
      }
      building.group.position.y = -3;
      options.scene.add(building.group);
      options.addBuilding(building);
      if (definition.shape !== 'crown') addPlot(definition.x, definition.z, definition.shape, definition.id);
    });
  }

  return { addBuildings };
}
