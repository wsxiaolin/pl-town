import assert from 'node:assert/strict';
import test from 'node:test';
import * as THREE from 'three';
import { applyBuildingModels, createBuildingModelCache, type ReplaceableBuilding } from '../../src/rendering/buildingModelCache';

// 编排逻辑的回归防护（对应 #204 审查建议 3）：
// - 单个模型加载失败只跳过该建筑，不中断排在后面的模型；
// - 失败的加载会被逐出缓存，网络恢复后的下一轮装配可以重试；
// - 多个建筑共享同一模型文件时只加载一次。

const makeParent = () => new THREE.Group();

const makeBuilding = (parent: THREE.Group, id: string): { building: ReplaceableBuilding; bodyMesh: THREE.Mesh; material: THREE.MeshStandardMaterial } => {
  const group = new THREE.Group();
  const material = new THREE.MeshStandardMaterial({ color: 0xffffff });
  const bodyMesh = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), material);
  group.add(bodyMesh);
  parent.add(group);
  return { building: { id, group, body: bodyMesh }, bodyMesh, material };
};

const makeModelSource = () => {
  const scene = new THREE.Group();
  scene.add(new THREE.Mesh(new THREE.BoxGeometry(2, 3, 2), new THREE.MeshStandardMaterial({ color: 0x884422 })));
  return scene;
};

test('a failing model load skips only that building and is retried on the next pass', async () => {
  const parent = makeParent();
  const flaky = makeBuilding(parent, 'flaky');
  const stable = makeBuilding(parent, 'stable');

  const loadCounts = new Map<string, number>();
  let failNextFlakyLoad = true;
  const load = async (url: string): Promise<THREE.Group> => {
    loadCounts.set(url, (loadCounts.get(url) ?? 0) + 1);
    if (url === 'a.glb' && failNextFlakyLoad) throw new Error('network hiccup');
    return makeModelSource();
  };
  const loadModel = createBuildingModelCache(load);
  const sink = { modelFor: (id: string) => (id === 'flaky' ? 'a.glb' : 'b.glb'), loadModel };

  const warnings: string[] = [];
  const originalWarn = console.warn;
  console.warn = (...args: unknown[]) => { warnings.push(String(args[0])); };
  try {
    await applyBuildingModels([flaky.building, stable.building], sink);

    // 第一轮：flaky 保持程序化网格，但排在后面的 stable 照常被替换。
    assert.equal(
      flaky.building.group.children[0],
      flaky.bodyMesh,
      'a failed load must leave the procedural mesh in place',
    );
    assert.notEqual(stable.building.group.children[0], stable.bodyMesh, 'a failed model must not abort later buildings');
    assert.ok(stable.building.bodyMat && stable.building.bodyMat !== stable.material, 'the stable building should get the cloned model material');
    assert.equal(warnings.length, 1);
    assert.match(warnings[0]!, /failed to load a\.glb for flaky/);
    assert.equal(loadCounts.get('a.glb'), 1);
    assert.equal(loadCounts.get('b.glb'), 1);

    // 第二轮（模拟网络恢复）：失败已逐出缓存，重试应再次发起加载。
    failNextFlakyLoad = false;
    await applyBuildingModels([flaky.building], sink);

    assert.equal(loadCounts.get('a.glb'), 2, 'rejected loads must be evicted so a retry is possible');
    assert.notEqual(flaky.building.group.children[0], flaky.bodyMesh, 'the flaky building should be replaced after the retry succeeds');
  } finally {
    console.warn = originalWarn;
  }
});

test('buildings sharing one model file load it exactly once', async () => {
  const parent = makeParent();
  const first = makeBuilding(parent, 'first');
  const second = makeBuilding(parent, 'second');

  let loads = 0;
  const loadModel = createBuildingModelCache(async () => {
    loads += 1;
    return makeModelSource();
  });

  await applyBuildingModels([first.building, second.building], { modelFor: () => 'shared.glb', loadModel });

  assert.equal(loads, 1, 'two buildings sharing a glbFile must trigger a single load');
  assert.notEqual(first.building.group.children[0], first.bodyMesh);
  assert.notEqual(second.building.group.children[0], second.bodyMesh);
});
