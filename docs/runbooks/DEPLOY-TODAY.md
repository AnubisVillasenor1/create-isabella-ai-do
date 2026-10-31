# Runbook — Desplegar Isabella hoy (runtime + persistencia)

- **state: draft | human-review-pending**
- **Objetivo:** llevar el runtime a un host con persistencia durable real y verificarlo, sin depender de CI.
- **Verdad (AGENTS.md):** `implemented` y `tested` en local; `deployed` sólo tras ejecutar los pasos y observar la verificación.

---

## 0. Prerrequisito: el gate local debe estar verde

    corepack enable
    pnpm install --frozen-lockfile
    pnpm run validate

Si algo falla, no continúes: `pnpm run validate` es la evidencia mínima (tipos, tests, build, seguridad).

---

## 1. Vía más rápida — Docker Compose (runtime + Postgres + migraciones)

Requiere Docker con Compose v2 en el host destino.

    docker compose up --build -d
    docker compose ps
    docker compose logs app | tail -n 50

Qué levanta:
- `app`: imagen distroless, usuario 10001, `read_only`, `no-new-privileges`, `cap_drop: ALL`.
- `postgres`: aplica `infra/db/migrations/*.sql` en el primer arranque.
- Volumen `bookpi-data` persistente para el ledger BookPI (`BOOKPI_LEDGER_PATH=/data/bookpi/ledger.jsonl`).

Verifica (desde el host):

    SMOKE_BASE_URL=http://localhost:3000 pnpm run smoke:production

Esperado: `PRODUCTION_SMOKE_OK`.

Consideraciones:
- `read_only: true` es correcto porque el runtime sólo lee `src/ui` y `src/styles`; escribe evidencia sólo en el volumen.
- Las credenciales de Postgres del compose son de desarrollo. En producción usa secretos reales (`POSTGRES_PASSWORD`, etc.).
- Deep readiness: `curl -s http://localhost:3000/api/v1/healthz | jq` devuelve **503** hasta que toda dependencia requerida esté configurada (ledger escribible + autoridad de firma). Es una señal accionable, no un fallo del paso.

---

## 2. Verificación sin Docker (entrypoint de producción real)

Confirma que el bundle de producción arranca y responde, sin contenedor:

    pnpm run build:dist
    pnpm run verify:production

Esperado: cuatro `[PASS]` y `PRODUCTION_VERIFY_OK`. El script arranca `node dist/server.js`, espera `/health`, ejecuta el smoke y termina el proceso.

---

## 3. Vía Kubernetes (objetivo productivo)

    kubectl apply -k k8s/
    kubectl -n isabella-genesis rollout status deploy/isabella-genesis

Antes de aplicar:
- Aprovisiona el Secret `isabella-genesis-secrets` (KMS / External Secrets / Sealed Secrets). El Deployment sólo referencia, nunca incrusta valores.
- Sustituye el tag `:v40.0.0` por `<registry>/<repo>@sha256:<digest>` y fija digests de las bases (`crane digest`). Ver `docs/deployment/README.md` (ISA-349/355).
- `readinessProbe` apunta hoy a `/api/v1/health` (superficial) para no bloquear pods por dependencias externas aún no verificadas. Cuando el Secret y los adaptadores estén listos, apunta la readiness a `GET /api/v1/healthz` (readiness profunda real).

HyperCore Ω (skills soberanas):

    kubectl apply -f deploy/k8s/isabella-hypercore-omega.yaml

---

## 4. Variables de entorno mínimas para un despliegue real

- Persistencia de evidencia: `BOOKPI_LEDGER_PATH` (volumen durable; no un filesystem efímero).
- Firma de evidencia: `HYPERCORE_SIGNING_KEY` o `BOOKPI_INTEGRITY_SECRET`.
- Persistencia de datos: `POSTGRES_URL` (con RLS probada end-to-end).
- Inferencia: al menos una credencial de proveedor (p. ej. `OPENROUTER_API_KEY` o `HF_TOKEN` + `HF_FREE_MODELS`).
- Observabilidad (opcional): `OTEL_EXPORTER_OTLP_ENDPOINT`.
- Gating admin: `HYPERCORE_API_TOKEN` (protege `/api/v1/hypercore/*` y `/api/v1/mcp`).

Consulta `GET /api/v1/healthz` para ver exactamente qué falta.

---

## 5. Rollback

    docker compose down            # detiene sin borrar volúmenes
    docker compose up --build -d   # reconstruye la versión anterior del tag

Kubernetes: `kubectl -n isabella-genesis rollout undo deploy/isabella-genesis`. El Deployment usa `RollingUpdate` con `maxUnavailable: 0` y `revisionHistoryLimit: 5`.

---

## 6. Lo que este runbook NO garantiza

- No certifica producción: faltan inferencia real, KMS/HSM productivo, E2E Postgres/RLS, Rust `--locked` y un runner de CI verde.
- No fija digests ni aprueba la imagen: ambas son decisiones humanas (`BLOCKED_ENVIRONMENT`).
- Un despliegue verde demuestra que el binario sirve; no demuestra autoridad, aprendizaje ni verdad del contenido.
