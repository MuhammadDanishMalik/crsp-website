#!/usr/bin/env bash
# Installs a timer that checks GitHub every 2 minutes and deploys by itself when main has new commits.
#   bash /opt/crsp/deploy/auto-update.sh
set -euo pipefail
[ "$(id -u)" = 0 ] || { echo "Run as root."; exit 1; }
cat > /usr/local/bin/crsp-autoupdate <<'SH'
#!/usr/bin/env bash
cd /opt/crsp || exit 0
git config --global --add safe.directory /opt/crsp >/dev/null 2>&1 || true
git fetch -q origin main || exit 0
[ "$(git rev-parse HEAD)" = "$(git rev-parse origin/main)" ] && exit 0
exec flock -n /var/lock/crsp-update.lock bash /opt/crsp/deploy/update.sh >> /var/log/crsp-update.log 2>&1
SH
chmod +x /usr/local/bin/crsp-autoupdate
cat > /etc/systemd/system/crsp-autoupdate.service <<'U'
[Unit]
Description=Deploy new CRSP commits
[Service]
Type=oneshot
ExecStart=/usr/local/bin/crsp-autoupdate
U
cat > /etc/systemd/system/crsp-autoupdate.timer <<'U'
[Unit]
Description=Check for new CRSP commits every 2 minutes
[Timer]
OnBootSec=2min
OnUnitActiveSec=2min
[Install]
WantedBy=timers.target
U
systemctl daemon-reload
systemctl enable --now crsp-autoupdate.timer
echo "Auto-deploy is on. Log: /var/log/crsp-update.log"
