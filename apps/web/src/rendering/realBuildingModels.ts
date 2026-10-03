import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { BUILDING_REGISTRY } from '../city/data/buildings/_registry';
import { applyBuildingModels, createBuildingModelCache, type ReplaceableBuilding } from './buildingModelCache';

export type { ReplaceableBuilding };

// GLB 建筑由各自配置文件的 glbFile 字段声明（文件位于 src/assets/models/）。
const modelUrlFor = (file: string) => new URL(`../assets/models/${file}`, import.meta.url).href;

// 注册表是静态数据，映射在模块加载时构建一次即可。
const glbFileById = new Map<string, string>(
  BUILDING_REGISTRY.flatMap((config): [string, string][] =>
    config.glbFile ? [[config.id, config.glbFile]] : [],
  ),
);

const loader = new GLTFLoader();
const loadModel = createBuildingModelCache((url) => loader.loadAsync(url).then((gltf) => gltf.scene));

export async function addRealBuildingModels(_scene: THREE.Scene, buildings: ReplaceableBuilding[]): Promise<void> {
  await applyBuildingModels(buildings, {
    modelFor: (id) => {
      const file = glbFileById.get(id);
      return file ? modelUrlFor(file) : undefined;
    },
    loadModel,
  });
}
