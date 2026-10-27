import * as THREE from 'three';
import { TRANSIT_STATIONS, type TransitStationSpec } from '../../city/data/year-towns/transit';
import type { SceneInterestPointEntity } from '../sceneInterestPoints';

// transitStationSigns —— 年份群岛站牌渲染 + 交互实体（T4b-c2，docs/
// t4b-ride-plan.md §2 新增②；站点表见 docs/year-towns-design.md §5.2）。
//
// 契约：
// - 10 座站牌 = 月台板 + 立柱 + 线路色牌面：星门线（含起源村·桥站）= 暖橙、
//   群岛环线各站 = 青蓝（t4b 方案 §2② 的线路色口径，按 station.line 取色）。
// - interactionPosition = 月台中心 (platformX, baseY, platformZ)：月台场
//   （transitField）在 pad 中心恒等 baseY，即 transitGroundY 的精确落点
//   （c1 探针已核验 10 站 delta=0）；interactionPointer 的 3.5 距离判定按
//   interactionPosition 的 x/z 生效，玩家可走到月台板上触发。
// - 数据唯一事实源：city/data/year-towns/transit.ts（baseY/platformX/
//   platformZ/line）；本文件零坐标重写（rendering 消费 data，AGENTS.md
//   依赖方向）。站牌朝向由 platform − 泊位向量导出（= 向岛心/路侧退让方向，
//   牌面正对来客）。站名文字归乘车站牌面板（T4b-c3/c4 UI），本模块不渲染文字；
//   牌面年份「2019–2026」除外（T6R-b：群岛系统年份区间，canvas 纹理贴双面）。
// - 生命周期对齐 yearTownTransit 的创建/销毁：两者同在 assembleCityWorld
//   装配、同在 disposeSession 批次销毁；几何经 makeMesh 进 ResourcePool、
//   材质经 materialFor 进材质缓存，均由既有 dispose 路径释放，本模块
//   dispose 只摘除场景节点（镜像 yearTownTransit 的 object.parent?.remove）。
//   年份贴片为例外：走烟花铺匾额先例（一次性 CanvasTexture + 自建材质，
//   不进 stdMat 缓存——refreshWeather 会把无 tex 键的 map 置 null），故由
//   本模块 dispose 自行释放（材质 + 纹理各一，10 站共享）。
// - 命名归入 year-town-transit-structures 组：组名前缀
//   'year-town-transit-structures-sign-'（冒烟/调试按名可寻，不影响
//   getObjectByName('year-town-transit-structures') 的精确匹配）。
// - 交互注册（§2 编辑④，本文件不接线）：实体由 sceneInterestPoints 合并进
//   entities + baseRaycastTargets；tag 语义与 sceneInterestPoints 内 tag()
//   完全一致（每个 mesh 写 userData.sceneInterestPointId）。乘车控制器/
//   面板路由归 T4b-c3/c4。

/** 组名前缀：year-town-transit-structures 家族（与桥/环线结构 mesh 同组命名）。 */
const SIGN_NAME_PREFIX = 'year-town-transit-structures-sign';

// ── 尺寸（局部系：原点=月台中心，+Z 指向岛心/来客侧；单位=世界米）──────────
const BOARD_SIZE: readonly [number, number, number] = [2.9, 0.07, 2.0];
const BOARD_BOTTOM_GAP = 0.004; // 对月台场地面的工艺缝（AGENTS.md ≥0.004）
const BOARD_TOP = BOARD_BOTTOM_GAP + BOARD_SIZE[1];
const PILLAR_RADIUS_TOP = 0.08;
const PILLAR_RADIUS_BOTTOM = 0.1;
const PILLAR_HEIGHT = 2.3;
const PILLAR_Z = -0.72; // 月台轨道侧边缘内 0.28（牌面立在台尾，正对 +Z 来客）
const SIGN_CENTER_Y = 1.62; // 立柱中部，约人视线高度
const SIGN_FRAME_SIZE: readonly [number, number, number] = [1.5, 0.74, 0.05];
const SIGN_PANEL_SIZE: readonly [number, number, number] = [1.36, 0.6, 0.058]; // 厚于框 0.008 → 双面凸出 0.004

