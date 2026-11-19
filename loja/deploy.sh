#!/bin/sh
# Publica a loja pública no Cloudflare Pages (projeto camisa-xx-loja). Uso: loja/deploy.sh
set -e
cd "$(dirname "$0")"
mkdir -p public/icons
cp ../icons/favicon-32.png ../icons/apple-touch-icon.png ../icons/marca-64.png ../icons/logo-560.jpg public/icons/
npx -y wrangler@4 pages deploy public --project-name camisa-xx-loja --branch main --commit-dirty=true
