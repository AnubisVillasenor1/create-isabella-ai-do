#!/bin/bash
# ISABELLA GENESIS ZERO-OPEX v3 - Database Migration Runner
# Applies schema migrations with version tracking and rollback support

set -euo pipefail

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
MIGRATIONS_DIR="${PROJECT_DIR}/migrations"
SCHEMA_FILE="${PROJECT_DIR}/scripts/schema.sql"
ENV_FILE="${PROJECT_DIR}/.env"

log_info() { echo -e "\033[0;34m[INFO]\033[0m $1"; }
log_success() { echo -e "\033[0;32m[SUCCESS]\033[0m $1"; }
log_warning() { echo -e "\033[1;33m[WARNING]\033[0m $1"; }
log_error() { echo -e "\033[0;31m[ERROR]\033[0m $1"; }

# Load environment
if [[ -f "$ENV_FILE" ]]; then
    source "$ENV_FILE"
fi

# Database connection parameters
DB_HOST="${POSTGRES_HOST:-postgres}"
DB_PORT="${POSTGRES_PORT:-5432}"
DB_USER="${POSTGRES_USER:-isabella_admin}"
DB_NAME="${POSTGRES_DB:-isabella_db}"
DB_PASSWORD="${POSTGRES_PASSWORD:-${DB_PASSWORD}}"

export PGPASSWORD="$DB_PASSWORD"

# Migration tracking table
MIGRATION_TABLE="schema_migrations"

# ============================================================================
# MIGRATION FUNCTIONS
# ============================================================================

ensure_migration_table() {
    log_info "Ensuring migration tracking table exists..."
    PGPASSWORD="$DB_PASSWORD" psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -c "
        CREATE TABLE IF NOT EXISTS $MIGRATION_TABLE (
            id BIGSERIAL PRIMARY KEY,
            version VARCHAR(255) NOT NULL UNIQUE,
            name VARCHAR(255) NOT NULL,
            checksum VARCHAR(64) NOT NULL,
            applied_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
            execution_time_ms BIGINT NOT NULL
        );
        CREATE INDEX IF NOT EXISTS idx_schema_migrations_version ON $MIGRATION_TABLE(version);
    " >/dev/null
    log_success "Migration table ready"
}

calculate_checksum() {
    local file="$1"
    sha256sum "$file" | awk '{print $1}'
}

get_applied_migrations() {
    PGPASSWORD="$DB_PASSWORD" psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -t -A -c "
        SELECT version FROM $MIGRATION_TABLE ORDER BY id;
    " 2>/dev/null || echo ""
}

