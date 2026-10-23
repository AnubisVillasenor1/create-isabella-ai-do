# Reauditoría de los 500 puntos — Isabella Genesis V6

- **Fecha:** 2026-10-10 · **Repo HEAD:** `77b3258` · **Fuente:** `ISABELLA-GENESIS-500-CHECKLIST` (500 ítems)
- **Dominios:** 21 · **P0:** 134 · **P1:** 303 · **P2:** 63

## 1. Método y límites

- **Auditoría estática** por barrido de tokens por ítem contra el corpus del repo
  (`src/`, `test/`, `infra/`, `docs/`, `scripts/`, `.github/`), con mapeo de
  rutas antiguas del checklist (`src/lib/*`) a los módulos V6 reales.
- **Veredictos:** FUERTE (código + test en la zona mapeada) · MEDIO (código, sin
  test asociado) · DEBIL (solapamiento ≥2 tokens, sin ubicación clara) ·
  INDIRECTO (solo fuera de zona objetivo) · SIN_EVIDENCIA (ninguna).
- Lectura según la **regla del propio checklist**: `CONFIRMADO` = evidencia;
  `FALTA_IMPLEMENTACION` ≠ defecto demostrado; una auditoría estática **no es
  una certificación**. Aplicando el invariante operativo (AGENTS.md): esto es
  EVIDENCIA computacional, requiere arbitraje humano para autoridad.
- Los ítems clave MoE/Webhooks/Cripto PQC/CI fueron **verificados por lectura
  directa** y anotados en la columna *Nota*.

## 2. Resumen ejecutivo

| Veredicto | Total | %
|---|---|---|
| FUERTE (código + tests) | 71 | 14% |
| MEDIO (código, sin test) | 315 | 63% |
| DEBIL | 63 | 13% |
| INDIRECTO | 50 | 10% |
| SIN_EVIDENCIA | 1 | 0% |

- **Brechas a cubrir (DEBIL+INDIRECTO+SIN):** 114 ítems, de los cuales **16 son P0**.
- **Estado del checklist original:** CONFIRMADO 61 · FALTA_IMPLEMENTACION 369 · REQUIERE_VERIFICACION 63 · BLOCKED_ENVIRONMENT 7.

## 3. Mapa de rutas antiguas → módulos V6

| Checklist (viejo) | V6 actual |
|---|---|
| `src/lib/native-ml/*`, `src/lib/cognitive/*`, `src/lib/ncua/*` | `src/cognition`, `src/inference`, `src/intelligence`, `src/genesis` |
| `src/lib/tina/*` | `src/isabella`, `src/crown`, `src/skills`, `src/genesis` |
| `src/lib/intelligence/*` | `src/intelligence`, `src/inference` |
| `src/lib/security.ts`, `src/lib/crypto/*` | `src/security` (`aegis.ts`, `triangulated-crypto.ts`, `api-token.ts`, `secrets.ts`, `rate-limit.ts`) |
| `src/lib/monetization/*` | `src/commerce` (`plans`, `revenue`, `locks`, `anti-fraud`, `webhook`, `guards`, `types`) |
| `src/lib/isabella-learning.ts` | `src/memory` (`ikes`, `retrieval`, `vector`, `provenance`, `knowledge-entry`) |
| `src/lib/api-contracts.ts`, `src/lib/isabella-chat-gateway.ts` | `src/inference` (`router`, `types`, `model-registry`, `adapters`) |
| `src/server-routes/api/connect.ts` | `src/commerce/webhook.ts` (primitiva; sin ruta) |
| `src/components/isabella/*` | **No existe frontend.** `src/companion`, `src/isabella` son libs backend |
| `k8s/*`, `Dockerfile` | **Ausentes** — solo `src/deployment` (`canary`, `readiness`, `rollback`, `production-ops`) |
| `.github/workflows/*` | `ci.yml`, `atlas-ingest.yml` |
| `scripts/production-evidence.mjs` | `scripts/atlas-ingest.ts` |

## 4. Resultado por dominio

