#!/usr/bin/env bash
# 服务器端发布编排 / server-side release orchestration.
#
# 流程 / flow: 解包 → 建 venv → 写配置 → 渲染 systemd → 原子切换 current →
# 重启后端 → 渲染 Nginx + reload → SSL 申请/续签 → 健康检查 →
# 失败自动回滚到上一版本 → 清理旧版本。
# Unpack → build venv → write config → render systemd → atomically switch
# `current` → restart backend → render Nginx + reload → SSL issue/renew →
# health check → auto-rollback to the previous release on failure → prune.
#
# 入参均来自环境变量（由 CI 经 SSH 注入）/ all inputs come from env (injected by CI).
# shellcheck source=lib.sh
set -euo pipefail
cd "$(dirname "$0")"
source ./lib.sh

for v in DEPLOY_PATH RELEASE_ID DOMAIN_NAME BACKEND_PORT SERVICE_NAME SERVICE_USER \
         NGINX_CONF_PATH SSL_EMAIL ARTIFACT; do
  require_var "$v"
done

KEEP_RELEASES="${KEEP_RELEASES:-5}"
RELEASES="$DEPLOY_PATH/releases"
SHARED="$DEPLOY_PATH/shared"
NEW="$RELEASES/$RELEASE_ID"
CURRENT_LINK="$DEPLOY_PATH/current"
export LOG_DIR="${LOG_DIR:-$DEPLOY_PATH/logs}"
export ACME_WEBROOT="${ACME_WEBROOT:-$SHARED/acme}"
export FRONTEND_DIR="$CURRENT_LINK/frontend/dist"
SUDO=""; [ "$(id -u)" -eq 0 ] || SUDO="sudo"

mkdir -p "$RELEASES" "$SHARED" "$LOG_DIR" "$ACME_WEBROOT"

# --- 配置管理：shared/.env 键值 upsert / persistent config upsert --------------
ENV_FILE="$SHARED/.env"
touch "$ENV_FILE"
upsert_env() {
  local key="$1" val="$2"
  if grep -q "^${key}=" "$ENV_FILE"; then
    sed -i "s|^${key}=.*|${key}=${val}|" "$ENV_FILE"
  else
    echo "${key}=${val}" >> "$ENV_FILE"
  fi
}
grep -q "^APLATFORM_SECRET=" "$ENV_FILE" || upsert_env APLATFORM_SECRET "$(openssl rand -hex 32)"
grep -q "^APLATFORM_DB=" "$ENV_FILE"     || upsert_env APLATFORM_DB "$SHARED/a_platform.db"
upsert_env BACKEND_PORT "$BACKEND_PORT"
upsert_env APLATFORM_VERSION "$RELEASE_ID"
chmod 600 "$ENV_FILE"

# --- 1. 解包发布产物 / unpack the release artifact ----------------------------
log "解包 / unpacking $ARTIFACT -> $NEW"
mkdir -p "$NEW"
tar -xzf "$ARTIFACT" -C "$NEW"
[ -d "$NEW/backend/app" ] || die "产物缺少 backend/app / artifact missing backend"
[ -f "$NEW/frontend/dist/index.html" ] || die "产物缺少 frontend/dist / artifact missing frontend build"

# --- 2. 构建后端虚拟环境 / build the backend venv -----------------------------
log "构建后端虚拟环境 / building backend venv (PyPI access required)"
python3 -m venv "$NEW/backend/.venv"
"$NEW/backend/.venv/bin/pip" install --upgrade pip >/dev/null
"$NEW/backend/.venv/bin/pip" install -r "$NEW/backend/requirements.txt" >/dev/null
ok "venv 就绪 / ready"

# --- 3. 渲染并安装 systemd 单元 / render & install the systemd unit ------------
log "渲染 systemd 单元 / rendering systemd unit"
export DEPLOY_PATH SERVICE_USER BACKEND_PORT
unit="/etc/systemd/system/${SERVICE_NAME}.service"
tmp_unit="$(mktemp)"
envsubst '${DEPLOY_PATH} ${SERVICE_USER} ${BACKEND_PORT}' \
  < "../systemd/a-platform.service.tpl" > "$tmp_unit"
$SUDO cp "$tmp_unit" "$unit"; rm -f "$tmp_unit"
$SUDO systemctl daemon-reload
$SUDO systemctl enable "$SERVICE_NAME" >/dev/null 2>&1 || true

# --- 4. 记录上一版本并原子切换 / record previous & atomically switch ----------
PREV_TARGET=""
[ -L "$CURRENT_LINK" ] && PREV_TARGET="$(readlink -f "$CURRENT_LINK")"
log "切换 current -> $RELEASE_ID / switching symlink"
ln -sfn "$NEW" "$CURRENT_LINK"

rollback() {
  err "部署失败，开始回滚 / deploy failed, rolling back"
  if [ -n "$PREV_TARGET" ] && [ -d "$PREV_TARGET" ]; then
    ln -sfn "$PREV_TARGET" "$CURRENT_LINK"
    $SUDO systemctl restart "$SERVICE_NAME" || true
    ./render_nginx.sh || true
    $SUDO systemctl reload nginx || true
    warn "已回滚到上一版本 / rolled back to: $(basename "$PREV_TARGET")"
  else
    err "无可回滚版本（首次部署）/ no previous release to roll back to"
  fi
  exit 1
}

# --- 5. 重启后端 / restart the backend ----------------------------------------
log "重启后端服务 / restarting backend"
$SUDO systemctl restart "$SERVICE_NAME" || rollback

# --- 6. 渲染 Nginx + reload（HTTP 引导，供 ACME）/ render Nginx + reload -------
./render_nginx.sh || rollback
$SUDO systemctl reload nginx || rollback

# --- 7. SSL 申请/续签，再渲染完整 HTTPS / SSL then re-render full HTTPS --------
if ./ssl_check.sh; then
  ./render_nginx.sh || rollback           # 此时证书已就绪 -> 完整 HTTPS / now full HTTPS
  $SUDO systemctl reload nginx || rollback
else
  warn "SSL 步骤未完成，保持当前 Nginx 配置 / SSL incomplete, keeping current config"
fi

# --- 8. 健康检查，失败回滚 / health check, rollback on failure -----------------
export DOMAIN_NAME BACKEND_PORT
if ! ./health_check.sh; then rollback; fi

# --- 9. 清理旧版本，保留最近 N 个 / prune old releases (keep newest N) ---------
log "清理旧版本，保留 $KEEP_RELEASES 个 / pruning, keeping newest $KEEP_RELEASES"
# shellcheck disable=SC2012
ls -1dt "$RELEASES"/*/ 2>/dev/null | tail -n +$((KEEP_RELEASES + 1)) | while read -r old; do
  [ "$(readlink -f "$old")" = "$(readlink -f "$CURRENT_LINK")" ] && continue
  log "删除旧版本 / removing $(basename "$old")"
  rm -rf "$old"
done

ok "===== 部署成功 / deploy succeeded: $RELEASE_ID ====="
