#!/usr/bin/env bash
# Prints what is needed to find out why a page is slow or hangs. Safe: it only restarts the app once. Run as root.
T() { curl -s -m 8 -o /dev/null -w "$1 -> %{http_code} %{time_total}s\n" "http://127.0.0.1:3000$2" || echo "$1 -> NO ANSWER in 8s"; }
echo "== restart =="; systemctl restart crsp; sleep 8
echo "== 1) first home request, then the rest =="
T "home #1" /
echo "== 2) right after: pages that do NOT use the database =="
T "version" /api/version
T "start" /start
echo "== 3) pages that DO use the database =="
T "health" /api/health
T "home #2" /
echo "== 4) database connections the app holds (port 6543) =="
ss -tn state established '( dport = :6543 )' | tail -n +2 | wc -l
echo "== 5) CPU of the app =="
top -b -n1 | head -12 | tail -6
echo "== 6) memory =="
free -m | head -2
echo "== 7) last log lines =="
journalctl -u crsp -n 25 --no-pager | cut -c1-200
