// 晨溪（river-chenxi）渲染器 —— 城北山谷的蜿蜒低多边形河流。
//
// 配置：city/data/terrain/river-chenxi.ts（CHENXI_RIVER，中心线为最终定稿）。
// 走向：东起山泉 (64,-95)，沿星语北城（NORTH_DISTRICT_AREA，路网 z ≤ -80、
// 导航可达至 z=-88）背后的山谷向西，河口 (-56,-98) 整段没入西海
// （西海面 y=0.06、不透明，覆盖 x∈[-139,-43.2±wobble]，见 westBeach.ts）。
//
// v2 改线（2026-10）：星语北城（PR #196）并入后占据 x∈[-33.5,33.5]、
// z∈[-36,-80]，旧线（z -52..-74）穿城且压在 150×150 的 district 平面
// （y=0.018，±75）上仅差 0.002。新线全程 z ≤ -95，与城区 keep-out 盒
// （x∈[-41,41], z∈[-88,-33]）、导航区（z ≥ -88）、district 平面（±75）
// 三者地理脱开，旧隐患一并消除。
//
// ── y 层约定（与其他地表保持明确间距；参见 rendering/layers.ts 的
//    SURFACE_Y 体系与 AGENTS.md 的远镜头 z-fighting 规则）────────────────
//   河床 RIVERBED_Y = 0.02：高于地面(0) 0.02。与 SURFACE_Y.district(0.018)
//     名义只差 0.002，但 district 平面（150×150，±75）与本河全程 z ≤ -95
//     地理不相交，不存在同屏共面网格，无 z-fighting 风险。
//   河岸 BANK_Y     = 0.024：高于河床 0.004（层间允许的最小间距），
//     低于 landscape(0.04) 0.016。
//   水面 WATER_Y    = 0.048：高于河岸 0.024；低于西海面(0.06) 0.012 ——
//     河口从海面下方滑入；高于 landscape(0.04) 0.008；远在沙滩(0.07)以南。
//
// ── 排除区（硬约束；条带顶点级钳制 + 岸景剔除双保险）──────────────────
//   - 星语北城与导航区（z ≥ -88 可步行）：全部条带顶点 min(z, -89.2)，
//     网格脚印不进 z > -89。min 对同环内 A≤B 的顶点保序，不会折叠条带；
//     中心线全程 z ≤ -95，北缘最坏 -95 + (3+0.35 抖动 + 2.5 岸) ≈ -89.15，
//     钳制实际不触发，仅作安全网。
//   - 西海面（岸线 ≈ -43.2 ± wobble，y=0.06）：岸景一律 x - r ≥ -40，
//     避免树干/石块立在海面上（河口段水面本身在海面之下，无需避让）。
//   - 离岛协作区 x < -64：河口条带最西顶点 ≈ -56.6（半宽 ≈3.35 × |P.x|≈0.1），
//     天然不进入；岸景另加 x - r < -63.4 剔除。
//
// 动画：水面用 createPondWaterSurface（与海面共享法线贴图的轻量水体着色
// 器，无镜像渲染目标），update(elapsed) 推进其 time uniform 与昼夜色过渡；
// 无第二 WebGLRenderer、无 scene.fog、不改相机/背景。dispose 遵循
// westBeach / sceneInterestPoints 的 userData.dynamicMaterial 约定。
import * as THREE from 'three';
import { createPondWaterSurface } from '../animatedWater';
import { CHENXI_RIVER } from '../../city/data/terrain/river-chenxi';

// ── y 层（本文件唯一事实来源，间距论证见头注释）───────────────────────
const RIVERBED_Y = 0.02;
const BANK_Y = 0.024;
const WATER_Y = 0.048;

// ── 形状参数 ──────────────────────────────────────────────────────────
const RING_COUNT = 104; // 曲线采样环数（105 个中心点；河长约 121 → ≈1.2 单位/环）
const SPRING_HALF_WIDTH = 2; // 源头半宽（全宽 4，向上游收细）
const MOUTH_HALF_WIDTH = 3; // 河口半宽（全宽 6，山谷河幅比旧线收窄）
const MIN_HALF_WIDTH = 0.6; // 抖动下的半宽下限
const BED_EXTRA = 1.5; // 河床条带每侧比水面外扩
const BANK_INNER_EXTRA = 0.15; // 河岸内缘：水线外一点，露出窄条湿河床沿
const BANK_EXTRA = 3.5; // 河岸外缘
const MOUTH_FADE_START_T = 0.86; // 河口段（x < -56 一带）河床/岸按弧长收窄消失
const MOUTH_FADE_END_T = 0.99; // 水面本身不收窄，继续滑入海面下方
const WIDTH_WOBBLE = 0.35; // 半宽抖动幅度（世界单位）
const WOBBLE_SEED = 20261002; // 固定种子——宽度抖动必须确定性，禁止 Math.random
const SCENERY_SEED = 7041991; // 岸景布置种子（同上）
const PINE_CANDIDATES = 42; // 候选数（剔除后实际布置约 20-24 棵）
const BOULDER_CANDIDATES = 18; // 候选数（剔除后实际布置约 12-14 块）

