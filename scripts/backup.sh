#!/bin/bash
# ISABELLA GENESIS ZERO-OPEX v3 - Backup Script
# Creates consistent backups of PostgreSQL, configuration, and artifacts

set -euo pipefail

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Configuration
PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BACKUP_ROOT="${BACKUP_ROOT:-${PROJECT_DIR}/backups}"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_DIR="${BACKUP_ROOT}/${TIMESTAMP}"

# Database
DB_HOST="${POSTGRES_HOST:-postgres}"
DB_PORT="${POSTGRES_PORT:-5432}"
DB_USER="${POSTGRES_USER:-isabella_admin}"
DB_NAME="${POSTGRES_DB:-isabella_db}"
DB_PASSWORD="${POSTGRES_PASSWORD:-${DB_PASSWORD}}"

# Retention
RETENTION_DAYS="${BACKUP_RETENTION_DAYS:-30}"

log_info() { echo -e "\033[0;34m[INFO]\033[0m $1"; }
log_success() { echo -e "\033[0;32m[SUCCESS]\033[0m $1"; }
log_warning() { echo -e "\033[1;33m[WARNING]\033[0m $1"; }
log_error() { echo -e "\033[0;31m[ERROR]\033[0m $1"; }

export PGPASSWORD="${POSTGRES_PASSWORD:-${DB_PASSWORD}}"

mkdir -p "${BACKUP_DIR}"

# ============================================================================
# BACKUP FUNCTIONS
# ============================================================================

backup_postgres() {
    log_info "Backing up PostgreSQL database..."

    local dump_file="${BACKUP_DIR}/postgres_${TIMESTAMP}.sql.gz"

    if docker compose exec -T postgres pg_dump -U isabella_admin -d isabella_db | gzip > "${dump_file}"; then
        local size=$(du -h "${dump_file}" | cut -f1)
        log_success "PostgreSQL backup: ${dump_file} (${size})"
    else
        log_error "PostgreSQL backup failed"
        return 1
    fi
}

backup_config() {
    log_info "Backing up configuration files..."

    local config_backup="${BACKUP_DIR}/config_${TIMESTAMP}.tar.gz"

    tar -czf "${config_backup}" -C "${PROJECT_DIR}" \
        --exclude='node_modules' \
        --exclude='dist' \
        --exclude='backups' \
        --exclude='.git' \
        --exclude='*.log' \
        config/ \
        scripts/ \
        .env.example \
        docker-compose.yml \
        Dockerfile \
        package.json \
        pnpm-lock.yaml \
        2>/dev/null || log_warning "Some config files may not exist"

    log_success "Config backup: ${config_backup}"
}

backup_artifacts() {
    log_info "Backing up artifact metadata (not files - use object storage for files)..."

    local meta_backup="${BACKUP_DIR}/artifacts_meta_${TIMESTAMP}.sql.gz"

    PGPASSWORD="${POSTGRES_PASSWORD}" pg_dump \
        -h "${POSTGRES_HOST:-postgres}" \
        -p "${POSTGRES_PORT:-5432}" \
        -U "${POSTGRES_USER:-isabella_admin}" \
        -d "${POSTGRES_DB:-isabella_db}" \
        --table=artifacts \
        --table=artifact_versions \
        --table=artifact_metadata \
        | gzip > "${meta_backup}"

    log_success "Artifact metadata backup: ${meta_backup}"
}

backup_secrets() {
    log_info "Backing up encrypted secrets (if SOPS configured)..."

    if [[ -f "${PROJECT_DIR}/secrets.enc.yaml" && -f "${PROJECT_DIR}/.sops.yaml" ]]; then
        cp "${PROJECT_DIR}/secrets.enc.yaml" "${BACKUP_DIR}/secrets.enc.yaml"
        cp "${PROJECT_DIR}/.sops.yaml" "${BACKUP_DIR}/.sops.yaml"
        log_success "SOPS secrets backed up"
    else
        log_info "No SOPS secrets to backup"
    fi
}

