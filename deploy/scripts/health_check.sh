#!/usr/bin/env bash
# 部署后健康检查 / post-deploy health checks.
# 直接打后端本地端口（绕过证书）+ 通过域名验证全链路。任一关键项失败退出非零，
# 由 deploy.sh 据此触发回滚。
# Probes the local backend port (bypassing TLS) and the public domain end-to-end.
# Any critical failure exits non-zero so deploy.sh can roll back.
# shellcheck source=lib.sh
set -euo pipefail
cd "$(dirname "$0")"
source ./lib.sh

require_var BACKEND_PORT
HEALTH_PATH="${HEALTH_PATH:-/api/v1/health}"
DOMAIN_NAME="${DOMAIN_NAME:-}"
LOCAL="http://127.0.0.1:${BACKEND_PORT}"
RETRIES="${HEALTH_RETRIES:-10}"
SLEEP="${HEALTH_SLEEP:-3}"

failed=0
check() {
  local desc="$1" url="$2" expect="${3:-200}" insecure="${4:-}"
  local code
  code=$(curl -s -o /dev/null -w '%{http_code}' ${insecure:+-k} --max-time 10 "$url" || echo 000)
  if [ "$code" = "$expect" ]; then ok "$desc -> $code"; else err "$desc -> $code (期望/expect $expect)"; failed=1; fi
}

# 1) 等待后端起来 / wait for backend to come up
log "等待后端就绪 / waiting for backend at ${LOCAL}${HEALTH_PATH}"
for i in $(seq 1 "$RETRIES"); do
  if curl -fs --max-time 5 "${LOCAL}${HEALTH_PATH}" >/dev/null 2>&1; then
    ok "后端已响应 / backend responding (try $i)"; break
  fi
  [ "$i" -eq "$RETRIES" ] && { err "后端在 $((RETRIES*SLEEP))s 内未就绪 / backend not ready"; exit 1; }
  sleep "$SLEEP"
done

# 2) 本地后端关键检查 / local backend critical checks
status=$(curl -fs --max-time 5 "${LOCAL}${HEALTH_PATH}" | grep -o '"status"[^,]*' || echo "")
log "health: ${status:-<none>}"
echo "$status" | grep -q '"ok"' || { err "health 状态非 ok / not ok"; failed=1; }
check "本地 version / local version" "${LOCAL}/api/v1/version"
check "本地 sitemap / local sitemap" "${LOCAL}/sitemap.xml"

# 3) 通过域名的全链路检查（HTTPS）/ public end-to-end checks over HTTPS
if [ -n "$DOMAIN_NAME" ]; then
  BASE="https://${DOMAIN_NAME}"
  check "首页 / homepage"          "${BASE}/"                 200 insecure
  check "API 健康 / API health"    "${BASE}${HEALTH_PATH}"    200 insecure
  check "API 文档 / API docs"      "${BASE}/docs"             200 insecure
  check "站点地图 / sitemap"       "${BASE}/sitemap.xml"      200 insecure
  # 登录接口存活（凭据错误返回 401 即视为可用）/ login reachable (401 = up)
  code=$(curl -s -k -o /dev/null -w '%{http_code}' --max-time 10 \
    -X POST "${BASE}/api/v1/auth/login" -H 'Content-Type: application/json' \
    -d '{"email":"probe@invalid","password":"x"}' || echo 000)
  if [ "$code" = "401" ] || [ "$code" = "422" ]; then ok "登录接口可用 / login reachable -> $code"
  else err "登录接口异常 / login endpoint -> $code"; failed=1; fi
else
  warn "未提供 DOMAIN_NAME，跳过公网检查 / skipping public checks"
fi

[ "$failed" -eq 0 ] && { ok "===== 健康检查通过 / health checks passed ====="; exit 0; }
err "===== 健康检查失败 / health checks failed ====="; exit 1
