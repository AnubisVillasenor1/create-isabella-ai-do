# Reducción de deuda técnica — iteración 2026-10-13

**Ámbito:** continuación de `docs/audits/TOTAL-AUDIT-2026-10-13.md` (que mide el SHA `deb26b9`
y no se reescribe). Este documento registra los cambios posteriores a esa fotografía sobre la
rama `main`.

**Invariante de evidencia:** un test verde demuestra una capacidad computacional local, **no**
autoridad, aprendizaje, integración ni producción. Este lote más cerca de mantenible, no de
*certificado*.

## Cambios aplicados

### TD-01 — Monolito `src/server.ts` (P1, apertura)

- **Contrato de rutas congelado.** `test/deployment/route-inventory.test.ts` parsea estáticamente
  todos los módulos de `src/` y compara contra `test/deployment/route-inventory.json` (71 rutas).
  Fija la superficie HTTP antes de mover código y falla si una extracción pierde o renombra un
  endpoint. También verifica que ningún literal de ruta se registre en dos módulos.
- **Primera extracción cohesiva.** Las siete rutas de HyperCore Ω (`modes`, `run`, `predict`,
  `skills`, `skills/execute`, `mcp`) se movieron a `src/routes/hypercore.ts` detrás de
  `registerHyperCoreRoutes(app, deps)` **sin cambio de comportamiento**. `src/server.ts` pasó de
  ~5037 a ~4863 líneas y cede el bloque a una dependencia explícita (registry de skills, ledger,
  `authorizeApiToken`, `enforceRateLimit`, `commerceStringField`).
- **Inventario estático reparado.** `scripts/route-inventory.mjs` parseaba sólo `src/server.ts`;
  ahora recorre todo `src/**/*.ts`, por lo que el inventario en `docs/api/` sigue siendo veraz
  tras la extracción (71 rutas, incluidas las de `src/routes/hypercore.ts`).

### TD-05 — Estado volátil (P1, parcial)

- **Persistencia del registro de pasaportes (GAME OVER).** Nuevo puerto `PassportStorePort`
  (`src/gameover/passport-store.ts`) con implementación JSON-file de escritura atómica
  (`createJsonPassportStore`, temp-file + rename) y una variante en memoria para pruebas.
  `createPassportAuthority` acepta `store`, carga al construirse y persiste en cada `issue`/`revoke`.
  Un archivo corrupto falla en voz alta (`PASSPORT_STORE_CORRUPT`) en vez de descartar registros.
  Se cablea desde el entorno con `GAMEOVER_PASSPORT_PATH`; sin la variable, sigue en memoria
  (compatibilidad).
- **Directorio del ledger BookPI.** `DurableBookPiLedger` ahora crea su directorio en el constructor,
  de modo que la readiness en el arranque refleja un volumen escribible en vez de reportar
  `unavailable` hasta el primer append.

### TD-08 — Duplicación de gates (P3, corregido)

- `validate` pasa de `typecheck && test && build && security:suite` a `typecheck && build`, dado que
  `build` ya ejecuta `vitest` y `security:suite`. Se elimina la doble corrida de la suite y de
  seguridad sin perder cobertura.

### Herramientas nuevas (no deuda pendiente, capacidad local)

- `scripts/generate-native-keys.mjs` (`pnpm run keys:generate`): emite las claves **nativas** del
  proyecto (secretos HMAC `BOOKPI_INTEGRITY_SECRET` y `HYPERCORE_SIGNING_KEY`; tokens bearer
  `GENESIS_ADMIN_API_TOKEN`, `HYPERCORE_API_TOKEN`, `HSF_API_TOKEN`,
  `GENESIS_HUMAN_APPROVAL_TOKEN`; `CONNECTOR_WEBHOOK_SECRET`, `WEBHOOK_SIGNING_SECRET`,
  `TOKEN_ENCRYPTION_KEY`; y el par Ed25519 de aprobación humana) en `.env.native` (ignorado por
  git, modo `0o600`). No genera claves de proveedores externos. Arranque: `pnpm run start:native`.
- `scripts/verify-production.ts` ya documentado; sin cambios en este lote.

## Evidencia local reproducida

- `pnpm typecheck` — exit 0.
- `pnpm test` — **886 aprobadas / 158 archivos**.
- `pnpm run build` — RA **29/29**, smokes de UI/runtime en verde, `security:suite` **14/14**.
- `pnpm run verify:production` — 4/4 PASS + `PRODUCTION_VERIFY_OK`.
- Arranque real con claves nativas (`node --env-file=.env.native dist/server.js`): `GET /health`
  **200**; `GET /api/v1/healthz` **503** con `bookpi-ledger` y `signing-authority` **healthy**
  (ambas requeridas) y las dependencias opcionales (inferencia externa, persistencia, OTLP) en
  `degraded` por falta de credenciales/entorno.

## Deuda pendiente (no resuelta aquí)

- **TD-01 (resto):** quedan ~4863 líneas en `src/server.ts` (HTML embebido y decenas de rutas por
  extraer por dominio). El contrato de rutas y el patrón `registerXxxRoutes` quedan listos para
  continuar.
- **TD-04** (PR #5), **TD-06/TD-07** (gates externos) — sin cambios; dependen de revisión humana,
  credenciales y un runner de CI operativo.
- TD-05 sigue parcial: cachés compactas de HyperCore, prefetch y cooldown de proveedor siguen en
  memoria; los pasaportes Java no se tocan en este lote.