create_manifest() {
    log_info "Creating backup manifest..."

    cat > "${BACKUP_DIR}/manifest.json" <<EOF
{
    "timestamp": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
    "version": "ISABELLA GENESIS ZERO-OPEX v3",
    "hostname": "$(hostname)",
    "user": "$(whoami)",
    "git_commit": "$(git -C "${PROJECT_DIR}" rev-parse HEAD 2>/dev/null || echo 'unknown')",
    "git_branch": "$(git -C "${PROJECT_DIR}" rev-parse --abbrev-ref HEAD 2>/dev/null || echo 'unknown')",
    "components": {
        "postgres": true,
        "config": true,
        "artifacts_metadata": true,
        "secrets": $([[ -f "${PROJECT_DIR}/secrets.enc.yaml" ]] && echo true || echo false)
    },
    "retention_days": ${RETENTION_DAYS}
}
EOF

    log_success "Manifest created"
}

# ============================================================================
# CLEANUP
# ============================================================================

cleanup_old_backups() {
    log_info "Cleaning up backups older than ${RETENTION_DAYS} days..."

    find "${BACKUP_ROOT}" -maxdepth 1 -type d -name "20*" -mtime +${RETENTION_DAYS} -exec rm -rf {} \; 2>/dev/null || true

    local remaining=$(find "${BACKUP_ROOT}" -maxdepth 1 -type d -name "20*" | wc -l)
    log_success "Cleanup complete. ${remaining} backups retained"
}

# ============================================================================
# VERIFY
# ============================================================================

verify_backup() {
    log_info "Verifying backup integrity..."

    local errors=0

    # Check PostgreSQL dump
    if [[ -f "${BACKUP_DIR}/postgres_${TIMESTAMP}.sql.gz" ]]; then
        if gzip -t "${BACKUP_DIR}/postgres_${TIMESTAMP}.sql.gz" 2>/dev/null; then
            log_success "PostgreSQL dump integrity OK"
        else
            log_error "PostgreSQL dump corrupted"
            return 1
        fi
    fi

    # Check config backup
    if [[ -f "${BACKUP_DIR}/config_${TIMESTAMP}.tar.gz" ]]; then
        if tar -tzf "${BACKUP_DIR}/config_${TIMESTAMP}.tar.gz" >/dev/null 2>&1; then
            log_success "Config backup integrity OK"
        else
            log_error "Config backup corrupted"
            return 1
        fi
    fi

    # Check manifest
    if [[ -f "${BACKUP_DIR}/manifest.json" ]]; then
        if jq . "${BACKUP_DIR}/manifest.json" >/dev/null 2>&1; then
            log_success "Manifest valid"
        else
            log_error "Manifest invalid JSON"
            return 1
        fi
    fi

    log_success "All backups verified"
}

# ============================================================================
# MAIN
# ============================================================================

main() {
    cd "$(dirname "${BASH_SOURCE[0]}")/.."

    case "${1:-full}" in
        full)
            log_info "Starting full backup..."
            backup_postgres || exit 1
            backup_config
            backup_artifacts
            backup_secrets
            create_manifest
            verify_backup || exit 1
            cleanup_old_backups
            log_success "Full backup completed: ${BACKUP_DIR}"
            ;;
        postgres)
            backup_postgres && verify_backup
            ;;
        config)
            backup_config && verify_backup
            ;;
        artifacts)
            backup_artifacts && verify_backup
            ;;
        secrets)
            backup_secrets
            ;;
        cleanup)
            cleanup_old_backups
            ;;
        verify)
            verify_backup
            ;;
        list)
            log_info "Available backups:"
            find "${BACKUP_ROOT}" -maxdepth 1 -type d -name "20*" | sort -r | while read dir; do
                if [[ -f "${dir}/manifest.json" ]]; then
                    local ts=$(basename "${dir}")
                    local commit=$(jq -r '.git_commit' "${dir}/manifest.json" 2>/dev/null | cut -c1-8)
                    local branch=$(jq -r '.git_branch' "${dir}/manifest.json" 2>/dev/null)
                    echo "  ${ts}  [${branch}] ${commit}"
                fi
            done
            ;;
        *)
            echo "Usage: $0 {full|postgres|config|artifacts|secrets|cleanup|verify|list}"
            exit 1
            ;;
    esac
}

main "$@"