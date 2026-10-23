#!/bin/bash
# ISABELLA GENESIS ZERO-OPEX v3 - Ollama Model Pre-load Script
# Pulls and verifies all required models for local inference

set -euo pipefail

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Configuration
OLLAMA_HOST="${OLLAMA_HOST:-localhost}"
OLLAMA_PORT="${OLLAMA_PORT:-11434}"
OLLAMA_URL="http://${OLLAMA_HOST}:${OLLAMA_PORT}"

# Required models for ISABELLA GENESIS
REQUIRED_MODELS=(
    "llama3.3:8b"
    "qwen2.5-coder:14b"
    "deepseek-r1:32b"
)

# Optional models (if disk space permits)
OPTIONAL_MODELS=(
    "nomic-embed-text"
    "bge-m3"
    "llama3.2:3b"
    "phi3:mini"
)

# Embedding models (for semantic cache)
EMBEDDING_MODELS=(
    "nomic-embed-text"
    "bge-m3"
)

log_info() { echo -e "\033[0;34m[INFO]\033[0m $1"; }
log_success() { echo -e "\033[0;32m[SUCCESS]\033[0m $1"; }
log_warning() { echo -e "\033[1;33m[WARNING]\033[0m $1"; }
log_error() { echo -e "\033[0;31m[ERROR]\033[0m $1"; }

# ============================================================================
# UTILITY FUNCTIONS
# ============================================================================

check_ollama() {
    log_info "Checking Ollama availability at $OLLAMA_URL..."
    local retries=30
    local interval=5

    for ((i=1; i<=retries; i++)); do
        if curl -sf "${OLLAMA_URL}/api/tags" >/dev/null 2>&1; then
            log_success "Ollama is ready"
            return 0
        fi
        log_info "Waiting for Ollama... (${i}/${retries})"
        sleep $interval
    done

    log_error "Ollama not available after ${retries} attempts"
    return 1
}

get_model_size() {
    local model="$1"
    curl -sf "${OLLAMA_URL}/api/show" -H "Content-Type: application/json" -d "{\"name\": \"${model}\"}" 2>/dev/null | \
        grep -o '"size":[0-9]*' | cut -d: -f2 | head -1
}

format_size() {
    local bytes=$1
    if [[ $bytes -gt 1073741824 ]]; then
        echo "$(awk "BEGIN {printf \"%.1f\", $bytes/1073741824}") GB"
    elif [[ $bytes -gt 1048576 ]]; then
        echo "$(awk "BEGIN {printf \"%.1f\", $bytes/1048576}") MB"
    else
        echo "$(awk "BEGIN {printf \"%.1f\", $bytes/1024}") KB"
    fi
}

model_exists() {
    local model="$1"
    curl -sf "${OLLAMA_URL}/api/tags" 2>/dev/null | grep -q "\"name\":\"${model}\""
}

pull_model() {
    local model="$1"
    local max_retries=3
    local retry=1

    log_info "Pulling ${model}..."

    while [[ $retry -le $max_retries ]]; do
        if curl -sf -X POST "${OLLAMA_URL}/api/pull" \
            -H "Content-Type: application/json" \
            -d "{\"name\": \"${model}\"}" | while IFS= read -r line; do
            # Parse progress from streaming JSON
            if echo "$line" | grep -q '"status"'; then
                local status=$(echo "$line" | grep -o '"status":"[^"]*"' | cut -d'"' -f4)
                local progress=$(echo "$line" | grep -o '"completed":[0-9]*' | cut -d: -f2)
                local total=$(echo "$line" | grep -o '"total":[0-9]*' | cut -d: -f2)
                if [[ -n "$progress" && -n "$total" && $total -gt 0 ]]; then
                    local pct=$((progress * 100 / total))
                    printf "\r${BLUE}[PULL]${NC} %s: %d%%" "$model" "$pct"
                else
                    echo -ne "\r${BLUE}[PULL]${NC} $model: $status"
                fi
            fi
        done; then
            echo ""
            log_success "Pulled $model"
            return 0
        fi

        log_warning "Pull failed (attempt $retry/$max_retries), retrying..."
        ((retry++))
        sleep 10
    done

    log_error "Failed to pull $model after $max_retries attempts"
    return 1
}

verify_model() {
    local model="$1"
    log_info "Verifying $model..."

    # Test generation
    local test_prompt="Hello, this is a test."
    local response=$(curl -sf -X POST "${OLLAMA_URL}/api/generate" \
        -H "Content-Type: application/json" \
        -d "{\"model\": \"${model}\", \"prompt\": \"${test_prompt}\", \"stream\": false, \"options\": {\"num_predict\": 10}}" 2>/dev/null)

    if echo "$response" | grep -q '"response"'; then
        local text=$(echo "$response" | grep -o '"response":"[^"]*"' | cut -d'"' -f4)
        log_success "$model verified (response: ${text:0:50}...)"
        return 0
    else
        log_error "$model verification failed"
        return 1
    fi
}

