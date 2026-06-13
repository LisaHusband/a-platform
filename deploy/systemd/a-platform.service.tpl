# A-PLATFORM 后端 systemd 服务模板 / backend systemd unit template.
# 由 deploy.sh 渲染到 /etc/systemd/system/${SERVICE_NAME}.service。
# ExecStart 指向 current 软链，发布切换后 restart 即运行新版本。
# ExecStart points at the `current` symlink; a restart after the switch runs
# the new release. Rendered by deploy.sh.
[Unit]
Description=A-PLATFORM FastAPI backend
After=network.target

[Service]
Type=simple
User=${SERVICE_USER}
WorkingDirectory=${DEPLOY_PATH}/current/backend
EnvironmentFile=${DEPLOY_PATH}/shared/.env
ExecStart=${DEPLOY_PATH}/current/backend/.venv/bin/uvicorn app.main:app --host 127.0.0.1 --port ${BACKEND_PORT}
Restart=always
RestartSec=3
# 安全加固 / hardening
NoNewPrivileges=true
PrivateTmp=true

[Install]
WantedBy=multi-user.target
