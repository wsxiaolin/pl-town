# pl-town 可信地形改造 — 技术方案（Decision Record）

> 任务：地形改造方案设计（可信地形改造管道 T1）
> 日期：2026-10-11（Asia/Shanghai）
> 基线：commit `9d68c2c`（见 docs/terrain-baseline-report.md，typecheck / test:domain / build 全绿）
> 上游依据：/home/z/my-project/GOAL.md（红线与 DoD）、AGENTS.md（工程规范）
> 本文是后续实现任务（T2..T6）的唯一技术依据；与现状代码冲突时以本文为准并同步修订。

---

## 0. 方案总览与核心决策速览

| # | 决策点 | 结论 |
|---|---|---|
| D1 | 采样器落位 | `city/data/terrain/heightfield/`（4 个新文件 + meadowField 收编迁移） |
| D2 | 聚合模型 | 台地平坦 mask × 城外起伏场（meadow 收编 + 河谷下切 + 海床下切），背景全域回退 0 |
| D3 | 台地基准 | **0**（台地内 `terrainHeight` 严格 ≡ 0，城区一切既有 y 落位零变化） |
| D4 | 台地范围 | 单盒 x∈[-75,78] z∈[-90,78] + 观星走廊盒 x∈[78,88] z∈[-12,12] |
| D5 | 道路方案 | **组合**：台地内维持 SURFACE_Y 层叠；城外延伸段（出城步道）**切槽压平**（road cut + 两侧融合坡） |
| D6 | 水体 | 海 0.06 / 湾 0.08 不变（唯一 mirror Water）；晨溪改沿程水位表（源头 -0.10 → 中游 -0.45 → 河口 0.075），animatedWater 轻量水面 |
| D7 | 世界地形面 | farGround（220×220 平面）改造为**非均匀格点的全域地形网格**（1 个 draw call 承载全部地面高度） |
| D8 | 城外四要素 | 山脊/丘陵群 ✓（岚屏岭）、河谷 ✓（晨溪下切）、崖壁 ✓（观星崖）、林地 ✓（松涛林×10 + 晨溪岸林）——**全部复用现有配置，无新增 TerrainFeatureConfig** |
| D9 | 湖 | 本期不新增（河谷已满足 GOAL「河谷或湖」；接口预留见 §7.4） |

**红线自检**：不移动任何建筑坐标；不动 `CITY_CONSTRUCTION_CONFIG`；不动 `apps/server`；全程不 git commit/push。

---

## 1. 现状事实（方案依据的坐标契约）

实现前须知的既有事实（改动这些 = 必须先过 worldTerrainAudit）：

1. **y 落位全部硬编码 0 或 SURFACE_Y 绝对层**：`roadNavigation.resolveMovement` 返回 `y=0`；`playerController`/`cameraController`/`firstPersonController`/`npcSystem` 的 cursor/target `y=0`。
2. **SURFACE_Y 层系**（rendering/layers.ts）：base 0 → district 0.018 → plaza 0.036 / buildingPlot 0.036 → landscape 0.04 → cityGroundDetail 0.052 → road 0.065 → roadSurface 0.10 → roadMarking 0.11 → water 0.105 → navigationTarget 0.145；相邻层最小差 0.004（plaza↔landscape，z-fighting 红线）。
3. **西海面 y=0.06 不透明**，覆盖 x ≤ -43.2±wobble；沙滩 0.07（x∈[-44.4,-33]）；湾面 0.08；羽流唇 0.064；玩家深水推回 `deepWaterX=-44.5`。
4. **晨溪**：河床 0.02 / 岸 0.024 / 水面 0.048——全部「贴地薄水」；中心线 z ≤ -95，河口水位即海。
5. **世界裙板**：farGround = PlaneGeometry(220,220) y=0（±110），外海底面 900×900 y=-0.4 在其下兜底。
6. **山体**是凸出 massif 体块（底环埋 -0.35），**不是**地形场；岚屏岭主脊 z≈-200..-234、麓丘 z≈-122，山脚区现状为平地。
7. **草甸高度场** `sampleCitysideMeadowY`（rendering/terrain/meadowField.ts）：纯函数、双频 fBm、五重软塌陷 mask（可步行区/河谷/河口湾/海域/麓原），可步行区内埋地 ≤ -0.075。
8. **导航边界** NAVIGABLE_AREA x[-50,76] z[-88.2,50]（worldTerrainAudit 从 cityConfig 推导并快照断言）；WORLD_BOUNDS 同源。
9. **多人位置同步**：payload 含 y 字段——FPC 路径硬编码 `y: 0`（MiniCityApp.ts:657），俯视路径发 `cursor.position.y`（:698，现状恒 0）。本方案统一发真实 y，见 §6.5 检查点。
10. **玩家活动钳制**：`resolveMovement` 按 WORLD_BOUNDS（从 CITY_LIMIT + 路网节点推导，≈ NAVIGABLE_AREA）钳制——现状玩家到不了城外；城外可达性是本方案新增（§6.1）。

---

## 2. 采样器设计（D1/D2/D3）

### 2.1 落位与依赖方向

新目录 `apps/web/src/city/data/terrain/heightfield/`，全部纯函数、零 Three.js 依赖（node:test 可直接跑）：

