> **AVISO DE TRAZABILIDAD — REGISTRO HISTÓRICO.** Este informe conserva el snapshot que declara en su encabezado (repositorio `isabella-V6-TINA-h6`, SHA `deb26b9` y 746 pruebas). No representa el estado actual de `ISABELLA-VERSION-TERMINUS-V6` ni debe utilizarse como evidencia de la rama actual. Para los hallazgos y correcciones de la revisión del 13 de octubre de 2026, consulte [TECHNICAL-OPERATIONAL-AUDIT-2026-10-13.md](./TECHNICAL-OPERATIONAL-AUDIT-2026-10-13.md). Las métricas posteriores solo son válidas si se reproducen y vinculan al SHA exacto evaluado.

---

# Auditoría total — Isabella V6 / TINA / Genesis

**Fecha:** 13 de octubre de 2026
**Repositorio:** `OsoPanda1/isabella-V6-TINA-h6`
**Rama:** `main`
**SHA auditado:** `deb26b9` (`docs(audit): record GAME OVER hardening and refreshed runtime evidence`)
**Método:** reproducción local de gates + inspección estructural sobre `src/`, `test/`, `docs/`, `.github/` y manifiestos. No es una certificación ni una revisión línea-a-línea de los 228 archivos fuente.

## 1. Dictamen ejecutivo

El árbol en `deb26b9` es **coherente y verde en local**: typecheck estricto sin errores, **746 pruebas en 135 archivos**, build completo (bundle + smoke UI/runtime) y **14/14** controles de seguridad estática. No hay marcadores `TODO/FIXME/HACK` en `src/`, ni `@ts-ignore`/`@ts-expect-error`/`as any`/`: any`, ni dependencias de runtime sin usar.

La deuda técnica dominante es **estructural, no de corrección**: un monolito de 4 567 líneas (`src/server.ts`, 67 rutas), módulos con lógica real sin pruebas (`protocols`, `modules`, `intelligence`), convivencia de dos "HyperCore" con el mismo nombre (V5 heurístico y V6 Ω²), estado en memoria sin durabilidad, y varios gates que dependen de recursos externos (CI, inferencia, PQC/HSM, E2E Postgres). Nada de esto se declara como producción.

## 2. Evidencia reproducida en `deb26b9`

| Gate | Comando | Resultado |
|---|---|---|
| Tipos estrictos | `pnpm typecheck` | exit 0 |
| Pruebas | `pnpm test` | **746 aprobadas / 135 archivos** |
| Build completo | `pnpm build` | exit 0 (tsc + vitest + esbuild + `node --check` + smoke UI + smoke runtime) |
| Seguridad estática | `pnpm run security:suite` | **14 passed / 0 failed / 0 not_applicable** |

Smoke observados: `UI_NAVIGATION_SMOKE_OK`, `CINEMATIC_INTRO_12_SCENES_OK`, `PUBLIC_API_GUARDRAILS_OK`, `LOCAL_CONVERSATION_SMOKE_OK`. El smoke de inferencia externa se **omite** por falta de credenciales elegibles (`LLM_GATEWAY_SMOKE_SKIPPED`); no se afirma proveedor real operativo.

## 3. Inventario medido

- **Código:** 228 archivos `.ts` en `src/` (43 módulos de primer nivel); 136 archivos de prueba en `test/`.
- **Monolito:** `src/server.ts` = 4 567 líneas, **67 rutas**; el siguiente archivo más grande es `src/genesis/runtime.ts` (678 líneas).
- **Dependencias:** 6 de runtime (`@ai-sdk/gateway`, `@google/genai`, `ai`, `express`, `tsx`, `ws`) + 5 de desarrollo. Verificación de uso: todas se importan o se usan vía CLI/config; sin dependencias muertas.
- **Vulnerabilidades:** **0 alertas Dependabot abiertas** (13 resueltas en `f1d5f03`).
- **CI:** los 6 workflows están presentes y son YAML válido, pero los runs terminan en `startup_failure` sin jobs (bloqueo de cuenta, externo; ver TD-07).
- **Rust:** `ige-omega/Cargo.lock` presente (237 paquetes) y `cargo fmt --all -- --check` limpio; compilación/clippy/test locales no ejecutables (sin `link.exe`/MSVC).
- **PRs/branches:** PR **#5** en borrador (Terminus Ω + fixes BookPI; 26 archivos, +2567/−278, `MERGEABLE`) y rama `feat/terminus-bookpi-retention-sharded-storage-2026-10` sin PR. No integrados.
- **Autores:** 3 generaciones de trabajo (`TAMV ONLINE ENTERPRISE`, `OsoPanda1`, `v0`) – procedencia mixta documentada por commit (`Provenance:`/`State:`).

