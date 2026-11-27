#!/usr/bin/env bash
# Pull the latest code, build ON THE SIDE while the site keeps running, then swap and restart (a few seconds).
# Run as root:  bash /opt/crsp/deploy/update.sh
set -euo pipefail
APP=/opt/crsp
BUILD=/opt/crsp-build
[ "$(id -u)" = 0 ] || { echo "Run as root."; exit 1; }

git config --global --add safe.directory "$APP" >/dev/null 2>&1 || true
git -C "$APP" pull --ff-only
SHA=$(git -C "$APP" rev-parse HEAD)
command -v rsync >/dev/null || apt-get install -y -q rsync

# 1. copy the source next to the live app and build there
mkdir -p "$BUILD"
rsync -a --delete --exclude .git --exclude node_modules --exclude .next --exclude .data --exclude .deps-lock "$APP/" "$BUILD/"
[ -d "$BUILD/node_modules" ] || cp -a "$APP/node_modules" "$BUILD/node_modules"
NEWDEPS=0
if [ -f "$BUILD/.deps-lock" ] && ! cmp -s "$BUILD/package-lock.json" "$BUILD/.deps-lock"; then NEWDEPS=1; fi
chown -R crsp:crsp "$APP" "$BUILD"
if [ "$NEWDEPS" = 1 ]; then
  sudo -u crsp -H bash -c "cd $BUILD && (npm ci --no-audit --no-fund || npm install --no-audit --no-fund)"
fi
cp "$BUILD/package-lock.json" "$BUILD/.deps-lock"
sudo -u crsp -H bash -c "cd $BUILD && export COMMIT_REF=$SHA && (npm run build </dev/null || npm run build </dev/null)"
[ -f "$BUILD/.next/BUILD_ID" ] || { echo "Build failed: the running site was not touched."; exit 1; }

# 2. keep the old files of screens that are still open, then swap
if [ -d "$APP/.next/static" ]; then cp -an "$APP/.next/static/." "$BUILD/.next/static/" 2>/dev/null || true; fi
find "$BUILD/.next/static" -type f -mtime +7 -delete 2>/dev/null || true
[ "$NEWDEPS" = 1 ] && rsync -a --delete "$BUILD/node_modules/" "$APP/node_modules/"
rm -rf "$APP/.next.old"
[ -d "$APP/.next" ] && mv "$APP/.next" "$APP/.next.old"
mv "$BUILD/.next" "$APP/.next"
cp /etc/crsp.version.env /etc/crsp.version.env.old 2>/dev/null || true
echo "COMMIT_REF=$SHA" > /etc/crsp.version.env   # lets the app tell open browser tabs that a new version is live
chown -R crsp:crsp "$APP/.next"
systemctl restart crsp

# 3. check it answers; otherwise put the previous build back
for i in $(seq 1 15); do sleep 1; curl -fsS http://127.0.0.1:3000/api/health >/dev/null 2>&1 && curl -fsS -o /dev/null http://127.0.0.1:3000/pin 2>/dev/null && OK=1 && break; done
if [ "${OK:-0}" != 1 ]; then
  echo "New version did not answer: restoring the previous one."
  rm -rf "$APP/.next"; mv "$APP/.next.old" "$APP/.next"
  cp /etc/crsp.version.env.old /etc/crsp.version.env 2>/dev/null || true
  systemctl restart crsp
  exit 1
fi
curl -fsS http://127.0.0.1:3000/api/health; echo
echo "Updated to ${SHA:0:10}."