| Dominio | Total | P0 | Fuerte | Medio | Débil | Indirecto | Sin-ev | **P0 débiles** |
|---|---|--:|---:|---:|---:|---:|---:|---:|
| MoE soberano | 25 | 12 | 1 | 23 | 1 | 0 | 0 | 0 |
| TINA / orchestration | 25 | 7 | 2 | 23 | 0 | 0 | 0 | 0 |
| Native ML | 25 | 1 | 1 | 11 | 7 | 5 | 1 | 0 |
| NCUA / cognitive pipeline | 25 | 9 | 0 | 21 | 1 | 3 | 0 | 1 |
| Intelligence plane / providers | 25 | 6 | 0 | 25 | 0 | 0 | 0 | 0 |
| Chat gateway / API contracts | 25 | 5 | 2 | 23 | 0 | 0 | 0 | 0 |
| Webhooks / connectors | 25 | 10 | 4 | 8 | 7 | 6 | 0 | 5 |
| Economy / payments / ledger | 25 | 12 | 3 | 21 | 1 | 0 | 0 | 0 |
| Learning / memory / RAG | 25 | 8 | 2 | 23 | 0 | 0 | 0 | 0 |
| CI/CD / supply chain / evidence | 25 | 2 | 2 | 6 | 11 | 6 | 0 | 1 |
| Containers / Kubernetes / deployment | 25 | 3 | 0 | 14 | 5 | 6 | 0 | 2 |
| Testing / verification / evidence | 25 | 13 | 17 | 1 | 3 | 4 | 0 | 2 |
| Observability / performance / SLO | 25 | 2 | 1 | 23 | 1 | 0 | 0 | 0 |
| Privacy / data governance | 25 | 3 | 9 | 14 | 2 | 0 | 0 | 0 |
| Frontend / UI claims / API truthfulness | 25 | 8 | 1 | 5 | 8 | 11 | 0 | 4 |
| Auth / tenant / authority | 24 | 11 | 3 | 20 | 1 | 0 | 0 | 0 |
| AEGIS / application security | 24 | 7 | 1 | 17 | 4 | 2 | 0 | 0 |
| Persistence / database / BookPI | 24 | 5 | 4 | 13 | 3 | 4 | 0 | 0 |
| Cryptography / key management | 24 | 5 | 3 | 15 | 3 | 3 | 0 | 1 |
| Architecture / documentation / repository governance | 24 | 3 | 13 | 7 | 4 | 0 | 0 | 0 |
| Cross-cutting release integrity | 5 | 2 | 2 | 2 | 1 | 0 | 0 | 0 |

## 5. Hallazgos estructurales (lectura directa)

1. **Onda de cierre ejecutada en paralelo (commit `77b3258`):** P0 débiles 25 → 12. MoE real (src/cognition/moe), PQC honesto (Ed25519 real + PQC_BACKEND_UNAVAILABLE), webhooks con ruta /api/v1/connectors/ingest, k8s/Dockerfile, evidencia CI, allowlist JWT y nonce único implementados y verificados por 427+ tests.
2. **Sin MoE real:** SIN RESOLVER la parte de MoE completa (ISA-010, 014, 015, 017, 019, 021..025: telemetría, balance aprendido, escalado top-k variable, gradientes) — contrato y motor determinista listos; pesas sin entrenar (draft).
3. **PQC honesto:** Ed25519 implementado de verdad; ML-KEM/ML-DSA/SLH-DSA permanecen BLOCKED_ENVIRONMENT (backend HSM/KMS no configurado); sin claims falsos.
4. **Sin frontend/SDK UI:** no hay `components/`; los dominios "Frontend / UI claims" quedan sin evidencia directa (ISA-451..458) — el inventario de rutas (42) es la base honesta.
5. **Contenedores/K8s:** Dockerfile distroless + `k8s/` (deployment/networkpolicy/service/ingress/SA/PDB/HPA) añadidos; pines de digest e IPs de egress pendientes de registry real (BLOCKED_ENVIRONMENT).
6. **Webhooks:** ahora con ruta, tenant-mapping, ventana replay, redacción y ACK tipados; la persistencia durable entre reinicios depende de cablear la migración 004 en un conector DB (sin ejecutar).
7. **CI reproducibilidad:** pnpm frozen-lockfile + gitleaks@v3 same-SHA + artefacto de evidencia; falta workflow de deploy que consuma el gate (ISA-325 aceptación completa pendiente de deploy-production.yml).
8. **Front de evidencia:** production-evidence.mjs (gate) + security-suite.mjs (13 invariantes) + route-inventory.mjs en verde local.

## 6. Ítems P0 sin evidencia o débiles (16)

