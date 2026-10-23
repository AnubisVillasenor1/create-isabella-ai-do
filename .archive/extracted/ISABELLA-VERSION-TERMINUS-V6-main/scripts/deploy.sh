#!/bin/bash
# ISABELLA GENESIS ZERO-OPEX v3 - Production Deployment Script
# Runs pre-flight checks, deploys stack, validates health

set -euo pipefail

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Configuration
PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
COMPOSE_FILE="${PROJECT_DIR}/docker-compose.yml"
ENV_FILE="${PROJECT_DIR}/.env"
SCHEMA_FILE="${PROJECT_DIR}/scripts/schema.sql"
BACKUP_DIR="${PROJECT_DIR}/backups/$(date +%Y%m%d_%H%M%S)"

log_info() { echo -e "${BLUE}[INFO]${NC} $1"; }
log_success() { echo -e "${GREEN}[SUCCESS]${NC} $1"; }
log_warning() { echo -e "${YELLOW}[WARNING]${NC} $1"; }
log_error() { echo -e "${RED}[ERROR]${NC} $1"; }

# ============================================================================
# PRE-FLIGHT CHECKS
# ============================================================================

check_requirements() {
    log_info "Running pre-flight checks..."

    local errors=0

    # Check Docker
    if ! command -v docker &> /dev/null; then
        log_error "Docker not installed"
        ((errors++))
    else
        log_success "Docker: $(docker --version)"
    fi

    # Check Docker Compose
    if ! docker compose version &> /dev/null; then
        log_error "Docker Compose not available"
        ((errors++))
    else
        log_success "Docker Compose: $(docker compose version --short)"
    fi

    # Check .env file
    if [[ ! -f "$ENV_FILE" ]]; then
        log_error ".env file not found at $ENV_FILE"
        log_info "Copy .env.example to .env and fill in your values"
        ((errors++))
    else
        log_success ".env file found"
        # Validate required vars
        source "$ENV_FILE"
        local required_vars=(
            "DATABASE_URL"
            "BOOKPI_INTEGRITY_SECRET"
            "OPENROUTER_API_KEY"
            "HF_TOKEN"
            "GEMINI_API_KEY"
            "GROQ_API_KEY"
            "STRIPE_SECRET_KEY"
            "STRIPE_WEBHOOK_SECRET"
            "STRIPE_PUBLISHABLE_KEY"
            "GENESIS_ADMIN_API_TOKEN"
            "OPS_API_TOKEN"
            "CROWN_CONSTITUTION_VERSION"
            "LLM_DEFAULT_MODEL"
        )
        for var in "${required_vars[@]}"; do
            if [[ -z "${!var}" || "${!var}" == *"generate-with"* || "${!var}" == *"xxxxx"* ]]; then
                log_warning "Required variable $var not set or using placeholder"
            fi
        done
    fi

    # Check schema file
    if [[ ! -f "$SCHEMA_FILE" ]]; then
        log_error "Schema file not found at $SCHEMA_FILE"
        ((errors++))
    else
        log_success "Schema file found"
    fi

    # Check ports
    local ports=(80 443 5432 11434 8428 4317 4318 8080)
    for port in "${ports[@]}"; do
        if ss -tuln | grep -q ":$port "; then
            log_warning "Port $port already in use"
        fi
    done

    # Check disk space (need at least 20GB)
    local available=$(df "$PROJECT_DIR" --output=avail -B1 | tail -1)
    local required=$((20 * 1024 * 1024 * 1024)) # 20GB in bytes
    if [[ $available -lt $required ]]; then
        log_warning "Low disk space: $(numfmt --to=iec $available) available, 20GB recommended"
    else
        log_success "Disk space: $(numfmt --to=iec $available) available"
    fi

    # Check memory (need at least 4GB for stack + 8GB for models)
    local mem_total=$(free -b | awk '/^Mem:/{print $2}')
    local mem_gb=$((mem_total / 1024 / 1024 / 1024))
    if [[ $mem_gb -lt 8 ]]; then
        log_warning "Low memory: ${mem_gb}GB, 16GB+ recommended for local models"
    else
        log_success "Memory: ${mem_gb}GB"
    fi

    if [[ $errors -gt 0 ]]; then
        log_error "$errors pre-flight check(s) failed"
        return 1
    fi

    log_success "All pre-flight checks passed"
    return 0
}

# ============================================================================
# DEPLOYMENT STEPS
# ============================================================================

backup_existing() {
    log_info "Creating backup of existing deployment..."
    mkdir -p "$BACKUP_DIR"

    if docker compose ps -q postgres 2>/dev/null | grep -q .; then
        log_info "Backing up PostgreSQL..."
        docker compose exec -T postgres pg_dump -U isabella_admin isabella_db | gzip > "$BACKUP_DIR/postgres_$(date +%Y%m%d_%H%M%S).sql.gz"
        log_success "PostgreSQL backed up to $BACKUP_DIR"
    fi

    if [[ -f "$ENV_FILE" ]]; then
        cp "$ENV_FILE" "$BACKUP_DIR/.env.backup"
    fi

    log_success "Backup created at $BACKUP_DIR"
}

