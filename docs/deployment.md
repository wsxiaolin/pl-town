# MiniCity 云服务器部署指南（零基础完整版）

这份文档面向第一次使用云服务器的人，从购买服务器开始，一直到网站、管理后台、HTTPS、自动备份和恢复全部可用。

生产环境使用一台 Ubuntu 云服务器、Nginx、systemd 和 SQLite。Render 只用于临时测试，不保存生产数据。

> 文档中的 `203.0.113.10`、`city.example.com` 和管理员名称都是示例，必须替换成你自己的值。

## 0. 最终会得到什么

部署完成后的结构如下：

```text
浏览器
  |
  | HTTPS / WSS，公网只开放 80 和 443
  v
Nginx
  |-- /                         前端静态文件
  |-- /admin/                   管理后台
  |-- /town-api/                HTTP API
  `-- /ws                       WebSocket
          |
          v
    127.0.0.1:8787 MiniCity 服务
          |
          |-- /var/lib/minicity/minicity.sqlite
          |-- /var/log/minicity/
          `-- /var/backups/minicity/
                    `-- rclone -> 异地对象存储
```

外网只访问 Nginx。Node 服务的 `8787` 端口只监听本机，不能在云防火墙中开放。

部署后地址为：

- 游戏：`https://city.example.com/`
- 管理后台：`https://city.example.com/admin/`
- 存活检查：`https://city.example.com/healthz`
- 数据库就绪检查：`https://city.example.com/readyz`

## 1. 开始前准备

你需要：

1. 一台云服务器。
2. 一个域名，并且可以修改它的 DNS 解析。
3. 当前项目代码。
4. Windows 自带的 PowerShell 和 SSH。
5. 一个自己保存好的管理员账号名和随机长密码。

推荐服务器规格：

- 系统：Ubuntu Server 24.04 LTS，22.04 LTS 也可以。
- CPU：2 核。
- 内存：2 GB 起步；如果在服务器上构建前端，4 GB 更从容。
- 系统盘：40 GB 起步，按数据库、日志和备份增长情况扩容。
- 架构：常见的 `x86_64/amd64` 最省事。
- 实例数量：一台、一个 MiniCity 进程。当前 SQLite 和实时状态不支持多实例。

国内或海外云厂商都可以。若使用中国大陆节点，请在购买前向云厂商核实域名备案及当地合规要求。

## 2. 购买后记录四项信息

在云厂商控制台找到并记录：

```text
公网 IP：203.0.113.10
SSH 用户：root、ubuntu 或云厂商提供的用户名
SSH 密码或私钥：妥善保存
计划使用的域名：city.example.com
```

不要把密码、私钥、管理员凭据或对象存储密钥发到聊天、截图、Git 仓库或公开网盘。

## 3. 配置云防火墙/安全组

在云厂商控制台找到“安全组”“防火墙”或“入站规则”，只放行：

| 协议 | 端口 | 用途 | 来源 |
| --- | ---: | --- | --- |
| TCP | 22 | SSH 管理服务器 | 最好限制为你自己的公网 IP |
| TCP | 80 | HTTP 和证书签发 | `0.0.0.0/0`、IPv6 对应全网 |
| TCP | 443 | HTTPS 和 WSS | `0.0.0.0/0`、IPv6 对应全网 |

不要放行 `8787`。数据库也不需要对外端口。

如果暂时不知道自己的公网 IP，可以在搜索引擎查询“我的 IP”；完成部署后再把 SSH 来源收紧。

## 4. 配置域名 DNS

在域名服务商的 DNS 控制台添加：

```text
记录类型：A
主机记录：city
记录值：203.0.113.10
TTL：默认
```

若域名是 `example.com`，最终完整域名就是 `city.example.com`。服务器有 IPv6 且准备使用时，再添加 `AAAA` 记录；没有正确配置 IPv6 时不要添加。

在你自己的 Windows PowerShell 中检查：

```powershell
Resolve-DnsName city.example.com
```

输出的 IP 应与服务器公网 IP 一致。DNS 可能需要几分钟到数小时生效。在解析正确前不要申请 HTTPS 证书。

## 5. 从 Windows 登录服务器

本节命令在你自己的 Windows PowerShell 中执行：

```powershell
ssh root@203.0.113.10
```

如果云厂商给的是 `ubuntu` 用户，就改成：

```powershell
ssh ubuntu@203.0.113.10
```

第一次连接会出现主机指纹确认，核对云厂商显示的服务器信息后输入 `yes`。输入密码时屏幕不显示字符是正常的。

看到类似下面的提示符就已经进入云服务器：

