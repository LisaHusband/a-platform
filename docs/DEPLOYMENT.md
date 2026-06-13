# 自动部署实施方案 · Automated Deployment Guide

> 本项目采用 **GitHub Actions + SSH 推送式** 部署：部署前自动进行环境检查与测试，
> 部署后自动执行健康检查；Nginx 配置与 SSL 证书均由脚本自动管理，部署失败会自动
> 回滚到上一稳定版本。服务器无需访问 GitHub。
>
> This project uses **GitHub Actions + SSH push** deployment: environment checks
> and tests run before deploy, health checks run after; Nginx config and SSL
> certificates are script-managed; a failed deploy auto-rolls-back to the last
> stable release. The server never needs to reach GitHub.

## 1. 总览 · Overview

```
GitHub push → CI(lint+test+build, 全绿) → Deploy 工作流
  → 构建前端 → 打包产物 → SCP 上传 → SSH 调用 deploy.sh
服务器 / server:
  preflight(环境预检) → 解包 → 建 venv → 写配置 → 渲染 systemd
  → 原子切换 current → 重启后端 → 渲染 Nginx+reload
  → SSL 申请/续签 → 健康检查 → (失败) 自动回滚 → 清理旧版本
```

发布采用「构建产物传输 + 服务器端原子切换」，不在服务器上拉代码。
Releases use *artifact transfer + atomic server-side switch*, never `git pull` on the server.

## 2. 组成 · Components

| 路径 / Path | 作用 / Purpose |
|---|---|
| [.github/workflows/ci.yml](../.github/workflows/ci.yml) | 测试门禁 / test gate (lint+build+test, coverage ≥ 90%) |
| [.github/workflows/deploy.yml](../.github/workflows/deploy.yml) | CI 成功后构建、打包、上传、远程发布 / build, ship, release |
| [deploy/scripts/preflight.sh](../deploy/scripts/preflight.sh) | 环境检测与缺失依赖自动安装 / env check + auto-install |
| [deploy/scripts/deploy.sh](../deploy/scripts/deploy.sh) | 发布编排（含失败自动回滚）/ release orchestration + auto-rollback |
| [deploy/scripts/rollback.sh](../deploy/scripts/rollback.sh) | 手动回滚 / manual rollback |
| [deploy/scripts/render_nginx.sh](../deploy/scripts/render_nginx.sh) | 渲染并校验 Nginx 配置 / render + validate Nginx |
| [deploy/scripts/ssl_check.sh](../deploy/scripts/ssl_check.sh) | 证书申请与到期续签 / cert issue + renew |
| [deploy/scripts/health_check.sh](../deploy/scripts/health_check.sh) | 部署后健康检查 / post-deploy checks |
| [deploy/nginx/a-platform.conf.tpl](../deploy/nginx/a-platform.conf.tpl) | Nginx 配置模板 / Nginx template |
| [deploy/systemd/a-platform.service.tpl](../deploy/systemd/a-platform.service.tpl) | 后端 systemd 单元模板 / backend systemd unit |
| [deploy/.env.example](../deploy/.env.example) | 部署/运行期变量示例 / config example |

## 3. 服务器目录结构 · Server Layout

```
${DEPLOY_PATH}/                 # e.g. /www/wwwroot/a-platform
├── releases/
│   ├── 20260613090001-ab12cd3/
│   └── 20260613103000-ef45gh6/
├── current -> releases/20260613103000-ef45gh6   # 原子软链 / atomic symlink
├── shared/
│   ├── .env                    # 运行期密钥/配置（持久，权限 600）/ runtime secrets
│   ├── a_platform.db           # SQLite 数据库 / database
│   └── acme/                   # ACME 验证 webroot
├── logs/
└── (systemd unit -> /etc/systemd/system/${SERVICE_NAME}.service)
```

后端 systemd 的 `ExecStart` 指向 `current/backend/.venv`，切换软链后 `restart` 即运行新版本。
The backend unit's `ExecStart` points at `current/backend/.venv`; a restart after the symlink switch runs the new release.

## 4. 健康检查接口 · Health Endpoints

后端提供 / The backend exposes:

- `GET /api/v1/health` — 服务状态 + 版本 + 依赖（数据库、搜索索引）状态。
  Service status + version + dependency (DB, search index) status. `status` 仅当全部依赖正常时为 `ok`。
- `GET /api/v1/version` — 当前发布版本号（部署时写入 `APLATFORM_VERSION`）。
  Current release version (set via `APLATFORM_VERSION` at deploy time).

## 5. 自动回滚 · Automatic Rollback

`deploy.sh` 在以下任一情况触发回滚 / rolls back on any of:
后端启动失败、Nginx 校验/reload 失败、健康检查失败、关键步骤报错。
backend start failure, Nginx validate/reload failure, health-check failure, or any key step erroring.

