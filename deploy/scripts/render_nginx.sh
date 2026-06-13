#!/usr/bin/env bash
# 渲染 Nginx 配置并校验语法 / render the Nginx config and validate it.
# 若 SSL 证书尚不存在，渲染 HTTP-only 引导配置（供 ACME 验证）；
# 证书就绪后渲染完整 HTTPS 配置。任何写入前先备份，nginx -t 失败不生效。
# When certs are absent, render an HTTP-only bootstrap config (for the ACME
# challenge); once present, render the full HTTPS config. Always back up first;
# never activate a config that fails `nginx -t`.
# shellcheck source=lib.sh
set -euo pipefail
cd "$(dirname "$0")"
source ./lib.sh

for v in DOMAIN_NAME FRONTEND_DIR BACKEND_PORT NGINX_CONF_PATH ACME_WEBROOT LOG_DIR; do
  require_var "$v"
done

TPL="../nginx/a-platform.conf.tpl"
SSL_DIR="${SSL_DIR:-/etc/letsencrypt/live/${DOMAIN_NAME}}"
export SSL_CERT="${SSL_DIR}/fullchain.pem"
export SSL_KEY="${SSL_DIR}/privkey.pem"

SUDO=""; [ "$(id -u)" -eq 0 ] || SUDO="sudo"
mkdir -p "$ACME_WEBROOT" "$LOG_DIR"

tmp="$(mktemp)"
if [ -f "$SSL_CERT" ] && [ -f "$SSL_KEY" ]; then
  log "证书已存在，渲染完整 HTTPS 配置 / certs found, rendering full HTTPS config"
  export DOMAIN_NAME FRONTEND_DIR BACKEND_PORT ACME_WEBROOT LOG_DIR
  envsubst '${DOMAIN_NAME} ${FRONTEND_DIR} ${BACKEND_PORT} ${SSL_CERT} ${SSL_KEY} ${ACME_WEBROOT} ${LOG_DIR}' \
    < "$TPL" > "$tmp"
else
  warn "证书暂缺，渲染 HTTP-only 引导配置 / no certs yet, rendering HTTP bootstrap"
  cat > "$tmp" <<EOF
server {
    listen 80;
    listen [::]:80;
    server_name ${DOMAIN_NAME};

    location /.well-known/acme-challenge/ {
        root ${ACME_WEBROOT};
        default_type "text/plain";
    }

    root ${FRONTEND_DIR};
    index index.html;

    location /api/v1/ {
        proxy_pass http://127.0.0.1:${BACKEND_PORT};
        proxy_set_header Host \$host;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
    }
    location = /sitemap.xml { proxy_pass http://127.0.0.1:${BACKEND_PORT}; proxy_set_header Host \$host; }
    location / { try_files \$uri \$uri/ /index.html; }
}
EOF
fi

# 备份旧配置 / back up the current config
if [ -f "$NGINX_CONF_PATH" ]; then
  $SUDO cp "$NGINX_CONF_PATH" "${NGINX_CONF_PATH}.bak.$(date +%Y%m%d%H%M%S)"
fi

$SUDO cp "$tmp" "$NGINX_CONF_PATH"
rm -f "$tmp"

log "校验 Nginx 语法 / validating nginx syntax"
if $SUDO nginx -t; then
  ok "Nginx 配置已渲染并通过校验 / rendered & validated"
else
  die "Nginx 配置校验失败，未重载（旧配置仍在备份中）/ validation failed, not reloaded"
fi
