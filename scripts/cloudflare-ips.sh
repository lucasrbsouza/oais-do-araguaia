#!/usr/bin/env bash
#
# Restringe as portas 80/443 da VPS às faixas da Cloudflare e mantém o
# CLOUDFLARE_IPS do .env em dia. Faz três coisas:
#
#   1. iptables/ip6tables (cadeia DOCKER-USER) — só a Cloudflare alcança 80/443.
#      É AQUI que a origem fica escondida: o Docker publica as portas escrevendo
#      iptables direto e passa por cima do ufw, então filtrar no ufw não adianta.
#      A cadeia DOCKER-USER é avaliada pelo Docker antes das regras dele.
#   2. .env — CLOUDFLARE_IPS, que o Traefik usa em forwardedHeaders.trustedIPs.
#   3. Limpa regras antigas do ufw (tag cloudflare-oais) que não protegiam nada.
#
# A Cloudflare muda essas faixas de vez em quando. Rode no setup, a cada boot
# (via systemd, ver DEPLOY.md) e mensalmente:
#
#   0 4 1 * * /opt/oais-do-araguaia/scripts/cloudflare-ips.sh >> /var/log/oais-cfips.log 2>&1
#
# Precisa de root. Variáveis opcionais: ENV_FILE, PROJECT_DIR, DRY_RUN=1.

set -euo pipefail

PROJECT_DIR="${PROJECT_DIR:-/opt/oais-do-araguaia}"
ENV_FILE="${ENV_FILE:-$PROJECT_DIR/.env}"
CHAIN="CF_FILTER"          # sub-cadeia própria: atualizar = esvaziar e repovoar
UFW_TAG="cloudflare-oais"
DRY_RUN="${DRY_RUN:-0}"

if [[ $EUID -ne 0 && "$DRY_RUN" != "1" ]]; then
  echo "ERRO: precisa de root (iptables). Use sudo." >&2
  exit 1
fi

[[ -f "$ENV_FILE" ]] || { echo "ERRO: $ENV_FILE não existe" >&2; exit 1; }

# Em dry-run, ipt() só imprime; senão executa.
ipt() { if [[ "$DRY_RUN" == "1" ]]; then echo "  + $*"; else "$@"; fi; }

# ── Busca as faixas ───────────────────────────────────────────────
echo "[$(date -Is)] buscando faixas da Cloudflare"
V4="$(curl -fsS --max-time 20 https://www.cloudflare.com/ips-v4 || true)"
V6="$(curl -fsS --max-time 20 https://www.cloudflare.com/ips-v6 || true)"

V4="$(printf '%s\n' "$V4" | grep -E '^[0-9.]+/[0-9]{1,2}$' || true)"
V6="$(printf '%s\n' "$V6" | grep -E '^[0-9a-fA-F:]+/[0-9]{1,3}$' || true)"
N4="$(printf '%s\n' "$V4" | grep -c . || true)"
N6="$(printf '%s\n' "$V6" | grep -c . || true)"

# Sanidade ANTES de tocar no firewall. Se a busca falhar e a gente apagar as
# regras mesmo assim, a origem fica aberta para todos ou o site inalcançável.
if [[ "$N4" -lt 5 || "$N6" -lt 3 ]]; then
  echo "ERRO: faixas insuficientes (v4=$N4 v6=$N6) — abortando sem mexer no firewall." >&2
  exit 1
fi
echo "  $N4 faixas v4, $N6 faixas v6"

# ── Programa uma família (iptables ou ip6tables) ──────────────────
programar_familia() {
  local cmd="$1" internal="$2" cidrs="$3"

  # Garante a sub-cadeia (ignora erro se já existe) e a esvazia.
  ipt "$cmd" -N "$CHAIN" 2>/dev/null || true
  ipt "$cmd" -F "$CHAIN"

  # Garante um único salto DOCKER-USER → CF_FILTER, no topo.
  if [[ "$DRY_RUN" == "1" ]] || ! "$cmd" -C DOCKER-USER -j "$CHAIN" 2>/dev/null; then
    ipt "$cmd" -I DOCKER-USER -j "$CHAIN"
  fi

  # Respostas de conexões já aceitas passam direto.
  ipt "$cmd" -A "$CHAIN" -p tcp -m multiport --dports 80,443 \
    -m conntrack --ctstate RELATED,ESTABLISHED -j RETURN
  # Tráfego entre containers (rede interna do Docker) passa.
  ipt "$cmd" -A "$CHAIN" -s "$internal" -p tcp -m multiport --dports 80,443 -j RETURN
  # Cada faixa da Cloudflare passa.
  while read -r cidr; do
    [[ -z "$cidr" ]] && continue
    ipt "$cmd" -A "$CHAIN" -s "$cidr" -p tcp -m multiport --dports 80,443 -j RETURN
  done <<< "$cidrs"
  # Qualquer outro na 80/443 morre aqui. Demais portas não casam e seguem.
  ipt "$cmd" -A "$CHAIN" -p tcp -m multiport --dports 80,443 -j DROP
}

echo "  aplicando DOCKER-USER (IPv4)"
programar_familia iptables  "172.16.0.0/12" "$V4"
echo "  aplicando DOCKER-USER (IPv6)"
programar_familia ip6tables "fc00::/7"      "$V6"

# ── Limpa regras órfãs do ufw (não protegiam as portas publicadas) ─
if [[ "$DRY_RUN" != "1" ]] && command -v ufw >/dev/null; then
  removidas=0
  while (( removidas < 200 )); do
    num="$(ufw status numbered | grep -m1 "$UFW_TAG" | sed -n 's/^\[[[:space:]]*\([0-9]\+\)\].*/\1/p' || true)"
    [[ -z "$num" ]] && break
    ufw --force delete "$num" > /dev/null
    removidas=$(( removidas + 1 ))
  done
  (( removidas > 0 )) && echo "  removidas $removidas regras ufw órfãs ('$UFW_TAG')"
fi

# ── .env: CLOUDFLARE_IPS para o Traefik ───────────────────────────
JOINED="$(printf '%s\n%s\n' "$V4" "$V6" | grep . | paste -sd,)"
OWNER="$(stat -c '%u:%g' "$ENV_FILE")"
MODE="$(stat -c '%a' "$ENV_FILE")"

cp -p "$ENV_FILE" "$ENV_FILE.bak"
if grep -q '^CLOUDFLARE_IPS=' "$ENV_FILE"; then
  sed -i "s|^CLOUDFLARE_IPS=.*|CLOUDFLARE_IPS=$JOINED|" "$ENV_FILE"
else
  printf '\nCLOUDFLARE_IPS=%s\n' "$JOINED" >> "$ENV_FILE"
fi
chown "$OWNER" "$ENV_FILE" "$ENV_FILE.bak"
chmod "$MODE" "$ENV_FILE" "$ENV_FILE.bak"

if cmp -s "$ENV_FILE" "$ENV_FILE.bak"; then
  rm -f "$ENV_FILE.bak"
  echo "  .env inalterado — firewall atualizado, nada a reiniciar"
  exit 0
fi

echo "  .env atualizado (backup em $ENV_FILE.bak)"
echo
echo "As faixas mudaram. Aplique no Traefik:"
echo "  cd $PROJECT_DIR && docker compose -f docker-compose.prod.yml up -d traefik"
