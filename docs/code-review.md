# PR 自动审查

## CodeRabbit

仓库根目录的 `.coderabbit.yaml` 开启自动审查与推送后的增量审查，覆盖所有目标分支，跳过草稿 PR，报告使用简体中文。审查规范由 CodeRabbit 自动读取 `AGENTS.md`。

此配置需要 CodeRabbit GitHub App 已获得本仓库访问权限，且仓库在 CodeRabbit 中启用了审查。合并配置后，可在 PR 下评论 `@coderabbitai configuration` 查看实际生效配置。

### 免费方案与低 star 限制

- 普通 **Free** 计划只提供 PR 摘要，不包含 PR 代码审查。
- 符合条件的开源项目使用 **OSS 免费权益**，可以进行 PR 代码审查，但受配额限制。
- **公开仓库少于 10 stars 时，CodeRabbit 要求手动触发审查**，`auto_review.enabled: true` 无法解除这一限制。在 PR 的 CodeRabbit 状态评论中点击 **Trigger review**，或评论 `@coderabbitai review`；需要完整审查时使用 `@coderabbitai full review`。后续提交也应确认是否已审查，必要时再次手动触发。
- 达到 star 门槛、具备相应审查权益且未触及配额时，自动审查配置才能按平台规则运行。

官方依据：[计划与限制](https://docs.coderabbit.ai/management/plans#rate-limits)、[自动审查配置](https://docs.coderabbit.ai/configuration/auto-review)、[审查命令](https://docs.coderabbit.ai/reference/review-commands)、[编码规范自动发现](https://docs.coderabbit.ai/knowledge-base/code-guidelines)。

## 原 OpenCode reviewbot（暂时暂停）

`.github/workflows/auto-review.yml` 保留原审查实现，但仅当仓库 Actions 变量 `ENABLE_OPENCODE_REVIEW` 的值为 `true` 时运行。变量未设置或值不为 `true` 时，`code-review` job 被跳过，不安装 OpenCode、不调用模型、不发布评论，也不根据 blocker 阻止合并。

保留原 PR 事件与 job 名称，使引用该 job 的 required check 能以 skipped 状态完成，避免删除触发器后一直等待检查。其他 CI 校验继续运行。

恢复方式：在 GitHub 仓库 **Settings → Secrets and variables → Actions → Variables** 中，将 `ENABLE_OPENCODE_REVIEW` 设为 `true`，然后更新 PR 或重新运行工作流；删除该变量或改为 `false` 可再次暂停。
