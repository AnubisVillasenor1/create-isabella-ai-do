# Inventario de rutas de API — Isabella Genesis V6

> Archivo **generado automáticamente** por `scripts/route-inventory.mjs`.
> `state: auto_generated` — no editar a mano; requiere revisión humana para ser
> evidencia (*CAPABILITY ≠ AUTHORITY ≠ EVIDENCE*, AGENTS.md).

- **Generado:** 2026-10-19T11:05:55.924Z
- **Fuente:** `src/server.ts` (parseo estático, sin ejecutar el servidor)
- **Rutas totales:** 175 · **Sensibles:** 110 · **Con contrato verificado:** 6
- **Contratos de tipo considerados:** `InferenceCapability`, `ModelDescriptor`, `GenerationRequest`, `GenerationResult`, `InferenceAdapter`, `EmbeddingAdapter`, `InferenceRouter`

## Tabla de rutas

| Método | Ruta | Handler | Sensible | Auth | Rate-limit | Validación | Verificado |
|---|---|---|---|---|---|---|---|
| `GET` | `/` | `inline@src/server.ts:199` | no | no | no | no | no |
| `GET` | `/styles/cinematic.css` | `inline@src/server.ts:206` | no | no | no | no | no |
| `GET` | `/styles/command-center.css` | `inline@src/server.ts:213` | no | no | no | no | no |
| `GET` | `/ui/app.js` | `inline@src/server.ts:220` | no | no | no | no | no |
| `GET` | `/ui/chat-plus.js` | `inline@src/server.ts:227` | no | no | no | no | no |
| `GET` | `/assets/video/IntroVideoIsabella.mp4` | `inline@src/server.ts:242` | no | no | no | no | no |
| `GET` | `/assets/video/IntroVideoIsabella-web.mp4` | `inline@src/server.ts:243` | no | no | no | no | no |
| `GET` | `/assets/video/IntroVideoIsabella-poster.jpg` | `inline@src/server.ts:244` | no | sí | sí | no | no |
| `GET` | `/api/v1/linguistics/stats` | `inline@src/server.ts:830` | no | no | no | no | no |
| `GET` | `/api/v1/linguistics/search` | `inline@src/server.ts:834` | no | no | no | sí | no |
| `POST` | `/api/v1/linguistics/analyze` | `inline@src/server.ts:840` | sí | no | no | sí | no |
| `POST` | `/api/v1/linguistics/ingest` | `inline@src/server.ts:846` | sí | no | no | sí | no |
| `GET` | `/health` | `inline@src/server.ts:853` | no | no | no | no | no |
| `GET` | `/api/v1/health` | `inline@src/server.ts:863` | no | no | no | no | sí |
| `GET` | `/api/v1/healthz` | `inline@src/server.ts:877` | no | no | no | no | no |
| `GET` | `/api/v1/status` | `inline@src/server.ts:891` | no | no | no | no | sí |
| `GET` | `/api/v1/memory` | `inline@src/server.ts:943` | no | sí | no | sí | sí |
| `POST` | `/api/v1/memory/ingest` | `inline@src/server.ts:961` | sí | no | sí | sí | no |
| `GET` | `/api/v1/memory/proposals` | `inline@src/server.ts:987` | no | sí | no | no | no |
| `POST` | `/api/v1/memory/proposals/:proposalId/resolve` | `inline@src/server.ts:992` | sí | sí | no | sí | no |
| `GET` | `/api/v1/bookpi/events` | `inline@src/server.ts:1013` | no | no | sí | no | no |
| `GET` | `/api/v1/bookpi/events/admin` | `inline@src/server.ts:1034` | sí | sí | no | no | no |
| `POST` | `/api/v1/tools/execute` | `inline@src/server.ts:1040` | sí | no | sí | sí | no |
| `GET` | `/api/v1/cognition/native-runtime` | `inline@src/server.ts:1092` | sí | no | no | no | no |
| `POST` | `/api/v1/cognition/route` | `inline@src/server.ts:1110` | sí | no | sí | sí | sí |
| `GET` | `/api/v1/cognition/multimodal` | `inline@src/server.ts:1356` | sí | no | no | no | no |
| `POST` | `/api/v1/cognition/vision` | `inline@src/server.ts:1370` | sí | no | sí | sí | no |
| `POST` | `/api/v1/cognition/image` | `inline@src/server.ts:1425` | sí | no | sí | sí | no |
| `GET` | `/api/v1/tts/status` | `inline@src/server.ts:1475` | no | no | no | no | no |
| `POST` | `/api/v1/tts/synthesize` | `inline@src/server.ts:1480` | sí | no | sí | sí | no |
| `POST` | `/api/v1/cognition/speech` | `inline@src/server.ts:1494` | sí | no | sí | sí | no |
| `POST` | `/api/v1/cognition/transcribe` | `inline@src/server.ts:1543` | sí | no | sí | sí | no |
| `POST` | `/api/v1/cognitive/request` | `inline@src/server.ts:1581` | sí | no | sí | sí | no |
| `POST` | `/api/v1/isabella/mediate` | `inline@src/server.ts:1704` | sí | sí | sí | sí | sí |
| `POST` | `/api/v1/isabella/entropy` | `inline@src/server.ts:1771` | sí | no | sí | sí | no |
| `GET` | `/api/v1/isabella/status` | `inline@src/server.ts:1788` | no | no | no | no | no |
| `GET` | `/api/v1/hsf/status` | `inline@src/server.ts:1798` | no | no | no | no | no |
| `POST` | `/api/v1/hsf/invoke` | `inline@src/server.ts:1811` | sí | sí | sí | sí | no |
| `GET` | `/api/v1/quantum/pennylane/status` | `inline@src/server.ts:1875` | no | no | no | no | no |
| `POST` | `/api/v1/quantum/pennylane/execute` | `inline@src/server.ts:1887` | sí | sí | sí | sí | no |
| `POST` | `/api/v1/triple-blockade/scan` | `inline@src/server.ts:1940` | sí | no | sí | no | no |
| `POST` | `/api/v1/notebook/generate` | `inline@src/server.ts:1974` | sí | no | sí | sí | no |
| `POST` | `/api/v1/audio-overview/generate` | `inline@src/server.ts:2044` | sí | no | sí | sí | no |
| `GET` | `/api/v1/territory/rdm` | `inline@src/server.ts:2092` | no | no | no | no | no |
| `POST` | `/api/v1/sanitization/scan` | `inline@src/server.ts:2113` | sí | no | sí | sí | no |
| `POST` | `/api/v1/knowledge/admit` | `inline@src/server.ts:2136` | sí | sí | sí | sí | no |
| `POST` | `/api/v1/governance/git` | `inline@src/server.ts:2238` | sí | no | sí | sí | no |
| `POST` | `/api/v1/governance/quality-gates` | `inline@src/server.ts:2249` | sí | no | sí | sí | no |
| `POST` | `/api/v1/governance/deployment` | `inline@src/server.ts:2268` | sí | no | sí | sí | no |
| `POST` | `/api/v1/governance/verify-agent-app` | `inline@src/server.ts:2288` | sí | no | sí | sí | no |
| `POST` | `/api/v1/governance/lifecycle-plan` | `inline@src/server.ts:2308` | sí | no | sí | sí | no |
| `POST` | `/api/v1/diff/observe` | `inline@src/server.ts:2319` | sí | no | sí | sí | no |
| `POST` | `/api/v1/sanitization/harden` | `inline@src/server.ts:2343` | sí | no | no | sí | no |
| `POST` | `/api/v1/security/triangulate` | `inline@src/server.ts:2358` | sí | no | no | sí | no |
| `POST` | `/api/v1/ops/readiness` | `inline@src/server.ts:2436` | sí | no | no | sí | no |
| `GET` | `/api/v1/readyz` | `inline@src/server.ts:2447` | no | no | no | no | no |
| `GET` | `/api/v1/ops/snapshot` | `inline@src/server.ts:2459` | no | no | no | no | no |
| `GET` | `/api/v1/integrations/graph` | `inline@src/server.ts:2469` | no | sí | no | no | sí |
| `GET` | `/api/v1/ops/latency` | `inline@src/server.ts:2551` | no | sí | no | no | no |
| `POST` | `/api/v1/isa/pipeline` | `inline@src/server.ts:2563` | sí | no | no | sí | no |
| `POST` | `/api/v1/isa/act` | `inline@src/server.ts:2573` | sí | no | no | sí | no |
| `POST` | `/api/v1/litle/attest` | `inline@src/server.ts:2602` | sí | sí | sí | sí | no |
| `POST` | `/api/v1/litle/verify` | `inline@src/server.ts:2652` | sí | no | sí | sí | no |
| `POST` | `/api/v1/connectors/ingest` | `inline@src/server.ts:2740` | sí | no | no | sí | no |
| `GET` | `/api/v1/metrics` | `inline@src/server.ts:2824` | no | sí | no | no | no |
| `GET` | `/api/v1/runtime/capabilities` | `inline@src/server.ts:2836` | no | no | no | no | no |
| `POST` | `/api/v1/memory/verified` | `inline@src/server.ts:2857` | sí | sí | no | sí | no |
| `GET` | `/api/v1/memory/verified` | `inline@src/server.ts:2877` | no | sí | no | sí | no |
| `GET` | `/api/v1/osiris/status` | `inline@src/server.ts:2891` | no | sí | no | no | no |
| `POST` | `/api/v1/osiris/inspect` | `inline@src/server.ts:2896` | sí | sí | no | sí | no |
| `GET` | `/api/v1/billing/prices` | `inline@src/server.ts:2961` | no | no | no | no | no |
| `POST` | `/api/v1/billing/checkout` | `inline@src/server.ts:2965` | sí | sí | no | sí | no |
| `POST` | `/api/v1/billing/portal` | `inline@src/server.ts:3002` | sí | sí | no | sí | no |
| `POST` | `/api/v1/billing/stripe/webhook` | `inline@src/server.ts:3040` | sí | no | no | sí | no |
| `GET` | `/api/v1/billing/plans` | `inline@src/server.ts:3093` | no | no | no | no | no |
| `GET` | `/api/v1/billing/entitlements` | `inline@src/server.ts:3105` | no | no | no | sí | no |
| `GET` | `/api/v1/billing/subscription` | `inline@src/server.ts:3115` | no | sí | no | sí | no |
| `POST` | `/api/v1/billing/subscribe` | `inline@src/server.ts:3127` | sí | sí | no | sí | no |
| `POST` | `/api/v1/billing/cancel` | `inline@src/server.ts:3169` | sí | sí | no | sí | no |
| `GET` | `/api/v1/billing/usage` | `inline@src/server.ts:3195` | no | sí | no | sí | no |
| `POST` | `/api/v1/commerce/offers` | `inline@src/server.ts:3213` | sí | sí | no | sí | no |
| `GET` | `/api/v1/gameover/constitution` | `inline@src/server.ts:3264` | no | sí | no | no | no |
| `GET` | `/api/v1/gameover/passports` | `inline@src/server.ts:3269` | no | sí | no | no | no |
| `POST` | `/api/v1/gameover/passports` | `inline@src/server.ts:3280` | sí | sí | no | sí | no |
| `POST` | `/api/v1/gameover/passports/revoke` | `inline@src/server.ts:3311` | sí | sí | no | sí | no |
| `POST` | `/api/v1/gameover/govern` | `inline@src/server.ts:3329` | sí | sí | no | sí | no |
| `GET` | `/api/v1/platform/capabilities` | `inline@src/server.ts:3586` | no | sí | no | no | no |
| `POST` | `/api/v1/evidence-graph/append` | `inline@src/server.ts:3591` | sí | sí | no | sí | no |
| `GET` | `/api/v1/evidence-graph/verify` | `inline@src/server.ts:3609` | sí | sí | no | no | no |
| `POST` | `/api/v1/temporal/record` | `inline@src/server.ts:3614` | sí | sí | no | sí | no |
| `GET` | `/api/v1/temporal/versions` | `inline@src/server.ts:3625` | no | sí | no | no | no |
| `POST` | `/api/v1/citemesh/publish` | `inline@src/server.ts:3630` | sí | sí | no | sí | no |
| `GET` | `/api/v1/citemesh/replay` | `inline@src/server.ts:3641` | no | sí | no | sí | no |
| `POST` | `/api/v1/cognitive-capital/list` | `inline@src/server.ts:3648` | sí | sí | no | sí | no |
| `POST` | `/api/v1/cognitive-capital/trade` | `inline@src/server.ts:3663` | sí | sí | no | sí | no |
| `POST` | `/api/v1/immune/report` | `inline@src/server.ts:3674` | sí | sí | no | sí | no |
| `POST` | `/api/v1/immune/assess` | `inline@src/server.ts:3685` | sí | sí | no | sí | no |
| `POST` | `/api/v1/fabric/execute` | `inline@src/server.ts:3696` | sí | sí | no | sí | no |
| `POST` | `/api/v1/governance/evaluate` | `inline@src/server.ts:3707` | sí | sí | no | sí | no |
| `GET` | `/api/v1/monetization/plans` | `inline@src/server.ts:3722` | no | sí | no | no | no |
| `POST` | `/api/v1/monetization/escrow` | `inline@src/server.ts:3727` | sí | sí | no | sí | no |
| `POST` | `/api/v1/monetization/escrow/release` | `inline@src/server.ts:3738` | sí | sí | no | sí | no |
| `POST` | `/api/v1/monetization/payout` | `inline@src/server.ts:3749` | sí | sí | no | sí | no |
| `POST` | `/api/v1/monetization/scer-split` | `inline@src/server.ts:3760` | sí | sí | no | sí | no |
| `POST` | `/api/v1/pricing/dynamic` | `inline@src/server.ts:3771` | sí | sí | no | sí | no |
| `GET` | `/api/v1/monetization/stats` | `inline@src/server.ts:3782` | no | sí | no | no | no |
| `GET` | `/api/v1/ops/preflight` | `inline@src/server.ts:3788` | no | sí | no | no | no |
| `GET` | `/api/v1/reina/status` | `inline@src/server.ts:3807` | no | no | sí | no | no |
| `POST` | `/api/v1/reina/adjudicate` | `inline@src/server.ts:3814` | sí | sí | no | sí | no |
| `GET` | `/api/v1/reina/log/proof/:index` | `inline@src/server.ts:3842` | no | sí | no | sí | no |
| `POST` | `/api/v1/civilization/cycle` | `inline@src/routes/civilization.ts:25` | sí | no | sí | sí | no |
| `POST` | `/api/v1/security/document-seal` | `inline@src/routes/document-seal.ts:57` | sí | no | sí | sí | no |
| `POST` | `/api/v1/security/document-seal/verify` | `inline@src/routes/document-seal.ts:91` | sí | no | sí | sí | no |
| `GET` | `/api/v1/security/document-seal` | `inline@src/routes/document-seal.ts:120` | sí | no | sí | no | no |
| `POST` | `/api/v3/economy/calculate` | `inline@src/routes/economy.ts:52` | sí | no | sí | sí | no |
| `POST` | `/api/v3/economy/settle` | `inline@src/routes/economy.ts:91` | sí | no | sí | sí | no |
| `GET` | `/api/v3/economy/ledger` | `inline@src/routes/economy.ts:137` | no | no | sí | no | no |
| `POST` | `/api/v1/governance/order-permissions` | `inline@src/routes/governance-permissions.ts:32` | sí | no | sí | sí | no |
| `POST` | `/api/v1/governance/order-authorize` | `inline@src/routes/governance-permissions.ts:47` | sí | no | sí | sí | no |
| `GET` | `/api/v1/hf/catalog` | `inline@src/routes/hf-hub.ts:28` | no | no | sí | sí | no |
| `POST` | `/api/v1/hf/ingest` | `inline@src/routes/hf-hub.ts:47` | sí | no | sí | sí | no |
| `GET` | `/api/v1/hypercore/modes` | `inline@src/routes/hypercore.ts:59` | no | no | no | no | no |
| `POST` | `/api/v1/hypercore/run` | `inline@src/routes/hypercore.ts:70` | sí | sí | no | sí | no |
| `POST` | `/api/v1/hypercore/predict` | `inline@src/routes/hypercore.ts:101` | sí | sí | no | sí | no |
| `GET` | `/api/v1/hypercore/skills` | `inline@src/routes/hypercore.ts:146` | no | no | no | no | no |
| `POST` | `/api/v1/hypercore/skills/execute` | `inline@src/routes/hypercore.ts:163` | sí | sí | sí | sí | no |
| `POST` | `/api/v1/mcp` | `inline@src/routes/hypercore.ts:203` | sí | sí | sí | sí | no |
| `GET` | `/api/v1/emergency/status` | `inline@src/routes/ihec.ts:37` | no | no | sí | no | no |
| `POST` | `/api/v1/emergency/snapshot` | `inline@src/routes/ihec.ts:51` | sí | no | sí | sí | no |
| `POST` | `/api/v1/emergency/recover` | `inline@src/routes/ihec.ts:76` | sí | no | sí | sí | no |
| `POST` | `/api/v1/emergency/repair` | `inline@src/routes/ihec.ts:102` | sí | no | sí | sí | no |
| `GET` | `/api/v1/emergency/governance` | `inline@src/routes/ihec.ts:111` | sí | no | sí | no | no |
| `POST` | `/api/v1/emergency/failover` | `inline@src/routes/ihec.ts:116` | sí | no | sí | sí | no |
| `GET` | `/api/v1/emergency/cache` | `inline@src/routes/ihec.ts:134` | no | no | sí | no | no |
| `POST` | `/api/v1/emergency/rag` | `inline@src/routes/ihec.ts:139` | sí | no | sí | sí | no |
| `GET` | `/api/v1/emergency/telemetry` | `inline@src/routes/ihec.ts:152` | no | no | sí | no | no |
| `GET` | `/api/v1/emergency/crisis` | `inline@src/routes/ihec.ts:165` | no | no | sí | no | no |
| `GET` | `/api/v1/emergency/mutation` | `inline@src/routes/ihec.ts:170` | no | no | sí | no | no |
| `GET` | `/api/v1/emergency/topology` | `inline@src/routes/ihec.ts:175` | no | no | sí | sí | no |
| `GET` | `/api/v1/customization/catalog` | `inline@src/routes/marketplace.ts:41` | no | no | sí | no | no |
| `GET` | `/api/v1/customization/catalog/:id` | `inline@src/routes/marketplace.ts:54` | no | no | sí | sí | no |
| `GET` | `/api/v1/marketplace` | `inline@src/routes/marketplace.ts:65` | no | no | sí | no | no |
| `GET` | `/api/v1/marketplace/:packId` | `inline@src/routes/marketplace.ts:70` | no | no | sí | sí | no |
| `POST` | `/api/v1/marketplace/plan` | `inline@src/routes/marketplace.ts:81` | sí | no | sí | sí | no |
| `GET` | `/api/v3/omega/constitution` | `inline@src/routes/omega.ts:70` | no | no | sí | no | no |
| `POST` | `/api/v3/omega/constitution/evaluate` | `inline@src/routes/omega.ts:81` | sí | no | sí | sí | no |
| `POST` | `/api/v3/omega/simulation/run` | `inline@src/routes/omega.ts:100` | sí | no | sí | sí | no |
| `POST` | `/api/v3/omega/capital/value` | `inline@src/routes/omega.ts:121` | sí | no | sí | sí | no |
| `POST` | `/api/v3/omega/civilization/value` | `inline@src/routes/omega.ts:143` | sí | no | sí | sí | no |
| `GET` | `/api/v3/omega/nexus` | `inline@src/routes/omega.ts:157` | no | no | sí | sí | no |
| `POST` | `/api/v3/omega/twins/federate` | `inline@src/routes/omega.ts:163` | sí | no | sí | sí | no |
| `POST` | `/api/v3/omega/memory/store` | `inline@src/routes/omega.ts:181` | sí | no | sí | sí | no |
| `POST` | `/api/v3/omega/memory/query` | `inline@src/routes/omega.ts:201` | sí | no | sí | sí | no |
| `POST` | `/api/v3/omega/trust/analyze` | `inline@src/routes/omega.ts:220` | sí | no | sí | sí | no |
| `POST` | `/api/v3/omega/research/run` | `inline@src/routes/omega.ts:234` | sí | no | sí | sí | no |
| `POST` | `/api/v3/omega/territory/fabricate` | `inline@src/routes/omega.ts:250` | sí | no | sí | sí | no |
| `GET` | `/v1/models` | `inline@src/routes/openai.ts:107` | no | no | no | no | no |
| `POST` | `/v1/chat/completions` | `inline@src/routes/openai.ts:121` | sí | no | no | sí | no |
| `POST` | `/v1/completions` | `inline@src/routes/openai.ts:186` | sí | no | no | sí | no |
| `POST` | `/api/v1/pipeline/execute` | `inline@src/routes/pipeline.ts:91` | sí | no | sí | sí | no |
| `POST` | `/api/v1/intelligence/triage` | `inline@src/routes/traffic-light.ts:28` | sí | no | sí | sí | no |
| `GET` | `/api/v3/treasury/balance/:partyId` | `inline@src/routes/treasury.ts:60` | no | no | sí | sí | no |
| `POST` | `/api/v3/treasury/credit` | `inline@src/routes/treasury.ts:112` | sí | no | no | no | no |
| `POST` | `/api/v3/treasury/debit` | `inline@src/routes/treasury.ts:113` | sí | no | no | no | no |
| `POST` | `/api/v3/affiliates/register` | `inline@src/routes/treasury.ts:115` | sí | no | sí | sí | no |
| `POST` | `/api/v3/affiliates/attribute` | `inline@src/routes/treasury.ts:135` | sí | no | sí | sí | no |
| `POST` | `/api/v3/fraud/analyze` | `inline@src/routes/treasury.ts:170` | sí | no | sí | sí | no |
| `GET` | `/api/v1/tts/status` | `inline@src/routes/tts.ts:47` | no | no | no | no | no |
| `POST` | `/api/v1/tts/plan` | `inline@src/routes/tts.ts:51` | sí | no | sí | no | no |
| `POST` | `/api/v1/tts/synthesize` | `inline@src/routes/tts.ts:59` | sí | no | sí | no | no |
| `POST` | `/api/v1/tts/memory` | `inline@src/routes/tts.ts:71` | sí | no | sí | sí | no |
| `DELETE` | `/api/v1/tts/memory` | `inline@src/routes/tts.ts:82` | sí | no | sí | no | no |
| `POST` | `/api/v1/intelligence/turbo-plan` | `inline@src/routes/turbo-planner.ts:27` | sí | no | sí | sí | no |
| `POST` | `/api/v1/yun/events` | `inline@src/routes/yun-events.ts:29` | sí | no | no | sí | no |
| `GET` | `/api/v1/yun/events` | `inline@src/routes/yun-events.ts:53` | no | no | sí | no | no |