```
city/data/terrain/heightfield/
├── noiseCore.ts        # 确定性噪声：fbm2 / valueNoise2 / hashString / mulberry32 / smoothStep
├── meadowField.ts      # ← 从 rendering/terrain/meadowField.ts 收编迁移（签名不变）
├── plateauField.ts     # 台地盒并集 SDF + 边缘过渡 mask（§3）
├── worldReliefField.ts # 城外起伏场：草甸收编 + 河谷下切 + 海床下切（§4）
└── terrainHeight.ts    # 聚合入口 + surfaceY(x,z,layer) 落位 helper
```

- **依赖方向**：`data/terrain/heightfield` ← `rendering/terrain/*`、`city/navigation/*`、`city/debugApi`。data 层不 import rendering（AGENTS.md 分层铁律）。
- **兼容壳**：`rendering/terrain/meadowField.ts` 保留为 re-export 壳（`export * from '../../city/data/terrain/heightfield/meadowField'`），`cityGround.ts` 与 `worldTerrainAudit.test.ts` 的既有 import 零改动。
- **massifGeometry.ts**：`fbm2/hashString/mulberry32` 等纯函数改为从 noiseCore re-export（mountainRanges 等调用点零改动）。

### 2.2 聚合模型

```text
terrainHeight(x, z):
  plateau = plateauFlat(x, z)          // ∈ [0,1]，台地盒并集内严格 0，边缘外随距离升到 1
  relief  = worldRelief(x, z)          // 城外起伏场（可为负：河谷/海床）
  return (1 - plateau) * relief        // 台地内 → 严格 0.0；台地外 → 起伏场；裙坡带 → 混合
```

`worldRelief` 的分量与组合（各分量自带域 mask，重叠区按下列优先级调和）：

```text
worldRelief(x, z) = meadowRelief(x, z) + min(riverCut(x, z), seaBedCut(x, z))
```

- `meadowRelief`：收编后的草甸场（§2.4），域 = 两瓣草甸包围盒，正场（0..3.4）。
- `riverCut`：晨溪河谷带状负场（§4.2），域 = RIVER_VALLEY_BOX。
- `seaBedCut`：西海海床负场（§4.3），域 = x < -75 的海面 z∈[-112,112]。
- 河口区（ESTUARY_BBOX 西段，z < -90）`min()` 取更深者：河口河床（≈-0.29）高于外侧渐深海床（≈-0.9..-2.0），自然形成「拦门沙」浅埂，羽流/湾面资产不动；ESTUARY_BBOX 的 z ≥ -90 段在台地内（=0），湾面维持现状「悬于平地」读感，零回归。
- **背景全域回退 0**：未列入任何域的位置（东郊平原、山脚、外海远缘）terrainHeight = 0——保证既有资产（岛基 -0.6、外海底 -0.4、沙滩、麓原）y 语义不变，山体 massif 底环贴 `terrainHeight - 0.35` 在山脚区恒等于现状 -0.35，**几何零回归**。

### 2.3 纯函数与确定性策略

- 全部噪声走 noiseCore 的格点哈希 value noise（massif 先例），**禁用 Math.random / Date / 任* 何环境态**。
- 种子：草甸沿用 `MEADOW_GLOBAL_SEED = 0x6d65646f`；河谷场 `0x76616c65`（'vale'）；海床场 `0x73656162`（'seab'）；台地无随机成分（纯 SDF）。
- fBm 阶数 3、格点密度沿用 massif 量级（broad 0.05/unit、fine 0.13/unit）。
- 单测固化确定性：全域 2u 步进采样求和，对结果十六进制摘要做快照断言（任何改场行为都会被审计捕获）。

### 2.4 与既有局部场的关系（收编清单）

| 既有场/常量 | 处置 |
|---|---|
| `sampleCitysideMeadowY`（草甸场） | **收编**：文件迁至 heightfield/，签名不变；内部 mask 从「五重埋地塌陷」改为「台地平坦 mask（替代 walkable 盒）+ 河谷/河口湾/海域/麓原四重域塌陷（保留）」——台地内从「埋地 -0.08」变「归 0」，由 terrainHeight 的台地项接管 |
| `fbm2 / hashString / mulberry32`（massifGeometry） | **提取**至 noiseCore，massifGeometry re-export |
| massif 山体高度场（lobe/radial） | **不收编**：山是叠在地形上的凸出体块，terrainHeight 只保证「山脚地面」正确（背景 0） |
| `ESTUARY_PROFILE / ESTUARY_BBOX`（river-chenxi.ts） | **复用**：河水位表河口端与羽流衔接的锚点 |
| `WEST_BEACH.shorelineX / westBeachWaterlineMaxX`（cityConfig） | **复用**：海床场岸线参考（实际下切起点取固定 -75 = 台地西缘，见 §4.3，避开 wobble 抖动） |
| `RIVER_VALLEY_BOX`（meadowField/mountainRanges 共用） | **复用**：河谷场域盒，提为 heightfield 导出常量 |

### 2.5 SURFACE_Y 语义改写（相对层偏移）

- `layers.ts` 的 SURFACE_Y **数值全部不变**，语义从「绝对 y」改写为「相对 terrainHeight 的层偏移」，头注释同步修订。
- 落位统一走新 helper（terrainHeight.ts）：