run_migration() {
    local version="$1"
    local name="$2"
    local file="$3"

    local checksum=$(calculate_checksum "$file")
    local start_time=$(date +%s%3N)

    log_info "Applying migration: $version - $name"

    # Check if already applied
    local applied=$(PGPASSWORD="$DB_PASSWORD" psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -t -A -c "
        SELECT 1 FROM $MIGRATION_TABLE WHERE version = '$version';
    " 2>/dev/null || echo "")

    if [[ -n "$applied" ]]; then
        local existing_checksum=$(PGPASSWORD="$DB_PASSWORD" psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -t -A -c "
            SELECT checksum FROM $MIGRATION_TABLE WHERE version = '$version';
        " 2>/dev/null)

        if [[ "$existing_checksum" != "$checksum" ]]; then
            log_error "Checksum mismatch for migration $version! Expected $existing_checksum, got $checksum"
            return 1
        fi
        log_warning "Migration $version already applied, skipping"
        return 0
    fi

    # Execute migration
    local output
    local start=$(date +%s%3N)
    if output=$(PGPASSWORD="$DB_PASSWORD" psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -v ON_ERROR_STOP=1 -f "$file" 2>&1); then
        local end=$(date +%s%3N)
        local exec_time=$((end - start))

        # Record migration
        PGPASSWORD="$DB_PASSWORD" psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -c "
            INSERT INTO $MIGRATION_TABLE (version, name, checksum, execution_time_ms)
            VALUES ('$version', '$name', '$checksum', $exec_time);
        " >/dev/null

        log_success "Applied $version (${exec_time}ms)"
        return 0
    else
        log_error "Migration $version failed:"
        echo "$output"
        return 1
    fi
}

# ============================================================================
# MIGRATION COMMANDS
# ============================================================================

cmd_migrate() {
    log_info "Running database migrations..."

    ensure_migration_table

    # Core schema (always first)
    if [[ -f "$SCHEMA_FILE" ]]; then
        run_migration "000" "initial_schema" "$SCHEMA_FILE" || return 1
    fi

    # Additional migrations from migrations directory
    if [[ -d "$MIGRATIONS_DIR" ]]; then
        for file in "$MIGRATIONS_DIR"/*.sql; do
            [[ -f "$file" ]] || continue
            local filename=$(basename "$file")
            local version=$(echo "$filename" | sed -E 's/^([0-9]+)_.*\.sql$/\1/')
            local name=$(echo "$filename" | sed -E 's/^[0-9]+_(.*)\.sql$/\1/')

            run_migration "$version" "$name" "$file" || return 1
        done
    fi

    log_success "All migrations completed"
}

cmd_status() {
    ensure_migration_table

    log_info "Migration status:"
    PGPASSWORD="$DB_PASSWORD" psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -c "
        SELECT
            version,
            name,
            to_char(applied_at, 'YYYY-MM-DD HH24:MI:SS') as applied_at,
            execution_time_ms || ' ms' as execution_time,
            checksum
        FROM $MIGRATION_TABLE
        ORDER BY id;
    "
}

cmd_rollback() {
    local target_version="${1:-}"
    if [[ -z "$target_version" ]]; then
        log_error "Usage: $0 rollback <target_version>"
        return 1
    fi

    log_warning "Rolling back to version $target_version"
    log_warning "This will DELETE data! Ensure you have a backup."
    read -p "Type 'YES' to confirm: " confirm
    [[ "$confirm" == "YES" ]] || { log_error "Aborted"; return 1; }

    local to_remove=$(PGPASSWORD="$DB_PASSWORD" psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -t -A -c "
        SELECT version FROM $MIGRATION_TABLE WHERE version > '$target_version' ORDER BY id DESC;
    ")

    for version in $to_remove; do
        log_warning "Rolling back migration: $version"
        # Note: Actual rollback requires manual SQL or down migrations
        # This just removes the tracking record
        PGPASSWORD="$DB_PASSWORD" psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -c "
            DELETE FROM $MIGRATION_TABLE WHERE version = '$version';
        " >/dev/null
        log_warning "Removed tracking for $version (manual SQL rollback needed)"
    done

    log_warning "Rollback tracking complete. Manual SQL rollback required for data changes."
}

cmd_validate() {
    ensure_migration_table

    log_info "Validating migration integrity..."

    local failed=0
    local checked=0

    # Check initial schema
    if [[ -f "$SCHEMA_FILE" ]]; then
        local checksum=$(sha256sum "$SCHEMA_FILE" | awk '{print $1}')
        local db_checksum=$(PGPASSWORD="$DB_PASSWORD" psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -t -A -c "
            SELECT checksum FROM $MIGRATION_TABLE WHERE version = '000';
        " 2>/dev/null || echo "")

        if [[ "$checksum" != "$db_checksum" ]]; then
            log_error "Initial schema checksum mismatch!"
            ((failed++))
        else
            log_success "Initial schema checksum OK"
        fi
        ((checked++))
    fi

    # Check migration files
    if [[ -d "$MIGRATIONS_DIR" ]]; then
        for file in "$MIGRATIONS_DIR"/*.sql; do
            [[ -f "$file" ]] || continue
            local filename=$(basename "$file")
            local version=$(echo "$filename" | sed -E 's/^([0-9]+)_.*\.sql$/\1/')
            local checksum=$(sha256sum "$file" | awk '{print $1}')
            local db_checksum=$(PGPASSWORD="$DB_PASSWORD" psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -t -A -c "
                SELECT checksum FROM $MIGRATION_TABLE WHERE version = '$version';
            " 2>/dev/null || echo "")

            if [[ "$checksum" != "$db_checksum" ]]; then
                log_error "Checksum mismatch for $version"
                ((failed++))
            else
                log_success "Migration $version checksum OK"
            fi
            ((checked++))
        done
    fi

    if [[ $failed -eq 0 ]]; then
        log_success "All $checked migrations validated"
        return 0
    else
        log_error "$failed of $checked migrations failed validation"
        return 1
    fi
}

cmd_init() {
    log_info "Initializing migration tracking..."
    ensure_migration_table
    log_success "Migration tracking initialized"
}

# ============================================================================
# MAIN
# ============================================================================

main() {
    cd "$(dirname "${BASH_SOURCE[0]}")/.."

    case "${1:-migrate}" in
        migrate)
            cmd_migrate
            ;;
        status)
            cmd_status
            ;;
        rollback)
            cmd_rollback "${2:-}"
            ;;
        validate)
            cmd_validate
            ;;
        init)
            cmd_init
            ;;
        *)
            echo "Usage: $0 {migrate|status|rollback <version>|validate|init}"
            exit 1
            ;;
    esac
}

main "$@"