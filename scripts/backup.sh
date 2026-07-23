#!/usr/bin/env bash
#
# Backup do Oaís do Araguaia: dump do Postgres + tarball dos uploads.
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
# Formato custom (-Fc): comprimido e restaurável seletivamente.
"${COMPOSE[@]}" exec -T postgres \
  pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" -Fc > "$DB_FILE"

# Dump truncado passa despercebido por meses. Confere antes de confiar.
if ! pg_restore -l "$DB_FILE" > /dev/null 2>&1; then
  if ! "${COMPOSE[@]}" exec -T postgres pg_restore -l /dev/stdin < "$DB_FILE" > /dev/null 2>&1; then
    echo "ERRO: dump ilegível, backup abortado: $DB_FILE" >&2
    rm -f "$DB_FILE"
    exit 1
  fi
fi

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
# Backup que só existe na própria máquina não é backup: se a VPS morrer,
# morre junto. Configure um destino externo e descomente:
#
#   rclone copy "$BACKUP_DIR" remoto:oais-backups --max-age 25h
#
# ou, para outro servidor:
#
#   scp "$DB_FILE" "$UP_FILE" usuario@destino:/caminho/backups/