```ts
export function surfaceY(x: number, z: number, layer: keyof typeof SURFACE_Y): number {
  return terrainHeight(x, z) + SURFACE_Y[layer];
}
```

- 消费点改写（绝对 → `surfaceY(x,z,layer)`）：`createCitySurfaces`（路面/斑马线/广场，district relief 网格见 §3.4 豁免）、`buildingSceneController`（plot）、`worldDecorations`（path/plot/树/长椅/灯）、`navigationTargetMarker`、`cityConstructionScene`、`cityWorldAssembly`（北城树阵 `[x,0,z]`）。
- **z-fighting 红线论证**：台地内 `terrainHeight ≡ 0` → 全部 y 与层差结构原样保留（plaza↔landscape 0.004 不变）。台地外新增贴地层（出城步道、河岸带、湿滩）一律 `terrainHeight(x,z) + 层偏移(≥0.004)`，且顶点与地形面**同源采样**（同一解析函数），不出现「网格插值 vs 解析值」的错位共面。

---

## 3. 台地设计（D3/D4）

### 3.1 空间范围

```ts
// plateauField.ts（纯常量，写头注释审计口径）
export const PLATEAU_MAIN     = { x0: -75, x1: 78, z0: -90, z1: 78 };  // 主城+北城+城郊平坦带
export const PLATEAU_CORRIDOR = { x0: 78, x1: 88, z0: -12, z1: 12 };   // 观星走廊东段
export const PLATEAU_SKIRT_W  = 14;   // 边缘过渡坡宽度（盒外）
```

**覆盖论证**（全部平坦，过渡坡一律在盒外）：

| 须覆盖区 | 范围 | 覆盖者 |
|---|---|---|
| NAVIGABLE_AREA（导航可达区） | x[-50,76] z[-88.2,50] | MAIN 完整包含 ✓ |
| 主城 district 铺装 + CITY_GROUND_PLAN | ±75 | MAIN 完整包含（含被海面遮住的西半 x∈[-75,-43]）✓ |
| 星语北城（含 keep-out 外扩 8） | x[-41,41] z[-88,-33] | MAIN ✓ |
| 观星走廊 | x[36,88] z[-12,12] | MAIN(x≤78) + CORRIDOR(x>78) ✓ |
| 西海滩可走区 | x ≥ -44.5（deepWaterX 推回界） | MAIN 西缘 -75 ✓（x∈[-75,-44.5] 为海面下的涉水浅滩台地，现状即平地薄水） |

- MAIN 西界取 **-75**（= district 西缘）：保证「一切城区资产（含 district relief 网格全域）都站在台地上」，不产生「城区平面悬于海床上方」的假地形读数；代价是西海浅滩带更长（x∈[-75,-86] 为 0→-0.9 滩涂缓坡，见 §4.3）——「岸 → 浅滩 → 渐深」梯度本身就是真实海床形态。台地西缘与岸线（-43.2±wobble）之间的海面下平地在现状即存在（farGround y=0 被海面 0.06 遮盖），改造后保持为浅滩，**不透明水档视觉零变化**。
- MAIN 北界 -90：含北城导航边界 -88.2 + 1.8 缓冲；晨溪中心线 z ≤ -95，河谷下切从台地缘外开始，河槽成型空间充足。
- MAIN 东/南界 78：district ±75 + 3 缓冲；东南象限台地外为东郊平原（背景 0，裙坡无高差）。

### 3.2 台地基准高度

**PLATEAU_BASE_Y = 0**。这是本方案最重要的兼容性决策：

- 城区全部 SURFACE_Y 层、district relief（amplitude 0.004）、沙滩 0.07、海面 0.06 在台地内的绝对 y **全部不变**；
- 「禁止硬编码 0 落位」红线的达成方式：落位公式统一为 `surfaceY(x,z,layer)`，台地内数值上等于 0，但语义上来自采样器——单测断言 NAVIGABLE_AREA 全域 `terrainHeight === 0` 封锁回归。

### 3.3 边缘过渡坡（skirt）

- 过渡函数：`plateauFlat = 1 - smoothstep(0, PLATEAU_SKIRT_W, distOutsideBoxes(x,z))`（盒并集 SDF 的外距离，smoothstep 用 noiseCore 版）。
- 坡度预算（最陡方向，裙坡 14 宽 + 场域自身变化）：

| 台地边缘 | 外侧场 | 高差 | 最大坡度 | 可通行 |
|---|---|---|---|---|
| 南缘 z=78（x∈[-42,110]） | 南草甸起伏 | 0 → ~3.4 | ≈ 0.24（13.5°） | ✓ |
| 北缘 z=-90（x∈[-62,68]） | 河谷下切 | 0 → -0.85 | ≈ 0.06 + 谷坡 | ✓（谷坡段另有 §5 阈值） |
| 西缘 x=-75 | 海床下切 | 0 → -0.9（至 -86） | ≈ 0.08（滩涂缓坡） | 浅滩可涉水，深水推回 §6.3 |
| 东缘 x=78 / 走廊端 x=88 | 东郊平原 | 0 → 0 | 0 | ✓ |

### 3.4 对 2D 系统的论证（治理 / 寻路 / 碰撞）

