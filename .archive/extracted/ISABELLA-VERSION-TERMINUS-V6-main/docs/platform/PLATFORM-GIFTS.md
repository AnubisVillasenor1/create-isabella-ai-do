# Plataforma: diez capacidades añadidas (2026-10-16)

state: draft | engine-generated (pendiente de revisión humana con nombre). Manifiesto ejecutable: `src/platform/index.ts` (`PLATFORM_GIFTS`).

| # | Capacidad | Archivo | Cableado |
|---|-----------|---------|----------|
| 1 | Reintentos con backoff, jitter completo y deadline | `src/resilience/retry.ts` | biblioteca |
| 2 | Bulkhead (cola acotada, load shedding) | `src/resilience/bulkhead.ts` | biblioteca |
| 3 | Inbox de webhooks + guarda de orden | `src/ingress/webhook-inbox.ts` | webhook de Stripe |
| 4 | Preflight de configuración | `src/health/preflight.ts` | arranque (`STRICT_PREFLIGHT=1`) + `GET /api/v1/ops/preflight` |
| 5 | Redactor de PII (CURP/RFC/CLABE/tarjeta validados) | `src/privacy/pii-redactor.ts` | biblioteca |
| 6 | SLO y quema multi-ventana | `src/observability/slo.ts` | biblioteca |
| 7 | BM25 + RRF | `src/memory/bm25.ts` | biblioteca |
| 8 | Feature flags con rollout y kill switch | `src/governance/feature-flags.ts` | biblioteca |
| 9 | Presupuesto de costo con reservas | `src/inference/cost-budget.ts` | biblioteca |
| 10 | Paquete de evidencia verificable offline | `src/bookpi/evidence-bundle.ts` | biblioteca |

Honestidad: "biblioteca" significa implementada y probada pero NO invocada por el runtime todavía; integrarla en una ruta o flujo requiere decisión humana. Los límites de cada módulo están en el manifiesto. Los estados en memoria son por proceso. Ninguna capacidad concede autoridad ni ejecuta efectos externos.
