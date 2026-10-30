#!/usr/bin/env bash
# Pull the latest code, rebuild and restart. Run as root:  bash /opt/crsp/deploy/update.sh
set -euo pipefail
APP=/opt/crsp
[ "$(id -u)" = 0 ] || { echo "Run as root."; exit 1; }

git config --global --add safe.directory "$APP" >/dev/null 2>&1 || true
git -C "$APP" pull --ff-only
SHA=$(git -C "$APP" rev-parse HEAD)
echo "COMMIT_REF=$SHA" > /etc/crsp.version.env   # lets the app tell open browser tabs that a new version is live
chown -R crsp:crsp "$APP"

# npm ci can refuse a lock file written by a newer npm on another OS: then fall back to npm install.
# Build without the secrets in the environment. Next.js sometimes stops the first build to show an upgrade notice: run it again.
sudo -u crsp -H bash -c "cd $APP && export COMMIT_REF=$SHA && (npm ci --no-audit --no-fund || npm install --no-audit --no-fund) && (npm run build || npm run build)"

systemctl restart crsp
sleep 4
curl -fsS http://127.0.0.1:3000/api/health || { echo; echo "The app did not answer: journalctl -u crsp -n 60 --no-pager"; exit 1; }
echo
echo "Updated to ${SHA:0:10}."