// ── 排除区钳制参数（论证见头注释）─────────────────────────────────────
const NAV_EDGE_Z = -89.2; // 星语北城/导航区（可步行至 z=-88）以南，再留 1.2 边距
const SEA_SCENERY_MIN_X = -40; // 岸景最西界（海岸线 ≈ -43.2±wobble 以东）
const ISLAND_SCENERY_MIN_X = -63.4; // 离岛协作区 x < -64 以东
const GROUND_LIMIT = 104; // 地面 ±110 内留边距

/**
 * 确定性 PRNG（mulberry32）：宽度抖动与岸景布置都靠它，固定种子保证
 * 每次构建几何完全一致——绝不能用 Math.random（会破坏布局校验与回放）。
 */
function mulberry32(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) | 0;
    let mixed = Math.imul(state ^ (state >>> 15), 1 | state);
    mixed = (mixed + Math.imul(mixed ^ (mixed >>> 7), 61 | mixed)) ^ mixed;
    return ((mixed ^ (mixed >>> 14)) >>> 0) / 4294967296;
  };
}

/** 半宽抖动：固定种子的白噪声经两轮邻域平滑，避免逐环锯齿。 */
function buildWidthWobble(ringCount: number): number[] {
  const rand = mulberry32(WOBBLE_SEED);
  const raw: number[] = [];
  for (let i = 0; i < ringCount; i += 1) raw.push(rand() * 2 - 1);
  let smoothed = raw;
  for (let pass = 0; pass < 2; pass += 1) {
    const previous = smoothed;
    smoothed = previous.map((value, i) => (
      (previous[Math.max(0, i - 1)]! + value * 2 + previous[Math.min(previous.length - 1, i + 1)]!) / 4
    ));
  }
  return smoothed.map((value) => value * WIDTH_WOBBLE);
}

type StripInput = {
  centers: readonly THREE.Vector3[];
  perps: readonly THREE.Vector3[];
  /** 环 i 的两条边在 +perp 方向上的偏移（须 offsetA ≤ offsetB，见下）。 */
  offsetA: (index: number) => number;
  offsetB: (index: number) => number;
  y: number;
};

/**
 * 沿曲线构建贴地水平条带：每环两个顶点（A → B 沿 +perp 递增，保证三角形
 * 绕向朝上、法线 +y 时为正面）。法线逐顶点手填 +y——水平条带不需要
 * computeVertexNormals，也避免钳制产生的零面积三角形引入退化法线。
 */
