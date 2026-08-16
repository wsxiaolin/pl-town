# 居民楼视觉变体需求

## Introduction

居民楼视觉需要恢复到提交 `275523b72d869d733e20ad10cf1811e8dc5c5adf` 所体现的明亮、轻量、社区化风格，同时保留当前版本的城市布局和交互逻辑。

## Glossary

- **居民楼**：由 `createResidenceModel` 生成并登记到 `residences` 的住宅对象。
- **视觉变体**：居民楼使用的墙面贴图、屋顶贴图、门窗布局和附属构件组合。
- **布局逻辑**：居民楼的位置、数量、旋转、拾取标记、障碍物注册和地块生成逻辑。

## Requirements

### Requirement 1: 保留当前布局与逻辑

**User Story:** 作为城市场景开发者，我希望居民楼继续使用当前布局，以便新增建筑和碰撞逻辑保持稳定。

#### Acceptance Criteria

1. WHEN 场景创建居民楼，系统 SHALL 继续使用当前提交中的居民楼坐标、数量筛选、旋转规则和地块位置。
2. WHEN 场景注册居民楼交互，系统 SHALL 保留 `residenceId`、`residenceStyleId`、射线拾取和障碍物注册数据。
3. WHEN 场景包含新增建筑，系统 SHALL 保留当前新增建筑及其相关碰撞和导航逻辑。

### Requirement 2: 恢复居民楼视觉基调

**User Story:** 作为玩家，我希望居民楼拥有目标提交中更明亮、更有社区感的视觉效果。

#### Acceptance Criteria

1. WHEN 居民楼渲染，系统 SHALL 使用明亮墙面、轻量材质和清晰窗户作为主要视觉特征。
2. WHEN 居民楼渲染，系统 SHALL 提供至少 6 种墙面贴图和至少 4 种屋顶贴图组合。
3. WHILE 昼夜状态变化，系统 SHALL 保留窗户发光强度随昼夜变化的行为。

### Requirement 3: 扩展视觉变体

**User Story:** 作为场景作者，我希望居民楼拥有更多贴图和布局方式，以便不同街区呈现自然变化。

#### Acceptance Criteria

1. WHEN 系统根据坐标和索引选择居民楼样式，系统 SHALL 以确定性规则选择至少 12 种可识别的视觉变体。
2. WHEN 居民楼使用不同视觉变体，系统 SHALL 提供至少 4 种窗户、门、屋檐或阳台布局组合。
3. WHEN 相邻地块生成居民楼，系统 SHALL 保留街区家族风格的一致性并允许确定性的局部变化。

### Requirement 4: 稳定性

#### Acceptance Criteria

1. WHEN 居民楼视觉变体更新，系统 SHALL 保持 `navigationFootprint` 与当前逻辑兼容。
2. WHEN 贴图资源初始化，系统 SHALL 为每个居民楼贴图提供可复用的缓存资源。
