# 世界地形规划（山河湖海）

目前只有类型契约与空配置，没有渲染实现：

- `_types.ts`：`TerrainFeatureConfig` / `TerrainKind`。新增地形先写配置，
  渲染与导航随后按字段接线（配置先行、渲染后行）。
- `_world.ts`：`WORLD_TERRAIN` 聚合列表（现为空，含注释示例）。

分层约定：配置在 `city/data/terrain/`、渲染在 `rendering/`、
导航避让在 `city/navigation/`。大面积水体优先复用 `animatedWater`
与 `SURFACE_Y` 高度层体系，避免远镜头 z-fighting（详见 `_types.ts`
头注释与 AGENTS.md）。

现有先例：西侧海岸配置 `WEST_BEACH`（cityConfig.ts）+ 渲染
`rendering/westBeach.ts`。迁移到本协议前保持不动。