## 4. Registro de deuda técnica priorizada

| ID | Prioridad | Deuda | Impacto | Estado |
|---|---|---|---|---|
| TD-01 | P1 | Monolito `src/server.ts` (4 567 líneas, 67 rutas, HTML embebido). | Mantenibilidad, riesgo de regresión, testabilidad baja. | Abierto. Extracción incremental por dominio prevista. |
| TD-02 | P1 | Módulos con lógica real sin pruebas: `src/protocols` (9 contratos), `src/modules/registry`, `src/intelligence/adaptive-router`. | Cobertura insuficiente en fronteras ejecutables. | **Corregido parcialmente en esta iteración** (ver §4). |
| TD-03 | P2 | Dos "HyperCore": `src/evolution/hypercore.ts` (V5 heurístico) y `src/hypercore/` (V6 Ω²). | Ambigüedad de nombres. | **Documentado** con comentario de cabecera; fusión no procede (contratos distintos). |
| TD-04 | P1 | PR #5 (Terminus Ω: erasure-code, mandate, retention, sharded-store, storage-postgres) en draft, sin integrar. | Funcionalidad y fixes pendientes fuera de `main`. | Abierto; requiere revisión de contrato y gates antes de merge. |
| TD-05 | P1 | Estado volátil en memoria: passports (TS y Java), cachés de HyperCore, prefetch, cooldown de proveedor. | Sin durabilidad entre reinicios/réplicas. | Abierto. |
| TD-06 | P1 | Capacidades que dependen de recursos externos: inferencia real, PQC FIPS 203/204/205 (HSM/KMS), E2E Postgres/Supabase, RLS. | Estados `specified`/`blocked`, no `verified`. | Abierto (externo). |
| TD-07 | P0 | GitHub Actions `startup_failure` sin jobs. | Sin CI reproducible. | Bloqueado por cuenta; requiere acción humana de admin/facturación. |
| TD-08 | P3 | `build` ejecuta `vitest` + `security:suite`, y `validate` los repite. | Trabajo duplicado en el gate. | Abierto (bajo impacto). |
| TD-09 | P3 | `tsx` figura en `dependencies` (herramienta de desarrollo). | Higiene del manifiesto. | Abierto; no se cambia ahora por dependencia del script `start`. |

## 4. Correcciones aplicadas en esta iteración

- **TD-02 — Pruebas de regresión** para fronteras ejecutables antes sin cobertura:
  - `test/protocols/registry.test.ts`: alta, duplicados, desconocido, inmutabilidad y propagación de contexto (`requestId`/`traceId`) en `execute`.
  - `test/protocols/catalog.test.ts`: unicidad de IDs, firma/verificación de eventos (round-trip y manipulación), Merkle (`bookpi.register`/`verify`) y rechazo de tipo de evento Atlas desconocido.
  - `test/modules/registry.test.ts`: alta, duplicados, desconocido y congelado de descriptor/capacidades.
  - `test/intelligence/adaptive-router.test.ts`: clases de complejidad, supresión de aceleración en riesgo `CRITICAL`, política de caché y fan-out.
- **TD-03 — Comentario de cabecera** en `src/evolution/hypercore.ts` que marca explícitamente el contrato V5 heurístico y lo distingue del módulo V6 Ω² (`src/hypercore/`).

## 5. Próximos lotes (prioridad sugerida)

1. **TD-01:** extraer de `src/server.ts` un primer grupo cohesivo (p. ej. rutas HyperCore o helpers de proveedores) a un módulo propio, con una prueba de inventario de rutas que fije el contrato antes de mover código.
2. **TD-04:** revisar el PR #5 término a término (contrato, tests, gates) y decidir integrar o descartar.
3. **TD-05:** cablear durabilidad (Postgres/JSONL) para passports y estado de caché/prefetch.
4. **TD-06/TD-07:** completar los gates externos con credenciales y un runner CI operativo.
5. **TD-08:** simplificar los scripts `build`/`validate` para no duplicar la suite.

## 6. Regla de evidencia

Esta auditoría mide el estado de `deb26b9` y no se copia a otros SHAs. Un test verde demuestra una capacidad computacional local, **no** autoridad, aprendizaje, certificación ni producción. Las cifras de riesgo, confianza y eficiencia del sistema son heurísticas hasta que existan calibración y benchmarks reproducibles.
