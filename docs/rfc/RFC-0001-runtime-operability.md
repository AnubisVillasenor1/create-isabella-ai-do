# RFC-0001 — Runtime y operatividad

## Estado actual
Isabella arranca con `src/server.ts`, expone `/api/v1/healthz`, `/api/v1/readyz`, `/api/v1/status`, chat, cognición, tools, skills y gobernanza. El proceso puede servir el workspace hoy, pero la certificación productiva depende de configuración, persistencia, firma, pruebas E2E y aprobación humana.

## Elementos faltantes para operatividad
1. Instalar dependencias con `pnpm install --frozen-lockfile` y Node 24.
2. Crear `.env` desde `.env.example` y completar secretos.
3. Ejecutar `pnpm check:env`, `pnpm typecheck`, `pnpm lint`, `pnpm test`, `pnpm build`, `pnpm deploy:readiness`.
4. Configurar al menos un proveedor de inferencia o habilitar explícitamente keyless.
5. Configurar PostgreSQL durable y `BOOKPI_INTEGRITY_SECRET` (>=32 chars, alta entropía).
6. Aplicar migraciones Supabase/Postgres (`supabase/migrations`, `infra/db/migrations`).
7. Configurar Supabase URL + service role + anon/publishable key si se usa Atlas/IKES.
8. Generar/rotar tokens administrativos y de aprobación humana.
9. Verificar `/api/v1/readyz` = 200 en el entorno objetivo.
10. Ejecutar smoke UI/runtime/producción.
11. Configurar observabilidad OTLP export real (hoy parcial/in-process).
12. Probar despliegue, backup/restore y rollback.

## Criterio de salida
`/api/v1/readyz` devuelve 200 con evidencia durable, CI verde en el SHA desplegado y smoke E2E aprobado. Un test verde no equivale a aprobación humana.
