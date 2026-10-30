#!/usr/bin/env bash
# Prints what is needed to find out why a page is slow or hangs. Safe: it changes nothing. Run as root.
echo "== service =="; systemctl is-active crsp
echo "== home page, 3 tries (12 s limit each) =="
for i in 1 2 3; do curl -s -m 12 -o /dev/null -w "%{http_code} %{time_total}s\n" http://127.0.0.1:3000/ || true; done
echo "== DNS of the database host =="
getent ahosts aws-0-ap-northeast-1.pooler.supabase.com | head -6
echo "== IPv6 reachable? =="
curl -6 -s -m 6 -o /dev/null -w "ipv6 %{http_code}\n" https://api64.ipify.org || echo "no working IPv6"
echo "== last log lines =="
journalctl -u crsp -n 40 --no-pager | cut -c1-220
