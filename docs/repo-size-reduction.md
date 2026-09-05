# 仓库瘦身方案（资产体积）

## 背景

GitHub 上本仓库约 237 MiB（2026-09-05 API 报告 243,048 KiB）。`apps/web/src/assets` 下的 120 张 PNG 合计 81.7 MiB，是 HEAD 工作区体积的主力；历史提交中的旧 blob 决定了 GitHub 报告的总大小。

PNG 分辨率构成（瘦身前）：

| 分辨率 | 数量 | 说明 |
|--------|------|------|
| 1024x1024 | 100 | 天气/道路/住宅纹理（split-weather-atlases.py 切图产物） |
| 1254x1254 | 15 | 基础纹理，非二次幂分辨率 |
| 1672x941 | 5 | Echo 剧情 CG 立绘 |

## 本次已落地（PR 范围）

1. **pngquant 有损量化**（`--quality=70-95`）：质量低于 70 的文件自动跳过，剧情 CG 全部通过质量保护。120 张 PNG 中 106 张被压缩。
2. **1254x1254 → 1024x1024 降采样**：15 张基础纹理与其余 100 张纹理规格对齐（LANCZOS，非二次幂纹理对 GPU 采样和 mipmap 更不友好）。
3. **资产体积守卫**：新增 `apps/web/check-asset-size.mjs`，单文件上限 1 MiB、资产树总量上限 48 MiB，已接入根级 `npm run typecheck` 和 `npm run build`（与 `check:source-size` 同模式）。

效果：PNG 总量 81.7 MiB → 42.3 MiB（-48%），资产树 44 MiB，新克隆的工作区体积相应下降。

## 为什么 PR 缩不动 GitHub 报告的总大小

新提交只让 HEAD 变小；旧版本的大 blob 仍留在提交历史里，GitHub 的仓库体积按全部可达对象计算。普通 PR 无法删除历史对象，完整瘦身需要一次性历史重写（涉及 force push），由维护者择机执行。

## 后续完整瘦身路径（维护者操作，涉及 force push）

以下两选一，效果均为把历史中的大图从 Git 对象库移出。执行前通知所有协作者，执行后所有人重新克隆。

### 方案 A：Git LFS 迁移（推荐）

保留完整提交历史，大图对象改存 LFS 存储：

```bash
git lfs migrate import --everything --include="*.png,*.jpg,*.glb" --include-ref=refs/heads/main
git push --force origin main
```

优点：克隆时可选 `GIT_LFS_SKIP_SMUDGE=1 git clone` 拿到纯指针，体积最小；浏览器端文件内容不变。注意 GitHub LFS 有单独配额，`has_pages` 的站点部署流程需确认 Pages 构建能拉取 LFS 内容。

### 方案 B：filter-repo 裁剪历史

直接从历史中删除超阈值 blob（不可逆，历史哈希全部变化）：

```bash
git filter-repo --strip-blobs-bigger-than 300K --force
git push --force origin main
```

优点：仓库体积直接减半以上，且没有 LFS 配额负担。缺点：旧提交无法恢复大图原始内容，所有 fork/PR 需要基于新历史重建。

## 防回归

- 超过 1 MiB 的单个资产或总量超过 48 MiB 时，`npm run build` / `typecheck` 直接失败。
- `scripts/split-weather-atlases.py` 产出新纹理后需执行 `pngquant --quality=70-95 --speed 1 --force --skip-if-larger --ext .png` 再提交。
- 疑似未被引用的资产：`apps/web/src/assets/cg/echo/memory-wall.png` 在代码中无任何 import 或 glob 命中（其余 89 个"疑似未引用"文件实际通过 `import.meta.glob` 命中）。删除前需确认剧情规划，本 PR 暂不处理。
