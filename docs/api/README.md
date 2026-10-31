# Inventario de rutas de API — Isabella Genesis V6

> Archivo **generado automáticamente** por `scripts/route-inventory.mjs`.
> `state: auto_generated` — no editar a mano; requiere revisión humana para ser
> evidencia (*CAPABILITY ≠ AUTHORITY ≠ EVIDENCE*, AGENTS.md).

- **Generado:** 2026-10-31T04:17:42.789Z
- **Fuente:** `src/server.ts` (parseo estático, sin ejecutar el servidor)
- **Rutas totales:** 304 · **Sensibles:** 181 · **Con contrato verificado:** 113
- **Contratos de tipo considerados:** `InferenceCapability`, `ModelDescriptor`, `GenerationRequest`, `GenerationResult`, `InferenceAdapter`, `EmbeddingAdapter`, `InferenceRouter`

## Tabla de rutas

| Método | Ruta | Handler | Sensible | Auth | Rate-limit | Validación | Verificado |
|---|---|---|---|---|---|---|---|
| `GET` | `/` | `inline@src/server.ts:468` | no | no | no | no | no |
| `GET` | `/styles/cinematic.css` | `inline@src/server.ts:480` | no | no | no | no | no |
| `GET` | `/styles/command-center.css` | `inline@src/server.ts:487` | no | no | no | no | no |
| `GET` | `/styles/nexus.css` | `inline@src/server.ts:494` | no | no | no | no | no |
| `GET` | `/ui/app.js` | `inline@src/server.ts:501` | no | no | no | no | no |
| `GET` | `/ui/chat-plus.js` | `inline@src/server.ts:508` | no | no | no | no | no |
| `GET` | `/ui/cognition-client.js` | `inline@src/server.ts:515` | sí | no | no | no | no |
| `GET` | `/ui/nexus.js` | `inline@src/server.ts:522` | no | no | no | no | no |
| `GET` | `/ui/universe-map.js` | `inline@src/server.ts:529` | no | no | no | no | no |
| `GET` | `/assets/video/IntroVideoIsabella.mp4` | `inline@src/server.ts:549` | no | no | no | no | no |
| `GET` | `/assets/video/IntroVideoIsabella-web.mp4` | `inline@src/server.ts:550` | no | no | no | no | no |
| `GET` | `/assets/video/IntroVideoIsabella-poster.jpg` | `inline@src/server.ts:554` | no | sí | sí | no | no |
| `GET` | `/api/v1/linguistics/stats` | `inline@src/server.ts:1880` | no | no | no | no | no |
| `GET` | `/api/v1/linguistics/search` | `inline@src/server.ts:1884` | no | no | sí | sí | no |
| `POST` | `/api/v1/linguistics/analyze` | `inline@src/server.ts:1892` | sí | no | sí | sí | no |
| `POST` | `/api/v1/linguistics/ingest` | `inline@src/server.ts:1901` | sí | sí | sí | sí | no |
| `GET` | `/health` | `inline@src/server.ts:1915` | no | no | no | no | no |
| `GET` | `/api/v1/health` | `inline@src/server.ts:1925` | no | no | no | no | sí |
| `GET` | `/api/v1/healthz` | `inline@src/server.ts:1939` | no | no | no | no | sí |
| `GET` | `/api/v1/status` | `inline@src/server.ts:1954` | no | no | no | no | sí |
| `GET` | `/api/v1/memory` | `inline@src/server.ts:1997` | no | sí | no | sí | sí |
| `POST` | `/api/v1/memory/ingest` | `inline@src/server.ts:2078` | sí | no | sí | sí | no |
| `GET` | `/api/v1/memory/proposals` | `inline@src/server.ts:2110` | no | sí | no | no | no |
| `POST` | `/api/v1/memory/proposals/:proposalId/resolve` | `inline@src/server.ts:2115` | sí | sí | no | sí | no |
| `GET` | `/api/v1/bookpi/events` | `inline@src/server.ts:2143` | no | no | sí | no | no |
| `GET` | `/api/v1/bookpi/events/admin` | `inline@src/server.ts:2164` | sí | sí | no | no | sí |
| `POST` | `/api/v1/tools/execute` | `inline@src/server.ts:2170` | sí | sí | sí | sí | sí |
| `GET` | `/api/v1/cognition/native-runtime` | `inline@src/server.ts:2213` | sí | no | no | no | no |
| `POST` | `/api/v1/cognition/route` | `inline@src/server.ts:2246` | sí | sí | sí | sí | sí |
| `GET` | `/api/v1/hypercore/turbo/status` | `inline@src/server.ts:2875` | no | no | sí | no | no |
| `POST` | `/api/v1/cognition/stream` | `inline@src/server.ts:2904` | sí | no | sí | sí | no |
| `GET` | `/api/v1/cognition/multimodal` | `inline@src/server.ts:3195` | sí | no | no | no | no |
| `POST` | `/api/v1/cognition/vision` | `inline@src/server.ts:3209` | sí | sí | sí | sí | sí |
| `POST` | `/api/v1/cognition/image` | `inline@src/server.ts:3265` | sí | sí | sí | sí | no |
| `POST` | `/api/v1/cognition/speech` | `inline@src/server.ts:3318` | sí | sí | sí | sí | sí |
| `POST` | `/api/v1/cognition/transcribe` | `inline@src/server.ts:3371` | sí | sí | sí | sí | sí |
| `POST` | `/api/v1/cognitive/request` | `inline@src/server.ts:3414` | sí | sí | sí | sí | no |
| `POST` | `/api/v1/isabella/mediate` | `inline@src/server.ts:3604` | sí | sí | sí | sí | sí |
| `POST` | `/api/v1/isabella/entropy` | `inline@src/server.ts:3681` | sí | no | sí | sí | no |
| `POST` | `/api/v1/isabella/rag/add` | `inline@src/server.ts:3710` | sí | sí | no | sí | no |
| `GET` | `/api/v1/isabella/rag/search` | `inline@src/server.ts:3723` | no | no | no | sí | no |
| `POST` | `/api/v1/domains/search` | `inline@src/server.ts:3729` | sí | no | no | sí | no |
| `POST` | `/api/v1/security/intent` | `inline@src/server.ts:3748` | sí | no | no | sí | no |
| `POST` | `/api/v1/security/prompt-guard` | `inline@src/server.ts:3754` | sí | no | no | sí | no |
| `POST` | `/api/v1/security/threat-intel` | `inline@src/server.ts:3760` | sí | no | no | sí | no |
| `GET` | `/api/v1/isabella/providers` | `inline@src/server.ts:3766` | no | no | no | no | no |
| `POST` | `/api/mcp` | `inline@src/server.ts:3776` | sí | sí | no | sí | no |
| `GET` | `/api/v1/i18n/locale` | `inline@src/server.ts:3876` | no | no | no | no | no |
| `POST` | `/api/isabella/chat` | `inline@src/server.ts:3886` | sí | no | sí | sí | no |
| `POST` | `/api/isabella/isa/reason` | `inline@src/server.ts:3915` | sí | no | no | sí | no |
| `POST` | `/api/isabella/crypto/sign` | `inline@src/server.ts:3932` | sí | sí | sí | sí | no |
| `POST` | `/api/isabella/crypto/verify` | `inline@src/server.ts:3950` | sí | no | no | sí | no |
| `POST` | `/api/v1/memory/store` | `inline@src/server.ts:3964` | sí | sí | no | sí | no |
| `GET` | `/api/v1/memory/recall` | `inline@src/server.ts:3982` | no | sí | no | sí | no |
| `GET` | `/api/v1/memory/snapshot` | `inline@src/server.ts:3990` | no | sí | no | sí | no |
| `GET` | `/api/v1/isabella/full-status` | `inline@src/server.ts:3996` | no | no | no | no | no |
| `GET` | `/api/v1/isabella/eval` | `inline@src/server.ts:4009` | no | no | no | no | no |
| `POST` | `/api/v1/security/canonicalize` | `inline@src/server.ts:4033` | sí | no | no | sí | no |
| `POST` | `/api/v1/governance/review/submit` | `inline@src/server.ts:4044` | sí | sí | no | sí | no |
| `POST` | `/api/v1/governance/review/:id/approve` | `inline@src/server.ts:4056` | sí | sí | no | sí | no |
| `POST` | `/api/v1/governance/review/:id/reject` | `inline@src/server.ts:4067` | sí | sí | no | sí | no |
| `GET` | `/api/v1/governance/review` | `inline@src/server.ts:4078` | sí | sí | no | sí | no |
| `GET` | `/api/v1/isabella/status` | `inline@src/server.ts:4084` | no | no | no | no | no |
| `POST` | `/api/v1/isabella/foundational` | `inline@src/server.ts:4093` | sí | no | sí | sí | no |
| `GET` | `/api/v1/hsf/status` | `inline@src/server.ts:4120` | no | no | no | no | no |
| `POST` | `/api/v1/hsf/invoke` | `inline@src/server.ts:4139` | sí | sí | sí | sí | no |
| `GET` | `/api/v1/quantum/pennylane/status` | `inline@src/server.ts:4228` | no | no | no | no | no |
| `POST` | `/api/v1/quantum/pennylane/execute` | `inline@src/server.ts:4240` | sí | sí | sí | sí | no |
| `POST` | `/api/v1/triple-blockade/scan` | `inline@src/server.ts:4303` | sí | no | sí | no | no |
| `POST` | `/api/v1/notebook/generate` | `inline@src/server.ts:4342` | sí | no | sí | sí | no |
| `POST` | `/api/v1/audio-overview/generate` | `inline@src/server.ts:4413` | sí | no | sí | sí | no |
| `GET` | `/api/v1/territory/rdm` | `inline@src/server.ts:4464` | no | no | no | no | no |
| `POST` | `/api/v1/sanitization/scan` | `inline@src/server.ts:4509` | sí | no | sí | sí | no |
| `POST` | `/api/v1/knowledge/admit` | `inline@src/server.ts:4536` | sí | sí | sí | sí | no |
| `POST` | `/api/v1/governance/git` | `inline@src/server.ts:4675` | sí | no | sí | sí | no |
| `POST` | `/api/v1/governance/quality-gates` | `inline@src/server.ts:4688` | sí | no | sí | sí | no |
| `POST` | `/api/v1/governance/deployment` | `inline@src/server.ts:4711` | sí | no | sí | sí | no |
| `POST` | `/api/v1/governance/verify-agent-app` | `inline@src/server.ts:4733` | sí | no | sí | sí | no |
| `POST` | `/api/v1/governance/lifecycle-plan` | `inline@src/server.ts:4768` | sí | no | sí | sí | no |
| `POST` | `/api/v1/diff/observe` | `inline@src/server.ts:4781` | sí | no | sí | sí | no |
| `POST` | `/api/v1/sanitization/harden` | `inline@src/server.ts:4816` | sí | no | no | sí | no |
| `POST` | `/api/v1/security/triangulate` | `inline@src/server.ts:4833` | sí | no | no | sí | no |
| `POST` | `/api/v1/ops/readiness` | `inline@src/server.ts:4940` | sí | no | no | sí | no |
| `GET` | `/api/v1/readyz` | `inline@src/server.ts:4955` | no | no | no | no | no |
| `GET` | `/api/v1/ops/snapshot` | `inline@src/server.ts:4967` | no | no | no | no | no |
| `GET` | `/api/v1/integrations/graph` | `inline@src/server.ts:4977` | no | sí | no | no | no |
| `GET` | `/api/v1/ops/latency` | `inline@src/server.ts:5164` | no | sí | no | no | no |
| `POST` | `/api/v1/isa/pipeline` | `inline@src/server.ts:5176` | sí | no | no | sí | no |
| `POST` | `/api/v1/isa/act` | `inline@src/server.ts:5188` | sí | no | no | sí | no |
| `POST` | `/api/v1/litle/attest` | `inline@src/server.ts:5223` | sí | sí | sí | sí | no |
| `POST` | `/api/v1/litle/verify` | `inline@src/server.ts:5298` | sí | no | sí | sí | no |
| `POST` | `/api/v1/connectors/ingest` | `inline@src/server.ts:5396` | sí | no | no | sí | no |
| `GET` | `/api/v1/metrics` | `inline@src/server.ts:5497` | no | sí | no | no | no |
| `GET` | `/api/v1/runtime/capabilities` | `inline@src/server.ts:5509` | no | no | no | no | no |
| `POST` | `/api/v1/memory/verified` | `inline@src/server.ts:5540` | sí | sí | no | sí | no |
| `GET` | `/api/v1/memory/verified` | `inline@src/server.ts:5567` | no | sí | no | sí | no |
| `GET` | `/api/v1/osiris/status` | `inline@src/server.ts:5584` | no | sí | no | no | no |
| `POST` | `/api/v1/osiris/inspect` | `inline@src/server.ts:5589` | sí | sí | no | sí | no |
| `GET` | `/api/v1/billing/prices` | `inline@src/server.ts:5660` | no | no | no | no | no |
| `GET` | `/api/v1/billing/plans` | `inline@src/server.ts:5687` | no | no | no | no | no |
| `GET` | `/api/v1/billing/entitlements` | `inline@src/server.ts:5704` | no | no | no | sí | no |
| `GET` | `/api/v1/billing/subscription` | `inline@src/server.ts:5719` | no | sí | no | sí | no |
| `POST` | `/api/v1/billing/subscribe` | `inline@src/server.ts:5731` | sí | sí | no | sí | no |
| `POST` | `/api/v1/billing/cancel` | `inline@src/server.ts:5778` | sí | sí | no | sí | no |
| `GET` | `/api/v1/billing/usage` | `inline@src/server.ts:5807` | no | sí | no | sí | no |
| `POST` | `/api/v1/commerce/offers` | `inline@src/server.ts:5825` | sí | sí | no | sí | no |
| `GET` | `/api/v1/gameover/constitution` | `inline@src/server.ts:5878` | no | sí | no | no | no |
| `GET` | `/api/v1/gameover/passports` | `inline@src/server.ts:5883` | no | sí | no | no | no |
| `POST` | `/api/v1/gameover/passports` | `inline@src/server.ts:5895` | sí | sí | no | sí | no |
| `POST` | `/api/v1/gameover/passports/revoke` | `inline@src/server.ts:5935` | sí | sí | no | sí | no |
| `POST` | `/api/v1/gameover/govern` | `inline@src/server.ts:5953` | sí | sí | no | sí | no |
| `GET` | `/api/v1/gateway/activity` | `inline@src/server.ts:6066` | sí | sí | no | no | no |
| `GET` | `/api/v1/memory/stats` | `inline@src/server.ts:6464` | no | sí | no | no | no |
| `POST` | `/api/v1/memory/query` | `inline@src/server.ts:6469` | sí | sí | no | sí | sí |
| `POST` | `/api/v1/security/authenticate` | `inline@src/server.ts:6480` | sí | sí | no | sí | sí |
| `GET` | `/api/v1/security/audit` | `inline@src/server.ts:6490` | sí | sí | no | no | no |
| `POST` | `/api/v1/governance/evaluate` | `inline@src/server.ts:6497` | sí | sí | no | sí | no |
| `GET` | `/api/v1/governance/audit` | `inline@src/server.ts:6507` | sí | sí | no | no | no |
| `POST` | `/api/v1/learning/train` | `inline@src/server.ts:6514` | sí | sí | no | sí | no |
| `GET` | `/api/v1/observability/metrics` | `inline@src/server.ts:6542` | no | sí | no | no | no |
| `GET` | `/api/v1/observability/health` | `inline@src/server.ts:6548` | no | sí | no | no | no |
| `GET` | `/api/v1/observability/slos` | `inline@src/server.ts:6554` | no | sí | no | no | no |
| `GET` | `/api/v1/observability/alerts` | `inline@src/server.ts:6560` | no | sí | no | no | no |
| `GET` | `/api/v1/observability/dashboards` | `inline@src/server.ts:6572` | no | sí | no | no | no |
| `GET` | `/api/v1/federation/status` | `inline@src/server.ts:6582` | no | sí | no | no | no |
| `GET` | `/api/v1/federation/telemetry` | `inline@src/server.ts:6587` | no | sí | no | no | no |
| `POST` | `/api/v1/federation/cross` | `inline@src/server.ts:6592` | sí | sí | no | sí | sí |
| `GET` | `/api/v1/pipeline/metrics` | `inline@src/server.ts:6609` | sí | sí | no | no | no |
| `GET` | `/api/v1/pipeline/stats/hot` | `inline@src/server.ts:6614` | sí | sí | no | no | no |
| `GET` | `/api/v1/pipeline/stats/cold` | `inline@src/server.ts:6619` | sí | sí | no | no | no |
| `GET` | `/api/v1/platform/capabilities` | `inline@src/server.ts:6625` | no | sí | no | no | no |
| `POST` | `/api/v1/evidence-graph/append` | `inline@src/server.ts:6630` | sí | sí | no | sí | sí |
| `GET` | `/api/v1/evidence-graph/verify` | `inline@src/server.ts:6651` | sí | sí | no | no | no |
| `POST` | `/api/v1/temporal/record` | `inline@src/server.ts:6660` | sí | sí | no | sí | no |
| `GET` | `/api/v1/temporal/versions` | `inline@src/server.ts:6674` | no | sí | no | no | no |
| `POST` | `/api/v1/citemesh/publish` | `inline@src/server.ts:6684` | sí | sí | no | sí | no |
| `GET` | `/api/v1/citemesh/replay` | `inline@src/server.ts:6701` | no | sí | no | sí | no |
| `POST` | `/api/v1/cognitive-capital/list` | `inline@src/server.ts:6712` | sí | sí | no | sí | no |
| `POST` | `/api/v1/cognitive-capital/trade` | `inline@src/server.ts:6734` | sí | sí | no | sí | no |
| `POST` | `/api/v1/immune/report` | `inline@src/server.ts:6750` | sí | sí | no | sí | no |
| `POST` | `/api/v1/immune/assess` | `inline@src/server.ts:6765` | sí | sí | no | sí | no |
| `POST` | `/api/v1/fabric/execute` | `inline@src/server.ts:6780` | sí | sí | no | sí | no |
| `GET` | `/api/v1/monetization/plans` | `inline@src/server.ts:6797` | no | sí | no | no | no |
| `POST` | `/api/v1/monetization/escrow` | `inline@src/server.ts:6802` | sí | sí | no | sí | no |
| `POST` | `/api/v1/monetization/escrow/release` | `inline@src/server.ts:6818` | sí | sí | no | sí | no |
| `POST` | `/api/v1/monetization/payout` | `inline@src/server.ts:6829` | sí | sí | no | sí | no |
| `POST` | `/api/v1/monetization/scer-split` | `inline@src/server.ts:6845` | sí | sí | no | sí | no |
| `POST` | `/api/v1/pricing/dynamic` | `inline@src/server.ts:6856` | sí | sí | no | sí | no |
| `GET` | `/api/v1/monetization/stats` | `inline@src/server.ts:6872` | no | sí | no | no | no |
| `POST` | `/api/v1/monetization/profit-price` | `inline@src/server.ts:6881` | sí | sí | no | sí | no |
| `GET` | `/api/v1/ops/preflight` | `inline@src/server.ts:6901` | no | sí | no | no | no |
| `GET` | `/api/v1/reina/status` | `inline@src/server.ts:6927` | no | no | sí | no | no |
| `POST` | `/api/v1/reina/adjudicate` | `inline@src/server.ts:6941` | sí | sí | no | sí | sí |
| `GET` | `/api/v1/reina/log/proof/:index` | `inline@src/server.ts:6971` | no | sí | no | sí | no |
| `GET` | `/api/v1/agents` | `inline@src/routes/agents.ts:28` | no | no | sí | no | no |
| `POST` | `/api/v1/agents/run` | `inline@src/routes/agents.ts:50` | sí | no | sí | sí | no |
| `GET` | `/api/v1/developer/me` | `inline@src/routes/api-keys.ts:136` | no | no | no | no | no |
| `POST` | `/api/v1/admin/programs` | `inline@src/routes/api-keys.ts:151` | sí | sí | sí | sí | no |
| `GET` | `/api/v1/admin/api-keys` | `inline@src/routes/api-keys.ts:190` | sí | sí | no | sí | no |
| `POST` | `/api/v1/admin/api-keys/:id/rotate` | `inline@src/routes/api-keys.ts:196` | sí | sí | sí | sí | no |
| `DELETE` | `/api/v1/admin/api-keys/:id` | `inline@src/routes/api-keys.ts:226` | sí | sí | sí | sí | no |
| `POST` | `/api/v1/civilization/cycle` | `inline@src/routes/civilization.ts:30` | sí | sí | sí | sí | sí |
| `POST` | `/api/v1/security/document-seal` | `inline@src/routes/document-seal.ts:57` | sí | sí | sí | sí | sí |
| `POST` | `/api/v1/security/document-seal/verify` | `inline@src/routes/document-seal.ts:110` | sí | sí | sí | sí | sí |
| `GET` | `/api/v1/security/document-seal` | `inline@src/routes/document-seal.ts:151` | sí | sí | sí | no | sí |
| `POST` | `/api/v3/economy/calculate` | `inline@src/routes/economy.ts:55` | sí | no | sí | sí | sí |
| `POST` | `/api/v3/economy/settle` | `inline@src/routes/economy.ts:100` | sí | sí | sí | sí | sí |
| `GET` | `/api/v3/economy/ledger` | `inline@src/routes/economy.ts:155` | no | no | sí | no | sí |
| `GET` | `/api/v3/economy/streams` | `inline@src/routes/economy.ts:171` | no | no | sí | no | no |
| `POST` | `/api/v3/economy/quote` | `inline@src/routes/economy.ts:182` | sí | no | sí | sí | no |
| `GET` | `/api/v1/federation/node` | `inline@src/routes/federation.ts:112` | no | no | no | no | sí |
| `GET` | `/api/v1/federation/catalog` | `inline@src/routes/federation.ts:139` | no | no | no | no | sí |
| `GET` | `/api/v1/federation/models` | `inline@src/routes/federation.ts:144` | no | no | no | no | sí |
| `GET` | `/api/v1/federation/connectors` | `inline@src/routes/federation.ts:155` | no | sí | no | no | sí |
| `POST` | `/api/v1/federation/connectors` | `inline@src/routes/federation.ts:166` | sí | sí | sí | sí | sí |
| `DELETE` | `/api/v1/federation/connectors/:id` | `inline@src/routes/federation.ts:198` | sí | sí | no | sí | no |
| `GET` | `/api/v1/federation/inbox` | `inline@src/routes/federation.ts:219` | no | sí | no | no | no |
| `GET` | `/api/v1/federation/webhooks/:connectorId` | `inline@src/routes/federation.ts:228` | no | no | no | sí | sí |
| `POST` | `/api/v1/federation/webhooks/:connectorId` | `inline@src/routes/federation.ts:254` | sí | no | sí | sí | sí |
| `POST` | `/api/v1/governance/blackout/engage` | `inline@src/routes/governance-blackout.ts:143` | sí | sí | sí | sí | sí |
| `POST` | `/api/v1/governance/blackout/release` | `inline@src/routes/governance-blackout.ts:171` | sí | sí | sí | sí | sí |
| `GET` | `/api/v1/governance/blackout/status` | `inline@src/routes/governance-blackout.ts:202` | sí | sí | sí | no | sí |
| `POST` | `/api/v1/governance/legitimacy/evaluate` | `inline@src/routes/governance-blackout.ts:216` | sí | sí | sí | sí | sí |
| `POST` | `/api/v1/governance/order-permissions` | `inline@src/routes/governance-permissions.ts:40` | sí | no | sí | sí | sí |
| `POST` | `/api/v1/governance/order-authorize` | `inline@src/routes/governance-permissions.ts:62` | sí | sí | sí | sí | sí |
| `GET` | `/api/v1/hf/catalog` | `inline@src/routes/hf-hub.ts:38` | no | no | sí | sí | sí |
| `POST` | `/api/v1/hf/ingest` | `inline@src/routes/hf-hub.ts:59` | sí | sí | sí | sí | sí |
| `GET` | `/api/v1/hf/references` | `inline@src/routes/hf-hub.ts:92` | no | no | sí | sí | sí |
| `GET` | `/api/v1/hypercore/modes` | `inline@src/routes/hypercore.ts:79` | no | no | no | no | sí |
| `POST` | `/api/v1/hypercore/run` | `inline@src/routes/hypercore.ts:90` | sí | sí | no | sí | sí |
| `POST` | `/api/v1/hypercore/predict` | `inline@src/routes/hypercore.ts:126` | sí | sí | no | sí | sí |
| `GET` | `/api/v1/hypercore/skills` | `inline@src/routes/hypercore.ts:179` | no | no | no | no | sí |
| `POST` | `/api/v1/hypercore/skills/execute` | `inline@src/routes/hypercore.ts:196` | sí | sí | sí | sí | sí |
| `POST` | `/api/v1/mcp` | `inline@src/routes/hypercore.ts:250` | sí | sí | sí | sí | sí |
| `GET` | `/api/v1/emergency/status` | `inline@src/routes/ihec.ts:42` | no | no | sí | no | sí |
| `POST` | `/api/v1/emergency/snapshot` | `inline@src/routes/ihec.ts:56` | sí | no | sí | sí | sí |
| `POST` | `/api/v1/emergency/recover` | `inline@src/routes/ihec.ts:83` | sí | no | sí | sí | sí |
| `POST` | `/api/v1/emergency/repair` | `inline@src/routes/ihec.ts:112` | sí | no | sí | sí | no |
| `GET` | `/api/v1/emergency/governance` | `inline@src/routes/ihec.ts:124` | sí | no | sí | no | sí |
| `POST` | `/api/v1/emergency/failover` | `inline@src/routes/ihec.ts:129` | sí | no | sí | sí | sí |
| `GET` | `/api/v1/emergency/cache` | `inline@src/routes/ihec.ts:153` | no | no | sí | no | sí |
| `POST` | `/api/v1/emergency/rag` | `inline@src/routes/ihec.ts:158` | sí | no | sí | sí | sí |
| `GET` | `/api/v1/emergency/telemetry` | `inline@src/routes/ihec.ts:171` | no | no | sí | no | sí |
| `GET` | `/api/v1/emergency/crisis` | `inline@src/routes/ihec.ts:184` | no | no | sí | no | sí |
| `GET` | `/api/v1/emergency/mutation` | `inline@src/routes/ihec.ts:189` | no | no | sí | no | sí |
| `GET` | `/api/v1/emergency/topology` | `inline@src/routes/ihec.ts:194` | no | no | sí | sí | sí |
| `GET` | `/api/v1/ivcc/status` | `inline@src/routes/ivcc.ts:186` | no | no | sí | no | sí |
| `POST` | `/api/v1/ivcc/plan` | `inline@src/routes/ivcc.ts:195` | sí | no | sí | no | sí |
| `POST` | `/api/v1/voice/create` | `inline@src/routes/ivcc.ts:214` | sí | sí | sí | sí | sí |
| `POST` | `/api/v1/consent/register` | `inline@src/routes/ivcc.ts:296` | sí | sí | sí | sí | sí |
| `POST` | `/api/v1/consent/validate` | `inline@src/routes/ivcc.ts:339` | sí | sí | sí | sí | sí |
| `DELETE` | `/api/v1/consent/revoke` | `inline@src/routes/ivcc.ts:365` | sí | sí | sí | sí | sí |
| `GET` | `/api/v1/audit` | `inline@src/routes/ivcc.ts:400` | no | sí | sí | sí | sí |
| `POST` | `/api/v1/ivcc/memory` | `inline@src/routes/ivcc.ts:431` | sí | sí | sí | sí | sí |
| `DELETE` | `/api/v1/ivcc/memory` | `inline@src/routes/ivcc.ts:477` | sí | sí | sí | sí | sí |
| `POST` | `/api/v1/synthesize` | `inline@src/routes/ivcc.ts:505` | sí | no | sí | no | sí |
| `POST` | `/v1/messages` | `inline@src/routes/llm-gateway.ts:126` | sí | no | no | sí | no |
| `POST` | `/v1beta/models/:spec` | `inline@src/routes/llm-gateway.ts:255` | sí | no | no | sí | no |
| `GET` | `/llama/v1/models` | `inline@src/routes/llm-gateway.ts:409` | no | no | no | no | no |
| `POST` | `/llama/v1/chat/completions` | `inline@src/routes/llm-gateway.ts:417` | sí | no | no | sí | no |
| `GET` | `/api/v1/customization/catalog` | `inline@src/routes/marketplace.ts:41` | no | no | sí | no | sí |
| `GET` | `/api/v1/customization/catalog/:id` | `inline@src/routes/marketplace.ts:54` | no | no | sí | sí | sí |
| `GET` | `/api/v1/marketplace` | `inline@src/routes/marketplace.ts:70` | no | no | sí | no | sí |
| `GET` | `/api/v1/marketplace/:packId` | `inline@src/routes/marketplace.ts:75` | no | no | sí | sí | sí |
| `POST` | `/api/v1/marketplace/plan` | `inline@src/routes/marketplace.ts:86` | sí | sí | sí | sí | sí |
| `GET` | `/api/v1/native/engines` | `inline@src/routes/native-engines.ts:78` | no | no | no | no | sí |
| `GET` | `/api/v1/native/llm/status` | `inline@src/routes/native-engines.ts:119` | no | no | sí | no | no |
| `POST` | `/api/v1/native/llm/generate` | `inline@src/routes/native-engines.ts:132` | sí | sí | sí | sí | sí |
| `POST` | `/api/v1/native/moe/diagnostics` | `inline@src/routes/native-engines.ts:166` | sí | sí | sí | sí | sí |
| `GET` | `/api/v3/omega/constitution` | `inline@src/routes/omega.ts:74` | no | no | sí | no | sí |
| `POST` | `/api/v3/omega/constitution/evaluate` | `inline@src/routes/omega.ts:85` | sí | no | sí | sí | sí |
| `POST` | `/api/v3/omega/simulation/run` | `inline@src/routes/omega.ts:104` | sí | no | sí | sí | sí |
| `POST` | `/api/v3/omega/capital/value` | `inline@src/routes/omega.ts:133` | sí | no | sí | sí | sí |
| `POST` | `/api/v3/omega/civilization/value` | `inline@src/routes/omega.ts:161` | sí | no | sí | sí | sí |
| `GET` | `/api/v3/omega/nexus` | `inline@src/routes/omega.ts:180` | no | no | sí | sí | sí |
| `POST` | `/api/v3/omega/twins/federate` | `inline@src/routes/omega.ts:191` | sí | no | sí | sí | sí |
| `POST` | `/api/v3/omega/memory/store` | `inline@src/routes/omega.ts:214` | sí | no | sí | sí | sí |
| `POST` | `/api/v3/omega/memory/query` | `inline@src/routes/omega.ts:239` | sí | no | sí | sí | sí |
| `POST` | `/api/v3/omega/trust/analyze` | `inline@src/routes/omega.ts:265` | sí | no | sí | sí | sí |
| `POST` | `/api/v3/omega/research/run` | `inline@src/routes/omega.ts:279` | sí | no | sí | sí | sí |
| `POST` | `/api/v3/omega/territory/fabricate` | `inline@src/routes/omega.ts:301` | sí | no | sí | sí | sí |
| `GET` | `/v1/models` | `inline@src/routes/openai.ts:119` | no | no | no | no | no |
| `POST` | `/v1/chat/completions` | `inline@src/routes/openai.ts:133` | sí | no | no | sí | no |
| `POST` | `/v1/completions` | `inline@src/routes/openai.ts:230` | sí | no | no | sí | no |
| `POST` | `/api/v1/pipeline/execute` | `inline@src/routes/pipeline.ts:100` | sí | sí | sí | sí | sí |
| `GET` | `/chat` | `inline@src/routes/platform.ts:119` | no | no | sí | no | no |
| `GET` | `/platform` | `inline@src/routes/platform.ts:128` | no | no | sí | no | no |
| `GET` | `/platform/:page` | `inline@src/routes/platform.ts:138` | no | no | sí | sí | no |
| `GET` | `/styles/platform.css` | `inline@src/routes/platform.ts:176` | no | no | no | no | no |
| `GET` | `/ui/platform.js` | `inline@src/routes/platform.ts:184` | no | no | no | no | no |
| `GET` | `/ui/platform-chat.js` | `inline@src/routes/platform.ts:192` | no | no | no | no | no |
| `GET` | `/ui/platform/logo-isav6.jpeg` | `inline@src/routes/platform.ts:200` | no | no | no | no | no |
| `GET` | `/api/v1/platform/catalog` | `inline@src/routes/platform.ts:210` | no | no | sí | no | no |
| `POST` | `/api/v1/revenue/iet/calculate` | `inline@src/routes/revenue-fabric.ts:135` | sí | sí | sí | sí | no |
| `POST` | `/api/v1/revenue/settle` | `inline@src/routes/revenue-fabric.ts:168` | sí | sí | sí | sí | sí |
| `GET` | `/api/v1/revenue/settlements/:idempotencyKey` | `inline@src/routes/revenue-fabric.ts:290` | no | sí | sí | sí | no |
| `GET` | `/api/v1/revenue/ledger/journals` | `inline@src/routes/revenue-fabric.ts:306` | no | sí | sí | no | no |
| `GET` | `/api/v1/revenue/ledger/verify` | `inline@src/routes/revenue-fabric.ts:314` | sí | sí | sí | no | no |
| `POST` | `/api/v1/revenue/usage` | `inline@src/routes/revenue-fabric.ts:326` | sí | sí | sí | sí | no |
| `GET` | `/api/v1/revenue/usage/:userId` | `inline@src/routes/revenue-fabric.ts:381` | no | sí | sí | no | no |
| `GET` | `/api/v1/revenue/usage/:userId/invoice` | `inline@src/routes/revenue-fabric.ts:397` | no | sí | sí | no | no |
| `GET` | `/api/v1/revenue/wallet/:userId` | `inline@src/routes/revenue-fabric.ts:449` | no | sí | sí | sí | no |
| `POST` | `/api/v1/revenue/wallet/:userId/credit` | `inline@src/routes/revenue-fabric.ts:476` | sí | sí | sí | sí | no |
| `POST` | `/api/v1/revenue/wallet/:userId/debit` | `inline@src/routes/revenue-fabric.ts:516` | sí | sí | sí | sí | no |
| `GET` | `/api/v1/revenue/my/wallet` | `inline@src/routes/revenue-fabric.ts:540` | no | no | sí | no | no |
| `POST` | `/api/v1/revenue/my/wallet/payout` | `inline@src/routes/revenue-fabric.ts:561` | sí | no | sí | no | no |
| `POST` | `/api/v1/revenue/eligibility/:userId` | `inline@src/routes/revenue-fabric.ts:578` | sí | sí | sí | sí | no |
| `GET` | `/api/v1/revenue/eligibility/:userId` | `inline@src/routes/revenue-fabric.ts:599` | no | sí | sí | no | no |
| `POST` | `/api/v1/revenue/contributions/:userId` | `inline@src/routes/revenue-fabric.ts:614` | sí | sí | sí | sí | no |
| `GET` | `/api/v1/revenue/contributions/:userId/total` | `inline@src/routes/revenue-fabric.ts:636` | no | sí | sí | no | no |
| `GET` | `/api/v1/revenue/streams` | `inline@src/routes/revenue-fabric.ts:648` | no | sí | sí | no | no |
| `POST` | `/api/v1/billing/checkout` | `inline@src/routes/revenue-fabric.ts:746` | sí | no | sí | sí | no |
| `POST` | `/api/v1/billing/portal` | `inline@src/routes/revenue-fabric.ts:790` | sí | no | sí | no | no |
| `POST` | `/api/v1/billing/stripe/webhook` | `inline@src/routes/revenue-fabric.ts:817` | sí | no | no | sí | no |
| `GET` | `/api/v1/revenue/outbox/status` | `inline@src/routes/revenue-fabric.ts:860` | no | sí | sí | no | no |
| `GET` | `/api/v1/revenue/outbox/dead-letter` | `inline@src/routes/revenue-fabric.ts:868` | no | sí | sí | no | no |
| `POST` | `/api/v1/revenue/outbox/retry/:eventId` | `inline@src/routes/revenue-fabric.ts:876` | sí | sí | sí | no | no |
| `GET` | `/api/v1/revenue/health` | `inline@src/routes/revenue-fabric.ts:917` | no | sí | no | no | no |
| `GET` | `/api/skills/catalog` | `list@src/routes/skill-catalog.ts:113` | no | no | no | no | sí |
| `GET` | `/api/skills/catalog/:id` | `byId@src/routes/skill-catalog.ts:114` | no | no | no | no | sí |
| `GET` | `/api/v1/tamv/status` | `inline@src/routes/tamv.ts:84` | no | no | no | no | sí |
| `GET` | `/api/v1/tamv/presets` | `inline@src/routes/tamv.ts:95` | no | no | no | no | sí |
| `GET` | `/api/v1/tamv/presets/:presetId` | `inline@src/routes/tamv.ts:112` | no | no | no | no | sí |
| `POST` | `/api/v1/tamv/analyze` | `inline@src/routes/tamv.ts:118` | sí | sí | sí | no | sí |
| `POST` | `/api/v1/tamv/adaptive-preset` | `inline@src/routes/tamv.ts:142` | sí | sí | sí | no | sí |
| `POST` | `/api/v1/tamv/redefine-plan` | `inline@src/routes/tamv.ts:168` | sí | sí | sí | sí | sí |
| `POST` | `/api/v1/intelligence/triage` | `inline@src/routes/traffic-light.ts:33` | sí | sí | sí | sí | sí |
| `GET` | `/api/v3/treasury/balance/:partyId` | `inline@src/routes/treasury.ts:61` | no | sí | sí | sí | sí |
| `POST` | `/api/v3/treasury/credit` | `inline@src/routes/treasury.ts:115` | sí | no | no | no | sí |
| `POST` | `/api/v3/treasury/debit` | `inline@src/routes/treasury.ts:116` | sí | no | no | no | sí |
| `POST` | `/api/v3/affiliates/register` | `inline@src/routes/treasury.ts:118` | sí | sí | sí | sí | sí |
| `POST` | `/api/v3/affiliates/attribute` | `inline@src/routes/treasury.ts:141` | sí | sí | sí | sí | sí |
| `POST` | `/api/v3/fraud/analyze` | `inline@src/routes/treasury.ts:176` | sí | no | sí | sí | sí |
| `GET` | `/api/v1/tts/status` | `inline@src/routes/tts.ts:129` | no | no | no | no | sí |
| `POST` | `/api/v1/tts/plan` | `inline@src/routes/tts.ts:133` | sí | no | sí | no | sí |
| `POST` | `/api/v1/tts/stream` | `inline@src/routes/tts.ts:156` | sí | no | sí | no | sí |
| `POST` | `/api/v1/tts/interrupt` | `inline@src/routes/tts.ts:221` | sí | no | sí | no | sí |
| `POST` | `/api/v1/tts/synthesize` | `inline@src/routes/tts.ts:234` | sí | sí | sí | no | sí |
| `POST` | `/api/v1/voice/speak` | `inline@src/routes/tts.ts:282` | sí | no | sí | no | no |
| `POST` | `/api/v1/tts/memory` | `inline@src/routes/tts.ts:327` | sí | no | sí | sí | sí |
| `DELETE` | `/api/v1/tts/memory` | `inline@src/routes/tts.ts:340` | sí | no | sí | no | sí |
| `POST` | `/api/v1/intelligence/turbo-plan` | `inline@src/routes/turbo-planner.ts:32` | sí | sí | sí | sí | sí |
| `POST` | `/api/v1/yun/events` | `inline@src/routes/yun-events.ts:34` | sí | sí | no | sí | sí |
| `GET` | `/api/v1/yun/events` | `inline@src/routes/yun-events.ts:60` | no | no | sí | no | sí |

> Las columnas **Auth**, **Rate-limit** y **Validación** son heurísticas de análisis
> estático sobre el cuerpo del handler (presencia de `authorizeApiToken` /
> `verifyBearerToken` / `assertBalancedAuthority` / `authorizeAdmin` /
> `authorizeProviderRoute`, `enforceRateLimit` y guardas de
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
verificado. Hoy la mayoría de rutas queda con `verified: false` (191 de 304);
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