```text
root@server:~#
```

此后标记为 `bash` 的命令都在云服务器中执行，不是在 Windows 上执行。

常见错误：

- `Connection timed out`：安全组没有开放 22，或 IP/网络不对。
- `Permission denied`：用户名、密码或私钥不对。
- 主机指纹突然变化：先不要继续，确认服务器是否被重装或 IP 是否已分配给别的实例。

## 6. 更新系统并配置服务器防火墙

在云服务器执行：

```bash
sudo apt update
sudo apt upgrade -y
sudo apt install -y curl ca-certificates gnupg git rsync build-essential jq nginx ufw rclone snapd dnsutils openssl
```

先允许 SSH，再启用 UFW，顺序不要反：

```bash
sudo ufw allow OpenSSH
sudo ufw allow 'Nginx Full'
sudo ufw enable
sudo ufw status verbose
```

成功时应看到 22、80、443 对应规则。Ubuntu 官方将 UFW 作为默认防火墙管理工具，参考 [Ubuntu Firewall](https://ubuntu.com/server/docs/security-firewall/)。

建议开启自动安全更新：

```bash
sudo apt install -y unattended-upgrades
sudo dpkg-reconfigure --priority=low unattended-upgrades
```

## 7. 安装 Node.js 22

仓库根目录的 `package.json` 固定 Node.js `22.x`。在云服务器执行：

```bash
curl -fsSL https://deb.nodesource.com/setup_22.x -o /tmp/nodesource_setup.sh
sudo -E bash /tmp/nodesource_setup.sh
sudo apt install -y nodejs
node --version
npm --version
command -v node
```

预期：

```text
v22.x.x
/usr/bin/node
```

安装方式参考 [NodeSource 官方发行仓库](https://github.com/nodesource/distributions)。如果 `command -v node` 不是 `/usr/bin/node`，需要同步修改仓库中的 `deploy/minicity.service`。

## 8. 创建专用用户和目录

不要让应用长期以 root 身份运行。仓库自带的 systemd 配置使用专用 `minicity` 用户。

在云服务器执行：

```bash
sudo useradd --system --home /var/lib/minicity --shell /usr/sbin/nologin minicity
```

如果提示用户已存在，可以继续。然后创建目录：

```bash
sudo install -d -o minicity -g minicity -m 0700 /var/lib/minicity
sudo install -d -o minicity -g minicity -m 0700 /var/log/minicity
sudo install -d -o minicity -g minicity -m 0700 /var/backups/minicity
sudo install -d -o root -g root -m 0755 /opt/minicity /opt/minicity/releases
sudo install -d -o root -g minicity -m 0750 /etc/minicity
sudo install -d -o root -g www-data -m 0755 /var/www/minicity
```

这些目录的用途：

| 路径 | 内容 |
| --- | --- |
| `/opt/minicity/releases/` | 每个版本的代码和构建产物 |
| `/opt/minicity/current` | 指向当前版本的符号链接 |
| `/var/lib/minicity/` | 正式 SQLite 数据库和运行锁 |
| `/var/log/minicity/` | 文件日志 |
| `/var/backups/minicity/` | 本机已校验备份 |
| `/etc/minicity/` | 环境变量和 rclone 凭据 |
| `/var/www/minicity/` | Nginx 提供的前端文件 |

## 9. 配置 Git 部署

生产服务器只从 Git 仓库获取代码。服务器只能拉到已经提交并推送到远程仓库的内容；你本机未提交的工作区改动不会出现在线上。

本节以 GitHub 为例。公开仓库可以直接 clone；私有仓库使用只读 Deploy Key。GitHub 官方说明 Deploy Key 默认只读且只授予单个仓库访问权，适合生产服务器部署：[Managing deploy keys](https://docs.github.com/en/authentication/connecting-to-github-with-ssh/managing-deploy-keys)。

### 9.1 先在本机推送代码

这一小节在你自己的 Windows PowerShell 中执行：

```powershell
Set-Location D:\pl-town
git status
git remote -v
git branch --show-current
git diff --check
```

这个仓库当前应显示：

```text
origin  https://github.com/wsxiaolin/pl-town.git
main
```

先查看 `git status` 列出的文件，只暂存你确认要上线的内容。可以在编辑器的 Source Control 面板逐个选择，也可以在 PowerShell 中逐个添加：

```powershell
git add .gitignore README.md .env.production.example deploy docs apps/server
git status
git diff --cached --check
git diff --cached --stat
```

确认暂存区不包含 `.env`、数据库、日志、`node_modules`、`dist`、测试截图或密钥，再提交并推送：

```powershell
git commit -m "Harden server and add production deployment"
git push origin main
```

如果你有其他尚未完成的本地改动，不要使用宽泛的 `git add -A`；逐个选择文件，避免把无关内容一起上线。本文不会替你执行 commit 或 push。

推送后记录要部署的提交 SHA：

```powershell
$commit = git rev-parse HEAD
$remote = git ls-remote origin refs/heads/main
$commit
$remote
```

输出类似：

```text
0123456789abcdef0123456789abcdef01234567
```

`$remote` 输出的第一列必须与 `$commit` 完全相同。不同说明 push 尚未成功，或本地 HEAD 不在远端 `main`。后面部署时使用这个精确 SHA，可以确保服务器得到的就是你验证过的版本，而不是某个随时可能变化的分支头。

### 9.2 私有仓库创建只读 Deploy Key

如果仓库公开，可跳到 9.4。私有仓库在云服务器执行：

```bash
sudo install -d -o "$USER" -g "$USER" -m 0700 "$HOME/.ssh"
ssh-keygen -t ed25519 -C 'minicity-production-deploy' -f "$HOME/.ssh/minicity_deploy" -N ''
chmod 0600 "$HOME/.ssh/minicity_deploy"
chmod 0644 "$HOME/.ssh/minicity_deploy.pub"
cat "$HOME/.ssh/minicity_deploy.pub"
```

复制最后一条输出的整行公钥。不要复制或公开没有 `.pub` 后缀的私钥。

在 GitHub 网页中：

1. 进入你的 MiniCity 仓库。
2. 打开 `Settings`。
3. 左侧打开 `Deploy keys`。
4. 点击 `Add deploy key`。
5. Title 填 `MiniCity production server`。
6. Key 粘贴刚才的公钥。
7. 不要勾选 `Allow write access`。
8. 点击保存。

Deploy Key 留在服务器的私钥没有密码保护，因此服务器失陷时必须立即从 GitHub 删除并重新生成。

### 9.3 配置 SSH 只使用这把密钥

在云服务器执行：

```bash
nano "$HOME/.ssh/config"
```

写入：

```sshconfig
Host github.com-minicity
    HostName github.com
    User git
    IdentityFile ~/.ssh/minicity_deploy
    IdentitiesOnly yes
```

保存后执行：

```bash
chmod 0600 "$HOME/.ssh/config"
ssh-keyscan -t ed25519 github.com > /tmp/github_ed25519_host_key
ssh-keygen -lf /tmp/github_ed25519_host_key -E sha256
```

把 `ssh-keygen` 显示的 SHA-256 指纹与 [GitHub 公布的 SSH host key fingerprints](https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/githubs-ssh-key-fingerprints) 核对。`ssh-keyscan` 本身不会验证远端身份，所以指纹不一致时绝不能继续。核对一致后再写入 `known_hosts`：

```bash
cat /tmp/github_ed25519_host_key >> "$HOME/.ssh/known_hosts"
rm /tmp/github_ed25519_host_key
chmod 0644 "$HOME/.ssh/known_hosts"
ssh -T git@github.com-minicity
```

第一次测试通常返回“successfully authenticated, but GitHub does not provide shell access”，并以非零状态退出，这是 GitHub 不提供 shell 的正常行为。关键是不能出现 `Permission denied (publickey)`。

### 9.4 Clone 指定提交到新 release

先设置仓库地址和刚才记录的完整提交 SHA。私有仓库使用 `github.com-minicity` 这个 SSH 别名：

```bash
REPOSITORY='git@github.com-minicity:wsxiaolin/pl-town.git'
DEPLOY_COMMIT='这里换成完整的40位提交SHA'
```

公开仓库也可以使用：

```bash
REPOSITORY='https://github.com/wsxiaolin/pl-town.git'
DEPLOY_COMMIT='这里换成完整的40位提交SHA'
```

不要把中文占位符原样执行。确认变量后创建 release：

```bash
[[ "$DEPLOY_COMMIT" =~ ^[0-9a-f]{40}$ ]] || { echo 'DEPLOY_COMMIT 必须是40位小写十六进制完整SHA'; exit 1; }
RELEASE_ID="$(date +%Y%m%d-%H%M%S)-${DEPLOY_COMMIT:0:8}"
sudo install -d -o "$USER" -g "$USER" -m 0755 "/opt/minicity/releases/$RELEASE_ID"
git clone --filter=blob:none --no-checkout "$REPOSITORY" "/opt/minicity/releases/$RELEASE_ID"
cd "/opt/minicity/releases/$RELEASE_ID"
git fetch --depth 1 origin "$DEPLOY_COMMIT"
git checkout --detach "$DEPLOY_COMMIT"
test "$(git rev-parse HEAD)" = "$DEPLOY_COMMIT" || { echo '提交校验失败'; exit 1; }
git status --short
pwd
git log -1 --oneline
ls
```

`git status --short` 应没有输出。你还应看到正确提交，以及 `package.json`、`apps`、`deploy` 和 `docs`。服务器上的 Deploy Key 只有读取权限，生产目录不用于修改或推送代码。

## 10. 安装依赖、测试和构建

以下命令仍在刚才的 release 目录执行：

```bash
npm ci --include=dev
npm run typecheck
npm run test:domain
npm run test:server
VITE_SERVER_URL=wss://city.example.com/ws BASE_PATH=/ npm run build
```

把 `city.example.com` 替换为真实域名。

最后一条会同时构建前端和服务端。服务器内存不足时可能看到 JavaScript heap out of memory，可以先增加临时交换空间：

```bash
sudo fallocate -l 2G /swapfile
sudo chmod 600 /swapfile
sudo mkswap /swapfile
sudo swapon /swapfile
free -h
```

构建成功后检查：

```bash
test -f apps/web/dist/index.html && echo 'frontend ok'
test -f apps/server/dist/index.js && echo 'server ok'
npm prune --omit=dev
sudo chown -R root:root "$(pwd)"
```

构建期间 release 目录归当前 SSH 用户所有；构建完成后改为 root 只读维护。服务进程只读取代码，并且只能写入前面创建的 `/var/lib/minicity`、`/var/log/minicity` 和 `/var/backups/minicity`。

## 11. 创建生产环境变量

先把模板安装到系统配置目录：

```bash
sudo install -o root -g minicity -m 0640 .env.production.example /etc/minicity/minicity.env
sudo nano /etc/minicity/minicity.env
```

`nano` 中使用方向键移动，`Ctrl+O` 后回车保存，`Ctrl+X` 退出。

至少把下面两项改成真实值：

```dotenv
ALLOWED_ORIGINS=https://city.example.com
ADMIN_USERNAME=你的管理员名称
ADMIN_PASSWORD=你的随机长密码
```

完整文件应保留这些关键项：

```dotenv
NODE_ENV=production
HOST=127.0.0.1
PORT=8787
DATA_DIR=/var/lib/minicity
LOG_DIR=/var/log/minicity
BACKUP_DIR=/var/backups/minicity

ALLOWED_ORIGINS=https://city.example.com
TRUST_PROXY_HOPS=1
ALLOW_ORIGINLESS_WEBSOCKET=false

ADMIN_USERNAME=
ADMIN_PASSWORD=
ADMIN_SESSION_TTL_MINUTES=480

SESSION_TTL_DAYS=30
MAX_CONNECTIONS=500
MAX_CONNECTIONS_PER_IP=20

AUTO_BACKUP_ENABLED=true
BACKUP_ON_START=true
BACKUP_INTERVAL_MINUTES=1440
BACKUP_RETENTION_DAYS=30
BACKUP_MAX_FILES=30
LOG_LEVEL=info
```

上面两项故意留空。必须填入真实管理员名称和密码后才能启动。可用下面命令生成随机密码，然后手工放进文件并保存到密码管理器：

```bash
openssl rand -base64 36
```

不要把引号、尖括号或中文示例文字原样留在真实密码字段。生产模式缺少管理员账号、密码或 `ALLOWED_ORIGINS` 时会拒绝启动，这是预期的安全行为。

检查文件权限和关键配置，但不要把整份文件输出到终端截图：

```bash
sudo stat -c '%a %U %G %n' /etc/minicity/minicity.env
sudo grep -E '^(NODE_ENV|HOST|PORT|DATA_DIR|ALLOWED_ORIGINS|ADMIN_USERNAME)=' /etc/minicity/minicity.env
```

权限应为 `640 root minicity`。

## 12. 激活版本并安装 systemd 服务

你应该仍在 release 目录，执行：

```bash
sudo ln -sfn "$(pwd)" /opt/minicity/current
sudo chown -h root:root /opt/minicity/current
sudo cp deploy/minicity.service /etc/systemd/system/minicity.service
sudo systemctl daemon-reload
sudo systemctl enable --now minicity
```

检查服务：

```bash
sudo systemctl status minicity --no-pager
sudo journalctl -u minicity -n 100 --no-pager
curl --fail http://127.0.0.1:8787/healthz
curl --fail http://127.0.0.1:8787/readyz
```

成功时 systemd 显示 `active (running)`，两个 `curl` 都返回包含 `"ok":true` 的 JSON。

如果失败，先看日志：

```bash
sudo journalctl -u minicity -n 200 --no-pager
```

常见原因：管理员密码少于 16 字符、`ALLOWED_ORIGINS` 为空、Node 不在 `/usr/bin/node`、目录权限不正确，或手动启动过另一个服务占用了数据目录。

systemd 常用命令：

```bash
sudo systemctl restart minicity
sudo systemctl stop minicity
sudo systemctl start minicity
sudo journalctl -u minicity -f
```

查看实时日志时按 `Ctrl+C` 只会退出日志查看，不会停止服务。

## 13. 发布前端文件

执行：

```bash
sudo rsync -a --delete /opt/minicity/current/apps/web/dist/ /var/www/minicity/
sudo chown -R root:www-data /var/www/minicity
sudo find /var/www/minicity -type d -exec chmod 0755 {} \;
sudo find /var/www/minicity -type f -exec chmod 0644 {} \;
```

## 14. 先配置 HTTP 站点以申请证书

证书不存在时，不能直接启用仓库里引用正式证书的最终 Nginx 配置。先创建临时 HTTP 配置：

```bash
sudo nano /etc/nginx/sites-available/minicity-bootstrap
```

填入以下内容，并替换域名：

```nginx
server {
    listen 80;
    listen [::]:80;
    server_name city.example.com;

    root /var/www/minicity;
    index index.html;

    location /.well-known/acme-challenge/ {
        try_files $uri =404;
    }

    location / {
        try_files $uri $uri/ /index.html;
    }
}
```

启用它并移除 Ubuntu 默认站点：

```bash
sudo rm -f /etc/nginx/sites-enabled/default
sudo ln -sfn /etc/nginx/sites-available/minicity-bootstrap /etc/nginx/sites-enabled/minicity-bootstrap
sudo nginx -t
sudo systemctl reload nginx
```

此时访问 `http://city.example.com` 应能看到页面，但管理后台和 WebSocket 要在最终 HTTPS 配置启用后才算完成。

## 15. 申请 HTTPS 证书

Certbot 官方当前推荐使用 snap。执行：

```bash
sudo snap install core
sudo snap refresh core
sudo snap install --classic certbot
sudo ln -sfn /snap/bin/certbot /usr/local/bin/certbot
sudo certbot certonly --webroot -w /var/www/minicity -d city.example.com
```

按提示输入接收证书到期通知的邮箱并同意服务条款。成功后证书位于：

```text
/etc/letsencrypt/live/city.example.com/fullchain.pem
/etc/letsencrypt/live/city.example.com/privkey.pem
```

参考 [Certbot Nginx 官方说明](https://certbot.eff.org/instructions?os=ubuntufocal&ws=nginx)。

如果申请失败：

1. `Resolve-DnsName` 或 `dig` 检查域名是否指向这台服务器。
2. 云安全组和 UFW 是否开放 80。
3. `curl http://city.example.com` 是否可访问。
4. 域名是否受 CDN 代理或错误的 AAAA 记录影响。

## 16. 启用最终 Nginx 配置

从仓库复制最终配置：

```bash
sudo cp /opt/minicity/current/deploy/nginx-minicity.conf /etc/nginx/sites-available/minicity
sudo nano /etc/nginx/sites-available/minicity
```

在 `nano` 中按 `Ctrl+\`，搜索：

```text
city.example.com
```

回车后输入你的真实域名，例如 `town.example.cn`，再按 `A` 替换全部匹配。按 `Ctrl+O`、回车保存，按 `Ctrl+X` 退出。确认配置里的域名和证书路径：

```bash
sudo grep -n 'server_name\|ssl_certificate' /etc/nginx/sites-available/minicity
```

输出中不应再出现 `city.example.com`。确认无误后启用：

```bash
sudo ln -sfn /etc/nginx/sites-available/minicity /etc/nginx/sites-enabled/minicity
sudo rm -f /etc/nginx/sites-enabled/minicity-bootstrap
sudo nginx -t
sudo systemctl reload nginx
```

Nginx 配置已包含 WebSocket 所需的 `Upgrade` 和 `Connection` 转发头，依据 [Nginx WebSocket 官方说明](https://nginx.org/en/docs/http/websocket.html)。

测试证书自动续期：

```bash
sudo certbot renew --dry-run
```

## 17. 上线验收

在服务器执行：

```bash
curl --fail https://city.example.com/healthz
curl --fail https://city.example.com/readyz
sudo systemctl is-active minicity nginx
sudo ss -lntp | grep -E ':80 |:443 |:8787 '
```

预期：

- `healthz` 与 `readyz` 成功。
- `minicity` 和 `nginx` 都显示 `active`。
- `80/443` 对公网监听。
- `8787` 只显示 `127.0.0.1:8787`，不能是 `0.0.0.0:8787`。

然后在 Windows 浏览器访问：

```text
https://city.example.com/
```

进入游戏并登录一个测试居民。浏览器开发者工具的 Network/WS 中，应看到 `/ws` 返回 `101 Switching Protocols`。

## 18. 如何进入管理后台

浏览器访问：

```text
https://city.example.com/admin/
```

使用 `/etc/minicity/minicity.env` 中配置的：

```dotenv
ADMIN_USERNAME=...
ADMIN_PASSWORD=...
```

管理后台可以：

- 查看进程、数据库和在线人数状态。
- 搜索居民，停用/启用账号。
- 撤销居民会话，使其重新登录。
- 查看住房归属和成员。
- 查看管理审计日志。
- 执行 WAL 检查点。
- 创建、下载和重新校验数据库备份。

后台故意不提供任意 SQL，也不提供在线恢复按钮。数据库恢复是高风险操作，必须先停服并在终端执行。

修改管理员密码：

```bash
sudo nano /etc/minicity/minicity.env
sudo systemctl restart minicity
```

修改后，原有内存管理员会话随进程重启失效。

## 19. 自动本机备份

服务默认配置：

- 启动时备份一次。
- 每 1440 分钟，即每天备份一次。
- 保留 30 天。
- 最多保留 30 份。

查看备份：

```bash
sudo -u minicity ls -lh /var/backups/minicity
```

每份数据库类似：

```text
minicity-20260813T120000.000Z-a1b2c3d4.sqlite
minicity-20260813T120000.000Z-a1b2c3d4.sqlite.manifest.json
```

sidecar manifest 记录 SHA-256、大小、schema、数据库标识和校验时间。后台也可以手动创建和重新校验备份。

不要用普通 `cp` 复制正在运行的 `minicity.sqlite`，尤其不能忽略 WAL 文件。内置备份使用 SQLite Online Backup API 并在独立 worker 中做完整性检查。

## 20. 配置异地备份

同一台服务器上的备份无法应对整机损坏、账号被盗或云盘误删。生产必须把备份复制到独立对象存储或另一台机器。

### 20.1 创建对象存储

在你选择的云厂商创建一个私有对象存储桶：

- 不允许公开访问。
- 使用与服务器不同的最小权限凭据。
- 建议开启服务端加密、版本控制和生命周期规则。
- 凭据只允许访问这个备份桶。

rclone 支持 S3、阿里云 OSS、腾讯云 COS、Cloudflare R2 等多种后端。各厂商字段不同，按 rclone 的交互提示填写。

### 20.2 创建 rclone 配置

在服务器执行：

```bash
sudo rclone config --config /etc/minicity/rclone.conf
```

选择 `n` 创建 remote，名称必须填写：

```text
minicity-offsite
```

然后选择你的对象存储类型并填写 endpoint、access key、secret key、region 等。完成后设置权限：

```bash
sudo chown root:minicity /etc/minicity/rclone.conf
sudo chmod 0640 /etc/minicity/rclone.conf
sudo -u minicity env RCLONE_CONFIG=/etc/minicity/rclone.conf rclone lsd minicity-offsite:
```

最后一条应能列出远端目录，且不出现权限错误。

创建同步目标配置：

```bash
sudo nano /etc/minicity/backup-sync.env
```

S3、R2、OSS、COS 这类对象存储通常写成“remote:存储桶/目录”，例如：

```dotenv
MINICITY_BACKUP_REMOTE=minicity-offsite:你的存储桶名称/minicity-backups
```

如果 rclone remote 本身已经固定到目标根目录，也可以写成 `minicity-offsite:minicity-backups`。保存后设置权限：

```bash
sudo chown root:minicity /etc/minicity/backup-sync.env
sudo chmod 0640 /etc/minicity/backup-sync.env
```

不要在值中加入空格、引号或中文示例文字。先手动检查目标可访问，把命令中的桶名称替换为真实值：

```bash
sudo -u minicity env RCLONE_CONFIG=/etc/minicity/rclone.conf \
  rclone lsd minicity-offsite:你的存储桶名称
```

### 20.3 启用异地同步 timer

```bash
sudo cp /opt/minicity/current/deploy/minicity-backup-sync.service /etc/systemd/system/
sudo cp /opt/minicity/current/deploy/minicity-backup-sync.timer /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now minicity-backup-sync.timer
sudo systemctl start minicity-backup-sync.service
sudo systemctl status minicity-backup-sync.service --no-pager
sudo systemctl list-timers minicity-backup-sync.timer --no-pager
```

同步每 6 小时运行一次，只上传 `.sqlite` 和对应的不可变 sidecar。它使用 `rclone copy --immutable`：不会因本机轮转删除远端旧文件，也不会覆盖已存在但内容不同的远端备份。相关语义见 [rclone copy](https://rclone.org/commands/rclone_copy/)、[rclone filtering](https://rclone.org/filtering/) 和 [rclone immutable](https://rclone.org/docs/#immutable)。

检查远端：

```bash
sudo systemctl show minicity-backup-sync.service -p EnvironmentFiles
sudo journalctl -u minicity-backup-sync.service -n 100 --no-pager
```

只看到本机备份不算完成灾备。至少每季度从远端下载一份，在隔离环境做恢复演练。

## 21. 恢复数据库

恢复会把当前数据库回滚到某个备份时刻。所有备份之后产生的数据都会丢失，因此先确认文件名和时间。

### 21.1 取得备份和 SHA-256

本机备份可直接使用。若来自异地存储，先把 `.sqlite` 和同名 `.manifest.json` 下载到 `/var/backups/minicity`。

从远端下载后，确认文件不经过聊天软件或文本工具处理，并恢复最小权限：

```bash
sudo chown minicity:minicity /var/backups/minicity/*.sqlite /var/backups/minicity/*.sqlite.manifest.json
sudo chmod 0600 /var/backups/minicity/*.sqlite /var/backups/minicity/*.sqlite.manifest.json
```

查看 SHA-256：

```bash
BACKUP_NAME='minicity-YYYYMMDDTHHMMSS.sssZ-xxxxxxxx.sqlite'
sudo jq -r '.sha256' "/var/backups/minicity/${BACKUP_NAME}.manifest.json"
```

复制输出的 64 位 SHA-256。

### 21.2 停服恢复

```bash
sudo systemctl stop minicity
sudo -u minicity env DATA_DIR=/var/lib/minicity BACKUP_DIR=/var/backups/minicity \
  /usr/bin/node /opt/minicity/current/apps/server/dist/restoreBackup.js \
  "$BACKUP_NAME" '这里换成64位SHA256' --confirm
```

成功时会显示：

```text
Restore complete. All resident sessions were revoked. Pre-restore backup: ...
```

恢复工具会：

1. 拒绝在服务仍运行或 WAL/SHM 未正常关闭时恢复。
2. 校验 SHA-256、sidecar、数据库标识、schema、完整性和外键。
3. 先创建一份已验证的恢复前快照。
4. 分阶段替换数据库，失败时回滚。
5. 撤销所有居民会话，要求居民重新用密码登录。

启动并验证：

```bash
sudo systemctl start minicity
curl --fail https://city.example.com/readyz
sudo journalctl -u minicity -n 100 --no-pager
```

然后进入后台创建一份新备份，并确认异地同步成功。

## 22. 发布新版本

不要直接覆盖 `/opt/minicity/current` 里面的文件。每次建立新 release，便于代码回滚。

1. 在本机提交并推送新版本，记录经过验证的完整提交 SHA。
2. 按第 9.4 节从 Git clone 该 SHA 到新的 release 目录。
3. 按第 10 步安装依赖、测试和构建。
4. 在当前后台创建并下载一份已验证备份。
5. 切换版本并重启：

```bash
cd /opt/minicity/releases/新的版本目录
sudo ln -sfn "$(pwd)" /opt/minicity/current
sudo chown -h root:root /opt/minicity/current
sudo rsync -a --delete apps/web/dist/ /var/www/minicity/
sudo systemctl restart minicity
curl --fail https://city.example.com/readyz
```

6. 检查游戏、后台、WebSocket 和日志。

保留最近几个 release。确认新版本稳定后再删除很老的代码目录，不要删除 `/var/lib/minicity`、`/var/backups/minicity` 或 `/etc/minicity`。

## 23. 代码回滚

先找到旧版本：

```bash
ls -lah /opt/minicity/releases
readlink -f /opt/minicity/current
```

切回旧版本：

```bash
sudo ln -sfn /opt/minicity/releases/旧版本目录 /opt/minicity/current
sudo rsync -a --delete /opt/minicity/current/apps/web/dist/ /var/www/minicity/
sudo systemctl restart minicity
curl --fail https://city.example.com/readyz
```

如果新版本已经执行了旧代码不兼容的数据库迁移，只切代码不够，必须按第 21 步恢复升级前备份。

## 24. 日常运维命令

```bash
# 服务状态
sudo systemctl status minicity --no-pager

# 最近 100 行日志
sudo journalctl -u minicity -n 100 --no-pager

# 实时日志，Ctrl+C 退出查看
sudo journalctl -u minicity -f

# 数据库就绪状态
curl --fail https://city.example.com/readyz

# 磁盘空间
df -h
sudo du -sh /var/lib/minicity /var/log/minicity /var/backups/minicity

# 自动备份 timer 和异地同步
sudo systemctl status minicity-backup-sync.timer --no-pager
sudo journalctl -u minicity-backup-sync.service -n 100 --no-pager

# 证书续期 timer
sudo systemctl list-timers | grep -E 'certbot|snap.certbot'
```

至少监控：

- `/readyz` 返回非 2xx。
- `minicity` 反复重启。
- 磁盘使用超过 75%。
- 连续自动备份或异地同步失败。
- 大量 `401`、`403`、`429`。
- WebSocket 连接接近配置上限。

## 25. 常见故障排查

### 域名打不开

```bash
dig +short city.example.com
sudo ufw status
sudo systemctl status nginx --no-pager
sudo nginx -t
curl -I http://127.0.0.1
```

检查 DNS、云安全组、UFW 和 Nginx。

### 页面能打开，但游戏显示离线

```bash
sudo systemctl status minicity --no-pager
curl http://127.0.0.1:8787/readyz
sudo journalctl -u minicity -n 100 --no-pager
sudo nginx -T | grep -A15 'location /ws'
```

确认前端构建时使用了 `wss://真实域名/ws`，Nginx `/ws` 配置存在，且浏览器 WebSocket 请求返回 101。

### 服务启动后立即退出

```bash
sudo journalctl -u minicity -n 200 --no-pager
sudo -u minicity test -r /etc/minicity/minicity.env && echo readable
sudo stat -c '%a %U %G %n' /var/lib/minicity /var/log/minicity /var/backups/minicity
```

重点检查环境变量缺失、密码长度、Origin、Node 路径和目录权限。

### `Address already in use` 或运行锁错误

不要同时用 systemd 和手工 `node dist/index.js` 启动。检查：

```bash
sudo ss -lntp | grep 8787
ps aux | grep '[n]ode.*minicity'
```

只保留 systemd 管理的一个进程。

### Physics Lab 内容返回 502

检查服务器是否能访问上游：

```bash
curl -I https://physics-api-cn.turtlesim.com/
curl -I https://physics-lab.oss-cn-hongkong.aliyuncs.com/
sudo journalctl -u minicity -n 100 --no-pager
```

HTTP 状态不一定是 200，但必须能完成 DNS、TCP 和 TLS 连接。不要在日志或求助信息中发送 Physics Lab 登录凭据。

### 备份同步失败

```bash
sudo systemctl status minicity-backup-sync.service --no-pager
sudo journalctl -u minicity-backup-sync.service -n 200 --no-pager
sudo -u minicity env RCLONE_CONFIG=/etc/minicity/rclone.conf rclone lsd minicity-offsite:
```

检查 rclone remote 名称是否恰好为 `minicity-offsite`、凭据权限、对象存储 endpoint 和系统时间。

## 26. 上线最终检查表

- [ ] 云安全组只开放必要的 22、80、443，没有开放 8787。
- [ ] UFW 已启用，SSH 没有被锁死。
- [ ] 域名解析到正确公网 IP。
- [ ] Node.js 是 22.x，服务使用 `/usr/bin/node`。
- [ ] 服务以 `minicity` 用户运行，不是 root。
- [ ] `/etc/minicity/minicity.env` 权限是 `640 root minicity`。
- [ ] `NODE_ENV=production`、`HOST=127.0.0.1`。
- [ ] `ALLOWED_ORIGINS` 是真实 HTTPS Origin。
- [ ] 管理员密码随机、至少 16 字符且未复用。
- [ ] `https://域名/readyz` 正常。
- [ ] 浏览器 `/ws` 返回 101。
- [ ] `https://域名/admin/` 可以登录。
- [ ] 后台手动备份、下载、重新校验均成功。
- [ ] 异地存储同时存在 `.sqlite` 和 `.sqlite.manifest.json`。
- [ ] 做过至少一次停服恢复演练。
- [ ] 已保存服务器、域名、管理员和对象存储凭据的恢复方式。

服务端的安全控制和残余风险见 [security.md](./security.md)。Render 临时测试见 [render-deployment.md](./render-deployment.md)，不能替代本生产方案。