list_models() {
    log_info "Currently installed models:"
    curl -sf "${OLLAMA_URL}/api/tags" 2>/dev/null | \
        grep -o '"name":"[^"]*"' | cut -d'"' -f4 | while read model; do
        local size=$(get_model_size "$model")
        echo "  - $model ($(format_size $size))"
    done
}

# ============================================================================
# MAIN COMMANDS
# ============================================================================

cmd_pull_required() {
    log_info "Pulling required models for ISABELLA GENESIS..."
    check_ollama || return 1

    local failed=0
    for model in "${REQUIRED_MODELS[@]}"; do
        if model_exists "$model"; then
            log_success "$model already installed"
        else
            pull_model "$model" || ((failed++))
        fi
    done

    if [[ $failed -eq 0 ]]; then
        log_success "All required models pulled"
        return 0
    else
        log_error "$failed required model(s) failed"
        return 1
    fi
}

cmd_pull_embedding() {
    log_info "Pulling embedding models for semantic cache..."
    check_ollama || return 1

    for model in "${EMBEDDING_MODELS[@]}"; do
        if model_exists "$model"; then
            log_success "$model already installed"
        else
            pull_model "$model" || log_warning "Failed to pull $model (optional)"
        fi
    done
}

cmd_pull_optional() {
    log_info "Pulling optional models..."
    check_ollama || return 1

    for model in "${OPTIONAL_MODELS[@]}"; do
        if model_exists "$model"; then
            log_success "$model already installed"
        else
            pull_model "$model" || log_warning "Failed to pull $model"
        fi
    done
}

cmd_pull_all() {
    cmd_pull_required || return 1
    cmd_pull_embedding
    cmd_pull_optional
}

cmd_verify() {
    log_info "Verifying all models..."
    check_ollama || return 1

    local failed=0
    for model in "${REQUIRED_MODELS[@]}"; do
        if model_exists "$model"; then
            verify_model "$model" || ((failed++))
        else
            log_warning "$model not installed"
            ((failed++))
        fi
    done

    if [[ $failed -eq 0 ]]; then
        log_success "All required models verified"
        return 0
    else
        log_error "$failed model(s) failed verification"
        return 1
    fi
}

cmd_list() {
    check_ollama || return 1
    list_models
}

cmd_cleanup() {
    log_info "Cleaning up unused models..."
    check_ollama || return 1

    local all_models=$(curl -sf "${OLLAMA_URL}/api/tags" 2>/dev/null | grep -o '"name":"[^"]*"' | cut -d'"' -f4)
    local required_set=("${REQUIRED_MODELS[@]}" "${EMBEDDING_MODELS[@]}" "${OPTIONAL_MODELS[@]}")

    for model in $all_models; do
        local keep=false
        for req in "${required_set[@]}"; do
            if [[ "$model" == "$req" ]]; then
                keep=true
                break
            fi
        done

        if [[ "$keep" == "false" ]]; then
            log_info "Removing unused model: $model"
            curl -sf -X DELETE "${OLLAMA_URL}/api/delete" \
                -H "Content-Type: application/json" \
                -d "{\"name\": \"${model}\"}" >/dev/null && log_success "Removed $model" || log_warning "Failed to remove $model"
        fi
    done
}

cmd_disk_usage() {
    check_ollama || return 1

    log_info "Ollama disk usage:"
    local total=0
    for model in $(curl -sf "${OLLAMA_URL}/api/tags" 2>/dev/null | grep -o '"name":"[^"]*"' | cut -d'"' -f4); do
        local size=$(get_model_size "$model")
        local formatted=$(format_size "$size")
        echo "  $model: $formatted"
        total=$((total + size))
    done

    echo "  Total: $(format_size $total)"
}

# ============================================================================
# MAIN
# ============================================================================

main() {
    case "${1:-pull_required}" in
        pull_required)
            cmd_pull_required
            ;;
        pull_embedding)
            cmd_pull_embedding
            ;;
        pull_optional)
            cmd_pull_optional
            ;;
        pull_all)
            cmd_pull_all
            ;;
        verify)
            cmd_verify
            ;;
        list)
            cmd_list
            ;;
        cleanup)
            cmd_cleanup
            ;;
        disk_usage)
            cmd_disk_usage
            ;;
        *)
            echo "Usage: $0 {pull_required|pull_embedding|pull_optional|pull_all|verify|list|cleanup|disk_usage}"
            exit 1
            ;;
    esac
}

main "$@"