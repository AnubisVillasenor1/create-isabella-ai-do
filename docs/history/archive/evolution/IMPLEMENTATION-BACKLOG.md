# Implementation backlog — Isabella V6 / TINA / Genesis

> state: draft | engine-generated. Inventario y plan de evolución.
> Contrato de fidelidad heredado: **SPECIFIED ≠ IMPLEMENTED ≠ TESTED ≠
> INTEGRATED ≠ VERIFIED ≠ DEPLOYED ≠ CERTIFIED**.
> Invariante: **CAPABILITY ≠ AUTHORITY ≠ EXECUTION ≠ EVIDENCE ≠ LEARNING ≠ PRODUCTION**.

Este documento es un inventario honesto de lo hallado en el repositorio y un plan
por lotes. No declara producción, certificación ni métricas no medidas. Cada lote
solo se marca `wired` tras evidencia de tests + aprobación humana con nombre.

## Método del inventario

Reconocimiento ejecutado sobre `src/`, `docs/`, `test/` y scripts:

- Inventario de especificaciones (`docs/spec`, `docs/evolution`) vs implementación.
- Búsqueda de marcadores de trabajo sin terminar (`TODO`, `FIXME`, `XXX`, "not implemented").
- Verificación de cableado de registries en `src/genesis/runtime.ts`.
- Revisión del subsistema de comercio (`src/commerce/`) y persistencia (`src/bookpi/`, `src/atlas/`).

## Hallazgos verificados

### Comercio / monetización

- Existe una **capa de contratos** completa y testeada: planes (`src/commerce/plans.ts`),
  candados (`src/commerce/locks.ts`), guards (`src/commerce/guards.ts`), webhook,
  connectors, anti-fraude, revenue.
- **Faltaba** el flujo funcional de usuario: no había store de suscripciones, ni
  decisiones de entitlement aplicadas, ni metering de uso, ni endpoints `/billing/*`.
- No hay integración con un proveedor de pagos (correcto por diseño: el dinero se
  mueve fuera; Isabella solo registra estado verificado).

### Persistencia / backups

- `BookPiStorage` está definido (`src/bookpi/types.ts:79-88`) y hay adaptadores
  (`storage-jsonl.ts`, `storage-postgres.ts`), pero el runtime usa
  `InMemoryBookPiLedger` (`src/bookpi/ledger.ts:56-181`) que es **no durable**
  (`storage:"VOLATILE_IN_MEMORY"`, `wormEnforced:false`, `durable:false`).
- Atlas persiste vía Supabase REST (`src/atlas/persistence.ts`).
- Faltan backup/restore/retención y el cableado HTTP → storage durable.

### Seguridad

- `src/security/post-quantum.ts:193,201,209`: FIPS 203/204/205 declarados "not
  implemented" (dependen de HSM/KMS externo). No simular como verdes.

### Registries

- Todos los registries (skills/tools/capabilities/modules/protocols/plugins) están
  cableados en `src/genesis/runtime.ts`. No hay stubs `throw` sin resolver.

## Plan por lotes

### P0 — Cimiento real (en curso)

1. **Motor de monetización (entitlements + suscripciones + metering + endpoints).**
   Estado: `wired` en módulo + endpoints; tests verdes. Ver
   `docs/commerce/BILLING-ENGINE.md`.
2. **Persistencia durable de BookPI** + retención + backup/restore.
   Estado: `wired` en módulo (ledger durable JSONL + retención + backup/restore)
   y CLI `pnpm bookpi:maintenance`; el runtime selecciona durable con
   `BOOKPI_LEDGER_PATH`. Falta E2E con Postgres/Supabase y simulacro de
   recuperación. Ver `docs/bookpi/DURABLE-LEDGER.md`.
