#!/bin/sh
# Restore the Artuch Postgres database from a gzipped pg_dump created by the
# db-backup sidecar.
#
#   ./scripts/restore-db.sh backups/artuch-2026-06-13.sql.gz
#
# DESTRUCTIVE: drops and recreates the current schema. Stop the backend first
# so nothing writes mid-restore:  docker compose stop backend
set -eu

FILE="${1:?usage: restore-db.sh <backups/artuch-YYYY-MM-DD.sql.gz>}"
[ -f "$FILE" ] || { echo "No such file: $FILE" >&2; exit 1; }

# Read DB settings from .env next to docker-compose.yml (same contract).
if [ -f .env ]; then
  # shellcheck disable=SC1091
  . ./.env
fi
DB_USER="${POSTGRES_USER:-artuch}"
DB_NAME="${POSTGRES_DB:-artuch}"

echo "Restoring $FILE into database '$DB_NAME' (user $DB_USER)..."
echo "This DROPS the current schema. Ctrl+C within 5s to abort."
sleep 5

gunzip -c "$FILE" | docker compose exec -T postgres \
  psql -U "$DB_USER" -d "$DB_NAME" -v ON_ERROR_STOP=1 \
  -c 'DROP SCHEMA public CASCADE; CREATE SCHEMA public;' -f -

echo "Done. Start the backend again:  docker compose start backend"
