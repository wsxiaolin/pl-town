import * as THREE from 'three';

// 建筑模型装配的纯编排逻辑。GLTFLoader 实例与 `import.meta` 资产 URL 等
// 浏览器细节留在 realBuildingModels.ts 适配层；本模块只依赖 three，
// 因此可以被 node 单测（CommonJS 编译产物）直接导入验证。

export type ReplaceableBuilding = {
  id: string;
  group: THREE.Group;
  bodyMat?: THREE.MeshStandardMaterial;
  body?: THREE.Mesh;
};

/** 解析后的 GLB 场景根加载器。 */
export type BuildingModelLoader = (url: string) => Promise<THREE.Group>;

export type BuildingModelSink = {
  /** 由建筑 id 解析它应加载的模型 URL；无模型时返回 undefined。 */
  modelFor: (id: string) => string | undefined;
  /** 带缓存的加载器；同一 URL 的并发请求应被去重。 */
  loadModel: BuildingModelLoader;
};

function detachedClone(source: THREE.Object3D): THREE.Object3D {
  source.updateWorldMatrix(true, true);
  const clone = source.clone(true);
  source.matrixWorld.decompose(new THREE.Vector3(), clone.quaternion, clone.scale);
  clone.position.set(0, 0, 0);
  clone.matrixAutoUpdate = true;
  clone.traverse(child => {
    const mesh = child as THREE.Mesh;
    if (!mesh.isMesh) return;
    mesh.material = Array.isArray(mesh.material)
      ? mesh.material.map(material => material.clone())
      : mesh.material.clone();
    mesh.castShadow = true;
    mesh.receiveShadow = true;
  });
  return clone;
}

function normalizeModel(model: THREE.Object3D, targetSize: THREE.Vector3): THREE.Group {
  const holder = new THREE.Group();
  const content = new THREE.Group();
  holder.add(content);
  content.add(model);
  holder.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(holder);
  const size = box.getSize(new THREE.Vector3());
  const scale = Math.min(
    targetSize.x / Math.max(size.x, 0.001),
    targetSize.y / Math.max(size.y, 0.001),
    targetSize.z / Math.max(size.z, 0.001),
  );
  content.scale.setScalar(scale);
  holder.updateMatrixWorld(true);
  const scaledBox = new THREE.Box3().setFromObject(holder);
  const center = scaledBox.getCenter(new THREE.Vector3());
  content.position.set(-center.x, -scaledBox.min.y, -center.z);
  return holder;
}

function replaceBuilding(building: ReplaceableBuilding, source: THREE.Object3D): void {
  const target = building.group.clone(true);
  target.position.set(0, 0, 0);
  target.quaternion.identity();
  target.scale.set(1, 1, 1);
  target.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(target);
  const size = box.getSize(new THREE.Vector3());
  size.set(Math.max(size.x, 0.5), Math.max(size.y, 0.8), Math.max(size.z, 0.5));
  const model = normalizeModel(detachedClone(source), size);
  building.group.clear();
  building.group.add(model);
  building.body = undefined;
  building.group.userData.buildingState = 'default';
  building.group.userData.destroyed = false;
  let firstMaterial: THREE.MeshStandardMaterial | undefined;
  model.traverse(child => {
    const mesh = child as THREE.Mesh;
    if (!mesh.isMesh) return;
    mesh.userData.buildingId = building.id;
    const material = Array.isArray(mesh.material) ? mesh.material[0] : mesh.material;
    if (!firstMaterial && material instanceof THREE.MeshStandardMaterial) firstMaterial = material;
    if (!building.body) building.body = mesh;
  });
  if (firstMaterial) building.bodyMat = firstMaterial;
}

// 解析结果按 URL 缓存：多个建筑可共享同一文件，并发加载同一 URL 时去重。
// 失败的加载会被逐出缓存——瞬时网络错误可在下一轮装配（如施工恢复）时
// 重试，而不是把这次拒绝缓存到会话结束；成功的解析则常驻缓存。
export function createBuildingModelCache(load: BuildingModelLoader): BuildingModelLoader {
  const cache = new Map<string, Promise<THREE.Group>>();
  return (url: string) => {
    let pending = cache.get(url);
    if (!pending) {
      pending = load(url);
      cache.set(url, pending);
      pending.catch(() => {
        if (cache.get(url) === pending) cache.delete(url);
      });
    }
    return pending;
  };
}

export async function applyBuildingModels(buildings: ReplaceableBuilding[], sink: BuildingModelSink): Promise<void> {
  for (const building of buildings) {
    const url = sink.modelFor(building.id);
    if (!url || building.group.userData.constructionPending) continue;
    let source: THREE.Group;
    try {
      // 逐模型隔离：拼错或缺失的 GLB 不能中止排在它后面的模型
      // （此前一次 rejection 会废掉之后所有建筑）。
      source = await sink.loadModel(url);
    } catch (error) {
      // 只捕获加载失败；replaceBuilding 自身的异常保留原始栈，
      // 不会被误报成资源问题。
      console.warn(`[building-models] failed to load ${url} for ${building.id}`, error);
      continue;
    }
    if (building.group.parent && !building.group.userData.constructionPending) {
      replaceBuilding(building, source);
    }
  }
}