3. **CI con jobs verdes** (typecheck, test, build, security suite) sobre `main`.
   Estado: `blocked` por causa externa (cuenta). Los 6 workflows son YAML válido
   (`js-yaml`), registrados `active`, pero **todo run termina en
   `startup_failure` con 0 jobs y ~0-1s**; un workflow trivial (probe) en rama
   temporal falló igual. Indica que Actions no arranca en este repo **privado**
   (límite de gasto/facturación o política de cuenta). Requiere acción humana con
   acceso de admin/facturación; no se puede poner verde desde el código. El job
   `rust-verify` queda **desbloqueado a nivel de repositorio**: `ige-omega/Cargo.lock`
   está comprometido (237 paquetes) y `cargo fmt --all -- --check` pasa;
   `cargo metadata --locked` valida la coherencia lockfile/manifiestos. La
   compilación local (clippy/test/build) sigue bloqueada por falta de enlazador
   MSVC (`link.exe`) en el entorno; correrá en el runner `ubuntu-latest`.
4. **Inferencia externa real** con credenciales (sin inventar disponibilidad).
   Estado: `specified` (bloqueado: sin credenciales).
5. **Aislamiento multi-tenant verificado** (nivel aplicación).
   Estado: `wired` en módulo + tool; tests verdes. No verifica RLS de base de
   datos. Ver `docs/tenancy/ISOLATION.md`.
6. **Gobernanza de agentes GAME OVER / UAGP-1** (passport + trust + riesgo +
   ética + aprobación humana + auditoría).
   Estado: `wired` en el motor TypeScript (`src/gameover/`) + endpoints HTTP +
   tests verdes; el plugin Jenkins (`gameover-jenkins-plugin/`) está
   **implementado como código fuente** pero **no compilado** aquí (sin JDK/Maven).
   Ver `docs/GAME_OVER_UAGP1_CANONICAL.md`.
7. **Hiperaceleración cognitiva HyperCore Ω² + HyperPredict Ω.**
   Estado: `wired` en el runtime TypeScript (`src/hypercore/`) + endpoints HTTP
   gated + 51 pruebas verdes; invariante fail-closed (no autoriza, no ejecuta).
   Router/affinity heurístico y caché léxica (no embeddings); CEE/speedup son
   modelos declarados. Ver Lote 5.

### P1 — Endurecimiento

7. Hardening de seguridad de producción (rate-limit distribuido, secretos, rotación).
8. Recuperación con objetivos RTO/RPO medidos.
9. Observabilidad productiva (trazas, alertas, dashboards).
10. Verificación VERITAS real (no simulada).

### P2 — Escala

11. Dedupe de módulos homónimos.
12. E2E en navegadores.
13. Heptafederación.

## Lote 1 — Motor de monetización (implementado)

Nuevos módulos (todos `state: draft | engine-generated`):

- `src/commerce/subscriptions.ts`: `SubscriptionStore` con máquina de estados
  explícita y rastro de auditoría. Exige referencia de proveedor; no infiere
  estado pagado. Plan ENTERPRISE exige `contract: true`.
- `src/commerce/entitlements.ts`: `checkFeature`, `checkQuota`, `planEntitlements`.
  Decisiones deterministas sin efectos secundarios.
- `src/commerce/metering.ts`: `UsageMeter` con cubos por workspace/cuota/día y
  acotación de memoria.

Endpoints (ver `docs/commerce/BILLING-ENGINE.md`): `GET /api/v1/billing/plans`,
`GET /api/v1/billing/entitlements`, `GET|POST /api/v1/billing/subscribe`,
`POST /api/v1/billing/cancel`, `GET /api/v1/billing/usage`,
`GET /api/v1/billing/subscription`, y la puerta real `POST /api/v1/commerce/offers`.

Pruebas: `test/commerce/subscriptions.test.ts`, `entitlements.test.ts`, `metering.test.ts`.

### Pendiente del lote 1 (honesto)

- Autenticación de usuario final (hoy las rutas usan token de servicio
  `GENESIS_ADMIN_API_TOKEN`; no hay login de usuario).
- Persistencia durable del `SubscriptionStore` y del `UsageMeter`.
- UI de billing.

### Lote 1.b — Webhooks del proveedor → suscripción (implementado)

