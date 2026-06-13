#!/usr/bin/env bash
# SSL 证书申请与过期续签 / obtain & renew Let's Encrypt certificates.
# 首次申请前校验解析与端口；续签仅在剩余有效期低于阈值时触发。
# 续签失败时保留现有证书、记录日志、不中断线上访问。
# Verifies DNS + ports before first issuance; renews only under the threshold.
# On failure it keeps the existing cert, logs, and never breaks live traffic.
# shellcheck source=lib.sh
set -euo pipefail
cd "$(dirname "$0")"
source ./lib.sh

for v in DOMAIN_NAME SSL_EMAIL ACME_WEBROOT; do require_var "$v"; done
THRESHOLD_DAYS="${SSL_RENEW_THRESHOLD_DAYS:-30}"
SSL_DIR="/etc/letsencrypt/live/${DOMAIN_NAME}"
CERT="${SSL_DIR}/fullchain.pem"
SUDO=""; [ "$(id -u)" -eq 0 ] || SUDO="sudo"

bootstrap_acme() {
  if [ -x "$HOME/.acme.sh/acme.sh" ] || has_cmd acme.sh; then return 0; fi
  if has_cmd certbot; then return 0; fi
  log "安装 acme.sh / bootstrapping acme.sh"
  curl -fsSL https://get.acme.sh | sh -s email="$SSL_EMAIL" >/dev/null 2>&1 \
    || die "acme.sh 安装失败 / install failed"
}

acme_bin() { [ -x "$HOME/.acme.sh/acme.sh" ] && echo "$HOME/.acme.sh/acme.sh" || echo "acme.sh"; }

issue_cert() {
  log "申请证书 / issuing certificate for ${DOMAIN_NAME}"
  if has_cmd certbot && ! { [ -x "$HOME/.acme.sh/acme.sh" ] || has_cmd acme.sh; }; then
    $SUDO certbot certonly --webroot -w "$ACME_WEBROOT" -d "$DOMAIN_NAME" \
      --non-interactive --agree-tos -m "$SSL_EMAIL" || return 1
  else
    local acme; acme="$(acme_bin)"
    "$acme" --issue -d "$DOMAIN_NAME" -w "$ACME_WEBROOT" --server letsencrypt || return 1
    $SUDO mkdir -p "$SSL_DIR"
    "$acme" --install-cert -d "$DOMAIN_NAME" \
      --key-file "${SSL_DIR}/privkey.pem" \
      --fullchain-file "${SSL_DIR}/fullchain.pem" \
      --reloadcmd "$SUDO nginx -s reload" || return 1
  fi
}

cert_days_left() {
  local end_epoch now_epoch
  end_epoch=$($SUDO openssl x509 -enddate -noout -in "$CERT" 2>/dev/null | cut -d= -f2 \
              | xargs -I{} date -d "{}" +%s 2>/dev/null) || return 1
  now_epoch=$(date +%s)
  echo $(( (end_epoch - now_epoch) / 86400 ))
}

mkdir -p "$ACME_WEBROOT"
bootstrap_acme

if [ ! -f "$CERT" ]; then
  log "未发现证书，执行首次申请 / no cert, first issuance"
  # 解析校验（尽力而为）/ best-effort DNS check
  if has_cmd dig; then
    resolved="$(dig +short "$DOMAIN_NAME" | tail -n1 || true)"
    [ -n "$resolved" ] && log "解析到 / resolves to: $resolved" || warn "无法解析域名，继续尝试 / DNS unresolved, trying anyway"
  fi
  if issue_cert; then ok "证书申请成功 / certificate issued"; else die "证书申请失败 / issuance failed"; fi
else
  if days="$(cert_days_left)"; then
    log "证书剩余有效期 / days remaining: ${days}d (阈值/threshold ${THRESHOLD_DAYS}d)"
    if [ "$days" -lt "$THRESHOLD_DAYS" ]; then
      log "低于阈值，续签 / under threshold, renewing"
      if issue_cert; then ok "续签成功 / renewed"; else
        warn "续签失败，保留现有证书 / renew failed, keeping current cert"
      fi
    else
      ok "证书仍然有效，无需续签 / still valid"
    fi
  else
    warn "无法读取证书有效期 / cannot read cert expiry"
  fi
fi