> Las columnas **Auth**, **Rate-limit** y **Validación** son heurísticas de análisis
> estático sobre el cuerpo del handler (presencia de `authorizeApiToken` /
> `verifyBearerToken` / `assertBalancedAuthority`, `enforceRateLimit` y guardas de
> entrada). No son una prueba en ejecución.

## Cómo regenerar

```bash
node scripts/route-inventory.mjs
```

El script reescribe por completo `docs/api/route-inventory.json` y este README.
No requiere dependencias ni red. Si `src/server.ts` no tiene rutas parseables,
reporta la verdad: lista vacía + aviso en consola.

## Semántica de `verified`

`verified: true` **no** significa "la ruta funciona". Significa que existe al menos
una referencia externa al contrato de la ruta:

1. una **prueba** que cita la ruta (`test:...`), o
2. la **documentación** canónica (`docs:docs/spec/BLUEPRINT-API-v4.2.0.md`), o
3. un **contrato de tipo** cuyo nombre comparte el dominio de la ruta
   (`types:src/inference/types.ts:...`).

Ser simplemente un handler de Express tipado por inferencia **no** cuenta como
verificado. Hoy la mayoría de rutas queda con `verified: false` (169 de 175);
eso es el estado real del repositorio, no un defecto del script.

## UI/API truthfulness (ISA-451..458)

