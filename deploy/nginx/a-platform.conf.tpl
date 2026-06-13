# A-PLATFORM Nginx 配置模板 / config template.
# 由 deploy/scripts/render_nginx.sh 用 envsubst 渲染；仅替换 ${...} 占位符，
# nginx 自身的 $uri / $host 等变量保持原样。
# Rendered by render_nginx.sh via envsubst (only ${...} placeholders are
# substituted; nginx's own $uri/$host variables are preserved).

# --- HTTP: ACME 验证 + 强制跳转 HTTPS / ACME challenge + force HTTPS ----------
server {
    listen 80;
    listen [::]:80;
    server_name ${DOMAIN_NAME};

    # Let's Encrypt webroot 验证 / webroot challenge
    location /.well-known/acme-challenge/ {
        root ${ACME_WEBROOT};
        default_type "text/plain";
    }

    location / {
        return 301 https://$host$request_uri;
    }
}

# --- HTTPS 主站 / main site ---------------------------------------------------
server {
    listen 443 ssl;
    listen [::]:443 ssl;
    http2 on;
    server_name ${DOMAIN_NAME};

    ssl_certificate     ${SSL_CERT};
    ssl_certificate_key ${SSL_KEY};
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;
    ssl_session_cache shared:SSL:10m;
    ssl_session_timeout 1d;

    # 安全响应头 / security headers
    add_header X-Content-Type-Options nosniff always;
    add_header X-Frame-Options SAMEORIGIN always;
    add_header Referrer-Policy strict-origin-when-cross-origin always;
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;

    # 前端静态资源（SPA） / frontend static assets (SPA)
    root ${FRONTEND_DIR};
    index index.html;

    gzip on;
    gzip_types text/plain text/css application/json application/javascript application/xml image/svg+xml;
    gzip_min_length 1024;

    # 后端接口反向代理 / backend API reverse proxy
    location /api/v1/ {
        proxy_pass http://127.0.0.1:${BACKEND_PORT};
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_read_timeout 60s;
    }

    # 动态站点地图由后端生成 / dynamic sitemap served by backend
    location = /sitemap.xml {
        proxy_pass http://127.0.0.1:${BACKEND_PORT};
        proxy_set_header Host $host;
    }

    # 带哈希的静态产物长缓存 / long cache for hashed build assets
    location /assets/ {
        expires 30d;
        add_header Cache-Control "public, immutable";
    }

    # SPA 前端路由回退 / SPA client-side routing fallback
    location / {
        try_files $uri $uri/ /index.html;
    }

    access_log ${LOG_DIR}/nginx_access.log;
    error_log  ${LOG_DIR}/nginx_error.log;
}
