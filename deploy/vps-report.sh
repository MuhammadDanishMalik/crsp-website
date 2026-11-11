#!/usr/bin/env bash
# Read-only report of the server's health: memory, load, restarts and crashes of the last 24 h, why a 502 happened, versions, region. Changes nothing.
#   curl -fsSL https://raw.githubusercontent.com/MuhammadDanishMalik/crsp-website/main/deploy/vps-report.sh | bash
echo "== time / uptime / load =="; date; uptime
echo "== memory =="; free -m
echo "== disk =="; df -h / | tail -1
echo "== cpu cores =="; nproc
echo "== versions =="; node -v; npm -v; (cd /opt/crsp && node -p "'next '+require('next/package.json').version"); nginx -v 2>&1
echo "== where is this server =="; curl -s -m 8 https://ipinfo.io/json | python3 -c "import sys,json;d=json.load(sys.stdin);print(d.get('city'),d.get('region'),d.get('country'),d.get('org'))" 2>/dev/null
echo "== database host =="; grep -o '@[^/:]*' /etc/crsp.env | head -1; grep -o ':[0-9]*/postgres' /etc/crsp.env | head -1
echo "== app service: restarts and crashes in the last 24 h =="
systemctl show crsp -p NRestarts -p ActiveEnterTimestamp -p MemoryCurrent 2>/dev/null
journalctl -u crsp --since "24 hours ago" --no-pager 2>/dev/null | grep -E "Started crsp|Stopped crsp|Main process exited|Failed|killed|out of memory|OOM|SIGKILL|SIGTERM|Consumed" | tail -40
echo "== kernel out-of-memory kills (24 h) =="; journalctl -k --since "24 hours ago" --no-pager 2>/dev/null | grep -i -E "out of memory|oom|killed process" | tail -5
echo "== deploys (auto-update log) =="; tail -n 30 /var/log/crsp-update.log 2>/dev/null | grep -E "Updated to|error|Error|Failed" | tail -12
echo "== nginx: 502 / 504 in the last 24 h (time of each) =="
for f in /var/log/nginx/access.log /var/log/nginx/access.log.1; do [ -f "$f" ] && awk '$9==502||$9==504{print $4, $9, $7}' "$f"; done | tail -25
echo "== nginx upstream errors =="; tail -n 400 /var/log/nginx/error.log 2>/dev/null | grep -E "connect\(\) failed|upstream" | tail -8 | cut -c1-200
echo "== slowest recent requests (nginx, seconds) =="; echo "(only if the log format has request time: otherwise skipped)"
