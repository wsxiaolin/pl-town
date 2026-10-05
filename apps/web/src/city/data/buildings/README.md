# 建筑单文件配置

一栋建筑的全部信息（定位、外观、地块、社区查询、对话、GLB 模型）都在
同名的单个文件里。类型契约见 `_types.ts`；shape 级默认门面/地块见
`_shapeDefaults.ts`；聚合与向后兼容导出见 `_registry.ts`。

## 新增一栋建筑

1. 新建 `<building_id>.ts`：
   ```ts
   import { defineBuilding, iconSvg } from './_types';

   export default defineBuilding({
     id: 'my_building',
     num: '53',
     label: '示例建筑',
     x: 33, z: -15,
     shape: 'kiosk',
     icon: iconSvg(`<rect x="4" y="4" width="16" height="16"/>`),
   });
   ```
2. 在 `_registry.ts` 按城市空间顺序插入 import 与数组项。
3. 在 `apps/server/src/progression.ts` 的 `BUILDING_IDS` 加入同一 id
   （治理/建设协议要求两表一致），然后运行
   `npm run gen:building-catalog -w @minicity/server` 重新生成服务端目录。
4. 新建筑若改变既有地块/装饰间距，按 AGENTS.md 检查治理配置版本要求。

## 可选字段速查

- `facade`：覆盖 shape 默认门面纹理。
- `plot` / `hasPlot`：覆盖地块纹理/尺寸/颜色，或关闭地块。
- `glbFile`：`src/assets/models/` 下的 GLB 文件名，配置后渲染时用模型替换程序化网格。
- `contentQuery`：Physics Lab 社区作品查询（点击开作品面板）。
- `content`：对话（线性 `dialog` 或树状 `dialogTree`）。
- `decorations`：建筑自带装饰（**预留槽位，渲染接线尚未实现**；
  世界级装饰仍在 `rendering/worldDecorations.ts`，不放这里）。

## 旧导入路径

`city/data/buildings.ts` 与 `city/data/buildingPlots.ts` 是兼容 shim，
转发 `BUILDING_DEFS` / `BUILDING_CONTENT` / `BUILDING_API_QUERIES` /
`BUILDING_PLOT_MAP`，既有消费者无需改动。
