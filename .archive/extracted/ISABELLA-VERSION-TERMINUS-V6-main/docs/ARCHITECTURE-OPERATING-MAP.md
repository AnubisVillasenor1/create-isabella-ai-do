# Isabella Genesis TINA — mapa operativo

**Estado:** `draft | auto_generated`  
**Fecha:** 2026-10-10  
**Revisión humana requerida antes de declarar `verified` o `wired`.

## Invariante de gobierno

`CAPABILITY ≠ AUTHORITY ≠ EXECUTION ≠ EVIDENCE ≠ LEARNING ≠ PRODUCTION`

El runtime puede evaluar, registrar y proponer. La aprobación humana conserva la autoridad para cambios de estado, acciones externas y producción.

## Flujo principal

1. `src/server.ts` expone la superficie HTTP, límites de tasa, CROWN, AEGIS, herramientas, memoria y el panel operativo.
2. `src/genesis/runtime.ts` compone el runtime y sus registros de skills/tools.
3. `src/cognition/*`, `src/crown/*`, `src/authority/*` y `src/core/*` evalúan intención, riesgo, autoridad e invariantes.
4. `src/bookpi/*` construye y verifica la cadena hash. `src/bookpi/storage-postgres.ts` es el puerto durable para `public.bookpi_events`.
5. `src/atlas/*` usa Supabase REST con `SUPABASE_SERVICE_ROLE_KEY` para persistencia de Atlas; la clave nunca debe llegar al navegador.
6. `infra/db/migrations/*` y las migraciones aplicadas por Supabase definen tablas, índices y RLS.
7. `test/*` aporta evidencia computacional. No sustituye aprobación humana, revisión de PR ni evidencia de producción.

## Interconexión operativa añadida en la rama de auditoría

1. `src/server.ts` compone `createRuntimeBookPiStorage(process.env)` y entrega el puerto seleccionado a `POST /api/v1/pipeline/execute`.
2. `src/bookpi/runtime-storage.ts` selecciona PostgreSQL con `DATABASE_URL`, JSONL local con una ruta explícita o memoria volátil; el probe devuelve estado no saludable para el fallback en memoria.
3. `src/bookpi/storage-postgres.ts` ejecuta append en una sola transacción/conexión, establece `app.actor_id` de forma local, serializa la cabeza con advisory lock, normaliza `BIGINT` y rechaza escrituras fuera del actor configurado.
4. `src/memory/ikes-supabase.ts` persiste fuentes y claims en tablas separadas. `IKESEngine` hidrata, valida hashes/referencias, serializa escrituras y expone un probe; no promueve automáticamente el estado epistemológico.
5. `src/genesis/runtime.ts` inicializa Atlas e IKES en paralelo y mantiene disponible el fallback conversacional local cuando IKES no termina la hidratación. La API explícita de memoria permanece fail-closed.
6. `GET /api/v1/integrations/graph` ofrece un grafo de módulos y salud bajo autenticación administrativa.

**Límite no resuelto:** el ledger síncrono heredado `bookPiLedger` usado por rutas como YUN/HyperCore todavía no está unificado con el puerto asíncrono PostgreSQL del conductor. La integración del pipeline no debe presentarse como durabilidad global de todo BookPI. Las migraciones deben aplicarse y los probes/E2E deben pasar en un entorno remoto antes de marcar `wired`.

## Fronteras de datos

| Dominio | Fuente | Protección | Estado |
|---|---|---|---|
| BookPI | `public.bookpi_events` | RLS service-role; append-only operativo | `draft / requiere prueba E2E` |
| Webhooks | `public.webhook_events` | RLS service-role + idempotencia `(provider, external_event_id)` | `draft` |
| Workspaces | `public.workspaces`, `workspace_members` | RLS propietario/membresía | `draft` |
| Comercial | goals, offers, campaigns, leads, sales | RLS por workspace | `draft` |
| Atlas | tablas Atlas existentes | Supabase REST con timeout | `draft` |

## Contratos para cualquier cambio

- Validar tipos con `pnpm typecheck`.
- Ejecutar `pnpm test` y registrar el resultado en evidencia, sin llamarlo capacidad o autoridad.
- Toda mutación comercial debe recomputar valores en servidor, ser idempotente y quedar trazada.
- Toda consulta multi-tenant debe llevar `workspace_id` y depender de RLS; no confiar solo en filtros de UI.
- Toda nueva skill debe declarar `methodId`, `riskTier`, requisitos de evidencia y limitaciones.
- Todo estado `verified` necesita nombre de revisor humano; hasta entonces usar `draft`.
- Los bloqueos que dependan de HSM/KMS, proveedor PQC, SMTP, observabilidad o despliegue real permanecen `BLOCKED_ENVIRONMENT`.

## Ruta de seguimiento

- **P0:** probar BookPI durable contra Supabase, restauración/backups, secretos, observabilidad y workflow de producción.
- **P1:** migrar gradualmente rutas de mutación críticas a adapters persistentes y contratos validados.
- **P2:** consolidar módulos duplicados y reemplazar estados implícitos por estados del ledger.
- **Release:** typecheck + tests + security suite + production evidence + revisión humana con nombre + workflow de despliegue.

## Decisiones epistemológicas

El sistema debe distinguir siempre `NOT_ASSESSED`, `UNVERIFIED`, `OBSERVED`, `CORROBORATED`, `REPRODUCIBLE` y `VALIDATED`. Ninguna respuesta de interfaz debe presentar inferencias, mocks o cadenas en memoria como evidencia de producción.

## Riesgos abiertos

- El pipeline HTTP ya usa el puerto BookPI seleccionable, pero la cadena síncrona heredada y el adapter Postgres siguen siendo contratos distintos; falta unificar las rutas heredadas y demostrar el wiring E2E en una base remota.
- El service role permite bypass de RLS y solo debe existir en el proceso servidor.
- Las migraciones aplicadas deben conservarse también como artefactos versionados del repositorio antes de la siguiente release.
- La aprobación humana sigue siendo obligatoria para pasar de `draft` a `verified` y de `verified` a `wired`.

## Cómo continuar sin una persona específica

Un desarrollador nuevo debe comenzar por este archivo, `docs/ESTADO-REAL-ACTUAL.md`, `AGENTS.md`, `src/server.ts`, `src/bookpi/types.ts`, `src/bookpi/storage-postgres.ts`, las migraciones y los tests del dominio que vaya a modificar. Cada cambio debe dejar contrato, evidencia, limitación y decisión de rollback.
