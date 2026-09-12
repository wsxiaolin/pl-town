# Requirements Document — 物实验证弹出与入城门禁

Feature Name: pl-verification-popup
Updated: 2026-09-09

## Introduction

访客在登录浮层签署居民证（输入昵称与密码）后，系统检查该昵称是否属于物实社区账号。若属于，必须先通过同名物实账号登录验证所属权，全部验证完成后才进入城市。现状是提交后立即隐藏浮层并开始加载城市，验证失败再把用户弹回签署界面，体验割裂。本特性将「入城」动作推迟到身份完全确认之后。

## Glossary

- **签署界面**: 登录浮层 `#loginOverlay`，含昵称、密码输入与「签下名字，进入小城」按钮。
- **物实验证**: 服务器确认昵称归属——要求请求方提供同名物实账号的登录凭据并向物实官方核验。
- **物实登录区**: 签署界面内 `#plVerifySection` 区域，含物实账号（注册邮箱）与物实密码输入框。
- **入城**: 服务器 `hello` 验证通过、客户端进入城市交互界面。
- **等待状态**: 签署按钮禁用并显示核实进行中的提示文案。

## Requirements

### Requirement 1 — 身份确认前保持签署界面

**User Story:** AS 正在签署居民证的访客， I want 在小城确认我的身份之前停留在签署界面， so that 我先完成全部验证再进入城市，而已经进入后又被弹回。

#### Acceptance Criteria

1. WHEN 访客提交居民证且服务器尚未返回身份结果， THE 系统 SHALL 保持签署界面可见并将签署按钮置为等待状态。
2. WHEN 服务器确认昵称与密码有效（`hello` 成功）， THE 系统 SHALL 关闭签署界面并进入城市。
3. WHEN 访客携带有效会话令牌自动恢复登录， THE 系统 SHALL 按现有恢复流程直接入城。

### Requirement 2 — 物实验证界面弹出

**User Story:** AS 昵称与物实社区账号同名的访客， I want 系统明确告知需要验证并展示物实账号登录入口， so that 我能证明这个昵称属于我。

#### Acceptance Criteria

1. WHEN 服务器返回 `pl-verification-required`， THE 系统 SHALL 在签署界面内展示物实登录区并聚焦物实账号输入框。
2. WHEN 访客修改昵称输入框内容， THE 系统 SHALL 隐藏物实登录区并清除已填写的物实凭据。
3. WHEN 访客填写物实账号与密码并再次提交， THE 系统 SHALL 携带物实凭据重新发起身份验证，签署按钮再次进入等待状态。

### Requirement 3 — 验证结果反馈

**User Story:** AS 正在完成物实验证的访客， I want 每一步结果都有明确反馈， so that 我知道下一步该做什么。

#### Acceptance Criteria

1. IF 物实账号密码错误或与昵称不匹配， THE 系统 SHALL 显示失败原因并保持物实登录区可见。
2. IF 小城昵称或密码校验失败， THE 系统 SHALL 显示错误原因并停留在签署界面。
3. WHEN 物实验证通过且居民证签署完成， THE 系统 SHALL 关闭签署界面并进入城市。
4. IF 服务器不可达或连接失败， THE 系统 SHALL 显示连接失败提示、恢复签署按钮可用状态并停留在签署界面。
5. THE 系统 SHALL 将入城动作限定在服务器确认身份成功之后，连接失败期间签署界面保持为唯一入口。

#### Clarified Decisions (2026-09-09)

1. 等待状态采用「按钮等待态」：签署按钮禁用并显示核实进行中文案，浮层保持可见。
2. 物实登录 UI 沿用浮层内 `#plVerifySection` 展开形态。
3. 连接失败时显示提示并恢复按钮供手动重试；入城动作仅在服务器确认身份成功后发生，连接失败期间不存在离线注册或游客入城路径。

### Requirement 4 — 行为范围

**User Story:** AS 项目维护者， I want 本次改动限定在登录入城流程， so that 改动范围可控、便于审查。

#### Acceptance Criteria

1. THE 系统 SHALL 保持现有服务器端验证逻辑与错误码（`pl-verification-required`）不变。
2. THE 系统 SHALL 保持令牌恢复路径与 NPC 编辑页的现有行为不变。

## Out of Scope

- 服务器端验证逻辑、限流策略的调整（PR #140 已交付）。
- 「忘记密码」找回通道。
- 输入昵称时的实时预检查接口（避免昵称枚举探测面）。
