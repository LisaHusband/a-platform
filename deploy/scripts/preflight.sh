#!/usr/bin/env bash
# 部署前环境预检与自动安装 / pre-deploy environment check + auto-install.
# 在服务器上以可 sudo 的用户运行。缺失的关键依赖会尝试安装；不可恢复则终止。
# Run on the server as a sudo-capable user. Missing critical deps are installed;
# unrecoverable absence aborts before any release work.
# shellcheck source=lib.sh
set -euo pipefail
cd "$(dirname "$0")"
source ./lib.sh

# 需要 sudo 时的前缀 / sudo prefix when not root
SUDO=""
[ "$(id -u)" -eq 0 ] || SUDO="sudo"

APT_UPDATED=0
apt_install() {
  local pkg="$1"
  if [ "$APT_UPDATED" -eq 0 ]; then
    log "apt-get update ..."
    $SUDO apt-get update -y >/dev/null
    APT_UPDATED=1
  fi
  log "安装 / installing: $pkg"
  $SUDO DEBIAN_FRONTEND=noninteractive apt-get install -y "$pkg" >/dev/null
}

# 命令 -> apt 包名映射 / command -> apt package
declare -A PKG=(
  [python3]="python3"
  [pip3]="python3-pip"
  [nginx]="nginx"
  [openssl]="openssl"
  [curl]="curl"
  [tar]="tar"
  [rsync]="rsync"
  [envsubst]="gettext-base"
)

log "===== 环境预检 / preflight check ====="

# 关键命令检测与安装 / detect & install required commands
for cmd in python3 pip3 nginx openssl curl tar rsync envsubst; do
  if has_cmd "$cmd"; then
    ok "$cmd 已就绪 / present"
  else
    warn "$cmd 缺失，尝试安装 / missing, installing"
    apt_install "${PKG[$cmd]}" || die "$cmd 安装失败 / install failed"
  fi
done

# python venv 模块 / venv module
if python3 -c "import venv" 2>/dev/null; then
  ok "python3-venv 已就绪 / present"
else
  warn "python3-venv 缺失，尝试安装 / missing, installing"
  apt_install "python3-venv" || die "python3-venv 安装失败"
fi

# systemd 必须存在（不自动安装）/ systemd must exist (never auto-installed)
has_cmd systemctl || die "systemctl 不可用，本方案要求 systemd / systemd is required"
ok "systemctl 已就绪 / present"

# Node：CI 端构建产物，服务器侧仅 acme.sh 需要，非强制 / Node optional on server
if has_cmd node; then ok "node $(node -v) 已就绪 / present"; else warn "node 缺失（前端在 CI 构建，可忽略）/ missing (frontend built in CI)"; fi

# 证书工具 / ACME client
if has_cmd acme.sh || [ -x "$HOME/.acme.sh/acme.sh" ]; then
  ok "acme.sh 已就绪 / present"
elif has_cmd certbot; then
  ok "certbot 已就绪 / present"
else
  warn "未发现 acme.sh/certbot，ssl_check.sh 将尝试安装 acme.sh / will be bootstrapped"
fi

ok "===== 预检通过 / preflight passed ====="
