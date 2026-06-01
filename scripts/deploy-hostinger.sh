#!/bin/bash
# Deploy na VPS Hostinger — rode via SSH como root ou usuário com PM2.
# Uso: bash scripts/deploy-hostinger.sh

set -e

echo "=== Mi Casa, Su Casa — deploy ==="

# Descobre a pasta onde o PM2 roda o app
APP_DIR=""
if command -v pm2 >/dev/null 2>&1; then
  APP_DIR=$(pm2 describe mi-casa 2>/dev/null | awk -F'│' '/exec cwd/ { gsub(/ /, "", $2); print $2; exit }')
fi

if [ -z "$APP_DIR" ] || [ ! -f "$APP_DIR/package.json" ]; then
  echo ""
  echo "Não encontrei a pasta do projeto automaticamente."
  echo "Tente manualmente (ajuste o caminho):"
  echo "  cd /var/www/mi-casa"
  echo "  cd /root/mi-casa"
  echo ""
  for TRY in /var/www/mi-casa /root/mi-casa /home/*/mi-casa; do
    if [ -f "$TRY/package.json" ] && [ -f "$TRY/server.js" ]; then
      APP_DIR="$TRY"
      break
    fi
  done
fi

if [ -z "$APP_DIR" ] || [ ! -f "$APP_DIR/package.json" ]; then
  echo "ERRO: pasta do projeto não encontrada. Rode: find / -name server.js -path '*/mi-casa/*' 2>/dev/null"
  exit 1
fi

echo "Pasta do projeto: $APP_DIR"
cd "$APP_DIR"

echo ""
echo "--- git pull ---"
git pull origin main

echo ""
echo "--- npm ci ---"
npm ci --omit=dev

echo ""
echo "--- pm2 reload ---"
pm2 reload mi-casa

echo ""
echo "--- versão no servidor ---"
git log -1 --oneline
echo ""
echo "Deploy concluído."
echo "Confira no browser: https://miicasasucasa.com.br/api/version"
echo "No celular: feche todas as abas ou use aba anônima antes de testar."