pull_images() {
    log_info "Pulling Docker images..."
    docker compose pull --ignore-pull-failures
    log_success "Images pulled"
}

deploy_stack() {
    log_info "Deploying stack..."
    docker compose up -d --remove-orphans
    log_success "Stack deployed"
}

wait_for_services() {
    log_info "Waiting for services to be healthy..."

    local max_wait=300
    local elapsed=0
    local interval=10

    while [[ $elapsed -lt $max_wait ]]; do
        local healthy=true

        # Check postgres
        if ! docker compose exec -T postgres pg_isready -U isabella_admin -d isabella_db >/dev/null 2>&1; then
            healthy=false
        fi

        # Check ollama
        if ! curl -sf "http://localhost:11434/api/tags" >/dev/null 2>&1; then
            healthy=false
        fi

        # Check isabella-core health endpoint
        if ! curl -sf "http://localhost:8080/api/v1/health" >/dev/null 2>&1; then
            healthy=false
        fi

        if [[ "$healthy" == "true" ]]; then
            log_success "All services healthy"
            return 0
        fi

        log_info "Waiting for services... (${elapsed}s/${max_wait}s)"
        sleep $interval
        elapsed=$((elapsed + interval))
    done

    log_error "Services did not become healthy within ${max_wait}s"
    docker compose ps
    docker compose logs --tail=50
    return 1
}

run_migrations() {
    log_info "Running database migrations..."
    if docker compose exec -T postgres psql -U isabella_admin -d isabella_db -f /docker-entrypoint-initdb.d/schema.sql; then
        log_success "Migrations applied"
    else
        log_error "Migration failed"
        return 1
    fi
}

pull_models() {
    log_info "Pulling Ollama models..."
    local models=("llama3.3:8b" "qwen2.5-coder:14b" "deepseek-r1:32b")

    for model in "${models[@]}"; do
        log_info "Pulling $model..."
        if docker compose exec ollama ollama pull "$model"; then
            log_success "Pulled $model"
        else
            log_warning "Failed to pull $model (may already exist)"
        fi
    done
}

verify_deployment() {
    log_info "Verifying deployment..."

    # Test health endpoint
    if curl -sf "http://localhost:8080/api/v1/health" | grep -q "healthy"; then
        log_success "Health endpoint OK"
    else
        log_error "Health endpoint failed"
        return 1
    fi

    # Test readiness endpoint
    if curl -sf "http://localhost:8080/api/v1/readyz" | grep -q "ready"; then
        log_success "Readiness endpoint OK"
    else
        log_warning "Readiness endpoint not ready (may need DB/models)"
    fi

    # Test chat endpoint
    local chat_response=$(curl -sf -X POST "http://localhost:8080/api/v1/chat" \
        -H "Content-Type: application/json" \
        -d '{"prompt":"Hello, test message"}' | head -c 200)
    if [[ -n "$chat_response" ]]; then
        log_success "Chat endpoint responding"
    else
        log_warning "Chat endpoint not responding (models may still be loading)"
    fi

    # Check metrics endpoint
    if curl -sf "http://localhost:8428/metrics" | grep -q "isabella"; then
        log_success "Metrics endpoint OK"
    else
        log_warning "Metrics endpoint not yet available"
    fi

    log_success "Deployment verification complete"
}

# ============================================================================
# MAIN
# ============================================================================

main() {
    echo "=========================================="
    echo "ISABELLA GENESIS ZERO-OPEX v3 Deployment"
    echo "=========================================="
    echo ""

    cd "$PROJECT_DIR"

    case "${1:-deploy}" in
        check)
            check_requirements
            ;;
        backup)
            backup_existing
            ;;
        deploy)
            check_requirements || exit 1
            backup_existing
            pull_images
            deploy_stack
            wait_for_services || exit 1
            run_migrations || exit 1
            pull_models
            verify_deployment || exit 1
            log_success "Deployment complete!"
            echo ""
            echo "Access points:"
            echo "  API:      http://localhost:8080"
            echo "  Health:   http://localhost:8080/api/v1/health"
            echo "  Ready:    http://localhost:8080/api/v1/readyz"
            echo "  Metrics:  http://localhost:8428/metrics"
            echo "  UI:       https://isabella.tamv.online (after DNS)"
            ;;
        rollback)
            log_warning "Rollback not yet implemented"
            ;;
        *)
            echo "Usage: $0 {check|backup|deploy|rollback}"
            exit 1
            ;;
    esac
}

main "$@"