Este inventario es la **base de veracidad** para cualquier superficie de UI o
catálogo de API:

- **ISA-451 (MoE UI truth):** si el catálogo etiqueta una ruta como "DeepSeek-V3"
  o "MoE", debe apuntar a una fila con `verified: true` y con un contrato
  respaldado; si no, la UI debe rotularla como heurística/simulación.
- **ISA-452/453 (CoT/Swarm UI truth):** las trazas de razonamiento y las
  estrategias de enjambre deben declarse simuladas salvo que mapeen a una ruta
  verificada de este inventario.
- **ISA-454 (RAG UI truth):** la presentación de RAG debe ligarse a la ruta de
  memoria/retrieval realmente inventariada, no a datos de ejemplo.
- **ISA-455..458 (simulador / tenant / actor):** toda acción privilegiada del
  simulador debe corresponder a una ruta sensible con `Auth: sí`; la UI nunca
  debe enviar `tenantId`/`actorId` como autoridad — el servidor debe derivarlos.
  Las rutas sensibles **sin** auth/rate-limit/validación son deuda explícita
  visible en la tabla.
- **ISA-475 (claim-to-code map):** este archivo es el mapa "claim → ruta
  ejecutable" que exige el checklist.

## Evidencia y `.gitignore`

Los artefactos en `evidence/*.json` (p. ej. `production-evidence.json`,
`security-suite.json`) **no** se versionan: la línea `evidence/*.json` se añade al
`.gitignore` del repositorio por el ensamblador. La evidencia misma se adjunta
como artefacto de CI ligado al SHA exacto (ISA-325 / ISA-336 / ISA-337).
