# Isabella Genesis Ω — IGE-Ω v2.0.0

Rust MVP integrado como sub-workspace del monorepo Isabella V6 · TINA. El límite separado permite evolución gradual sin sustituir el runtime TypeScript. **Clasificación: blueprint + MVP implementable + PostgreSQL persistente + preproducción.**

## Crates
- `shared`: contratos, errores, eventos y estados epistémicos.
- `neurokernel`: bus de eventos, cola acotada y máquina de estados.
- `cognition`: hipótesis, planificación y simulación acotada.
- `memory`: persistencia PostgreSQL aislada por tenant/usuario.
- `worldmodel`: grafo persistido en PostgreSQL, con validación de pertenencia a tenant en la capa Rust y triggers SQL.
- `abx`: arbitraje CROWN conservador.
- `bookpix`: ledger SHA-256 encadenado.
- `services/gateway`: API Axum y migraciones SQLx.

## Arranque local
Desde la raíz del repositorio, copia `ige-omega/.env.example` a `ige-omega/.env`, usa un token aleatorio de al menos 64 caracteres hexadecimales y ejecuta `docker compose --env-file ige-omega/.env -f ige-omega/deployment/docker-compose.yml up --build`.

Rutas: `GET /health`, `GET /ready`, `POST /api/v1/infer`, `POST /api/v1/simulate`, `POST/GET /api/v1/memory`, `DELETE /api/v1/memory/{memory_id}`, `POST /api/v1/world/entities`, `GET /api/v1/world/entities/{entity_id}`, `POST /api/v1/world/relations`, `POST /api/v1/world/causal-edges`, `GET /api/v1/world/causes/{effect}`, `GET /api/v1/world/components/{entity_id}`, `GET /api/v1/ops/audit/verify`, `GET /api/v1/ops/abx/decisions`. Todas salvo health/readiness requieren `Authorization: Bearer <token-bound-to-tenant-and-user>`.

Genera un token distinto por principal con `openssl rand -hex 32`; configura `IGE_API_TOKENS=token|tenant_uuid|user_uuid` y no reutilices el token de ejemplo. Los UUID de identidad se derivan del token, no del JSON del cliente. `POST /api/v1/simulate` acepta como máximo 128 escenarios, 10 000 iteraciones de presupuesto y 64 KiB de cuerpo y límite fijo de 120 solicitudes/minuto por principal (configurable con `IGE_RATE_LIMIT_PER_MINUTE`); cada resultado se registra en BookPI-X y nunca ejecuta acciones. Las decisiones ABX se persisten con el usuario autenticado y su evento BookPI-X en una transacción. El historial filtra por tenant y usuario. Las mutaciones del World Model y su evento BookPI-X se confirman dentro de la misma transacción PostgreSQL. La memoria `SESSION` requiere `session_id` al crearla y al consultarla; sin ese ID no se devuelve. El borrado de memoria es una eliminación física sólo para el propietario autenticado y se audita sin copiar el contenido borrado al ledger.

## Verificación
Desde `ige-omega/`: `cargo fmt --all -- --check && cargo clippy --workspace --all-targets -- -D warnings && cargo test --workspace && cargo build --release -p gateway`. Las pruebas de integración PostgreSQL requieren una base desechable y `IGE_TEST_DATABASE_URL`; CI las ejecuta con PostgreSQL 16. Las restricciones SQL de memoria de la migración 0009 y del World Model de la 0010 se crean `NOT VALID`: PostgreSQL las aplica a nuevas escrituras, pero antes de validarlas debe revisarse y repararse cualquier registro histórico incompatible.

## Límites explícitos
No hay ejecución externa, pgvector/búsqueda vectorial, inferencia neuronal local, consenso Raft/CRDT, NATS, rollback real, firma digital ni WORM. La probabilidad de éxito no está calibrada y por eso se devuelve null. SHA-256 encadenado ofrece evidencia de manipulación sólo si la cabeza confiable se conserva fuera de la misma base. Cada token Bearer está ligado a un tenant y usuario; las identidades no se aceptan desde el cuerpo de la petición. No declarar probado hasta que CI compile y ejecute pruebas en el mismo SHA.

Documentación: [especificación](docs/IGE-OMEGA-v2.0.0.md), [auditoría](docs/CRYPTOGRAPHIC-AUDIT.md), [simulación y arbitraje](docs/SIMULATION-ARBITRATION.md), [Kubernetes](deployment/k8s/).
