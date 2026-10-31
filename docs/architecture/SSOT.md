# SSOT de Arquitectura — Isabella TERMINUS V6

> `state: draft | engine-generated` — Fuente única de verdad arquitectónica. Referenciada por el
> registro de gobernanza (`src/lib/governance/500-gates.ts`). Este fichero **no** redefine la
> arquitectura: declara cuáles son las fuentes canónicas y cómo se relacionan.

## 1. Fuentes canónicas de arquitectura

| Capa | Fuente | Rol |
| --- | --- | --- |
| Spec Genesis V6 | [`../spec/GENESIS-V6-ARCHITECTURE.md`](../spec/GENESIS-V6-ARCHITECTURE.md) | canon |
| Runtime Genesis V6.1 | [`../spec/GENESIS-V6.1-RUNTIME.md`](../spec/GENESIS-V6.1-RUNTIME.md) | canon |
| Canon Génesis Ω∞ | [`../spec/ISABELLA-OMEGA-INFINITY-GENESIS-CANON.md`](../spec/ISABELLA-OMEGA-INFINITY-GENESIS-CANON.md) | canon |
| Mapa operativo (CROWN · BookPI · HyperCore · Osiris · Reina) | [`../reference/ARCHITECTURE.md`](../reference/ARCHITECTURE.md) | consolidado |
| Memoria formal de la Capa Genesis | [`../isabella_genesis_omega.tex`](../isabella_genesis_omega.tex) | especificación |

En conflicto entre código y spec, **gana la spec** (§6 AGENTS.md); la divergencia se archiva en
[`../spec/canonical/DIVERGENCE-REGISTER.md`](../spec/canonical/DIVERGENCE-REGISTER.md).

## 2. Modelo de capas (Capa Genesis, L0–L11)

`isabella_genesis_omega.tex` formaliza las 12 capas de ejecución y los 6 macrodominios. El
`src/omega/genesis/*` las implementa como módulos deterministas con identidad de método
`[TINA].[YUN].[MODULO].[FUNCION].[VERSION].[RISK_TIER].[GOVERNANCE_TIER]`.

## 3. Puntos de autoridad

- **CROWN** es el único punto de decisión de autorización (Zero-Trust: `ALLOW = I×A×C×P×E`).
- **BookPI** es el ledger append-only; todo cambio de estado de capacidad se registra y se ancla
  con raíz Merkle ([`../reference/ECONOMY.md`](../reference/ECONOMY.md)).
- **GAME OVER / UAGP-1** decide, puntúa y registra antes de ejecutar; nunca ejecuta ni certifica.

## 4. Fronteras honestas

- Ningún control generado por máquina se declara `verified` sin evidencia humana reproducida.
- Los contratos de la Capa Genesis ([`../../openapi/`](../../openapi/), [`../../asyncapi/`](../../asyncapi/))
  son especificación, no endpoints en producción.
- PQC: `BLOCKED_ENVIRONMENT`.
