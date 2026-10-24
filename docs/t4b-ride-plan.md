# T4b 乘车交互——勘察交接与实现方案（T4b-c1~c6 施工唯一依据）

> 来源：2026-10-18 09:37 T4b 执行中断回执（小寒，撞 100/100 工具轮数上限：勘察 100%、代码施工 0%，非故障）。
> 皮皮已将回执全量转存本文件，并把剩余施工拆成 6 个小子任务（T4b-c1~c6，每个 ≤4 处文件改动，防再次撞轮数上限）。
> **每个子任务开工前必读本文件对应小节；勘察已完成，不得重做，直接按方案写码。**

## 0. 基线状态（勘察确认）
- git 工作副本含 T3/T4 全部改动未提交；T4a3 已收口（52/52 单测绿），**无重复施工风险**。
- 磁盘核实（皮皮 09:37）：transitGround.ts / transitStationSigns.ts / transitRideController.ts 均不存在，src 中 transitGroundY / updateTransitRide / interactWithTransit 零匹配——代码 0% 属实，从零开始写。

## 1. 关键发现（数值探针实测，npx tsx 验证）
1. transitGroundY(platform)=baseY 对 9 座岛站 delta=0.0000 精确成立；**星门站偏差 0.1054**（桥走廊 blend 优先级压过月台场）→ 修复方案：月台场优先于桥走廊（worldReliefAt 岛分支换序 + 新模块 transitGround.ts，影响域仅星门月台，已验证不改其他任何采样点）。
2. **T4a 遗留步行 y 缺陷**：桥中段（z≥145 恒海区）terrainHeight=natural=0 而 deck≈2.06，playerController（约 L132）每帧以 terrainHeight 赋 y → 玩家走桥会沉到海面。乘车闭环必须一并修：playerController + roadNavigation.resolveMovement 改用 transitGroundY（防环：新模块 transitGround.ts 聚合 terrainHeight+transitField，同优先级口径，禁止反向依赖）。
3. BRIDGE_LENGTH=118.18 / RING_LENGTH=1132.65；路由 stargate→2022 len=356.3/181 点/switchS=125.7；ringStationSpeedFactor 站周 0.35 语义可用。
4. **MiniCityApp.ts 当前 996/1000 行**（apps/web/src/city/MiniCityApp.ts，源码护栏）——新增乘车接线 ~11 行必须同步压缩 devTeleport/devFocus 注释补偿。

## 2. 实现方案（小寒原案）
新增 3 模块：
- ① `apps/web/src/city/data/terrain/heightfield/transitGround.ts`：transitGroundY（优先级：月台 > 桥走廊 > 自然地形）。
- ② `apps/web/src/rendering/terrain/transitStationSigns.ts`：10 站牌（月台板+立柱+线路色牌面；stargate=暖橙、ring 9 站=青蓝；interactionPosition=月台中心）。
- ③ `apps/web/src/city/transitRideController.ts`：interact → openStory 列 10 站目的地（当前站标记）→ dismissNpc → startRide；update 沿 buildTransitRoute 弧长推进 v=18*ringStationSpeedFactor；到站落 (platformX, transitGroundY, platformZ)；防重复派发 + onManualStart 取消。

编辑 8 处：
- ① worldReliefAt 岛分支换序（月台场优先于桥走廊）。
- ② roadNavigation.groundPoint / resolveMovement 改用 transitGroundY。
- ③ playerController（约 L132）同 ②。
- ④ sceneInterestPoints 合并站牌实体进 entities+baseRaycastTargets（tag 复用；T4 已在 sceneInteractions 注册 10 站 ID）。
- ⑤ sceneInterestPointController 加 interactWithTransit 钩子。
- ⑥ frameLoop 加 updateTransitRide（updateWeather 同款挂法，updateMovement 后调用）。
- ⑦ MiniCityApp 接线（含行数补偿，见 §1.4）。
- ⑧ debugApi 加 _mini.transit（stations/interact/start/state/history）。

交互路由红线：点击走 interactWithInterestPointController 既有路由（interactionPointer 距离 3.5 判定 → pending → interact），**零第二 WebGL 上下文**。

## 3. 冒烟设计（c6 执行）
以 T3d 的 smoke-dev2.mjs 为模板（⚠️ `_mini.focus` 的 zoom=正交相机世界半高，勿弄反——T3c 教训）。断言：
- mesh 名 year-town-transit-structures / transit-tram / transit-maglev 进视锥；
- interactInterestPoint('station-stargate') 弹出目的地面板 → 选目的地乘车抵达 ≥2 座年份镇，断言落点 baseY 吻合 <0.01；
- 浏览器控制台零错误；≥2 截图存 apps/web/shots/t4b-*.jpg；结论写 /tmp/t4b-smoke.md（逐项 PASS/FAIL）。

## 4. 拆分映射（皮皮 09:37 定，各棒只做本表范围，其余一律不碰）
| 子任务 | 范围 | 验收 |
|---|---|---|
| T4b-c1 高度场收口 | §2 新增① + 编辑①②③（4 处） | typecheck EXIT=0；探针复验：星门月台偏差 <1e-3（原 0.1054 已修）、桥中段 z≥145 恒海区 y≈deck≈2.06（原 0 沉海已修） |
| T4b-c2 站牌渲染+注册 | §2 新增② + 编辑④（2 处） | typecheck EXIT=0 |
| T4b-c3 乘车控制器 | §2 新增③ + 编辑⑤⑥（3 处） | typecheck EXIT=0 |
| T4b-c4 接线+调试口 | §2 编辑⑦⑧（2 处） | typecheck EXIT=0；MiniCityApp.ts ≤1000 行 |
| T4b-c5 乘车单测 | 新增 apps/web/tests/unit/transitRideController.test.ts | npm run test:unit 全绿 + typecheck EXIT=0 |
| T4b-c6 dev 冒烟+M3 收官 | §3 冒烟 + 收尾 | /tmp/t4b-smoke.md 全 PASS + 截图；README M3 勾选；简报 |

单测内容（c5）：弧长推进单调性 / 站周减速语义（ringStationSpeedFactor 站周 0.35）/ 到站落点=transitGroundY(platform)=baseY（<1e-6）/ 取消（onManualStart）。
⚠️ 防 T4a2 覆辙：断言数值先用 npx tsx 探针核实口径，勿拍脑袋写过严断言。
