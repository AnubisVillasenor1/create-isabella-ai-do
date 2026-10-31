#!/bin/bash
# ISABELLA GENESIS ZERO-OPEX v3 - Rollback Procedure
# Handles application and database rollback with safety checks

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

log_info() { echo -e "\033[0;34m[INFO]\033[0m $1"; }
log_success() { echo -e "\033[0;32m[SUCCESS]\033[0m $1"; }
log_warning() { echo -e "\033[1;33m[WARNING]\033[0m $1"; }
log_error() { echo -e "\033[0;31m[ERROR]\033[0m $1"; }

# ============================================================================
# ROLLBACK FUNCTIONS
# ============================================================================

list_rollback_targets() {
    log_info "Available rollback targets:"
    echo ""

    # Docker image tags
    log_info "Docker image tags:"
    docker images --format "table {{.Repository}}:{{.Tag}}\t{{.CreatedAt}}\t{{.Size}}" | grep isabella-core | head -10

    echo ""
    log_info "Backup directories:"
    find "${PROJECT_DIR}/backups" -maxdepth 1 -type d -name "20*" | sort -r | head -10 | while read dir; do
        if [[ -f "${dir}/manifest.json" ]]; then
            local ts=$(basename "${dir}")
            local commit=$(jq -r '.git_commit' "${dir}/manifest.json" 2>/dev/null | cut -c1-8)
            local branch=$(jq -r '.git_branch' "${dir}/manifest.json" 2>/dev/null)
            echo "  ${ts}  [${branch}] ${commit}"
        fi
    done
}

rollback_docker_image() {
    local target_tag="$1"

    if [[ -z "$target_tag" ]]; then
        log_error "Usage: rollback_image <tag>"
        return 1
    fi

    log_warning "Rolling back Docker image to: $target_tag"
    log_warning "This will stop the current application!"
    read -p "Type 'YES' to confirm: " confirm
    [[ "$confirm" == "YES" ]] || { log_error "Aborted"; return 1; }

    log_info "Stopping application..."
    docker compose stop isabella-core

    log_info "Tagging rollback image as latest..."
    docker tag "${target_tag}" ghcr.io/osopanda1/isabella-genesis:latest

    log_info "Starting application with rolled back image..."
    docker compose up -d isabella-core

    log_info "Waiting for health check..."
    local retries=30
    for ((i=1; i<=retries; i++)); do
        if curl -sf "http://localhost:8080/api/v1/health" >/dev/null 2>&1; then
            log_success "Application healthy after rollback"
            return 0
        fi
        sleep 5
    done

    log_error "Health check failed after rollback"
    return 1
}

rollback_database() {
    local backup_dir="$1"

    if [[ -z "$backup_dir" || ! -d "$backup_dir" ]]; then
        log_error "Usage: rollback_database <backup_directory>"
        return 1
    fi

    local dump_file="${backup_dir}/postgres_*.sql.gz"
    dump_file=$(ls $dump_file 2>/dev/null | head -1)

    if [[ ! -f "$dump_file" ]]; then
        log_error "No PostgreSQL dump found in $backup_dir"
        return 1
    fi

    log_warning "Rolling back database from: $dump_file"
    log_warning "This will OVERWRITE the current database!"
    read -p "Type 'YES' to confirm: " confirm
    [[ "$confirm" == "YES" ]] || { log_error "Aborted"; return 1; }

    log_info "Stopping application..."
    docker compose stop isabella-core

    log_info "Restoring database from $dump_file..."
    gunzip -c "$dump_file" | docker compose exec -T postgres psql -U isabella_admin -d isabella_db

    log_success "Database restored"
    log_info "Restarting application..."
    docker compose up -d isabella-core

    sleep 10
    if curl -sf "http://localhost:8080/api/v1/health" >/dev/null 2>&1; then
        log_success "Application healthy after database rollback"
    else
        log_error "Health check failed after database rollback"
        return 1
    fi
}

full_rollback() {
    local backup_dir="$1"

    if [[ -z "$backup_dir" || ! -d "$backup_dir" ]]; then
        log_error "Usage: full_rollback <backup_directory>"
        return 1
    fi

    log_warning "FULL ROLLBACK: This will restore both application and database!"
    log_warning "Target: $backup_dir"
    read -p "Type 'YES' to confirm FULL ROLLBACK: " confirm
    [[ "$confirm" == "YES" ]] || { log_error "Aborted"; return 1; }

    log_info "Starting full rollback..."

    # 1. Stop all services except postgres
    log_info "Stopping application services..."
    docker compose stop isabella-core

    # 2. Rollback database
    local dump_file=$(ls "${1}/postgres_*.sql.gz" 2>/dev/null | head -1)
    if [[ -f "$dump_file" ]]; then
        log_info "Restoring database..."
        gunzip -c "$dump_file" | docker compose exec -T postgres psql -U isabella_admin -d isabella_db
        log_success "Database restored"
    fi

    # 3. Restore config if available
    local config_backup=$(ls "${1}/config_*.tar.gz" 2>/dev/null | head -1)
    if [[ -f "$config_backup" ]]; then
        log_info "Restoring configuration..."
        tar -xzf "$config_backup" -C /
    fi

    # 4. Restart all services
    log_info "Restarting all services..."
    docker compose up -d

    # 5. Verify
    sleep 30
    if curl -sf "http://localhost:8080/api/v1/readyz" | grep -q "ready"; then
        log_success "Full rollback completed successfully"
    else
        log_error "Rollback verification failed"
        return 1
    fi
}

# ============================================================================
# SAFETY CHECKS
# ============================================================================

pre_rollback_checks() {
    local target="$1"

    log_info "Running pre-rollback safety checks..."

    # Check if backup exists
    if [[ ! -d "$target" ]]; then
        log_error "Backup directory not found: $target"
        return 1
    fi

    # Check manifest
    if [[ ! -f "$target/manifest.json" ]]; then
        log_warning "No manifest.json in backup, proceeding without metadata"
    fi

    # Check PostgreSQL connectivity
    if ! docker compose exec -T postgres pg_isready -U isabella_admin -d isabella_db >/dev/null 2>&1; then
        log_error "PostgreSQL not reachable"
        return 1
    fi

    # Check disk space
    local available=$(df /opt/isabella --output=avail -B1 | tail -1)
    local required=$((5 * 1024 * 1024 * 1024)) # 5GB
    if [[ $available -lt $required ]]; then
        log_warning "Low disk space: $(numfmt --to=iec $available) available"
    fi

    log_success "Pre-rollback checks passed"
    return 0
}

# ============================================================================
# MAIN
# ============================================================================

main() {
    cd "$(dirname "${BASH_SOURCE[0]}")/.."

    case "${1:-list}" in
        list)
            list_rollback_targets
            ;;
        image)
            rollback_docker_image "${2:-}"
            ;;
        database)
            rollback_database "${2:-}"
            ;;
        full)
            pre_rollback_checks "${2:-}" || exit 1
            full_rollback "${2:-}"
            ;;
        *)
            echo "Usage: $0 {list|image <tag>|database <backup_dir>|full <backup_dir>}"
            echo ""
            echo "Commands:"
            echo "  list                 - List available rollback targets"
            echo "  image <tag>          - Rollback Docker image to specific tag"
            echo "  database <dir>       - Rollback database from backup directory"
            echo "  full <backup_dir>    - Full rollback (app + database) from backup directory"
            exit 1
            ;;
    esac
}

main "$@"