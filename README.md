# Rewards · 现场抽奖

进迭时空开发者大会抽奖大屏。使用 Next.js、React 和 Tailwind CSS，部署到腾讯云 CVM / 轻量应用服务器上的 Ubuntu Linux。

已移除 Cloudflare Workers、Wrangler、vinext 和旧站点部署配置，不需要 Cloudflare 账号或绑定。

## 本地运行

需要 Node.js 22.13+（推荐 22 LTS）和 npm。

```bash
npm ci
cp .env.example .env.local
npm run dev
```

访问 `http://localhost:3000/rewards/`。生产构建与检查：

```bash
npm run typecheck
npm run lint
npm run build
npm start
```

生产服务仅监听 `127.0.0.1:3000`，公网请求由 Nginx 转发。

## 腾讯云部署

当前已部署地址：`http://106.55.10.82/rewards/`。目录 `/opt/rewards`，进程由 `rewards.service` 管理；Nginx 在原站点中包含 `/etc/nginx/snippets/rewards.conf`，首页继续使用原有 Dashboard。修改前的配置备份为 `/etc/nginx/sites-available/default.rewards-backup-20261014`。

服务器 IP：`106.55.10.82`。以下以 Ubuntu 22.04 / 24.04、SSH 用户 `ubuntu`、端口 22 为例，需要 sudo 权限。若账号不同，请替换命令中的用户名。

### 1. 准备系统

在服务器执行，已有 Node.js 22.13+ 或 Nginx 时跳过对应安装：

```bash
sudo apt-get update
sudo apt-get install -y ca-certificates curl nginx rsync
curl -fsSL https://deb.nodesource.com/setup_22.x -o /tmp/nodesource-setup.sh
sudo bash /tmp/nodesource-setup.sh
sudo apt-get install -y nodejs
/usr/bin/node --version
npm --version
```

服务配置使用 `/usr/bin/node`，不依赖交互终端中的 nvm。如果 Node.js 安装在其他位置，应修改 `deploy/rewards.service` 的 `ExecStart`。

首次部署创建专用运行用户和目录：

```bash
sudo useradd --system --user-group --create-home --home-dir /var/lib/rewards --shell /usr/sbin/nologin rewards
sudo install -d -o rewards -g rewards /opt/rewards
```

### 2. 上传并构建

在本机项目目录（包含 `package.json` 的目录）执行：

```bash
rsync -av --exclude='.git' --exclude='node_modules' --exclude='.next' \
  --exclude='.env*' --exclude='*.tsbuildinfo' \
  --rsync-path='sudo -u rewards rsync' ./ ubuntu@106.55.10.82:/opt/rewards/
```

然后在服务器执行：

```bash
sudo -u rewards sh -c 'printf "%s\n" "SITE_URL=http://106.55.10.82" "NEXT_PUBLIC_BASE_PATH=/rewards" > /opt/rewards/.env.production'
cd /opt/rewards
sudo -H -u rewards npm ci
sudo -H -u rewards env NEXT_TELEMETRY_DISABLED=1 npm run build
sudo cp deploy/rewards.service /etc/systemd/system/rewards.service
sudo systemctl daemon-reload
sudo systemctl enable --now rewards
curl -I http://127.0.0.1:3000/rewards/
```

`SITE_URL` 用于分享图片的绝对地址，应在构建前设置为实际公网地址。修改后重新构建并重启服务。

### 3. Nginx 和安全组

当前首页已有社区 Dashboard，因此使用 `/rewards/` 子路径。将以下片段包含到现有 server 块，不替换首页配置：

```bash
sudo nginx -T
sudo cp /opt/rewards/deploy/nginx.conf /etc/nginx/snippets/rewards.conf
# 在现有 /etc/nginx/sites-available/default 的 server 块中加入：
# include /etc/nginx/snippets/rewards.conf;
sudo nginx -t
sudo systemctl enable --now nginx
sudo systemctl reload nginx
curl -I -H 'Host: 106.55.10.82' http://127.0.0.1/rewards/
```

腾讯云安全组 / 轻量应用服务器防火墙需允许 TCP 80；配置 HTTPS 时允许 443；SSH 使用 22。3000 仅由本机 Nginx 访问，无需对公网开放。如果启用了 UFW，还需允许 `OpenSSH` 和 `Nginx Full`。

浏览器访问 `http://106.55.10.82/rewards/`，确认抽奖、奖品图片、刷新恢复和名单导出正常。

### 4. 域名与 HTTPS

将域名 A 记录解析到 `106.55.10.82`，把 Nginx 的 `server_name` 改为域名。中国大陆服务器使用域名提供网站时需完成相应备案。域名生效后，可使用腾讯云 SSL 证书配置 Nginx，或执行（替换示例域名）：

```bash
sudo apt-get install -y certbot python3-certbot-nginx
sudo certbot --nginx -d rewards.example.com
```

同时将 `/opt/rewards/.env.production` 的 `SITE_URL` 改为 `https://实际域名`，重新构建并重启 rewards。

## 更新与排查

更新会短暂中断访问，请安排在活动之外。先在本机完成构建验证，在服务器停止服务，再从本机按上面的 rsync 命令上传代码，然后回服务器安装和构建：

```bash
sudo systemctl stop rewards
# 此时从本机上传代码，再继续以下命令。
cd /opt/rewards
sudo -H -u rewards npm ci
sudo -H -u rewards env NEXT_TELEMETRY_DISABLED=1 npm run build
sudo systemctl start rewards
sudo systemctl status rewards --no-pager
```

构建失败时先修复构建，不要启动不完整的产物。修改 service 文件后重新复制并执行 `sudo systemctl daemon-reload`；修改 Nginx 后先 `sudo nginx -t`，再 reload。

```bash
sudo journalctl -u rewards -n 100 --no-pager
sudo tail -n 100 /var/log/nginx/error.log
curl -I http://127.0.0.1:3000/rewards/
```

## 抽奖数据与迁移

人数、奖品图片和中奖记录存储在当前浏览器的 `localStorage` 中，服务端没有数据库。请使用固定电脑、浏览器和访问地址，保持单个抽奖页面；更新服务器代码不会清空同一地址下的浏览器记录。

浏览器存储按协议、主机和端口隔离。从旧 Workers 域名迁移到 IP，或再从 HTTP 切换到 HTTPS 域名，都会使用不同的存储空间，旧记录不会自动迁移。活动前确定最终地址；如旧页面仍可访问，应先导出中奖名单留存（CSV 是名单备份，不支持重新导入）。删除 Worker 不会将浏览器中的记录保存到腾讯云。

默认 `NEXT_PUBLIC_BASE_PATH=/rewards`。如果以后使用独立域名根路径部署，可将该值设为空，再调整 Nginx 路由并重新构建。此变量在构建时确定，不能只在运行时修改。

## 验证记录（2026-10-14）

腾讯云 Ubuntu 24.04、Node.js 22.23.3：生产构建和 TypeScript 检查通过。浏览器已验证抽奖不重复、刷新恢复、奖品图片上传展示、CSV 名单导出，页面与静态资源可通过 `/rewards/` 访问。

现有全量 `npm run lint` 仍报告 React Hooks、可访问性和部分 UI 模板问题；没有为了迁移而关闭规则。新增部署相关 TypeScript / PostCSS 配置的 lint 检查通过。
