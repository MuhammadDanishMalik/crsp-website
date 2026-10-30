#!/usr/bin/env bash
# CRSP POS + website: one-time setup on a fresh Ubuntu 24.04 VPS (Hostinger KVM).
# Run as root:   curl -fsSL https://raw.githubusercontent.com/MuhammadDanishMalik/crsp-website/main/deploy/vps-setup.sh | bash
# Safe to run again: it keeps /etc/crsp.env and only updates the code and the web server config.
set -euo pipefail

REPO="https://github.com/MuhammadDanishMalik/crsp-website.git"
APP=/opt/crsp
ENVFILE=/etc/crsp.env

[ "$(id -u)" = 0 ] || { echo "Run this as root."; exit 1; }
export DEBIAN_FRONTEND=noninteractive

ask() { # ask "prompt" VAR [silent]
  local v
  if [ "${3:-}" = silent ]; then read -rsp "$1: " v </dev/tty; echo; else read -rp "$1: " v </dev/tty; fi
  printf -v "$2" '%s' "$v"
}
esc() { printf '%s' "$1" | sed -e 's/\\/\\\\/g' -e 's/"/\\"/g'; } # for systemd EnvironmentFile values

echo "== 1/7 Settings =="
if [ -f "$ENVFILE" ]; then
  echo "Found $ENVFILE: keeping the existing settings."
else
  ask "Supabase POSTGRES_URL (Transaction pooler, starts with postgresql://)" POSTGRES_URL silent
  case "$POSTGRES_URL" in postgres://*|postgresql://*) ;; *) echo "That does not look like a Postgres URL."; exit 1;; esac
  case "$POSTGRES_URL" in *"[YOUR-PASSWORD]"*|*PASTE_*) echo "The URL still has a placeholder in it."; exit 1;; esac
  echo "(saved, ${#POSTGRES_URL} characters)"
  ask "Admin e-mail" ADMIN_EMAIL
  ask "Admin password" ADMIN_PASSWORD silent
  umask 077
  {
    printf 'POSTGRES_URL="%s"\n' "$(esc "$POSTGRES_URL")"
    printf 'ADMIN_EMAIL="%s"\n' "$(esc "$ADMIN_EMAIL")"
    printf 'ADMIN_PASSWORD="%s"\n' "$(esc "$ADMIN_PASSWORD")"
    printf 'SESSION_SECRET="%s"\n' "$(openssl rand -hex 32)"
  } > "$ENVFILE"
  chmod 600 "$ENVFILE"
fi
ask "Domain(s) for the site, space separated (e.g. www.crspofficial.com), or press Enter to use the IP only" DOMAINS || true

echo "== 2/7 System packages =="
apt-get update -y
apt-get install -y curl git nginx ufw ca-certificates gnupg openssl build-essential certbot python3-certbot-nginx

echo "== 3/7 Node.js 22 =="
if ! command -v node >/dev/null || [ "$(node -p 'process.versions.node.split(".")[0]')" -lt 20 ]; then
  curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
  apt-get install -y nodejs
fi
node -v

echo "== 4/7 Code =="
id crsp >/dev/null 2>&1 || useradd --system --create-home --shell /usr/sbin/nologin crsp
git config --global --add safe.directory "$APP"
if [ -d "$APP/.git" ]; then git -C "$APP" pull --ff-only; else git clone "$REPO" "$APP"; fi
chown -R crsp:crsp "$APP"
chmod +x "$APP/deploy/update.sh"

echo "== 5/7 Build and service =="
cat > /etc/systemd/system/crsp.service <<'UNIT'
[Unit]
Description=CRSP POS and website
After=network-online.target
Wants=network-online.target

[Service]
User=crsp
WorkingDirectory=/opt/crsp
EnvironmentFile=/etc/crsp.env
EnvironmentFile=-/etc/crsp.version.env
Environment=NODE_ENV=production
ExecStart=/usr/bin/node node_modules/next/dist/bin/next start -p 3000 -H 127.0.0.1
Restart=always
RestartSec=3

[Install]
WantedBy=multi-user.target
UNIT
systemctl daemon-reload
systemctl enable crsp >/dev/null
bash "$APP/deploy/update.sh"

echo "== 6/7 Web server (nginx) =="
NAMES="_"
[ -n "${DOMAINS:-}" ] && NAMES="$DOMAINS"
cat > /etc/nginx/sites-available/crsp <<NGINX
server {
    listen 80 default_server;
    listen [::]:80 default_server;
    server_name $NAMES;
    client_max_body_size 20m;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_buffering off;          # live kitchen / website-order alerts (server-sent events)
        proxy_read_timeout 3600s;
    }
}
NGINX
ln -sf /etc/nginx/sites-available/crsp /etc/nginx/sites-enabled/crsp
rm -f /etc/nginx/sites-enabled/default
nginx -t
systemctl reload nginx

echo "== 7/7 Firewall and HTTPS =="
ufw allow OpenSSH >/dev/null
ufw allow 'Nginx Full' >/dev/null
ufw --force enable >/dev/null

if [ -n "${DOMAINS:-}" ]; then
  read -rp "Is the DNS of these domains already pointing to this server's IP? (y/N) " yn </dev/tty
  if [ "$yn" = y ] || [ "$yn" = Y ]; then
    ask "E-mail for the HTTPS certificate" CERTMAIL
    args=(); for d in $DOMAINS; do args+=(-d "$d"); done
    certbot --nginx "${args[@]}" --non-interactive --agree-tos -m "$CERTMAIL" --redirect
  else
    echo "Point the DNS first, then run:  certbot --nginx -d <domain> --agree-tos --redirect"
  fi
fi

IP=$(curl -fsS https://api.ipify.org || echo "<server-ip>")
echo
echo "Done. Check:  curl -s http://127.0.0.1:3000/api/health     (should say \"mode\":\"postgres\")"
echo "Open:         http://$IP/   ${DOMAINS:+and https://${DOMAINS%% *}/}"
echo "Update later: bash $APP/deploy/update.sh"