// ── 配色（月台板=桥面步道色族、立柱=石墨、牌面框=车身乳白、牌面=线路色）────
const BOARD_MATERIAL = { color: 0xbdb8ae, roughness: 0.95 } as const;
const PILLAR_MATERIAL = { color: 0x555e68, roughness: 0.82, metalness: 0.12 } as const;
const SIGN_FRAME_MATERIAL = { color: 0xf4f0e8, roughness: 0.85 } as const;
/** 线路色牌面：暖橙=星门线、青蓝=环线；低强度自发光供夜间寻站（对齐桥塔信标语汇）。 */
const LINE_SIGN_MATERIALS: Record<TransitStationSpec['line'], Record<string, unknown>> = {
  stargate: { color: 0xd9842f, roughness: 0.62, emissive: 0x5c2a08, emissiveIntensity: 0.2 },
  ring: { color: 0x2e8fa9, roughness: 0.62, emissive: 0x0b3340, emissiveIntensity: 0.2 },
};

// ── 年份贴片（T6R-b）：牌面「2019–2026」年份文本，透明底暖白字 canvas 纹理 ──
// 工艺缝：贴片位于线路色板 ±Z 面外 0.004（与色板凸出框的缝宽一致，AGENTS.md）。
const YEAR_PLATE_SIZE: readonly [number, number] = [1.26, 0.46];
const YEAR_PLATE_Z = SIGN_PANEL_SIZE[2] / 2 + 0.004;
const YEAR_TEXT = '2019–2026';

/** 一次性年份贴片纹理（10 站共享；字族/色域对齐 northDistrictBuildings.makeSignTexture 先例）。 */
function makeYearPlateTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 192;
  const context = canvas.getContext('2d')!;
  context.clearRect(0, 0, canvas.width, canvas.height);
  context.font = 'bold 92px "Hiragino Sans","Noto Sans JP",Arial,sans-serif';
  context.textAlign = 'center';
  context.textBaseline = 'middle';
  // 深色细描边保证白日在橙/青色板上的对比度；主体暖白走 emissive 夜读。
  context.lineWidth = 10;
  context.strokeStyle = 'rgba(38, 30, 20, 0.55)';
  context.strokeText(YEAR_TEXT, canvas.width / 2, canvas.height / 2 + 6);
  context.fillStyle = '#F7EFDC';
  context.fillText(YEAR_TEXT, canvas.width / 2, canvas.height / 2 + 6);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  return texture;
}

export interface TransitStationSignsOptions {
  scene: THREE.Scene;
  makeMaterial: (parameters: Record<string, unknown>) => THREE.MeshStandardMaterial;
  makeMesh: (geometry: THREE.BufferGeometry, material: THREE.Material) => THREE.Mesh;
}

export interface TransitStationSigns {
  entities: readonly SceneInterestPointEntity[];
  dispose(): void;
}

function addSignMesh(
  group: THREE.Group,
  options: TransitStationSignsOptions,
  geometry: THREE.BufferGeometry,
  material: Record<string, unknown> | THREE.Material,
  position: readonly [number, number, number],
): THREE.Mesh {
  // 与 sceneInterestPoints.addMesh 同语义：参数材质走 makeMaterial（天气/
  // 销毁由既有路径接管），mesh 进组并投影；几何重复构造由 ResourcePool 按
  // type+parameters 去重为同一份 GPU 侧实例。自建材质实例（年份贴片）直传
  // 不进缓存，由本模块 dispose 释放（头注契约）。
  const mesh = options.makeMesh(
    geometry,
    material instanceof THREE.Material ? material : options.makeMaterial({ ...material }),
  );
  mesh.position.set(position[0], position[1], position[2]);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  group.add(mesh);
  return mesh;
}