- **治理布局**：建筑坐标、district 分区、CITY_CONSTRUCTION_CONFIG 零改动；台地内地面高度不变 → 服务端治理与施工回放（贴地建筑）无感。
- **寻路网格**：城区路网节点全部在台地内 → `terrainHeight ≡ 0` → 现有图结构、WORLD_BOUNDS 公式不变（边界值随城外步道节点按既有公式外扩，见 §6.1）。城外新增可达性走「坡度判定」新逻辑（§6.1），不动现有图。
- **碰撞**：AABB（XZ 平面）碰撞盒、障碍组注册逻辑不变；地形阻挡（坡度/水域）作为 movement 层判定加入（§6.3），与建筑碰撞正交。
- **豁免声明**：district relief 网格（150×150、y=0.018±0.004）**不改**为采样化——它整体在台地内（±75 ⊂ MAIN），其 y 已与 terrainHeight(=0) + district 层自洽；改它只会引入无谓回归。

---

## 4. 城外地势清单（D8）：盘点 + 场参数

### 4.1 盘点结论（四要素齐全，无需新增 TerrainFeatureConfig）

| GOAL 要素 | 现有配置 | 本方案动作 |
|---|---|---|
| 山脊/丘陵群 | 岚屏岭主脊 7 峰（h 104..208，z -200..-234）+ 麓丘链 + 溪北丘三座（h 13..15） | 渲染层底环贴 terrainHeight - bury（山脚区=0 → 几何零变化，代码路径统一） |
| 河谷 | 晨溪（CHENXI_RIVER_PATH，z ≤ -95） | **重点改造**：河谷真实下切 + 沿程水位（§4.2） |
| 崖壁 | 观星崖（range-lanping-cliff-02，x84 z-19，navigationBlocking）+ cliff-01 | 底座贴 terrainHeight（台地边缘带，预期 y≈0..0.05 微调） |
| 林地 | 松涛林 pine-01..10 + 晨溪岸林（river-chenxi-banks） | 落点 y 改 terrainHeight 采样（原贴 0） |
| （海） | 明澜外海 + 岛屿 + 岬角 | 海床下切给海以深度（§4.3），岛基保护区保浅 |

### 4.2 河谷下切场（riverCut，worldReliefField.ts 内常量表）

- 域：RIVER_VALLEY_BOX（x[-62,68] z[-110,-86]）与 ESTUARY_BBOX 河口段。
- **河床纵剖面**（沿 CHENXI_RIVER_PATH 弧长 t∈[0,1]，分段平滑插值）：

| t | 位置 | 河床 bedY | 水位 waterY | 水深 |
|---|---|---|---|---|
| 0 | 源头 (64,-95) | -0.45 | **-0.10** | 0.35 |
| 0.55 | 中游 (-6,-98) | -0.85 | **-0.45** | 0.40 |
| 1 | 河口 (-56,-98) | -0.285 | **0.075** | 0.36 |

  - 源头水位 -0.10 < 0：泉水洼地（水面低于周边地面，无悬河）。
  - 河口水位 0.075：低于湾面 0.08（河水汇入湾，保持「河不高于海」的既有刻意设计）；高于西海 0.06 的部分由湾面/羽流遮盖，衔接差 0.005 在层差红线之上。
- **谷形横剖面**（d = 到河中心线横向距离）：`|d| ≤ 半宽(t)`（水道，bedY）→ `半宽+2`（湿岸带，bedY→谷缘）→ `+8..12`（谷坡抬升到背景场），两翼谷缘微抬 shoulder ≤ +0.35（谷地读感），全程 smoothstep。
- 走廊宽度沿用渲染层 ESTUARY_PROFILE 同族逻辑（源头半宽 1.6 → 河口 6.0 的分段展宽规律不变）。

### 4.3 海床下切场（seaBedCut）

- 域：x < -75、z∈[-112,112]（海面 z 覆盖域）。
- 深度剖面（西向）：`x∈[-75,-86]` 0 → -0.9（滩涂缓坡，11 宽，含岸线自然过渡的远端梯度）；`x∈[-86,-100]` -0.9 → -2.0（渐深）；`x<-100` -2.0..-2.6（fBm 海床缓起伏 ±0.3，种子 'seab'）。海面下 x∈[-75,-44.5] 一段保持台地浅滩（0），「岸 → 浅滩 → 渐深」。
- **岛基保护区**：sea-minglan 全部 island/mountain 条目包围盒外扩 3 内，海床钳制 ≥ -0.7（岛底 -0.6 仍埋入；岛周形成真实浅滩环；保护区多落在滩涂/渐深段内，冲突由钳制兜底）。
- 军舰（俾斯麦 x-61 / 希佩尔 x-55）位于浅滩台地上方（海床 0，水深 0.06）——与现状「平地薄水」完全一致，零回归；海面/沙滩/浪花带资产 y 全部不动。

### 4.4 草甸场收编后形态

- 南瓣：z∈[78,110] 显形（过渡裙坡 z∈[78,92] 内从 0 爬到草甸起伏），z<78 压平；东北瓣：z∈[-110,-90] 显形。起伏幅度、fBm、装饰密度配置零改动。
- 「城外世界」地貌分布：北有河谷 + 雪岭、东北草甸、南山麓草甸、西滩海床 + 岛群、**东郊平原**（保留开阔田野——平原与丘陵的对比本身就是真实地貌，避免为起伏而起伏）。

---

