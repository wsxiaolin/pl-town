import * as THREE from 'three';
import { RENDER_ORDER, SURFACE_Y } from '../rendering/layers';
import type { MaterialParameters } from '../rendering/meshFactory';
import type { BuildingEntity, BuildingDefinition } from './buildingEntity';

const PLOT_MAP: Record<string, { tex: string; size: number; color: number }> = {
  bank:{tex:'ground5',size:4.5,color:0xE8E7E4}, board:{tex:'ground5',size:3,color:0xE4E3E0}, tower:{tex:'ground5',size:4,color:0xD8D7D2}, darktower:{tex:'ground6',size:4,color:0x9A988E}, pavilion:{tex:'ground4',size:4.5,color:0xC0D0A0}, library:{tex:'ground5',size:4,color:0xE8E7E4}, ruins:{tex:'ground2',size:3.5,color:0xE0D8CC}, skyscraper:{tex:'ground5',size:3.5,color:0xD8D7D2}, campus:{tex:'ground5',size:4.5,color:0xE8E7E4}, kiosk:{tex:'ground5',size:3,color:0xE4E3E0}, screen:{tex:'ground5',size:4,color:0xD8D7D2}, shaft:{tex:'ground5',size:3,color:0xD8D7D2}, altar:{tex:'ground5',size:3.5,color:0xE4E3E0}, observatory:{tex:'ground5',size:4,color:0xE8E7E4}, pagoda:{tex:'ground4',size:4,color:0xC0D0A0}, market:{tex:'ground5',size:4.5,color:0xE4E3E0}, greenhouse:{tex:'ground4',size:4,color:0xB8C888}, clocktower:{tex:'ground5',size:4,color:0xE4E3E0}, temple:{tex:'ground5',size:4.5,color:0xF0EFEC}, factory:{tex:'ground2',size:5,color:0xC8C4B8}, mall:{tex:'ground5',size:5.5,color:0xD8D7D2}, school:{tex:'ground4',size:4.5,color:0xB8C888}, crown:{tex:'ground5',size:4.5,color:0xF0EFEC}, banana:{tex:'ground2',size:6,color:0xE0D8A0}, qipai:{tex:'ground5',size:8,color:0xE4E3E0}, restaurant:{tex:'ground5',size:6.2,color:0xD9C692}, wild_mushroom_restaurant:{tex:'ground5',size:6.6,color:0xD9C692}, film_city:{tex:'ground5',size:8,color:0xD8D7D2},
};

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
    const p = PLOT_MAP[shape] ?? { tex:'ground5', size:3.5, color:0xE4E3E0 };
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
    const facadeMap: Record<string, string> = { bank:'facade_bank', board:'facade_board', tower:'facade_tower', darktower:'facade_darktower', pavilion:'facade_temple', library:'facade_library', ruins:'facade_library', skyscraper:'facade_skyscraper', campus:'facade_campus', kiosk:'facade_kiosk', screen:'facade_screen', shaft:'facade_shaft', altar:'facade_altar', observatory:'facade_observatory', market:'facade_market', greenhouse:'facade_greenhouse', clocktower:'facade_clocktower', temple:'facade_temple', factory:'facade_factory', mall:'facade_mall', school:'facade_school', banana:'facade_banana', qipai:'facade_qipai' };
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
      addPlot(definition.x, definition.z, definition.shape, definition.id);
    });
  }

  return { addBuildings };
}