export function createTransitStationSigns(options: TransitStationSignsOptions): TransitStationSigns {
  const entities: SceneInterestPointEntity[] = [];
  const groups: THREE.Group[] = [];
  // 年份贴片共享资源（10 站双面复用同一纹理/材质；dispose 时一并释放）。
  const yearTexture = makeYearPlateTexture();
  const yearMaterial = new THREE.MeshStandardMaterial({
    map: yearTexture,
    emissive: 0xf7efdc,
    emissiveMap: yearTexture,
    emissiveIntensity: 0.42,
    transparent: false,
    alphaTest: 0.35,
    roughness: 0.5,
  });

  for (const station of TRANSIT_STATIONS) {
    const object = new THREE.Group();
    object.name = `${SIGN_NAME_PREFIX}-${station.id}`;
    object.position.set(station.platformX, station.baseY, station.platformZ);
    // 朝向：月台 = 泊位向岛心/路侧退让（STATION_PLATFORM_STANDOFF），故
    // platform − 泊位向量即朝向，local +Z 随之指向来客侧。
    object.rotation.y = Math.atan2(station.platformX - station.x, station.platformZ - station.z);

    // ① 月台板：月台场(baseY)上的候车台面，玩家落点即站于此。
    addSignMesh(object, options, new THREE.BoxGeometry(...BOARD_SIZE), BOARD_MATERIAL, [0, BOARD_BOTTOM_GAP + BOARD_SIZE[1] / 2, 0]);
    // ② 立柱：台尾轨道侧，自月台板顶立起。
    addSignMesh(
      object,
      options,
      new THREE.CylinderGeometry(PILLAR_RADIUS_TOP, PILLAR_RADIUS_BOTTOM, PILLAR_HEIGHT, 10),
      PILLAR_MATERIAL,
      [0, BOARD_TOP + PILLAR_HEIGHT / 2, PILLAR_Z],
    );
    // ③ 线路色牌面：乳白框 + 线路色板（双面可读，厚差 0.008 凸出工艺缝）。
    addSignMesh(object, options, new THREE.BoxGeometry(...SIGN_FRAME_SIZE), SIGN_FRAME_MATERIAL, [0, SIGN_CENTER_Y, PILLAR_Z]);
    addSignMesh(object, options, new THREE.BoxGeometry(...SIGN_PANEL_SIZE), LINE_SIGN_MATERIALS[station.line], [0, SIGN_CENTER_Y, PILLAR_Z]);
    // ④ 年份贴片（T6R-b）：线路色板 ±Z 面外各一片（工艺缝 0.004 见
    // YEAR_PLATE_Z），背面片绕 Y 转 π 使文字各自朝外（双面可读）；共享
    // yearMaterial 为自建材质，直传不进缓存（头注契约）。
    addSignMesh(object, options, new THREE.PlaneGeometry(YEAR_PLATE_SIZE[0], YEAR_PLATE_SIZE[1]), yearMaterial, [0, SIGN_CENTER_Y, PILLAR_Z + YEAR_PLATE_Z]);
    addSignMesh(object, options, new THREE.PlaneGeometry(YEAR_PLATE_SIZE[0], YEAR_PLATE_SIZE[1]), yearMaterial, [0, SIGN_CENTER_Y, PILLAR_Z - YEAR_PLATE_Z]).rotation.y = Math.PI;

    // tag 语义与 sceneInterestPoints.tag() 完全一致（module 间不导出私有助手）。
    object.traverse((child) => {
      if (child instanceof THREE.Mesh) child.userData.sceneInterestPointId = station.id;
    });

    options.scene.add(object);
    groups.push(object);
    // interactionPosition = 月台中心（object 原点），即 transitGroundY 恒等点。
    entities.push({ id: station.id, object, interactionPosition: object.position.clone() });
  }

  return {
    entities,
    dispose(): void {
      // 生命周期对齐 yearTownTransit.dispose：摘除场景节点（几何/材质由
      // ResourcePool 与材质缓存既有路径释放，勿在此重复 dispose）。
      for (const group of groups) group.parent?.remove(group);
      groups.length = 0;
      entities.length = 0;
      // 年份贴片例外（头注契约）：自建材质/纹理不进缓存，此处释放（10 站共享各一份）。
      yearMaterial.dispose();
      yearTexture.dispose();
    },
  };
}