## 5. 道路与地形方案（D5，用户要求写明选择）

**选择：组合方案 —— 台地内维持 SURFACE_Y 层叠；城外延伸段采用「切槽压平（road cut + 两侧融合坡度）」；不采用「沿坡爬升」。**

### 5.1 决策范围澄清

- 主城路网、北城横街、观星走廊（x≤88）：全部在台地内，天然平坦——现有 `SURFACE_Y.road` 贴层方案不变，无决策需求。
- 本期**唯一**的城外道路 = 出城步道（观景用途，如南草甸步道：主城南路出口 z=50 → 草甸观景点）。观星走廊 x>88 **不延伸**（ECHO 区到 88 即止，东端以缓坡平原收束，保持现有可达边界）。

### 5.2 理由

1. **与 2D 钳制运动兼容**：`resolveMovement` 的分轴滑动（X/Z 独立钳制）假设「路面横向水平」——沿坡爬升路段若顺坡倾斜，玩家横穿路面时 y 会横向变化，与分轴逻辑及正交俯视相机的取景假设冲突；切槽压平保证路面横向恒平、纵向上单一缓坡，`y = terrainHeight(x,z)` 的跟随自然退化为一维变化。
2. **视觉与管线一致性**：切槽路面 = 地形场内的一条「压平走廊」，路面与地形同源采样无缝；沿坡爬升需要独立路面网格贴坡，多一套几何与 z-fighting 风险面。
3. **成本**：城外步道只有 1~2 条，浅切槽实现小、回归面小。

### 5.3 切槽规格与步道定稿（worldReliefField 内常量）

- 槽深 0.25、槽宽 = 路宽（2.4）+ 两侧各 3.0 融合坡；纵坡 ≤ 8%；槽内 terrainHeight = 纵剖面（平滑），融合坡 smoothstep 回自然地形；路面层 `surfaceY(x,z,'road')`。
- **南草甸步道节点表（定稿，导航与审计快照据此推导）**：
  `S1 (6,44)`（主城南出口外）→ `S2 (18,66)` → `S3 (30,86)` → `S4 (34,96)`（观景平台，切槽压平半径 3）。
  纵剖面：S1 处 0 → S4 处 ≈ 2.4（草甸起伏内的压平平台），纵长 ~53、平均坡 4.5% ✓。

---

## 6. 导航与运动改造

### 6.1 坡度可通行判定

```ts
// terrainHeight.ts
export const WALKABLE_SLOPE_MAX = 0.45;   // ≈24°：明显坡但可走（草甸裙坡 0.24、滩涂 0.17 均放行）
export function slopeAlong(x: number, z: number, dirX: number, dirZ: number): number
// |terrainHeight(p + 0.6·dir) - terrainHeight(p)| / 0.6
```

- **策略**：导航图建边时（含城外新增节点）对每条边采样两端 + 中点的 `slopeAlong(边方向)`，任一点 > 阈值 → 阻断该边（不放行绕行，路径自然走缓坡）；台地内所有边 Δh ≡ 0 → **现有导航图与寻路行为零变化**。
- **WORLD_BOUNDS 扩展（城外可达的唯一入口）**：出城步道节点（§5.3 的 S1..S4）挂接 roadNavigation 的 `EXTRA_ROAD_NODES` 等价机制（cityConfig 既有节点不动）——WORLD_BOUNDS 按既有公式随新节点自动外扩为 x[-50,76] z[-88.2,104]，玩家由此获得南草甸漫游权；其余三向（东/北/西）可达边界不变。导航区扩大部分的地面即草甸起伏场，坡度判定在 movement 层兜底（图外自由移动时每步 slopeAlong 检查，> 阈值按分轴钳制回退）。

### 6.2 y 跟随（玩家 / NPC / 相机 / 第一人称）

| 调用点 | 现状 | 改为 |
|---|---|---|
| `roadNavigation.resolveMovement` | `result.set(x, 0, z)` | `result.set(x, terrainHeight(x,z), z)`（含 WEST_BEACH 推回分支） |
| `playerController` | `manualTarget/target/cursor y=0`（L91/123/129） | `terrainHeight(x,z)` |
| `cameraController.setTarget` | `target.set(x, 0, z)`（L81） | `target.set(x, terrainHeight(x,z), z)`；正交相机 offset 不变 |
| `firstPersonController` | `moveTarget y=0`（L280）、`camera.y = eyeHeight`（L311） | cursor y = terrainHeight；`camera.y = terrainHeight + eyeHeight(+bob)` |
| `npcSystem` | 出生/巡逻 y=0 | terrainHeight 采样 |
| `cityWorldAssembly` | `[x, 0, z]` 树阵/长椅（L180-181） | terrainHeight 采样 |

### 6.3 碰撞与水域阻挡

- 建筑/道具 AABB 碰撞（XZ）逻辑不变。
- 深水推回泛化：保留 WEST_BEACH `deepWaterX` 快速路径；新增兜底 `terrainHeight(p) < -0.35`（低于所有可行走地面场的最大下切滩涂值 + 水深余量）→ 按 safeReturn 逻辑推回最近可走点。河谷水面（waterY ≥ -0.45）处河床 -0.85 → 河槽中心判定为深水不可走 ✓，湿岸带（-0.45..0）可走。

### 6.4 相机与演出兼容

