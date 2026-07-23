#!/usr/bin/env bash
#
# Sincroniza as faixas de IP da Cloudflare em dois lugares:
#   1. ufw  — só a Cloudflare alcança as portas 80/443 da VPS
#   2. .env — CLOUDFLARE_IPS, que o Traefik usa em forwardedHeaders.trustedIPs
#
# A Cloudflare muda essas faixas de vez em quando. Rode no setup e mensalmente:
#
#   0 4 1 * * /opt/oais-do-araguaia/scripts/cloudflare-ips.sh >> /var/log/oais-cfips.log 2>&1
#
# Precisa de root (mexe no ufw). Variáveis opcionais: ENV_FILE, PROJECT_DIR.

set -euo pipefail

PROJECT_DIR="${PROJECT_DIR:-/opt/oais-do-araguaia}"
ENV_FILE="${ENV_FILE:-$PROJECT_DIR/.env}"
UFW_TAG="cloudflare-oais"

if [[ $EUID -ne 0 ]]; then
  echo "ERRO: precisa de root (ufw). Use sudo." >&2
  exit 1
fi

[[ -f "$ENV_FILE" ]] || { echo "ERRO: $ENV_FILE não existe" >&2; exit 1; }

# ── Busca as faixas ───────────────────────────────────────────────
echo "[$(date -Is)] buscando faixas da Cloudflare"
V4="$(curl -fsS --max-time 20 https://www.cloudflare.com/ips-v4 || true)"
V6="$(curl -fsS --max-time 20 https://www.cloudflare.com/ips-v6 || true)"

ALL="$(printf '%s\n%s\n' "$V4" "$V6" | grep -E '^[0-9a-fA-F:.]+/[0-9]{1,3}$' || true)"
COUNT="$(printf '%s\n' "$ALL" | grep -c . || true)"

# Sanidade ANTES de tocar no firewall. Se a busca falhar e as regras forem
# apagadas mesmo assim, o site fica inalcançável até alguém entrar pelo console.
if [[ "$COUNT" -lt 10 ]]; then
  echo "ERRO: só $COUNT faixas válidas retornadas — abortando sem mexer no ufw." >&2
  exit 1
fi
echo "  $COUNT faixas obtidas"

# ── ufw ───────────────────────────────────────────────────────────
# Remove as regras antigas pela marca; sempre apaga a primeira que casa e
# re-escaneia, porque deletar renumera a lista.
while :; do
  num="$(ufw status numbered | grep -m1 "$UFW_TAG" | sed -n 's/^\[[[:space:]]*\([0-9]\+\)\].*/\1/p')"
  [[ -z "$num" ]] && break
  ufw --force delete "$num" > /dev/null
done

while read -r cidr; do
  [[ -z "$cidr" ]] && continue
  ufw allow proto tcp from "$cidr" to any port 80,443 comment "$UFW_TAG" > /dev/null
done <<< "$ALL"

echo "  ufw atualizado ($COUNT regras marcadas '$UFW_TAG')"

# ── .env ──────────────────────────────────────────────────────────
JOINED="$(printf '%s\n' "$ALL" | paste -sd,)"
OWNER="$(stat -c '%u:%g' "$ENV_FILE")"
MODE="$(stat -c '%a' "$ENV_FILE")"

cp -p "$ENV_FILE" "$ENV_FILE.bak"

if grep -q '^CLOUDFLARE_IPS=' "$ENV_FILE"; then
  # Delimitador | porque as faixas contêm / e :
  sed -i "s|^CLOUDFLARE_IPS=.*|CLOUDFLARE_IPS=$JOINED|" "$ENV_FILE"
else
  printf '\nCLOUDFLARE_IPS=%s\n' "$JOINED" >> "$ENV_FILE"
fi

chown "$OWNER" "$ENV_FILE" "$ENV_FILE.bak"
chmod "$MODE" "$ENV_FILE" "$ENV_FILE.bak"

if cmp -s "$ENV_FILE" "$ENV_FILE.bak"; then
  echo "  .env inalterado — nada a reiniciar"
  exit 0
fi

echo "  .env atualizado (backup em $ENV_FILE.bak)"
echo
echo "As faixas mudaram. Aplique no Traefik:"
echo "  cd $PROJECT_DIR && docker compose -f docker-compose.prod.yml up -d traefik"
