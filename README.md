# MiniCity

基于 Three.js 的俯视微缩城市，使用 Vite + TypeScript，不依赖 UI 框架。

## 开发

```bash
npm install
npm run dev
```

开发地址默认是 `http://localhost:5173`。

## 联机前端

前端已经接入根目录下的 `server/` WebSocket 服务。默认开发时连接
`ws://当前网页主机:8787`。如果服务器地址不同，在启动 Vite 前设置
`VITE_SERVER_URL`，例如：

```powershell
$env:VITE_SERVER_URL='wss://example.org'
npm run dev
```

右下角“联机”面板提供全服文字公聊和住宅状态。点击地图中的小型居民楼可以查看、
认领和管理住宅。临时身份恢复令牌保存在浏览器 `localStorage` 中，聊天正文不会写入
数据库。服务器启动方式和消息协议见 [`server/README.md`](server/README.md)。

```bash
npm run typecheck
npm run build
npm run test:e2e
```

Playwright 浏览器缓存通过用户环境变量 `PLAYWRIGHT_BROWSERS_PATH` 指向
`D:\playwright-browsers`，避免占用系统盘。

## 目录

```text
src/
├── main.ts                       # 启动与页面/HMR 生命周期
├── city/
│   ├── MiniCityApp.ts            # 城市交互、寻路与业务状态
│   ├── data/
│   │   ├── buildings.ts          # 建筑定义与对话内容
│   │   ├── cityConfig.ts         # 城市布局与视觉配置
│   │   └── npcs.ts               # NPC 档案与对话内容
│   └── rendering/
│       ├── createCitySurfaces.ts # 城市地表与道路
│       └── realBuildingModels.ts # 建筑模型
├── core/
│   ├── InstancedBatch.ts         # 高频静态对象实例批次
│   └── ResourcePool.ts           # 纹理、几何体、材质缓存与统一释放
└── rendering/
    ├── createRenderer.ts         # WebGLRenderer 质量和稳定性配置
    └── layers.ts                 # 地表高度和渲染顺序
tests/
├── smoke.spec.ts                 # 桌面/移动 WebGL 冒烟测试
└── diagnostics/
    ├── diag-check.ts             # 两帧近景/远景区域变化扫描
    ├── diag-burst.ts             # 多帧全屏闪烁采样
    ├── diag-burst2.ts            # 指定区域颜色交替采样
    └── diag-obj.ts               # 将闪烁区域映射到 Three.js Mesh
```

## 性能策略

- 程序纹理按纹理键和 repeat 参数缓存，不再为每个 Mesh 创建 CanvasTexture。
- 相同参数的 BufferGeometry 和静态材质由 ResourcePool 复用。
- 树木和路灯使用 InstancedMesh，将数百次 draw call 合并为固定批次。
- 建筑射线检测数组预计算，标签投影和镜头跟随复用 Vector3。
- 默认移动端渲染倍率为 1.5x 且关闭抗锯齿；右上角画面设置支持 1x~3x 渲染倍率、抗锯齿、
  1x~16x 纹理过滤、实时阴影和曝光调节。全城实时阴影默认关闭，避免集成显卡上下文重置。
- 地图截图改为首次打开地图时按需创建，截图后立即释放第二个 WebGLRenderer。
- 页面退出/HMR 时停止 RAF、interval、GSAP，移除事件并释放 renderer 和共享资源。

## 闪烁修复

大地、城区、地块、道路、道路标线和水面使用统一的世界坐标高度层级与
`renderOrder`。基础地面只保留一个 220 x 220 Plane，删除依赖微小
`polygonOffset` 的共面竞争；透明水面关闭 `depthWrite`，避免透明表面污染深度缓冲。

验证地板时，分别在近景和最大缩放下沿地块边缘缓慢移动镜头，并重点检查建筑地块、
中心广场、道路标线、池塘和河流交界。`npm run test:e2e` 会同时检查桌面和移动端 canvas
非空、控制台无异常且页面无横向溢出。

## 渲染诊断

诊断脚本需要先启动预览服务器，并默认访问 `http://127.0.0.1:4173/`：

```bash
npm run build
npm run preview -- --host 127.0.0.1 --port 4173
npx tsx tests/diagnostics/diag-check.ts
npx tsx tests/diagnostics/diag-burst.ts
npx tsx tests/diagnostics/diag-burst2.ts
npx tsx tests/diagnostics/diag-obj.ts
```

`diag-check.ts` 会将参考截图写入未跟踪的 `diagnostics-output/`，该目录和截图不应提交。
`diag-obj.ts` 使用 `window.__mini` 调试钩子读取场景、相机和 Three.js 对象，用于定位疑似
z-fighting 的 Mesh；该钩子不参与正常渲染逻辑。