function buildStrip(input: StripInput): THREE.BufferGeometry {
  const { centers, perps, offsetA, offsetB, y } = input;
  const ringCount = centers.length;
  const positions: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];
  for (let i = 0; i < ringCount; i += 1) {
    const center = centers[i]!;
    const perp = perps[i]!;
    const v = i / (ringCount - 1);
    const offsets = [offsetA(i), offsetB(i)];
    for (let side = 0; side < 2; side += 1) {
      const offset = offsets[side]!;
      let vz = center.z + perp.z * offset;
      // 排除区钳制：星语北城/导航区以南（对 z 单调，环内 A≤B 保序 → 无折叠）。
      vz = Math.min(vz, NAV_EDGE_Z);
      positions.push(center.x + perp.x * offset, y, vz);
      uvs.push(side, v);
    }
  }
  for (let i = 0; i < ringCount - 1; i += 1) {
    const a = i * 2;
    indices.push(a, a + 2, a + 3, a, a + 3, a + 1);
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  const normals = new Float32Array(positions.length);
  for (let n = 1; n < normals.length; n += 3) normals[n] = 1;
  geometry.setAttribute('normal', new THREE.BufferAttribute(normals, 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geometry.setIndex(indices);
  return geometry;
}

export type RiverChenxiOptions = {
  scene: THREE.Scene;
};

export type RiverChenxiHandle = {
  object: THREE.Group;
  update(elapsedSeconds: number): void;
  /** 可选昼夜接口（未接线时水面保持日间色调），与 westBeach 的约定一致。 */
  setDaylight?(value: number, instant?: boolean): void;
  dispose(): void;
};

export function createRiverChenxi(options: RiverChenxiOptions): RiverChenxiHandle {
  const object = new THREE.Group();
  object.name = 'river-chenxi';

  const config = CHENXI_RIVER[0];
  const path = config?.path ?? [];
  if (path.length < 2) {
    // 防御：配置缺路径时保持空组（CHENXI_RIVER 内置完整路径，正常不触发）。
    options.scene.add(object);
    return {
      object,
      update() {},
      dispose() {
        object.removeFromParent();
      },
    };
  }

  const curve = new THREE.CatmullRomCurve3(
    path.map(([x, z]) => new THREE.Vector3(x, 0, z)),
    false,
    'centripetal', // 向心参数化：控制点间过冲最小，中心线稳定在 z ≤ -95
  );
  const centers = curve.getSpacedPoints(RING_COUNT);
  const lastRing = centers.length - 1;
  const tangents = centers.map((center, i) => {
    const prev = centers[Math.max(0, i - 1)]!;
    const next = centers[Math.min(lastRing, i + 1)]!;
    return new THREE.Vector3(next.x - prev.x, 0, next.z - prev.z).normalize();
  });
  // +perp = 行进方向北侧（z 分量恒正：河水全程向西，T.x < 0 → P.z = -T.x > 0）
  const perps = tangents.map((tangent) => new THREE.Vector3(tangent.z, 0, -tangent.x));

  // 半宽：源头 2 → 河口 3（smoothstep 缓动）+ 确定性抖动，免得像激光笔直
  const wobble = buildWidthWobble(centers.length);
  const halfWidths = centers.map((_, i) => {
    const t = i / lastRing;
    const ease = t * t * (3 - 2 * t);
    return Math.max(MIN_HALF_WIDTH, THREE.MathUtils.lerp(SPRING_HALF_WIDTH, MOUTH_HALF_WIDTH, ease) + wobble[i]!);
  });
  // 河口段河床/岸按弧长收窄消失；水面不收窄，继续伸到路径终点（在海面下）
  const mouthFades = centers.map((_, i) => (
    1 - THREE.MathUtils.smoothstep(i / lastRing, MOUTH_FADE_START_T, MOUTH_FADE_END_T)
  ));

  const disposables: Array<{ dispose(): void }> = [];

  function addStrip(geometry: THREE.BufferGeometry, material: THREE.MeshStandardMaterial, name: string): void {
    const mesh = new THREE.Mesh(geometry, material);
    mesh.name = name;
    mesh.receiveShadow = true;
    mesh.userData.dynamicMaterial = material;
    disposables.push(geometry);
    object.add(mesh);
  }

  // 河床：暗色湿砾/淤泥；水面（alpha 0.9）微微透出它，读作浅水河底
  const bedMaterial = new THREE.MeshStandardMaterial({ color: 0x4c463d, roughness: 0.96, metalness: 0 });
  // 河岸：暖色浅沙砾，贴近 CG 里河带两侧的浅色滩地
  const bankMaterial = new THREE.MeshStandardMaterial({ color: 0xd8c49c, roughness: 0.98, metalness: 0 });
  disposables.push(bedMaterial, bankMaterial);

  addStrip(
    buildStrip({
      centers,
      perps,
      y: RIVERBED_Y,
      offsetA: (i) => -(halfWidths[i]! + BED_EXTRA) * mouthFades[i]!,
      offsetB: (i) => (halfWidths[i]! + BED_EXTRA) * mouthFades[i]!,
    }),
    bedMaterial,
    'river-chenxi-bed',
  );

  // 河岸是两侧的环带（内缘水线外 0.15 → 外缘 +3.5），不整片盖住河床：
  // 水下看得到暗色河床，水线外是 0.004 高的浅色滩岸
  addStrip(
    buildStrip({
      centers,
      perps,
      y: BANK_Y,
      offsetA: (i) => (halfWidths[i]! + BANK_INNER_EXTRA) * mouthFades[i]!,
      offsetB: (i) => (halfWidths[i]! + BANK_EXTRA) * mouthFades[i]!,
    }),
    bankMaterial,
    'river-chenxi-bank-north',
  );
  addStrip(
    buildStrip({
      centers,
      perps,
      y: BANK_Y,
      offsetA: (i) => -(halfWidths[i]! + BANK_EXTRA) * mouthFades[i]!,
      offsetB: (i) => -(halfWidths[i]! + BANK_INNER_EXTRA) * mouthFades[i]!,
    }),
    bankMaterial,
    'river-chenxi-bank-south',
  );

  // 水面条带：源头细、河口宽，全程等高 WATER_Y（河口滑入 0.06 的海面下方，
  // 与海面 0.012 间距、与 landscape 0.008 间距，远镜头不闪）
  const waterGeometry = buildStrip({
    centers,
    perps,
    y: WATER_Y,
    offsetA: (i) => -halfWidths[i]!,
    offsetB: (i) => halfWidths[i]!,
  });
  // renderHint.color（0x7fb5c9 淡青）作日间水色：与 PALETTE 的冷青水系
  // （RIVER 0x5a8fb8、海面 0x0d3b5e）同族但更浅，呼应 CG 启动图里的淡青河带
  const waterColorDay = new THREE.Color(config?.renderHint?.color ?? 0x7fb5c9);
  const waterSurface = createPondWaterSurface(waterGeometry, {
    // 与 westBeach 海面同一太阳方向/日色，反光方向保持一致
    sunDirection: new THREE.Vector3(0.5, 0.8, 0.35),
    waterColorDay,
    waterColorNight: new THREE.Color(0x1c3b46),
    sunColorDay: new THREE.Color(0xbdd4e6),
    sunColorNight: new THREE.Color(0x3a4a6a),
    timeScale: 0.8,
    // pond 着色器按世界坐标采样法线：size 7.5 → 主涟漪 tile ≈ 103/7.5 ≈ 14
    // 世界单位，在 5-6 宽的河面上能看到流动的细波纹
    size: 7.5,
    alpha: 0.9, // 轻微透出下方 0.028 处的深色河床
  });
  waterSurface.water.name = 'river-chenxi-water';
  object.add(waterSurface.water);
  disposables.push(waterGeometry, waterSurface.water.material as THREE.Material);

  // ── 岸景：低多边形松林与砾石（固定种子确定性布置；落入排除区/海面的
  //    候选直接剔除，几何共享以控制 draw call 与 dispose 次数）──────────
  const pineTrunkGeometry = new THREE.CylinderGeometry(0.07, 0.12, 0.5, 6);
  const pineConeGeometries = [
    new THREE.ConeGeometry(0.66, 1.05, 7),
    new THREE.ConeGeometry(0.5, 0.9, 7),
    new THREE.ConeGeometry(0.34, 0.7, 7),
  ];
  const boulderGeometry = new THREE.IcosahedronGeometry(1, 0); // detail 0，flatShading 下读作碎石块
  const pineMaterials = [0x2f5c3e, 0x3a6a48, 0x477952].map(
    (color) => new THREE.MeshStandardMaterial({ color, roughness: 0.95, metalness: 0, flatShading: true }),
  );
  const trunkMaterial = new THREE.MeshStandardMaterial({ color: 0x6b4f37, roughness: 0.92, metalness: 0, flatShading: true });
  const boulderMaterials = [0x8f887c, 0xa39b8d].map(
    (color) => new THREE.MeshStandardMaterial({ color, roughness: 0.9, metalness: 0, flatShading: true }),
  );
  disposables.push(
    pineTrunkGeometry,
    ...pineConeGeometries,
    boulderGeometry,
    ...pineMaterials,
    trunkMaterial,
    ...boulderMaterials,
  );

  const sceneryRand = mulberry32(SCENERY_SEED);

  function frameAt(t: number): { center: THREE.Vector3; perp: THREE.Vector3; tangent: THREE.Vector3; index: number } {
    const index = Math.min(lastRing, Math.max(0, Math.round(t * lastRing)));
    return { center: centers[index]!, perp: perps[index]!, tangent: tangents[index]!, index };
  }

  function isScenerySpotClear(x: number, z: number, radius: number): boolean {
    if (z + radius > NAV_EDGE_Z) return false; // 星语北城/导航区（z > -88 一侧）
    if (x - radius < SEA_SCENERY_MIN_X) return false; // 西海面（树/石不得立在水面上）
    if (x - radius < ISLAND_SCENERY_MIN_X) return false; // 离岛协作区
    if (Math.abs(x) > GROUND_LIMIT || Math.abs(z) > GROUND_LIMIT) return false; // 地面范围
    return true;
  }

  function createPine(): THREE.Group {
    const pine = new THREE.Group();
    const scale = 0.8 + sceneryRand() * 0.8;
    const trunk = new THREE.Mesh(pineTrunkGeometry, trunkMaterial);
    trunk.position.y = 0.25;
    trunk.castShadow = true;
    pine.add(trunk);
    const coneYs = [0.95, 1.55, 2.1]; // 三层叠锥，底部直径递减
    pineConeGeometries.forEach((geometry, index) => {
      const cone = new THREE.Mesh(geometry, pineMaterials[Math.floor(sceneryRand() * pineMaterials.length)]!);
      cone.position.y = coneYs[index]!;
      cone.rotation.y = sceneryRand() * Math.PI * 2;
      cone.castShadow = true;
      pine.add(cone);
    });
    pine.scale.setScalar(scale);
    pine.rotation.y = sceneryRand() * Math.PI * 2;
    pine.rotation.z = (sceneryRand() - 0.5) * 0.07;
    return pine;
  }

  function createBoulder(): THREE.Mesh {
    const boulder = new THREE.Mesh(
      boulderGeometry,
      boulderMaterials[Math.floor(sceneryRand() * boulderMaterials.length)]!,
    );
    const size = 0.3 + sceneryRand() * 0.6;
    // 非均匀缩放 + 随机旋转 = 低多边形"圆润乱石"
    boulder.scale.set(
      size * (0.75 + sceneryRand() * 0.5),
      size * (0.55 + sceneryRand() * 0.4),
      size * (0.75 + sceneryRand() * 0.5),
    );
    boulder.rotation.set(sceneryRand() * Math.PI, sceneryRand() * Math.PI, sceneryRand() * Math.PI);
    boulder.position.y = boulder.scale.y * 0.45; // 半嵌入地面/岸线
    boulder.castShadow = true;
    boulder.receiveShadow = true;
    return boulder;
  }

  // 松树：沿河两岸疏林，距中心线 ≥5（岸外缘之外），整株下沉 0.05 入地
  let placedPines = 0;
  for (let i = 0; i < PINE_CANDIDATES; i += 1) {
    const t = (i + sceneryRand() * 0.9 + 0.05) / PINE_CANDIDATES;
    const side = sceneryRand() < 0.5 ? 1 : -1;
    const { center, perp, tangent, index } = frameAt(t);
    const offset = Math.max(5, halfWidths[index]! + BANK_EXTRA + 0.8 + sceneryRand() * 3.2);
    const along = (sceneryRand() - 0.5) * 2.4;
    const x = center.x + perp.x * offset * side + tangent.x * along;
    const z = center.z + perp.z * offset * side + tangent.z * along;
    if (!isScenerySpotClear(x, z, 1.6)) continue;
    const pine = createPine();
    pine.position.set(x, -0.05, z);
    object.add(pine);
    placedPines += 1;
  }

  // 砾石：贴水线的滩地上
  let placedBoulders = 0;
  for (let i = 0; i < BOULDER_CANDIDATES; i += 1) {
    const t = (i + sceneryRand() * 0.8 + 0.1) / BOULDER_CANDIDATES;
    const side = sceneryRand() < 0.5 ? 1 : -1;
    const { center, perp, tangent, index } = frameAt(t);
    const offset = halfWidths[index]! + 0.3 + sceneryRand() * 2.4;
    const along = (sceneryRand() - 0.5) * 2.0;
    const x = center.x + perp.x * offset * side + tangent.x * along;
    const z = center.z + perp.z * offset * side + tangent.z * along;
    if (!isScenerySpotClear(x, z, 1.0)) continue;
    const boulder = createBoulder();
    boulder.position.x = x;
    boulder.position.z = z;
    object.add(boulder);
    placedBoulders += 1;
  }
  // 两个计数仅用于确认布点没有全军覆没（保持判定不改）；相对规格的
  // ~20-40 松 / ~10-16 砾石留有余量
  if (placedPines < 10 || placedBoulders < 6) {
    console.warn('[riverChenxi] scenery mostly rejected by keep-out checks', placedPines, placedBoulders);
  }

  options.scene.add(object);

  return {
    object,
    update(elapsedSeconds: number) {
      // 水面动画：pond 水体着色器的 time uniform（四层法线贴图漂移）+
      // 日/夜水色与日光色的缓动过渡
      waterSurface.update(elapsedSeconds);
    },
    setDaylight(value: number, instant = false) {
      waterSurface.setDaylight(value, instant);
    },
    dispose() {
      object.removeFromParent();
      for (const disposable of disposables) disposable.dispose();
      disposables.length = 0;
    },
  };
}
