# RFC-0007 — Despliegue y operaciones

## Gates
typecheck, lint, format:check, test, smoke:ui, smoke:runtime, build, deploy:readiness.

## CI
`.github/workflows/ci.yml` ejecuta lint/typecheck/test/security/docker. Deploy staging/producción manual o por push develop.

## Faltantes
- CI verde en SHA candidato.
- Despliegue real + rollback.
- Backup/restore probado.
- OTLP export real y alertas.
- E2E navegador desktop/móvil.
- Medición de latencia p50/p95/p99 bajo carga.