- `focus/playSequence`（gsap 补间 target x/z）在 onUpdate 里 `apply(target)` 时统一取 terrainHeight——城内恒 0 无感；城外镜头随地形。
- 时刻画面 splash、CG（程序动画）不依赖运行时地形高度，零影响；城市地图 atlas 为运行时截图，地形裙坡进入画面属预期改进（VLM 复验点）。

### 6.5 多人协议检查点（实现任务 E 的验收项）

- `MiniCityApp.ts:657`（FPC 路径 y 硬编码 0）改发 `cursor.position.y`；:698 已透传。
- 只读验证 apps/server 对 `y` 字段的处理是存储转发而非校验夹取（预期透传——远程玩家渲染恰好需要真实 y）；**若发现服务端夹取 y，立即升级用户**（触碰「不动 server」边界）。

---

## 7. 水体方案（D6）

### 7.1 固定水位总表（固定 = 不随时间波动；河为纵坡水位）

| 水体 | 水位 y | 材质/渲染 | 变化 |
|---|---|---|---|
| 西海（明澜） | **0.06** | 唯一 mirror Water（westBeach createAnimatedWaterSurface，waterRendering 档位不动） | 不变；海床下切使其有深度 |
| 河口湾 + 羽流 | **0.08 / 0.064** | 现有 estuarySurface | 不变 |
| 晨溪河面 | **waterY(t)**：-0.10 → -0.45 → 0.075 | animatedWater 轻量水面（现有 pond 着色器族，保持） | 常量 WATER_Y → 沿程水位表 |
| 湖 | —（本期无） | — | 接口预留 §7.4 |

### 7.2 岸线自然过渡

- **海侧滩涂**：下切坡 x∈[-75,-86]（0→-0.9）即滩涂缓坡带；浪花带（x≥-47.4）、沙滩（0.07）资产不动——岸线读感由「水面下已有深度的斜坡」自然形成。
- **河侧湿岸**：保留现有「河岸层差 +0.004 于河床」的窄条湿岸结构，y 改为贴谷底（`terrainHeight + 0.004`），水线外露湿床沿的既有观感不变。
- **草甸无水**；台地裙坡无水。

### 7.3 河道渲染改造要点（riverChenxi.ts）

- 河床条带 y：常量 0.02 → `terrainHeight`（谷底）；河岸环带 → `terrainHeight + 0.004`；水面 → `waterY(t)`；河口段收窄逻辑（MOUTH_FADE）沿用。
- 河岸松树/砾石落点 y 改 terrainHeight 采样（原贴 0.02 附近）；keep-out 剔除逻辑不变。
- 日夜水色接线（setDaylight 转发）不变。

### 7.4 湖的接口预留（本期不实现）

若后续加湖：`city/data/terrain/` 新增 `lake-*.ts`（kind 'lake' 纯配置：湖心/半径/水位/岸坡宽）→ `worldReliefField` 增湖盆负场（软塌陷碗形）→ 渲染层用 animatedWater 轻量水面圆盘。协议与 _types.ts 现有 TerrainKind 完全兼容，无需改类型。

---

## 8. 性能预算（初值；任务 T6 实测修订）

| 项 | 现状基线 | 改造后预算 | 说明 |
|---|---|---|---|
| 世界地面 | farGround 2 tris / 1 dc | **≤ 16k tris / 1 dc** | 220×220 非均匀格点：台地内 4u、裙坡及场域 2u、远缘 3u（估算 4~6k 顶点） |
| 草甸网格 | ~3.4k tris / 1 dc | **退役**（-1 dc） | 高度并入 farGround；装饰批次保留 |
| 河床/岸/水面 | ~1 dc | 持平 | y 来源变更，几何量近似 |
| 山体/岛/岬角 | 不变 | 不变 | 零几何变化（§4.1） |
| **净增量** | — | **≈ +12k tris，draw calls -1** | |
| FPS | 以 T6 实测基线为准 | SwiftShader 帧时间劣化 ≤ 10%；真机目标 ≥ 基线 95% | SwiftShader 数据仅作回归比对，不代表真机 |
| LOD/降采样 | — | v1 = 上述非均匀格距；v2（超预算时）= 远场（离台地 >40）降采样至 5u | 山体本就低模，不动 |

---

## 9. 测试计划

### 9.1 贴合性（DoD：|y − 期望落位| < 0.02）

- **采点来源**：`BUILDING_DEFS` 全部建筑坐标、`NORTH_DISTRICT_AREA.residenceLots`（24 块）、路网 `roadSegments`、`worldDecorations` 道具表（树/长椅/灯/草簇）、NPC 出生点、出城步道节点。
- **单测**（node:test，新增 `tests/unit/terrainElevation.test.ts`）：
  1. 台地平坦性：上表全部采点坐标断言 `terrainHeight(x,z) === 0`（从而既有 y 落位与 `surfaceY` 天然一致）；
  2. 确定性快照：全域 2u 采样和的摘要断言；
  3. 连续性：全域 2u 相邻采样 |Δh| ≤ 0.5（无跳变/无缝隙）；
  4. 水体约束：河道路径步进采样断言 `terrainHeight(床) < waterY(t) - 0.05`；海侧渐深段 x<-88 断言 `< -0.85`；岛基保护区断言 `≥ -0.7`；
  5. 坡度预算：过渡坡/步道走廊 `slopeAlong` ≤ 阈值；
  6. 草甸隆起回归：南瓣峰值 > 1.2、东北瓣 > 0.5（阈值承接 worldTerrainAudit 现值，采样源换 terrainHeight）。
