# Agent 依赖安装与 GitHub 提交流程指南

本指南面向在本仓库或其他 npm/多语言仓库中工作的所有开发代理。目标是：**拿到项目后先装好依赖，并行准备脚本，完成后通过 Git credential helper 完成认证与 PR**。

## 总体原则

- **拿到项目第一步先安装依赖**，不要等真正需要时才临时安装。
- **装依赖与准备脚本要并发进行**：在后台终端跑依赖安装的同时，并行阅读项目文档、准备构建/测试/启动脚本。
- **所有 GitHub 操作一律通过 Git credential helper 认证**，严禁使用未认证的 GitHub 网络 API。

## 一、一键安装脚本

仓库根目录提供 `scripts/setup-deps.sh`，自动完成镜像选择、依赖安装和 submodule 初始化：

```bash
# 自动探测区域并安装依赖（推荐）
scripts/setup-deps.sh

# 强制国内镜像（海外网络环境下国内镜像不可达时可手动切换）
scripts/setup-deps.sh --region cn

# 强制海外官方源
scripts/setup-deps.sh --region intl

# 指定项目目录（默认当前目录）
scripts/setup-deps.sh --project /path/to/project

# 只查看镜像配置，不安装
scripts/setup-deps.sh --skip-install
```

### 脚本行为

1. **区域探测**：优先读取 `AGENT_REGION` 或 `--region`；否则对比 google.com / baidu.com 连通性；两者都可达时对比国内外镜像延迟，取更快一方。
2. **镜像选择**：国内选用 npmmirror、清华 PyPI、goproxy.cn；海外使用官方源。
3. **按锁文件安装**：`package-lock.json` → `npm ci`；`pnpm-lock.yaml` → `pnpm install --frozen-lockfile`；`yarn.lock` → `yarn install --frozen-lockfile`；`requirements.txt` / `pyproject.toml` → pip；`go.mod` → `go mod download`；`Cargo.toml` → `cargo fetch`。
4. **submodule 初始化**：存在 `.gitmodules` 时执行 `git submodule update --init --recursive --depth 1`。

### 环境变量覆盖（优先级最高）

```bash
export AGENT_REGION=cn                 # 直接指定区域
export NPM_REGISTRY=https://registry.npmmirror.com
export PIP_INDEX_URL=https://pypi.tuna.tsinghua.edu.cn/simple
export GO_PROXY=https://goproxy.cn,direct
```

## 二、手动镜像配置速查

| 包管理器 | 国内镜像 | 海外官方源 |
|---------|---------|-----------|
| npm | `npm config set registry https://registry.npmmirror.com` | `npm config set registry https://registry.npmjs.org` |
| pip | `pip config set global.index-url https://pypi.tuna.tsinghua.edu.cn/simple` | `pip config set global.index-url https://pypi.org/simple` |
| go | `go env -w GOPROXY=https://goproxy.cn,direct` | `go env -w GOPROXY=https://proxy.golang.org,direct` |
| cargo | 配置 `source.crates-io` 替换为 `rsproxy.cn` | 使用默认 crates.io |

安装依赖的常用命令：

```bash
# Node.js 项目
npm ci            # 有 package-lock.json 时优先使用，保证可复现
npm install       # 无锁文件时

# Python 项目
python3 -m pip install --break-system-packages -r requirements.txt

# Go 项目
go mod download

# 初始化 submodule
git submodule update --init --recursive --depth 1
```

## 三、并发准备脚本

依赖安装较慢时，不要让代理空等。标准动作：

1. 用后台终端启动 `scripts/setup-deps.sh`（见下方"长任务后台运行"）。
2. 安装进行的同时，并行阅读项目 README / Agents.md / 文档，确定构建、测试、启动命令。
3. 准备好 `npm run build`、`npm run typecheck`、`npm run test` 等校验脚本及其所需环境（如 Xvfb、Playwright 浏览器、系统库）。
4. 依赖装好后立即验证：先跑一次构建或类型检查，确认环境可用再开始改代码。

### 长任务后台运行

依赖安装可能耗时较长，必须使用受管理的后台终端运行，避免阻塞会话：

```bash
# 使用 background terminal 工具系列，不要用 & 或裸 timeout 包装
scripts/setup-deps.sh --project /workspace
```

运行后用输出日志路径跟踪进度，完成后确认退出码为 0。

## 四、GitHub 认证与 PR（Git credential helper）

### 原则

- **所有 `gh` 操作、`git push`、PR 创建，一律通过 Git credential helper 提供凭据。**
- **严禁**直接调用未认证的 GitHub 网络 API（例如不带 token 的 `curl https://api.github.com/...`、无认证的 `wget` 等）。
- 不要在命令中硬编码或打印 token；token 只用于认证流程内部。

### 1. 从 credential helper 获取凭据

使用 `git credential fill`，它会把请求转发给本环境配置的 credential helper：

```bash
echo -e "protocol=https\nhost=github.com\n" | git credential fill
# 输出 username 与 password（即 token），只在认证流程内部使用
```

### 2. 让 gh CLI 使用该凭据

把上一步拿到的 token 通过标准输入喂给 `gh auth login`，避免 token 出现在命令行参数里：

```bash
echo -e "protocol=https\nhost=github.com\n" | git credential fill | \
  awk '/^password=/{sub(/^password=/,""); print}' | \
  gh auth login --hostname github.com --with-token
```

验证认证状态：

```bash
gh auth status
```

### 3. 推送分支并创建 PR

认证完成后，正常执行 push 与 PR 创建，凭据由 git/gh 自动读取：

```bash
git checkout -b <branch-name>
git push -u origin <branch-name>
gh pr create --title "..." --body "..."
```

### 4. 认证失效时的处理

- 重新执行第 1、2 步刷新凭据。
- 若 credential helper 返回空或报错，先检查 `git config --get credential.helper` 是否指向正确的 helper，再重试。
- 严禁为了绕开认证而改用未认证的 HTTP 接口。

## 五、禁止事项

- 禁止使用未认证的 GitHub REST API（`api.github.com`）完成任何操作。
- 禁止把 token 写入代码、日志、提交信息或输出到聊天窗口。
- 禁止绕过 Git credential helper 用其他方式硬编码凭据。

## 六、排错

| 现象 | 处理 |
|------|------|
| `npm ci` 报 401/403/404 | 确认 `npm_config_registry` 指向可达镜像，或使用 `scripts/setup-deps.sh` 重新探测 |
| go mod 报 40x | 参照 `go-mod-credential-fix` 规则，把 helper 凭据写入 `/root/.netrc` 后重试 |
| `gh` 提示未认证 | 重新执行"让 gh CLI 使用该凭据"步骤 |
| 国内镜像超时 | 环境在海外，改用 `--region intl` 或官方源 |
