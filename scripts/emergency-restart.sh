#!/bin/bash
# Restaura site após 502 — rode na VPS: bash scripts/emergency-restart.sh
set -e
cd "$(dirname "$0")/.."
echo "=== Restaurando Mi Casa, Su Casa ==="
git pull origin main
node scripts/apply-admin-env.js
pm2 delete mi-casa 2>/dev/null || true
pm2 start ecosystem.config.cjs --update-env
pm2 save
sleep 2
curl -sf http://127.0.0.1:3014/api/version && echo "" || echo "AVISO: app ainda não responde na 3014"
node scripts/verify-admin-login.js micasasucasaben@gmail.com || true
echo "=== Concluído ==="
