#!/usr/bin/env bash
# Container entrypoint: applies pending migrations (fail closed) and then starts the runtime.
#
# Environment:
#   RUN_MIGRATIONS=0        skip migrations entirely (operator applies them out-of-band)
#   MIGRATIONS_OPTIONAL=1   do not abort when the database is unreachable
#   DB_WAIT_ATTEMPTS        attempts before giving up (default 60, 2s apart)
#
# The application itself never runs migrations, so this script is the single place where
# schema state is advanced inside the image.
set -euo pipefail

log() { echo "[entrypoint] $*"; }

db_url="${DATABASE_URL:-${POSTGRES_URL:-}}"

if [[ "${RUN_MIGRATIONS:-1}" == "1" && -n "$db_url" ]]; then
  attempts="${DB_WAIT_ATTEMPTS:-60}"
  i=0
  log "waiting for PostgreSQL..."
  until psql "$db_url" -v ON_ERROR_STOP=1 -tAc 'select 1' >/dev/null 2>&1; do
    i=$((i + 1))
    if (( i >= attempts )); then
      if [[ "${MIGRATIONS_OPTIONAL:-0}" == "1" ]]; then
        log "database unreachable after ${attempts} attempts; continuing (MIGRATIONS_OPTIONAL=1)"
        break
      fi
      log "database unreachable after ${attempts} attempts; aborting"
      exit 1
    fi
    sleep 2
  done

  log "applying migrations..."
  bash scripts/migrate.sh migrate
else
  log "migrations skipped (RUN_MIGRATIONS=${RUN_MIGRATIONS:-1}, database configured=${db_url:+yes})"
fi

log "starting runtime..."
exec node dist/server.js