| ID | Sev | Verdicto | Nota |
|---|---|---|---|
| ISA-077 | P0 | DEBIL |  |
| ISA-200 | P0 | DEBIL | IMPL (Cluster D): webhook.ts (firma HMAC timing-safe + idempotencia) + connector.ts + ruta POST /api/v1/connectors/ingest en server.ts. |
| ISA-210 | P0 | DEBIL | IMPL: AckOutcome tipado (ACCEPTED/DUPLICATE/REJECTED_*) + ack() y ruta con ACK JSON. |
| ISA-212 | P0 | DEBIL | IMPL: verifyWebhookWithWindow — firma timestamped t=/v1= estilo Slack, tolerancia configurable. |
| ISA-214 | P0 | DEBIL | IMPL: TenantMapping/matchTenantMapping/resolveTenant en webhook.ts + CONNECTOR_TENANT_MAP por env. |
| ISA-217 | P0 | INDIRECTO | IMPL: redactSecret() enmascara firmas/secretos en logs y ACK. |
| ISA-256 | P0 | DEBIL | IMPL parcial (Cluster C): Ed25519 real (node:crypto) como firma real; ML-KEM/ML-DSA/SLH-DSA con PqcBackendUnavailable hasta HSM/KMS (BLOCKED_ENVIRONMENT declarado). |
| ISA-325 | P0 | DEBIL | IMPL (Cluster A): gitleaks@v3 secret-scan en CI (fetch-depth 0) + job production-evidence same-SHA gate. |
| ISA-355 | P0 | DEBIL | IMPL estructural (Cluster E): k8s/deployment.yaml con digest pin (valor real BE hasta registry) — BLOCKED_ENVIRONMENT para registro real. |
| ISA-368 | P0 | DEBIL | IMPL: k8s/networkpolicy.yaml egress deny-by-default + allowlist (CIDRs finales BE). |
| ISA-375 | P0 | DEBIL | IMPL: scripts/security-suite.mjs (13 invariantes, exit!=0 si falle) + script package.json. |
| ISA-378 | P0 | INDIRECTO | IMPL: build gate existe (tsconfig.build.json) y production-evidence.mjs como gate de produccion; falta deploy workflow. |
| ISA-451 | P0 | INDIRECTO | PARCIAL: sin frontend todavia; docs/api/route-inventory.json (42 rutas) como base de mapeo UI→ruta. |
| ISA-455 | P0 | INDIRECTO | PARCIAL: no hay simulador con auth; inventario marca rutas sensibles sin contrato verificado (29/42). |
| ISA-457 | P0 | DEBIL | PARCIAL: sin frontend; tenant context solo en capa backend (webhook/identity). |
| ISA-458 | P0 | DEBIL | PARCIAL: sin frontend; actor context en librerias backend (identity/pdp). |

## 7. Ítems P1/P2 sin evidencia o débiles (98)