- **WebGL e2e**（`scripts/run-web-tests.sh`）：debug 探针（§9.3）遍历场景内 buildings/plots/道具 mesh，运行时断言 `|mesh.position.y − surfaceY(x,z,期望层)| < 0.02`；另含广角建立镜头截图 + `window._mini.focus(x,z,21)` 级俯视（zoom 15 档）截图，VLM 审 z-fighting 与观感。

> **R3 附注（2026-10-11，验收返工）：单测 3「连续性」的三层落位与两处修订**
>
> T2 落位时「连续性」拆为三层：a) 全域 2u 粗筛 ≤ 0.9（吸收城缘草甸 v7
> 形态的固有 2u 差分实测 0.83）；b) 过渡带专项 2u 预算；c) 敏感线 0.1
> 微步 ≤ 0.12。其中 **b 层预算由 0.5 修订为 0.8**，论证如下：
>
> 1. **泄漏源甄别**：b 层原 0.5 按 §3.3 的「裙坡」宏观坡度估算标定
>    （南缘 ≈0.24、北缘 ≈0.06+谷坡、西缘 ≈0.08，均为 14 宽裙坡量级）。
>    但「台地南缘过渡带」扫描域（z 78..110）覆盖了南瓣草甸自身的
>    **西缘爬升段**——x −43→−33 从 0 抬到 ~2.05（`meadowSwellProfile`
>    城市侧边缘隆起，v7 既有设计形态），实测 2u 高差 0.752 @ (-39,96)。
>    这是设计地形固有形态，不是过渡带缺陷。
> 2. **两难取舍**：a) 重定标 `meadowSwellProfile` 西缘爬升会改 v7 既有
>    渲染形态——与 T2「草甸收编零漂移」原则、草甸隆起回归（单测 6）
>    及已 VLM 通过的视觉形态直接冲突；b) 放宽 b 层预算、锚定可步行性
>    ——设计形态零变化。选 b。
> 3. **可步行性验证（实测）**：2u 弦坡 0.752/2 = 0.376（20.6°）；按
>    导航采样口径（0.6 步长 `slopeAlong`）西缘区局部最大坡 0.405
>    （22.0°）@ (-37.7,96.2)。两者均 < `WALKABLE_SLOPE_MAX` 0.45
>    （24.2°）——西缘全程可步行，T5 坡度可通行判定不受影响。
> 4. **取值 0.8**：= 2u × 0.4（弦坡 21.8°），较实测 0.752 留 0.048
>    余量；仍低于 a 层全域粗筛 0.9，「b 比 a 更严」的层级语义保留。
>
> 同轮 R3 另修：`worldReliefAt` 步道床表追加「采样点台地门」（床表
> 台地渐显原按垂足预烘焙，走廊 S2→S3 斜穿台地南缘时台内采样点拿到台
> 外垂足床值、缘线 25 点泄漏 ≤0.021；门控后台地主盒 0.5 步进全域严格
> 归 0，与垂足门的双重衰减仅落在缘线外 2u 带、0.1 步长增量 ≤0.011，
> c 层预算不受影响）。

### 9.2 worldTerrainAudit.test.ts 修订清单（逐条）

| 用例 | 处置 | 理由 |
|---|---|---|
| 「NAVIGABLE_AREA 与 roadNavigation 运行时边界快照一致」 | **修订快照** → `{x0:-50, x1:76, z0:-88.2, z1:104}`（z1 因步道节点 S4 (34,96)+8 外扩；公式不变） | 城外可达是 GOAL 明确需求；快照语义是「防意外漂移」而非「冻结可达区」，本次为有意变更。同步复核：新导航区与山体/崖壁/岛岬 keep-out 全部仍脱开（最近为松涛林·南麓盒 z≥125 vs z1=104 ✓） |
| 山体/崖壁 keep-out 组（导航区/观星走廊/河谷/河口湾/西海滩脱开） | **不动**（断言随 NAVIGABLE_AREA 推导自动指向新盒，T6 实现时验证全绿） | LANPING_RANGE / MINGLAN_ISLES 配置零改动；新导航区 z∈[50,104] 段与全部山体盒不交 |
| 「城缘草甸高度场在导航可步行区全程埋地」（断言 y ≤ -0.075） | **改写** → 「terrainHeight 在旧快照盒（z ≤ 50 的导航区）全域 === 0」（1u 步进） | 埋地机制被台地平坦承诺取代；审计目标（城区可走区地面平）不变。注意新导航区（草甸段）**允许**起伏——那正是坡度判定的辖区 |
| 「城缘草甸核心区真实隆起」（南/东北瓣峰值） | **改写采样源**：`sampleCitysideMeadowY` → `terrainHeight`，阈值不变 | 场已收编；防「收编后起伏消失」回归 |
| 草甸包围盒「不进导航可步行区」断言（'meadow' 组） | **改写** → 包围盒不得进**旧快照盒**（城区导航区） | 新导航区扩入草甸是本方案目的（观景可达），防回归目标收窄为「城区可走区不被草甸包围盒覆盖」（南瓣 z0=56 vs 旧 z1=50，仍脱开 ✓） |
| 「WORLD_TERRAIN 聚合包含城缘草甸」等聚合断言 | **不动** | _world.ts 零改动 |
| 全部 import 的 meadowField 路径 | **不动** | rendering/terrain/meadowField.ts 留 re-export 壳 |

