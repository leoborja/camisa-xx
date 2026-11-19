#!/bin/sh
# Publica o site no Cloudflare Pages (projeto camisa-xx). Uso: ./deploy.sh
set -e
cd "$(dirname "$0")"
rm -rf dist && mkdir dist
cp -R index.html manifest.webmanifest css js icons dist/
npx -y wrangler@4 pages deploy dist --project-name camisa-xx --branch main --commit-dirty=true