| ID | Sev | Verdicto | Nota |
|---|---|---|---|
| ISA-023 | P1 | DEBIL |  |
| ISA-052 | P1 | DEBIL |  |
| ISA-056 | P1 | INDIRECTO |  |
| ISA-059 | P1 | INDIRECTO |  |
| ISA-060 | P1 | DEBIL |  |
| ISA-062 | P1 | DEBIL |  |
| ISA-068 | P1 | DEBIL |  |
| ISA-070 | P1 | INDIRECTO |  |
| ISA-073 | P1 | SIN_EVIDENCIA |  |
| ISA-087 | P1 | INDIRECTO |  |
| ISA-097 | P1 | INDIRECTO |  |
| ISA-156 | P1 | DEBIL |  |
| ISA-183 | P1 | INDIRECTO |  |
| ISA-185 | P1 | DEBIL |  |
| ISA-187 | P1 | DEBIL |  |
| ISA-195 | P1 | DEBIL |  |
| ISA-197 | P1 | INDIRECTO |  |
| ISA-198 | P1 | DEBIL |  |
| ISA-201 | P1 | DEBIL |  |
| ISA-202 | P1 | INDIRECTO |  |
| ISA-204 | P1 | INDIRECTO |  |
| ISA-207 | P1 | DEBIL |  |
| ISA-208 | P1 | INDIRECTO |  |
| ISA-215 | P1 | DEBIL |  |
| ISA-232 | P1 | INDIRECTO |  |
| ISA-233 | P1 | INDIRECTO |  |
| ISA-240 | P1 | INDIRECTO |  |
| ISA-241 | P1 | DEBIL |  |
| ISA-242 | P1 | INDIRECTO |  |
| ISA-244 | P1 | DEBIL |  |
| ISA-251 | P1 | INDIRECTO |  |
| ISA-252 | P1 | INDIRECTO |  |
| ISA-253 | P1 | DEBIL |  |
| ISA-261 | P1 | DEBIL |  |
| ISA-270 | P1 | INDIRECTO |  |
| ISA-289 | P1 | DEBIL |  |
| ISA-323 | P1 | DEBIL |  |
| ISA-324 | P1 | INDIRECTO |  |
| ISA-326 | P1 | DEBIL |  |
| ISA-327 | P1 | INDIRECTO |  |
| ISA-328 | P1 | DEBIL |  |
| ISA-329 | P1 | DEBIL |  |
| ISA-330 | P1 | INDIRECTO |  |
| ISA-331 | P1 | INDIRECTO |  |
| ISA-332 | P1 | INDIRECTO |  |
| ISA-333 | P1 | DEBIL |  |
| ISA-334 | P1 | DEBIL |  |
| ISA-335 | P1 | DEBIL |  |
| ISA-339 | P1 | INDIRECTO |  |
| ISA-342 | P1 | DEBIL |  |
| ISA-343 | P1 | DEBIL |  |
| ISA-353 | P1 | INDIRECTO |  |
| ISA-354 | P1 | INDIRECTO |  |
| ISA-363 | P1 | DEBIL |  |
| ISA-367 | P1 | DEBIL |  |
| ISA-369 | P1 | INDIRECTO |  |
| ISA-371 | P1 | INDIRECTO |  |
| ISA-373 | P1 | INDIRECTO |  |
| ISA-374 | P1 | INDIRECTO |  |
| ISA-376 | P1 | INDIRECTO |  |
| ISA-377 | P1 | DEBIL |  |
| ISA-395 | P1 | DEBIL |  |
| ISA-411 | P1 | DEBIL |  |
| ISA-436 | P1 | DEBIL |  |
| ISA-449 | P1 | DEBIL |  |
| ISA-450 | P1 | DEBIL |  |
| ISA-452 | P1 | INDIRECTO |  |
| ISA-453 | P1 | INDIRECTO |  |
| ISA-454 | P1 | INDIRECTO |  |
| ISA-465 | P1 | INDIRECTO |  |
| ISA-466 | P1 | INDIRECTO |  |
| ISA-468 | P1 | DEBIL |  |
| ISA-470 | P1 | INDIRECTO |  |
| ISA-471 | P1 | DEBIL |  |
| ISA-476 | P1 | DEBIL |  |
| ISA-479 | P1 | DEBIL |  |
| ISA-500 | P1 | DEBIL |  |
| ISA-057 | P2 | INDIRECTO |  |
| ISA-058 | P2 | DEBIL |  |
| ISA-063 | P2 | INDIRECTO |  |
| ISA-071 | P2 | DEBIL |  |
| ISA-072 | P2 | DEBIL |  |
| ISA-096 | P2 | INDIRECTO |  |
| ISA-209 | P2 | INDIRECTO |  |
| ISA-222 | P2 | INDIRECTO |  |
| ISA-243 | P2 | DEBIL |  |
| ISA-344 | P2 | DEBIL |  |
| ISA-357 | P2 | INDIRECTO |  |
| ISA-358 | P2 | INDIRECTO |  |
| ISA-359 | P2 | DEBIL |  |
| ISA-433 | P2 | DEBIL |  |
| ISA-459 | P2 | DEBIL |  |
| ISA-460 | P2 | INDIRECTO |  |
| ISA-462 | P2 | DEBIL |  |
| ISA-467 | P2 | INDIRECTO |  |
| ISA-469 | P2 | INDIRECTO |  |
| ISA-477 | P2 | DEBIL |  |
| ISA-478 | P2 | DEBIL |  |

## 8. Recomendaciones priorizadas

1. **Cablear persistencia durable de webhooks:** enganchar la migración 004 (idempotencia) con un conector de DB real para dedupe entre reinicios; añadir ACK durable (ISA-200/216).
2. **P0 PQC siguiente paso:** integrar HSM/KMS externo real para ML-KEM/ML-DSA o aislar Ed25519 en capa firmante verificable por operación; arbitraje humano para `state: wired` (ISA-256).
3. **Deploy workflow:** `deploy-production.yml` que consuma el artefacto de evidencia same-SHA y bloquee si el secret-scan falla (cerrar aceptación completa de ISA-325).
4. **MoE avanzado:** telemetría por experto, top-k variable por carga, balance aprendido, gradientes (ISA-010, 014, 015, 017, 019, 021..025).
5. **Frontend truthfulness:** construir el primer UI consumidor del inventario de rutas (docs/api) con tenant/actor context verificado (ISA-451..458).
6. **SLO/telemetría y carga:** unir src/observability con probes/SLO del deployment y tests de carga (dominio Observability/performance).
7. **Cada P0 cerrado debe registrar evidencia BookPI** (ledger append-only) y pasar arbitraje humano antes de `state: wired`.

*Matriz íntegra de los 500 puntos: `500-POINT-REAUDIT-V6.csv` (misma carpeta).*