- `src/commerce/provider-events.ts`: `applyProviderSubscriptionEvent` +
  `defaultResolveIntent` mapean un evento firmado a transiciones del
  `SubscriptionStore` (`activate|trial|past_due|cancel|suspend`), con resultados
  de negocio como `outcome` (no lanza) y ENTERPRISE exigiendo `contract: true`.
- `src/server.ts`: `POST /api/v1/connectors/ingest` aplica el evento aceptado al
  store y lo registra en BookPI (`commerce.subscription.webhook_applied`).

Pruebas: `test/commerce/provider-events.test.ts` (12). Documentación:
`docs/commerce/BILLING-ENGINE.md`.


## Lote 2 — Persistencia durable del BookPI (implementado)

Nuevos/actualizados módulos (`state: draft | engine-generated`):

- `src/bookpi/ledger.ts`: se añade `DurableBookPiLedger` (JSONL append-only,
  recarga y reverificación en arranque, checkpoint) y `createAuditLedger()`. El
  singleton `bookPiLedger` selecciona durable con `BOOKPI_LEDGER_PATH`.
- `src/bookpi/retention.ts`: `planRetention` (planeación pura).
- `src/cli/bookpiMaintenance.ts`: CLI `verify | summary | backup | restore |
  retention` (script `pnpm bookpi:maintenance`).

Pruebas: `test/bookpi/durable-ledger.test.ts`, `test/bookpi/retention.test.ts`.
Documentación: `docs/bookpi/DURABLE-LEDGER.md`.

### Pendiente del lote 2 (honesto)

- Cableado E2E Postgres/Supabase (`createPostgresStorage`) con rol append-only.
- Simulacro de recuperación con RTO/RPO medidos.
- Cifrado en reposo y sellado externo (WORM real).

## Lote 3 — Aislamiento multi-tenant a nivel de aplicación (implementado)

- `src/tenancy/isolation.ts`: `verifyTenantIsolation(principal, records)`
  compara el tenant de cada registro provisto contra el tenant del principal
  verificado y clasifica `ISOLATED | VIOLATION_DETECTED | NOT_ASSESSED`.
  `coerceTenantRecords` normaliza entradas no confiables; `assertTenantScope`
  falla cerrado ante acceso cruzado.
- `src/tools/catalog.ts`: el tool `tenant_isolation_verify` dejó de ser un stub
  `NOT_ASSESSED`; ahora ejecuta la verificación sobre los registros de entrada y
  declara explícitamente `coverage: "APPLICATION_LEVEL_RECORD_TENANT_CHECK"`,
  `databaseRlsVerified: false`, `tamperProofBoundary: false`.

Pruebas: `test/tenancy/isolation.test.ts` (12). Documentación:
`docs/tenancy/ISOLATION.md`.

### Pendiente del lote 3 (honesto)

- Verificación real de RLS/políticas a nivel de base de datos (requiere Postgres
  con roles y dataset multi-tenant).
- Política de identidad verificada end-to-end en rutas HTTP (hoy el tenant del
  principal se resuelve fuera del request de billing).

## Lote 4 — GAME OVER / UAGP-1 (gobernanza de agentes)

Nuevo módulo `src/gameover/` (13 archivos, `state: draft | engine-generated`):
`types`, `constitution`, `trust-engine`, `risk-engine`, `ethics-engine`,
`explainability-engine`, `cognitive-court`, `passport-authority`, `validator`,
`human-approval-gate`, `audit`, `gateway`, `index` (barril).

- Pipeline: validación → passport → ética → trust → riesgo → corte →
  aprobación humana → explicación → auditoría (BookPI).
- Endpoints gated: `GET /api/v1/gameover/constitution`,
  `GET/POST /api/v1/gameover/passports`, `POST /api/v1/gameover/passports/revoke`,
  `POST /api/v1/gameover/govern` (ACCEPT→200, ESCALATE→202, REJECT→403).
- Plugin Jenkins `gameover-governance`: step `gameOverGovernance` que falla en
  cerrado ante outcome distinto de `ACCEPT`.

