# REINA — fachada de adjudicación gobernada

state: draft | engine-generated (pendiente de revisión humana con nombre)

REINA no es una conciencia, AGI ni autoridad. Es un pipeline determinista que decide, **antes** de que otra capa actúe, qué requisitos faltan. No ejecuta nada. CAPABILITY ≠ AUTHORITY ≠ EXECUTION ≠ EVIDENCE.

Pipeline (`src/reina/governor.ts`): validación → kill switch (`security/kill-switch`) → riesgo R (`governance/risk-score`) → autonomía A0–A5 (`governance/autonomy`) → quórum M-de-N (`governance/quorum`) → sello de evidencia en log Merkle RFC 6962 (`bookpi/transparency`) y sink BookPI. Idempotencia por `Idempotency-Key` (`ingress/idempotency`).

Veredictos: PERMIT, REQUIRE_CONFIRMATION, REQUIRE_QUORUM, REQUIRE_HUMAN_APPROVAL, DENY, HALTED. PERMIT = "ninguna regla bloqueó", no "ejecútese".

Otros módulos nuevos: `privacy/crypto-shred`, `privacy/differential-privacy`, `security/key-hierarchy` (HKDF por propósito, rotación en dos fases), `governance/incident` (S0–S3 + FSM).

Rutas: `GET /api/v1/reina/status` (público), `POST /api/v1/reina/adjudicate` y `GET /api/v1/reina/log/proof/:index` (token `GENESIS_ADMIN_API_TOKEN`). `humanApprovalVerified` y `quorum` jamás se leen del cuerpo HTTP.

Límites: log en memoria (volátil, no WORM, sin anclaje RFC 3161); la semántica de los factores C,S,F,P,U del riesgo y los umbrales de autonomía por impacto son supuestos de borrador a arbitrar; typecheck/vitest oficiales no se corrieron en el entorno de generación (registro npm bloqueado), solo un arnés local.
