# OSIRIS — capa de observación de ciberdefensa (estado: `draft | auto_generated`)

**Módulo:** `src/osiris/` · **Versión:** `0.1.0` · **Integrado en:** runtime Genesis (TypeScript/Express).

> **Contrato de veracidad:** `SPECIFIED ≠ IMPLEMENTED ≠ TESTED ≠ INTEGRATED ≠ VERIFIED ≠ DEPLOYED ≠ CERTIFIED`.

Este documento describe **lo que OSIRIS hace realmente en este repositorio**, no lo que una narrativa promete. Requiere revisión humana antes de declararse `verified` o `wired`.

## Qué es OSIRIS (aquí y ahora)

OSIRIS es una **capa de observación**: recibe señales de seguridad ya normalizadas, aplica **reglas heurísticas deterministas**, produce un resultado **advisory**, y lo registra de forma append-only en el ledger BookPI. Expone métricas y un *posture* honesto del estado de los controles defensivos.

OSIRIS **no** es (y no afirma ser):

- un modelo de ML entrenado ni un clasificador probabilístico;
- un sistema de bloqueo o respuesta automática;
- un sistema certificado ni "seguro";
- una capacidad con precisión/recall medidos (no existe `99.87%` medido aquí);
- un sustituto de ISA-X, AEGIS, CROWN, BookPI o del criterio humano.

## Qué SÍ hace (implementado y probado)

| Capacidad | Archivo | Evidencia |
|---|---|---|
| Motor de detección heurístico determinista (8 reglas) | `src/osiris/detection.ts` | `test/osiris/detection.test.ts` |
| Evaluación de postura defensiva con estados `active/inactive/unknown` | `src/osiris/posture.ts` | `test/osiris/posture.test.ts` |
| Centinela: inspección, recomendación **advisory**, registro BookPI y métricas | `src/osiris/sentinel.ts` | `test/osiris/sentinel.test.ts` |
| Endpoints gated por token admin | `src/server.ts` | `GET /api/v1/osiris/status`, `POST /api/v1/osiris/inspect` |

### Reglas de detección (deterministas, no ML)

| Regla | Categoría | Disparador | Severidad |
|---|---|---|---|
| `OSIRIS-RATE-001` | `rate_anomaly` | tasa de peticiones ≥300 / ≥1000 por minuto | medium / high |
| `OSIRIS-AUTH-001` | `credential_abuse` | fallos de autenticación ≥5 / ≥10 | medium / high |
| `OSIRIS-PAYLOAD-001` | `payload_anomaly` | entrada >20 000 / >100 000 caracteres | medium / high |
| `OSIRIS-RECON-001` | `reconnaissance` | recursos únicos ≥50 / ≥200 | medium / high |
| `OSIRIS-INJECT-001` | `injection_attempt` | marcadores `sql-keywords`/`prompt-injection`/`template-injection` | high |
| `OSIRIS-EVASION-001` | `policy_evasion` | marcador `jailbreak-lexicon` | high |
| `OSIRIS-EXPOSURE-001` | `credential_abuse` | acceso no autenticado a `sensitive-resource` | medium |
| `OSIRIS-CRYPTO-001` | `crypto_posture` | transporte no reportado como TLS | low |

La `confidence` de cada hallazgo es un **peso heurístico declarado a mano** (no una probabilidad medida). El `score` compuesto (0–100) es una suma acotada de pesos, no una métrica calibrada.

### Recomendación (advisory)

`ALLOW` → `MONITOR` → `RATE_LIMIT` → `REVIEW` → `BLOCK_RECOMMENDED`, derivada de la severidad máxima observada. **OSIRIS no ejecuta** ninguna de estas acciones: la autoridad humana decide y ejecuta.

### Postura defensiva

Siete controles (`post_quantum_readiness`, `signature_identity`, `secret_hygiene`, `rate_limiting`, `transport_tls`, `ledger_durability`, `audit_chain_integrity`) con estado `active`/`inactive`/`unknown`. Un control no sondeado es `unknown`, **nunca** `active`. La postura se declara siempre `NOT_CERTIFIED` y `trainedModelPresent: false`.

## Invariante de gobernanza

OSIRIS respeta `CAPABILITY ≠ AUTHORITY ≠ EXECUTION ≠ EVIDENCE ≠ LEARNING ≠ PRODUCTION`: observa y registra evidencia, pero no sustituye autoridad ni ejecuta producción.

## Integración con la arquitectura existente

- **BookPI** (`src/bookpi/ledger.ts`): cada inspección añade un evento append-only (`type: "osiris.detection"`, `methodId` OSIRIS, `riskTier` según severidad). El ledger actual es **en memoria (no durable)** — ver brechas del README raíz.
- **ISA-X / PQC** (`src/security/isa-x/`): la postura reporta su disponibilidad; OSIRIS no reimplementa criptografía.
- **AEGIS / CROWN:** OSIRIS complementa, no reemplaza, la admisión y los guardrails.
- **Observabilidad:** las métricas de OSIRIS son internas al centinela y se exponen en el snapshot; no duplican `MetricsRegistry`.

## Cómo integrar

```ts
import { createOsirisSentinel } from "./osiris";

const sentinel = createOsirisSentinel();
const result = sentinel.inspect({
  id: "sig-1",
  timestamp: new Date().toISOString(),
  source: "http",
  actorId: "human:analyst",
  features: { failedAuthAttempts: 12, isAuthenticated: false, contentFlags: ["sensitive-resource"] },
});
// result.recommendation es ADVISORY; ninguna acción se ejecuta automáticamente.
```

## Lo que falta para madurar (roadmap honesto)

1. **Persistencia durable** del ledger de hallazgos (hoy en memoria) + retención y backup/restore.
2. **Medición empírica**: construir un conjunto de datos etiquetado y **medir** precisión/falsos positivos; solo entonces publicar cifras, con el conjunto y el método.
3. **Correlación** entre señales (ventanas temporales) más allá de umbrales por señal.
4. **Postura real** conectada a sondas del entorno (no inyectada manualmente).
5. **Revisión humana con nombre** para promover de `draft` a `verified`.
6. Endurecer: integración con AEGIS para enforcement **solo** bajo decisión humana explícita.

## Descargo

Este módulo es una **beta de ingeniería**, no un producto certificado. No ofrece garantía de detección, disponibilidad ni cumplimiento normativo. Cualquier afirmación de superioridad o cifras no medidas queda fuera de este repositorio por su constitución.
