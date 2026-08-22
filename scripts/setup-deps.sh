#!/usr/bin/env bash
#
# setup-deps.sh — 依赖安装与镜像自动选择脚本
#
# 功能：
#   1. 探测运行环境所在区域（国内 cn / 海外 intl），为各包管理器选择最快可用镜像
#   2. 按项目锁文件自动安装依赖（npm / yarn / pnpm / pip / go / cargo）
#   3. 初始化 Git submodule
#
# 用法：
#   scripts/setup-deps.sh                   # 自动探测区域并安装依赖
#   scripts/setup-deps.sh --region cn       # 强制使用国内镜像
#   scripts/setup-deps.sh --region intl     # 强制使用海外官方源
#   scripts/setup-deps.sh --project <目录>  # 指定项目目录（默认当前目录）
#   scripts/setup-deps.sh --skip-install    # 仅配置镜像并打印结果，不执行安装
#
# 环境变量覆盖（优先级高于区域自动选择）：
#   AGENT_REGION    cn | intl，直接指定区域
#   NPM_REGISTRY    npm 镜像地址
#   PIP_INDEX_URL   pip 索引地址
#   GO_PROXY        Go module 代理地址（逗号分隔可带 direct）
#   CARGO_MIRROR    Cargo 镜像 registry 名（cn 下默认 rsproxy）
#
# 区域探测逻辑：
#   1. 若提供 --region 或 AGENT_REGION，直接采用
#   2. 否则测试 google.com 与 baidu.com 连通性判断网络环境
#   3. 若两者都可达（如部分沙箱），对比国内外镜像延迟，选择更快一方

set -euo pipefail

PROJECT_DIR="${PWD}"
REGION=""
SKIP_INSTALL=0

usage() {
  sed -n '2,40p' "$0"
}

parse_args() {
  while [ "$#" -gt 0 ]; do
    case "$1" in
      --region)
        REGION="$2"
        shift 2
        ;;
      --project)
        PROJECT_DIR="$2"
        shift 2
        ;;
      --skip-install)
        SKIP_INSTALL=1
        shift
        ;;
      -h|--help)
        usage
        exit 0
        ;;
      *)
        echo "未知参数: $1" >&2
        usage
        exit 1
        ;;
    esac
  done
}

probe_latency() {
  curl -s -o /dev/null -w '%{time_total}' --max-time 4 -I "$1" 2>/dev/null || echo "999"
}

detect_region() {
  if [ -n "${AGENT_REGION:-}" ]; then
    echo "${AGENT_REGION}"
    return
  fi
  local google baidu
  google=$(probe_latency "https://www.google.com")
  baidu=$(probe_latency "https://www.baidu.com")
  if [ "$google" = "999" ] && [ "$baidu" != "999" ]; then
    echo "cn"
    return
  fi
  if [ "$baidu" = "999" ] && [ "$google" != "999" ]; then
    echo "intl"
    return
  fi
  local cn_npm intl_npm cn_go intl_go
  cn_npm=$(probe_latency "https://registry.npmmirror.com/-/ping")
  intl_npm=$(probe_latency "https://registry.npmjs.org/-/ping")
  cn_go=$(probe_latency "https://goproxy.cn")
  intl_go=$(probe_latency "https://proxy.golang.org")
  if awk -v a="$cn_npm" -v b="$intl_npm" -v c="$cn_go" -v d="$intl_go" 'BEGIN{exit !((a+c) < (b+d))}'; then
    echo "cn"
  else
    echo "intl"
  fi
}

set_mirrors() {
  if [ "$REGION" = "cn" ]; then
    NPM_REGISTRY=${NPM_REGISTRY:-https://registry.npmmirror.com}
    PIP_INDEX_URL=${PIP_INDEX_URL:-https://pypi.tuna.tsinghua.edu.cn/simple}
    GO_PROXY=${GO_PROXY:-https://goproxy.cn,direct}
    CARGO_MIRROR=${CARGO_MIRROR:-rsproxy}
  else
    NPM_REGISTRY=${NPM_REGISTRY:-https://registry.npmjs.org}
    PIP_INDEX_URL=${PIP_INDEX_URL:-https://pypi.org/simple}
    GO_PROXY=${GO_PROXY:-https://proxy.golang.org,direct}
    CARGO_MIRROR=${CARGO_MIRROR:-}
  fi
  export npm_config_registry="${NPM_REGISTRY}"
  export PIP_INDEX_URL
  export GOPROXY="${GO_PROXY}"
}

install_npm() {
  if [ -f package-lock.json ]; then
    echo "==> [npm] npm ci"
    npm ci
  elif [ -f pnpm-lock.yaml ]; then
    echo "==> [pnpm] pnpm install --frozen-lockfile"
    pnpm install --frozen-lockfile
  elif [ -f yarn.lock ]; then
    echo "==> [yarn] yarn install --frozen-lockfile"
    yarn install --frozen-lockfile
  elif [ -f package.json ]; then
    echo "==> [npm] npm install"
    npm install
  fi
}

install_pip() {
  if [ -f requirements.txt ]; then
    echo "==> [pip] install -r requirements.txt"
    python3 -m pip install --break-system-packages -r requirements.txt
  elif [ -f pyproject.toml ]; then
    echo "==> [pip] install -e ."
    python3 -m pip install --break-system-packages -e .
  elif [ -f Pipfile ]; then
    echo "==> [pipenv] pipenv install"
    pipenv install
  fi
}

install_go() {
  if [ -f go.mod ]; then
    echo "==> [go] go mod download"
    go mod download
  fi
}

install_cargo() {
  if [ ! -f Cargo.toml ]; then
    return
  fi
  if [ -n "$CARGO_MIRROR" ]; then
    echo "==> [cargo] cargo fetch (镜像: ${CARGO_MIRROR})"
    cargo --config 'source.crates-io.replace-with="mirror"' \
      --config 'source.mirror.registry="sparse+https://rsproxy.cn/index/"' \
      fetch
  else
    echo "==> [cargo] cargo fetch"
    cargo fetch
  fi
}

init_submodules() {
  if [ -f .gitmodules ]; then
    echo "==> [git] 初始化 submodule"
    git submodule update --init --recursive --depth 1
  fi
}

run_installs() {
  cd "${PROJECT_DIR}"
  init_submodules
  install_npm
  install_pip
  install_go
  install_cargo
}

main() {
  parse_args "$@"

  if [ -n "$REGION" ]; then
    AGENT_REGION="$REGION"
  fi
  REGION=$(detect_region)

  set_mirrors

  echo "=============================================="
  echo "项目目录:  ${PROJECT_DIR}"
  echo "检测区域:  ${REGION}"
  echo "npm 镜像:  ${NPM_REGISTRY}"
  echo "pip 索引:  ${PIP_INDEX_URL}"
  echo "Go 代理:   ${GO_PROXY}"
  echo "=============================================="

  if [ "$SKIP_INSTALL" = "1" ]; then
    echo "已指定 --skip-install，仅打印镜像配置。"
    exit 0
  fi

  run_installs
  echo "==> 依赖安装完成。"
}

main "$@"
