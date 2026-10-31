#!/bin/bash
# Entrypoint script for ISABELLA GENESIS ZERO-OPEX v3
# Handles SOPS decryption and service startup

set -euo pipefail

echo "[Entrypoint] Starting ISABELLA GENESIS ZERO-OPEX v3..."

# Decrypt secrets if encrypted file exists
if [ -f "secrets.enc.yaml" ] && [ -f ".sops.yaml" ]; then
    echo "[Entrypoint] Decrypting secrets..."
    if command -v sops &> /dev/null; then
        sops --config .sops.yaml --decrypt secrets.enc.yaml > .env
        echo "[Entrypoint] Secrets decrypted successfully"
    else
        echo "[Entrypoint] WARNING: sops not installed, skipping decryption"
    fi
fi

# Load environment variables
if [ -f ".env" ]; then
    export $(grep -v '^#' .env | xargs)
    echo "[Entrypoint] Environment variables loaded"
fi

# Wait for PostgreSQL
echo "[Entrypoint] Waiting for PostgreSQL..."
until pg_isready -h "${POSTGRES_HOST:-postgres}" -p "${POSTGRES_PORT:-5432}" -U "${POSTGRES_USER:-isabella_admin}" -d "${POSTGRES_DB:-isabella_db}" > /dev/null 2>&1; do
    echo "[Entrypoint] Waiting for PostgreSQL to be ready..."
    sleep 2
done
echo "[Entrypoint] PostgreSQL is ready"

# Wait for Ollama
echo "[Entrypoint] Waiting for Ollama..."
until curl -s -f "http://${OLLAMA_HOST:-ollama}:${OLLAMA_PORT:-11434}/api/tags" > /dev/null 2>&1; do
    echo "[Entrypoint] Waiting for Ollama to be ready..."
    sleep 3
done
echo "[Entrypoint] Ollama is ready"

# Run database migrations
echo "[Entrypoint] Running database migrations..."
if [ -f "scripts/schema.sql" ]; then
    PGPASSWORD="${DB_PASSWORD}" psql -h "${POSTGRES_HOST:-postgres}" -U "${POSTGRES_USER:-isabella_admin}" -d "${POSTGRES_DB:-isabella_db}" -f scripts/schema.sql
    echo "[Entrypoint] Database migrations completed"
fi

# Pull Ollama models
echo "[Entrypoint] Ensuring Ollama models are available..."
MODELS=("llama3.3:8b" "qwen2.5-coder:14b" "deepseek-r1:32b")
for model in "${MODELS[@]}"; do
    if ! curl -s "http://${OLLAMA_HOST:-ollama}:${OLLAMA_PORT:-11434}/api/tags" | grep -q "\"name\":\"$model\""; then
        echo "[Entrypoint] Pulling model: $model"
        curl -X POST "http://${OLLAMA_HOST:-ollama}:${OLLAMA_PORT:-11434}/api/pull" -d "{\"name\": \"$model\"}" || echo "Warning: Failed to pull $model"
    else
        echo "[Entrypoint] Model $model already available"
    fi
done

# Start the application
echo "[Entrypoint] Starting Isabella Core..."
exec dumb-init -- node dist/server.js