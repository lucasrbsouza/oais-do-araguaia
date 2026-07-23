#!/usr/bin/env bash
#
# Backup do Oásis do Araguaia: dump do Postgres + tarball dos uploads.
# Feito para rodar via cron na VPS. Exemplo (03:10 todo dia):
#
#   10 3 * * * /opt/oais-do-araguaia/scripts/backup.sh >> /var/log/oais-backup.log 2>&1
#
# Variáveis opcionais: PROJECT_DIR, BACKUP_DIR, RETENTION_DAYS.

set -euo pipefail

PROJECT_DIR="${PROJECT_DIR:-/opt/oais-do-araguaia}"
BACKUP_DIR="${BACKUP_DIR:-/var/backups/oais}"
RETENTION_DAYS="${RETENTION_DAYS:-14}"

cd "$PROJECT_DIR"
COMPOSE=(docker compose -f docker-compose.prod.yml)

# Lê só o que precisa do .env, em vez de dar source nos segredos todos.
POSTGRES_USER="$(grep -E '^POSTGRES_USER=' .env | cut -d= -f2-)"
POSTGRES_DB="$(grep -E '^POSTGRES_DB=' .env | cut -d= -f2-)"

if [[ -z "$POSTGRES_USER" || -z "$POSTGRES_DB" ]]; then
  echo "ERRO: POSTGRES_USER ou POSTGRES_DB não encontrados em $PROJECT_DIR/.env" >&2
  exit 1
fi

STAMP="$(date +%Y-%m-%d_%H%M%S)"
mkdir -p "$BACKUP_DIR"
umask 077

DB_FILE="$BACKUP_DIR/db_$STAMP.dump"
UP_FILE="$BACKUP_DIR/uploads_$STAMP.tar.gz"

echo "[$(date -Is)] iniciando backup"

# ── Banco ─────────────────────────────────────────────────────────
# Dump para um arquivo DENTRO do container. O formato custom (-Fc) é
# comprimido e restaurável seletivamente, mas o `pg_restore -l` que valida
# precisa fazer seek — não funciona num pipe. Por isso geramos, validamos e
# só então copiamos para o host.
CONTAINER_DUMP="/tmp/oais_db_$STAMP.dump"

"${COMPOSE[@]}" exec -T postgres \
  pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" -Fc -f "$CONTAINER_DUMP"

# Dump truncado passa despercebido por meses. Confere antes de confiar.
if ! "${COMPOSE[@]}" exec -T postgres pg_restore -l "$CONTAINER_DUMP" > /dev/null 2>&1; then
  echo "ERRO: dump ilegível, backup abortado." >&2
  "${COMPOSE[@]}" exec -T postgres rm -f "$CONTAINER_DUMP" 2>/dev/null || true
  exit 1
fi

"${COMPOSE[@]}" cp "postgres:$CONTAINER_DUMP" "$DB_FILE"
"${COMPOSE[@]}" exec -T postgres rm -f "$CONTAINER_DUMP"
chmod 600 "$DB_FILE"

# ── Uploads (comprovantes, avatares) ──────────────────────────────
"${COMPOSE[@]}" exec -T backend tar -czf - -C /app uploads > "$UP_FILE"

if [[ ! -s "$UP_FILE" ]]; then
  echo "ERRO: tarball de uploads vazio: $UP_FILE" >&2
  exit 1
fi

echo "[$(date -Is)] ok: $(du -h "$DB_FILE" | cut -f1) db, $(du -h "$UP_FILE" | cut -f1) uploads"

# ── Retenção ──────────────────────────────────────────────────────
find "$BACKUP_DIR" -name 'db_*.dump'        -mtime "+$RETENTION_DAYS" -delete
find "$BACKUP_DIR" -name 'uploads_*.tar.gz' -mtime "+$RETENTION_DAYS" -delete

# ── Cópia fora da VPS ─────────────────────────────────────────────
# Backup que só existe na própria máquina não é backup: se a VPS morrer, morre
# junto. Se RCLONE_REMOTE estiver definido no .env (ex.: gdrive:oais-backups),
# envia os dois arquivos do dia e poda no destino o que passou da retenção.
# Sem a variável, este bloco é ignorado e o backup fica só local.
RCLONE_REMOTE="$(grep -E '^RCLONE_REMOTE=' "$ENV_FILE" | cut -d= -f2- || true)"

if [[ -n "$RCLONE_REMOTE" ]] && command -v rclone > /dev/null; then
  if rclone copy "$DB_FILE" "$RCLONE_REMOTE/" && rclone copy "$UP_FILE" "$RCLONE_REMOTE/"; then
    rclone delete "$RCLONE_REMOTE" --min-age "${RETENTION_DAYS}d" 2>/dev/null || true
    echo "  enviado para $RCLONE_REMOTE"
  else
    # Falha no envio não invalida o backup local, mas precisa gritar no log.
    echo "AVISO: cópia off-site para $RCLONE_REMOTE falhou — backup existe só na VPS." >&2
  fi
elif [[ -n "$RCLONE_REMOTE" ]]; then
  echo "AVISO: RCLONE_REMOTE definido mas rclone não está instalado." >&2
fi
