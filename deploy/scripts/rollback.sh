#!/usr/bin/env bash
# 手动回滚到上一个（或指定）发布版本 / manual rollback to the previous (or given) release.
# 用法 / usage: ROLLBACK_TO=<release_id> ./rollback.sh   （省略则回滚到上一版本）
# shellcheck source=lib.sh
set -euo pipefail
cd "$(dirname "$0")"
source ./lib.sh

for v in DEPLOY_PATH SERVICE_NAME; do require_var "$v"; done
RELEASES="$DEPLOY_PATH/releases"
CURRENT_LINK="$DEPLOY_PATH/current"
SUDO=""; [ "$(id -u)" -eq 0 ] || SUDO="sudo"

CURRENT_TARGET=""
[ -L "$CURRENT_LINK" ] && CURRENT_TARGET="$(readlink -f "$CURRENT_LINK")"

if [ -n "${ROLLBACK_TO:-}" ]; then
  TARGET="$RELEASES/$ROLLBACK_TO"
else
  # 选取最近、且不是当前版本的发布 / newest release that isn't current
  TARGET=""
  # shellcheck disable=SC2012
  for d in $(ls -1dt "$RELEASES"/*/ 2>/dev/null); do
    [ "$(readlink -f "$d")" = "$CURRENT_TARGET" ] && continue
    TARGET="$(readlink -f "$d")"; break
  done
fi

[ -n "$TARGET" ] && [ -d "$TARGET" ] || die "找不到可回滚的版本 / no target release found"

log "回滚 current -> $(basename "$TARGET") / rolling back"
ln -sfn "$TARGET" "$CURRENT_LINK"
$SUDO systemctl restart "$SERVICE_NAME"
./render_nginx.sh || warn "Nginx 渲染失败 / nginx render failed"
$SUDO systemctl reload nginx || warn "Nginx reload 失败 / reload failed"

export BACKEND_PORT="${BACKEND_PORT:-18321}"
if ./health_check.sh; then
  ok "回滚完成且健康检查通过 / rollback healthy: $(basename "$TARGET")"
else
  die "回滚后健康检查仍失败，需人工介入 / still unhealthy after rollback"
fi