Pruebas: `test/gameover/*.test.ts` (43) + JUnit 5 en el plugin (fuente).
Documentación: `docs/GAME_OVER_UAGP1_CANONICAL.md`; citación: `CITATION.cff`.

### Pendiente del lote 4 (honesto)

- Compilar y ejecutar `.hpi` + suite JUnit 5 (requiere JDK 17 + Maven, ausentes).
- Firma/CA criptográfica del AI Passport (hoy el registro es en memoria y la
  verificación es de presencia/coincidencia, no criptográfica).
- Registro externo del DOI/organización en Zenodo/Figshare (acción humana).
- Persistir passports del plugin (hoy `PassportAuthority` es in-memory).

## Lote 5 — HyperCore Ω² + HyperPredict Ω (runtime de hiperaceleración cognitiva)

Nuevo módulo `src/hypercore/` (13 archivos, `state: draft | engine-generated`):
`types`, `canonical`, `energy`, `context-compiler`, `micro-moe`,
`adaptive-model-router`, `governed-semantic-cache`, `speculative-draft-engine`,
`veritas-omega`, `cee`, `hyperpredict`, `hypercore` (orquestador), `index` (barril).

- Pipeline fail-closed: `predict → cache → compress → route → execute experts
  (paralelo, con timeout) → speculative draft → Veritas Ω → CROWN → audit →
  deliver`. `timeout`, salida malformada, fallo de verificador y **auditoría
  ausente** (`MISSING_AUDIT`) → `DENIED`.
- Invariante: HyperCore **no autoriza** (CROWN-only) y **no ejecuta** efectos;
  la caché reutiliza pero **nunca otorga autoridad**; un draft especulativo
  **nunca** es final sin verificación.
- Veritas Ω: consenso por clases de riesgo (`low 2 / medium 3 / high 4 /
  critical 4`); fallo duro en `safety`/`policy`/`financial` → DENY; verificadores
  ausentes → RETRY_SAFE (nunca ALLOW).
- Energy Governor: modos `ECO/CRUISE/BOOST/HYPERBOOST/OMEGA` (Ω no es consumo
  ilimitado; es gobernanza máxima). Router por objetivo declarado
  `cost + λ·latency + μ·energy`.
- HyperPredict Ω: `OBSERVE/PREFETCH/DEFER/DENY`; prepara solo si
  `E[V] > E[C]` ∧ confianza ≥ umbral ∧ intent permitido por CROWN; deniega
  intenciones prohibidas; emite evidencia a BookPI.
- Endpoints: `GET /api/v1/hypercore/modes`,
  `POST /api/v1/hypercore/run`, `POST /api/v1/hypercore/predict` (gated
  `GENESIS_ADMIN_API_TOKEN`). Barril re-exportado en `src/index.ts` con alias
  para colisiones (`hyperCoreCanonicalJson`, `hyperCoreSha256Hex`,
  `hyperCoreSoftmax`, `HYPERCORE_OMEGA_MODES`).
- Interfaz (`src/ui/`): capa visual elegante en el hero — malla cuántica en
  `<canvas>` 2D autocontenida (sin CDN ni dependencias), aurora CSS y
  degradados de acento; respeta `prefers-reduced-motion` y **no publica
  métricas no verificadas**.

Pruebas: `test/hypercore/*.test.ts` (11 archivos, 51 pruebas).

### Pendiente del lote 5 (honesto)

- Router/affinity es heurístico por palabras clave, **no** un router aprendido;
  la similitud de caché es **léxica (Jaccard)**, no embeddings.
- La compresión de contexto es **extracción determinista**, no destilación
  neuronal; el CEE y el speedup son **modelos declarados**, no mediciones.
- El `Energy Governor` no tiene telemetría de hardware real (vatios/térmica).
- Los modos y prefetch leen policy/metadata **en proceso**; falta persistencia
  durable del estado de caché/prefetch entre reinicios.
- Falta prueba E2E del canvas del hero en navegadores reales (el smoke UI solo
  valida cableado estático).
