# Requirements Document

## Introduction

重做烟花玩法（Issue #256）：设计阶段引入可解释的装药与星体物理参数，并按真实烟花制作流程组织界面；观赏阶段重做 3D 表现，加入发射船、升空壳、星体拖尾、爆闪、冲击波、烟雾与水面反光。

## Glossary

- **烟花设计（Design）**: 存在云端、可在观景台燃放的一份烟花参数集合。
- **弹径（Caliber）**: 烟花弹的直径，单位毫米。
- **发射药（Lift Charge）**: 把烟花弹送出炮筒的黑火药质量，单位克。
- **开爆药（Break Charge）**: 在空中炸开弹体并点燃星体的装药质量，单位克。
- **工艺卡（Craft Report）**: 由物理参数推导的升空时间、引信时长、实际开爆高度、开爆半径与风险提示。
- **旧版设计（Legacy Design）**: `v === 1`、以 `size` 表示开爆半径百分比的已存设计。

## Requirements

### Requirement 1: 参数化烟花设计

**User Story:** AS 居民, I want 按弹体、星体与发射参数设计烟花, so that 每一次燃放都能被物理量解释。

#### Acceptance Criteria

1. THE 设计台 SHALL 提供弹径、发射药、开爆药、发射角、星数、星体尺寸、燃烧时间、闪烁、尾迹类型与花形参数。
2. WHEN 居民调整任一物理参数, THE 设计台 SHALL 在 100 毫秒内更新工艺卡与 2D 试放预览。
3. THE 客户端校验 SHALL 拒绝超出以下区间的设计：弹径 50–300 毫米、发射药 10–300 克、开爆药 5–200 克、发射角 0–18 度、星数 40–600、星体尺寸 4–18 毫米、燃烧时间 1–6 秒。
4. THE 服务端校验 SHALL 对保存请求应用与客户端一致的区间与枚举规则。

### Requirement 2: 真实制作流程

**User Story:** AS 居民, I want 按卷筒、装药、定引信、试放的顺序理解设计, so that 设计过程对应真实烟花制作。

#### Acceptance Criteria

1. THE 设计台 SHALL 按「弹体与发射」「星体与开爆」「颜色与花形」「试放」四段组织参数。
2. WHEN 弹径变化, THE 设计台 SHALL 更新推荐发射药与推荐开爆药。
3. WHEN 发射药低于推荐值, THE 工艺卡 SHALL 提示实际开爆高度低于设计高度。
4. WHEN 发射角大于 0 度, THE 工艺卡 SHALL 显示预计水平偏移距离。
5. THE 设计台 SHALL 显示由物理参数推导的引信时长，并以推荐值作为默认开爆时机。

### Requirement 3: 旧版设计兼容

**User Story:** AS 已保存烟花的居民, I want 旧设计继续可读可放, so that 重做不丢失历史作品。

#### Acceptance Criteria

1. WHEN 服务端读取 `v === 1` 的设计, THE 服务端 SHALL 将其转换为 `v === 2` 后返回。
2. WHEN 客户端收到 `v === 1` 的设计, THE 客户端 SHALL 按同一规则转换后用于预览与燃放。
3. THE 转换 SHALL 保留高度、花形、颜色、闪烁与拼字点阵，并把旧 `size` 映射为开爆药。

### Requirement 4: 3D 观赏重做

**User Story:** AS 观景者, I want 在海边看到有来源、有过程的烟花, so that 观赏体验接近真实烟花秀。

#### Acceptance Criteria

1. THE 观景场景 SHALL 在燃放海域显示至少两艘发射船，并包含炮筒、甲板、灯笼与货箱。
2. WHEN 一支烟花升空, THE 引擎 SHALL 显示带拖尾的升空壳，并让发射船出现炮口闪光。
3. WHEN 升空壳到达引信时长, THE 引擎 SHALL 在物理计算的开爆位置生成星体爆裂。
4. THE 星体 SHALL 按弹径、开爆药、星数、星体尺寸、燃烧时间与尾迹类型决定数量、速度、尺寸、寿命与拖尾。
5. WHEN 烟花爆裂, THE 引擎 SHALL 生成爆闪、冲击波、烟雾与水面反光。
6. THE 引擎 SHALL 应用恒定海风，使升空轨迹与星体产生可观察的水平漂移。
7. THE 引擎 SHALL 在销毁时释放自建几何与材质，并复用主渲染器与场景。

### Requirement 5: 预览与观赏一致

**User Story:** AS 设计者, I want 试放预览与观景台效果一致, so that 我存下的设计符合预期。

#### Acceptance Criteria

1. THE 2D 试放预览 SHALL 使用与 3D 引擎相同的升空弹道、星体运动与闪烁公式。
2. THE 预览 SHALL 绘制升空轨迹、实际开爆点与开爆半径。
3. WHEN 拼字烟花被选中, THE 预览 SHALL 显示点阵图案在夜空中的分布。

### Requirement 6: 验证

**User Story:** AS 维护者, I want 新协议与物理模型有自动验证, so that 回归可被及时发现。

#### Acceptance Criteria

1. THE 单元测试 SHALL 覆盖物理推导、旧版转换与星体数量/寿命。
2. THE 服务端集成测试 SHALL 覆盖 `v === 2` 保存、旧版保存、非法物理参数拒绝。
3. THE 浏览器烟雾测试 SHALL 覆盖新参数控件、工艺卡更新与观景模式进入/退出。
