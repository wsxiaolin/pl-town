# MiniCity

基于 Three.js 的俯视微缩城市，使用 Vite + TypeScript，不依赖 UI 框架。

## 开发

```bash
npm install
npm run dev
```

开发地址默认是 `http://localhost:5173`。

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
│   └── MiniCityApp.ts            # 城市内容、交互、寻路与业务状态
├── core/
│   ├── InstancedBatch.ts         # 高频静态对象实例批次
│   └── ResourcePool.ts           # 纹理、几何体、材质缓存与统一释放
└── rendering/
    ├── createRenderer.ts         # WebGLRenderer 质量和稳定性配置
    └── layers.ts                 # 地表高度和渲染顺序
tests/
└── smoke.spec.ts                 # 桌面/移动 WebGL 冒烟测试
```

## 性能策略

- 程序纹理按纹理键和 repeat 参数缓存，不再为每个 Mesh 创建 CanvasTexture。
- 相同参数的 BufferGeometry 和静态材质由 ResourcePool 复用。
- 树木和路灯使用 InstancedMesh，将数百次 draw call 合并为固定批次。
- 建筑射线检测数组预计算，标签投影和镜头跟随复用 Vector3。
- 像素比上限为 1.5；移动端关闭抗锯齿；全城实时阴影关闭，避免集成显卡上下文重置。
- 地图截图改为首次打开地图时按需创建，截图后立即释放第二个 WebGLRenderer。
- 页面退出/HMR 时停止 RAF、interval、GSAP，移除事件并释放 renderer 和共享资源。

## 闪烁修复

大地、城区、地块、道路、道路标线和水面使用统一的世界坐标高度层级与
`renderOrder`。基础地面只保留一个 220 x 220 Plane，删除依赖微小
`polygonOffset` 的共面竞争；透明水面关闭 `depthWrite`，避免透明表面污染深度缓冲。

验证地板时，分别在近景和最大缩放下沿地块边缘缓慢移动镜头，并重点检查建筑地块、
中心广场、道路标线、池塘和河流交界。`npm run test:e2e` 会同时检查桌面和移动端 canvas
非空、控制台无异常且页面无横向溢出。