回滚动作 / rollback action: 将 `current` 切回上一版本 → 重启后端 → 重渲染并 reload Nginx → 复检。
switch `current` back → restart backend → re-render & reload Nginx → re-check.
手动回滚 / manual: `ROLLBACK_TO=<release_id> deploy/scripts/rollback.sh`（省略则回上一版本 / omit for previous）。

## 6. SSL 证书 · TLS Certificates

首次部署渲染 HTTP 引导配置以完成 ACME webroot 验证，申请成功后渲染完整 HTTPS 配置。
First deploy renders an HTTP bootstrap config for the ACME webroot challenge, then the full HTTPS config once issued.
后续部署检查剩余有效期，低于 `SSL_RENEW_THRESHOLD_DAYS`（默认 30 天）自动续签；
续签失败时保留现有证书、记录日志、不中断线上访问。
Subsequent deploys renew when under `SSL_RENEW_THRESHOLD_DAYS` (default 30); on failure the existing cert is kept and traffic is not interrupted.

---

## 7. 上线前准备清单 · Pre-launch Checklist

### 7.1 服务器侧 · Server

- [ ] 公网 IP / Public IP
- [ ] 地域与可用区 / Region & AZ
- [ ] 操作系统 Ubuntu 24.04
- [ ] SSH 端口（默认 22）/ SSH port
- [ ] 部署用户 `deploy`（建议单独创建，具备 sudo）/ dedicated sudo user
- [ ] SSH 私钥已加入 GitHub Secrets / SSH private key in GitHub Secrets
- [ ] 是否使用宝塔面板管理 Nginx / Baota-managed Nginx?
- [ ] `${DEPLOY_PATH}` 部署目录 / deploy path
- [ ] `${NGINX_CONF_PATH}` Nginx 配置路径 / Nginx conf path
- [ ] systemd 服务名 `${SERVICE_NAME}` / service name

### 7.2 域名与证书 · Domain & TLS

- [ ] 主域名 `www.a-platform.tech` 已解析到公网 IP / DNS A record set
- [ ] 备用域名（如有）/ alt domains
- [ ] 80 / 443 端口已放通（安全组 + 防火墙）/ ports 80,443 open
- [ ] 证书申请邮箱 `SSL_EMAIL` / cert email
- [ ] 允许自动续签 / auto-renew allowed

### 7.3 应用 · Application

- [ ] 后端端口 `127.0.0.1:18321` / backend port
- [ ] API 前缀 `/api/v1` / API prefix
- [ ] 健康检查接口 `/api/v1/health` / health endpoint
- [ ] `APLATFORM_SECRET`（首次部署自动生成，可自定义）/ app secret
- [ ] `APLATFORM_DB` 数据库路径 / DB path
- [ ] 前端 `VITE_API_BASE`（默认 `https://${DOMAIN_NAME}/api/v1`）/ frontend API base

### 7.4 部署策略 · Strategy

- [ ] 自动回滚已启用（默认）/ auto-rollback (default on)
- [ ] 保留版本数 `KEEP_RELEASES`（默认 5）/ releases to keep
- [ ] 零停机原子切换已启用（默认）/ zero-downtime atomic switch (default on)
- [ ] 发布通知（可选）/ release notification (optional)

---

## 8. GitHub Secrets

在仓库 *Settings → Secrets and variables → Actions* 配置 / configure in repo settings:

| Secret | 示例 / Example |
|---|---|
| `SERVER_HOST` | `203.0.113.10` |
| `SERVER_PORT` | `22` |
| `SERVER_USER` | `deploy` |
| `SERVER_KEY` | SSH 私钥内容 / SSH private key (PEM) |
| `DEPLOY_PATH` | `/www/wwwroot/a-platform` |
| `NGINX_CONF_PATH` | `/etc/nginx/sites-enabled/a-platform.conf` |
| `DOMAIN_NAME` | `www.a-platform.tech` |
| `BACKEND_PORT` | `18321` |
| `SSL_EMAIL` | `ops@a-platform.tech` |
| `SERVICE_NAME` | `a-platform` |
| `VITE_API_BASE` | （可选 / optional）`https://www.a-platform.tech/api/v1` |

## 9. 首次部署 · First Deploy

1. 在服务器创建部署用户与目录，授予对 `${DEPLOY_PATH}`、Nginx 配置、`systemctl` 的 sudo 权限。
   Create the deploy user/dirs; grant sudo for `${DEPLOY_PATH}`, Nginx config, and `systemctl`.
2. 配置上述 GitHub Secrets。/ Configure the secrets above.
3. 完成域名解析（A 记录指向服务器 IP）。/ Point DNS to the server.
4. 推送到 `main`（或在 Actions 手动运行 *Deploy*）。CI 通过后自动发布并申请证书。
   Push to `main` (or run *Deploy* manually). After CI passes it releases and issues the cert.
5. 访问 `https://www.a-platform.tech` 验证。/ Verify the site.

> 可选：将 `deploy/scripts/ssl_check.sh` 加入服务器 cron（每日）以独立兜底续签。
> Optional: add `ssl_check.sh` to a daily cron on the server as an independent renewal safety net.
