#!/bin/zsh
# Backup semanal do Camisa XX: banco (D1, arquivo .sql) + todas as fotos (KV).
# Vai pro iCloud Drive (Backups/Camisa XX), que sincroniza sozinho.
# Instalado em ~/.camisa-xx/backup.sh e agendado pelo LaunchAgent com.camisaxx.backup (segunda 9h).
set -euo pipefail
export PATH="/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin"
CONTA="e7a2998cb45d15c2fc3f97fbd699ce50"
KV="bc30ef75f6b4467eb4aeb189d0c03d40"
DEST="$HOME/Library/Mobile Documents/com~apple~CloudDocs/Backups/Camisa XX"
DIA=$(date +%Y-%m-%d)
mkdir -p "$DEST/banco" "$DEST/fotos"
LOG="$DEST/backup.log"
{
  echo "== $(date '+%d/%m/%Y %H:%M') =="
  cd "$DEST"
  # 1) banco inteiro (também renova o login do wrangler)
  npx -y wrangler@4 d1 export camisa-xx --remote --output "banco/camisa-xx-$DIA.sql" >/dev/null 2>&1
  echo "banco: banco/camisa-xx-$DIA.sql ($(du -h "banco/camisa-xx-$DIA.sql" | cut -f1))"
  # 2) fotos novas (incremental: só baixa o que ainda não está aqui)
  TOKEN=$(sed -n 's/^oauth_token = "\(.*\)"/\1/p' "$HOME/Library/Preferences/.wrangler/config/default.toml")
  python3 - "$TOKEN" "$CONTA" "$KV" "$DEST/fotos" <<'PY'
import json, os, sys, urllib.request, urllib.parse
token, conta, kv, pasta = sys.argv[1:]
base = f"https://api.cloudflare.com/client/v4/accounts/{conta}/storage/kv/namespaces/{kv}"
def get(url, raw=False):
    req = urllib.request.Request(url, headers={"Authorization": f"Bearer {token}"})
    with urllib.request.urlopen(req, timeout=120) as r:
        return r.read() if raw else json.load(r)
chaves, cursor = [], ""
while True:
    d = get(f"{base}/keys?limit=1000" + (f"&cursor={cursor}" if cursor else ""))
    chaves += [k["name"] for k in d["result"]]
    cursor = d.get("result_info", {}).get("cursor") or ""
    if not cursor: break
novas = 0
for k in chaves:
    arq = os.path.join(pasta, k.replace(":", "_") + ".jpg")
    if os.path.exists(arq): continue
    open(arq, "wb").write(get(f"{base}/values/{urllib.parse.quote(k, safe='')}", raw=True))
    novas += 1
print(f"fotos: {len(chaves)} no total, {novas} novas")
PY
  # 3) guarda só os 12 últimos arquivos do banco
  ls -1t banco/*.sql | tail -n +13 | while read -r f; do rm -f "$f"; done
  echo "ok"
} >> "$LOG" 2>&1 || { echo "FALHOU $(date)" >> "$LOG"; osascript -e 'display notification "O backup semanal do Camisa XX falhou. Veja o backup.log." with title "Camisa XX"' || true; exit 1; }