### 9.3 运行时探针（DoD 要求）

`city/debugApi.ts` 的 `window._mini` 新增：

```ts
terrain: {
  height(x: number, z: number): number;        // terrainHeight 原值
  sample(x: number, z: number): {               // 诊断聚合
    height: number; plateau: number;            // 台地 mask（0=台地内）
    riverWaterY: number | null;                 // 河道水域内的沿程水位
    slope: number;                              // 最大梯度方向坡度
  };
}
```

文档同步：`docs/console-debug-api.md` 增补条目。

---

## 10. 改动文件清单（按实现任务粒度）

**T2 采样器与噪声下沉**
- 新增 `apps/web/src/city/data/terrain/heightfield/noiseCore.ts`、`plateauField.ts`、`worldReliefField.ts`、`terrainHeight.ts`
- 移动 `rendering/terrain/meadowField.ts` → `heightfield/meadowField.ts`（原址留 re-export 壳；mask 语义改台地版）
- 修改 `rendering/terrain/massifGeometry.ts`（噪声函数 re-export noiseCore）

**T3 世界地形面渲染**
- 修改 `rendering/createCitySurfaces.ts`（addGround：farGround → 非均匀格点地形网格，顶点采样 terrainHeight）
- 修改 `rendering/terrain/cityGround.ts`（草甸高度网格退役、装饰贴 terrainHeight）
- 修改 `rendering/terrain/mountainRanges.ts`、`minglanIsles.ts`（底环/麓原/岛基贴 terrainHeight - bury，山脚区数值零变化）

**T4 SURFACE_Y 相对化 + 城外步道**
- 修改 `rendering/layers.ts`（语义注释）、`city/buildingSceneController.ts`、`rendering/worldDecorations.ts`、`rendering/navigationTargetMarker.ts`、`city/cityConstructionScene.ts`、`city/cityWorldAssembly.ts`
- `worldReliefField.ts` 内步道切槽参数（走向常量表）

**T5 河谷水体 + 导航运动**
- 修改 `rendering/terrain/riverChenxi.ts`（水位表/河床/岸采样化）、`city/data/terrain/river-chenxi.ts`（头注释契约更新）
- 修改 `city/navigation/roadNavigation.ts`、`playerController.ts`、`cameraController.ts`、`firstPersonController.ts`、`city/npcSystem.ts`、`city/MiniCityApp.ts`（y 透传，含 §6.5 检查点）
- 检查（预期零改动）：`rendering/westBeach.ts`

**T6 测试/探针/截图/性能**
- 新增 `apps/web/tests/unit/terrainElevation.test.ts`；修改 `tests/unit/worldTerrainAudit.test.ts`（§9.2 清单）
- 修改 `city/debugApi.ts` + `docs/console-debug-api.md`
- 新增 e2e 用例（贴合性 + 两档截图）；性能报告与截图落 `/home/z/my-project/deliverables/`

体积红线自查：新增文件均预期 < 400 行；`roadNavigation.ts` 现状已近上限，坡度判定抽到 heightfield 侧（纯函数）避免膨胀。

---

## 11. 风险与检查点

| # | 风险 | 缓解 |
|---|---|---|
| R1 | 西海「深水感」靠渐深剖面（x<-86 才到 -0.9），近岸浅滩带较长 | 设计意图：岸→浅滩→渐深的真实梯度；岛基保护区/军舰零回归；T6 广角截图验证海面观感 |
| R2 | 多人位置同步 y 透传的服务端行为未知 | §6.5 只读检查点；发现夹取立即升级用户 |
| R3 | 河口水位 0.075 与湾面 0.08 的 0.005 衔接在远镜头下闪烁 | 湾面/羽流资产 y 不动、河面贴其下方；T6 zoom 15 俯视截图专项核查 |
| R4 | 台地裙坡改变城市地图 atlas / 远景镜头画面 | 运行时截图自动更新，属预期改进；VLM 复验 |
| R5 | SwiftShader 帧时间不代表真机 | 性能结论以「同环境前后对比」表述，真机留待部署 |
| R6 | 山体底环贴地化在山脚起伏区引入细微几何漂移 | 山脚区 terrainHeight≡0（背景回退），预期零漂移；审计快照 + VLM 山景截图兜底 |

---

## 12. 验收对照（DoD → 本方案落点）

| DoD | 落点 |
|---|---|
| 贴合性 < 0.02 + 运行时探针 | §9.1 采点/断言 + §9.3 debug 探针 |
| 广角写实截图 + zoom 15 无 z-fighting | §9.1 e2e + §2.5 层差红线论证 |
| 三角面数/draw calls/FPS 报告 + LOD | §8 预算表，T6 实测修订 |
| typecheck/build/test:domain/check:* 全绿 | 各实现任务验收门；§10 体积自查 |
| 反偷懒红线（无悬空/无硬编码 0/无缺验收/无 z-fighting） | §2.5、§3.2、§9、§11 |
