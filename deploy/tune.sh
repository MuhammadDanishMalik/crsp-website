#!/usr/bin/env bash
# One-time speed tuning of the web server on the VPS (safe to run again). Run as root:
#   bash /opt/crsp/deploy/tune.sh
set -euo pipefail
[ "$(id -u)" = 0 ] || { echo "Run as root."; exit 1; }

cat > /etc/nginx/conf.d/crsp-speed.conf <<'CONF'
gzip on;
gzip_comp_level 5;
gzip_min_length 512;
gzip_proxied any;
gzip_vary on;
gzip_types text/plain text/css application/json application/javascript text/javascript application/x-javascript image/svg+xml application/manifest+json;

upstream crsp_app { server 127.0.0.1:3000; keepalive 32; }
CONF

F=/etc/nginx/sites-available/crsp
cp "$F" "$F.bak"
trap 'echo "nginx test failed: restoring the old config"; cp "$F.bak" "$F"; rm -f /etc/nginx/conf.d/crsp-speed.conf' ERR
# talk to the app through the keep-alive upstream, not a new socket per request
sed -i 's#proxy_pass http://127.0.0.1:3000;#proxy_pass http://crsp_app;#' "$F"
grep -q 'proxy_set_header Connection ""' "$F" || sed -i 's#proxy_http_version 1.1;#proxy_http_version 1.1;\n        proxy_set_header Connection "";#' "$F"
# built files never change under the same name: let browsers keep them for a year
if ! grep -q "location /_next/static/" "$F"; then
  python3 - "$F" <<'PY'
import sys,re
p=sys.argv[1]; s=open(p).read()
block='''    location /_next/static/ {
        proxy_pass http://crsp_app;
        proxy_http_version 1.1;
        proxy_set_header Connection "";
        proxy_set_header Host $host;
        add_header Cache-Control "public, max-age=31536000, immutable";
    }

'''
s=re.sub(r'(\n\s*location / \{)', "\n"+block+r"\1", s, count=1)
open(p,"w").write(s)
PY
fi
# HTTP/2 on the HTTPS listeners
sed -i -E 's/listen (\[::\]:)?443 ssl;/listen \1443 ssl http2;/' "$F"
sed -i -E 's/listen (\[::\]:)?443 ssl http2 http2;/listen \1443 ssl http2;/' "$F"
nginx -t
systemctl reload nginx
echo "Tuned: gzip, keep-alive to the app, 1-year cache for built files, HTTP/2."
